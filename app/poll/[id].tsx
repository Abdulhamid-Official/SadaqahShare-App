import React, { useEffect, useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  ActivityIndicator,
  TouchableOpacity,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { ArrowLeft, Coins, Clock, BarChart3 } from 'lucide-react-native';
import { supabase } from '@/lib/supabase';
import { useAppContext } from '@/lib/context';
import { Colors, Spacing, Radius, FontSize, useTheme } from '@/lib/theme';
import { Poll, PollOption, Vote, Mosque } from '@/lib/types';
import VoteModal from '@/components/VoteModal';
import { useRealtimeTable } from '@/hooks/useRealtimeTable';
import { useSafeBack } from '@/lib/navigation';

interface PollFull extends Poll {
  poll_options: (PollOption & { votes: Pick<Vote, 'tokens_spent'>[] })[];
  mosques: Pick<Mosque, 'name'>;
}

export default function PollVoteScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { donor, isAdmin } = useAppContext();
  const { colors } = useTheme();
  const goBack = useSafeBack('/(donor-tabs)');

  const [poll, setPoll] = useState<PollFull | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [voteModalVisible, setVoteModalVisible] = useState(false);

  const loadPoll = useCallback(async () => {
    if (!id) return;
    setLoading(true);
    setError(null);
    try {
      const { data, error: fetchError } = await supabase
        .from('polls')
        .select(`
          *,
          mosques(name),
          poll_options(
            *,
            votes(tokens_spent)
          )
        `)
        .eq('id', id)
        .single();

      if (fetchError) throw fetchError;
      setPoll(data as PollFull);
    } catch (e: any) {
      setError(e.message ?? 'Failed to load poll');
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    loadPoll();
  }, [loadPoll]);

  useRealtimeTable('votes', null, loadPoll, !!id);
  useRealtimeTable('polls', id ? `id=eq.${id}` : null, loadPoll, !!id);

  const getTimeRemaining = (closesAt: string | null) => {
    if (!closesAt) return 'Open ended';
    const diff = new Date(closesAt).getTime() - Date.now();
    if (diff <= 0) return 'Ended';
    const hours = Math.floor(diff / (1000 * 60 * 60));
    const days = Math.floor(hours / 24);
    if (days > 0) return `${days}d ${hours % 24}h left`;
    if (hours > 0) return `${hours}h left`;
    const mins = Math.floor(diff / (1000 * 60));
    return `${mins}m left`;
  };

  if (loading) {
    return (
      <SafeAreaView style={[styles.safe, { backgroundColor: colors.background }]} edges={['top']}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={Colors.primary} />
          <Text style={[styles.loadingText, { color: colors.textMuted }]}>Loading poll…</Text>
        </View>
      </SafeAreaView>
    );
  }

  if (error || !poll) {
    return (
      <SafeAreaView style={[styles.safe, { backgroundColor: colors.background }]} edges={['top']}>
        <View style={styles.header}>
          <TouchableOpacity onPress={goBack} activeOpacity={0.7}>
            <ArrowLeft size={24} color={colors.textPrimary} />
          </TouchableOpacity>
        </View>
        <View style={styles.errorContainer}>
          <Text style={[styles.errorTitle, { color: colors.textPrimary }]}>Poll Not Found</Text>
          <Text style={[styles.errorMsg, { color: colors.textMuted }]}>{error ?? 'This poll may have been removed.'}</Text>
          <TouchableOpacity style={styles.backBtn} onPress={goBack} activeOpacity={0.7}>
            <Text style={styles.backBtnText}>Go Back</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  const totalTokens = poll.poll_options.reduce(
    (sum, opt) => sum + opt.votes.reduce((s, v) => s + (v.tokens_spent || 0), 0),
    0
  );

  const donorId = donor?.id ?? 'demo-donor';

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: colors.background }]} edges={['top']}>
      <View style={styles.header}>
        <TouchableOpacity onPress={goBack} activeOpacity={0.7}>
          <ArrowLeft size={24} color={colors.textPrimary} />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: colors.textPrimary }]}>Vote</Text>
        <View style={{ width: 24 }} />
      </View>

      <ScrollView style={styles.scrollView} contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        <View style={[styles.pollCard, { backgroundColor: colors.cardBg, borderColor: colors.cardBorder }]}>
          <View style={styles.pollMetaRow}>
            <View style={styles.pollMetaBadge}>
              <BarChart3 size={14} color={Colors.primary} />
              <Text style={styles.pollMetaText}>{poll.mosques?.name ?? 'Mosque'}</Text>
            </View>
            <View style={styles.pollMetaBadge}>
              <Clock size={14} color={Colors.textMuted} />
              <Text style={[styles.pollMetaText, { color: colors.textMuted }]}>{getTimeRemaining(poll.closes_at)}</Text>
            </View>
          </View>

          <Text style={[styles.pollQuestion, { color: colors.textPrimary }]}>{poll.question}</Text>
          {poll.description ? (
            <Text style={[styles.pollDesc, { color: colors.textSecondary }]}>{poll.description}</Text>
          ) : null}

          <View style={styles.costRow}>
            <Coins size={16} color={Colors.amber} />
            <Text style={[styles.costText, { color: colors.textSecondary }]}>
              {poll.tokens_to_vote} token{poll.tokens_to_vote !== 1 ? 's' : ''} per vote
            </Text>
          </View>
        </View>

        <Text style={[styles.sectionLabel, { color: colors.textMuted }]}>Options</Text>

        {poll.poll_options.map((opt) => {
          const optionTokens = opt.votes.reduce((s, v) => s + (v.tokens_spent || 0), 0);
          const pct = totalTokens > 0 ? (optionTokens / totalTokens) * 100 : 0;
          return (
            <View key={opt.id} style={[styles.optionCard, { backgroundColor: colors.cardBg, borderColor: colors.cardBorder }]}>
              <View style={styles.optionLabelRow}>
                <Text style={[styles.optionText, { color: colors.textPrimary }]} numberOfLines={2}>
                  {opt.option_text}
                </Text>
                <Text style={[styles.optionPct, { color: colors.textMuted }]}>{Math.round(pct)}%</Text>
              </View>
              <View style={[styles.progressTrack, { backgroundColor: colors.stone200 }]}>
                <View style={[styles.progressFill, { width: `${Math.max(pct, 2)}%` }]} />
              </View>
              <Text style={[styles.optionTokens, { color: colors.textMuted }]}>
                {optionTokens} token{optionTokens !== 1 ? 's' : ''} voted
              </Text>
            </View>
          );
        })}

        <TouchableOpacity
          style={styles.voteBtn}
          onPress={() => setVoteModalVisible(true)}
          activeOpacity={0.8}
        >
          <Text style={styles.voteBtnText}>Cast Your Vote</Text>
        </TouchableOpacity>
      </ScrollView>

      <VoteModal
        visible={voteModalVisible}
        onClose={() => {
          setVoteModalVisible(false);
          loadPoll();
        }}
        poll={{
          ...poll,
          options: poll.poll_options,
          votes: poll.poll_options.flatMap((o) => o.votes as Vote[]),
        }}
        mosqueName={poll.mosques?.name ?? 'Mosque'}
        donorId={donorId}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: Colors.background },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.md,
  },
  headerTitle: { fontFamily: 'Inter-Bold', fontSize: FontSize.xl, color: Colors.textPrimary },
  scrollView: { flex: 1 },
  scrollContent: { paddingHorizontal: Spacing.lg, paddingBottom: Spacing.huge },
  loadingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  loadingText: { fontFamily: 'Inter-Regular', fontSize: FontSize.md, marginTop: Spacing.md },
  errorContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', paddingHorizontal: Spacing.xxl },
  errorTitle: { fontFamily: 'Inter-Bold', fontSize: FontSize.xl, marginBottom: Spacing.sm },
  errorMsg: { fontFamily: 'Inter-Regular', fontSize: FontSize.md, textAlign: 'center', marginBottom: Spacing.xxl },
  backBtn: {
    backgroundColor: Colors.primary, paddingVertical: Spacing.md, paddingHorizontal: Spacing.xxl,
    borderRadius: Radius.md,
  },
  backBtnText: { fontFamily: 'Inter-Bold', fontSize: FontSize.md, color: Colors.white },
  pollCard: {
    borderRadius: Radius.lg, padding: Spacing.xl, borderWidth: 1, marginBottom: Spacing.xl,
  },
  pollMetaRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: Spacing.md },
  pollMetaBadge: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  pollMetaText: { fontFamily: 'Inter-SemiBold', fontSize: FontSize.xs, color: Colors.primary },
  pollQuestion: { fontFamily: 'Inter-Bold', fontSize: FontSize.xxl, color: Colors.textPrimary, marginBottom: Spacing.sm },
  pollDesc: { fontFamily: 'Inter-Regular', fontSize: FontSize.sm, lineHeight: 20, marginBottom: Spacing.md },
  costRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  costText: { fontFamily: 'Inter-SemiBold', fontSize: FontSize.sm },
  sectionLabel: {
    fontFamily: 'Inter-SemiBold', fontSize: FontSize.sm, color: Colors.textMuted,
    textTransform: 'uppercase', letterSpacing: 0.6, marginBottom: Spacing.md,
  },
  optionCard: {
    borderRadius: Radius.md, padding: Spacing.lg, marginBottom: Spacing.sm, borderWidth: 1,
  },
  optionLabelRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: Spacing.sm },
  optionText: { flex: 1, fontFamily: 'Inter-SemiBold', fontSize: FontSize.md, color: Colors.textPrimary },
  optionPct: { fontFamily: 'Inter-Bold', fontSize: FontSize.md, color: Colors.textMuted, marginLeft: Spacing.sm },
  progressTrack: { height: 6, borderRadius: 999, overflow: 'hidden', marginBottom: Spacing.xs },
  progressFill: { height: 6, borderRadius: 999, backgroundColor: Colors.primary },
  optionTokens: { fontFamily: 'Inter-Regular', fontSize: FontSize.xs },
  voteBtn: {
    backgroundColor: Colors.primary, borderRadius: Radius.md, paddingVertical: Spacing.lg,
    alignItems: 'center', justifyContent: 'center', minHeight: 52, marginTop: Spacing.xl,
  },
  voteBtnText: { fontFamily: 'Inter-Bold', fontSize: FontSize.md, color: Colors.white },
});
