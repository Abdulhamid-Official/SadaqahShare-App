import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  TouchableOpacity,
  TextInput,
  ScrollView,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { X, Plus } from 'lucide-react-native';
import { supabase } from '@/lib/supabase';
import { Colors, Spacing, Radius, FontSize, useTheme } from '@/lib/theme';
import { useDeviceSize } from '@/lib/responsive';

interface CreatePollModalProps {
  visible: boolean;
  onClose: () => void;
  mosqueId: string;
  onCreated: () => void;
}

type DurationOption = '1 Day' | '3 Days' | '1 Week' | '2 Weeks' | '1 Month' | 'No Limit';

const DURATIONS: DurationOption[] = [
  '1 Day',
  '3 Days',
  '1 Week',
  '2 Weeks',
  '1 Month',
  'No Limit',
];

const DURATION_MS: Record<DurationOption, number | null> = {
  '1 Day': 24 * 60 * 60 * 1000,
  '3 Days': 3 * 24 * 60 * 60 * 1000,
  '1 Week': 7 * 24 * 60 * 60 * 1000,
  '2 Weeks': 14 * 24 * 60 * 60 * 1000,
  '1 Month': 30 * 24 * 60 * 60 * 1000,
  'No Limit': null,
};

const MIN_OPTIONS = 2;
const MAX_OPTIONS = 6;

export default function CreatePollModal({
  visible,
  onClose,
  mosqueId,
  onCreated,
}: CreatePollModalProps) {
  const deviceSize = useDeviceSize();
  const isTablet = deviceSize !== 'phone';
  const { colors } = useTheme();

  const [question, setQuestion] = useState('');
  const [description, setDescription] = useState('');
  const [options, setOptions] = useState<string[]>(['', '']);
  const [duration, setDuration] = useState<DurationOption>('1 Week');
  const [tokensToVote, setTokensToVote] = useState('5');
  const [maxVotes, setMaxVotes] = useState('1');

  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Reset state when modal opens
  useEffect(() => {
    if (visible) {
      setQuestion('');
      setDescription('');
      setOptions(['', '']);
      setDuration('1 Week');
      setTokensToVote('5');
      setMaxVotes('1');
      setError(null);
      setSubmitting(false);
    }
  }, [visible]);

  const updateOption = (index: number, text: string) => {
    setOptions((prev) => {
      const updated = [...prev];
      updated[index] = text;
      return updated;
    });
    setError(null);
  };

  const addOption = () => {
    if (options.length < MAX_OPTIONS) {
      setOptions((prev) => [...prev, '']);
    }
  };

  const removeOption = (index: number) => {
    if (options.length > MIN_OPTIONS) {
      setOptions((prev) => prev.filter((_, i) => i !== index));
    }
  };

  const validate = (): string | null => {
    if (!question.trim()) return 'Please enter a question.';
    const nonEmpty = options.filter((o) => o.trim().length > 0);
    if (nonEmpty.length < 2) return 'Please provide at least 2 options.';
    const tokens = parseInt(tokensToVote, 10);
    if (!tokens || tokens < 1) return 'Tokens to vote must be at least 1.';
    const votes = parseInt(maxVotes, 10);
    if (!votes || votes < 1) return 'Max votes per person must be at least 1.';
    return null;
  };

  const handleSubmit = async () => {
    const validationError = validate();
    if (validationError) {
      setError(validationError);
      return;
    }

    setSubmitting(true);
    setError(null);

    try {
      // Calculate closes_at
      const durationMs = DURATION_MS[duration];
      const closesAt = durationMs ? new Date(Date.now() + durationMs).toISOString() : null;

      const tokens = Math.max(1, parseInt(tokensToVote, 10) || 1);
      const votes = Math.max(1, parseInt(maxVotes, 10) || 1);

      // 1. Insert poll
      const { data: pollData, error: pollErr } = await supabase
        .from('polls')
        .insert({
          mosque_id: mosqueId,
          question: question.trim(),
          description: description.trim() || null,
          status: 'active',
          tokens_to_vote: tokens,
          max_votes_per_person: votes,
          closes_at: closesAt,
        })
        .select('id')
        .single();

      if (pollErr) throw pollErr;

      // 2. Insert poll options (filter out empty)
      const nonEmptyOptions = options
        .map((o) => o.trim())
        .filter((o) => o.length > 0);

      const optionInserts = nonEmptyOptions.map((text) => ({
        poll_id: pollData.id,
        option_text: text,
      }));

      const { error: optionsErr } = await supabase
        .from('poll_options')
        .insert(optionInserts);

      if (optionsErr) throw optionsErr;

      onCreated();
      onClose();
    } catch (e: any) {
      setError(e.message ?? 'Something went wrong. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <KeyboardAvoidingView
        style={styles.overlay}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <TouchableOpacity style={[styles.backdrop, { backgroundColor: colors.modalOverlay }]} activeOpacity={1} onPress={onClose} />
        <View style={[styles.card, isTablet && styles.cardTablet, { backgroundColor: colors.cardBg }]}>
          <ScrollView
            showsVerticalScrollIndicator={false}
            keyboardShouldPersistTaps="handled"
            contentContainerStyle={styles.scrollContent}
          >
            {/* Header */}
            <View style={styles.modalHeader}>
              <Text style={[styles.modalTitle, { color: colors.textPrimary }]}>Create Poll</Text>
              <TouchableOpacity style={[styles.closeBtn, { backgroundColor: colors.stone100 }]} onPress={onClose} activeOpacity={0.7}>
                <X size={22} color={colors.textSecondary} />
              </TouchableOpacity>
            </View>

            {/* Question */}
            <Text style={[styles.fieldLabel, { color: colors.textPrimary }]}>
              Question<Text style={styles.required}> *</Text>
            </Text>
            <TextInput
              style={[styles.input, { backgroundColor: colors.inputBg, borderColor: colors.inputBorder, color: colors.textPrimary }]}
              value={question}
              onChangeText={(t) => {
                setQuestion(t);
                setError(null);
              }}
              placeholder="What would you like to ask?"
              placeholderTextColor={Colors.stone400}
              autoCapitalize="sentences"
            />

            {/* Description */}
            <Text style={[styles.fieldLabel, { color: colors.textPrimary }]}>Description</Text>
            <TextInput
              style={[styles.input, styles.inputMulti, { backgroundColor: colors.inputBg, borderColor: colors.inputBorder, color: colors.textPrimary }]}
              value={description}
              onChangeText={setDescription}
              placeholder="Optional context for the poll…"
              placeholderTextColor={Colors.stone400}
              multiline
              numberOfLines={3}
              textAlignVertical="top"
            />

            {/* Options */}
            <Text style={[styles.fieldLabel, { color: colors.textPrimary }]}>
              Options<Text style={styles.required}> *</Text>
            </Text>
            <Text style={[styles.fieldHint, { color: colors.textMuted }]}>
              Add between {MIN_OPTIONS} and {MAX_OPTIONS} options
            </Text>

            {options.map((optionText, index) => (
              <View key={index} style={styles.optionRow}>
                <View style={[styles.optionNumberBadge, { backgroundColor: colors.stone100 }]}>
                  <Text style={[styles.optionNumberText, { color: colors.textMuted }]}>{index + 1}</Text>
                </View>
                <TextInput
                  style={[styles.input, styles.optionInput, { backgroundColor: colors.inputBg, borderColor: colors.inputBorder, color: colors.textPrimary }]}
                  value={optionText}
                  onChangeText={(t) => updateOption(index, t)}
                  placeholder={`Option ${index + 1}`}
                  placeholderTextColor={Colors.stone400}
                  autoCapitalize="sentences"
                />
                {options.length > MIN_OPTIONS && (
                  <TouchableOpacity
                    style={styles.removeOptionBtn}
                    onPress={() => removeOption(index)}
                    activeOpacity={0.7}
                  >
                    <X size={18} color={Colors.red} />
                  </TouchableOpacity>
                )}
              </View>
            ))}

            {options.length < MAX_OPTIONS && (
              <TouchableOpacity
                style={styles.addOptionBtn}
                onPress={addOption}
                activeOpacity={0.7}
              >
                <Plus size={18} color={Colors.teal} />
                <Text style={styles.addOptionText}>Add Option</Text>
              </TouchableOpacity>
            )}

            {/* Duration */}
            <Text style={[styles.fieldLabel, { marginTop: Spacing.xl }]}>Duration</Text>
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              style={styles.pillScrollOuter}
              contentContainerStyle={styles.pillScrollContent}
            >
              {DURATIONS.map((d) => {
                const isSelected = duration === d;
                return (
                  <TouchableOpacity
                    key={d}
                    style={[styles.pill, { backgroundColor: colors.stone100 }, isSelected && styles.pillActive]}
                    onPress={() => setDuration(d)}
                    activeOpacity={0.7}
                  >
                    <Text style={[styles.pillText, { color: colors.textSecondary }, isSelected && styles.pillTextActive]}>
                      {d}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </ScrollView>

            {/* Tokens to Vote */}
            <Text style={[styles.fieldLabel, { color: colors.textPrimary }]}>Tokens to Vote</Text>
            <Text style={[styles.fieldHint, { color: colors.textMuted }]}>How many tokens each vote costs (min 1)</Text>
            <TextInput
              style={[styles.input, styles.inputSmall, { backgroundColor: colors.inputBg, borderColor: colors.inputBorder, color: colors.textPrimary }]}
              value={tokensToVote}
              onChangeText={(t) => {
                setTokensToVote(t.replace(/[^0-9]/g, ''));
                setError(null);
              }}
              keyboardType="number-pad"
              maxLength={5}
            />

            {/* Max Votes per Person */}
            <Text style={[styles.fieldLabel, { color: colors.textPrimary }]}>Max Votes per Person</Text>
            <Text style={[styles.fieldHint, { color: colors.textMuted }]}>How many times one person can vote (min 1)</Text>
            <TextInput
              style={[styles.input, styles.inputSmall, { backgroundColor: colors.inputBg, borderColor: colors.inputBorder, color: colors.textPrimary }]}
              value={maxVotes}
              onChangeText={(t) => {
                setMaxVotes(t.replace(/[^0-9]/g, ''));
                setError(null);
              }}
              keyboardType="number-pad"
              maxLength={3}
            />

            {/* Error */}
            {error ? <Text style={styles.errorText}>{error}</Text> : null}

            {/* Buttons */}
            <View style={styles.buttonRow}>
              <TouchableOpacity
                style={[styles.cancelBtn, { backgroundColor: colors.cardBg, borderColor: colors.inputBorder }]}
                onPress={onClose}
                activeOpacity={0.7}
              >
                <Text style={[styles.cancelBtnText, { color: colors.textSecondary }]}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.submitBtn, submitting && styles.submitBtnDisabled]}
                onPress={handleSubmit}
                activeOpacity={0.7}
                disabled={submitting}
              >
                {submitting ? (
                  <ActivityIndicator size="small" color={Colors.white} />
                ) : (
                  <Text style={styles.submitBtnText}>Create Poll</Text>
                )}
              </TouchableOpacity>
            </View>
          </ScrollView>
        </View>
      </KeyboardAvoidingView>
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
    maxHeight: '90%',
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOpacity: 0.18,
        shadowRadius: 24,
        shadowOffset: { width: 0, height: 10 },
      },
      android: { elevation: 14 },
      default: {
        shadowColor: '#000',
        shadowOpacity: 0.18,
        shadowRadius: 24,
        shadowOffset: { width: 0, height: 10 },
      },
    }),
  },
  cardTablet: {
    maxWidth: 500,
  },
  scrollContent: {
    padding: Spacing.xxl,
    paddingBottom: Spacing.xxxl,
  },

  /* Header */
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: Spacing.xl,
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

  /* Fields */
  fieldLabel: {
    fontFamily: 'Inter-SemiBold',
    fontSize: FontSize.sm,
    color: Colors.textPrimary,
    marginBottom: Spacing.xs,
    marginTop: Spacing.lg,
  },
  fieldHint: {
    fontFamily: 'Inter-Regular',
    fontSize: FontSize.xs,
    color: Colors.textMuted,
    marginBottom: Spacing.sm,
  },
  required: {
    color: Colors.red,
    fontFamily: 'Inter-Regular',
  },
  input: {
    backgroundColor: Colors.stone50,
    borderWidth: 1,
    borderColor: Colors.stone200,
    borderRadius: Radius.md,
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.md,
    fontFamily: 'Inter-Regular',
    fontSize: FontSize.md,
    color: Colors.textPrimary,
    minHeight: 48,
  },
  inputSmall: {
    width: 140,
  },
  inputMulti: {
    minHeight: 80,
    paddingTop: Spacing.md,
  },

  /* Options */
  optionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    marginBottom: Spacing.sm,
  },
  optionNumberBadge: {
    width: 28,
    height: 28,
    borderRadius: Radius.full,
    backgroundColor: Colors.stone100,
    justifyContent: 'center',
    alignItems: 'center',
  },
  optionNumberText: {
    fontFamily: 'Inter-SemiBold',
    fontSize: FontSize.xs,
    color: Colors.textMuted,
  },
  optionInput: {
    flex: 1,
  },
  removeOptionBtn: {
    width: 44,
    height: 44,
    justifyContent: 'center',
    alignItems: 'center',
    borderRadius: Radius.md,
    backgroundColor: Colors.redFaint,
  },
  addOptionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.sm,
    paddingVertical: Spacing.md,
    borderRadius: Radius.md,
    borderWidth: 1.5,
    borderColor: Colors.teal,
    borderStyle: 'dashed',
    minHeight: 48,
    marginTop: Spacing.xs,
  },
  addOptionText: {
    fontFamily: 'Inter-SemiBold',
    fontSize: FontSize.sm,
    color: Colors.teal,
  },

  /* Duration pills */
  pillScrollOuter: {
    marginHorizontal: -Spacing.xxl,
  },
  pillScrollContent: {
    paddingHorizontal: Spacing.xxl,
    gap: Spacing.sm,
    flexDirection: 'row',
  },
  pill: {
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.md,
    borderRadius: Radius.full,
    backgroundColor: Colors.stone100,
    minHeight: 44,
    justifyContent: 'center',
    alignItems: 'center',
  },
  pillActive: {
    backgroundColor: Colors.teal,
  },
  pillText: {
    fontFamily: 'Inter-Regular',
    fontSize: FontSize.sm,
    color: Colors.textSecondary,
  },
  pillTextActive: {
    fontFamily: 'Inter-SemiBold',
    color: Colors.white,
  },

  /* Error */
  errorText: {
    fontFamily: 'Inter-Regular',
    fontSize: FontSize.sm,
    color: Colors.red,
    marginTop: Spacing.lg,
    textAlign: 'center',
  },

  /* Buttons */
  buttonRow: {
    flexDirection: 'row',
    gap: Spacing.md,
    marginTop: Spacing.xxl,
  },
  cancelBtn: {
    flex: 1,
    borderRadius: Radius.md,
    paddingVertical: Spacing.lg,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 52,
    borderWidth: 1.5,
    borderColor: Colors.stone300,
    backgroundColor: Colors.white,
  },
  cancelBtnText: {
    fontFamily: 'Inter-SemiBold',
    fontSize: FontSize.md,
    color: Colors.textSecondary,
  },
  submitBtn: {
    flex: 2,
    backgroundColor: Colors.teal,
    borderRadius: Radius.md,
    paddingVertical: Spacing.lg,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 52,
  },
  submitBtnDisabled: {
    opacity: 0.7,
  },
  submitBtnText: {
    fontFamily: 'Inter-Bold',
    fontSize: FontSize.md,
    color: Colors.white,
  },
});
