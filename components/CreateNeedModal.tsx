import React, { useState, useEffect, useRef } from 'react';
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
import { X, Link as LinkIcon, DollarSign, Package } from 'lucide-react-native';
import { supabase } from '@/lib/supabase';
import { Colors, Spacing, Radius, FontSize, useTheme } from '@/lib/theme';
import { useDeviceSize } from '@/lib/responsive';
import { Need } from '@/lib/types';

interface CreateNeedModalProps {
  visible: boolean;
  onClose: () => void;
  mosqueId: string;
  onCreated: () => void;
  defaultType?: 'item' | 'money';
  editNeed?: Need | null;
}

type NeedType = 'item' | 'money';
type Priority = 'Urgent' | 'High' | 'Medium' | 'Low';

const CATEGORIES = [
  'Furnishings',
  'Appliances',
  'Food',
  'Educational',
  'Clothing',
  'Medical',
  'Supplies',
  'General',
] as const;

const PRIORITIES: { label: Priority; color: string; bgColor: string }[] = [
  { label: 'Urgent', color: Colors.red, bgColor: Colors.redFaint },
  { label: 'High', color: Colors.amber, bgColor: Colors.amberFaint },
  { label: 'Medium', color: Colors.blue, bgColor: Colors.blueFaint },
  { label: 'Low', color: Colors.stone500, bgColor: Colors.stone100 },
];

const PRIORITY_TOKENS: Record<Priority, number> = {
  Urgent: 25,
  High: 15,
  Medium: 10,
  Low: 5,
};

const CATEGORY_MULTIPLIERS: Record<string, number> = {
  Furnishings: 1.5,
  Appliances: 2.0,
  Food: 0.5,
  Educational: 1.0,
  Clothing: 0.8,
  Medical: 1.8,
  Supplies: 0.6,
  General: 1.0,
};

function suggestTokens(priority: Priority, category: string, itemName: string): number {
  const base = PRIORITY_TOKENS[priority];
  const catMult = CATEGORY_MULTIPLIERS[category] || 1.0;
  const name = itemName.toLowerCase();
  let valueMult = 1.0;
  if (/carpet|rug|furniture|chair|table|desk|shelf/i.test(name)) valueMult = 1.5;
  else if (/ac|air.?condition|refrigerat|fridge|washer|dryer|appliance/i.test(name)) valueMult = 2.0;
  else if (/book|quran|pen|paper|notebook/i.test(name)) valueMult = 0.7;
  else if (/food|rice|water|meal|snack/i.test(name)) valueMult = 0.5;
  else if (/medicine|medical|wheelchair|first.?aid/i.test(name)) valueMult = 1.8;
  else if (/computer|laptop|tablet|projector|screen/i.test(name)) valueMult = 2.5;
  return Math.max(1, Math.round(base * catMult * valueMult));
}

export default function CreateNeedModal({
  visible,
  onClose,
  mosqueId,
  onCreated,
  defaultType,
  editNeed,
}: CreateNeedModalProps) {
  const deviceSize = useDeviceSize();
  const isTablet = deviceSize !== 'phone';
  const { colors } = useTheme();

  const [needType, setNeedType] = useState<NeedType>(defaultType ?? 'item');
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [category, setCategory] = useState<string>('General');
  const [quantity, setQuantity] = useState('1');
  const [priority, setPriority] = useState<Priority>('Medium');
  const [tokensPerUnit, setTokensPerUnit] = useState('10');
  const [purchaseLink, setPurchaseLink] = useState('');
  const [amountDollars, setAmountDollars] = useState('');

  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Track whether the user manually edited tokens
  const tokensManuallyEdited = useRef(false);

  const isEditing = !!editNeed;

  // Reset state when modal opens
  useEffect(() => {
    if (visible) {
      if (editNeed) {
        setNeedType(editNeed.type);
        setName(editNeed.name);
        setDescription(editNeed.description ?? '');
        setCategory(editNeed.category);
        setQuantity(String(editNeed.quantity_needed));
        setPriority(editNeed.priority as Priority);
        setTokensPerUnit(String(editNeed.tokens_per_unit));
        setPurchaseLink(editNeed.purchase_link ?? '');
        setAmountDollars(editNeed.amount_dollars != null ? String(editNeed.amount_dollars) : '');
        tokensManuallyEdited.current = true;
      } else {
        setNeedType(defaultType ?? 'item');
        setName('');
        setDescription('');
        setCategory('General');
        setQuantity('1');
        setPriority('Medium');
        setTokensPerUnit(String(PRIORITY_TOKENS.Medium));
        setPurchaseLink('');
        setAmountDollars('');
        tokensManuallyEdited.current = false;
      }
      setError(null);
      setSubmitting(false);
    }
  }, [visible, editNeed, defaultType]);

  const handlePriorityChange = (p: Priority) => {
    setPriority(p);
    if (!tokensManuallyEdited.current) {
      setTokensPerUnit(String(suggestTokens(p, category, name)));
    }
  };

  const handleTokensChange = (text: string) => {
    const cleaned = text.replace(/[^0-9]/g, '');
    setTokensPerUnit(cleaned);
    tokensManuallyEdited.current = true;
  };

  const handleTypeChange = (type: NeedType) => {
    setNeedType(type);
    setError(null);
    tokensManuallyEdited.current = false;
    setTokensPerUnit(String(suggestTokens(priority, category, name)));
  };

  const handleNameChange = (text: string) => {
    setName(text);
    setError(null);
    if (!tokensManuallyEdited.current) {
      setTokensPerUnit(String(suggestTokens(priority, category, text)));
    }
  };

  const handleCategoryChange = (cat: string) => {
    setCategory(cat);
    if (!tokensManuallyEdited.current) {
      setTokensPerUnit(String(suggestTokens(priority, cat, name)));
    }
  };

  const validate = (): string | null => {
    if (!name.trim()) return 'Please enter a name.';
    if (needType === 'money') {
      const amt = parseFloat(amountDollars);
      if (!amountDollars.trim() || isNaN(amt) || amt <= 0) {
        return 'Please enter a valid dollar amount.';
      }
    }
    const q = parseInt(quantity, 10);
    if (!q || q < 1) return 'Quantity must be at least 1.';
    const t = parseInt(tokensPerUnit, 10);
    if (!t || t < 1) return 'Tokens per unit must be at least 1.';
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
      const payload: Record<string, unknown> = {
        name: name.trim(),
        description: description.trim() || null,
        category: needType === 'money' ? 'General' : category,
        quantity_needed: parseInt(quantity, 10),
        priority,
        tokens_per_unit: parseInt(tokensPerUnit, 10),
        type: needType,
        amount_dollars: needType === 'money' ? parseFloat(amountDollars) : null,
        purchase_link: needType === 'item' && purchaseLink.trim() ? purchaseLink.trim() : null,
        updated_at: new Date().toISOString(),
      };

      let opErr;
      if (isEditing && editNeed) {
        const { error } = await supabase.from('needs').update(payload).eq('id', editNeed.id);
        opErr = error;
      } else {
        const { error } = await supabase.from('needs').insert({ ...payload, mosque_id: mosqueId, quantity_pledged: 0 });
        opErr = error;
      }

      if (opErr) throw opErr;

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
              <Text style={[styles.modalTitle, { color: colors.textPrimary }]}>
                {isEditing ? 'Edit' : 'Create'} {needType === 'item' ? 'Item' : 'Fundraiser'}
              </Text>
              <TouchableOpacity style={[styles.closeBtn, { backgroundColor: colors.stone100 }]} onPress={onClose} activeOpacity={0.7}>
                <X size={22} color={colors.textSecondary} />
              </TouchableOpacity>
            </View>

            {/* Type Toggle */}
            <View style={[styles.typeToggleRow, { backgroundColor: colors.stone100 }]}>
              <TouchableOpacity
                style={[styles.typeToggleBtn, needType === 'item' && styles.typeToggleBtnActive]}
                onPress={() => handleTypeChange('item')}
                activeOpacity={0.7}
              >
                <Package
                  size={18}
                  color={needType === 'item' ? Colors.white : colors.textSecondary}
                />
                <Text
                  style={[
                    styles.typeToggleText,
                    { color: colors.textSecondary },
                    needType === 'item' && styles.typeToggleTextActive,
                  ]}
                >
                  Item
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.typeToggleBtn, needType === 'money' && styles.typeToggleBtnActive]}
                onPress={() => handleTypeChange('money')}
                activeOpacity={0.7}
              >
                <DollarSign
                  size={18}
                  color={needType === 'money' ? Colors.white : colors.textSecondary}
                />
                <Text
                  style={[
                    styles.typeToggleText,
                    { color: colors.textSecondary },
                    needType === 'money' && styles.typeToggleTextActive,
                  ]}
                >
                  Money
                </Text>
              </TouchableOpacity>
            </View>

            {/* Name */}
            <Text style={[styles.fieldLabel, { color: colors.textPrimary }]}>
              {needType === 'item' ? 'Name' : 'Fundraiser Name'}
              <Text style={styles.required}> *</Text>
            </Text>
            <TextInput
              style={[styles.input, { backgroundColor: colors.inputBg, borderColor: colors.inputBorder, color: colors.textPrimary }]}
              value={name}
              onChangeText={handleNameChange}
              placeholder={
                needType === 'item' ? 'e.g. Prayer Rugs' : 'e.g. AC Repair Fund'
              }
              placeholderTextColor={Colors.stone400}
              autoCapitalize="words"
            />

            {/* Description */}
            <Text style={[styles.fieldLabel, { color: colors.textPrimary }]}>Description</Text>
            <TextInput
              style={[styles.input, styles.inputMulti, { backgroundColor: colors.inputBg, borderColor: colors.inputBorder, color: colors.textPrimary }]}
              value={description}
              onChangeText={setDescription}
              placeholder="Optional description…"
              placeholderTextColor={Colors.stone400}
              multiline
              numberOfLines={3}
              textAlignVertical="top"
            />

            {/* Category (item only) */}
            {needType === 'item' && (
              <>
                <Text style={[styles.fieldLabel, { color: colors.textPrimary }]}>Category</Text>
                <ScrollView
                  horizontal
                  showsHorizontalScrollIndicator={false}
                  style={styles.pillScrollOuter}
                  contentContainerStyle={styles.pillScrollContent}
                >
                  {CATEGORIES.map((cat) => {
                    const isSelected = category === cat;
                    return (
                      <TouchableOpacity
                        key={cat}
                        style={[styles.pill, { backgroundColor: colors.stone100 }, isSelected && styles.pillActive]}
                        onPress={() => handleCategoryChange(cat)}
                        activeOpacity={0.7}
                      >
                        <Text
                          style={[styles.pillText, { color: colors.textSecondary }, isSelected && styles.pillTextActive]}
                        >
                          {cat}
                        </Text>
                      </TouchableOpacity>
                    );
                  })}
                </ScrollView>
              </>
            )}

            {/* Amount (money only) */}
            {needType === 'money' && (
              <>
                <Text style={[styles.fieldLabel, { color: colors.textPrimary }]}>
                  Amount per Unit ($)
                  <Text style={styles.required}> *</Text>
                </Text>
                <TextInput
                  style={[styles.input, styles.inputSmall, { backgroundColor: colors.inputBg, borderColor: colors.inputBorder, color: colors.textPrimary }]}
                  value={amountDollars}
                  onChangeText={(t) => {
                    // Allow digits and one decimal point
                    const cleaned = t.replace(/[^0-9.]/g, '');
                    // Prevent multiple dots
                    const parts = cleaned.split('.');
                    const formatted =
                      parts.length > 2 ? parts[0] + '.' + parts.slice(1).join('') : cleaned;
                    setAmountDollars(formatted);
                    setError(null);
                  }}
                  placeholder="0.00"
                  placeholderTextColor={Colors.stone400}
                  keyboardType="decimal-pad"
                />
              </>
            )}

            {/* Quantity */}
            <Text style={[styles.fieldLabel, { color: colors.textPrimary }]}>
              {needType === 'money' ? 'Number of Units / Quantity' : 'Quantity'}
            </Text>
            <TextInput
              style={[styles.input, styles.inputSmall, { backgroundColor: colors.inputBg, borderColor: colors.inputBorder, color: colors.textPrimary }]}
              value={quantity}
              onChangeText={(t) => setQuantity(t.replace(/[^0-9]/g, ''))}
              keyboardType="number-pad"
              maxLength={6}
            />

            {/* Priority */}
            <Text style={[styles.fieldLabel, { color: colors.textPrimary }]}>Priority</Text>
            <View style={styles.priorityRow}>
              {PRIORITIES.map((p) => {
                const isSelected = priority === p.label;
                return (
                  <TouchableOpacity
                    key={p.label}
                    style={[
                      styles.priorityPill,
                      { backgroundColor: isSelected ? p.bgColor : colors.stone100 },
                      isSelected && { borderColor: p.color },
                    ]}
                    onPress={() => handlePriorityChange(p.label)}
                    activeOpacity={0.7}
                  >
                    <Text
                      style={[
                        styles.priorityPillText,
                        { color: isSelected ? p.color : colors.textMuted },
                        isSelected && { fontFamily: 'Inter-SemiBold' },
                      ]}
                    >
                      {p.label}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>

            {/* Tokens per unit */}
            <Text style={[styles.fieldLabel, { color: colors.textPrimary }]}>Tokens per Unit</Text>
            <TextInput
              style={[styles.input, styles.inputSmall, { backgroundColor: colors.inputBg, borderColor: colors.inputBorder, color: colors.textPrimary }]}
              value={tokensPerUnit}
              onChangeText={handleTokensChange}
              keyboardType="number-pad"
              maxLength={5}
            />

            {/* Purchase Link (item only) */}
            {needType === 'item' && (
              <>
                <View style={styles.fieldLabelRow}>
                  <LinkIcon size={14} color={colors.textMuted} />
                  <Text style={[styles.fieldLabelInline, { color: colors.textPrimary }]}>Purchase Link</Text>
                </View>
                <TextInput
                  style={[styles.input, { backgroundColor: colors.inputBg, borderColor: colors.inputBorder, color: colors.textPrimary }]}
                  value={purchaseLink}
                  onChangeText={setPurchaseLink}
                  placeholder="https://..."
                  placeholderTextColor={Colors.stone400}
                  autoCapitalize="none"
                  keyboardType="url"
                />
              </>
            )}

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
                  <Text style={styles.submitBtnText}>
                    {isEditing ? 'Save' : 'Create'} {needType === 'item' ? 'Item' : 'Fundraiser'}
                  </Text>
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

  /* Type Toggle */
  typeToggleRow: {
    flexDirection: 'row',
    backgroundColor: Colors.stone100,
    borderRadius: Radius.md,
    padding: 3,
    marginBottom: Spacing.xl,
  },
  typeToggleBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.sm,
    paddingVertical: Spacing.md,
    borderRadius: Radius.sm,
    minHeight: 48,
  },
  typeToggleBtnActive: {
    backgroundColor: Colors.teal,
  },
  typeToggleText: {
    fontFamily: 'Inter-SemiBold',
    fontSize: FontSize.md,
    color: Colors.textSecondary,
  },
  typeToggleTextActive: {
    color: Colors.white,
  },

  /* Fields */
  fieldLabel: {
    fontFamily: 'Inter-SemiBold',
    fontSize: FontSize.sm,
    color: Colors.textPrimary,
    marginBottom: Spacing.xs,
    marginTop: Spacing.lg,
  },
  fieldLabelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: Spacing.lg,
    marginBottom: Spacing.xs,
  },
  fieldLabelInline: {
    fontFamily: 'Inter-SemiBold',
    fontSize: FontSize.sm,
    color: Colors.textPrimary,
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

  /* Category pills */
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

  /* Priority */
  priorityRow: {
    flexDirection: 'row',
    gap: Spacing.sm,
  },
  priorityPill: {
    flex: 1,
    paddingVertical: Spacing.sm,
    borderRadius: Radius.md,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 44,
    borderWidth: 1.5,
    borderColor: 'transparent',
  },
  priorityPillText: {
    fontFamily: 'Inter-Regular',
    fontSize: FontSize.sm,
    color: Colors.textMuted,
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
