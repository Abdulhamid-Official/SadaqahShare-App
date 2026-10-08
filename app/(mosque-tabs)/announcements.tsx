import React, { useEffect, useState, useCallback } from 'react';
import {
  View,
  Text,
  FlatList,
  StyleSheet,
  TouchableOpacity,
  Modal,
  ActivityIndicator,
  RefreshControl,
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import {
  Plus,
  Trash2,
  Pencil,
  Archive,
  ArchiveRestore,
  Pin,
  Megaphone,
  X,
  ArrowLeft,
} from 'lucide-react-native';
import { router } from 'expo-router';
import { supabase } from '@/lib/supabase';
import { useAppContext } from '@/lib/context';
import { Colors, Spacing, Radius, FontSize, useTheme } from '@/lib/theme';
import { useContentWidth } from '@/lib/responsive';
import { Announcement } from '@/lib/types';
import CreateAnnouncementModal from '@/components/CreateAnnouncementModal';
import { useRealtimeTable } from '@/hooks/useRealtimeTable';

export default function AnnouncementsScreen() {
  const { mosqueAccount, isAdmin, isPaid } = useAppContext();
  const { paddingHorizontal, maxWidth } = useContentWidth();
  const { colors } = useTheme();

  const [announcements, setAnnouncements] = useState<Announcement[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [editAnnouncement, setEditAnnouncement] = useState<Announcement | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Announcement | null>(null);
  const [archiveTarget, setArchiveTarget] = useState<Announcement | null>(null);
  const [actionLoading, setActionLoading] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);
  const [showArchived, setShowArchived] = useState(false);

  const mosqueId = mosqueAccount?.mosque_id;

  const fetchAnnouncements = useCallback(async () => {
    if (!mosqueId) return;
    if (isAdmin) {
      setAnnouncements([]);
      setLoading(false);
      setRefreshing(false);
      return;
    }
    try {
      const { data, error } = await supabase
        .from('announcements')
        .select('*')
        .eq('mosque_id', mosqueId)
        .order('pinned', { ascending: false })
        .order('created_at', { ascending: false });

      if (error) {
        console.error('Error fetching announcements:', error);
        return;
      }
      setAnnouncements((data || []) as Announcement[]);
    } catch (err) {
      console.error('Error:', err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [mosqueId, isAdmin]);

  useEffect(() => {
    fetchAnnouncements();
  }, [fetchAnnouncements]);

  useRealtimeTable('announcements', mosqueId ? `mosque_id=eq.${mosqueId}` : null, fetchAnnouncements, !!mosqueId && !isAdmin);

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    fetchAnnouncements();
  }, [fetchAnnouncements]);

  const handleEdit = (ann: Announcement) => {
    setEditAnnouncement(ann);
    setShowCreateModal(true);
  };

  const handleDelete = (ann: Announcement) => {
    setDeleteTarget(ann);
    setActionError(null);
  };

  const handleArchive = (ann: Announcement) => {
    setArchiveTarget(ann);
    setActionError(null);
  };

  const confirmDelete = async () => {
    if (!deleteTarget) return;
    setActionLoading(true);
    setActionError(null);
    try {
      const { error } = await supabase
        .from('announcements')
        .delete()
        .eq('id', deleteTarget.id);
      if (error) {
        setActionError('Failed to delete. Please try again.');
        return;
      }
      setAnnouncements((prev) => prev.filter((a) => a.id !== deleteTarget.id));
      setDeleteTarget(null);
    } catch (err) {
      setActionError('Something went wrong.');
    } finally {
      setActionLoading(false);
    }
  };

  const confirmArchive = async () => {
    if (!archiveTarget) return;
    setActionLoading(true);
    setActionError(null);
    try {
      const newArchived = !archiveTarget.archived;
      const { error } = await supabase
        .from('announcements')
        .update({
          archived: newArchived,
          archived_at: newArchived ? new Date().toISOString() : null,
          updated_at: new Date().toISOString(),
        })
        .eq('id', archiveTarget.id);
      if (error) {
        setActionError('Failed to archive. Please try again.');
        return;
      }
      setAnnouncements((prev) => prev.map((a) =>
        a.id === archiveTarget.id
          ? { ...a, archived: newArchived, archived_at: newArchived ? new Date().toISOString() : null }
          : a
      ));
      setArchiveTarget(null);
    } catch (err) {
      setActionError('Something went wrong.');
    } finally {
      setActionLoading(false);
    }
  };

  const visibleAnnouncements = announcements.filter((a) => showArchived ? a.archived : !a.archived);

  const renderAnnouncement = ({ item }: { item: Announcement }) => (
    <View style={[styles.card, { backgroundColor: colors.cardBg, borderColor: colors.cardBorder }]}>
      <View style={styles.cardHeader}>
        <View style={styles.titleRow}>
          {item.pinned && !item.archived && (
            <Pin size={14} color={Colors.teal} fill={Colors.teal} />
          )}
          <Text style={[styles.cardTitle, { color: colors.textPrimary }]} numberOfLines={2}>
            {item.title}
          </Text>
        </View>
        <View style={styles.cardActions}>
          <TouchableOpacity
            style={styles.actionBtn}
            activeOpacity={0.7}
            hitSlop={{ top: 8, bottom: 8, left: 4, right: 4 }}
            disabled={!isPaid && !isAdmin}
            onPress={() => handleEdit(item)}
          >
            <Pencil size={16} color={!isPaid && !isAdmin ? colors.stone300 : colors.textMuted} />
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.actionBtn}
            activeOpacity={0.7}
            hitSlop={{ top: 8, bottom: 8, left: 4, right: 4 }}
            disabled={!isPaid && !isAdmin}
            onPress={() => handleArchive(item)}
          >
            {item.archived ? (
              <ArchiveRestore size={16} color={!isPaid && !isAdmin ? colors.stone300 : colors.textMuted} />
            ) : (
              <Archive size={16} color={!isPaid && !isAdmin ? colors.stone300 : colors.textMuted} />
            )}
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.deleteBtn}
            activeOpacity={0.7}
            hitSlop={{ top: 8, bottom: 8, left: 4, right: 8 }}
            disabled={!isPaid && !isAdmin}
            onPress={() => handleDelete(item)}
          >
            <Trash2 size={16} color={!isPaid && !isAdmin ? colors.stone300 : Colors.red} />
          </TouchableOpacity>
        </View>
      </View>
      {item.body ? (
        <Text style={[styles.cardBody, { color: colors.textSecondary }]} numberOfLines={5}>
          {item.body}
        </Text>
      ) : null}
      <Text style={[styles.cardDate, { color: colors.stone400 }]}>
        {new Date(item.created_at).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })}
      </Text>
    </View>
  );

  const renderEmpty = () => (
    <View style={styles.emptyContainer}>
      <Megaphone size={48} color={Colors.stone300} />
      <Text style={[styles.emptyTitle, { color: colors.textSecondary }]}>
        No {showArchived ? 'archived' : ''} announcements
      </Text>
      <Text style={[styles.emptySubtitle, { color: colors.textMuted }]}>
        {showArchived ? 'Archived announcements will appear here.' : 'Tap the + button to post your first announcement.'}
      </Text>
    </View>
  );

  if (loading) {
    return (
      <SafeAreaView style={[styles.safe, { backgroundColor: colors.background }]} edges={['top']}>
        <View style={styles.centered}>
          <ActivityIndicator size="large" color={Colors.teal} />
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: colors.background }]} edges={['top']}>
      <View style={[styles.container, { paddingHorizontal, maxWidth, alignSelf: maxWidth ? 'center' : undefined, width: maxWidth ? '100%' : undefined }]}>
        <View style={styles.headerRow}>
          <TouchableOpacity onPress={() => router.back()} style={styles.backBtn} activeOpacity={0.7}>
            <ArrowLeft size={22} color={colors.stone600} />
          </TouchableOpacity>
          <Text style={[styles.screenTitle, { color: colors.textPrimary }]}>Announcements</Text>
          <TouchableOpacity
            style={[styles.archiveToggle, { backgroundColor: showArchived ? colors.stone100 : colors.stone100, borderColor: showArchived ? Colors.teal : 'transparent' }]}
            activeOpacity={0.7}
            onPress={() => setShowArchived(!showArchived)}
          >
            {showArchived ? <ArchiveRestore size={14} color={Colors.teal} /> : <Archive size={14} color={colors.textMuted} />}
            <Text style={[styles.archiveToggleText, { color: showArchived ? Colors.teal : colors.textMuted }]}>
              {showArchived ? 'Archived' : 'Archive'}
            </Text>
          </TouchableOpacity>
        </View>

        <FlatList
          data={visibleAnnouncements}
          keyExtractor={(item) => item.id}
          renderItem={renderAnnouncement}
          ListEmptyComponent={renderEmpty}
          contentContainerStyle={styles.listContent}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={onRefresh}
              tintColor={Colors.teal}
              colors={[Colors.teal]}
            />
          }
        />
      </View>

      {!isPaid && !isAdmin && (
        <View style={styles.subBanner}>
          <Text style={styles.subBannerText}>
            Activate your subscription to create and manage announcements.
          </Text>
        </View>
      )}

      <TouchableOpacity
        style={[styles.fab, !isPaid && !isAdmin && styles.fabDisabled]}
        activeOpacity={0.8}
        disabled={!isPaid && !isAdmin}
        onPress={() => { setEditAnnouncement(null); setShowCreateModal(true); }}
      >
        <Plus size={28} color={Colors.white} strokeWidth={2.5} />
      </TouchableOpacity>

      {showCreateModal && (
        <CreateAnnouncementModal
          visible={showCreateModal}
          onClose={() => { setShowCreateModal(false); setEditAnnouncement(null); }}
          mosqueId={mosqueId!}
          editAnnouncement={editAnnouncement}
          onCreated={() => { setShowCreateModal(false); setEditAnnouncement(null); fetchAnnouncements(); }}
        />
      )}

      {/* Archive Modal */}
      <Modal visible={archiveTarget !== null} transparent animationType="fade">
        <View style={styles.overlay}>
          <TouchableOpacity style={[styles.backdrop, { backgroundColor: colors.modalOverlay }]} activeOpacity={1} onPress={() => setArchiveTarget(null)} />
          <View style={[styles.confirmCard, { backgroundColor: colors.cardBg }]}>
            <TouchableOpacity style={styles.modalCloseBtn} onPress={() => setArchiveTarget(null)}>
              <X size={20} color={colors.textSecondary} />
            </TouchableOpacity>
            <Text style={[styles.confirmTitle, { color: colors.textPrimary }]}>
              {archiveTarget?.archived ? 'Restore Announcement' : 'Archive Announcement'}
            </Text>
            <Text style={[styles.confirmMessage, { color: colors.textSecondary }]}>
              {archiveTarget?.archived
                ? `Restore "${archiveTarget?.title}" to active status?`
                : `Archive "${archiveTarget?.title}"? It will be hidden from donors but can be restored later.`}
            </Text>
            {actionError ? <Text style={styles.actionErrorText}>{actionError}</Text> : null}
            <View style={styles.confirmButtons}>
              <TouchableOpacity style={styles.cancelButton} onPress={() => setArchiveTarget(null)} activeOpacity={0.7}>
                <Text style={styles.cancelButtonText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.archiveConfirmButton, actionLoading && { opacity: 0.7 }]}
                onPress={confirmArchive}
                activeOpacity={0.7}
                disabled={actionLoading}
              >
                {actionLoading ? (
                  <ActivityIndicator size="small" color={Colors.white} />
                ) : (
                  <Text style={styles.confirmBtnText}>{archiveTarget?.archived ? 'Restore' : 'Archive'}</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Delete Modal */}
      <Modal visible={deleteTarget !== null} transparent animationType="fade">
        <View style={styles.overlay}>
          <TouchableOpacity style={[styles.backdrop, { backgroundColor: colors.modalOverlay }]} activeOpacity={1} onPress={() => setDeleteTarget(null)} />
          <View style={[styles.confirmCard, { backgroundColor: colors.cardBg }]}>
            <TouchableOpacity style={styles.modalCloseBtn} onPress={() => setDeleteTarget(null)}>
              <X size={20} color={colors.textSecondary} />
            </TouchableOpacity>
            <Text style={[styles.confirmTitle, { color: colors.textPrimary }]}>Delete Announcement</Text>
            <Text style={[styles.confirmMessage, { color: colors.textSecondary }]}>
              Delete "{deleteTarget?.title}"? This action cannot be undone.
            </Text>
            {actionError ? <Text style={styles.actionErrorText}>{actionError}</Text> : null}
            <View style={styles.confirmButtons}>
              <TouchableOpacity style={styles.cancelButton} onPress={() => setDeleteTarget(null)} activeOpacity={0.7}>
                <Text style={styles.cancelButtonText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.deleteConfirmButton, actionLoading && { opacity: 0.7 }]}
                onPress={confirmDelete}
                activeOpacity={0.7}
                disabled={actionLoading}
              >
                {actionLoading ? (
                  <ActivityIndicator size="small" color={Colors.white} />
                ) : (
                  <Text style={styles.confirmBtnText}>Delete</Text>
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
  centered: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  container: { flex: 1, paddingTop: Spacing.xxl },
  headerRow: { flexDirection: 'row', alignItems: 'center', marginBottom: Spacing.lg, gap: Spacing.sm },
  backBtn: { width: 44, height: 44, justifyContent: 'center', alignItems: 'center', marginLeft: -Spacing.sm },
  screenTitle: { fontFamily: 'Inter-Bold', fontSize: FontSize.xxl, color: Colors.textPrimary, flex: 1 },
  archiveToggle: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    paddingHorizontal: Spacing.md, paddingVertical: Spacing.sm,
    borderRadius: Radius.md, borderWidth: 1.5, minHeight: 40, justifyContent: 'center',
  },
  archiveToggleText: { fontFamily: 'Inter-SemiBold', fontSize: FontSize.xs },
  listContent: { paddingBottom: Spacing.huge + 40 },
  card: {
    backgroundColor: Colors.cardBg, borderRadius: Radius.lg, padding: Spacing.lg,
    marginBottom: Spacing.md, borderWidth: 1, borderColor: Colors.cardBorder,
    ...Platform.select({
      ios: { shadowColor: Colors.black, shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.04, shadowRadius: 8 },
      android: { elevation: 2 },
    }),
  },
  cardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: Spacing.xs },
  titleRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.xs, flex: 1 },
  cardTitle: { fontFamily: 'Inter-SemiBold', fontSize: FontSize.md, color: Colors.textPrimary, flex: 1 },
  cardBody: { fontFamily: 'Inter-Regular', fontSize: FontSize.sm, color: Colors.textSecondary, lineHeight: 20, marginBottom: Spacing.sm },
  cardDate: { fontFamily: 'Inter-Regular', fontSize: FontSize.xs },
  cardActions: { flexDirection: 'row', alignItems: 'center', gap: 2 },
  actionBtn: { width: 32, height: 32, borderRadius: 16, justifyContent: 'center', alignItems: 'center' },
  deleteBtn: { width: 32, height: 32, borderRadius: 16, backgroundColor: Colors.redFaint, justifyContent: 'center', alignItems: 'center' },
  emptyContainer: { alignItems: 'center', paddingTop: Spacing.huge + 20, paddingHorizontal: Spacing.xxl },
  emptyTitle: { fontFamily: 'Inter-SemiBold', fontSize: FontSize.lg, color: Colors.textSecondary, marginTop: Spacing.lg },
  emptySubtitle: { fontFamily: 'Inter-Regular', fontSize: FontSize.sm, color: Colors.textMuted, marginTop: Spacing.xs, textAlign: 'center', lineHeight: 20 },
  subBanner: {
    position: 'absolute', bottom: 170, left: 20, right: 20,
    backgroundColor: Colors.amberFaint, borderRadius: Radius.md, padding: Spacing.md,
  },
  subBannerText: {
    fontFamily: 'Inter-Regular', fontSize: FontSize.sm, color: Colors.amber, textAlign: 'center', lineHeight: 19,
  },
  fabDisabled: {
    backgroundColor: Colors.stone300,
  },
  fab: {
    position: 'absolute', bottom: 100, right: 20, width: 60, height: 60, borderRadius: 30,
    backgroundColor: Colors.teal, justifyContent: 'center', alignItems: 'center',
    ...Platform.select({
      ios: { shadowColor: Colors.teal, shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.35, shadowRadius: 12 },
      android: { elevation: 8 },
    }),
  },
  overlay: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  backdrop: { ...StyleSheet.absoluteFill, backgroundColor: 'rgba(0,0,0,0.5)' },
  confirmCard: {
    backgroundColor: Colors.white, borderRadius: Radius.xl, padding: Spacing.xxl,
    width: '92%', maxWidth: 400,
  },
  modalCloseBtn: {
    position: 'absolute', top: Spacing.md, right: Spacing.md,
    width: 36, height: 36, borderRadius: 18, backgroundColor: Colors.stone100,
    justifyContent: 'center', alignItems: 'center',
  },
  confirmTitle: { fontFamily: 'Inter-Bold', fontSize: FontSize.xl, marginBottom: Spacing.sm },
  confirmMessage: { fontFamily: 'Inter-Regular', fontSize: FontSize.md, lineHeight: 22, marginBottom: Spacing.lg },
  actionErrorText: { fontFamily: 'Inter-Regular', fontSize: FontSize.sm, color: Colors.red, marginBottom: Spacing.md, textAlign: 'center' },
  confirmButtons: { flexDirection: 'row', gap: Spacing.md },
  cancelButton: {
    flex: 1, backgroundColor: Colors.stone100, borderRadius: Radius.md,
    paddingVertical: Spacing.lg, alignItems: 'center', justifyContent: 'center', minHeight: 48,
  },
  cancelButtonText: { fontFamily: 'Inter-SemiBold', fontSize: FontSize.md, color: Colors.textSecondary },
  archiveConfirmButton: {
    flex: 1, backgroundColor: Colors.teal, borderRadius: Radius.md,
    paddingVertical: Spacing.lg, alignItems: 'center', justifyContent: 'center', minHeight: 48,
  },
  deleteConfirmButton: {
    flex: 1, backgroundColor: Colors.red, borderRadius: Radius.md,
    paddingVertical: Spacing.lg, alignItems: 'center', justifyContent: 'center', minHeight: 48,
  },
  confirmBtnText: { fontFamily: 'Inter-Bold', fontSize: FontSize.md, color: Colors.white },
});
