import { useState, useEffect, useCallback, useRef } from 'react';
import { Platform } from 'react-native';

interface ConnectivityState {
  isOnline: boolean;
  isReconnecting: boolean;
  lastOnlineAt: number | null;
}

/**
 * Tracks network connectivity state for offline/bad-internet handling.
 *
 * On web, uses the browser's `navigator.onLine` and `online`/`offline` events.
 * On native, falls back to a heartbeat ping approach (fetch with timeout).
 *
 * Returns:
 * - isOnline: whether the device currently has connectivity
 * - isReconnecting: whether we just came back online and are re-establishing
 * - wasOffline: whether we were offline since the last check
 */
export function useConnectivity(): ConnectivityState & {
  wasOffline: boolean;
  resetWasOffline: () => void;
} {
  const [isOnline, setIsOnline] = useState(true);
  const [isReconnecting, setIsReconnecting] = useState(false);
  const [lastOnlineAt, setLastOnlineAt] = useState<number | null>(null);
  const [wasOffline, setWasOffline] = useState(false);
  const wasOfflineRef = useRef(false);
  const pingTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const checkConnectivity = useCallback(async () => {
    if (Platform.OS === 'web') {
      const online = typeof navigator !== 'undefined' ? navigator.onLine : true;
      if (online && !isOnline) {
        setIsReconnecting(true);
        setIsOnline(true);
        setLastOnlineAt(Date.now());
        setWasOffline(wasOfflineRef.current);
        wasOfflineRef.current = false;
        setTimeout(() => setIsReconnecting(false), 2000);
      } else if (!online && isOnline) {
        setIsOnline(false);
        wasOfflineRef.current = true;
      }
    } else {
      // Native: ping Supabase health endpoint
      try {
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 5000);
        const response = await fetch(`${process.env.EXPO_PUBLIC_SUPABASE_URL || ''}/rest/v1/`, {
          method: 'HEAD',
          signal: controller.signal,
          headers: { apikey: process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY || '' },
        });
        clearTimeout(timeout);

        if (response.ok || response.status === 401) {
          if (!isOnline) {
            setIsReconnecting(true);
            setIsOnline(true);
            setLastOnlineAt(Date.now());
            setWasOffline(wasOfflineRef.current);
            wasOfflineRef.current = false;
            setTimeout(() => setIsReconnecting(false), 2000);
          }
        } else {
          throw new Error('Unreachable');
        }
      } catch {
        if (isOnline) {
          setIsOnline(false);
          wasOfflineRef.current = true;
        }
      }
    }
  }, [isOnline]);

  useEffect(() => {
    checkConnectivity();

    if (Platform.OS === 'web') {
      const handleOnline = () => {
        if (!isOnline) {
          setIsReconnecting(true);
          setIsOnline(true);
          setLastOnlineAt(Date.now());
          setWasOffline(wasOfflineRef.current);
          wasOfflineRef.current = false;
          setTimeout(() => setIsReconnecting(false), 2000);
        }
      };
      const handleOffline = () => {
        setIsOnline(false);
        wasOfflineRef.current = true;
      };

      window.addEventListener('online', handleOnline);
      window.addEventListener('offline', handleOffline);

      return () => {
        window.removeEventListener('online', handleOnline);
        window.removeEventListener('offline', handleOffline);
      };
    } else {
      // Native: poll every 15 seconds
      pingTimerRef.current = setInterval(checkConnectivity, 15000);
      return () => {
        if (pingTimerRef.current) {
          clearInterval(pingTimerRef.current);
          pingTimerRef.current = null;
        }
      };
    }
  }, [checkConnectivity, isOnline]);

  const resetWasOffline = useCallback(() => setWasOffline(false), []);

  return { isOnline, isReconnecting, lastOnlineAt, wasOffline, resetWasOffline };
}
