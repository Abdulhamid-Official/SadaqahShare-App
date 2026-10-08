import React, { useEffect, useState, useCallback } from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  ActivityIndicator,
  TouchableOpacity,
  Modal,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ArrowLeft, MessageSquare, CheckCircle, Archive, ArchiveRestore, X } from 'lucide-react-native';
import { router } from 'expo-router';
import { supabase } from '@/lib/supabase';
import { useAppContext } from '@/lib/context';
import { Colors, Spacing, Radius, FontSize, useTheme } from '@/lib/theme';
import { useRealtimeTable } from '@/hooks/useRealtimeTable';

interface RequestItem {
  id: string;
  title: string;
  description: string | null;
  donor_name: string;
  status: string;
  created_at: string;
  archived: boolean;
}

export default function RequestsScreen() {
  const { mosqueAccount, isAdmin } = useAppContext();
  const mosqueId = mosqueAccount?.mosque_id;
  const { colors } = useTheme();

  const [requests, setRequests] = useState<RequestItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [showArchived, setShowArchived] = useState(false);
  const [actionLoading, setActionLoading] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);
  const [confirmTarget, setConfirmTarget] = useState<RequestItem | null>(null);
  const [confirmActionType, setConfirmActionType] = useState<'reviewed' | 'archive' | null>(null);

  const fetchRequests = useCallback(async () => {
    if (isAdmin) {
      setRequests([
        { id: '1', title: 'Quran Classes', description: 'Would love Quran classes for kids on weekends.', donor_name: 'Demo Donor', status: 'active', created_at: new Date().toISOString(), archived: false },
        { id: '2', title: 'Wheelchair Ramp', description: 'Accessibility ramp needed at the main entrance.', donor_name: 'Demo Donor 2', status: 'active', created_at: new Date().toISOString(), archived: false },
      ]);
      setLoading(false);
      return;
    }
    if (!mosqueId) { setLoading(false); return; }
    try {
      const { data, error } = await supabase
        .from('donor_requests')
        .select('id, title, description, donor_id, status, archived, created_at')
        .eq('mosque_id', mosqueId)
        .order('created_at', { ascending: false });
      if (error) throw error;

      const enriched: RequestItem[] = [];
      for (const r of data || []) {
        const { data: donor } = await supabase
          .from('donors')
          .select('name')
          .eq('id', r.donor_id)
          .maybeSingle();
        enriched.push({
          id: r.id,
          title: r.title,
          description: r.description,
          donor_name: donor?.name || 'Anonymous',
          status: r.status ?? 'active',
          created_at: r.created_at,
          archived: r.archived ?? false,
        });
      }
      setRequests(enriched);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, [mosqueId, isAdmin]);

  useEffect(() => { fetchRequests(); }, [fetchRequests]);

  useRealtimeTable('donor_requests', mosqueId ? `mosque_id=eq.${mosqueId}` : null, fetchRequests, !!mosqueId && !isAdmin);

  const handleMarkReviewed = (item: RequestItem) => {
    setConfirmTarget(item);
    setConfirmActionType('reviewed');
    setActionError(null);
  };

  const handleArchive = (item: RequestItem) => {
    setConfirmTarget(item);
    setConfirmActionType('archive');
    setActionError(null);
  };

  const confirmActionFn = async () => {
    if (!confirmTarget || !confirmActionType) return;
    setActionLoading(true);
    setActionError(null);
    try {
      if (confirmActionType === 'reviewed') {
        const newStatus = confirmTarget.status === 'reviewed' ? 'active' : 'reviewed';
        const { error } = await supabase
          .from('donor_requests')
          .update({ status: newStatus, updated_at: new Date().toISOString() })
          .eq('id', confirmTarget.id);
        if (error) throw error;
        setRequests((prev) => prev.map((r) => r.id === confirmTarget.id ? { ...r, status: newStatus } : r));
      } else if (confirmActionType === 'archive') {
        const newArchived = !confirmTarget.archived;
        const { error } = await supabase
          .from('donor_requests')
          .update({
            archived: newArchived,
            archived_at: newArchived ? new Date().toISOString() : null,
            updated_at: new Date().toISOString(),
          })
          .eq('id', confirmTarget.id);
        if (error) throw error;
        setRequests((prev) => prev.map((r) => r.id === confirmTarget.id ? { ...r, archived: newArchived } : r));
      }
      setConfirmTarget(null);
      setConfirmActionType(null);
    } catch (e: any) {
      setActionError(e.message || 'Something went wrong.');
    } finally {
      setActionLoading(false);
    }
  };

  const visibleRequests = requests.filter((r) => showArchived ? r.archived : !r.archived);

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: colors.background }]} edges={['top']}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <ArrowLeft size={22} color={colors.stone600} />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: colors.textPrimary }]}>Donor Requests</Text>
        <TouchableOpacity
          style={[styles.archiveToggle, { borderColor: showArchived ? Colors.teal : 'transparent' }]}
          activeOpacity={0.7}
          onPress={() => setShowArchived(!showArchived)}
        >
          {showArchived ? <ArchiveRestore size={14} color={Colors.teal} /> : <Archive size={14} color={colors.textMuted} />}
          <Text style={[styles.archiveToggleText, { color: showArchived ? Colors.teal : colors.textMuted }]}>
            {showArchived ? 'Archived' : 'Archive'}
          </Text>
        </TouchableOpacity>
      </View>

      {loading ? (
        <View style={styles.centered}><ActivityIndicator size="large" color={Colors.teal} /></View>
      ) : requests.length === 0 ? (
        <View style={styles.centered}>
          <MessageSquare size={48} color={Colors.stone300} />
          <Text style={[styles.emptyTitle, { color: colors.textSecondary }]}>No Requests Yet</Text>
          <Text style={[styles.emptySubtitle, { color: colors.textMuted }]}>Donors can submit requests for things they'd like the mosque to provide.</Text>
        </View>
      ) : (
        <ScrollView contentContainerStyle={styles.list}>
          {visibleRequests.map((r) => (
            <View key={r.id} style={[styles.requestCard, { backgroundColor: colors.cardBg, borderColor: colors.cardBorder }]}>
              <View style={styles.cardHeaderRow}>
                <Text style={[styles.requestTitle, { color: colors.textPrimary, flex: 1 }]}>{r.title}</Text>
                {r.status === 'reviewed' && (
                  <View style={styles.reviewedBadge}>
                    <CheckCircle size={12} color={Colors.primary} />
                    <Text style={styles.reviewedText}>Reviewed</Text>
                  </View>
                )}
              </View>
              {r.description && <Text style={[styles.requestDesc, { color: colors.textSecondary }]}>{r.description}</Text>}
              <View style={styles.requestMeta}>
                <Text style={[styles.requestDonor, { color: colors.textMuted }]}>From: {r.donor_name}</Text>
                <Text style={[styles.requestDate, { color: colors.stone400 }]}>{new Date(r.created_at).toLocaleDateString()}</Text>
              </View>
              <View style={styles.cardActions}>
                <TouchableOpacity
                  style={[styles.reviewBtn, r.status === 'reviewed' && { backgroundColor: Colors.primaryFaint }]}
                  activeOpacity={0.7}
                  onPress={() => handleMarkReviewed(r)}
                >
                  <CheckCircle size={14} color={r.status === 'reviewed' ? Colors.primary : colors.textMuted} />
                  <Text style={[styles.reviewBtnText, { color: r.status === 'reviewed' ? Colors.primary : colors.textMuted }]}>
                    {r.status === 'reviewed' ? 'Reviewed' : 'Mark Reviewed'}
                  </Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={styles.archiveBtn}
                  activeOpacity={0.7}
                  onPress={() => handleArchive(r)}
                >
                  {r.archived ? <ArchiveRestore size={14} color={colors.textMuted} /> : <Archive size={14} color={colors.textMuted} />}
                  <Text style={styles.archiveBtnText}>{r.archived ? 'Restore' : 'Archive'}</Text>
                </TouchableOpacity>
              </View>
            </View>
          ))}
        </ScrollView>
      )}

      {/* Action Confirmation Modal */}
      <Modal visible={confirmTarget !== null} transparent animationType="fade">
        <View style={styles.overlay}>
          <TouchableOpacity style={[styles.backdrop, { backgroundColor: colors.modalOverlay }]} activeOpacity={1} onPress={() => { setConfirmTarget(null); setConfirmActionType(null); }} />
          <View style={[styles.confirmCard, { backgroundColor: colors.cardBg }]}>
            <TouchableOpacity style={styles.modalCloseBtn} onPress={() => { setConfirmTarget(null); setConfirmActionType(null); }}>
              <X size={20} color={colors.textSecondary} />
            </TouchableOpacity>
            <Text style={[styles.confirmTitle, { color: colors.textPrimary }]}>
              {confirmActionType === 'reviewed'
                ? (confirmTarget?.status === 'reviewed' ? 'Mark as Active' : 'Mark as Reviewed')
                : (confirmTarget?.archived ? 'Restore Request' : 'Archive Request')}
            </Text>
            <Text style={[styles.confirmMessage, { color: colors.textSecondary }]}>
              {confirmActionType === 'reviewed'
                ? `Mark "${confirmTarget?.title}" as ${confirmTarget?.status === 'reviewed' ? 'active' : 'reviewed'}?`
                : (confirmTarget?.archived
                  ? `Restore "${confirmTarget?.title}" to active status?`
                  : `Archive "${confirmTarget?.title}"? It can be restored later.`)}
            </Text>
            {actionError ? <Text style={styles.actionErrorText}>{actionError}</Text> : null}
            <View style={styles.confirmButtons}>
              <TouchableOpacity style={styles.cancelButton} onPress={() => { setConfirmTarget(null); setConfirmActionType(null); }} activeOpacity={0.7}>
                <Text style={styles.cancelButtonText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.actionConfirmButton, actionLoading && { opacity: 0.7 }]}
                onPress={confirmActionFn}
                activeOpacity={0.7}
                disabled={actionLoading}
              >
                {actionLoading ? (
                  <ActivityIndicator size="small" color={Colors.white} />
                ) : (
                  <Text style={styles.confirmBtnText}>
                    {confirmActionType === 'reviewed'
                      ? (confirmTarget?.status === 'reviewed' ? 'Mark Active' : 'Mark Reviewed')
                      : (confirmTarget?.archived ? 'Restore' : 'Archive')}
                  </Text>
                )}
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
  header: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: Spacing.lg, paddingVertical: Spacing.lg, gap: Spacing.md },
  archiveToggle: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    paddingHorizontal: Spacing.md, paddingVertical: Spacing.sm,
    borderRadius: Radius.md, borderWidth: 1.5, minHeight: 40, justifyContent: 'center',
    marginLeft: 'auto',
  },
  archiveToggleText: { fontFamily: 'Inter-SemiBold', fontSize: FontSize.xs },
  backBtn: { width: 44, height: 44, justifyContent: 'center', alignItems: 'center' },
  headerTitle: { fontFamily: 'Inter-Bold', fontSize: FontSize.xxl, color: Colors.textPrimary },
  centered: { flex: 1, justifyContent: 'center', alignItems: 'center', paddingHorizontal: Spacing.xxl },
  emptyTitle: { fontFamily: 'Inter-SemiBold', fontSize: FontSize.lg, color: Colors.textSecondary, marginTop: Spacing.lg },
  emptySubtitle: { fontFamily: 'Inter-Regular', fontSize: FontSize.sm, color: Colors.textMuted, textAlign: 'center', marginTop: Spacing.sm, lineHeight: 20 },
  list: { paddingHorizontal: Spacing.lg, paddingBottom: Spacing.huge },
  requestCard: {
    backgroundColor: Colors.cardBg, borderRadius: Radius.lg, padding: Spacing.lg,
    marginBottom: Spacing.sm, borderWidth: 1, borderColor: Colors.cardBorder,
  },
  requestTitle: { fontFamily: 'Inter-SemiBold', fontSize: FontSize.md, color: Colors.textPrimary, marginBottom: Spacing.xs },
  requestDesc: { fontFamily: 'Inter-Regular', fontSize: FontSize.sm, color: Colors.textSecondary, lineHeight: 20, marginBottom: Spacing.md },
  requestMeta: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  requestDonor: { fontFamily: 'Inter-Regular', fontSize: FontSize.xs, color: Colors.textMuted },
  requestDate: { fontFamily: 'Inter-Regular', fontSize: FontSize.xs, color: Colors.stone400 },
  cardHeaderRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: Spacing.sm, marginBottom: Spacing.xs },
  reviewedBadge: { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: Colors.primaryFaint, paddingHorizontal: Spacing.sm, paddingVertical: 3, borderRadius: Radius.full },
  reviewedText: { fontFamily: 'Inter-SemiBold', fontSize: FontSize.xs, color: Colors.primary },
  cardActions: { flexDirection: 'row', gap: Spacing.sm, marginTop: Spacing.md, paddingTop: Spacing.md, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: Colors.stone200 },
  reviewBtn: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingVertical: Spacing.sm, paddingHorizontal: Spacing.md, backgroundColor: Colors.stone100, borderRadius: Radius.sm, minHeight: 40 },
  reviewBtnText: { fontFamily: 'Inter-SemiBold', fontSize: FontSize.sm },
  archiveBtn: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingVertical: Spacing.sm, paddingHorizontal: Spacing.md, backgroundColor: Colors.stone100, borderRadius: Radius.sm, minHeight: 40 },
  archiveBtnText: { fontFamily: 'Inter-SemiBold', fontSize: FontSize.sm, color: Colors.stone600 },
  overlay: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  backdrop: { ...StyleSheet.absoluteFill, backgroundColor: 'rgba(0,0,0,0.5)' },
  confirmCard: { backgroundColor: Colors.white, borderRadius: Radius.xl, padding: Spacing.xxl, width: '92%', maxWidth: 400 },
  modalCloseBtn: { position: 'absolute', top: Spacing.md, right: Spacing.md, width: 36, height: 36, borderRadius: 18, backgroundColor: Colors.stone100, justifyContent: 'center', alignItems: 'center' },
  confirmTitle: { fontFamily: 'Inter-Bold', fontSize: FontSize.xl, marginBottom: Spacing.sm },
  confirmMessage: { fontFamily: 'Inter-Regular', fontSize: FontSize.md, lineHeight: 22, marginBottom: Spacing.lg },
  actionErrorText: { fontFamily: 'Inter-Regular', fontSize: FontSize.sm, color: Colors.red, marginBottom: Spacing.md, textAlign: 'center' },
  confirmButtons: { flexDirection: 'row', gap: Spacing.md },
  cancelButton: { flex: 1, backgroundColor: Colors.stone100, borderRadius: Radius.md, paddingVertical: Spacing.lg, alignItems: 'center', justifyContent: 'center', minHeight: 48 },
  cancelButtonText: { fontFamily: 'Inter-SemiBold', fontSize: FontSize.md, color: Colors.textSecondary },
  actionConfirmButton: { flex: 1, backgroundColor: Colors.teal, borderRadius: Radius.md, paddingVertical: Spacing.lg, alignItems: 'center', justifyContent: 'center', minHeight: 48 },
  confirmBtnText: { fontFamily: 'Inter-Bold', fontSize: FontSize.md, color: Colors.white },
});
