import React, { useEffect, useState, useCallback } from 'react';
import {
  View,
  Text,
  FlatList,
  StyleSheet,
  ActivityIndicator,
  RefreshControl,
  Platform,
  TouchableOpacity,
  Modal,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import {
  Heart,
  Coins,
  MapPin,
  Mail,
  Clock,
  CheckCircle,
  X,
} from 'lucide-react-native';
import { supabase } from '@/lib/supabase';
import { useAppContext } from '@/lib/context';
import { Colors, Spacing, Radius, FontSize, useTheme } from '@/lib/theme';
import { useContentWidth } from '@/lib/responsive';
import { Pledge, Need } from '@/lib/types';

interface PledgeWithNeed extends Pledge {
  needs: Pick<Need, 'name' | 'type' | 'mosque_id'>;
}

export default function PledgesScreen() {
  const { mosqueAccount, isAdmin } = useAppContext();
  const { paddingHorizontal, maxWidth } = useContentWidth();
  const { colors } = useTheme();

  const [pledges, setPledges] = useState<PledgeWithNeed[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [confirmPledge, setConfirmPledge] = useState<PledgeWithNeed | null>(null);
  const [confirming, setConfirming] = useState(false);

  const mosqueId = mosqueAccount?.mosque_id;

  const fetchPledges = useCallback(async () => {
    if (isAdmin) {
      setPledges([
        {
          id: 'p1', need_id: 'n1', donor_id: 'd1', donor_name: 'Demo Donor', donor_email: 'donor@demo.com',
          quantity: 2, delivery_method: 'dropoff', status: 'pending', notes: null, tokens_earned: 20, created_at: new Date().toISOString(),
          needs: { name: 'Prayer Rugs', type: 'item', mosque_id: 'admin-mosque' },
        },
        {
          id: 'p2', need_id: 'n2', donor_id: 'd2', donor_name: 'Demo Donor 2', donor_email: 'donor2@demo.com',
          quantity: 1, delivery_method: 'dropoff', status: 'fulfilled', notes: null, tokens_earned: 15, created_at: new Date().toISOString(),
          needs: { name: 'Books', type: 'item', mosque_id: 'admin-mosque' },
        },
      ]);
      setLoading(false);
      return;
    }
    if (!mosqueId) return;
    try {
      const { data, error } = await supabase
        .from('pledges')
        .select('*, needs!inner(name, type, mosque_id)')
        .eq('needs.mosque_id', mosqueId)
        .order('created_at', { ascending: false });

      if (error) { console.error(error); return; }
      setPledges((data || []) as PledgeWithNeed[]);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [mosqueId, isAdmin]);

  useEffect(() => { fetchPledges(); }, [fetchPledges]);

  const onRefresh = useCallback(() => { setRefreshing(true); fetchPledges(); }, [fetchPledges]);

  const handleConfirmReceipt = async () => {
    if (!confirmPledge) return;
    setConfirming(true);

    try {
      if (isAdmin) {
        setPledges((prev) => prev.map((p) => p.id === confirmPledge.id ? { ...p, status: 'fulfilled' } : p));
        setConfirmPledge(null);
        setConfirming(false);
        return;
      }

      // Update pledge status
      const { error: updateErr } = await supabase
        .from('pledges')
        .update({ status: 'fulfilled' })
        .eq('id', confirmPledge.id);
      if (updateErr) throw updateErr;

      // Award tokens to donor
      const { data: existingToken } = await supabase
        .from('donor_mosque_tokens')
        .select('*')
        .eq('donor_id', confirmPledge.donor_id)
        .eq('mosque_id', mosqueId)
        .maybeSingle();

      if (existingToken) {
        await supabase
          .from('donor_mosque_tokens')
          .update({ token_balance: existingToken.token_balance + confirmPledge.tokens_earned })
          .eq('id', existingToken.id);
      } else {
        await supabase.from('donor_mosque_tokens').insert({
          donor_id: confirmPledge.donor_id,
          mosque_id: mosqueId,
          token_balance: confirmPledge.tokens_earned,
        });
      }

      setPledges((prev) => prev.map((p) => p.id === confirmPledge.id ? { ...p, status: 'fulfilled' } : p));
    } catch (err) {
      console.error(err);
    } finally {
      setConfirming(false);
      setConfirmPledge(null);
    }
  };

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr);
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  };

  const getStatusStyle = (status: string) => {
    switch (status.toLowerCase()) {
      case 'fulfilled':
        return { bg: '#d1fae5', text: '#059669', label: 'Confirmed' };
      case 'cancelled':
        return { bg: Colors.redFaint, text: Colors.red, label: 'Cancelled' };
      default:
        return { bg: Colors.blueFaint, text: Colors.blue, label: 'Pending' };
    }
  };

  const renderPledgeCard = ({ item }: { item: PledgeWithNeed }) => {
    const status = getStatusStyle(item.status);
    const isPending = item.status === 'pending';

    return (
      <View style={[styles.card, { backgroundColor: colors.cardBg, borderColor: colors.cardBorder }]}>
        <View style={styles.cardTop}>
          <View style={styles.donorSection}>
            <Text style={[styles.donorName, { color: colors.textPrimary }]} numberOfLines={1}>{item.donor_name}</Text>
            <View style={styles.emailRow}>
              <Mail size={12} color={Colors.stone400} />
              <Text style={[styles.donorEmail, { color: colors.textMuted }]} numberOfLines={1}>{item.donor_email}</Text>
            </View>
          </View>
          <View style={[styles.statusBadge, { backgroundColor: status.bg }]}>
            <Text style={[styles.statusText, { color: status.text }]}>{status.label}</Text>
          </View>
        </View>

        <View style={[styles.needRow, { backgroundColor: colors.stone50 }]}>
          <Text style={[styles.needLabel, { color: colors.textMuted }]}>Need:</Text>
          <Text style={[styles.needName, { color: colors.textPrimary }]} numberOfLines={1}>{item.needs?.name || 'Unknown'}</Text>
        </View>

        <View style={styles.detailsRow}>
          <View style={styles.detailItem}>
            <Text style={[styles.detailLabel, { color: colors.textMuted }]}>Qty</Text>
            <Text style={[styles.detailValue, { color: colors.textPrimary }]}>{item.quantity}</Text>
          </View>

          {item.delivery_method && (
            <View style={[styles.deliveryBadge, { backgroundColor: '#ccfbf1' }]}>
              <MapPin size={14} color={Colors.teal} />
              <Text style={[styles.deliveryText, { color: Colors.teal }]}>Drop off</Text>
            </View>
          )}

          <View style={styles.tokenBadge}>
            <Coins size={14} color={Colors.amber} />
            <Text style={styles.tokenValue}>{item.tokens_earned}</Text>
          </View>

          <View style={styles.dateItem}>
            <Clock size={12} color={Colors.stone400} />
            <Text style={styles.dateText}>{formatDate(item.created_at)}</Text>
          </View>
        </View>

        {isPending && (
          <TouchableOpacity
            style={styles.confirmBtn}
            onPress={() => setConfirmPledge(item)}
            activeOpacity={0.7}
          >
            <CheckCircle size={18} color={Colors.white} />
            <Text style={styles.confirmBtnText}>Confirm Receipt</Text>
          </TouchableOpacity>
        )}
      </View>
    );
  };

  const renderEmpty = () => (
    <View style={styles.emptyContainer}>
      <Heart size={48} color={Colors.stone300} />
      <Text style={[styles.emptyTitle, { color: colors.textSecondary }]}>No pledges received yet</Text>
      <Text style={[styles.emptySubtitle, { color: colors.textMuted }]}>When donors pledge to your needs, they'll appear here</Text>
    </View>
  );

  if (loading) {
    return (
      <SafeAreaView style={[styles.safe, { backgroundColor: colors.background }]} edges={['top']}>
        <View style={styles.centered}><ActivityIndicator size="large" color={Colors.teal} /></View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: colors.background }]} edges={['top']}>
      <View style={[styles.container, { paddingHorizontal, maxWidth, alignSelf: maxWidth ? 'center' : undefined, width: maxWidth ? '100%' : undefined }]}>
        <Text style={[styles.screenTitle, { color: colors.textPrimary }]}>Pledges</Text>
        <FlatList
          data={pledges}
          keyExtractor={(item) => item.id}
          renderItem={renderPledgeCard}
          ListEmptyComponent={renderEmpty}
          contentContainerStyle={styles.listContent}
          showsVerticalScrollIndicator={false}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={Colors.teal} colors={[Colors.teal]} />}
        />
      </View>

      {/* Confirm Receipt Modal */}
      <Modal visible={confirmPledge !== null} transparent animationType="fade">
        <View style={styles.overlay}>
          <TouchableOpacity style={[styles.backdrop, { backgroundColor: colors.modalOverlay }]} activeOpacity={1} onPress={() => setConfirmPledge(null)} />
          <View style={[styles.confirmCard, { backgroundColor: colors.cardBg }]}>
            <TouchableOpacity style={[styles.closeBtn, { backgroundColor: colors.stone100 }]} onPress={() => setConfirmPledge(null)}>
              <X size={20} color={Colors.textSecondary} />
            </TouchableOpacity>
            <Text style={[styles.confirmTitle, { color: colors.textPrimary }]}>Confirm Receipt</Text>
            <Text style={[styles.confirmMessage, { color: colors.textSecondary }]}>
              Confirm that you received {confirmPledge?.quantity} x {confirmPledge?.needs?.name} from {confirmPledge?.donor_name}?
              {'\n\n'}This will award {confirmPledge?.tokens_earned} tokens to the donor.
            </Text>
            <View style={styles.confirmButtons}>
              <TouchableOpacity style={[styles.cancelButton, { borderColor: colors.stone300 }]} onPress={() => setConfirmPledge(null)}>
                <Text style={[styles.cancelButtonText, { color: colors.textSecondary }]}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.confirmReceiptButton, confirming && { opacity: 0.7 }]}
                onPress={handleConfirmReceipt}
                disabled={confirming}
              >
                <Text style={styles.confirmReceiptText}>{confirming ? 'Confirming...' : 'Confirm'}</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: Colors.background },
  centered: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  container: { flex: 1, paddingTop: Spacing.xxl },
  screenTitle: { fontFamily: 'Inter-Bold', fontSize: FontSize.xxl, color: Colors.textPrimary, marginBottom: Spacing.lg },
  listContent: { paddingBottom: Spacing.huge },
  card: {
    backgroundColor: Colors.cardBg, borderRadius: Radius.lg, padding: Spacing.lg, marginBottom: Spacing.md,
    borderWidth: 1, borderColor: Colors.cardBorder,
    ...Platform.select({
      ios: { shadowColor: Colors.black, shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.04, shadowRadius: 8 },
      android: { elevation: 2 },
    }),
  },
  cardTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: Spacing.md },
  donorSection: { flex: 1, marginRight: Spacing.sm },
  donorName: { fontFamily: 'Inter-SemiBold', fontSize: FontSize.md, color: Colors.textPrimary },
  emailRow: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 2 },
  donorEmail: { fontFamily: 'Inter-Regular', fontSize: FontSize.xs, color: Colors.textMuted, flex: 1 },
  statusBadge: { paddingHorizontal: Spacing.sm, paddingVertical: 3, borderRadius: Radius.full },
  statusText: { fontFamily: 'Inter-SemiBold', fontSize: FontSize.xs, textTransform: 'capitalize' },
  needRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: Spacing.md, backgroundColor: Colors.stone50, padding: Spacing.sm, borderRadius: Radius.sm },
  needLabel: { fontFamily: 'Inter-Regular', fontSize: FontSize.sm, color: Colors.textMuted },
  needName: { fontFamily: 'Inter-SemiBold', fontSize: FontSize.sm, color: Colors.textPrimary, flex: 1 },
  detailsRow: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: Spacing.md },
  detailItem: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  detailLabel: { fontFamily: 'Inter-Regular', fontSize: FontSize.sm, color: Colors.textMuted },
  detailValue: { fontFamily: 'Inter-SemiBold', fontSize: FontSize.sm, color: Colors.textPrimary },
  deliveryBadge: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: Spacing.sm, paddingVertical: 3, borderRadius: Radius.full },
  deliveryText: { fontFamily: 'Inter-SemiBold', fontSize: FontSize.xs },
  tokenBadge: { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: Colors.amberFaint, paddingHorizontal: Spacing.sm, paddingVertical: 3, borderRadius: Radius.full },
  tokenValue: { fontFamily: 'Inter-SemiBold', fontSize: FontSize.xs, color: Colors.amber },
  dateItem: { flexDirection: 'row', alignItems: 'center', gap: 4, marginLeft: 'auto' },
  dateText: { fontFamily: 'Inter-Regular', fontSize: FontSize.xs, color: Colors.stone400 },
  confirmBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: Spacing.sm,
    backgroundColor: Colors.teal, borderRadius: Radius.md, paddingVertical: Spacing.md, marginTop: Spacing.lg, minHeight: 44,
  },
  confirmBtnText: { fontFamily: 'Inter-Bold', fontSize: FontSize.sm, color: Colors.white },
  emptyContainer: { alignItems: 'center', paddingTop: Spacing.huge + 20, paddingHorizontal: Spacing.xxl },
  emptyTitle: { fontFamily: 'Inter-SemiBold', fontSize: FontSize.lg, color: Colors.textSecondary, marginTop: Spacing.lg },
  emptySubtitle: { fontFamily: 'Inter-Regular', fontSize: FontSize.sm, color: Colors.textMuted, marginTop: Spacing.xs, textAlign: 'center', lineHeight: 20 },
  // Confirm modal
  overlay: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  backdrop: { ...StyleSheet.absoluteFill, backgroundColor: 'rgba(0,0,0,0.5)' },
  confirmCard: { backgroundColor: Colors.white, borderRadius: Radius.xl, padding: Spacing.xxl, width: '85%', maxWidth: 380 },
  closeBtn: { position: 'absolute', top: Spacing.md, right: Spacing.md, width: 36, height: 36, borderRadius: 18, backgroundColor: Colors.stone100, justifyContent: 'center', alignItems: 'center' },
  confirmTitle: { fontFamily: 'Inter-Bold', fontSize: FontSize.xl, color: Colors.textPrimary, marginBottom: Spacing.md },
  confirmMessage: { fontFamily: 'Inter-Regular', fontSize: FontSize.sm, color: Colors.textSecondary, lineHeight: 20, marginBottom: Spacing.xxl },
  confirmButtons: { flexDirection: 'row', gap: Spacing.md },
  cancelButton: { flex: 1, paddingVertical: Spacing.md, borderRadius: Radius.md, borderWidth: 1.5, borderColor: Colors.stone300, alignItems: 'center', minHeight: 48, justifyContent: 'center' },
  cancelButtonText: { fontFamily: 'Inter-SemiBold', fontSize: FontSize.sm, color: Colors.textSecondary },
  confirmReceiptButton: { flex: 1, paddingVertical: Spacing.md, borderRadius: Radius.md, backgroundColor: Colors.teal, alignItems: 'center', minHeight: 48, justifyContent: 'center' },
  confirmReceiptText: { fontFamily: 'Inter-Bold', fontSize: FontSize.sm, color: Colors.white },
});
