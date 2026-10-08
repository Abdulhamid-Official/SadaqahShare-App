import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  TextInput,
  Modal,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { MessageSquare, Plus, X, Send, Pencil, Trash2, CheckCircle2, XCircle, MailOpen } from 'lucide-react-native';
import { supabase } from '@/lib/supabase';
import { useAppContext } from '@/lib/context';
import { Colors, Spacing, Radius, FontSize, useTheme } from '@/lib/theme';
import { useRealtimeTable } from '@/hooks/useRealtimeTable';

interface RequestItem {
  id: string;
  title: string;
  description: string | null;
  mosque_name: string;
  mosque_id: string;
  status: string;
  read_at: string | null;
  created_at: string;
  archived: boolean;
}

interface JoinedMosque {
  mosque_id: string;
  mosque_name: string;
}

export default function DonorRequestsScreen() {
  const { donor, isAdmin } = useAppContext();
  const { colors } = useTheme();

  const [requests, setRequests] = useState<RequestItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [mosques, setMosques] = useState<JoinedMosque[]>([]);
  const [selectedMosque, setSelectedMosque] = useState<string | null>(null);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [editId, setEditId] = useState<string | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<RequestItem | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  const fetchRequests = useCallback(async () => {
    if (isAdmin) {
      setRequests([
        { id: '1', title: 'Quran Study Circle', description: 'Weekly group sessions.', mosque_name: 'Demo Mosque', mosque_id: 'admin-mosque', status: 'active', read_at: null, created_at: new Date().toISOString(), archived: false },
      ]);
      setMosques([{ mosque_id: 'admin-mosque', mosque_name: 'Demo Mosque (Admin)' }]);
      setLoading(false);
      return;
    }
    if (!donor) { setLoading(false); return; }
    try {
      // Fetch joined mosques
      const { data: memberships } = await supabase
        .from('mosque_members')
        .select('mosque_id')
        .eq('donor_id', donor.id);

      const mosqueIds = (memberships || []).map((m) => m.mosque_id);
      if (mosqueIds.length > 0) {
        const { data: mosqueData } = await supabase
          .from('mosques')
          .select('id, name')
          .in('id', mosqueIds);
        setMosques((mosqueData || []).map((m) => ({ mosque_id: m.id, mosque_name: m.name })));
      }

      // Fetch requests
      const { data, error: fetchErr } = await supabase
        .from('donor_requests')
        .select('id, title, description, mosque_id, status, read_at, archived, created_at')
        .eq('donor_id', donor.id)
        .order('created_at', { ascending: false });
      if (fetchErr) throw fetchErr;

      const enriched: RequestItem[] = [];
      for (const r of data || []) {
        const { data: mosque } = await supabase
          .from('mosques')
          .select('name')
          .eq('id', r.mosque_id)
          .maybeSingle();
        enriched.push({
          id: r.id,
          title: r.title,
          description: r.description,
          mosque_name: mosque?.name || 'Unknown',
          mosque_id: r.mosque_id,
          status: r.status ?? 'active',
          read_at: r.read_at ?? null,
          created_at: r.created_at,
          archived: r.archived ?? false,
        });
      }
      setRequests(enriched.filter((r) => !r.archived));
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, [donor, isAdmin]);

  useEffect(() => { fetchRequests(); }, [fetchRequests]);
  useRealtimeTable("donor_requests", donor ? "donor_id=eq." + donor.id : null, fetchRequests, !!donor && !isAdmin);

  const handleEdit = (item: RequestItem) => {
    setEditId(item.id);
    setTitle(item.title);
    setDescription(item.description ?? '');
    setSelectedMosque(item.mosque_id);
    setError(null);
    setShowCreate(true);
  };

  const handleDelete = (item: RequestItem) => {
    setDeleteTarget(item);
    setDeleteError(null);
  };

  const confirmDelete = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    setDeleteError(null);
    try {
      const { error: delErr } = await supabase
        .from('donor_requests')
        .delete()
        .eq('id', deleteTarget.id);
      if (delErr) throw delErr;
      setRequests((prev) => prev.filter((r) => r.id !== deleteTarget.id));
      setDeleteTarget(null);
    } catch (e: any) {
      setDeleteError(e.message || 'Failed to delete.');
    } finally {
      setDeleting(false);
    }
  };

  const handleSubmit = async () => {
    if (!title.trim()) { setError('Please enter a title.'); return; }
    if (!selectedMosque) { setError('Please select a mosque.'); return; }

    if (isAdmin) {
      setRequests((prev) => [{
        id: Date.now().toString(),
        title: title.trim(),
        description: description.trim() || null,
        mosque_name: 'Demo Mosque (Admin)',
        mosque_id: 'admin-mosque',
        status: 'active',
        read_at: null,
        created_at: new Date().toISOString(),
        archived: false,
      }, ...prev]);
      setShowCreate(false);
      setTitle('');
      setDescription('');
      setSelectedMosque(null);
      return;
    }

    if (!donor) return;
    setSubmitting(true);
    setError(null);

    try {
      if (editId) {
        const { error: updateErr } = await supabase
          .from('donor_requests')
          .update({
            title: title.trim(),
            description: description.trim() || null,
            updated_at: new Date().toISOString(),
          })
          .eq('id', editId);
        if (updateErr) throw updateErr;
      } else {
        const { error: insertErr } = await supabase.from('donor_requests').insert({
          donor_id: donor.id,
          mosque_id: selectedMosque,
          title: title.trim(),
          description: description.trim() || null,
        });
        if (insertErr) throw insertErr;
      }

      setShowCreate(false);
      setTitle('');
      setDescription('');
      setSelectedMosque(null);
      setEditId(null);
      fetchRequests();
    } catch (e: any) {
      setError(e.message || 'Something went wrong.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: colors.background }]} edges={['top']}>
      <View style={styles.header}>
        <View style={{ flex: 1 }}>
          <Text style={[styles.headerTitle, { color: colors.textPrimary }]}>My Requests</Text>
          <Text style={[styles.headerSubtitle, { color: colors.textMuted }]}>Request items or services from your mosque</Text>
        </View>
        {mosques.length > 0 && (
          <TouchableOpacity style={styles.createBtn} onPress={() => {
            setEditId(null);
            setTitle('');
            setDescription('');
            setSelectedMosque(null);
            setShowCreate(true);
          }} activeOpacity={0.7}>
            <Plus size={18} color={Colors.white} />
            <Text style={styles.createBtnText}>New</Text>
          </TouchableOpacity>
        )}
      </View>

      {loading ? (
        <View style={styles.centered}><ActivityIndicator size="large" color={Colors.primary} /></View>
      ) : requests.length === 0 ? (
        <View style={styles.centered}>
          <MessageSquare size={48} color={Colors.stone300} />
          <Text style={[styles.emptyTitle, { color: colors.textSecondary }]}>No Requests Yet</Text>
          <Text style={[styles.emptySubtitle, { color: colors.textMuted }]}>
            {mosques.length > 0
              ? 'Tap "New" to submit a request to your mosque.'
              : 'Join a mosque first to submit requests.'}
          </Text>
        </View>
      ) : (
        <ScrollView contentContainerStyle={styles.list}>
          {requests.map((r) => (
            <View key={r.id} style={[styles.requestCard, { backgroundColor: colors.cardBg, borderColor: colors.cardBorder }]}>
              <View style={styles.requestCardHeader}>
                <Text style={[styles.requestTitle, { color: colors.textPrimary, flex: 1 }]}>{r.title}</Text>
                <View style={styles.cardActions}>
                  <TouchableOpacity style={styles.actionBtn} activeOpacity={0.7} hitSlop={{ top: 8, bottom: 8, left: 4, right: 4 }} onPress={() => handleEdit(r)}>
                    <Pencil size={15} color={colors.textMuted} />
                  </TouchableOpacity>
                  <TouchableOpacity style={styles.actionBtn} activeOpacity={0.7} hitSlop={{ top: 8, bottom: 8, left: 4, right: 8 }} onPress={() => handleDelete(r)}>
                    <Trash2 size={15} color={Colors.red} />
                  </TouchableOpacity>
                </View>
              </View>
              {r.description && <Text style={[styles.requestDesc, { color: colors.textSecondary }]}>{r.description}</Text>}
              <View style={styles.requestMeta}>
                <View style={styles.statusRow}>
                  {r.status === 'accepted' ? (
                    <View style={styles.badgeAccepted}>
                      <CheckCircle2 size={11} color={Colors.primary} />
                      <Text style={styles.badgeAcceptedText}>Accepted</Text>
                    </View>
                  ) : r.status === 'declined' ? (
                    <View style={styles.badgeDeclined}>
                      <XCircle size={11} color={Colors.red} />
                      <Text style={styles.badgeDeclinedText}>Declined</Text>
                    </View>
                  ) : r.read_at !== null ? (
                    <View style={styles.badgeRead}>
                      <MailOpen size={11} color={Colors.stone500} />
                      <Text style={styles.badgeReadText}>Read</Text>
                    </View>
                  ) : (
                    <View style={styles.badgeSent}>
                      <Text style={styles.badgeSentText}>Sent</Text>
                    </View>
                  )}
                  <Text style={styles.requestMosque}>{r.mosque_name}</Text>
                </View>
                <Text style={styles.requestDate}>{new Date(r.created_at).toLocaleDateString()}</Text>
              </View>
            </View>
          ))}
        </ScrollView>
      )}

      {/* Create Request Modal */}
      <Modal visible={showCreate} transparent animationType="fade">
        <KeyboardAvoidingView style={styles.overlay} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
          <TouchableOpacity style={[styles.backdrop, { backgroundColor: colors.modalOverlay }]} activeOpacity={1} onPress={() => setShowCreate(false)} />
          <View style={[styles.modalCard, { backgroundColor: colors.cardBg }]}>
            <View style={styles.modalHeader}>
              <Text style={[styles.modalTitle, { color: colors.textPrimary }]}>{editId ? 'Edit Request' : 'New Request'}</Text>
              <TouchableOpacity style={styles.closeBtn} onPress={() => { setShowCreate(false); setEditId(null); }}>
                <X size={20} color={Colors.textSecondary} />
              </TouchableOpacity>
            </View>

            <Text style={[styles.fieldLabel, { color: colors.textPrimary }]}>Mosque</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.mosquePillScroll}>
              {mosques.map((m) => (
                <TouchableOpacity
                  key={m.mosque_id}
                  style={[styles.mosquePill, selectedMosque === m.mosque_id && styles.mosquePillActive]}
                  onPress={() => { setSelectedMosque(m.mosque_id); setError(null); }}
                  activeOpacity={0.7}
                >
                  <Text style={[styles.mosquePillText, selectedMosque === m.mosque_id && styles.mosquePillTextActive]}>
                    {m.mosque_name}
                  </Text>
                </TouchableOpacity>
              ))}
            </ScrollView>

            <Text style={[styles.fieldLabel, { color: colors.textPrimary }]}>What do you need?</Text>
            <TextInput
              style={[styles.input, { backgroundColor: colors.inputBg, borderColor: colors.inputBorder, color: colors.textPrimary }]}
              value={title}
              onChangeText={(t) => { setTitle(t); setError(null); }}
              placeholder="e.g. Quran classes for kids"
              placeholderTextColor={Colors.stone400}
            />

            <Text style={[styles.fieldLabel, { color: colors.textPrimary }]}>Details (optional)</Text>
            <TextInput
              style={[styles.input, styles.inputMulti, { backgroundColor: colors.inputBg, borderColor: colors.inputBorder, color: colors.textPrimary }]}
              value={description}
              onChangeText={setDescription}
              placeholder="Any additional details..."
              placeholderTextColor={Colors.stone400}
              multiline
              numberOfLines={3}
              textAlignVertical="top"
            />

            {error && <Text style={styles.errorText}>{error}</Text>}

            <TouchableOpacity
              style={[styles.submitBtn, submitting && { opacity: 0.7 }]}
              onPress={handleSubmit}
              activeOpacity={0.7}
              disabled={submitting}
            >
              {submitting ? (
                <ActivityIndicator size="small" color={Colors.white} />
              ) : (
                <>
                  <Send size={18} color={Colors.white} />
                  <Text style={styles.submitBtnText}>{editId ? 'Save' : 'Submit Request'}</Text>
                </>
              )}
            </TouchableOpacity>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      {/* Delete Confirmation Modal */}
      <Modal visible={deleteTarget !== null} transparent animationType="fade">
        <View style={styles.overlay}>
          <TouchableOpacity style={[styles.backdrop, { backgroundColor: colors.modalOverlay }]} activeOpacity={1} onPress={() => setDeleteTarget(null)} />
          <View style={[styles.modalCard, { backgroundColor: colors.cardBg }]}>
            <Text style={[styles.modalTitle, { color: colors.textPrimary }]}>Delete Request</Text>
            <Text style={[styles.requestDesc, { color: colors.textSecondary, marginBottom: Spacing.lg }]}>
              Delete "{deleteTarget?.title}"? This action cannot be undone.
            </Text>
            {deleteError ? <Text style={styles.errorText}>{deleteError}</Text> : null}
            <View style={styles.confirmButtons}>
              <TouchableOpacity style={styles.cancelBtn} onPress={() => setDeleteTarget(null)} activeOpacity={0.7}>
                <Text style={styles.cancelBtnText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[styles.deleteBtn, deleting && { opacity: 0.7 }]} onPress={confirmDelete} activeOpacity={0.7} disabled={deleting}>
                {deleting ? <ActivityIndicator size="small" color={Colors.white} /> : <Text style={styles.deleteBtnText}>Delete</Text>}
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
  header: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: Spacing.lg, paddingTop: Spacing.lg, paddingBottom: Spacing.md },
  headerTitle: { fontFamily: 'Inter-Bold', fontSize: FontSize.xxl, color: Colors.textPrimary },
  headerSubtitle: { fontFamily: 'Inter-Regular', fontSize: FontSize.sm, color: Colors.textMuted, marginTop: Spacing.xs },
  createBtn: {
    flexDirection: 'row', alignItems: 'center', gap: Spacing.sm,
    backgroundColor: Colors.primary, paddingVertical: Spacing.md, paddingHorizontal: Spacing.lg, borderRadius: Radius.md, minHeight: 44,
  },
  createBtnText: { fontFamily: 'Inter-SemiBold', fontSize: FontSize.sm, color: Colors.white },
  centered: { flex: 1, justifyContent: 'center', alignItems: 'center', paddingHorizontal: Spacing.xxl },
  emptyTitle: { fontFamily: 'Inter-SemiBold', fontSize: FontSize.lg, color: Colors.textSecondary, marginTop: Spacing.lg },
  emptySubtitle: { fontFamily: 'Inter-Regular', fontSize: FontSize.sm, color: Colors.textMuted, textAlign: 'center', marginTop: Spacing.sm, lineHeight: 20 },
  list: { paddingHorizontal: Spacing.lg, paddingBottom: Spacing.huge },
  requestCard: { backgroundColor: Colors.cardBg, borderRadius: Radius.lg, padding: Spacing.lg, marginBottom: Spacing.sm, borderWidth: 1, borderColor: Colors.cardBorder },
  requestTitle: { fontFamily: 'Inter-SemiBold', fontSize: FontSize.md, color: Colors.textPrimary, marginBottom: Spacing.xs },
  requestDesc: { fontFamily: 'Inter-Regular', fontSize: FontSize.sm, color: Colors.textSecondary, lineHeight: 20, marginBottom: Spacing.md },
  requestMeta: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  statusRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm },
  badgeAccepted: { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: Colors.primaryFaint, paddingHorizontal: Spacing.sm, paddingVertical: 2, borderRadius: Radius.full },
  badgeAcceptedText: { fontFamily: 'Inter-SemiBold', fontSize: FontSize.xs, color: Colors.primary },
  badgeDeclined: { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: Colors.redFaint, paddingHorizontal: Spacing.sm, paddingVertical: 2, borderRadius: Radius.full },
  badgeDeclinedText: { fontFamily: 'Inter-SemiBold', fontSize: FontSize.xs, color: Colors.red },
  badgeRead: { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: Colors.stone100, paddingHorizontal: Spacing.sm, paddingVertical: 2, borderRadius: Radius.full },
  badgeReadText: { fontFamily: 'Inter-SemiBold', fontSize: FontSize.xs, color: Colors.stone500 },
  badgeSent: { backgroundColor: Colors.blueFaint, paddingHorizontal: Spacing.sm, paddingVertical: 2, borderRadius: Radius.full },
  badgeSentText: { fontFamily: 'Inter-SemiBold', fontSize: FontSize.xs, color: Colors.blue },
  requestMosque: { fontFamily: 'Inter-Regular', fontSize: FontSize.xs, color: Colors.primary },
  requestDate: { fontFamily: 'Inter-Regular', fontSize: FontSize.xs, color: Colors.stone400 },
  // Modal
  overlay: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  backdrop: { ...StyleSheet.absoluteFill, backgroundColor: 'rgba(0,0,0,0.5)' },
  modalCard: { backgroundColor: Colors.white, borderRadius: Radius.xl, padding: Spacing.xxl, width: '92%', maxWidth: 480 },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: Spacing.xl },
  modalTitle: { fontFamily: 'Inter-Bold', fontSize: FontSize.xl, color: Colors.textPrimary },
  closeBtn: { width: 36, height: 36, borderRadius: 18, backgroundColor: Colors.stone100, justifyContent: 'center', alignItems: 'center' },
  fieldLabel: { fontFamily: 'Inter-SemiBold', fontSize: FontSize.sm, color: Colors.textPrimary, marginBottom: Spacing.xs, marginTop: Spacing.lg },
  mosquePillScroll: { marginBottom: Spacing.sm },
  mosquePill: { paddingHorizontal: Spacing.lg, paddingVertical: Spacing.md, borderRadius: Radius.full, backgroundColor: Colors.stone100, marginRight: Spacing.sm, minHeight: 44, justifyContent: 'center' },
  mosquePillActive: { backgroundColor: Colors.primary },
  mosquePillText: { fontFamily: 'Inter-Regular', fontSize: FontSize.sm, color: Colors.textSecondary },
  mosquePillTextActive: { fontFamily: 'Inter-SemiBold', color: Colors.white },
  input: {
    backgroundColor: Colors.stone50, borderWidth: 1, borderColor: Colors.stone200, borderRadius: Radius.md,
    paddingHorizontal: Spacing.lg, paddingVertical: Spacing.md, fontFamily: 'Inter-Regular', fontSize: FontSize.md, color: Colors.textPrimary, minHeight: 48,
  },
  inputMulti: { minHeight: 80, paddingTop: Spacing.md },
  errorText: { fontFamily: 'Inter-SemiBold', fontSize: FontSize.sm, color: Colors.red, textAlign: 'center', marginTop: Spacing.md },
  submitBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: Spacing.sm,
    backgroundColor: Colors.primary, borderRadius: Radius.md, paddingVertical: Spacing.lg, marginTop: Spacing.xl, minHeight: 52,
  },
  submitBtnText: { fontFamily: 'Inter-Bold', fontSize: FontSize.md, color: Colors.white },
  requestCardHeader: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', gap: Spacing.sm, marginBottom: Spacing.xs },
  cardActions: { flexDirection: 'row', alignItems: 'center', gap: 2 },
  actionBtn: { width: 32, height: 32, borderRadius: 16, justifyContent: 'center', alignItems: 'center' },
  confirmButtons: { flexDirection: 'row', gap: Spacing.md, marginTop: Spacing.md },
  cancelBtn: { flex: 1, backgroundColor: Colors.stone100, borderRadius: Radius.md, paddingVertical: Spacing.lg, alignItems: 'center', justifyContent: 'center', minHeight: 48 },
  cancelBtnText: { fontFamily: 'Inter-SemiBold', fontSize: FontSize.md, color: Colors.textSecondary },
  deleteBtn: { flex: 1, backgroundColor: Colors.red, borderRadius: Radius.md, paddingVertical: Spacing.lg, alignItems: 'center', justifyContent: 'center', minHeight: 48 },
  deleteBtnText: { fontFamily: 'Inter-Bold', fontSize: FontSize.md, color: Colors.white },
});
