import React, { useEffect, useState, useCallback } from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  RefreshControl,
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import {
  ArrowLeft,
  Heart,
  Coins,
  Gift,
  BarChart3,
  Lightbulb,
  TrendingUp,
  Package,
  DollarSign,
  Award,
} from 'lucide-react-native';
import { supabase } from '@/lib/supabase';
import { useAppContext } from '@/lib/context';
import { Colors, Spacing, Radius, FontSize, useTheme } from '@/lib/theme';
import { useContentWidth } from '@/lib/responsive';
import { Pledge, Need } from '@/lib/types';

interface ImpactStats {
  totalPledges: number;
  itemsPledged: number;
  tokensEarned: number;
  tokensSpent: number;
  pollsVotedIn: number;
  suggestionsSubmitted: number;
  mosquesJoined: number;
  moneyPledged: number;
}

interface PledgeWithDetails extends Pledge {
  needs: Pick<Need, 'name' | 'type' | 'mosque_id'> & {
    mosques: { name: string } | null;
  };
}

export default function ImpactScreen() {
  const { donor, isAdmin } = useAppContext();
  const { colors } = useTheme();
  const { paddingHorizontal, maxWidth } = useContentWidth();

  const [stats, setStats] = useState<ImpactStats>({
    totalPledges: 0,
    itemsPledged: 0,
    tokensEarned: 0,
    tokensSpent: 0,
    pollsVotedIn: 0,
    suggestionsSubmitted: 0,
    mosquesJoined: 0,
    moneyPledged: 0,
  });
  const [recentPledges, setRecentPledges] = useState<PledgeWithDetails[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const fetchData = useCallback(async () => {
    if (!donor) return;

    if (isAdmin) {
      setStats({
        totalPledges: 12,
        itemsPledged: 25,
        tokensEarned: 320,
        tokensSpent: 45,
        pollsVotedIn: 3,
        suggestionsSubmitted: 2,
        mosquesJoined: 4,
        moneyPledged: 150,
      });
      setRecentPledges([]);
      setLoading(false);
      return;
    }

    try {
      const [pledgesRes, votesRes, suggestionsRes, membershipsRes, tokensRes] = await Promise.all([
        supabase
          .from('pledges')
          .select('quantity, tokens_earned, status, needs(type, amount_dollars)')
          .eq('donor_id', donor.id),
        supabase
          .from('votes')
          .select('poll_id, tokens_spent')
          .eq('donor_id', donor.id),
        supabase
          .from('donor_requests')
          .select('id')
          .eq('donor_id', donor.id),
        supabase
          .from('mosque_members')
          .select('id')
          .eq('donor_id', donor.id),
        supabase
          .from('donor_mosque_tokens')
          .select('token_balance')
          .eq('donor_id', donor.id),
      ]);

      const pledges = pledgesRes.data || [];
      const votes = votesRes.data || [];
      const suggestions = suggestionsRes.data || [];
      const memberships = membershipsRes.data || [];
      const tokens = tokensRes.data || [];

      const itemsPledged = pledges
        .filter((p: any) => p.needs?.type === 'item')
        .reduce((sum: number, p: any) => sum + (p.quantity || 0), 0);
      const moneyPledged = pledges
        .filter((p: any) => p.needs?.type === 'money')
        .reduce((sum: number, p: any) => sum + (p.quantity || 0) * (p.needs?.amount_dollars || 0), 0);
      const tokensEarned = pledges.reduce((sum: number, p: any) => sum + (p.tokens_earned || 0), 0);
      const tokensSpent = votes.reduce((sum: number, v: any) => sum + (v.tokens_spent || 0), 0);
      const uniquePolls = new Set(votes.map((v: any) => v.poll_id));

      setStats({
        totalPledges: pledges.length,
        itemsPledged,
        tokensEarned,
        tokensSpent,
        pollsVotedIn: uniquePolls.size,
        suggestionsSubmitted: suggestions.length,
        mosquesJoined: memberships.length,
        moneyPledged,
      });

      // Fetch recent pledges with details
      const { data: recentData } = await supabase
        .from('pledges')
        .select('*, needs(name, type, mosque_id, mosques(name))')
        .eq('donor_id', donor.id)
        .order('created_at', { ascending: false })
        .limit(10);

      if (recentData) setRecentPledges(recentData as PledgeWithDetails[]);
    } catch (err) {
      console.error('Impact fetch error:', err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [donor, isAdmin]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    fetchData();
  }, [fetchData]);

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  };

  const getStatusColor = (status: string) => {
    switch (status.toLowerCase()) {
      case 'fulfilled':
        return { bg: Colors.primaryFaint, text: Colors.primary };
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
          <TouchableOpacity onPress={() => router.back()} style={styles.backBtn} activeOpacity={0.7}>
            <ArrowLeft size={22} color={colors.stone600} />
          </TouchableOpacity>
          <Text style={[styles.screenTitle, { color: colors.textPrimary }]}>My Impact</Text>
        </View>

        <ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={styles.scrollContent}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={Colors.primary} colors={[Colors.primary]} />
          }
        >
          {/* Summary Hero */}
          <View style={styles.heroCard}>
            <View style={styles.heroIconCircle}>
              <TrendingUp size={28} color={Colors.white} />
            </View>
            <Text style={styles.heroLabel}>Total Donations</Text>
            <Text style={styles.heroValue}>{stats.totalPledges}</Text>
            <Text style={styles.heroSub}>
              {stats.itemsPledged} item{stats.itemsPledged !== 1 ? 's' : ''} pledged
              {stats.moneyPledged > 0 && ` · $${stats.moneyPledged} raised`}
            </Text>
          </View>

          {/* Token Summary */}
          <View style={styles.tokenRow}>
            <View style={[styles.tokenCard, { borderLeftColor: Colors.amber, backgroundColor: colors.cardBg }]}>
              <Coins size={22} color={Colors.amber} />
              <Text style={[styles.tokenValue, { color: colors.textPrimary }]}>{stats.tokensEarned}</Text>
              <Text style={[styles.tokenLabel, { color: colors.textMuted }]}>Tokens Earned</Text>
            </View>
            <View style={[styles.tokenCard, { borderLeftColor: Colors.blue, backgroundColor: colors.cardBg }]}>
              <BarChart3 size={22} color={Colors.blue} />
              <Text style={[styles.tokenValue, { color: colors.textPrimary }]}>{stats.tokensSpent}</Text>
              <Text style={[styles.tokenLabel, { color: colors.textMuted }]}>Tokens Spent</Text>
            </View>
          </View>

          {/* Stats Grid */}
          <View style={styles.statsGrid}>
            <View style={[styles.statTile, { backgroundColor: colors.cardBg, borderColor: colors.cardBorder }]}>
              <Gift size={20} color={Colors.primary} />
              <Text style={[styles.statNum, { color: colors.textPrimary }]}>{stats.itemsPledged}</Text>
              <Text style={[styles.statLabel, { color: colors.textMuted }]}>Items Pledged</Text>
            </View>
            <View style={[styles.statTile, { backgroundColor: colors.cardBg, borderColor: colors.cardBorder }]}>
              <BarChart3 size={20} color={Colors.blue} />
              <Text style={[styles.statNum, { color: colors.textPrimary }]}>{stats.pollsVotedIn}</Text>
              <Text style={[styles.statLabel, { color: colors.textMuted }]}>Polls Voted</Text>
            </View>
            <View style={[styles.statTile, { backgroundColor: colors.cardBg, borderColor: colors.cardBorder }]}>
              <Lightbulb size={20} color={Colors.amber} />
              <Text style={[styles.statNum, { color: colors.textPrimary }]}>{stats.suggestionsSubmitted}</Text>
              <Text style={[styles.statLabel, { color: colors.textMuted }]}>Suggestions</Text>
            </View>
            <View style={[styles.statTile, { backgroundColor: colors.cardBg, borderColor: colors.cardBorder }]}>
              <Heart size={20} color={Colors.teal} />
              <Text style={[styles.statNum, { color: colors.textPrimary }]}>{stats.mosquesJoined}</Text>
              <Text style={[styles.statLabel, { color: colors.textMuted }]}>Mosques Joined</Text>
            </View>
          </View>

          {/* Activity History */}
          <Text style={[styles.sectionTitle, { color: colors.textPrimary }]}>Recent Activity</Text>

          {recentPledges.length > 0 ? (
            recentPledges.map((pledge) => {
              const status = getStatusColor(pledge.status);
              const isMoney = pledge.needs?.type === 'money';
              return (
                <View
                  key={pledge.id}
                  style={[styles.activityCard, { backgroundColor: colors.cardBg, borderColor: colors.cardBorder }]}
                >
                  <View style={[styles.activityIcon, { backgroundColor: isMoney ? Colors.primaryFaint : Colors.amberFaint }]}>
                    {isMoney ? <DollarSign size={16} color={Colors.primary} /> : <Package size={16} color={Colors.amber} />}
                  </View>
                  <View style={styles.activityContent}>
                    <Text style={[styles.activityName, { color: colors.textPrimary }]} numberOfLines={1}>
                      {pledge.needs?.name || 'Donation'}
                    </Text>
                    <Text style={styles.activityMosque} numberOfLines={1}>
                      {pledge.needs?.mosques?.name || ''}
                    </Text>
                    <View style={styles.activityMeta}>
                      <Text style={styles.activityQty}>Qty: {pledge.quantity}</Text>
                      {pledge.tokens_earned > 0 && (
                        <View style={styles.tokenBadge}>
                          <Coins size={10} color={Colors.amber} />
                          <Text style={styles.tokenBadgeText}>+{pledge.tokens_earned}</Text>
                        </View>
                      )}
                    </View>
                  </View>
                  <View style={[styles.statusPill, { backgroundColor: status.bg }]}>
                    <Text style={[styles.statusText, { color: status.text }]}>{pledge.status}</Text>
                  </View>
                </View>
              );
            })
          ) : (
            <View style={[styles.emptyCard, { backgroundColor: colors.cardBg, borderColor: colors.cardBorder }]}>
              <Heart size={32} color={Colors.stone300} />
              <Text style={[styles.emptyTitle, { color: colors.textSecondary }]}>No Activity Yet</Text>
              <Text style={[styles.emptySubtitle, { color: colors.textMuted }]}>
                Start donating to see your impact here
              </Text>
              <TouchableOpacity
                style={styles.emptyBtn}
                activeOpacity={0.8}
                onPress={() => router.push('/(donor-tabs)/mosques')}
              >
                <Text style={styles.emptyBtnText}>Browse Mosques</Text>
              </TouchableOpacity>
            </View>
          )}

          <View style={{ height: Spacing.xxxl }} />
        </ScrollView>
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
  screenTitle: { fontFamily: 'Inter-Bold', fontSize: FontSize.xxl, flex: 1 },
  scrollContent: { paddingBottom: Spacing.huge },
  heroCard: {
    backgroundColor: Colors.primary,
    borderRadius: Radius.xl,
    padding: Spacing.xxl,
    alignItems: 'center',
    marginBottom: Spacing.lg,
    ...Platform.select({
      ios: { shadowColor: Colors.primary, shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.3, shadowRadius: 12 },
      android: { elevation: 4 },
    }),
  },
  heroIconCircle: {
    width: 56, height: 56, borderRadius: 28,
    backgroundColor: 'rgba(255,255,255,0.2)',
    justifyContent: 'center', alignItems: 'center', marginBottom: Spacing.md,
  },
  heroLabel: { fontFamily: 'Inter-Regular', fontSize: FontSize.sm, color: 'rgba(255,255,255,0.8)', marginBottom: 4 },
  heroValue: { fontFamily: 'Inter-Bold', fontSize: 40, color: Colors.white, marginBottom: 4 },
  heroSub: { fontFamily: 'Inter-Regular', fontSize: FontSize.sm, color: 'rgba(255,255,255,0.7)', textAlign: 'center' },
  tokenRow: { flexDirection: 'row', gap: Spacing.md, marginBottom: Spacing.lg },
  tokenCard: {
    flex: 1, borderRadius: Radius.lg, padding: Spacing.lg,
    borderLeftWidth: 3, gap: 4,
  },
  tokenValue: { fontFamily: 'Inter-Bold', fontSize: FontSize.xxl },
  tokenLabel: { fontFamily: 'Inter-Regular', fontSize: FontSize.xs },
  statsGrid: {
    flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.md, marginBottom: Spacing.xxl,
  },
  statTile: {
    flexBasis: '48%', borderRadius: Radius.md, padding: Spacing.lg,
    borderWidth: 1, alignItems: 'center', gap: 6,
  },
  statNum: { fontFamily: 'Inter-Bold', fontSize: FontSize.xxl },
  statLabel: { fontFamily: 'Inter-Regular', fontSize: FontSize.xs },
  sectionTitle: { fontFamily: 'Inter-Bold', fontSize: FontSize.lg, marginBottom: Spacing.md },
  activityCard: {
    flexDirection: 'row', alignItems: 'center', borderRadius: Radius.lg,
    padding: Spacing.md, marginBottom: Spacing.sm, borderWidth: 1,
  },
  activityIcon: { width: 36, height: 36, borderRadius: 18, justifyContent: 'center', alignItems: 'center', marginRight: Spacing.md },
  activityContent: { flex: 1 },
  activityName: { fontFamily: 'Inter-SemiBold', fontSize: FontSize.sm, marginBottom: 2 },
  activityMosque: { fontFamily: 'Inter-Regular', fontSize: FontSize.xs, color: Colors.stone400, marginBottom: 4 },
  activityMeta: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm },
  activityQty: { fontFamily: 'Inter-Regular', fontSize: FontSize.xs, color: Colors.stone500 },
  tokenBadge: { flexDirection: 'row', alignItems: 'center', gap: 3, backgroundColor: Colors.amberFaint, paddingHorizontal: 6, paddingVertical: 2, borderRadius: Radius.full },
  tokenBadgeText: { fontFamily: 'Inter-SemiBold', fontSize: 10, color: Colors.amber },
  statusPill: { paddingHorizontal: Spacing.sm, paddingVertical: 3, borderRadius: Radius.full },
  statusText: { fontFamily: 'Inter-SemiBold', fontSize: FontSize.xs, textTransform: 'capitalize' },
  emptyCard: { alignItems: 'center', padding: Spacing.xxxl, borderRadius: Radius.lg, borderWidth: 1 },
  emptyTitle: { fontFamily: 'Inter-SemiBold', fontSize: FontSize.md, marginTop: Spacing.md },
  emptySubtitle: { fontFamily: 'Inter-Regular', fontSize: FontSize.sm, textAlign: 'center', marginTop: Spacing.xs, lineHeight: 20 },
  emptyBtn: { backgroundColor: Colors.primary, borderRadius: Radius.md, paddingHorizontal: Spacing.xxl, paddingVertical: Spacing.md, marginTop: Spacing.lg },
  emptyBtnText: { fontFamily: 'Inter-SemiBold', fontSize: FontSize.sm, color: Colors.white },
});
