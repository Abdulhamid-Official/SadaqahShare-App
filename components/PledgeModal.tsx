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
import { X, CheckCircle, Coins, MapPin as DropPin, CreditCard, Lock } from 'lucide-react-native';
import { supabase } from '@/lib/supabase';
import { Need } from '@/lib/types';
import { Colors, Spacing, Radius, FontSize, useTheme } from '@/lib/theme';
import { useAppContext } from '@/lib/context';
import { router } from 'expo-router';

interface PledgeModalProps {
  visible: boolean;
  onClose: () => void;
  need: Need;
  mosqueName: string;
  mosqueId: string;
}

type Step = 'form' | 'checkout' | 'processing' | 'thankyou';

export default function PledgeModal({ visible, onClose, need, mosqueName, mosqueId }: PledgeModalProps) {
  const { donor, setDonor, isAdmin } = useAppContext();
  const { colors } = useTheme();

  const [name, setName] = useState(donor?.name ?? '');
  const [email, setEmail] = useState(donor?.email ?? '');
  const [quantity, setQuantity] = useState('1');
  const [notes, setNotes] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [step, setStep] = useState<Step>('form');
  const [earnedTokens, setEarnedTokens] = useState(0);

  // Checkout fields
  const [cardNumber, setCardNumber] = useState('');
  const [cardExpiry, setCardExpiry] = useState('');
  const [cardCvc, setCardCvc] = useState('');
  const [cardName, setCardName] = useState('');

  const closeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const remaining = need.quantity_needed - need.quantity_pledged;
  const qty = Math.max(1, Math.min(parseInt(quantity, 10) || 1, remaining));
  const tokensPreview = qty * need.tokens_per_unit;
  const rawAmount = need.amount_dollars != null ? Number(need.amount_dollars) : null;
  const isMoney = need.type === 'money' && rawAmount != null && !isNaN(rawAmount);
  const dollarTotal = isMoney ? qty * rawAmount! : null;

  useEffect(() => {
    if (visible) {
      setName(donor?.name ?? '');
      setEmail(donor?.email ?? '');
      setQuantity('1');
      setNotes('');
      setError(null);
      setStep('form');
      setEarnedTokens(0);
      setCardNumber('');
      setCardExpiry('');
      setCardCvc('');
      setCardName('');
    }
    return () => {
      if (closeTimer.current) clearTimeout(closeTimer.current);
    };
  }, [visible, donor]);

  const validate = (): string | null => {
    if (!name.trim()) return 'Please enter your name.';
    if (!email.trim() || !email.includes('@')) return 'Please enter a valid email.';
    const q = parseInt(quantity, 10);
    if (!q || q < 1) return 'Quantity must be at least 1.';
    if (q > remaining) return `Only ${remaining} remaining to pledge.`;
    return null;
  };

  const validateCard = (): string | null => {
    if (!cardName.trim()) return 'Please enter the name on the card.';
    if (cardNumber.replace(/\s/g, '').length < 15) return 'Please enter a valid card number.';
    if (!/^\d{2}\/\d{2}$/.test(cardExpiry)) return 'Enter expiry as MM/YY.';
    if (cardCvc.length < 3) return 'Enter a valid CVC.';
    return null;
  };

  const formatCardNumber = (raw: string) => {
    const digits = raw.replace(/\D/g, '').slice(0, 16);
    return digits.replace(/(.{4})/g, '$1 ').trim();
  };

  const formatExpiry = (raw: string) => {
    const digits = raw.replace(/\D/g, '').slice(0, 4);
    if (digits.length <= 2) return digits;
    return `${digits.slice(0, 2)}/${digits.slice(2)}`;
  };

  // Submit the pledge to the database (shared by item + money flows)
  const submitPledge = async () => {
    const normalizedEmail = email.trim().toLowerCase();
    const trimmedName = name.trim();
    const q = parseInt(quantity, 10);
    const tokens = q * need.tokens_per_unit;

    if (isAdmin) {
      setEarnedTokens(tokens);
      return;
    }

    const { data: existingDonor, error: findErr } = await supabase
      .from('donors')
      .select('*')
      .eq('email', normalizedEmail)
      .maybeSingle();
    if (findErr) throw findErr;

    let donorId: string;

    if (existingDonor) {
      donorId = existingDonor.id;
      if (existingDonor.name !== trimmedName) {
        await supabase.from('donors').update({ name: trimmedName }).eq('id', donorId);
      }
    } else {
      const { data: newDonor, error: createErr } = await supabase
        .from('donors')
        .insert({ email: normalizedEmail, name: trimmedName, token_balance: 0, is_member: false })
        .select()
        .single();
      if (createErr) throw createErr;
      donorId = newDonor.id;
    }

    const { error: pledgeErr } = await supabase.from('pledges').insert({
      need_id: need.id,
      donor_id: donorId,
      donor_name: trimmedName,
      donor_email: normalizedEmail,
      quantity: q,
      delivery_method: need.type === 'item' ? 'dropoff' : null,
      notes: notes.trim() || null,
      status: 'pending',
      tokens_earned: tokens,
    });
    if (pledgeErr) throw pledgeErr;

    const { error: needUpdateErr } = await supabase
      .from('needs')
      .update({ quantity_pledged: need.quantity_pledged + q })
      .eq('id', need.id);
    if (needUpdateErr) throw needUpdateErr;

    if (donor && donor.email === normalizedEmail) {
      setDonor({ ...donor, name: trimmedName });
    }

    setEarnedTokens(tokens);
  };

  // "Submit Pledge" on the form step
  const handleFormSubmit = () => {
    const validationError = validate();
    if (validationError) {
      setError(validationError);
      return;
    }
    setError(null);
    if (isMoney) {
      setStep('checkout');
    } else {
      handlePledge();
    }
  };

  // Process the pledge (item donations go straight here; money goes through checkout first)
  const handlePledge = async () => {
    setSubmitting(true);
    setError(null);
    try {
      await submitPledge();
      setStep('thankyou');
    } catch (e: any) {
      setError(e.message ?? 'Something went wrong. Please try again.');
      setStep('form');
    } finally {
      setSubmitting(false);
    }
  };

  // "Pay Now" on the checkout step
  const handleCheckout = () => {
    const cardError = validateCard();
    if (cardError) {
      setError(cardError);
      return;
    }
    setError(null);
    setStep('processing');
    // Simulate payment processing
    closeTimer.current = setTimeout(() => {
      handlePledge();
    }, 1800);
  };

  // Close from thank-you step -> go home
  const handleThankYouClose = () => {
    onClose();
    router.replace('/(donor-tabs)');
  };

  // ---------- render: thank you ----------
  const renderThankYou = () => (
    <View style={styles.successContainer}>
      <TouchableOpacity style={styles.successCloseBtn} onPress={handleThankYouClose} activeOpacity={0.7}>
        <X size={22} color={colors.textSecondary} />
      </TouchableOpacity>
      <View style={styles.successIconWrap}>
        <CheckCircle size={64} color={Colors.primary} />
      </View>
      <Text style={[styles.successTitle, { color: colors.textPrimary }]}>Alhamdulillah!</Text>
      <Text style={[styles.successSubtitle, { color: colors.textSecondary }]}>
        Thank you for your donation to {mosqueName}.
      </Text>
      <View style={styles.successDetailBox}>
        <Text style={[styles.successDetailLabel, { color: colors.textMuted }]}>You pledged</Text>
        <Text style={[styles.successDetailValue, { color: colors.textPrimary }]}>
          {qty} x {need.name}
        </Text>
        {dollarTotal != null && (
          <Text style={[styles.successDetailValue, { color: colors.textPrimary }]}>
            ${dollarTotal.toLocaleString(undefined, { minimumFractionDigits: 2 })}
          </Text>
        )}
      </View>
      <View style={[styles.tokenDirections, { backgroundColor: colors.amberFaint }]}>
        <Coins size={24} color={Colors.amber} />
        <Text style={[styles.tokenDirectionsTitle, { color: colors.amber }]}>
          You earned {earnedTokens} tokens!
        </Text>
        <Text style={[styles.tokenDirectionsText, { color: colors.textSecondary }]}>
          To receive your tokens, give your donation to the mosque in person. Once the mosque confirms receipt, your tokens will be added to your balance for {mosqueName}.
        </Text>
      </View>
      <TouchableOpacity style={styles.doneBtn} onPress={handleThankYouClose} activeOpacity={0.8}>
        <Text style={styles.doneBtnText}>Done</Text>
      </TouchableOpacity>
    </View>
  );

  // ---------- render: checkout ----------
  const renderCheckout = () => (
    <ScrollView showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
      <View style={styles.modalHeader}>
        <Text style={[styles.modalTitle, { color: colors.textPrimary }]}>Checkout</Text>
        <TouchableOpacity style={[styles.closeBtn, { backgroundColor: colors.stone100 }]} onPress={() => { setStep('form'); setError(null); }} activeOpacity={0.7}>
          <X size={22} color={colors.textSecondary} />
        </TouchableOpacity>
      </View>

      {/* Payment summary */}
      <View style={[styles.paymentSummary, { backgroundColor: colors.stone50, borderColor: colors.cardBorder }]}>
        <View style={styles.summaryRow}>
          <Text style={[styles.summaryLabel, { color: colors.textMuted }]}>{need.name}</Text>
          <Text style={[styles.summaryValue, { color: colors.textPrimary }]}>x{qty}</Text>
        </View>
        <View style={[styles.summaryDivider, { backgroundColor: colors.cardBorder }]} />
        <View style={styles.summaryRow}>
          <Text style={[styles.summaryTotalLabel, { color: colors.textPrimary }]}>Total</Text>
          <Text style={styles.summaryTotalValue}>
            ${dollarTotal?.toLocaleString(undefined, { minimumFractionDigits: 2 })}
          </Text>
        </View>
      </View>

      {/* Card fields */}
      <View style={styles.secureRow}>
        <Lock size={14} color={Colors.primary} />
        <Text style={styles.secureText}>Secure payment (demo only)</Text>
      </View>

      <Text style={[styles.fieldLabel, { color: colors.textPrimary }]}>Name on Card</Text>
      <TextInput
        style={[styles.input, { backgroundColor: colors.inputBg, borderColor: colors.inputBorder, color: colors.textPrimary }]}
        value={cardName}
        onChangeText={setCardName}
        placeholder="Full name"
        placeholderTextColor={Colors.stone400}
        autoCapitalize="words"
      />

      <Text style={[styles.fieldLabel, { color: colors.textPrimary }]}>Card Number</Text>
      <View style={[styles.cardInputWrap, { backgroundColor: colors.inputBg, borderColor: colors.inputBorder }]}>
        <CreditCard size={18} color={Colors.stone400} />
        <TextInput
          style={[styles.cardInput, { color: colors.textPrimary }]}
          value={cardNumber}
          onChangeText={(t) => setCardNumber(formatCardNumber(t))}
          placeholder="1234 5678 9012 3456"
          placeholderTextColor={Colors.stone400}
          keyboardType="number-pad"
          maxLength={19}
        />
      </View>

      <View style={styles.cardBottomRow}>
        <View style={{ flex: 1 }}>
          <Text style={[styles.fieldLabel, { color: colors.textPrimary }]}>Expiry</Text>
          <TextInput
            style={[styles.input, { backgroundColor: colors.inputBg, borderColor: colors.inputBorder, color: colors.textPrimary }]}
            value={cardExpiry}
            onChangeText={(t) => setCardExpiry(formatExpiry(t))}
            placeholder="MM/YY"
            placeholderTextColor={Colors.stone400}
            keyboardType="number-pad"
            maxLength={5}
          />
        </View>
        <View style={{ flex: 1, marginLeft: Spacing.md }}>
          <Text style={[styles.fieldLabel, { color: colors.textPrimary }]}>CVC</Text>
          <TextInput
            style={[styles.input, { backgroundColor: colors.inputBg, borderColor: colors.inputBorder, color: colors.textPrimary }]}
            value={cardCvc}
            onChangeText={(t) => setCardCvc(t.replace(/\D/g, '').slice(0, 4))}
            placeholder="123"
            placeholderTextColor={Colors.stone400}
            keyboardType="number-pad"
            maxLength={4}
            secureTextEntry
          />
        </View>
      </View>

      <View style={styles.tokenPreview}>
        <Coins size={20} color={Colors.amber} />
        <View style={styles.tokenPreviewText}>
          <Text style={[styles.tokenPreviewMain, { color: colors.textPrimary }]}>
            You'll earn {tokensPreview} token{tokensPreview !== 1 ? 's' : ''} at {mosqueName}
          </Text>
          <Text style={[styles.tokenPreviewSub, { color: colors.textSecondary }]}>
            Tokens awarded after mosque confirms receipt
          </Text>
        </View>
      </View>

      {error ? <Text style={styles.errorText}>{error}</Text> : null}

      <TouchableOpacity
        style={[styles.submitBtn, submitting && styles.submitBtnDisabled]}
        onPress={handleCheckout}
        activeOpacity={0.7}
        disabled={submitting}
      >
        <Text style={styles.submitBtnText}>
          Pay ${dollarTotal?.toLocaleString(undefined, { minimumFractionDigits: 2 })}
        </Text>
      </TouchableOpacity>
    </ScrollView>
  );

  // ---------- render: processing ----------
  const renderProcessing = () => (
    <View style={styles.processingContainer}>
      <ActivityIndicator size="large" color={Colors.primary} />
      <Text style={[styles.processingText, { color: colors.textSecondary }]}>Processing payment…</Text>
    </View>
  );

  // ---------- render: form ----------
  const renderForm = () => (
    <ScrollView showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
      <View style={styles.modalHeader}>
        <Text style={[styles.modalTitle, { color: colors.textPrimary }]}>Donate to {mosqueName}</Text>
        <TouchableOpacity style={[styles.closeBtn, { backgroundColor: colors.stone100 }]} onPress={onClose} activeOpacity={0.7}>
          <X size={22} color={colors.textSecondary} />
        </TouchableOpacity>
      </View>

      <Text style={styles.needLabel}>{need.name}</Text>
      {need.description ? <Text style={[styles.needDescModal, { color: colors.textSecondary }]}>{need.description}</Text> : null}

      <Text style={[styles.fieldLabel, { color: colors.textPrimary }]}>Your Name</Text>
      <TextInput
        style={[styles.input, { backgroundColor: colors.inputBg, borderColor: colors.inputBorder, color: colors.textPrimary }]}
        value={name}
        onChangeText={setName}
        placeholder="Full name"
        placeholderTextColor={Colors.stone400}
        autoCapitalize="words"
      />

      <Text style={[styles.fieldLabel, { color: colors.textPrimary }]}>Email Address</Text>
      <TextInput
        style={[styles.input, { backgroundColor: colors.inputBg, borderColor: colors.inputBorder, color: colors.textPrimary }]}
        value={email}
        onChangeText={setEmail}
        placeholder="you@example.com"
        placeholderTextColor={Colors.stone400}
        keyboardType="email-address"
        autoCapitalize="none"
      />

      <Text style={[styles.fieldLabel, { color: colors.textPrimary }]}>
        Quantity{' '}
        <Text style={[styles.fieldHint, { color: colors.textMuted }]}>({remaining} remaining)</Text>
      </Text>
      <TextInput
        style={[styles.input, styles.inputSmall, { backgroundColor: colors.inputBg, borderColor: colors.inputBorder, color: colors.textPrimary }]}
        value={quantity}
        onChangeText={(t) => setQuantity(t.replace(/[^0-9]/g, ''))}
        keyboardType="number-pad"
        maxLength={6}
      />

      {need.type === 'item' && (
        <View style={styles.deliveryNotice}>
          <DropPin size={18} color={Colors.teal} />
          <Text style={styles.deliveryNoticeText}>Drop off at mosque</Text>
        </View>
      )}

      <Text style={[styles.fieldLabel, { color: colors.textPrimary }]}>Notes (optional)</Text>
      <TextInput
        style={[styles.input, styles.inputMulti, { backgroundColor: colors.inputBg, borderColor: colors.inputBorder, color: colors.textPrimary }]}
        value={notes}
        onChangeText={setNotes}
        placeholder="Any message for the mosque..."
        placeholderTextColor={Colors.stone400}
        multiline
        numberOfLines={3}
        textAlignVertical="top"
      />

      <View style={styles.tokenPreview}>
        <Coins size={20} color={Colors.amber} />
        <View style={styles.tokenPreviewText}>
          <Text style={[styles.tokenPreviewMain, { color: colors.textPrimary }]}>
            You'll earn {tokensPreview} token{tokensPreview !== 1 ? 's' : ''} at {mosqueName}
          </Text>
          <Text style={[styles.tokenPreviewSub, { color: colors.textSecondary }]}>
            Tokens awarded after mosque confirms receipt
          </Text>
          {dollarTotal != null && (
            <Text style={[styles.tokenPreviewSub, { color: colors.textSecondary }]}>
              Total: ${dollarTotal.toLocaleString(undefined, { minimumFractionDigits: 2 })}
            </Text>
          )}
        </View>
      </View>

      {error ? <Text style={styles.errorText}>{error}</Text> : null}

      <TouchableOpacity
        style={[styles.submitBtn, submitting && styles.submitBtnDisabled]}
        onPress={handleFormSubmit}
        activeOpacity={0.7}
        disabled={submitting}
      >
        {submitting ? (
          <ActivityIndicator size="small" color={Colors.white} />
        ) : (
          <Text style={styles.submitBtnText}>
            {isMoney ? 'Continue to Payment' : 'Submit Pledge'}
          </Text>
        )}
      </TouchableOpacity>
    </ScrollView>
  );

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <KeyboardAvoidingView
        style={styles.overlay}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <TouchableOpacity
          style={[styles.backdrop, { backgroundColor: colors.modalOverlay }]}
          activeOpacity={1}
          onPress={step === 'processing' ? undefined : onClose}
        />
        <View style={[styles.card, { backgroundColor: colors.cardBg }]}>
          {step === 'thankyou'
            ? renderThankYou()
            : step === 'processing'
            ? renderProcessing()
            : step === 'checkout'
            ? renderCheckout()
            : renderForm()}
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  backdrop: { ...StyleSheet.absoluteFill, backgroundColor: 'rgba(0,0,0,0.5)' },
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
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: Spacing.lg },
  modalTitle: { fontFamily: 'Inter-Bold', fontSize: FontSize.xl, color: Colors.textPrimary, flex: 1, marginRight: Spacing.sm },
  closeBtn: {
    width: 44, height: 44, justifyContent: 'center', alignItems: 'center',
    borderRadius: Radius.full, backgroundColor: Colors.stone100, marginTop: -Spacing.xs, marginRight: -Spacing.xs,
  },
  needLabel: { fontFamily: 'Inter-SemiBold', fontSize: FontSize.md, color: Colors.teal, marginBottom: Spacing.xs },
  needDescModal: { fontFamily: 'Inter-Regular', fontSize: FontSize.sm, color: Colors.textSecondary, marginBottom: Spacing.lg, lineHeight: 19 },
  fieldLabel: { fontFamily: 'Inter-SemiBold', fontSize: FontSize.sm, color: Colors.textPrimary, marginBottom: Spacing.xs, marginTop: Spacing.md },
  fieldHint: { fontFamily: 'Inter-Regular', color: Colors.textMuted },
  input: {
    backgroundColor: Colors.stone50, borderWidth: 1, borderColor: Colors.stone200, borderRadius: Radius.md,
    paddingHorizontal: Spacing.lg, paddingVertical: Spacing.md, fontFamily: 'Inter-Regular', fontSize: FontSize.md,
    color: Colors.textPrimary, minHeight: 48,
  },
  inputSmall: { width: 120 },
  inputMulti: { minHeight: 80, paddingTop: Spacing.md },
  deliveryNotice: {
    flexDirection: 'row', alignItems: 'center', gap: Spacing.sm,
    backgroundColor: '#ccfbf1', padding: Spacing.lg, borderRadius: Radius.md, marginTop: Spacing.md,
  },
  deliveryNoticeText: { fontFamily: 'Inter-SemiBold', fontSize: FontSize.sm, color: Colors.teal },
  tokenPreview: {
    flexDirection: 'row', alignItems: 'center', gap: Spacing.md,
    backgroundColor: Colors.amberFaint, padding: Spacing.lg, borderRadius: Radius.md, marginTop: Spacing.xl,
  },
  tokenPreviewText: { flex: 1 },
  tokenPreviewMain: { fontFamily: 'Inter-SemiBold', fontSize: FontSize.sm, color: Colors.stone800 },
  tokenPreviewSub: { fontFamily: 'Inter-Regular', fontSize: FontSize.xs, color: Colors.textSecondary, marginTop: 2 },
  errorText: { fontFamily: 'Inter-Regular', fontSize: FontSize.sm, color: Colors.red, marginTop: Spacing.md, textAlign: 'center' },
  submitBtn: {
    backgroundColor: Colors.primary, borderRadius: Radius.md, paddingVertical: Spacing.lg,
    alignItems: 'center', justifyContent: 'center', minHeight: 52, marginTop: Spacing.xl, marginBottom: Spacing.xs,
  },
  submitBtnDisabled: { opacity: 0.7 },
  submitBtnText: { fontFamily: 'Inter-Bold', fontSize: FontSize.md, color: Colors.white },

  // Checkout styles
  paymentSummary: {
    borderRadius: Radius.md, padding: Spacing.lg, borderWidth: 1, marginBottom: Spacing.lg,
  },
  summaryRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  summaryLabel: { fontFamily: 'Inter-Regular', fontSize: FontSize.sm },
  summaryValue: { fontFamily: 'Inter-SemiBold', fontSize: FontSize.sm },
  summaryDivider: { height: 1, marginVertical: Spacing.sm },
  summaryTotalLabel: { fontFamily: 'Inter-Bold', fontSize: FontSize.md },
  summaryTotalValue: { fontFamily: 'Inter-Bold', fontSize: FontSize.xl, color: Colors.primary },
  secureRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: Spacing.md },
  secureText: { fontFamily: 'Inter-Regular', fontSize: FontSize.xs, color: Colors.primary },
  cardInputWrap: {
    flexDirection: 'row', alignItems: 'center', borderWidth: 1, borderRadius: Radius.md,
    paddingHorizontal: Spacing.lg, minHeight: 48, gap: Spacing.sm,
  },
  cardInput: { flex: 1, fontFamily: 'Inter-Regular', fontSize: FontSize.md, minHeight: 48 },
  cardBottomRow: { flexDirection: 'row' },

  // Processing
  processingContainer: { alignItems: 'center', paddingVertical: Spacing.huge },
  processingText: { fontFamily: 'Inter-Regular', fontSize: FontSize.md, marginTop: Spacing.lg },

  // Thank you
  successContainer: { alignItems: 'center', paddingVertical: Spacing.xxl },
  successCloseBtn: {
    position: 'absolute', top: -Spacing.sm, right: -Spacing.sm,
    width: 44, height: 44, justifyContent: 'center', alignItems: 'center',
    borderRadius: Radius.full, backgroundColor: Colors.stone100,
  },
  successIconWrap: { marginBottom: Spacing.lg },
  successTitle: { fontFamily: 'Inter-Bold', fontSize: FontSize.xxxl, color: Colors.textPrimary, marginBottom: Spacing.xs },
  successSubtitle: { fontFamily: 'Inter-Regular', fontSize: FontSize.md, color: Colors.textSecondary, textAlign: 'center', marginBottom: Spacing.xl, lineHeight: 22 },
  successDetailBox: { alignItems: 'center', marginBottom: Spacing.xl },
  successDetailLabel: { fontFamily: 'Inter-Regular', fontSize: FontSize.sm, marginBottom: 4 },
  successDetailValue: { fontFamily: 'Inter-SemiBold', fontSize: FontSize.lg, marginBottom: 2 },
  tokenDirections: {
    borderRadius: Radius.lg, padding: Spacing.xl, alignItems: 'center', gap: Spacing.sm, width: '100%',
  },
  tokenDirectionsTitle: { fontFamily: 'Inter-Bold', fontSize: FontSize.md },
  tokenDirectionsText: { fontFamily: 'Inter-Regular', fontSize: FontSize.sm, textAlign: 'center', lineHeight: 20 },
  doneBtn: {
    backgroundColor: Colors.primary, borderRadius: Radius.md, paddingVertical: Spacing.lg,
    alignItems: 'center', justifyContent: 'center', minHeight: 52, marginTop: Spacing.xxl, width: '100%',
  },
  doneBtnText: { fontFamily: 'Inter-Bold', fontSize: FontSize.md, color: Colors.white },
});
