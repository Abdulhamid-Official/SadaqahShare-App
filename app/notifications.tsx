import React, { useEffect, useState, useCallback } from 'react';
import {
  View,
  Text,
  FlatList,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  RefreshControl,
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { useSafeBack } from '@/lib/navigation';
import {
  ArrowLeft,
  Bell,
  CheckCheck,
  Heart,
  Megaphone,
  BarChart3,
  Lightbulb,
  Users,
  Shield,
  Coins,
  CircleDot,
} from 'lucide-react-native';
import { supabase } from '@/lib/supabase';
import { useAppContext } from '@/lib/context';
import { useNotifications } from '@/lib/notifications-context';
import { Colors, Spacing, Radius, FontSize, useTheme } from '@/lib/theme';
import { useContentWidth } from '@/lib/responsive';

interface NotificationItem {
  id: string;
  donor_id: string;
  mosque_id: string | null;
  type: string;
  title: string;
  body: string | null;
  data: { pledge_id?: string; poll_id?: string; announcement_id?: string; request_id?: string; mosque_id?: string; tokens_earned?: number };
  read_at: string | null;
  created_at: string;
}

const NOTIF_ICONS: Record<string, { Icon: typeof Bell; color: string; bg: string }> = {
  donation_confirmed: { Icon: Heart, color: Colors.primary, bg: Colors.primaryFaint },
  announcement: { Icon: Megaphone, color: Colors.teal, bg: '#ccfbf1' },
  poll_created: { Icon: BarChart3, color: Colors.blue, bg: Colors.blueFaint },
  suggestion_updated: { Icon: Lightbulb, color: Colors.amber, bg: Colors.amberFaint },
  token_awarded: { Icon: Coins, color: Colors.amber, bg: Colors.amberFaint },
  member_joined: { Icon: Users, color: Colors.teal, bg: '#ccfbf1' },
  subscription: { Icon: Shield, color: Colors.stone600, bg: Colors.stone100 },
  security: { Icon: Shield, color: Colors.red, bg: Colors.redFaint },
  donation_received: { Icon: Heart, color: Colors.primary, bg: Colors.primaryFaint },
};

function getNotifIcon(type: string) {
  return NOTIF_ICONS[type] || { Icon: Bell, color: Colors.stone600, bg: Colors.stone100 };
}

function formatRelativeTime(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'Just now';
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}d ago`;
  return new Date(dateStr).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

export default function NotificationsScreen() {
  const { donor, isAdmin } = useAppContext();
  const { colors } = useTheme();
  const { paddingHorizontal, maxWidth } = useContentWidth();
  const goBack = useSafeBack('/(donor-tabs)');
  const { unreadCount, markAllRead, markRead, refreshUnread } = useNotifications();

  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const fetchNotifications = useCallback(async () => {
    if (!donor) return;
    if (isAdmin) {
      setNotifications([]);
      setLoading(false);
      return;
    }
    try {
      const { data, error } = await supabase
        .from('notifications')
        .select('*')
        .eq('donor_id', donor.id)
        .order('created_at', { ascending: false })
        .limit(50);

      if (error) {
        console.error('Fetch notifications error:', error);
        return;
      }
      setNotifications((data || []) as NotificationItem[]);
    } catch (err) {
      console.error('Fetch notifications error:', err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [donor, isAdmin]);

  useEffect(() => {
    fetchNotifications();
  }, [fetchNotifications]);

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    fetchNotifications();
    refreshUnread();
  }, [fetchNotifications, refreshUnread]);

  const handleMarkAllRead = useCallback(async () => {
    await markAllRead();
    setNotifications((prev) =>
      prev.map((n) => (n.read_at ? n : { ...n, read_at: new Date().toISOString() })),
    );
  }, [markAllRead]);

  const handlePressNotif = useCallback(
    (item: NotificationItem) => {
      if (!item.read_at) {
        markRead(item.id);
        setNotifications((prev) =>
          prev.map((n) => (n.id === item.id ? { ...n, read_at: new Date().toISOString() } : n)),
        );
      }

      if (item.data?.poll_id) {
        router.push(`/poll/${item.data.poll_id}` as any);
      } else if (item.data?.mosque_id) {
        router.push(`/mosque-detail/${item.data.mosque_id}` as any);
      }
    },
    [markRead],
  );

  const renderItem = ({ item }: { item: NotificationItem }) => {
    const { Icon, color, bg } = getNotifIcon(item.type);
    const isUnread = !item.read_at;

    return (
      <TouchableOpacity
        style={[
          styles.card,
          { backgroundColor: isUnread ? colors.cardBg : colors.stone50, borderColor: isUnread ? color : colors.cardBorder },
        ]}
        activeOpacity={0.7}
        onPress={() => handlePressNotif(item)}
        disabled={isAdmin}
      >
        <View style={[styles.iconCircle, { backgroundColor: bg }]}>
          <Icon size={20} color={color} />
        </View>
        <View style={styles.content}>
          <View style={styles.titleRow}>
            {isUnread && <CircleDot size={10} color={Colors.red} fill={Colors.red} />}
            <Text
              style={[styles.title, { color: colors.textPrimary }, isUnread && styles.titleUnread]}
              numberOfLines={2}
            >
              {item.title}
            </Text>
          </View>
          {item.body && (
            <Text style={[styles.body, { color: colors.textMuted }]} numberOfLines={3}>
              {item.body}
            </Text>
          )}
          <Text style={styles.time}>{formatRelativeTime(item.created_at)}</Text>
        </View>
      </TouchableOpacity>
    );
  };

  const renderEmpty = () => (
    <View style={styles.emptyContainer}>
      <Bell size={48} color={Colors.stone300} />
      <Text style={[styles.emptyTitle, { color: colors.textSecondary }]}>No Notifications</Text>
      <Text style={[styles.emptySubtitle, { color: colors.textMuted }]}>
        Updates from your mosques will appear here
      </Text>
    </View>
  );

  if (loading) {
    return (
      <SafeAreaView style={[styles.safe, { backgroundColor: colors.background }]} edges={['top']}>
        <View style={styles.centered}>
          <ActivityIndicator size="large" color={Colors.primary} />
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: colors.background }]} edges={['top']}>
      <View
        style={[
          styles.container,
          { paddingHorizontal, maxWidth, alignSelf: maxWidth ? 'center' : undefined, width: maxWidth ? '100%' : undefined },
        ]}
      >
        <View style={styles.headerRow}>
          <TouchableOpacity onPress={goBack} style={styles.backBtn} activeOpacity={0.7}>
            <ArrowLeft size={22} color={colors.stone600} />
          </TouchableOpacity>
          <Text style={[styles.screenTitle, { color: colors.textPrimary }]}>Notifications</Text>
          {unreadCount > 0 && !isAdmin && (
            <TouchableOpacity style={styles.markAllBtn} onPress={handleMarkAllRead} activeOpacity={0.7}>
              <CheckCheck size={18} color={Colors.primary} />
              <Text style={styles.markAllText}>Mark all read</Text>
            </TouchableOpacity>
          )}
        </View>

        <FlatList
          data={notifications}
          keyExtractor={(item) => item.id}
          renderItem={renderItem}
          ListEmptyComponent={renderEmpty}
          contentContainerStyle={styles.listContent}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={onRefresh}
              tintColor={Colors.primary}
              colors={[Colors.primary]}
            />
          }
        />
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: Colors.background },
  centered: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  container: { flex: 1, paddingTop: Spacing.xxl },
  headerRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm, marginBottom: Spacing.lg },
  backBtn: { width: 44, height: 44, justifyContent: 'center', alignItems: 'center', marginLeft: -Spacing.sm },
  screenTitle: { fontFamily: 'Inter-Bold', fontSize: FontSize.xxl, color: Colors.textPrimary, flex: 1 },
  markAllBtn: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: Spacing.sm, paddingVertical: Spacing.xs },
  markAllText: { fontFamily: 'Inter-SemiBold', fontSize: FontSize.xs, color: Colors.primary },
  listContent: { paddingBottom: Spacing.huge },
  card: {
    flexDirection: 'row',
    borderRadius: Radius.lg,
    padding: Spacing.lg,
    marginBottom: Spacing.md,
    borderWidth: 1.5,
    ...Platform.select({
      ios: { shadowColor: Colors.black, shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.04, shadowRadius: 8 },
      android: { elevation: 2 },
    }),
  },
  iconCircle: { width: 44, height: 44, borderRadius: 22, justifyContent: 'center', alignItems: 'center', marginRight: Spacing.md },
  content: { flex: 1 },
  titleRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 4 },
  title: { fontFamily: 'Inter-SemiBold', fontSize: FontSize.sm, flex: 1 },
  titleUnread: { fontFamily: 'Inter-Bold' },
  body: { fontFamily: 'Inter-Regular', fontSize: FontSize.xs, lineHeight: 18, marginBottom: 4 },
  time: { fontFamily: 'Inter-Regular', fontSize: FontSize.xs, color: Colors.stone400 },
  emptyContainer: { alignItems: 'center', paddingTop: Spacing.huge + 20, paddingHorizontal: Spacing.xxl },
  emptyTitle: { fontFamily: 'Inter-SemiBold', fontSize: FontSize.lg, marginTop: Spacing.lg },
  emptySubtitle: { fontFamily: 'Inter-Regular', fontSize: FontSize.sm, marginTop: Spacing.xs, textAlign: 'center', lineHeight: 20 },
});
