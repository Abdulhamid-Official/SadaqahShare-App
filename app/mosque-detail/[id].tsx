import React, { useEffect, useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Image,
  ActivityIndicator,
  Linking,
  Platform,
  useWindowDimensions,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter } from 'expo-router';
import {
  ArrowLeft,
  MapPin,
  Phone,
  Mail,
  ExternalLink,
  Building2,
  ShoppingBag,
  DollarSign,
  Coins,
  AlertTriangle,
} from 'lucide-react-native';
import { supabase } from '@/lib/supabase';
import { Mosque, Need } from '@/lib/types';
import { Colors, Spacing, Radius, FontSize, useTheme } from '@/lib/theme';
import { useAppContext } from '@/lib/context';
import { useDeviceSize, useContentWidth } from '@/lib/responsive';
import PledgeModal from '@/components/PledgeModal';
import { useRealtimeTable } from '@/hooks/useRealtimeTable';

type TabKey = 'item' | 'money';

const PRIORITY_COLORS: Record<string, { bg: string; text: string }> = {
  Urgent: { bg: Colors.redFaint, text: Colors.red },
  High: { bg: '#fff7ed', text: '#ea580c' },
  Medium: { bg: Colors.blueFaint, text: Colors.blue },
  Low: { bg: Colors.stone100, text: Colors.stone600 },
};

export default function MosqueDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const device = useDeviceSize();
  const { paddingHorizontal, maxWidth } = useContentWidth();
  const { width: screenWidth } = useWindowDimensions();
  const isWide = device !== 'phone';

  const [mosque, setMosque] = useState<Mosque | null>(null);
  const [needs, setNeeds] = useState<Need[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<TabKey>('item');
  const [pledgeNeed, setPledgeNeed] = useState<Need | null>(null);
  const [isMember, setIsMember] = useState(false);
  const { donor, isAdmin } = useAppContext();
  const { colors } = useTheme();

  const loadData = useCallback(async () => {
    if (!id) return;
    setLoading(true);
    setError(null);
    try {
      const [mosqueRes, needsRes] = await Promise.all([
        supabase.from('mosques').select('*').eq('id', id).single(),
        supabase
          .from('needs')
          .select('*')
          .eq('mosque_id', id)
          .order('priority', { ascending: true })
          .order('created_at', { ascending: false }),
      ]);
      if (mosqueRes.error) throw mosqueRes.error;
      if (needsRes.error) throw needsRes.error;
      setMosque(mosqueRes.data);
      setNeeds((needsRes.data ?? []).filter((n: Need) => !n.archived));

      if (isAdmin) {
        setIsMember(true);
      } else if (donor) {
        const { data: membership } = await supabase
          .from('mosque_members')
          .select('id')
          .eq('donor_id', donor.id)
          .eq('mosque_id', id)
          .maybeSingle();
        setIsMember(!!membership);
      }
    } catch (e: any) {
      setError(e.message ?? 'Failed to load mosque');
    } finally {
      setLoading(false);
    }
  }, [id, donor, isAdmin]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  useRealtimeTable('needs', id ? `mosque_id=eq.${id}` : null, loadData, !!id);
  useRealtimeTable('pledges', null, loadData, !!id);

  const filteredNeeds = needs.filter((n) => n.type === activeTab && !n.archived);

  const handlePledgeClose = useCallback(() => {
    setPledgeNeed(null);
    loadData();
  }, [loadData]);

  // ---------- rendering helpers ----------

  const renderHeader = () => {
    if (!mosque) return null;
    return (
      <View style={[styles.headerCard, isWide && styles.headerCardWide, { backgroundColor: colors.cardBg, borderColor: colors.cardBorder }]}>
        {mosque.image_url ? (
          <Image
            source={{ uri: mosque.image_url }}
            style={[styles.mosqueImage, isWide && styles.mosqueImageWide]}
            resizeMode="cover"
          />
        ) : (
          <View style={[styles.imagePlaceholder, isWide && styles.mosqueImageWide]}>
            <Building2 size={48} color={Colors.stone300} />
          </View>
        )}
        <View style={[styles.headerInfo, isWide && styles.headerInfoWide]}>
          <Text style={[styles.mosqueName, { color: colors.textPrimary }]}>{mosque.name}</Text>
          <View style={styles.infoRow}>
            <MapPin size={16} color={Colors.textMuted} />
            <Text style={styles.infoText}>
              {mosque.address}, {mosque.city}, {mosque.state}
            </Text>
          </View>
          {mosque.phone ? (
            <TouchableOpacity
              style={styles.infoRow}
              onPress={() => Linking.openURL(`tel:${mosque.phone}`)}
              activeOpacity={0.7}
            >
              <Phone size={16} color={Colors.primary} />
              <Text style={[styles.infoText, styles.linkText]}>{mosque.phone}</Text>
            </TouchableOpacity>
          ) : null}
          {mosque.email ? (
            <TouchableOpacity
              style={styles.infoRow}
              onPress={() => Linking.openURL(`mailto:${mosque.email}`)}
              activeOpacity={0.7}
            >
              <Mail size={16} color={Colors.primary} />
              <Text style={[styles.infoText, styles.linkText]}>{mosque.email}</Text>
            </TouchableOpacity>
          ) : null}
          {mosque.description ? (
            <Text style={[styles.descriptionText, { color: colors.textSecondary }]}>{mosque.description}</Text>
          ) : null}
        </View>
      </View>
    );
  };

  const renderTabs = () => (
    <View style={styles.tabRow}>
      {([
        { key: 'item' as TabKey, label: 'Items', icon: ShoppingBag },
        { key: 'money' as TabKey, label: 'Fundraisers', icon: DollarSign },
      ]).map(({ key, label, icon: Icon }) => {
        const active = activeTab === key;
        const count = needs.filter((n) => n.type === key).length;
        return (
          <TouchableOpacity
            key={key}
            style={[styles.tab, active && styles.tabActive]}
            onPress={() => setActiveTab(key)}
            activeOpacity={0.7}
          >
            <Icon size={18} color={active ? Colors.white : Colors.textSecondary} />
            <Text style={[styles.tabLabel, active && styles.tabLabelActive]}>
              {label} ({count})
            </Text>
          </TouchableOpacity>
        );
      })}
    </View>
  );

  const renderNeedCard = (need: Need) => {
    const prio = PRIORITY_COLORS[need.priority] ?? PRIORITY_COLORS.Low;
    const remaining = need.quantity_needed - need.quantity_pledged;
    const pct = need.quantity_needed > 0 ? Math.min((need.quantity_pledged / need.quantity_needed) * 100, 100) : 0;
    const fullyPledged = remaining <= 0;
    const dollarProgress =
      need.type === 'money' && need.amount_dollars
        ? {
            raised: need.quantity_pledged * need.amount_dollars,
            goal: need.quantity_needed * need.amount_dollars,
          }
        : null;

    return (
      <View key={need.id} style={[styles.needCard, fullyPledged && styles.needCardMuted, { backgroundColor: colors.cardBg, borderColor: colors.cardBorder }]}>
        {/* Top row: name + priority */}
        <View style={styles.needTopRow}>
          <Text style={[styles.needName, fullyPledged && styles.mutedText, { color: colors.textPrimary }]} numberOfLines={2}>
            {need.name}
          </Text>
          <View style={[styles.priorityBadge, { backgroundColor: prio.bg }]}>
            {need.priority === 'Urgent' && <AlertTriangle size={12} color={prio.text} />}
            <Text style={[styles.priorityText, { color: prio.text }]}>{need.priority}</Text>
          </View>
        </View>

        {/* Description */}
        {need.description ? (
          <Text style={styles.needDesc} numberOfLines={2}>
            {need.description}
          </Text>
        ) : null}

        {/* Money amount */}
        {need.type === 'money' && need.amount_dollars != null ? (
          <Text style={styles.dollarLabel}>${need.amount_dollars.toFixed(2)} per unit</Text>
        ) : null}

        {/* Token reward */}
        <View style={styles.tokenRow}>
          <Coins size={14} color={Colors.amber} />
          <Text style={styles.tokenText}>
            {need.tokens_per_unit} token{need.tokens_per_unit !== 1 ? 's' : ''}{' '}
            {need.type === 'money' && need.amount_dollars
              ? `per $${need.amount_dollars.toFixed(2)}`
              : 'per item'}
          </Text>
        </View>

        {/* Progress */}
        <View style={styles.progressSection}>
          <View style={styles.progressBarBg}>
            <View
              style={[
                styles.progressBarFill,
                { width: `${pct}%` },
                fullyPledged && { backgroundColor: Colors.stone400 },
              ]}
            />
          </View>
          <View style={styles.progressLabelRow}>
            <Text style={styles.progressText}>
              {need.quantity_pledged} / {need.quantity_needed} pledged
            </Text>
            <Text style={styles.progressPct}>{Math.round(pct)}%</Text>
          </View>
          {dollarProgress ? (
            <Text style={styles.dollarProgress}>
              ${dollarProgress.raised.toLocaleString()} / ${dollarProgress.goal.toLocaleString()}
            </Text>
          ) : null}
        </View>

        {/* Actions */}
        <View style={styles.actionRow}>
          {fullyPledged ? (
            <View style={styles.fullyPledgedBadge}>
              <Text style={styles.fullyPledgedText}>Fully Pledged</Text>
            </View>
          ) : !isMember ? (
            <View style={styles.fullyPledgedBadge}>
              <Text style={styles.fullyPledgedText}>Join to Donate</Text>
            </View>
          ) : (
            <TouchableOpacity
              style={styles.donateBtn}
              onPress={() => setPledgeNeed(need)}
              activeOpacity={0.7}
            >
              <Text style={styles.donateBtnText}>Donate</Text>
            </TouchableOpacity>
          )}
          {need.purchase_link ? (
            <TouchableOpacity
              style={styles.linkBtn}
              onPress={() => Linking.openURL(need.purchase_link!)}
              activeOpacity={0.7}
            >
              <ExternalLink size={16} color={Colors.primary} />
              <Text style={styles.linkBtnText}>Purchase Link</Text>
            </TouchableOpacity>
          ) : null}
        </View>

        {/* Token note */}
        <Text style={styles.tokenNote}>Tokens earned are specific to this mosque</Text>
      </View>
    );
  };

  // ---------- main render ----------

  if (loading) {
    return (
      <SafeAreaView style={[styles.safeArea, { backgroundColor: colors.background }]}>
        <View style={styles.center}>
          <ActivityIndicator size="large" color={Colors.primary} />
          <Text style={styles.loadingText}>Loading mosque…</Text>
        </View>
      </SafeAreaView>
    );
  }

  if (error || !mosque) {
    return (
      <SafeAreaView style={[styles.safeArea, { backgroundColor: colors.background }]}>
        <View style={[styles.topBar, { paddingHorizontal }]}>
          <TouchableOpacity style={[styles.backBtn, { backgroundColor: colors.inputBg }]} onPress={() => router.back()} activeOpacity={0.7}>
            <ArrowLeft size={22} color={Colors.textPrimary} />
          </TouchableOpacity>
        </View>
        <View style={styles.center}>
          <Text style={styles.errorText}>{error ?? 'Mosque not found'}</Text>
          <TouchableOpacity style={styles.retryBtn} onPress={loadData} activeOpacity={0.7}>
            <Text style={styles.retryBtnText}>Retry</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  const content = (
    <>
      {renderTabs()}
      {filteredNeeds.length === 0 ? (
        <View style={styles.emptyState}>
          <Text style={styles.emptyText}>
            No {activeTab === 'item' ? 'items' : 'fundraisers'} listed yet.
          </Text>
        </View>
      ) : (
        filteredNeeds.map(renderNeedCard)
      )}
    </>
  );

  return (
    <SafeAreaView style={[styles.safeArea, { backgroundColor: colors.background }]} edges={['top']}>
      {/* Back bar */}
      <View style={[styles.topBar, { paddingHorizontal }]}>
        <TouchableOpacity style={[styles.backBtn, { backgroundColor: colors.inputBg }]} onPress={() => router.back()} activeOpacity={0.7}>
          <ArrowLeft size={22} color={Colors.textPrimary} />
        </TouchableOpacity>
        <Text style={[styles.topBarTitle, { color: colors.textPrimary }]} numberOfLines={1}>
          {mosque.name}
        </Text>
        <View style={{ width: 44 }} />
      </View>

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={[
          styles.scrollContent,
          { paddingHorizontal, maxWidth, alignSelf: maxWidth ? 'center' : undefined, width: maxWidth ? '100%' : undefined },
        ]}
        showsVerticalScrollIndicator={false}
      >
        {isWide ? (
          <View style={styles.wideLayout}>
            <View style={styles.wideSidebar}>{renderHeader()}</View>
            <View style={styles.wideMain}>{content}</View>
          </View>
        ) : (
          <>
            {renderHeader()}
            {content}
          </>
        )}
      </ScrollView>

      {/* Pledge Modal */}
      {pledgeNeed && mosque ? (
        <PledgeModal
          visible={!!pledgeNeed}
          onClose={handlePledgeClose}
          need={pledgeNeed}
          mosqueName={mosque.name}
          mosqueId={mosque.id}
        />
      ) : null}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  center: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: Spacing.xxl,
  },
  loadingText: {
    fontFamily: 'Inter-Regular',
    fontSize: FontSize.md,
    color: Colors.textMuted,
    marginTop: Spacing.md,
  },
  errorText: {
    fontFamily: 'Inter-SemiBold',
    fontSize: FontSize.md,
    color: Colors.red,
    textAlign: 'center',
    marginBottom: Spacing.lg,
  },
  retryBtn: {
    backgroundColor: Colors.primary,
    paddingHorizontal: Spacing.xxl,
    paddingVertical: Spacing.md,
    borderRadius: Radius.md,
  },
  retryBtnText: {
    fontFamily: 'Inter-SemiBold',
    fontSize: FontSize.md,
    color: Colors.white,
  },

  /* Top bar */
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: Spacing.sm,
  },
  backBtn: {
    width: 44,
    height: 44,
    justifyContent: 'center',
    alignItems: 'center',
    borderRadius: Radius.full,
    backgroundColor: Colors.stone100,
  },
  topBarTitle: {
    flex: 1,
    fontFamily: 'Inter-SemiBold',
    fontSize: FontSize.lg,
    color: Colors.textPrimary,
    textAlign: 'center',
    marginHorizontal: Spacing.sm,
  },

  /* Scroll */
  scroll: {
    flex: 1,
  },
  scrollContent: {
    paddingBottom: Spacing.huge,
  },

  /* Wide layout */
  wideLayout: {
    flexDirection: 'row',
    gap: Spacing.xxl,
  },
  wideSidebar: {
    width: 340,
    flexShrink: 0,
  },
  wideMain: {
    flex: 1,
  },

  /* Header card */
  headerCard: {
    backgroundColor: Colors.cardBg,
    borderRadius: Radius.xl,
    overflow: 'hidden',
    marginBottom: Spacing.xl,
    borderWidth: 1,
    borderColor: Colors.cardBorder,
    ...Platform.select({
      ios: { shadowColor: '#000', shadowOpacity: 0.06, shadowRadius: 12, shadowOffset: { width: 0, height: 4 } },
      android: { elevation: 3 },
      default: { shadowColor: '#000', shadowOpacity: 0.06, shadowRadius: 12, shadowOffset: { width: 0, height: 4 } },
    }),
  },
  headerCardWide: {
    marginBottom: 0,
  },
  mosqueImage: {
    width: '100%',
    height: 200,
  },
  mosqueImageWide: {
    height: 180,
  },
  imagePlaceholder: {
    width: '100%',
    height: 200,
    backgroundColor: Colors.stone100,
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerInfo: {
    padding: Spacing.lg,
  },
  headerInfoWide: {
    padding: Spacing.lg,
  },
  mosqueName: {
    fontFamily: 'Inter-Bold',
    fontSize: FontSize.xxl,
    color: Colors.textPrimary,
    marginBottom: Spacing.sm,
  },
  infoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    marginBottom: Spacing.xs,
    minHeight: 28,
  },
  infoText: {
    fontFamily: 'Inter-Regular',
    fontSize: FontSize.sm,
    color: Colors.textSecondary,
    flex: 1,
  },
  linkText: {
    color: Colors.primary,
  },
  descriptionText: {
    fontFamily: 'Inter-Regular',
    fontSize: FontSize.sm,
    color: Colors.textSecondary,
    marginTop: Spacing.sm,
    lineHeight: 20,
  },

  /* Tabs */
  tabRow: {
    flexDirection: 'row',
    gap: Spacing.sm,
    marginBottom: Spacing.lg,
    marginTop: Spacing.xs,
  },
  tab: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.sm,
    paddingVertical: Spacing.md,
    borderRadius: Radius.md,
    backgroundColor: Colors.stone100,
    minHeight: 48,
  },
  tabActive: {
    backgroundColor: Colors.primary,
  },
  tabLabel: {
    fontFamily: 'Inter-SemiBold',
    fontSize: FontSize.sm,
    color: Colors.textSecondary,
  },
  tabLabelActive: {
    color: Colors.white,
  },

  /* Need card */
  needCard: {
    backgroundColor: Colors.cardBg,
    borderRadius: Radius.lg,
    padding: Spacing.lg,
    marginBottom: Spacing.md,
    borderWidth: 1,
    borderColor: Colors.cardBorder,
    ...Platform.select({
      ios: { shadowColor: '#000', shadowOpacity: 0.04, shadowRadius: 8, shadowOffset: { width: 0, height: 2 } },
      android: { elevation: 2 },
      default: { shadowColor: '#000', shadowOpacity: 0.04, shadowRadius: 8, shadowOffset: { width: 0, height: 2 } },
    }),
  },
  needCardMuted: {
    opacity: 0.6,
  },
  needTopRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    gap: Spacing.sm,
    marginBottom: Spacing.sm,
  },
  needName: {
    flex: 1,
    fontFamily: 'Inter-SemiBold',
    fontSize: FontSize.lg,
    color: Colors.textPrimary,
  },
  mutedText: {
    color: Colors.textMuted,
  },
  priorityBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: Spacing.sm,
    paddingVertical: Spacing.xs,
    borderRadius: Radius.full,
  },
  priorityText: {
    fontFamily: 'Inter-SemiBold',
    fontSize: FontSize.xs,
  },
  needDesc: {
    fontFamily: 'Inter-Regular',
    fontSize: FontSize.sm,
    color: Colors.textSecondary,
    marginBottom: Spacing.sm,
    lineHeight: 19,
  },
  dollarLabel: {
    fontFamily: 'Inter-SemiBold',
    fontSize: FontSize.sm,
    color: Colors.primary,
    marginBottom: Spacing.sm,
  },
  tokenRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.xs,
    marginBottom: Spacing.md,
  },
  tokenText: {
    fontFamily: 'Inter-Regular',
    fontSize: FontSize.sm,
    color: Colors.amber,
  },

  /* Progress */
  progressSection: {
    marginBottom: Spacing.md,
  },
  progressBarBg: {
    height: 8,
    borderRadius: Radius.full,
    backgroundColor: Colors.stone200,
    overflow: 'hidden',
    marginBottom: Spacing.xs,
  },
  progressBarFill: {
    height: 8,
    borderRadius: Radius.full,
    backgroundColor: Colors.primary,
  },
  progressLabelRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  progressText: {
    fontFamily: 'Inter-Regular',
    fontSize: FontSize.xs,
    color: Colors.textMuted,
  },
  progressPct: {
    fontFamily: 'Inter-SemiBold',
    fontSize: FontSize.xs,
    color: Colors.textMuted,
  },
  dollarProgress: {
    fontFamily: 'Inter-Regular',
    fontSize: FontSize.xs,
    color: Colors.primary,
    marginTop: 2,
  },

  /* Actions */
  actionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    marginBottom: Spacing.sm,
  },
  donateBtn: {
    backgroundColor: Colors.primary,
    paddingHorizontal: Spacing.xl,
    paddingVertical: Spacing.md,
    borderRadius: Radius.md,
    minHeight: 44,
    justifyContent: 'center',
  },
  donateBtnText: {
    fontFamily: 'Inter-SemiBold',
    fontSize: FontSize.md,
    color: Colors.white,
  },
  fullyPledgedBadge: {
    backgroundColor: Colors.stone200,
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.md,
    borderRadius: Radius.md,
    minHeight: 44,
    justifyContent: 'center',
  },
  fullyPledgedText: {
    fontFamily: 'Inter-SemiBold',
    fontSize: FontSize.sm,
    color: Colors.textMuted,
  },
  linkBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.xs,
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.md,
    borderRadius: Radius.md,
    borderWidth: 1,
    borderColor: Colors.primary,
    minHeight: 44,
  },
  linkBtnText: {
    fontFamily: 'Inter-SemiBold',
    fontSize: FontSize.sm,
    color: Colors.primary,
  },
  tokenNote: {
    fontFamily: 'Inter-Regular',
    fontSize: FontSize.xs,
    color: Colors.textMuted,
    fontStyle: 'italic',
  },

  /* Empty */
  emptyState: {
    paddingVertical: Spacing.huge,
    alignItems: 'center',
  },
  emptyText: {
    fontFamily: 'Inter-Regular',
    fontSize: FontSize.md,
    color: Colors.textMuted,
  },
});
