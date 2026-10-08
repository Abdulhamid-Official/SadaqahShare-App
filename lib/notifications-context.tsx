import React, { createContext, useContext, useState, useCallback, useEffect, useRef } from 'react';
import { supabase } from '@/lib/supabase';
import { useAppContext } from '@/lib/context';
import { useRealtimeTable } from '@/hooks/useRealtimeTable';

interface NotificationContextType {
  unreadCount: number;
  refreshUnread: () => Promise<void>;
  markAllRead: () => Promise<void>;
  markRead: (notificationId: string) => Promise<void>;
}

const NotificationContext = createContext<NotificationContextType | undefined>(undefined);

export function NotificationProvider({ children }: { children: React.ReactNode }) {
  const { donor, isAdmin } = useAppContext();
  const [unreadCount, setUnreadCount] = useState(0);
  const donorIdRef = useRef<string | null>(null);

  const refreshUnread = useCallback(async () => {
    if (isAdmin || !donor) {
      setUnreadCount(0);
      return;
    }

    try {
      const { count, error } = await supabase
        .from('notifications')
        .select('*', { count: 'exact', head: true })
        .eq('donor_id', donor.id)
        .is('read_at', null);

      if (error) {
        console.error('Unread count error:', error);
        return;
      }
      setUnreadCount(count || 0);
    } catch (err) {
      console.error('Unread count error:', err);
    }
  }, [donor, isAdmin]);

  const markAllRead = useCallback(async () => {
    if (!donor) return;
    try {
      const { error } = await supabase
        .from('notifications')
        .update({ read_at: new Date().toISOString() })
        .eq('donor_id', donor.id)
        .is('read_at', null);

      if (!error) {
        setUnreadCount(0);
      }
    } catch (err) {
      console.error('markAllRead error:', err);
    }
  }, [donor]);

  const markRead = useCallback(async (notificationId: string) => {
    try {
      const { error } = await supabase
        .from('notifications')
        .update({ read_at: new Date().toISOString() })
        .eq('id', notificationId);

      if (!error) {
        setUnreadCount((prev) => Math.max(0, prev - 1));
      }
    } catch (err) {
      console.error('markRead error:', err);
    }
  }, []);

  useEffect(() => {
    if (donor?.id !== donorIdRef.current) {
      donorIdRef.current = donor?.id ?? null;
      refreshUnread();
    }
  }, [donor, refreshUnread]);

  // Realtime: listen for new notifications
  useRealtimeTable(
    'notifications',
    donor ? `donor_id=eq.${donor.id}` : null,
    refreshUnread,
    !!donor && !isAdmin,
  );

  return (
    <NotificationContext.Provider
      value={{ unreadCount, refreshUnread, markAllRead, markRead }}
    >
      {children}
    </NotificationContext.Provider>
  );
}

export function useNotifications() {
  const ctx = useContext(NotificationContext);
  if (!ctx) throw new Error('useNotifications must be used within NotificationProvider');
  return ctx;
}
