import React, { useEffect, useState, useCallback } from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  RefreshControl,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import {
  Heart,
  Coins,
  Package,
  DollarSign,
  Search,
  Truck,
} from 'lucide-react-native';
import { supabase } from '@/lib/supabase';
import { useAppContext } from '@/lib/context';
import { Colors, Spacing, Radius, FontSize, useTheme } from '@/lib/theme';
import { Pledge, Need, Mosque } from '@/lib/types';

interface PledgeWithDetails extends Pledge {
  needs: Pick<Need, 'name' | 'type' | 'mosque_id'> & {
    mosques: Pick<Mosque, 'name'>;
  };
}

export default function DonationsScreen() {
  const { donor, isAdmin } = useAppContext();
  const { colors } = useTheme();

  const [pledges, setPledges] = useState<PledgeWithDetails[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const fetchPledges = useCallback(async () => {
    if (!donor) return;
    if (isAdmin) {
      setPledges([]);
      setLoading(false);
      setRefreshing(false);
      return;
    }
    try {
      const { data, error } = await supabase
        .from('pledges')
        .select(`
          *,
          needs(name, type, mosque_id, mosques(name))
        `)
        .eq('donor_id', donor.id)
        .order('created_at', { ascending: false });

      if (error) {
        console.error('Error fetching pledges:', error);
        return;
      }

      setPledges((data || []) as PledgeWithDetails[]);
    } catch (err) {
      console.error('Error:', err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [donor, isAdmin]);

  useEffect(() => {
    fetchPledges();
  }, [fetchPledges]);

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    fetchPledges();
  }, [fetchPledges]);

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

  const getTypeIcon = (type: string) => {
    if (type === 'money') {
      return <DollarSign size={16} color={Colors.teal} />;
    }
    return <Package size={16} color={Colors.primary} />;
  };

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr);
    return date.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
  };

  if (loading) {
    return (
      <SafeAreaView style={[styles.safe, { backgroundColor: colors.background }]} edges={['top']}>
        <View style={styles.header}>
          <Text style={[styles.headerTitle, { color: colors.textPrimary }]}>My Donations</Text>
        </View>
        <ScrollView contentContainerStyle={styles.scrollContent}>
          {[1, 2, 3, 4, 5].map((i) => (
            <View key={i} style={styles.skeletonCard}>
              <View style={[styles.skeletonLine, { width: '60%', height: 16, marginBottom: 8 }]} />
              <View style={[styles.skeletonLine, { width: '40%', height: 12, marginBottom: 12 }]} />
              <View style={styles.skeletonRow}>
                <View style={[styles.skeletonLine, { width: 60, height: 12 }]} />
                <View style={[styles.skeletonLine, { width: 50, height: 20, borderRadius: 10 }]} />
              </View>
            </View>
          ))}
        </ScrollView>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: colors.background }]} edges={['top']}>
      <View style={styles.header}>
        <Text style={[styles.headerTitle, { color: colors.textPrimary }]}>My Donations</Text>
        <Text style={[styles.headerSubtitle, { color: colors.textMuted }]}>
          {pledges.length} donation{pledges.length !== 1 ? 's' : ''} total
        </Text>
      </View>

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor={Colors.primary}
            colors={[Colors.primary]}
          />
        }
      >
        {pledges.length > 0 ? (
          pledges.map((pledge) => {
            const statusStyle = getStatusStyle(pledge.status);
            const needType = pledge.needs?.type || 'item';

            return (
              <View key={pledge.id} style={[styles.pledgeCard, { backgroundColor: colors.cardBg, borderColor: colors.cardBorder }]}>
                {/* Top Row */}
                <View style={styles.pledgeHeader}>
                  <View style={styles.pledgeInfo}>
                    <Text style={[styles.pledgeName, { color: colors.textPrimary }]} numberOfLines={1}>
                      {pledge.needs?.name || 'Donation'}
                    </Text>
                    <Text style={[styles.pledgeMosque, { color: colors.textMuted }]} numberOfLines={1}>
                      {pledge.needs?.mosques?.name || 'Mosque'}
                    </Text>
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

                {/* Details Row */}
                <View style={styles.detailsRow}>
                  {/* Type Badge */}
                  <View style={styles.detailChip}>
                    {getTypeIcon(needType)}
                    <Text style={styles.detailChipText}>
                      {needType === 'money' ? 'Money' : 'Item'}
                    </Text>
                  </View>

                  {/* Delivery Method */}
                  {pledge.delivery_method && (
                    <View style={styles.detailChip}>
                      <Truck size={14} color={Colors.textMuted} />
                      <Text style={styles.detailChipText}>
                        {pledge.delivery_method}
                      </Text>
                    </View>
                  )}

                  {/* Quantity */}
                  <View style={styles.detailChip}>
                    <Text style={styles.detailChipText}>
                      Qty: {pledge.quantity}
                    </Text>
                  </View>
                </View>

                {/* Bottom Row */}
                <View style={styles.bottomRow}>
                  <Text style={styles.dateText}>
                    {formatDate(pledge.created_at)}
                  </Text>

                  {pledge.tokens_earned > 0 && (
                    <View style={styles.tokenBadge}>
                      <Coins size={14} color={Colors.amber} />
                      <Text style={styles.tokenText}>
                        +{pledge.tokens_earned} tokens
                      </Text>
                    </View>
                  )}
                </View>
              </View>
            );
          })
        ) : (
          <View style={styles.emptyState}>
            <View style={styles.emptyIconCircle}>
              <Heart size={40} color={Colors.stone300} />
            </View>
            <Text style={[styles.emptyTitle, { color: colors.textPrimary }]}>Your Impact Starts Here</Text>
            <Text style={[styles.emptySubtitle, { color: colors.textMuted }]}>
              Browse mosques to find needs in your community and start making a
              difference today.
            </Text>
            <TouchableOpacity
              style={styles.emptyButton}
              activeOpacity={0.8}
              onPress={() => router.push('/(donor-tabs)/mosques')}
            >
              <Search size={18} color={Colors.white} />
              <Text style={styles.emptyButtonText}>Browse Mosques</Text>
            </TouchableOpacity>
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  header: {
    paddingHorizontal: Spacing.lg,
    paddingTop: Spacing.lg,
    paddingBottom: Spacing.md,
  },
  headerTitle: {
    fontFamily: 'Inter-Bold',
    fontSize: FontSize.xxl,
    color: Colors.textPrimary,
  },
  headerSubtitle: {
    fontFamily: 'Inter-Regular',
    fontSize: FontSize.sm,
    color: Colors.textMuted,
    marginTop: Spacing.xs,
  },

  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: Spacing.lg,
    paddingBottom: Spacing.huge,
  },

  // Pledge Card
  pledgeCard: {
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
  pledgeHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: Spacing.md,
  },
  pledgeInfo: {
    flex: 1,
    marginRight: Spacing.md,
  },
  pledgeName: {
    fontFamily: 'Inter-SemiBold',
    fontSize: FontSize.md,
    color: Colors.textPrimary,
    marginBottom: 2,
  },
  pledgeMosque: {
    fontFamily: 'Inter-Regular',
    fontSize: FontSize.sm,
    color: Colors.textMuted,
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

  // Details Row
  detailsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.sm,
    marginBottom: Spacing.md,
  },
  detailChip: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.stone100,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.xs,
    borderRadius: Radius.full,
    gap: 4,
  },
  detailChipText: {
    fontFamily: 'Inter-Regular',
    fontSize: FontSize.xs,
    color: Colors.textSecondary,
  },

  // Bottom Row
  bottomRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: Colors.stone200,
    paddingTop: Spacing.md,
  },
  dateText: {
    fontFamily: 'Inter-Regular',
    fontSize: FontSize.xs,
    color: Colors.textMuted,
  },
  tokenBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.amberFaint,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.xs,
    borderRadius: Radius.full,
    gap: 4,
  },
  tokenText: {
    fontFamily: 'Inter-SemiBold',
    fontSize: FontSize.xs,
    color: Colors.amber,
  },

  // Skeleton
  skeletonCard: {
    backgroundColor: Colors.stone100,
    borderRadius: Radius.lg,
    padding: Spacing.lg,
    marginBottom: Spacing.md,
  },
  skeletonLine: {
    backgroundColor: Colors.stone200,
    borderRadius: 4,
  },
  skeletonRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },

  // Empty State
  emptyState: {
    alignItems: 'center',
    paddingTop: Spacing.huge,
    paddingHorizontal: Spacing.xxl,
  },
  emptyIconCircle: {
    width: 88,
    height: 88,
    borderRadius: 44,
    backgroundColor: Colors.stone100,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: Spacing.xxl,
  },
  emptyTitle: {
    fontFamily: 'Inter-Bold',
    fontSize: FontSize.xl,
    color: Colors.textPrimary,
    marginBottom: Spacing.sm,
    textAlign: 'center',
  },
  emptySubtitle: {
    fontFamily: 'Inter-Regular',
    fontSize: FontSize.sm,
    color: Colors.textMuted,
    textAlign: 'center',
    lineHeight: 20,
    marginBottom: Spacing.xxl,
  },
  emptyButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.primary,
    borderRadius: Radius.md,
    paddingHorizontal: Spacing.xxl,
    paddingVertical: Spacing.md,
    gap: Spacing.sm,
    minHeight: 48,
    shadowColor: Colors.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 4,
  },
  emptyButtonText: {
    fontFamily: 'Inter-SemiBold',
    fontSize: FontSize.md,
    color: Colors.white,
  },
});
