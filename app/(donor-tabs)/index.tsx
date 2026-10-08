import React, { useEffect, useState, useCallback } from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  RefreshControl,
  Image,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import {
  Coins,
  Heart,
  Gift,
  Award,
  Clock,
  ChevronRight,
  Star,
  BarChart3,
  Megaphone,
} from 'lucide-react-native';
import { supabase } from '@/lib/supabase';
import { useAppContext } from '@/lib/context';
import { Colors, Spacing, Radius, FontSize, useTheme } from '@/lib/theme';
import { useRealtimeTable } from '@/hooks/useRealtimeTable';
import { DonorMosqueToken, Mosque, Pledge, Poll, PollOption, Vote, Need } from '@/lib/types';

interface TokenWithMosque extends DonorMosqueToken {
  mosques: Pick<Mosque, 'name'>;
}

interface PollWithDetails extends Poll {
  mosques: Pick<Mosque, 'name'>;
  poll_options: (PollOption & { votes: Pick<Vote, 'tokens_spent'>[] })[];
}

interface PledgeWithDetails extends Pledge {
  needs: Pick<Need, 'name' | 'type' | 'mosque_id'> & {
    mosques: Pick<Mosque, 'name'>;
  };
}

interface Stats {
  itemsPledged: number;
  tokensEarned: number;
  totalPledges: number;
}

export default function DonorHomeScreen() {
  const { donor, isAdmin } = useAppContext();
  const { colors } = useTheme();

  const [tokens, setTokens] = useState<TokenWithMosque[]>([]);
  const [stats, setStats] = useState<Stats>({ itemsPledged: 0, tokensEarned: 0, totalPledges: 0 });
  const [polls, setPolls] = useState<PollWithDetails[]>([]);
  const [recentDonations, setRecentDonations] = useState<PledgeWithDetails[]>([]);
  const [unreadAnnouncements, setUnreadAnnouncements] = useState(0);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const fetchData = useCallback(async () => {
    if (!donor) return;

    if (isAdmin) {
      setTokens([]);
      setStats({ itemsPledged: 5, tokensEarned: 100, totalPledges: 3 });
      setPolls([]);
      setRecentDonations([]);
      setLoading(false);
      setRefreshing(false);
      return;
    }

    try {
      // Get joined mosque IDs
      const { data: memberships } = await supabase
        .from('mosque_members')
        .select('mosque_id')
        .eq('donor_id', donor.id);
      const joinedMosqueIds = (memberships || []).map((m) => m.mosque_id);

      // Fetch token balances (already scoped to donor)
      const { data: tokenData } = await supabase
        .from('donor_mosque_tokens')
        .select('*, mosques(name)')
        .eq('donor_id', donor.id);

      if (tokenData) setTokens(tokenData as TokenWithMosque[]);

      // Fetch pledge stats
      const { data: pledgeData } = await supabase
        .from('pledges')
        .select('quantity, tokens_earned')
        .eq('donor_id', donor.id);

      if (pledgeData) {
        setStats({
          itemsPledged: pledgeData.reduce((sum, p) => sum + (p.quantity || 0), 0),
          tokensEarned: pledgeData.reduce((sum, p) => sum + (p.tokens_earned || 0), 0),
          totalPledges: pledgeData.length,
        });
      }

      // Fetch unread announcements count from joined mosques
      if (joinedMosqueIds.length > 0) {
        const { data: annData } = await supabase
          .from('announcements')
          .select('id')
          .in('mosque_id', joinedMosqueIds)
          .eq('archived', false);
        const annIds = (annData || []).map((a) => a.id);

        if (annIds.length > 0) {
          const { data: readData } = await supabase
            .from('announcement_reads')
            .select('announcement_id')
            .eq('donor_id', donor.id)
            .in('announcement_id', annIds);
          const readIds = new Set((readData || []).map((r) => r.announcement_id));
          setUnreadAnnouncements(annIds.filter((id) => !readIds.has(id)).length);
        } else {
          setUnreadAnnouncements(0);
        }
      } else {
        setUnreadAnnouncements(0);
      }

      // Fetch active polls (only from joined mosques)
      const now = new Date().toISOString();
      let pollData: any[] | null = null;
      if (joinedMosqueIds.length > 0) {
        const { data } = await supabase
          .from('polls')
          .select(`
            *,
            mosques(name),
            poll_options(
              *,
              votes(tokens_spent)
            )
          `)
          .eq('status', 'active')
          .in('mosque_id', joinedMosqueIds)
          .or(`closes_at.is.null,closes_at.gt.${now}`)
          .order('created_at', { ascending: false })
          .limit(5);
        pollData = (data ?? []).filter((p: any) => !p.archived);
      }

      if (pollData) setPolls(pollData as PollWithDetails[]);

      // Fetch recent donations
      const { data: donationData } = await supabase
        .from('pledges')
        .select(`
          *,
          needs(name, type, mosque_id, mosques(name))
        `)
        .eq('donor_id', donor.id)
        .order('created_at', { ascending: false })
        .limit(5);

      if (donationData) setRecentDonations(donationData as PledgeWithDetails[]);
    } catch (err) {
      console.error('Error fetching donor home data:', err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [donor, isAdmin]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  useRealtimeTable("pledges", donor ? "donor_id=eq." + donor.id : null, fetchData, !!donor && !isAdmin);
  useRealtimeTable("polls", null, fetchData, !!donor && !isAdmin);
  useRealtimeTable("needs", null, fetchData, !!donor && !isAdmin);
  useRealtimeTable("donor_mosque_tokens", donor ? "donor_id=eq." + donor.id : null, fetchData, !!donor && !isAdmin);
  useRealtimeTable("announcements", null, fetchData, !!donor && !isAdmin);

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    fetchData();
  }, [fetchData]);

  const getTimeRemaining = (closesAt: string | null) => {
    if (!closesAt) return 'Open ended';
    const diff = new Date(closesAt).getTime() - Date.now();
    if (diff <= 0) return 'Ended';
    const hours = Math.floor(diff / (1000 * 60 * 60));
    const days = Math.floor(hours / 24);
    if (days > 0) return `${days}d ${hours % 24}h left`;
    if (hours > 0) return `${hours}h left`;
    const mins = Math.floor(diff / (1000 * 60));
    return `${mins}m left`;
  };

  const getStatusStyle = (status: string) => {
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
        <ScrollView style={styles.container} contentContainerStyle={styles.scrollPadding}>
          {/* Welcome skeleton */}
          <View style={styles.welcomeBanner}>
            <View style={[styles.skeleton, { width: 200, height: 24, marginBottom: 8 }]} />
            <View style={[styles.skeleton, { width: 140, height: 16 }]} />
          </View>
          {/* Token skeleton */}
          <View style={styles.sectionHeader}>
            <View style={[styles.skeleton, { width: 130, height: 18 }]} />
          </View>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.tokenScroll}>
            {[1, 2, 3].map((i) => (
              <View key={i} style={[styles.tokenCard, styles.skeletonCard]}>
                <View style={[styles.skeleton, { width: 80, height: 14, marginBottom: 8 }]} />
                <View style={[styles.skeleton, { width: 50, height: 22 }]} />
              </View>
            ))}
          </ScrollView>
          {/* Stats skeleton */}
          <View style={styles.statsRow}>
            {[1, 2, 3].map((i) => (
              <View key={i} style={[styles.statCard, styles.skeletonCard]}>
                <View style={[styles.skeleton, { width: 40, height: 24, marginBottom: 8 }]} />
                <View style={[styles.skeleton, { width: 60, height: 12 }]} />
              </View>
            ))}
          </View>
        </ScrollView>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: colors.background }]} edges={['top']}>
      <ScrollView
        style={styles.container}
        contentContainerStyle={styles.scrollPadding}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor={Colors.primary}
            colors={[Colors.primary]}
          />
        }
        showsVerticalScrollIndicator={false}
      >
        {/* Welcome Banner */}
        <View style={styles.welcomeBanner}>
          <View style={styles.welcomeContent}>
            <Text style={styles.greeting}>Assalamu Alaikum,</Text>
            <Text style={styles.donorName}>{donor?.name || 'Donor'}</Text>
            {donor?.is_member && (
              <View style={styles.memberBadge}>
                <Star size={12} color={Colors.amber} fill={Colors.amber} />
                <Text style={styles.memberText}>Member</Text>
              </View>
            )}
          </View>
          <View style={styles.welcomeIcon}>
            <Heart size={28} color={Colors.white} fill="rgba(255,255,255,0.3)" />
          </View>
        </View>

        {/* Token Balances */}
        <View style={styles.sectionHeader}>
          <Coins size={18} color={Colors.amber} />
          <Text style={[styles.sectionTitle, { color: colors.textPrimary }]}>Token Balances</Text>
        </View>

        {tokens.length > 0 ? (
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            style={styles.tokenScroll}
            contentContainerStyle={styles.tokenScrollContent}
          >
            {tokens.map((token) => (
              <View key={token.id} style={[styles.tokenCard, { backgroundColor: colors.cardBg, borderColor: colors.cardBorder }]}>
                <Text style={[styles.tokenMosque, { color: colors.textSecondary }]} numberOfLines={1}>
                  {token.mosques?.name || 'Mosque'}
                </Text>
                <View style={styles.tokenValueRow}>
                  <Coins size={20} color={Colors.amber} />
                  <Text style={styles.tokenValue}>{token.token_balance}</Text>
                </View>
              </View>
            ))}
          </ScrollView>
        ) : (
          <View style={[styles.emptySmall, { backgroundColor: colors.cardBg }]}>
            <Coins size={24} color={Colors.stone300} />
            <Text style={[styles.emptySmallText, { color: colors.textMuted }]}>
              Earn tokens by pledging donations
            </Text>
          </View>
        )}

        {/* Stats Row */}
        <View style={styles.statsRow}>
          <View style={[styles.statCard, { borderLeftColor: Colors.primary, backgroundColor: colors.cardBg }]}>
            <Gift size={20} color={Colors.primary} />
            <Text style={[styles.statValue, { color: colors.textPrimary }]}>{stats.itemsPledged}</Text>
            <Text style={[styles.statLabel, { color: colors.textMuted }]}>Items Pledged</Text>
          </View>
          <View style={[styles.statCard, { borderLeftColor: Colors.amber, backgroundColor: colors.cardBg }]}>
            <Coins size={20} color={Colors.amber} />
            <Text style={[styles.statValue, { color: colors.textPrimary }]}>{stats.tokensEarned}</Text>
            <Text style={[styles.statLabel, { color: colors.textMuted }]}>Tokens Earned</Text>
          </View>
          <View style={[styles.statCard, { borderLeftColor: Colors.teal, backgroundColor: colors.cardBg }]}>
            <Award size={20} color={Colors.teal} />
            <Text style={[styles.statValue, { color: colors.textPrimary }]}>{stats.totalPledges}</Text>
            <Text style={[styles.statLabel, { color: colors.textMuted }]}>Total Pledges</Text>
          </View>
        </View>

        {/* Announcements */}
        <View style={styles.sectionHeader}>
          <View style={styles.sectionTitleRow}>
            <Megaphone size={18} color={Colors.primary} />
            <Text style={[styles.sectionTitle, { color: colors.textPrimary }]}>Announcements</Text>
          </View>
          {unreadAnnouncements > 0 && (
            <View style={styles.unreadBadge}>
              <Text style={styles.unreadBadgeText}>{unreadAnnouncements}</Text>
            </View>
          )}
        </View>

        {unreadAnnouncements > 0 ? (
          <TouchableOpacity
            style={[styles.announcCard, { backgroundColor: colors.cardBg, borderColor: colors.cardBorder }]}
            activeOpacity={0.8}
            onPress={() => router.push('/(donor-tabs)/mosques')}
          >
            <Megaphone size={24} color={Colors.primary} />
            <View style={styles.announcText}>
              <Text style={[styles.announcTitle, { color: colors.textPrimary }]}>
                {unreadAnnouncements} new announcement{unreadAnnouncements !== 1 ? 's' : ''}
              </Text>
              <Text style={[styles.announcSub, { color: colors.textMuted }]}>
                Tap to view from your mosques
              </Text>
            </View>
            <ChevronRight size={18} color={colors.textMuted} />
          </TouchableOpacity>
        ) : (
          <View style={[styles.emptyCard, { backgroundColor: colors.cardBg, borderColor: colors.cardBorder }]}>
            <Megaphone size={32} color={Colors.stone300} />
            <Text style={[styles.emptyTitle, { color: colors.textSecondary }]}>No New Announcements</Text>
            <Text style={[styles.emptySubtitle, { color: colors.textMuted }]}>
              Updates from your mosques will appear here
            </Text>
          </View>
        )}

        {/* Active Polls */}
        <View style={styles.sectionHeader}>
          <BarChart3 size={18} color={Colors.primary} />
          <Text style={[styles.sectionTitle, { color: colors.textPrimary }]}>Active Polls</Text>
        </View>

        {polls.length > 0 ? (
          polls.map((poll) => {
            const totalTokens = poll.poll_options.reduce(
              (sum, opt) =>
                sum + opt.votes.reduce((vs, v) => vs + (v.tokens_spent || 0), 0),
              0
            );

            return (
              <View key={poll.id} style={[styles.pollCard, { backgroundColor: colors.cardBg, borderColor: colors.cardBorder }]}>
                <View style={styles.pollHeader}>
                  <View style={styles.pollMosqueBadge}>
                    <Text style={styles.pollMosqueText}>
                      {poll.mosques?.name || 'Mosque'}
                    </Text>
                  </View>
                  <View style={styles.pollTimeBadge}>
                    <Clock size={12} color={Colors.textMuted} />
                    <Text style={styles.pollTimeText}>
                      {getTimeRemaining(poll.closes_at)}
                    </Text>
                  </View>
                </View>

                <Text style={[styles.pollQuestion, { color: colors.textPrimary }]}>{poll.question}</Text>

                <View style={styles.pollCostRow}>
                  <Coins size={14} color={Colors.amber} />
                  <Text style={styles.pollCostText}>
                    {poll.tokens_to_vote} token{poll.tokens_to_vote !== 1 ? 's' : ''} per vote
                  </Text>
                </View>

                {/* Options with progress */}
                {poll.poll_options.map((opt) => {
                  const optionTokens = opt.votes.reduce(
                    (s, v) => s + (v.tokens_spent || 0),
                    0
                  );
                  const pct = totalTokens > 0 ? (optionTokens / totalTokens) * 100 : 0;

                  return (
                    <View key={opt.id} style={styles.optionRow}>
                      <View style={styles.optionLabelRow}>
                        <Text style={[styles.optionText, { color: colors.textPrimary }]} numberOfLines={1}>
                          {opt.option_text}
                        </Text>
                        <Text style={styles.optionPct}>{Math.round(pct)}%</Text>
                      </View>
                      <View style={styles.progressTrack}>
                        <View
                          style={[
                            styles.progressFill,
                            { width: `${Math.max(pct, 2)}%` },
                          ]}
                        />
                      </View>
                    </View>
                  );
                })}

                <TouchableOpacity
                  style={styles.voteButton}
                  activeOpacity={0.8}
                  onPress={() => {
                    // Navigate to voting flow — can be expanded later
                    router.push(`/poll/${poll.id}` as any);
                  }}
                >
                  <Text style={styles.voteButtonText}>Vote</Text>
                  <ChevronRight size={16} color={Colors.primary} />
                </TouchableOpacity>
              </View>
            );
          })
        ) : (
          <View style={[styles.emptyCard, { backgroundColor: colors.cardBg, borderColor: colors.cardBorder }]}>
            <BarChart3 size={32} color={Colors.stone300} />
            <Text style={[styles.emptyTitle, { color: colors.textSecondary }]}>No Active Polls</Text>
            <Text style={[styles.emptySubtitle, { color: colors.textMuted }]}>
              Polls from your mosques will appear here
            </Text>
          </View>
        )}

        {/* Recent Donations */}
        <View style={styles.sectionHeader}>
          <Heart size={18} color={Colors.primary} />
          <Text style={[styles.sectionTitle, { color: colors.textPrimary }]}>Recent Donations</Text>
        </View>

        {recentDonations.length > 0 ? (
          recentDonations.map((pledge) => {
            const statusStyle = getStatusStyle(pledge.status);
            return (
              <View key={pledge.id} style={[styles.donationCard, { backgroundColor: colors.cardBg, borderColor: colors.cardBorder }]}>
                <View style={styles.donationMain}>
                  <Text style={[styles.donationName, { color: colors.textPrimary }]} numberOfLines={1}>
                    {pledge.needs?.name || 'Donation'}
                  </Text>
                  <Text style={styles.donationMosque} numberOfLines={1}>
                    {pledge.needs?.mosques?.name || ''}
                  </Text>
                  <View style={styles.donationMeta}>
                    <Text style={styles.donationQty}>Qty: {pledge.quantity}</Text>
                    {pledge.tokens_earned > 0 && (
                      <View style={styles.tokenEarnedBadge}>
                        <Coins size={12} color={Colors.amber} />
                        <Text style={styles.tokenEarnedText}>
                          +{pledge.tokens_earned}
                        </Text>
                      </View>
                    )}
                  </View>
                </View>
                <View
                  style={[
                    styles.statusBadge,
                    { backgroundColor: statusStyle.bg },
                  ]}
                >
                  <Text
                    style={[styles.statusText, { color: statusStyle.text }]}
                  >
                    {pledge.status}
                  </Text>
                </View>
              </View>
            );
          })
        ) : (
          <View style={[styles.emptyCard, { backgroundColor: colors.cardBg, borderColor: colors.cardBorder }]}>
            <Heart size={32} color={Colors.stone300} />
            <Text style={[styles.emptyTitle, { color: colors.textSecondary }]}>No Donations Yet</Text>
            <Text style={[styles.emptySubtitle, { color: colors.textMuted }]}>
              Browse mosques to find needs and start giving
            </Text>
            <TouchableOpacity
              style={styles.emptyButton}
              activeOpacity={0.8}
              onPress={() => router.push('/(donor-tabs)/mosques')}
            >
              <Text style={styles.emptyButtonText}>Browse Mosques</Text>
            </TouchableOpacity>
          </View>
        )}

        <View style={{ height: Spacing.xxxl }} />
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  container: {
    flex: 1,
  },
  scrollPadding: {
    paddingHorizontal: Spacing.lg,
    paddingTop: Spacing.lg,
    paddingBottom: Spacing.huge,
  },

  // Skeletons
  skeleton: {
    backgroundColor: Colors.stone200,
    borderRadius: Radius.sm,
  },
  skeletonCard: {
    backgroundColor: Colors.stone100,
  },

  // Welcome Banner
  welcomeBanner: {
    backgroundColor: Colors.primary,
    borderRadius: Radius.xl,
    padding: Spacing.xxl,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: Spacing.xxl,
    shadowColor: Colors.primary,
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.25,
    shadowRadius: 16,
    elevation: 6,
  },
  welcomeContent: {
    flex: 1,
  },
  greeting: {
    fontFamily: 'Inter-Regular',
    fontSize: FontSize.sm,
    color: 'rgba(255,255,255,0.8)',
    marginBottom: Spacing.xs,
  },
  donorName: {
    fontFamily: 'Inter-Bold',
    fontSize: FontSize.xxl,
    color: Colors.white,
  },
  memberBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.2)',
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.xs,
    borderRadius: Radius.full,
    alignSelf: 'flex-start',
    marginTop: Spacing.sm,
    gap: 4,
  },
  memberText: {
    fontFamily: 'Inter-SemiBold',
    fontSize: FontSize.xs,
    color: Colors.white,
  },
  welcomeIcon: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: 'rgba(255,255,255,0.15)',
    justifyContent: 'center',
    alignItems: 'center',
    marginLeft: Spacing.lg,
  },

  // Section Header
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: Spacing.md,
    gap: Spacing.sm,
  },
  sectionTitle: {
    fontFamily: 'Inter-Bold',
    fontSize: FontSize.lg,
    color: Colors.textPrimary,
  },

  // Token Cards
  tokenScroll: {
    marginBottom: Spacing.xxl,
    marginHorizontal: -Spacing.lg,
  },
  tokenScrollContent: {
    paddingHorizontal: Spacing.lg,
    gap: Spacing.md,
  },
  tokenCard: {
    backgroundColor: Colors.cardBg,
    borderRadius: Radius.lg,
    padding: Spacing.lg,
    minWidth: 140,
    borderWidth: 1,
    borderColor: Colors.amberFaint,
    shadowColor: Colors.black,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 8,
    elevation: 2,
  },
  tokenMosque: {
    fontFamily: 'Inter-SemiBold',
    fontSize: FontSize.sm,
    color: Colors.textSecondary,
    marginBottom: Spacing.sm,
  },
  tokenValueRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
  },
  tokenValue: {
    fontFamily: 'Inter-Bold',
    fontSize: FontSize.xxl,
    color: Colors.amber,
  },

  // Stats Row
  statsRow: {
    flexDirection: 'row',
    gap: Spacing.md,
    marginBottom: Spacing.xxl,
  },
  statCard: {
    flex: 1,
    backgroundColor: Colors.cardBg,
    borderRadius: Radius.lg,
    padding: Spacing.lg,
    alignItems: 'center',
    borderLeftWidth: 3,
    shadowColor: Colors.black,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 8,
    elevation: 2,
  },
  statValue: {
    fontFamily: 'Inter-Bold',
    fontSize: FontSize.xl,
    color: Colors.textPrimary,
    marginTop: Spacing.sm,
  },
  statLabel: {
    fontFamily: 'Inter-Regular',
    fontSize: FontSize.xs,
    color: Colors.textMuted,
    marginTop: Spacing.xs,
    textAlign: 'center',
  },

  // Announcements
  sectionTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
  },
  unreadBadge: {
    backgroundColor: Colors.red,
    minWidth: 22,
    height: 22,
    borderRadius: 11,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 6,
  },
  unreadBadgeText: {
    fontFamily: 'Inter-Bold',
    fontSize: FontSize.xs,
    color: Colors.white,
  },
  announcCard: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: Radius.lg,
    padding: Spacing.lg,
    marginBottom: Spacing.md,
    borderWidth: 1,
    gap: Spacing.md,
  },
  announcText: {
    flex: 1,
  },
  announcTitle: {
    fontFamily: 'Inter-SemiBold',
    fontSize: FontSize.md,
    marginBottom: 2,
  },
  announcSub: {
    fontFamily: 'Inter-Regular',
    fontSize: FontSize.sm,
  },

  // Poll Cards
  pollCard: {
    backgroundColor: Colors.cardBg,
    borderRadius: Radius.lg,
    padding: Spacing.lg,
    marginBottom: Spacing.md,
    borderWidth: 1,
    borderColor: Colors.cardBorder,
    shadowColor: Colors.black,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 8,
    elevation: 2,
  },
  pollHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: Spacing.md,
  },
  pollMosqueBadge: {
    backgroundColor: Colors.primaryFaint,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.xs,
    borderRadius: Radius.full,
  },
  pollMosqueText: {
    fontFamily: 'Inter-SemiBold',
    fontSize: FontSize.xs,
    color: Colors.primary,
  },
  pollTimeBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  pollTimeText: {
    fontFamily: 'Inter-Regular',
    fontSize: FontSize.xs,
    color: Colors.textMuted,
  },
  pollQuestion: {
    fontFamily: 'Inter-SemiBold',
    fontSize: FontSize.md,
    color: Colors.textPrimary,
    marginBottom: Spacing.sm,
    lineHeight: 22,
  },
  pollCostRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginBottom: Spacing.md,
  },
  pollCostText: {
    fontFamily: 'Inter-Regular',
    fontSize: FontSize.xs,
    color: Colors.textMuted,
  },
  optionRow: {
    marginBottom: Spacing.sm,
  },
  optionLabelRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  optionText: {
    fontFamily: 'Inter-Regular',
    fontSize: FontSize.sm,
    color: Colors.textPrimary,
    flex: 1,
    marginRight: Spacing.sm,
  },
  optionPct: {
    fontFamily: 'Inter-SemiBold',
    fontSize: FontSize.sm,
    color: Colors.textSecondary,
  },
  progressTrack: {
    height: 6,
    backgroundColor: Colors.stone100,
    borderRadius: 3,
    overflow: 'hidden',
  },
  progressFill: {
    height: 6,
    backgroundColor: Colors.primary,
    borderRadius: 3,
  },
  voteButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1.5,
    borderColor: Colors.primary,
    borderRadius: Radius.md,
    paddingVertical: Spacing.md,
    marginTop: Spacing.md,
    gap: 4,
    minHeight: 44,
  },
  voteButtonText: {
    fontFamily: 'Inter-SemiBold',
    fontSize: FontSize.sm,
    color: Colors.primary,
  },

  // Donation Cards
  donationCard: {
    backgroundColor: Colors.cardBg,
    borderRadius: Radius.lg,
    padding: Spacing.lg,
    marginBottom: Spacing.md,
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: Colors.cardBorder,
    shadowColor: Colors.black,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 8,
    elevation: 2,
  },
  donationMain: {
    flex: 1,
    marginRight: Spacing.md,
  },
  donationName: {
    fontFamily: 'Inter-SemiBold',
    fontSize: FontSize.md,
    color: Colors.textPrimary,
    marginBottom: 2,
  },
  donationMosque: {
    fontFamily: 'Inter-Regular',
    fontSize: FontSize.sm,
    color: Colors.textMuted,
    marginBottom: Spacing.sm,
  },
  donationMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
  },
  donationQty: {
    fontFamily: 'Inter-Regular',
    fontSize: FontSize.xs,
    color: Colors.textSecondary,
  },
  tokenEarnedBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    backgroundColor: Colors.amberFaint,
    paddingHorizontal: Spacing.sm,
    paddingVertical: 2,
    borderRadius: Radius.full,
  },
  tokenEarnedText: {
    fontFamily: 'Inter-SemiBold',
    fontSize: FontSize.xs,
    color: Colors.amber,
  },
  statusBadge: {
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.xs,
    borderRadius: Radius.full,
  },
  statusText: {
    fontFamily: 'Inter-SemiBold',
    fontSize: FontSize.xs,
    textTransform: 'capitalize',
  },

  // Empty States
  emptySmall: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.stone100,
    borderRadius: Radius.md,
    padding: Spacing.lg,
    marginBottom: Spacing.xxl,
    gap: Spacing.md,
  },
  emptySmallText: {
    fontFamily: 'Inter-Regular',
    fontSize: FontSize.sm,
    color: Colors.textMuted,
    flex: 1,
  },
  emptyCard: {
    backgroundColor: Colors.cardBg,
    borderRadius: Radius.lg,
    padding: Spacing.xxxl,
    alignItems: 'center',
    marginBottom: Spacing.md,
    borderWidth: 1,
    borderColor: Colors.cardBorder,
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
    textAlign: 'center',
    marginTop: Spacing.xs,
    lineHeight: 20,
  },
  emptyButton: {
    backgroundColor: Colors.primary,
    borderRadius: Radius.md,
    paddingHorizontal: Spacing.xxl,
    paddingVertical: Spacing.md,
    marginTop: Spacing.lg,
    minHeight: 44,
    justifyContent: 'center',
  },
  emptyButtonText: {
    fontFamily: 'Inter-SemiBold',
    fontSize: FontSize.sm,
    color: Colors.white,
  },
});
