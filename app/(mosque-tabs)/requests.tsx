import React, { useEffect, useState, useCallback } from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  ActivityIndicator,
  TouchableOpacity,
  Modal,
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import {
  MessageSquare,
  CheckCircle2,
  XCircle,
  Archive,
  ArchiveRestore,
  MailOpen,
  X,
  CircleDot,
} from 'lucide-react-native';
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
  read_at: string | null;
  created_at: string;
  archived: boolean;
}

type ActionType = 'read' | 'accept' | 'decline' | 'archive';

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
  const [confirmType, setConfirmType] = useState<ActionType | null>(null);

  const fetchRequests = useCallback(async () => {
    if (isAdmin) {
      setRequests([
        { id: '1', title: 'Quran Classes', description: 'Would love Quran classes for kids on weekends.', donor_name: 'Demo Donor', status: 'active', read_at: null, created_at: new Date().toISOString(), archived: false },
        { id: '2', title: 'Wheelchair Ramp', description: 'Accessibility ramp needed at the main entrance.', donor_name: 'Demo Donor 2', status: 'active', read_at: new Date().toISOString(), created_at: new Date().toISOString(), archived: false },
      ]);
      setLoading(false);
      return;
    }
    if (!mosqueId) { setLoading(false); return; }
    try {
      const { data, error } = await supabase
        .from('donor_requests')
        .select('id, title, description, donor_id, status, read_at, archived, created_at')
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
          read_at: r.read_at ?? null,
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

  const unreadCount = requests.filter((r) => !r.archived && r.read_at === null).length;

  const handleAction = (item: RequestItem, type: ActionType) => {
    setConfirmTarget(item);
    setConfirmType(type);
    setActionError(null);
  };

  const confirmActionFn = async () => {
    if (!confirmTarget || !confirmType) return;
    setActionLoading(true);
    setActionError(null);
    try {
      const now = new Date().toISOString();
      let updateData: Record<string, unknown> = { updated_at: now };

      if (confirmType === 'read') {
        updateData.read_at = now;
      } else if (confirmType === 'accept') {
        updateData.status = 'accepted';
        updateData.read_at = confirmTarget.read_at ?? now;
      } else if (confirmType === 'decline') {
        updateData.status = 'declined';
        updateData.read_at = confirmTarget.read_at ?? now;
      } else if (confirmType === 'archive') {
        const newArchived = !confirmTarget.archived;
        updateData.archived = newArchived;
        updateData.archived_at = newArchived ? now : null;
      }

      const { error } = await supabase
        .from('donor_requests')
        .update(updateData)
        .eq('id', confirmTarget.id);
      if (error) throw error;

      setRequests((prev) => prev.map((r) =>
        r.id === confirmTarget.id ? { ...r, ...updateData } as RequestItem : r
      ));
      setConfirmTarget(null);
      setConfirmType(null);
    } catch (e: any) {
      setActionError(e.message || 'Something went wrong.');
    } finally {
      setActionLoading(false);
    }
  };

  const visibleRequests = requests.filter((r) => showArchived ? r.archived : !r.archived);

  const getStatusBadge = (item: RequestItem) => {
    if (item.status === 'accepted') {
      return (
        <View style={styles.statusBadgeAccepted}>
          <CheckCircle2 size={12} color={Colors.primary} />
          <Text style={styles.statusTextAccepted}>Accepted</Text>
        </View>
      );
    }
    if (item.status === 'declined') {
      return (
        <View style={styles.statusBadgeDeclined}>
          <XCircle size={12} color={Colors.red} />
          <Text style={styles.statusTextDeclined}>Declined</Text>
        </View>
      );
    }
    if (item.read_at !== null) {
      return (
        <View style={styles.statusBadgeRead}>
          <MailOpen size={12} color={colors.textMuted} />
          <Text style={styles.statusTextRead}>Read</Text>
        </View>
      );
    }
    return (
      <View style={styles.statusBadgeUnread}>
        <CircleDot size={12} color={Colors.red} />
        <Text style={styles.statusTextUnread}>New</Text>
      </View>
    );
  };

  const getActionLabel = () => {
    if (!confirmType) return '';
    if (confirmType === 'read') return confirmTarget?.read_at ? null : 'Mark as Read';
    if (confirmType === 'accept') return confirmTarget?.status === 'accepted' ? 'Unmark Accepted' : 'Accept Suggestion';
    if (confirmType === 'decline') return confirmTarget?.status === 'declined' ? 'Unmark Declined' : 'Decline Suggestion';
    if (confirmType === 'archive') return confirmTarget?.archived ? 'Restore' : 'Archive';
    return '';
  };

  const actionLabel = getActionLabel();

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: colors.background }]} edges={['top']}>
      <View style={styles.header}>
        <View style={{ flex: 1 }}>
          <Text style={[styles.headerTitle, { color: colors.textPrimary }]}>Suggestions</Text>
          {unreadCount > 0 && (
            <View style={styles.unreadPill}>
              <CircleDot size={11} color={Colors.red} />
              <Text style={styles.unreadPillText}>{unreadCount} unread</Text>
            </View>
          )}
        </View>
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
      ) : visibleRequests.length === 0 ? (
        <View style={styles.centered}>
          <MessageSquare size={48} color={Colors.stone300} />
          <Text style={[styles.emptyTitle, { color: colors.textSecondary }]}>
            {showArchived ? 'No Archived Suggestions' : 'No Suggestions Yet'}
          </Text>
          <Text style={[styles.emptySubtitle, { color: colors.textMuted }]}>
            {showArchived
              ? 'Archived suggestions will appear here.'
              : 'Donors can submit suggestions for things the mosque may need.'}
          </Text>
        </View>
      ) : (
        <ScrollView contentContainerStyle={styles.list}>
          {visibleRequests.map((r) => {
            const isUnread = r.read_at === null;
            return (
              <View
                key={r.id}
                style={[
                  styles.requestCard,
                  { backgroundColor: colors.cardBg, borderColor: isUnread ? Colors.teal : colors.cardBorder },
                  isUnread && styles.unreadCard,
                ]}
              >
                <View style={styles.cardHeaderRow}>
                  <Text style={[styles.requestTitle, { color: colors.textPrimary, flex: 1 }]}>{r.title}</Text>
                  {getStatusBadge(r)}
                </View>
                {r.description && <Text style={[styles.requestDesc, { color: colors.textSecondary }]}>{r.description}</Text>}
                <View style={styles.requestMeta}>
                  <Text style={[styles.requestDonor, { color: colors.textMuted }]}>From: {r.donor_name}</Text>
                  <Text style={[styles.requestDate, { color: colors.stone400 }]}>{new Date(r.created_at).toLocaleDateString()}</Text>
                </View>
                {!showArchived && (
                  <View style={styles.cardActions}>
                    {isUnread && (
                      <TouchableOpacity
                        style={styles.readBtn}
                        activeOpacity={0.7}
                        onPress={() => handleAction(r, 'read')}
                      >
                        <MailOpen size={14} color={colors.textMuted} />
                        <Text style={styles.readBtnText}>Mark Read</Text>
                      </TouchableOpacity>
                    )}
                    {r.status !== 'accepted' ? (
                      <TouchableOpacity
                        style={styles.acceptBtn}
                        activeOpacity={0.7}
                        onPress={() => handleAction(r, 'accept')}
                      >
                        <CheckCircle2 size={14} color={Colors.primary} />
                        <Text style={styles.acceptBtnText}>Accept</Text>
                      </TouchableOpacity>
                    ) : null}
                    {r.status !== 'declined' ? (
                      <TouchableOpacity
                        style={styles.declineBtn}
                        activeOpacity={0.7}
                        onPress={() => handleAction(r, 'decline')}
                      >
                        <XCircle size={14} color={Colors.red} />
                        <Text style={styles.declineBtnText}>Decline</Text>
                      </TouchableOpacity>
                    ) : null}
                    <TouchableOpacity
                      style={styles.archiveBtn}
                      activeOpacity={0.7}
                      onPress={() => handleAction(r, 'archive')}
                    >
                      {r.archived ? <ArchiveRestore size={14} color={colors.textMuted} /> : <Archive size={14} color={colors.textMuted} />}
                      <Text style={styles.archiveBtnText}>{r.archived ? 'Restore' : 'Archive'}</Text>
                    </TouchableOpacity>
                  </View>
                )}
              </View>
            );
          })}
        </ScrollView>
      )}

      {/* Action Confirmation Modal */}
      <Modal visible={confirmTarget !== null} transparent animationType="fade">
        <View style={styles.overlay}>
          <TouchableOpacity style={[styles.backdrop, { backgroundColor: colors.modalOverlay }]} activeOpacity={1} onPress={() => { setConfirmTarget(null); setConfirmType(null); }} />
          <View style={[styles.confirmCard, { backgroundColor: colors.cardBg }]}>
            <TouchableOpacity style={styles.modalCloseBtn} onPress={() => { setConfirmTarget(null); setConfirmType(null); }}>
              <X size={20} color={colors.textSecondary} />
            </TouchableOpacity>
            <Text style={[styles.confirmTitle, { color: colors.textPrimary }]}>
              {confirmType === 'read' && 'Mark as Read'}
              {confirmType === 'accept' && (confirmTarget?.status === 'accepted' ? 'Unmark Accepted' : 'Accept Suggestion')}
              {confirmType === 'decline' && (confirmTarget?.status === 'declined' ? 'Unmark Declined' : 'Decline Suggestion')}
              {confirmType === 'archive' && (confirmTarget?.archived ? 'Restore Suggestion' : 'Archive Suggestion')}
            </Text>
            <Text style={[styles.confirmMessage, { color: colors.textSecondary }]}>
              {confirmType === 'read' && `Mark "${confirmTarget?.title}" as read? It will stay in your history.`}
              {confirmType === 'accept' && confirmTarget?.status !== 'accepted' && `Accept "${confirmTarget?.title}"? The donor will be able to see it was accepted.`}
              {confirmType === 'accept' && confirmTarget?.status === 'accepted' && `Reset "${confirmTarget?.title}" back to active?`}
              {confirmType === 'decline' && confirmTarget?.status !== 'declined' && `Decline "${confirmTarget?.title}"? The donor will be able to see it was declined.`}
              {confirmType === 'decline' && confirmTarget?.status === 'declined' && `Reset "${confirmTarget?.title}" back to active?`}
              {confirmType === 'archive' && !confirmTarget?.archived && `Archive "${confirmTarget?.title}"? It will be hidden from your active list but can be restored.`}
              {confirmType === 'archive' && confirmTarget?.archived && `Restore "${confirmTarget?.title}" to your active list?`}
            </Text>
            {actionError ? <Text style={styles.actionErrorText}>{actionError}</Text> : null}
            <View style={styles.confirmButtons}>
              <TouchableOpacity style={styles.cancelButton} onPress={() => { setConfirmTarget(null); setConfirmType(null); }} activeOpacity={0.7}>
                <Text style={styles.cancelButtonText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[
                  styles.actionConfirmButton,
                  actionLoading && { opacity: 0.7 },
                  confirmType === 'decline' && { backgroundColor: Colors.red },
                  confirmType === 'accept' && { backgroundColor: Colors.primary },
                ]}
                onPress={confirmActionFn}
                activeOpacity={0.7}
                disabled={actionLoading}
              >
                {actionLoading ? (
                  <ActivityIndicator size="small" color={Colors.white} />
                ) : (
                  <Text style={styles.confirmBtnText}>{actionLabel}</Text>
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
  header: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: Spacing.lg, paddingVertical: Spacing.lg, gap: Spacing.md,
  },
  headerTitle: { fontFamily: 'Inter-Bold', fontSize: FontSize.xxl, color: Colors.textPrimary },
  unreadPill: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    marginTop: Spacing.xs,
  },
  unreadPillText: { fontFamily: 'Inter-SemiBold', fontSize: FontSize.xs, color: Colors.red },
  archiveToggle: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    paddingHorizontal: Spacing.md, paddingVertical: Spacing.sm,
    borderRadius: Radius.md, borderWidth: 1.5, minHeight: 40, justifyContent: 'center',
  },
  archiveToggleText: { fontFamily: 'Inter-SemiBold', fontSize: FontSize.xs },
  centered: { flex: 1, justifyContent: 'center', alignItems: 'center', paddingHorizontal: Spacing.xxl },
  emptyTitle: { fontFamily: 'Inter-SemiBold', fontSize: FontSize.lg, color: Colors.textSecondary, marginTop: Spacing.lg },
  emptySubtitle: { fontFamily: 'Inter-Regular', fontSize: FontSize.sm, color: Colors.textMuted, textAlign: 'center', marginTop: Spacing.sm, lineHeight: 20 },
  list: { paddingHorizontal: Spacing.lg, paddingBottom: Spacing.huge },
  requestCard: {
    backgroundColor: Colors.cardBg, borderRadius: Radius.lg, padding: Spacing.lg,
    marginBottom: Spacing.sm, borderWidth: 1, borderColor: Colors.cardBorder,
  },
  unreadCard: {
    ...Platform.select({
      ios: { shadowColor: Colors.teal, shadowOffset: { width: 0, height: 0 }, shadowOpacity: 0.08, shadowRadius: 6 },
      android: { elevation: 1 },
    }),
  },
  cardHeaderRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: Spacing.sm, marginBottom: Spacing.xs },
  requestTitle: { fontFamily: 'Inter-SemiBold', fontSize: FontSize.md, color: Colors.textPrimary },
  requestDesc: { fontFamily: 'Inter-Regular', fontSize: FontSize.sm, color: Colors.textSecondary, lineHeight: 20, marginBottom: Spacing.md },
  requestMeta: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  requestDonor: { fontFamily: 'Inter-Regular', fontSize: FontSize.xs, color: Colors.textMuted },
  requestDate: { fontFamily: 'Inter-Regular', fontSize: FontSize.xs, color: Colors.stone400 },

  // Status badges
  statusBadgeUnread: { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: Colors.redFaint, paddingHorizontal: Spacing.sm, paddingVertical: 3, borderRadius: Radius.full },
  statusTextUnread: { fontFamily: 'Inter-SemiBold', fontSize: FontSize.xs, color: Colors.red },
  statusBadgeRead: { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: Colors.stone100, paddingHorizontal: Spacing.sm, paddingVertical: 3, borderRadius: Radius.full },
  statusTextRead: { fontFamily: 'Inter-SemiBold', fontSize: FontSize.xs, color: Colors.stone500 },
  statusBadgeAccepted: { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: Colors.primaryFaint, paddingHorizontal: Spacing.sm, paddingVertical: 3, borderRadius: Radius.full },
  statusTextAccepted: { fontFamily: 'Inter-SemiBold', fontSize: FontSize.xs, color: Colors.primary },
  statusBadgeDeclined: { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: Colors.redFaint, paddingHorizontal: Spacing.sm, paddingVertical: 3, borderRadius: Radius.full },
  statusTextDeclined: { fontFamily: 'Inter-SemiBold', fontSize: FontSize.xs, color: Colors.red },

  // Actions
  cardActions: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.sm, marginTop: Spacing.md, paddingTop: Spacing.md, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: Colors.stone200 },
  readBtn: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingVertical: Spacing.sm, paddingHorizontal: Spacing.md, backgroundColor: Colors.stone100, borderRadius: Radius.sm, minHeight: 40 },
  readBtnText: { fontFamily: 'Inter-SemiBold', fontSize: FontSize.sm, color: Colors.stone600 },
  acceptBtn: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingVertical: Spacing.sm, paddingHorizontal: Spacing.md, backgroundColor: Colors.primaryFaint, borderRadius: Radius.sm, minHeight: 40 },
  acceptBtnText: { fontFamily: 'Inter-SemiBold', fontSize: FontSize.sm, color: Colors.primary },
  declineBtn: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingVertical: Spacing.sm, paddingHorizontal: Spacing.md, backgroundColor: Colors.redFaint, borderRadius: Radius.sm, minHeight: 40 },
  declineBtnText: { fontFamily: 'Inter-SemiBold', fontSize: FontSize.sm, color: Colors.red },
  archiveBtn: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingVertical: Spacing.sm, paddingHorizontal: Spacing.md, backgroundColor: Colors.stone100, borderRadius: Radius.sm, minHeight: 40 },
  archiveBtnText: { fontFamily: 'Inter-SemiBold', fontSize: FontSize.sm, color: Colors.stone600 },

  // Modal
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
