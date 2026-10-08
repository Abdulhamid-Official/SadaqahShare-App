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
  Clock,
  XCircle,
  BarChart3,
  X,
  Pencil,
  Archive,
  ArchiveRestore,
  ArrowLeft,
} from 'lucide-react-native';
import { router } from 'expo-router';
import { useSafeBack } from '@/lib/navigation';
import { supabase } from '@/lib/supabase';
import { useAppContext } from '@/lib/context';
import { Colors, Spacing, Radius, FontSize, useTheme } from '@/lib/theme';
import { useContentWidth } from '@/lib/responsive';
import { Poll, PollOption, Vote } from '@/lib/types';
import CreatePollModal from '@/components/CreatePollModal';
import { useRealtimeTable } from '@/hooks/useRealtimeTable';

interface OptionWithVotes extends PollOption {
  totalTokens: number;
}

interface PollWithDetails extends Poll {
  options: OptionWithVotes[];
  totalTokensVoted: number;
}

export default function PollsScreen() {
  const { mosqueAccount, isAdmin, isPaid } = useAppContext();
  const { paddingHorizontal, maxWidth } = useContentWidth();
  const { colors } = useTheme();
  const goBack = useSafeBack('/(mosque-tabs)');

  const [polls, setPolls] = useState<PollWithDetails[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [editPoll, setEditPoll] = useState<Poll | null>(null);
  const [editOptions, setEditOptions] = useState<PollOption[]>([]);
  const [archiveTarget, setArchiveTarget] = useState<PollWithDetails | null>(null);
  const [showArchived, setShowArchived] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<PollWithDetails | null>(null);
  const [closeTarget, setCloseTarget] = useState<PollWithDetails | null>(null);
  const [actionLoading, setActionLoading] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);

  const mosqueId = mosqueAccount?.mosque_id;

  const fetchPolls = useCallback(async () => {
    if (!mosqueId) return;
    if (isAdmin) {
      setPolls([]);
      setLoading(false);
      setRefreshing(false);
      return;
    }
    try {
      const { data: pollsData, error: pollsErr } = await supabase
        .from('polls')
        .select('*')
        .eq('mosque_id', mosqueId)
        .order('created_at', { ascending: false });

      if (pollsErr) {
        console.error('Error fetching polls:', pollsErr);
        return;
      }

      const pollsList = (pollsData || []) as Poll[];

      const pollsWithDetails: PollWithDetails[] = await Promise.all(
        pollsList.map(async (poll) => {
          const [optionsRes, votesRes] = await Promise.all([
            supabase
              .from('poll_options')
              .select('*')
              .eq('poll_id', poll.id)
              .order('created_at', { ascending: true }),
            supabase
              .from('votes')
              .select('option_id, tokens_spent')
              .eq('poll_id', poll.id),
          ]);

          const options = (optionsRes.data || []) as PollOption[];
          const votes = (votesRes.data || []) as Pick<Vote, 'option_id' | 'tokens_spent'>[];

          const voteMap: Record<string, number> = {};
          let totalTokensVoted = 0;
          for (const v of votes) {
            voteMap[v.option_id] = (voteMap[v.option_id] || 0) + v.tokens_spent;
            totalTokensVoted += v.tokens_spent;
          }

          const enrichedOptions: OptionWithVotes[] = options.map((opt) => ({
            ...opt,
            totalTokens: voteMap[opt.id] || 0,
          }));

          return { ...poll, options: enrichedOptions, totalTokensVoted };
        })
      );

      setPolls(pollsWithDetails);
    } catch (err) {
      console.error('Error:', err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [mosqueId, isAdmin]);

  useEffect(() => {
    fetchPolls();
  }, [fetchPolls]);

  useRealtimeTable('polls', mosqueId ? `mosque_id=eq.${mosqueId}` : null, fetchPolls, !!mosqueId && !isAdmin);
  useRealtimeTable('votes', null, fetchPolls, !!mosqueId && !isAdmin);

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    fetchPolls();
  }, [fetchPolls]);

  const handleClosePoll = (poll: PollWithDetails) => {
    setCloseTarget(poll);
    setActionError(null);
  };

  const confirmClosePoll = async () => {
    if (!closeTarget) return;
    setActionLoading(true);
    setActionError(null);
    try {
      const { error } = await supabase
        .from('polls')
        .update({ status: 'closed' })
        .eq('id', closeTarget.id);
      if (error) {
        setActionError('Failed to close poll.');
        return;
      }
      setPolls((prev) =>
        prev.map((p) =>
          p.id === closeTarget.id ? { ...p, status: 'closed' } : p
        )
      );
      setCloseTarget(null);
    } catch (err) {
      setActionError('Something went wrong.');
    } finally {
      setActionLoading(false);
    }
  };

  const handleDeletePoll = (poll: PollWithDetails) => {
    setDeleteTarget(poll);
    setActionError(null);
  };

  const confirmDeletePoll = async () => {
    if (!deleteTarget) return;
    setActionLoading(true);
    setActionError(null);
    try {
      const { error } = await supabase
        .from('polls')
        .delete()
        .eq('id', deleteTarget.id);
      if (error) {
        setActionError('Failed to delete poll.');
        return;
      }
      setPolls((prev) => prev.filter((p) => p.id !== deleteTarget.id));
      setDeleteTarget(null);
    } catch (err) {
      setActionError('Something went wrong.');
    } finally {
      setActionLoading(false);
    }
  };

  const computeDisplayStatus = (poll: Poll) => {
    if (poll.status === 'closed') return 'closed';
    if (poll.closes_at && new Date(poll.closes_at) < new Date()) return 'expired';
    return 'active';
  };

  const getStatusStyle = (displayStatus: string) => {
    switch (displayStatus) {
      case 'active':
        return { bg: '#ccfbf1', text: Colors.teal, label: 'Active' };
      case 'closed':
        return { bg: Colors.stone100, text: Colors.stone600, label: 'Closed' };
      case 'expired':
        return { bg: Colors.redFaint, text: Colors.red, label: 'Expired' };
      default:
        return { bg: Colors.stone100, text: Colors.stone600, label: displayStatus };
    }
  };

  const getTimeRemaining = (closesAt: string) => {
    const diff = new Date(closesAt).getTime() - Date.now();
    if (diff <= 0) return 'Ended';
    const hours = Math.floor(diff / 3600000);
    const days = Math.floor(hours / 24);
    if (days > 0) return `${days}d ${hours % 24}h left`;
    if (hours > 0) return `${hours}h left`;
    const minutes = Math.floor(diff / 60000);
    return `${minutes}m left`;
  };

  const handleEditPoll = (poll: PollWithDetails) => {
    setEditPoll(poll);
    setEditOptions(poll.options.map((o) => ({ id: o.id, poll_id: o.poll_id, option_text: o.option_text, created_at: o.created_at })));
    setShowCreateModal(true);
  };

  const handleArchivePoll = (poll: PollWithDetails) => {
    setArchiveTarget(poll);
    setActionError(null);
  };

  const confirmArchivePoll = async () => {
    if (!archiveTarget) return;
    setActionLoading(true);
    setActionError(null);
    try {
      const newArchived = !archiveTarget.archived;
      const { error } = await supabase
        .from('polls')
        .update({
          archived: newArchived,
          archived_at: newArchived ? new Date().toISOString() : null,
          updated_at: new Date().toISOString(),
        })
        .eq('id', archiveTarget.id);
      if (error) {
        setActionError('Failed to archive poll.');
        return;
      }
      setPolls((prev) => prev.map((p) =>
        p.id === archiveTarget.id
          ? { ...p, archived: newArchived, archived_at: newArchived ? new Date().toISOString() : null }
          : p
      ));
      setArchiveTarget(null);
    } catch (err) {
      setActionError('Something went wrong.');
    } finally {
      setActionLoading(false);
    }
  };

  const visiblePolls = polls.filter((p) => showArchived ? p.archived : !p.archived);

  const renderPollCard = ({ item }: { item: PollWithDetails }) => {
    const displayStatus = computeDisplayStatus(item);
    const status = getStatusStyle(displayStatus);
    const isActive = displayStatus === 'active';

    return (
      <View style={[styles.card, { backgroundColor: colors.cardBg, borderColor: colors.cardBorder }]}>
        {/* Header */}
        <View style={styles.cardHeader}>
          <Text style={[styles.cardQuestion, { color: colors.textPrimary }]} numberOfLines={3}>
            {item.question}
          </Text>
          <View style={[styles.statusBadge, { backgroundColor: status.bg }]}>
            <Text style={[styles.statusText, { color: status.text }]}>
              {status.label}
            </Text>
          </View>
        </View>

        {/* Info Row */}
        <View style={styles.infoRow}>
          <View style={styles.infoItem}>
            <Coins size={14} color={Colors.amber} />
            <Text style={[styles.infoText, { color: colors.textMuted }]}>
              {item.tokens_to_vote} token{item.tokens_to_vote !== 1 ? 's' : ''} to vote
            </Text>
          </View>
          <Text style={styles.infoSeparator}>•</Text>
          <Text style={[styles.infoText, { color: colors.textMuted }]}>Max {item.max_votes_per_person} vote{item.max_votes_per_person !== 1 ? 's' : ''}</Text>
          {isActive && item.closes_at && (
            <>
              <Text style={styles.infoSeparator}>•</Text>
              <View style={styles.infoItem}>
                <Clock size={12} color={Colors.teal} />
                <Text style={[styles.infoText, { color: Colors.teal }]}>
                  {getTimeRemaining(item.closes_at)}
                </Text>
              </View>
            </>
          )}
        </View>

        {/* Options */}
        {item.options.length > 0 && (
          <View style={[styles.optionsSection, { backgroundColor: colors.stone50 }]}>
            {item.options.map((opt) => {
              const pct =
                item.totalTokensVoted > 0
                  ? opt.totalTokens / item.totalTokensVoted
                  : 0;
              return (
                <View key={opt.id} style={styles.optionRow}>
                  <View style={styles.optionLabelRow}>
                    <Text style={[styles.optionText, { color: colors.textPrimary }]} numberOfLines={1}>
                      {opt.option_text}
                    </Text>
                    <Text style={styles.optionTokens}>
                      {opt.totalTokens} token{opt.totalTokens !== 1 ? 's' : ''}
                    </Text>
                  </View>
                  <View style={[styles.optionBarBg, { backgroundColor: colors.stone200 }]}>
                    <View
                      style={[
                        styles.optionBarFill,
                        { width: `${Math.round(pct * 100)}%` },
                      ]}
                    />
                  </View>
                  <Text style={[styles.optionPercent, { color: colors.textMuted }]}>
                    {Math.round(pct * 100)}%
                  </Text>
                </View>
              );
            })}
            <Text style={[styles.totalVoted, { color: colors.textSecondary }]}>
              Total: {item.totalTokensVoted} token{item.totalTokensVoted !== 1 ? 's' : ''} voted
            </Text>
          </View>
        )}

        {/* Actions */}
        <View style={[styles.cardActions, { borderTopColor: colors.stone200 }]}>
          {isActive && (
            <TouchableOpacity
              style={styles.closeBtn}
              activeOpacity={0.7}
              disabled={!isPaid && !isAdmin}
              onPress={() => handleClosePoll(item)}
            >
              <XCircle size={16} color={!isPaid && !isAdmin ? colors.stone300 : Colors.amber} />
              <Text style={[styles.closeBtnText, !isPaid && !isAdmin && { color: colors.stone300 }]}>Close Poll</Text>
            </TouchableOpacity>
          )}
          <TouchableOpacity
            style={styles.editPollBtn}
            activeOpacity={0.7}
            disabled={!isPaid && !isAdmin}
            onPress={() => handleEditPoll(item)}
          >
            <Pencil size={16} color={!isPaid && !isAdmin ? colors.stone300 : colors.textMuted} />
            <Text style={[styles.editPollBtnText, !isPaid && !isAdmin && { color: colors.stone300 }]}>Edit</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.archivePollBtn}
            activeOpacity={0.7}
            disabled={!isPaid && !isAdmin}
            onPress={() => handleArchivePoll(item)}
          >
            {item.archived ? (
              <ArchiveRestore size={16} color={!isPaid && !isAdmin ? colors.stone300 : colors.textMuted} />
            ) : (
              <Archive size={16} color={!isPaid && !isAdmin ? colors.stone300 : colors.textMuted} />
            )}
            <Text style={[styles.archivePollBtnText, !isPaid && !isAdmin && { color: colors.stone300 }]}>{item.archived ? 'Restore' : 'Archive'}</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.deletePollBtn}
            activeOpacity={0.7}
            disabled={!isPaid && !isAdmin}
            onPress={() => handleDeletePoll(item)}
          >
            <Trash2 size={16} color={!isPaid && !isAdmin ? colors.stone300 : Colors.red} />
            <Text style={[styles.deletePollBtnText, !isPaid && !isAdmin && { color: colors.stone300 }]}>Delete</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  };

  const renderEmpty = () => (
    <View style={styles.emptyContainer}>
      <BarChart3 size={48} color={Colors.stone300} />
      <Text style={[styles.emptyTitle, { color: colors.textSecondary }]}>No polls yet</Text>
      <Text style={[styles.emptySubtitle, { color: colors.textMuted }]}>
        Create a poll to gather community input
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
          <TouchableOpacity onPress={goBack} style={styles.backBtn} activeOpacity={0.7}>
            <ArrowLeft size={22} color={colors.stone600} />
          </TouchableOpacity>
          <Text style={[styles.screenTitle, { color: colors.textPrimary }]}>Polls</Text>
        </View>

        <FlatList
          data={visiblePolls}
          keyExtractor={(item) => item.id}
          renderItem={renderPollCard}
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

      {/* Subscription banner */}
      {!isPaid && !isAdmin && (
        <View style={styles.subBanner}>
          <Text style={styles.subBannerText}>
            Activate your subscription to create and manage polls.
          </Text>
        </View>
      )}

      {/* FAB */}
      <TouchableOpacity
        style={[styles.fab, !isPaid && !isAdmin && styles.fabDisabled]}
        activeOpacity={0.8}
        disabled={!isPaid && !isAdmin}
        onPress={() => { setEditPoll(null); setEditOptions([]); setShowCreateModal(true); }}
      >
        <Plus size={28} color={Colors.white} strokeWidth={2.5} />
      </TouchableOpacity>

      {showCreateModal && (
        <CreatePollModal
          visible={showCreateModal}
          onClose={() => { setShowCreateModal(false); setEditPoll(null); setEditOptions([]); }}
          mosqueId={mosqueId!}
          editPoll={editPoll}
          editOptions={editOptions}
          onCreated={() => { setShowCreateModal(false); setEditPoll(null); setEditOptions([]); fetchPolls(); }}
        />
      )}

      {/* Delete Poll Modal */}
      <Modal visible={deleteTarget !== null} transparent animationType="fade">
        <View style={styles.overlay}>
          <TouchableOpacity style={[styles.backdrop, { backgroundColor: colors.modalOverlay }]} activeOpacity={1} onPress={() => setDeleteTarget(null)} />
          <View style={[styles.confirmCard, { backgroundColor: colors.cardBg }]}>
            <TouchableOpacity style={styles.modalCloseBtn} onPress={() => setDeleteTarget(null)}>
              <X size={20} color={colors.textSecondary} />
            </TouchableOpacity>
            <Text style={[styles.confirmTitle, { color: colors.textPrimary }]}>Delete Poll</Text>
            <Text style={[styles.confirmMessage, { color: colors.textSecondary }]}>
              Delete "{deleteTarget?.question}"? This will also remove all options and votes.
            </Text>
            {actionError ? <Text style={styles.actionErrorText}>{actionError}</Text> : null}
            <View style={styles.confirmButtons}>
              <TouchableOpacity style={styles.cancelButton} onPress={() => setDeleteTarget(null)} activeOpacity={0.7}>
                <Text style={styles.cancelButtonText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.deleteConfirmButton, actionLoading && { opacity: 0.7 }]}
                onPress={confirmDeletePoll}
                activeOpacity={0.7}
                disabled={actionLoading}
              >
                {actionLoading ? <ActivityIndicator size="small" color={Colors.white} /> : <Text style={styles.deleteConfirmText}>Delete</Text>}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Archive Poll Modal */}
      <Modal visible={archiveTarget !== null} transparent animationType="fade">
        <View style={styles.overlay}>
          <TouchableOpacity style={[styles.backdrop, { backgroundColor: colors.modalOverlay }]} activeOpacity={1} onPress={() => setArchiveTarget(null)} />
          <View style={[styles.confirmCard, { backgroundColor: colors.cardBg }]}>
            <TouchableOpacity style={styles.modalCloseBtn} onPress={() => setArchiveTarget(null)}>
              <X size={20} color={colors.textSecondary} />
            </TouchableOpacity>
            <Text style={[styles.confirmTitle, { color: colors.textPrimary }]}>
              {archiveTarget?.archived ? 'Restore Poll' : 'Archive Poll'}
            </Text>
            <Text style={[styles.confirmMessage, { color: colors.textSecondary }]}>
              {archiveTarget?.archived
                ? `Restore "${archiveTarget?.question}" to active status?`
                : `Archive "${archiveTarget?.question}"? It will be hidden from donors but can be restored later.`}
            </Text>
            {actionError ? <Text style={styles.actionErrorText}>{actionError}</Text> : null}
            <View style={styles.confirmButtons}>
              <TouchableOpacity style={styles.cancelButton} onPress={() => setArchiveTarget(null)} activeOpacity={0.7}>
                <Text style={styles.cancelButtonText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.closeConfirmButton, actionLoading && { opacity: 0.7 }]}
                onPress={confirmArchivePoll}
                activeOpacity={0.7}
                disabled={actionLoading}
              >
                {actionLoading ? <ActivityIndicator size="small" color={Colors.white} /> : <Text style={styles.deleteConfirmText}>{archiveTarget?.archived ? 'Restore' : 'Archive'}</Text>}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Close Poll Modal */}
      <Modal visible={closeTarget !== null} transparent animationType="fade">
        <View style={styles.overlay}>
          <TouchableOpacity style={[styles.backdrop, { backgroundColor: colors.modalOverlay }]} activeOpacity={1} onPress={() => setCloseTarget(null)} />
          <View style={[styles.confirmCard, { backgroundColor: colors.cardBg }]}>
            <TouchableOpacity style={styles.modalCloseBtn} onPress={() => setCloseTarget(null)}>
              <X size={20} color={colors.textSecondary} />
            </TouchableOpacity>
            <Text style={[styles.confirmTitle, { color: colors.textPrimary }]}>Close Poll</Text>
            <Text style={[styles.confirmMessage, { color: colors.textSecondary }]}>
              Close "{closeTarget?.question}"? No more votes will be accepted.
            </Text>
            {actionError ? <Text style={styles.actionErrorText}>{actionError}</Text> : null}
            <View style={styles.confirmButtons}>
              <TouchableOpacity style={styles.cancelButton} onPress={() => setCloseTarget(null)} activeOpacity={0.7}>
                <Text style={styles.cancelButtonText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.closeConfirmButton, actionLoading && { opacity: 0.7 }]}
                onPress={confirmClosePoll}
                activeOpacity={0.7}
                disabled={actionLoading}
              >
                {actionLoading ? <ActivityIndicator size="small" color={Colors.white} /> : <Text style={styles.deleteConfirmText}>Close</Text>}
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
    flex: 1,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    marginBottom: Spacing.lg,
  },
  backBtn: {
    width: 44,
    height: 44,
    justifyContent: 'center',
    alignItems: 'center',
    marginLeft: -Spacing.sm,
  },
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
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    gap: Spacing.sm,
    marginBottom: Spacing.md,
  },
  cardQuestion: {
    fontFamily: 'Inter-SemiBold',
    fontSize: FontSize.md,
    color: Colors.textPrimary,
    flex: 1,
    lineHeight: 22,
  },
  statusBadge: {
    paddingHorizontal: Spacing.sm,
    paddingVertical: 3,
    borderRadius: Radius.full,
  },
  statusText: {
    fontFamily: 'Inter-SemiBold',
    fontSize: FontSize.xs,
    textTransform: 'capitalize',
  },

  /* Info Row */
  infoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 6,
    marginBottom: Spacing.lg,
  },
  infoItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  infoText: {
    fontFamily: 'Inter-Regular',
    fontSize: FontSize.xs,
    color: Colors.textMuted,
  },
  infoSeparator: {
    fontFamily: 'Inter-Regular',
    fontSize: FontSize.xs,
    color: Colors.stone300,
  },

  /* Options */
  optionsSection: {
    marginBottom: Spacing.md,
    backgroundColor: Colors.stone50,
    borderRadius: Radius.md,
    padding: Spacing.md,
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
  optionTokens: {
    fontFamily: 'Inter-SemiBold',
    fontSize: FontSize.xs,
    color: Colors.amber,
  },
  optionBarBg: {
    height: 6,
    backgroundColor: Colors.stone200,
    borderRadius: 3,
    overflow: 'hidden',
  },
  optionBarFill: {
    height: '100%',
    backgroundColor: Colors.teal,
    borderRadius: 3,
  },
  optionPercent: {
    fontFamily: 'Inter-Regular',
    fontSize: FontSize.xs,
    color: Colors.textMuted,
    marginTop: 2,
  },
  totalVoted: {
    fontFamily: 'Inter-SemiBold',
    fontSize: FontSize.xs,
    color: Colors.textSecondary,
    marginTop: Spacing.sm,
    textAlign: 'right',
  },

  /* Actions */
  cardActions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: Spacing.md,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: Colors.stone200,
    paddingTop: Spacing.md,
  },
  closeBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: Spacing.sm,
    paddingHorizontal: Spacing.md,
    backgroundColor: Colors.amberFaint,
    borderRadius: Radius.sm,
    minHeight: 44,
  },
  closeBtnText: {
    fontFamily: 'Inter-SemiBold',
    fontSize: FontSize.sm,
    color: Colors.amber,
  },
  editPollBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: Spacing.sm,
    paddingHorizontal: Spacing.md,
    backgroundColor: Colors.stone100,
    borderRadius: Radius.sm,
    minHeight: 44,
  },
  editPollBtnText: {
    fontFamily: 'Inter-SemiBold',
    fontSize: FontSize.sm,
    color: Colors.stone600,
  },
  archivePollBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: Spacing.sm,
    paddingHorizontal: Spacing.md,
    backgroundColor: Colors.stone100,
    borderRadius: Radius.sm,
    minHeight: 44,
  },
  archivePollBtnText: {
    fontFamily: 'Inter-SemiBold',
    fontSize: FontSize.sm,
    color: Colors.stone600,
  },
  deletePollBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: Spacing.sm,
    paddingHorizontal: Spacing.md,
    backgroundColor: Colors.redFaint,
    borderRadius: Radius.sm,
    minHeight: 44,
  },
  deletePollBtnText: {
    fontFamily: 'Inter-SemiBold',
    fontSize: FontSize.sm,
    color: Colors.red,
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
  // Confirmation modals
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
  deleteConfirmButton: {
    flex: 1, backgroundColor: Colors.red, borderRadius: Radius.md,
    paddingVertical: Spacing.lg, alignItems: 'center', justifyContent: 'center', minHeight: 48,
  },
  closeConfirmButton: {
    flex: 1, backgroundColor: Colors.amber, borderRadius: Radius.md,
    paddingVertical: Spacing.lg, alignItems: 'center', justifyContent: 'center', minHeight: 48,
  },
  deleteConfirmText: { fontFamily: 'Inter-Bold', fontSize: FontSize.md, color: Colors.white },
});
