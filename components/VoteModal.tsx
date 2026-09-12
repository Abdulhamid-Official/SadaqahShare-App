import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
  Platform,
} from 'react-native';
import { X, CheckCircle, Coins, CircleDot, Circle } from 'lucide-react-native';
import { supabase } from '@/lib/supabase';
import { Poll, PollOption, Vote } from '@/lib/types';
import { Colors, Spacing, Radius, FontSize, useTheme } from '@/lib/theme';

interface PollWithDetails extends Poll {
  options?: PollOption[];
  votes?: Vote[];
}

interface VoteModalProps {
  visible: boolean;
  onClose: () => void;
  poll: PollWithDetails;
  mosqueName: string;
  donorId: string;
}

interface OptionTally {
  option: PollOption;
  totalTokens: number;
  percentage: number;
}

export default function VoteModal({ visible, onClose, poll, mosqueName, donorId }: VoteModalProps) {
  const { colors } = useTheme();
  const [selectedOptionId, setSelectedOptionId] = useState<string | null>(null);
  const [tokenBalance, setTokenBalance] = useState<number>(0);
  const [existingVoteCount, setExistingVoteCount] = useState(0);
  const [submitting, setSubmitting] = useState(false);
  const [loadingInfo, setLoadingInfo] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [tokensSpent, setTokensSpent] = useState(0);
  const [optionTallies, setOptionTallies] = useState<OptionTally[]>([]);

  const closeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const options = poll.options ?? [];
  const allVotes = poll.votes ?? [];

  const remainingVotes = poll.max_votes_per_person - existingVoteCount;
  const canAfford = tokenBalance >= poll.tokens_to_vote;
  const canVote = remainingVotes > 0 && canAfford && !!selectedOptionId;

  // Load donor balance + existing vote count
  const loadDonorInfo = useCallback(async () => {
    if (!visible || !donorId) return;
    setLoadingInfo(true);
    try {
      const [balanceRes, voteCountRes] = await Promise.all([
        supabase
          .from('donor_mosque_tokens')
          .select('token_balance')
          .eq('donor_id', donorId)
          .eq('mosque_id', poll.mosque_id)
          .maybeSingle(),
        supabase
          .from('votes')
          .select('id', { count: 'exact', head: true })
          .eq('donor_id', donorId)
          .eq('poll_id', poll.id),
      ]);

      if (balanceRes.error) throw balanceRes.error;
      if (voteCountRes.error) throw voteCountRes.error;

      setTokenBalance(balanceRes.data?.token_balance ?? 0);
      setExistingVoteCount(voteCountRes.count ?? 0);
    } catch (e: any) {
      setError(e.message ?? 'Failed to load your info.');
    } finally {
      setLoadingInfo(false);
    }
  }, [visible, donorId, poll.mosque_id, poll.id]);

  // Calculate tallies
  useEffect(() => {
    if (!options.length) return;
    const totals: Record<string, number> = {};
    let grandTotal = 0;
    for (const opt of options) totals[opt.id] = 0;
    for (const v of allVotes) {
      totals[v.option_id] = (totals[v.option_id] ?? 0) + v.tokens_spent;
      grandTotal += v.tokens_spent;
    }
    setOptionTallies(
      options.map((opt) => ({
        option: opt,
        totalTokens: totals[opt.id] ?? 0,
        percentage: grandTotal > 0 ? ((totals[opt.id] ?? 0) / grandTotal) * 100 : 0,
      }))
    );
  }, [options, allVotes]);

  // Reset on open
  useEffect(() => {
    if (visible) {
      setSelectedOptionId(null);
      setError(null);
      setSuccess(false);
      setTokensSpent(0);
      loadDonorInfo();
    }
    return () => {
      if (closeTimer.current) clearTimeout(closeTimer.current);
    };
  }, [visible, loadDonorInfo]);

  const handleSubmit = async () => {
    if (!selectedOptionId) {
      setError('Please select an option.');
      return;
    }
    if (remainingVotes <= 0) {
      setError('You have used all your votes on this poll.');
      return;
    }
    if (!canAfford) {
      setError(`You need ${poll.tokens_to_vote} tokens but only have ${tokenBalance}.`);
      return;
    }

    setSubmitting(true);
    setError(null);

    try {
      // 1. Insert vote
      const { error: voteErr } = await supabase.from('votes').insert({
        donor_id: donorId,
        poll_id: poll.id,
        option_id: selectedOptionId,
        tokens_spent: poll.tokens_to_vote,
      });
      if (voteErr) throw voteErr;

      // 2. Decrement tokens
      const newBalance = Math.max(0, tokenBalance - poll.tokens_to_vote);
      const { error: tokenErr } = await supabase
        .from('donor_mosque_tokens')
        .upsert({
          donor_id: donorId,
          mosque_id: poll.mosque_id,
          token_balance: newBalance,
        }, { onConflict: 'donor_id,mosque_id' });
      if (tokenErr) throw tokenErr;

      // Update local state so the UI reflects the change immediately
      setTokenBalance(newBalance);

      setTokensSpent(poll.tokens_to_vote);
      setSuccess(true);

      closeTimer.current = setTimeout(() => {
        onClose();
      }, 2000);
    } catch (e: any) {
      setError(e.message ?? 'Failed to cast vote.');
    } finally {
      setSubmitting(false);
    }
  };

  // ---------- render ----------

  const renderSuccess = () => (
    <View style={styles.successContainer}>
      <View style={styles.successIconWrap}>
        <CheckCircle size={56} color={Colors.primary} />
      </View>
      <Text style={[styles.successTitle, { color: colors.textPrimary }]}>Vote Cast!</Text>
      <Text style={[styles.successDetail, { color: colors.textSecondary }]}>
        {tokensSpent} token{tokensSpent !== 1 ? 's' : ''} spent
      </Text>
      <Text style={[styles.successDetail, { color: colors.textSecondary }]}>
        {remainingVotes - 1} vote{remainingVotes - 1 !== 1 ? 's' : ''} remaining on this poll
      </Text>
    </View>
  );

  const renderContent = () => (
    <ScrollView showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
      {/* Header */}
      <View style={styles.modalHeader}>
        <Text style={[styles.modalTitle, { color: colors.textPrimary }]}>Cast Your Vote</Text>
        <TouchableOpacity style={[styles.closeBtn, { backgroundColor: colors.stone100 }]} onPress={onClose} activeOpacity={0.7}>
          <X size={22} color={colors.textSecondary} />
        </TouchableOpacity>
      </View>

      {/* Poll info */}
      <Text style={[styles.pollQuestion, { color: colors.textPrimary }]}>{poll.question}</Text>
      {poll.description ? <Text style={[styles.pollDesc, { color: colors.textSecondary }]}>{poll.description}</Text> : null}
      <Text style={styles.mosqueLabel}>{mosqueName}</Text>

      {/* Stats row */}
      <View style={styles.statsRow}>
        <View style={[styles.statBox, { backgroundColor: colors.stone50 }]}>
          <Coins size={16} color={Colors.amber} />
          <Text style={[styles.statValue, { color: colors.textPrimary }]}>{poll.tokens_to_vote}</Text>
          <Text style={[styles.statLabel, { color: colors.textMuted }]}>per vote</Text>
        </View>
        <View style={[styles.statBox, { backgroundColor: colors.stone50 }]}>
          <Text style={[styles.statValue, { color: colors.textPrimary }]}>{tokenBalance}</Text>
          <Text style={[styles.statLabel, { color: colors.textMuted }]}>your tokens</Text>
        </View>
        <View style={[styles.statBox, { backgroundColor: colors.stone50 }]}>
          <Text style={[styles.statValue, { color: colors.textPrimary }]}>{remainingVotes}</Text>
          <Text style={[styles.statLabel, { color: colors.textMuted }]}>votes left</Text>
        </View>
      </View>

      {/* Warnings */}
      {!canAfford && !loadingInfo && (
        <View style={styles.warningBox}>
          <Text style={styles.warningText}>
            You need {poll.tokens_to_vote} tokens to vote. Earn more by donating to this mosque!
          </Text>
        </View>
      )}
      {remainingVotes <= 0 && !loadingInfo && (
        <View style={styles.warningBox}>
          <Text style={styles.warningText}>
            You've used all {poll.max_votes_per_person} vote{poll.max_votes_per_person !== 1 ? 's' : ''} on this poll.
          </Text>
        </View>
      )}

      {/* Options */}
      <Text style={[styles.sectionLabel, { color: colors.textMuted }]}>Options</Text>
      {optionTallies.map(({ option, totalTokens, percentage }) => {
        const isSelected = selectedOptionId === option.id;
        return (
          <TouchableOpacity
            key={option.id}
            style={[styles.optionCard, { backgroundColor: colors.stone50 }, isSelected && styles.optionCardSelected]}
            onPress={() => setSelectedOptionId(option.id)}
            activeOpacity={0.7}
            disabled={!canAfford || remainingVotes <= 0}
          >
            <View style={styles.optionTopRow}>
              {isSelected ? (
                <CircleDot size={22} color={Colors.primary} />
              ) : (
                <Circle size={22} color={Colors.stone300} />
              )}
              <Text style={[styles.optionText, { color: colors.textPrimary }, isSelected && styles.optionTextSelected]}>
                {option.option_text}
              </Text>
              <Text style={[styles.optionTokens, { color: colors.textMuted }]}>{totalTokens} tkn</Text>
            </View>
            {/* Percentage bar */}
            <View style={[styles.optionBarBg, { backgroundColor: colors.inputBorder }]}>
              <View
                style={[
                  styles.optionBarFill,
                  { width: `${percentage}%` },
                  isSelected && { backgroundColor: Colors.primary },
                ]}
              />
            </View>
            <Text style={[styles.optionPct, { color: colors.textMuted }]}>{Math.round(percentage)}%</Text>
          </TouchableOpacity>
        );
      })}

      {/* Error */}
      {error ? <Text style={styles.errorText}>{error}</Text> : null}

      {/* Submit */}
      <TouchableOpacity
        style={[
          styles.submitBtn,
          (!canVote || submitting) && styles.submitBtnDisabled,
        ]}
        onPress={handleSubmit}
        activeOpacity={0.7}
        disabled={!canVote || submitting}
      >
        {submitting ? (
          <ActivityIndicator size="small" color={Colors.white} />
        ) : (
          <Text style={styles.submitBtnText}>
            Vote ({poll.tokens_to_vote} token{poll.tokens_to_vote !== 1 ? 's' : ''})
          </Text>
        )}
      </TouchableOpacity>
    </ScrollView>
  );

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View style={styles.overlay}>
        <TouchableOpacity style={[styles.backdrop, { backgroundColor: colors.modalOverlay }]} activeOpacity={1} onPress={onClose} />
        <View style={[styles.card, { backgroundColor: colors.cardBg }]}>
          {loadingInfo ? (
            <View style={styles.loadingWrap}>
              <ActivityIndicator size="large" color={Colors.primary} />
              <Text style={[styles.loadingText, { color: colors.textMuted }]}>Loading poll…</Text>
            </View>
          ) : success ? (
            renderSuccess()
          ) : (
            renderContent()
          )}
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  backdrop: {
    ...StyleSheet.absoluteFill,
    backgroundColor: 'rgba(0,0,0,0.5)',
  },
  card: {
    backgroundColor: Colors.white,
    borderRadius: Radius.xl,
    width: '92%',
    maxWidth: 480,
    maxHeight: '88%',
    padding: Spacing.xxl,
    ...Platform.select({
      ios: { shadowColor: '#000', shadowOpacity: 0.15, shadowRadius: 20, shadowOffset: { width: 0, height: 8 } },
      android: { elevation: 12 },
      default: { shadowColor: '#000', shadowOpacity: 0.15, shadowRadius: 20, shadowOffset: { width: 0, height: 8 } },
    }),
  },

  /* Loading */
  loadingWrap: {
    alignItems: 'center',
    paddingVertical: Spacing.huge,
  },
  loadingText: {
    fontFamily: 'Inter-Regular',
    fontSize: FontSize.md,
    color: Colors.textMuted,
    marginTop: Spacing.md,
  },

  /* Header */
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: Spacing.lg,
  },
  modalTitle: {
    fontFamily: 'Inter-Bold',
    fontSize: FontSize.xl,
    color: Colors.textPrimary,
    flex: 1,
    marginRight: Spacing.sm,
  },
  closeBtn: {
    width: 44,
    height: 44,
    justifyContent: 'center',
    alignItems: 'center',
    borderRadius: Radius.full,
    backgroundColor: Colors.stone100,
    marginTop: -Spacing.xs,
    marginRight: -Spacing.xs,
  },

  /* Poll info */
  pollQuestion: {
    fontFamily: 'Inter-SemiBold',
    fontSize: FontSize.lg,
    color: Colors.textPrimary,
    marginBottom: Spacing.sm,
  },
  pollDesc: {
    fontFamily: 'Inter-Regular',
    fontSize: FontSize.sm,
    color: Colors.textSecondary,
    marginBottom: Spacing.sm,
    lineHeight: 19,
  },
  mosqueLabel: {
    fontFamily: 'Inter-Regular',
    fontSize: FontSize.sm,
    color: Colors.teal,
    marginBottom: Spacing.lg,
  },

  /* Stats */
  statsRow: {
    flexDirection: 'row',
    gap: Spacing.sm,
    marginBottom: Spacing.lg,
  },
  statBox: {
    flex: 1,
    flexDirection: 'column',
    alignItems: 'center',
    backgroundColor: Colors.stone50,
    paddingVertical: Spacing.md,
    borderRadius: Radius.md,
    gap: 2,
  },
  statValue: {
    fontFamily: 'Inter-Bold',
    fontSize: FontSize.lg,
    color: Colors.textPrimary,
  },
  statLabel: {
    fontFamily: 'Inter-Regular',
    fontSize: FontSize.xs,
    color: Colors.textMuted,
  },

  /* Warning */
  warningBox: {
    backgroundColor: Colors.amberFaint,
    padding: Spacing.md,
    borderRadius: Radius.md,
    marginBottom: Spacing.md,
  },
  warningText: {
    fontFamily: 'Inter-Regular',
    fontSize: FontSize.sm,
    color: Colors.amber,
    lineHeight: 19,
  },

  /* Section label */
  sectionLabel: {
    fontFamily: 'Inter-SemiBold',
    fontSize: FontSize.sm,
    color: Colors.textMuted,
    textTransform: 'uppercase',
    letterSpacing: 0.6,
    marginBottom: Spacing.sm,
  },

  /* Option card */
  optionCard: {
    backgroundColor: Colors.stone50,
    borderRadius: Radius.md,
    padding: Spacing.lg,
    marginBottom: Spacing.sm,
    borderWidth: 2,
    borderColor: 'transparent',
    minHeight: 48,
  },
  optionCardSelected: {
    borderColor: Colors.primary,
    backgroundColor: Colors.primaryFaint,
  },
  optionTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    marginBottom: Spacing.sm,
  },
  optionText: {
    flex: 1,
    fontFamily: 'Inter-SemiBold',
    fontSize: FontSize.md,
    color: Colors.textPrimary,
  },
  optionTextSelected: {
    color: Colors.primaryDark,
  },
  optionTokens: {
    fontFamily: 'Inter-Regular',
    fontSize: FontSize.xs,
    color: Colors.textMuted,
  },
  optionBarBg: {
    height: 6,
    borderRadius: Radius.full,
    backgroundColor: Colors.stone200,
    overflow: 'hidden',
    marginBottom: Spacing.xs,
  },
  optionBarFill: {
    height: 6,
    borderRadius: Radius.full,
    backgroundColor: Colors.teal,
  },
  optionPct: {
    fontFamily: 'Inter-Regular',
    fontSize: FontSize.xs,
    color: Colors.textMuted,
    textAlign: 'right',
  },

  /* Error */
  errorText: {
    fontFamily: 'Inter-Regular',
    fontSize: FontSize.sm,
    color: Colors.red,
    marginTop: Spacing.md,
    textAlign: 'center',
  },

  /* Submit */
  submitBtn: {
    backgroundColor: Colors.primary,
    borderRadius: Radius.md,
    paddingVertical: Spacing.lg,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 52,
    marginTop: Spacing.xl,
    marginBottom: Spacing.xs,
  },
  submitBtnDisabled: {
    opacity: 0.5,
  },
  submitBtnText: {
    fontFamily: 'Inter-Bold',
    fontSize: FontSize.md,
    color: Colors.white,
  },

  /* Success */
  successContainer: {
    alignItems: 'center',
    paddingVertical: Spacing.xxxl,
  },
  successIconWrap: {
    marginBottom: Spacing.xl,
  },
  successTitle: {
    fontFamily: 'Inter-Bold',
    fontSize: FontSize.xxl,
    color: Colors.textPrimary,
    marginBottom: Spacing.md,
  },
  successDetail: {
    fontFamily: 'Inter-Regular',
    fontSize: FontSize.md,
    color: Colors.textSecondary,
    marginBottom: Spacing.xs,
    textAlign: 'center',
  },
});
