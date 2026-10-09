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
  Coins,
  DollarSign,
  Package,
  X,
  Pencil,
  Archive,
  ArchiveRestore,
} from 'lucide-react-native';
import { supabase } from '@/lib/supabase';
import { useAppContext } from '@/lib/context';
import { Colors, Spacing, Radius, FontSize, useTheme } from '@/lib/theme';
import { useContentWidth } from '@/lib/responsive';
import { Need } from '@/lib/types';
import CreateNeedModal from '@/components/CreateNeedModal';
import { useRealtimeTable } from '@/hooks/useRealtimeTable';

export default function NeedsScreen() {
  const { mosqueAccount, isAdmin, isPaid } = useAppContext();
  const { paddingHorizontal, maxWidth } = useContentWidth();
  const { colors } = useTheme();

  const [needs, setNeeds] = useState<Need[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [activeTab, setActiveTab] = useState<'item' | 'money'>('item');
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [editNeed, setEditNeed] = useState<Need | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Need | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [archiveTarget, setArchiveTarget] = useState<Need | null>(null);
  const [archiving, setArchiving] = useState(false);
  const [archiveError, setArchiveError] = useState<string | null>(null);
  const [showArchived, setShowArchived] = useState(false);

  const mosqueId = mosqueAccount?.mosque_id;

  const fetchNeeds = useCallback(async () => {
    if (isAdmin) {
      setNeeds([]);
      setLoading(false);
      setRefreshing(false);
      return;
    }
    try {
      const { data, error } = await supabase
        .from('needs')
        .select('*')
        .eq('mosque_id', mosqueId)
        .order('created_at', { ascending: false });

      if (error) {
        console.error('Error fetching needs:', error);
        return;
      }
      setNeeds((data || []) as Need[]);
    } catch (err) {
      console.error('Error:', err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [mosqueId, isAdmin]);

  useEffect(() => {
    fetchNeeds();
  }, [fetchNeeds]);

  useRealtimeTable('needs', mosqueId ? `mosque_id=eq.${mosqueId}` : null, fetchNeeds, !!mosqueId && !isAdmin);

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    fetchNeeds();
  }, [fetchNeeds]);

  const handleDelete = (need: Need) => {
    setDeleteTarget(need);
    setDeleteError(null);
  };

  const confirmDelete = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    setDeleteError(null);
    try {
      const { error } = await supabase
        .from('needs')
        .delete()
        .eq('id', deleteTarget.id);
      if (error) {
        setDeleteError('Failed to delete. Please try again.');
        return;
      }
      setNeeds((prev) => prev.filter((n) => n.id !== deleteTarget.id));
      setDeleteTarget(null);
    } catch (err) {
      setDeleteError('Something went wrong.');
    } finally {
      setDeleting(false);
    }
  };

  const filteredNeeds = needs
    .filter((n) => n.type === activeTab)
    .filter((n) => showArchived ? n.archived : !n.archived);

  const getPriorityStyle = (priority: string) => {
    switch (priority.toLowerCase()) {
      case 'urgent':
        return { bg: Colors.redFaint, text: Colors.red };
      case 'high':
        return { bg: '#fff7ed', text: '#ea580c' };
      case 'medium':
        return { bg: Colors.blueFaint, text: Colors.blue };
      default:
        return { bg: Colors.stone100, text: Colors.stone600 };
    }
  };

  const handleEdit = (need: Need) => {
    setEditNeed(need);
    setShowCreateModal(true);
  };

  const handleArchive = (need: Need) => {
    setArchiveTarget(need);
    setArchiveError(null);
  };

  const confirmArchive = async () => {
    if (!archiveTarget) return;
    setArchiving(true);
    setArchiveError(null);
    try {
      const newArchived = !archiveTarget.archived;
      const { error } = await supabase
        .from('needs')
        .update({
          archived: newArchived,
          archived_at: newArchived ? new Date().toISOString() : null,
          updated_at: new Date().toISOString(),
        })
        .eq('id', archiveTarget.id);
      if (error) {
        setArchiveError('Failed to archive. Please try again.');
        return;
      }
      setNeeds((prev) => prev.map((n) =>
        n.id === archiveTarget.id
          ? { ...n, archived: newArchived, archived_at: newArchived ? new Date().toISOString() : null }
          : n
      ));
      setArchiveTarget(null);
    } catch (err) {
      setArchiveError('Something went wrong.');
    } finally {
      setArchiving(false);
    }
  };

  const renderNeedCard = ({ item }: { item: Need }) => {
    const priority = getPriorityStyle(item.priority);
    const progress =
      item.quantity_needed > 0
        ? Math.min(item.quantity_pledged / item.quantity_needed, 1)
        : 0;

    return (
      <View style={[styles.card, { backgroundColor: colors.cardBg, borderColor: colors.cardBorder }]}>
        <View style={styles.cardHeader}>
          <View style={styles.cardTitleRow}>
            <Text style={[styles.cardName, { color: colors.textPrimary }]} numberOfLines={1}>
              {item.name}
            </Text>
            <View style={[styles.priorityBadge, { backgroundColor: priority.bg }]}>
              <Text style={[styles.priorityText, { color: priority.text }]}>
                {item.priority}
              </Text>
            </View>
          </View>
          {item.description ? (
            <Text style={[styles.cardDesc, { color: colors.textMuted }]} numberOfLines={2}>
              {item.description}
            </Text>
          ) : null}
        </View>

        {/* Progress Bar */}
        <View style={styles.progressSection}>
          <View style={[styles.progressBarBg, { backgroundColor: colors.stone200 }]}>
            <View
              style={[
                styles.progressBarFill,
                { width: `${progress * 100}%` },
              ]}
            />
          </View>
          <View style={styles.progressLabels}>
            <Text style={[styles.progressText, { color: colors.textMuted }]}>
              {item.quantity_pledged} / {item.quantity_needed}{' '}
              {activeTab === 'money' ? 'raised' : 'pledged'}
            </Text>
            <Text style={styles.progressPercent}>
              {Math.round(progress * 100)}%
            </Text>
          </View>
        </View>

        {/* Meta Row */}
        <View style={styles.cardMeta}>
          <View style={styles.metaLeft}>
            {activeTab === 'money' && item.amount_dollars != null && (
              <View style={styles.metaItem}>
                <DollarSign size={14} color={Colors.teal} />
                <Text style={[styles.metaText, { color: colors.textSecondary }]}>
                  ${item.amount_dollars.toFixed(2)}
                </Text>
              </View>
            )}
            <View style={styles.metaItem}>
              <Coins size={14} color={Colors.amber} />
              <Text style={[styles.metaText, { color: colors.textSecondary }]}>
                {item.tokens_per_unit} token{item.tokens_per_unit !== 1 ? 's' : ''}/unit
              </Text>
            </View>
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
      </View>
    );
  };

  const renderEmpty = () => (
    <View style={styles.emptyContainer}>
      <Package size={48} color={Colors.stone300} />
      <Text style={[styles.emptyTitle, { color: colors.textSecondary }]}>
        No {activeTab === 'item' ? 'items' : 'fundraisers'} yet
      </Text>
      <Text style={[styles.emptySubtitle, { color: colors.textMuted }]}>
        Tap the + button to add your first{' '}
        {activeTab === 'item' ? 'item need' : 'fundraiser'}
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
        {/* Header */}
        <Text style={[styles.screenTitle, { color: colors.textPrimary }]}>Needs</Text>

        {/* Toggle Tabs + Archive Toggle */}
        <View style={styles.toggleContainer}>
          <View style={[styles.toggleRow, { backgroundColor: colors.stone100, flex: 1 }]}>
            <TouchableOpacity
              style={[styles.toggleBtn, activeTab === 'item' && styles.toggleBtnActive, activeTab === 'item' && { backgroundColor: colors.cardBg }]}
              activeOpacity={0.7}
              onPress={() => setActiveTab('item')}
            >
              <Text style={[styles.toggleText, { color: colors.textMuted }, activeTab === 'item' && styles.toggleTextActive]}>Items</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.toggleBtn, activeTab === 'money' && styles.toggleBtnActive, activeTab === 'money' && { backgroundColor: colors.cardBg }]}
              activeOpacity={0.7}
              onPress={() => setActiveTab('money')}
            >
              <Text style={[styles.toggleText, { color: colors.textMuted }, activeTab === 'money' && styles.toggleTextActive]}>Fundraisers</Text>
            </TouchableOpacity>
          </View>
          <TouchableOpacity
            style={[styles.archiveToggle, { backgroundColor: showArchived ? colors.primaryFaint : colors.stone100, borderColor: showArchived ? Colors.teal : 'transparent' }]}
            activeOpacity={0.7}
            onPress={() => setShowArchived(!showArchived)}
          >
            {showArchived ? <ArchiveRestore size={14} color={Colors.teal} /> : <Archive size={14} color={colors.textMuted} />}
            <Text style={[styles.archiveToggleText, { color: showArchived ? Colors.teal : colors.textMuted }]}>
              {showArchived ? 'Archived' : 'Archive'}
            </Text>
          </TouchableOpacity>
        </View>

        {/* List */}
        <FlatList
          data={filteredNeeds}
          keyExtractor={(item) => item.id}
          renderItem={renderNeedCard}
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

      {/* Subscription gating banner */}
      {!isPaid && !isAdmin && (
        <View style={styles.subBanner}>
          <Text style={styles.subBannerText}>
            Activate your subscription to create, edit, or manage needs and fundraisers.
          </Text>
        </View>
      )}

      {/* FAB */}
      <TouchableOpacity
        style={[styles.fab, !isPaid && !isAdmin && styles.fabDisabled]}
        activeOpacity={0.8}
        disabled={!isPaid && !isAdmin}
        onPress={() => { setEditNeed(null); setShowCreateModal(true); }}
      >
        <Plus size={28} color={Colors.white} strokeWidth={2.5} />
      </TouchableOpacity>

      {showCreateModal && (
        <CreateNeedModal
          visible={showCreateModal}
          onClose={() => { setShowCreateModal(false); setEditNeed(null); }}
          mosqueId={mosqueId!}
          defaultType={activeTab}
          editNeed={editNeed}
          onCreated={() => { setShowCreateModal(false); setEditNeed(null); fetchNeeds(); }}
        />
      )}

      {/* Archive Confirmation Modal */}
      <Modal visible={archiveTarget !== null} transparent animationType="fade">
        <View style={styles.overlay}>
          <TouchableOpacity style={[styles.backdrop, { backgroundColor: colors.modalOverlay }]} activeOpacity={1} onPress={() => setArchiveTarget(null)} />
          <View style={[styles.confirmCard, { backgroundColor: colors.cardBg }]}>
            <TouchableOpacity style={styles.closeBtn} onPress={() => setArchiveTarget(null)}>
              <X size={20} color={colors.textSecondary} />
            </TouchableOpacity>
            <Text style={[styles.confirmTitle, { color: colors.textPrimary }]}>
              {archiveTarget?.archived ? 'Restore' : 'Archive'} {activeTab === 'money' ? 'Fundraiser' : 'Item'}
            </Text>
            <Text style={[styles.confirmMessage, { color: colors.textSecondary }]}>
              {archiveTarget?.archived
                ? `Restore "${archiveTarget?.name}" to active status?`
                : `Archive "${archiveTarget?.name}"? It will be hidden from donors but can be restored later.`}
            </Text>
            {archiveError ? <Text style={styles.deleteErrorText}>{archiveError}</Text> : null}
            <View style={styles.confirmButtons}>
              <TouchableOpacity style={styles.cancelButton} onPress={() => setArchiveTarget(null)} activeOpacity={0.7}>
                <Text style={styles.cancelButtonText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.deleteConfirmButton, archiving && { opacity: 0.7 }, { backgroundColor: Colors.teal }]}
                onPress={confirmArchive}
                activeOpacity={0.7}
                disabled={archiving}
              >
                {archiving ? (
                  <ActivityIndicator size="small" color={Colors.white} />
                ) : (
                  <Text style={styles.deleteConfirmText}>{archiveTarget?.archived ? 'Restore' : 'Archive'}</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Delete Confirmation Modal */}
      <Modal visible={deleteTarget !== null} transparent animationType="fade">
        <View style={styles.overlay}>
          <TouchableOpacity style={[styles.backdrop, { backgroundColor: colors.modalOverlay }]} activeOpacity={1} onPress={() => setDeleteTarget(null)} />
          <View style={[styles.confirmCard, { backgroundColor: colors.cardBg }]}>
            <TouchableOpacity style={styles.closeBtn} onPress={() => setDeleteTarget(null)}>
              <X size={20} color={colors.textSecondary} />
            </TouchableOpacity>
            <Text style={[styles.confirmTitle, { color: colors.textPrimary }]}>Delete {activeTab === 'money' ? 'Fundraiser' : 'Item'}</Text>
            <Text style={[styles.confirmMessage, { color: colors.textSecondary }]}>
              Are you sure you want to delete "{deleteTarget?.name}"? This action cannot be undone.
            </Text>
            {deleteError ? <Text style={styles.deleteErrorText}>{deleteError}</Text> : null}
            <View style={styles.confirmButtons}>
              <TouchableOpacity style={styles.cancelButton} onPress={() => setDeleteTarget(null)} activeOpacity={0.7}>
                <Text style={styles.cancelButtonText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.deleteConfirmButton, deleting && { opacity: 0.7 }]}
                onPress={confirmDelete}
                activeOpacity={0.7}
                disabled={deleting}
              >
                {deleting ? (
                  <ActivityIndicator size="small" color={Colors.white} />
                ) : (
                  <Text style={styles.deleteConfirmText}>Delete</Text>
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
  safe: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  centered: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  container: {
    flex: 1,
    paddingTop: Spacing.xxl,
  },
  screenTitle: {
    fontFamily: 'Inter-Bold',
    fontSize: FontSize.xxl,
    color: Colors.textPrimary,
    marginBottom: Spacing.lg,
  },

  /* Toggle */
  toggleRow: {
    flexDirection: 'row',
    backgroundColor: Colors.stone100,
    borderRadius: Radius.md,
    padding: 3,
    marginBottom: Spacing.lg,
  },
  toggleBtn: {
    flex: 1,
    paddingVertical: Spacing.sm + 2,
    borderRadius: Radius.sm,
    alignItems: 'center',
    minHeight: 44,
    justifyContent: 'center',
  },
  toggleBtnActive: {
    backgroundColor: Colors.white,
    ...Platform.select({
      ios: {
        shadowColor: Colors.black,
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.08,
        shadowRadius: 4,
      },
      android: { elevation: 2 },
    }),
  },
  toggleText: {
    fontFamily: 'Inter-SemiBold',
    fontSize: FontSize.sm,
    color: Colors.textMuted,
  },
  toggleTextActive: {
    color: Colors.teal,
  },

  /* List */
  listContent: {
    paddingBottom: Spacing.huge + 40,
  },

  /* Card */
  card: {
    backgroundColor: Colors.cardBg,
    borderRadius: Radius.lg,
    padding: Spacing.lg,
    marginBottom: Spacing.md,
    borderWidth: 1,
    borderColor: Colors.cardBorder,
    ...Platform.select({
      ios: {
        shadowColor: Colors.black,
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.04,
        shadowRadius: 8,
      },
      android: { elevation: 2 },
    }),
  },
  cardHeader: {
    marginBottom: Spacing.md,
  },
  cardTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: Spacing.sm,
  },
  cardName: {
    fontFamily: 'Inter-SemiBold',
    fontSize: FontSize.md,
    color: Colors.textPrimary,
    flex: 1,
  },
  priorityBadge: {
    paddingHorizontal: Spacing.sm,
    paddingVertical: 3,
    borderRadius: Radius.full,
  },
  priorityText: {
    fontFamily: 'Inter-SemiBold',
    fontSize: FontSize.xs,
    textTransform: 'capitalize',
  },
  cardDesc: {
    fontFamily: 'Inter-Regular',
    fontSize: FontSize.sm,
    color: Colors.textMuted,
    marginTop: Spacing.xs,
    lineHeight: 20,
  },

  /* Progress */
  progressSection: {
    marginBottom: Spacing.md,
  },
  progressBarBg: {
    height: 6,
    backgroundColor: Colors.stone200,
    borderRadius: 3,
    overflow: 'hidden',
  },
  progressBarFill: {
    height: '100%',
    backgroundColor: Colors.teal,
    borderRadius: 3,
  },
  progressLabels: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: Spacing.xs,
  },
  progressText: {
    fontFamily: 'Inter-Regular',
    fontSize: FontSize.xs,
    color: Colors.textMuted,
  },
  progressPercent: {
    fontFamily: 'Inter-SemiBold',
    fontSize: FontSize.xs,
    color: Colors.teal,
  },

  /* Meta */
  cardMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  metaLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.lg,
  },
  metaItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  metaText: {
    fontFamily: 'Inter-Regular',
    fontSize: FontSize.sm,
    color: Colors.textSecondary,
  },
  deleteBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: Colors.redFaint,
    justifyContent: 'center',
    alignItems: 'center',
  },
  cardActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
  },
  actionBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    justifyContent: 'center',
    alignItems: 'center',
  },
  toggleContainer: {
    flexDirection: 'row',
    gap: Spacing.sm,
    marginBottom: Spacing.lg,
  },
  archiveToggle: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    borderRadius: Radius.md,
    borderWidth: 1.5,
    minHeight: 44,
    justifyContent: 'center',
  },
  archiveToggleText: {
    fontFamily: 'Inter-SemiBold',
    fontSize: FontSize.xs,
  },

  /* Empty */
  emptyContainer: {
    alignItems: 'center',
    paddingTop: Spacing.huge + 20,
    paddingHorizontal: Spacing.xxl,
  },
  emptyTitle: {
    fontFamily: 'Inter-SemiBold',
    fontSize: FontSize.lg,
    color: Colors.textSecondary,
    marginTop: Spacing.lg,
  },
  emptySubtitle: {
    fontFamily: 'Inter-Regular',
    fontSize: FontSize.sm,
    color: Colors.textMuted,
    marginTop: Spacing.xs,
    textAlign: 'center',
    lineHeight: 20,
  },

  /* FAB */
  subBanner: {
    position: 'absolute',
    bottom: 170,
    left: 20,
    right: 20,
    backgroundColor: Colors.amberFaint,
    borderRadius: Radius.md,
    padding: Spacing.md,
  },
  subBannerText: {
    fontFamily: 'Inter-Regular',
    fontSize: FontSize.sm,
    color: Colors.amber,
    textAlign: 'center',
    lineHeight: 19,
  },
  fabDisabled: {
    backgroundColor: Colors.stone300,
  },
  fab: {
    position: 'absolute',
    bottom: 100,
    right: 20,
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: Colors.teal,
    justifyContent: 'center',
    alignItems: 'center',
    ...Platform.select({
      ios: {
        shadowColor: Colors.teal,
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.35,
        shadowRadius: 12,
      },
      android: { elevation: 8 },
    }),
  },

  // Delete modal
  overlay: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  backdrop: { ...StyleSheet.absoluteFill, backgroundColor: 'rgba(0,0,0,0.5)' },
  confirmCard: {
    backgroundColor: Colors.white, borderRadius: Radius.xl, padding: Spacing.xxl,
    width: '92%', maxWidth: 400,
  },
  closeBtn: {
    position: 'absolute', top: Spacing.md, right: Spacing.md,
    width: 36, height: 36, borderRadius: 18, backgroundColor: Colors.stone100,
    justifyContent: 'center', alignItems: 'center',
  },
  confirmTitle: { fontFamily: 'Inter-Bold', fontSize: FontSize.xl, marginBottom: Spacing.sm },
  confirmMessage: { fontFamily: 'Inter-Regular', fontSize: FontSize.md, lineHeight: 22, marginBottom: Spacing.lg },
  deleteErrorText: { fontFamily: 'Inter-Regular', fontSize: FontSize.sm, color: Colors.red, marginBottom: Spacing.md, textAlign: 'center' },
  confirmButtons: { flexDirection: 'row', gap: Spacing.md },
  cancelButton: {
    flex: 1, backgroundColor: Colors.stone100, borderRadius: Radius.md,
    paddingVertical: Spacing.lg, alignItems: 'center', justifyContent: 'center', minHeight: 48,
  },
  cancelButtonText: { fontFamily: 'Inter-SemiBold', fontSize: FontSize.md, color: Colors.textSecondary },
  deleteConfirmButton: {
    flex: 1, backgroundColor: Colors.red, borderRadius: Radius.md,
    paddingVertical: Spacing.lg, alignItems: 'center', justifyContent: 'center', minHeight: 48,
  },
  deleteConfirmText: { fontFamily: 'Inter-Bold', fontSize: FontSize.md, color: Colors.white },
});
