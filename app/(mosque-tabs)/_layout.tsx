import React, { useEffect, useState, useCallback } from 'react';
import { Tabs } from 'expo-router';
import { StyleSheet, Platform, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  LayoutDashboard,
  Package,
  Heart,
  Users,
  MessageSquare,
  Settings,
  Megaphone,
} from 'lucide-react-native';
import { Colors, Spacing, useTheme } from '@/lib/theme';
import { supabase } from '@/lib/supabase';
import { useAppContext } from '@/lib/context';

const TAB_ITEMS = [
  { name: 'index', label: 'Dashboard', Icon: LayoutDashboard },
  { name: 'needs', label: 'Needs', Icon: Package },
  { name: 'pledges', label: 'Pledges', Icon: Heart },
  { name: 'members', label: 'Members', Icon: Users },
  { name: 'requests', label: 'Requests', Icon: MessageSquare },
  { name: 'settings', label: 'More', Icon: Settings },
] as const;

function UnreadDot() {
  return <View style={styles.unreadDot} />;
}

export default function MosqueTabsLayout() {
  const insets = useSafeAreaInsets();
  const { colors } = useTheme();
  const { mosqueAccount, isAdmin } = useAppContext();
  const [unreadCount, setUnreadCount] = useState(0);

  const mosqueId = mosqueAccount?.mosque_id;

  const fetchUnread = useCallback(async () => {
    if (!mosqueId || isAdmin) { setUnreadCount(0); return; }
    try {
      const { count, error } = await supabase
        .from('donor_requests')
        .select('id', { count: 'exact', head: true })
        .eq('mosque_id', mosqueId)
        .eq('archived', false)
        .is('read_at', null);
      if (!error && count !== null) {
        setUnreadCount(count);
      }
    } catch (err) {
      // Silent fail — dot is a nice-to-have
    }
  }, [mosqueId, isAdmin]);

  useEffect(() => {
    fetchUnread();
    const interval = setInterval(fetchUnread, 15000);
    return () => clearInterval(interval);
  }, [fetchUnread]);

  // Realtime subscription for immediate updates
  useEffect(() => {
    if (!mosqueId || isAdmin) return;
    const channel = supabase
      .channel('mosque-unread-requests')
      .on('postgres_changes',
        { event: '*', schema: 'public', table: 'donor_requests', filter: `mosque_id=eq.${mosqueId}` },
        () => { fetchUnread(); }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [mosqueId, isAdmin, fetchUnread]);

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: colors.teal,
        tabBarInactiveTintColor: colors.stone400,
        tabBarStyle: {
          backgroundColor: colors.tabBarBg,
          borderTopWidth: StyleSheet.hairlineWidth,
          borderTopColor: colors.tabBarBorder,
          height: 56 + insets.bottom,
          paddingBottom: insets.bottom,
          paddingTop: Spacing.xs,
          ...Platform.select({
            ios: {
              shadowColor: Colors.black,
              shadowOffset: { width: 0, height: -2 },
              shadowOpacity: 0.05,
              shadowRadius: 8,
            },
            android: {
              elevation: 8,
            },
          }),
        },
        tabBarLabelStyle: {
          fontFamily: 'Inter-SemiBold',
          fontSize: 10,
          marginTop: 1,
        },
        tabBarIconStyle: {
          marginBottom: -2,
        },
      }}
    >
      {TAB_ITEMS.map(({ name, label, Icon }) => (
        <Tabs.Screen
          key={name}
          name={name}
          options={{
            title: label,
            tabBarIcon: ({ color, focused }) => (
              <View style={styles.iconWrap}>
                <Icon
                  size={20}
                  color={color}
                  strokeWidth={focused ? 2.5 : 2}
                />
                {name === 'requests' && unreadCount > 0 && <UnreadDot />}
              </View>
            ),
          }}
        />
      ))}
      <Tabs.Screen name="polls" options={{ href: null, headerShown: false }} />
      <Tabs.Screen name="announcements" options={{ href: null, headerShown: false }} />
      <Tabs.Screen name="join-code" options={{ href: null, headerShown: false }} />
    </Tabs>
  );
}

const styles = StyleSheet.create({
  iconWrap: {
    position: 'relative',
    alignItems: 'center',
    justifyContent: 'center',
  },
  unreadDot: {
    position: 'absolute',
    top: -2,
    right: -8,
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: Colors.red,
    borderWidth: 1.5,
    borderColor: Colors.white,
  },
});
