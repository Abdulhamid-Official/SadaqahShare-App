import { useEffect, useRef } from 'react';
import { supabase } from '@/lib/supabase';

/**
 * Subscribes to real-time changes on a Supabase table and calls `onUpdate`
 * whenever a row is inserted, updated, or deleted. The caller is responsible
 * for refetching data — this hook just signals that something changed.
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

  useEffect(() => {
    if (!enabled) return;

    const channelName = `${table}:changes:${filter ?? 'all'}`;
    let channel = supabase
      .channel(channelName)
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table,
        ...(filter ? { filter } : {}),
      }, () => {
        callbackRef.current();
      })
      .subscribe((status, err) => {
        if (status === 'CHANNEL_ERROR' && err) {
          console.error(`Realtime subscription error on ${table}:`, err);
        }
      });

    return () => {
      supabase.removeChannel(channel);
    };
  }, [table, filter, enabled]);
}
