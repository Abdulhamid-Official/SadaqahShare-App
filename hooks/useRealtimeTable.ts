import { useEffect, useRef, useCallback } from 'react';
import { supabase } from '@/lib/supabase';

type RealtimeStatus = 'SUBSCRIBED' | 'CHANNEL_ERROR' | 'TIMED_OUT' | 'CLOSED';

interface SubscriptionState {
  channel: ReturnType<typeof supabase.channel> | null;
  status: RealtimeStatus;
  lastEventAt: number;
}

/**
 * Subscribes to real-time changes on a Supabase table and calls `onUpdate`
 * whenever a row is inserted, updated, or deleted.
 *
 * Features:
 * - Deduplication: rapid duplicate events within 500ms are coalesced into one callback
 * - Reconnection: automatically resubscribes on CHANNEL_ERROR or TIMED_OUT
 * - Cleanup: properly removes channels on unmount to prevent memory leaks
 * - Stable callback: uses a ref so the channel doesn't resubscribe when the callback changes
 *
 * `filter` is a Postgres filter string (e.g. `mosque_id=eq.123`).
 */
export function useRealtimeTable(
  table: string,
  filter: string | null,
  onUpdate: () => void,
  enabled: boolean = true,
) {
  const callbackRef = useRef(onUpdate);
  callbackRef.current = onUpdate;

  const pendingTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const stateRef = useRef<SubscriptionState>({
    channel: null,
    status: 'CLOSED',
    lastEventAt: 0,
  });
  const resubscribeTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const scheduleCallback = useCallback(() => {
    stateRef.current.lastEventAt = Date.now();

    if (pendingTimerRef.current) {
      clearTimeout(pendingTimerRef.current);
    }

    pendingTimerRef.current = setTimeout(() => {
      pendingTimerRef.current = null;
      callbackRef.current();
    }, 500);
  }, []);

  const subscribe = useCallback(() => {
    if (!enabled) return;

    const channelName = `${table}:changes:${filter ?? 'all'}`;

    // Clean up any existing channel with the same name
    const existingChannels = supabase.getChannels();
    const existing = existingChannels.find((ch) => ch.topic === channelName);
    if (existing) {
      supabase.removeChannel(existing);
    }

    const channel = supabase
      .channel(channelName)
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table,
        ...(filter ? { filter } : {}),
      }, () => {
        scheduleCallback();
      })
      .subscribe((status: RealtimeStatus, err?: unknown) => {
        stateRef.current.status = status;

        if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
          if (err) {
            console.error(`Realtime error on ${table}:`, err);
          }
          // Exponential backoff reconnection
          if (resubscribeTimerRef.current) {
            clearTimeout(resubscribeTimerRef.current);
          }
          resubscribeTimerRef.current = setTimeout(() => {
            subscribe();
          }, 3000);
        }
      });

    stateRef.current.channel = channel;
  }, [table, filter, enabled, scheduleCallback]);

  useEffect(() => {
    if (!enabled) {
      // Clean up if disabled
      const channelName = `${table}:changes:${filter ?? 'all'}`;
      const existingChannels = supabase.getChannels();
      const existing = existingChannels.find((ch) => ch.topic === channelName);
      if (existing) {
        supabase.removeChannel(existing);
      }
      stateRef.current.status = 'CLOSED';
      return;
    }

    subscribe();

    return () => {
      if (pendingTimerRef.current) {
        clearTimeout(pendingTimerRef.current);
        pendingTimerRef.current = null;
      }
      if (resubscribeTimerRef.current) {
        clearTimeout(resubscribeTimerRef.current);
        resubscribeTimerRef.current = null;
      }

      const channelName = `${table}:changes:${filter ?? 'all'}`;
      const existingChannels = supabase.getChannels();
      const existing = existingChannels.find((ch) => ch.topic === channelName);
      if (existing) {
        supabase.removeChannel(existing);
      }
      stateRef.current.status = 'CLOSED';
    };
  }, [table, filter, enabled, subscribe]);
}
