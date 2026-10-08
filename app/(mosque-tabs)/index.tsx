import React, { useEffect, useState, useCallback } from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  RefreshControl,
  ActivityIndicator,
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import {
  Package,
  Heart,
  Coins,
  Clock,
  BarChart3,
  ChevronRight,
  MapPin,
  Megaphone,
} from 'lucide-react-native';
import { supabase } from '@/lib/supabase';
import { useAppContext } from '@/lib/context';
import { Colors, Spacing, Radius, FontSize, useTheme } from '@/lib/theme';
import { useContentWidth } from '@/lib/responsive';
import { Pledge, Need } from '@/lib/types';

interface PledgeWithNeed extends Pledge {
  needs: Pick<Need, 'name' | 'type'>;
}

export default function DashboardScreen() {
  const { mosqueAccount, mosqueName, mosqueCity, mosqueState, isAdmin } = useAppContext();
  const { paddingHorizontal, maxWidth } = useContentWidth();
  const { colors } = useTheme();

  const [needsCount, setNeedsCount] = useState(0);
  const [itemsPledged, setItemsPledged] = useState(0);
  const [tokensDistributed, setTokensDistributed] = useState(0);
  const [recentPledges, setRecentPledges] = useState<PledgeWithNeed[]>([]);
  const [activePollsCount, setActivePollsCount] = useState(0);
  const [announcementsCount, setAnnouncementsCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const mosqueId = mosqueAccount?.mosque_id;

  const fetchData = useCallback(async () => {
    if (!mosqueId) return;

    if (isAdmin) {
      setNeedsCount(3);
      setItemsPledged(12);
      setTokensDistributed(150);
      setActivePollsCount(1);
      setAnnouncementsCount(2);
      setRecentPledges([]);
      setLoading(false);
      setRefreshing(false);
      return;
    }

    try {
      const [needsRes, pledgesRes, pollsRes, annRes] = await Promise.all([
        supabase
          .from('needs')
          .select('id, quantity_pledged')
          .eq('mosque_id', mosqueId),
        supabase
          .from('pledges')
          .select('*, needs!inner(name, type, mosque_id)')
          .eq('needs.mosque_id', mosqueId)
          .order('created_at', { ascending: false }),
        supabase
          .from('polls')
          .select('id, status')
          .eq('mosque_id', mosqueId)
          .eq('status', 'active'),
        supabase
          .from('announcements')
          .select('id')
          .eq('mosque_id', mosqueId)
          .eq('archived', false),
      ]);

      if (needsRes.data) {
        setNeedsCount(needsRes.data.length);
        const totalPledged = needsRes.data.reduce(
          (sum, n) => sum + (n.quantity_pledged || 0),
          0
        );
        setItemsPledged(totalPledged);
      }

      if (pledgesRes.data) {
        const allPledges = pledgesRes.data as PledgeWithNeed[];
        setRecentPledges(allPledges.slice(0, 5));
        const totalTokens = allPledges.reduce(
          (sum, p) => sum + (p.tokens_earned || 0),
          0
        );
        setTokensDistributed(totalTokens);
      }

      if (pollsRes.data) {
        setActivePollsCount(pollsRes.data.length);
      }

      if (annRes.data) {
        setAnnouncementsCount(annRes.data.length);
      }
    } catch (err) {
      console.error('Dashboard fetch error:', err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [mosqueId, isAdmin]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    fetchData();
  }, [fetchData]);

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr);
    return date.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
    });
  };

  const getStatusStyle = (status: string) => {
    switch (status.toLowerCase()) {
      case 'fulfilled':
        return { bg: '#d1fae5', text: '#059669' };
      case 'cancelled':
        return { bg: Colors.redFaint, text: Colors.red };
      default:
        return { bg: Colors.blueFaint, text: Colors.blue };
    }
  };

  if (loading) {
    return (
      <SafeAreaView style={[styles.safe, { backgroundColor: colors.background }]} edges={['top']}>
        <View style={styles.centered}>
          <ActivityIndicator size="large" color={Colors.teal} />
          <Text style={[styles.loadingText, { color: colors.textMuted }]}>Loading dashboard…</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: colors.background }]} edges={['top']}>
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={[
          styles.scrollContent,
          { paddingHorizontal, maxWidth, alignSelf: maxWidth ? 'center' : undefined, width: maxWidth ? '100%' : undefined },
        ]}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor={Colors.teal}
            colors={[Colors.teal]}
          />
        }
      >
        {/* Header */}
        <View style={styles.header}>
          <Text style={[styles.headerTitle, { color: colors.textPrimary }]} numberOfLines={2}>
            {mosqueName || 'My Mosque'}
          </Text>
          {(mosqueCity || mosqueState) && (
            <View style={styles.locationRow}>
              <MapPin size={14} color={colors.textMuted} />
              <Text style={[styles.locationText, { color: colors.textMuted }]}>
                {[mosqueCity, mosqueState].filter(Boolean).join(', ')}
              </Text>
            </View>
          )}
        </View>

        {/* Stat Cards */}
        <View style={styles.statsRow}>
          <View style={[styles.statCard, styles.statCardTeal, { backgroundColor: colors.cardBg, borderColor: colors.cardBorder }]}>
            <View style={styles.statIconWrap}>
              <Package size={20} color={Colors.teal} />
            </View>
            <Text style={[styles.statNumber, { color: colors.textPrimary }]}>{needsCount}</Text>
            <Text style={[styles.statLabel, { color: colors.textMuted }]}>Total Listings</Text>
          </View>

          <View style={[styles.statCard, styles.statCardEmerald, { backgroundColor: colors.cardBg, borderColor: colors.cardBorder }]}>
            <View style={styles.statIconWrap}>
              <Heart size={20} color={Colors.primary} />
            </View>
            <Text style={[styles.statNumber, { color: colors.textPrimary }]}>{itemsPledged}</Text>
            <Text style={[styles.statLabel, { color: colors.textMuted }]}>Items Pledged</Text>
          </View>

          <View style={[styles.statCard, styles.statCardAmber, { backgroundColor: colors.cardBg, borderColor: colors.cardBorder }]}>
            <View style={styles.statIconWrap}>
              <Coins size={20} color={Colors.amber} />
            </View>
            <Text style={[styles.statNumber, { color: colors.textPrimary }]}>{tokensDistributed}</Text>
            <Text style={[styles.statLabel, { color: colors.textMuted }]}>Tokens Given</Text>
          </View>
        </View>

        {/* Recent Pledges */}
        <View style={styles.section}>
          <Text style={[styles.sectionTitle, { color: colors.textPrimary }]}>Recent Pledges</Text>
          {recentPledges.length === 0 ? (
            <View style={[styles.emptyCard, { backgroundColor: colors.cardBg, borderColor: colors.cardBorder }]}>
              <Heart size={32} color={Colors.stone300} />
              <Text style={[styles.emptyTitle, { color: colors.textSecondary }]}>No pledges yet</Text>
              <Text style={[styles.emptySubtitle, { color: colors.textMuted }]}>
                Pledges from donors will appear here
              </Text>
            </View>
          ) : (
            recentPledges.map((pledge) => {
              const status = getStatusStyle(pledge.status);
              return (
                <View key={pledge.id} style={[styles.pledgeCard, { backgroundColor: colors.cardBg, borderColor: colors.cardBorder }]}>
                  <View style={styles.pledgeTop}>
                    <View style={styles.pledgeInfo}>
                      <Text style={[styles.pledgeDonor, { color: colors.textPrimary }]} numberOfLines={1}>
                        {pledge.donor_name}
                      </Text>
                      <Text style={[styles.pledgeNeed, { color: colors.textMuted }]} numberOfLines={1}>
                        {pledge.needs?.name || 'Unknown need'}
                      </Text>
                    </View>
                    <View style={[styles.statusBadge, { backgroundColor: status.bg }]}>
                      <Text style={[styles.statusText, { color: status.text }]}>
                        {pledge.status}
                      </Text>
                    </View>
                  </View>
                  <View style={styles.pledgeBottom}>
                    <Text style={[styles.pledgeQty, { color: colors.textSecondary }]}>
                      Qty: {pledge.quantity}
                    </Text>
                    <View style={styles.pledgeMeta}>
                      <Coins size={12} color={Colors.amber} />
                      <Text style={styles.pledgeTokens}>
                        {pledge.tokens_earned}
                      </Text>
                      <Clock size={12} color={Colors.stone400} />
                      <Text style={styles.pledgeDate}>
                        {formatDate(pledge.created_at)}
                      </Text>
                    </View>
                  </View>
                </View>
              );
            })
          )}
        </View>

        {/* Active Polls */}
        <View style={styles.section}>
          <Text style={[styles.sectionTitle, { color: colors.textPrimary }]}>Polls</Text>
          <TouchableOpacity
            style={[styles.pollsSummaryCard, { backgroundColor: colors.cardBg, borderColor: colors.cardBorder }]}
            activeOpacity={0.7}
            onPress={() => router.push('/(mosque-tabs)/polls' as any)}
          >
            <View style={styles.pollsSummaryLeft}>
              <BarChart3 size={24} color={Colors.teal} />
              <View style={styles.pollsSummaryInfo}>
                <Text style={[styles.pollsSummaryCount, { color: colors.textPrimary }]}>
                  {activePollsCount} Active Poll{activePollsCount !== 1 ? 's' : ''}
                </Text>
                <Text style={[styles.pollsSummaryHint, { color: colors.textMuted }]}>
                  Manage community polls
                </Text>
              </View>
            </View>
            <ChevronRight size={20} color={colors.stone400} />
          </TouchableOpacity>
        </View>

        {/* Announcements */}
        <View style={styles.section}>
          <Text style={[styles.sectionTitle, { color: colors.textPrimary }]}>Announcements</Text>
          <TouchableOpacity
            style={[styles.pollsSummaryCard, { backgroundColor: colors.cardBg, borderColor: colors.cardBorder }]}
            activeOpacity={0.7}
            onPress={() => router.push('/(mosque-tabs)/announcements' as any)}
          >
            <View style={styles.pollsSummaryLeft}>
              <Megaphone size={24} color={Colors.teal} />
              <View style={styles.pollsSummaryInfo}>
                <Text style={[styles.pollsSummaryCount, { color: colors.textPrimary }]}>
                  {announcementsCount} Announcement{announcementsCount !== 1 ? 's' : ''}
                </Text>
                <Text style={[styles.pollsSummaryHint, { color: colors.textMuted }]}>
                  Post updates for your community
                </Text>
              </View>
            </View>
            <ChevronRight size={20} color={colors.stone400} />
          </TouchableOpacity>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  centered: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    gap: Spacing.md,
  },
  loadingText: {
    fontFamily: 'Inter-Regular',
    fontSize: FontSize.md,
    color: Colors.textMuted,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingTop: Spacing.xxl,
    paddingBottom: Spacing.huge + 20,
  },

  /* Header */
  header: {
    marginBottom: Spacing.xxl,
  },
  headerTitle: {
    fontFamily: 'Inter-Bold',
    fontSize: FontSize.xxxl,
    color: Colors.textPrimary,
    lineHeight: 38,
  },
  locationRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: Spacing.xs,
  },
  locationText: {
    fontFamily: 'Inter-Regular',
    fontSize: FontSize.md,
    color: Colors.textMuted,
  },

  /* Stat Cards */
  statsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.md,
    marginBottom: Spacing.xxxl,
  },
  statCard: {
    flex: 1,
    minWidth: 100,
    backgroundColor: Colors.cardBg,
    borderRadius: Radius.lg,
    padding: Spacing.lg,
    borderWidth: 1,
    borderColor: Colors.cardBorder,
    borderTopWidth: 3,
    ...Platform.select({
      ios: {
        shadowColor: Colors.black,
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.05,
        shadowRadius: 8,
      },
      android: { elevation: 2 },
    }),
  },
  statCardTeal: {
    borderTopColor: Colors.teal,
  },
  statCardEmerald: {
    borderTopColor: Colors.primary,
  },
  statCardAmber: {
    borderTopColor: Colors.amber,
  },
  statIconWrap: {
    marginBottom: Spacing.sm,
  },
  statNumber: {
    fontFamily: 'Inter-Bold',
    fontSize: FontSize.xxl,
    color: Colors.textPrimary,
  },
  statLabel: {
    fontFamily: 'Inter-Regular',
    fontSize: FontSize.xs,
    color: Colors.textMuted,
    marginTop: 2,
  },

  /* Section */
  section: {
    marginBottom: Spacing.xxl,
  },
  sectionTitle: {
    fontFamily: 'Inter-SemiBold',
    fontSize: FontSize.lg,
    color: Colors.textPrimary,
    marginBottom: Spacing.md,
  },

  /* Pledge Cards */
  pledgeCard: {
    backgroundColor: Colors.cardBg,
    borderRadius: Radius.md,
    padding: Spacing.lg,
    marginBottom: Spacing.sm,
    borderWidth: 1,
    borderColor: Colors.cardBorder,
  },
  pledgeTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: Spacing.sm,
  },
  pledgeInfo: {
    flex: 1,
    marginRight: Spacing.sm,
  },
  pledgeDonor: {
    fontFamily: 'Inter-SemiBold',
    fontSize: FontSize.md,
    color: Colors.textPrimary,
  },
  pledgeNeed: {
    fontFamily: 'Inter-Regular',
    fontSize: FontSize.sm,
    color: Colors.textMuted,
    marginTop: 2,
  },
  statusBadge: {
    paddingHorizontal: Spacing.sm,
    paddingVertical: 3,
    borderRadius: Radius.full,
  },
  statusText: {
    fontFamily: 'Inter-SemiBold',
    fontSize: FontSize.xs,
    textTransform: 'capitalize',
  },
  pledgeBottom: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  pledgeQty: {
    fontFamily: 'Inter-Regular',
    fontSize: FontSize.sm,
    color: Colors.textSecondary,
  },
  pledgeMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  pledgeTokens: {
    fontFamily: 'Inter-SemiBold',
    fontSize: FontSize.xs,
    color: Colors.amber,
    marginRight: Spacing.sm,
  },
  pledgeDate: {
    fontFamily: 'Inter-Regular',
    fontSize: FontSize.xs,
    color: Colors.stone400,
  },

  /* Empty */
  emptyCard: {
    backgroundColor: Colors.cardBg,
    borderRadius: Radius.lg,
    padding: Spacing.xxxl,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: Colors.cardBorder,
    borderStyle: 'dashed',
  },
  emptyTitle: {
    fontFamily: 'Inter-SemiBold',
    fontSize: FontSize.md,
    color: Colors.textSecondary,
    marginTop: Spacing.md,
  },
  emptySubtitle: {
    fontFamily: 'Inter-Regular',
    fontSize: FontSize.sm,
    color: Colors.textMuted,
    marginTop: Spacing.xs,
    textAlign: 'center',
  },

  /* Polls Summary */
  pollsSummaryCard: {
    backgroundColor: Colors.cardBg,
    borderRadius: Radius.lg,
    padding: Spacing.lg,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderWidth: 1,
    borderColor: Colors.cardBorder,
    minHeight: 56,
  },
  pollsSummaryLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
    flex: 1,
  },
  pollsSummaryInfo: {
    flex: 1,
  },
  pollsSummaryCount: {
    fontFamily: 'Inter-SemiBold',
    fontSize: FontSize.md,
    color: Colors.textPrimary,
  },
  pollsSummaryHint: {
    fontFamily: 'Inter-Regular',
    fontSize: FontSize.sm,
    color: Colors.textMuted,
    marginTop: 2,
  },
});
