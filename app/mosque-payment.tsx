import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { CreditCard, Lock, ArrowLeft } from 'lucide-react-native';
import { supabase } from '@/lib/supabase';
import { useAppContext } from '@/lib/context';
import { Colors, Spacing, Radius, FontSize, useTheme } from '@/lib/theme';

export default function MosquePaymentScreen() {
  const { logout, setIsPaid, mosqueAccount, isAdmin } = useAppContext();
  const { colors } = useTheme();

  const [cardName, setCardName] = useState('');
  const [cardNumber, setCardNumber] = useState('');
  const [expiry, setExpiry] = useState('');
  const [cvc, setCvc] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [processing, setProcessing] = useState(false);

  const formatCardNumber = (text: string) => {
    const cleaned = text.replace(/[^0-9]/g, '').slice(0, 16);
    return cleaned.replace(/(.{4})/g, '$1 ').trim();
  };

  const formatExpiry = (text: string) => {
    const cleaned = text.replace(/[^0-9]/g, '').slice(0, 4);
    if (cleaned.length >= 3) {
      return cleaned.slice(0, 2) + '/' + cleaned.slice(2);
    }
    return cleaned;
  };

  const handleSubscribe = () => {
    if (!cardName.trim()) { setError('Please enter the name on your card.'); return; }
    if (cardNumber.replace(/\s/g, '').length < 16) { setError('Please enter a valid card number.'); return; }
    if (expiry.length < 5) { setError('Please enter a valid expiry date.'); return; }
    if (cvc.length < 3) { setError('Please enter a valid CVC.'); return; }

    setError(null);
    setProcessing(true);

    setTimeout(async () => {
      if (!isAdmin && mosqueAccount) {
        await supabase
          .from('mosque_accounts')
          .update({ is_paid: true })
          .eq('id', mosqueAccount.id);
      }
      setProcessing(false);
      setIsPaid(true);
      router.replace('/(mosque-tabs)');
    }, 2000);
  };

  const handleGoBack = () => {
    logout();
    router.replace('/');
  };

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: colors.background }]}>
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <TouchableOpacity
            style={styles.backButton}
            onPress={handleGoBack}
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          >
            <ArrowLeft size={22} color={Colors.stone600} />
            <Text style={styles.backText}>Back to Sign In</Text>
          </TouchableOpacity>

          <View style={[styles.card, { backgroundColor: colors.cardBg, borderColor: colors.cardBorder }]}>
            <View style={styles.iconCircle}>
              <CreditCard size={32} color={Colors.white} />
            </View>

            <Text style={[styles.title, { color: colors.textPrimary }]}>Mosque Subscription</Text>
            <Text style={[styles.subtitle, { color: colors.textSecondary }]}>
              A subscription is required to manage your mosque on SadaqahShare.
            </Text>

            <View style={styles.priceCard}>
              <Text style={styles.priceAmount}>$35</Text>
              <Text style={[styles.pricePeriod, { color: colors.textMuted }]}>/month</Text>
            </View>

            <View style={styles.featureList}>
              <Text style={[styles.featureItem, { color: colors.textSecondary }]}>Manage needs and fundraisers</Text>
              <Text style={[styles.featureItem, { color: colors.textSecondary }]}>Create community polls</Text>
              <Text style={[styles.featureItem, { color: colors.textSecondary }]}>View and manage pledges</Text>
              <Text style={[styles.featureItem, { color: colors.textSecondary }]}>Member management</Text>
            </View>

            <View style={styles.separator} />

            <View style={styles.inputGroup}>
              <Text style={[styles.label, { color: colors.textPrimary }]}>Name on Card</Text>
              <TextInput
                style={[styles.input, { backgroundColor: colors.inputBg, borderColor: colors.inputBorder, color: colors.textPrimary }]}
                placeholder="John Doe"
                placeholderTextColor={Colors.stone400}
                autoCapitalize="words"
                value={cardName}
                onChangeText={(t) => { setCardName(t); setError(null); }}
              />
            </View>

            <View style={styles.inputGroup}>
              <Text style={[styles.label, { color: colors.textPrimary }]}>Card Number</Text>
              <TextInput
                style={[styles.input, { backgroundColor: colors.inputBg, borderColor: colors.inputBorder, color: colors.textPrimary }]}
                placeholder="1234 5678 9012 3456"
                placeholderTextColor={Colors.stone400}
                keyboardType="number-pad"
                value={cardNumber}
                onChangeText={(t) => { setCardNumber(formatCardNumber(t)); setError(null); }}
                maxLength={19}
              />
            </View>

            <View style={styles.row}>
              <View style={[styles.inputGroup, { flex: 1, marginRight: Spacing.md }]}>
                <Text style={[styles.label, { color: colors.textPrimary }]}>Expiry</Text>
                <TextInput
                  style={[styles.input, { backgroundColor: colors.inputBg, borderColor: colors.inputBorder, color: colors.textPrimary }]}
                  placeholder="MM/YY"
                  placeholderTextColor={Colors.stone400}
                  keyboardType="number-pad"
                  value={expiry}
                  onChangeText={(t) => { setExpiry(formatExpiry(t)); setError(null); }}
                  maxLength={5}
                />
              </View>
              <View style={[styles.inputGroup, { flex: 1 }]}>
                <Text style={[styles.label, { color: colors.textPrimary }]}>CVC</Text>
                <TextInput
                  style={[styles.input, { backgroundColor: colors.inputBg, borderColor: colors.inputBorder, color: colors.textPrimary }]}
                  placeholder="123"
                  placeholderTextColor={Colors.stone400}
                  keyboardType="number-pad"
                  secureTextEntry
                  value={cvc}
                  onChangeText={(t) => { setCvc(t.replace(/[^0-9]/g, '').slice(0, 4)); setError(null); }}
                  maxLength={4}
                />
              </View>
            </View>

            {error && <Text style={styles.errorText}>{error}</Text>}

            <TouchableOpacity
              style={[styles.primaryButton, processing && styles.buttonDisabled]}
              onPress={handleSubscribe}
              activeOpacity={0.8}
              disabled={processing}
            >
              <Lock size={18} color={Colors.white} />
              <Text style={styles.primaryButtonText}>
                {processing ? 'Processing...' : 'Subscribe — $35/mo'}
              </Text>
            </TouchableOpacity>

            <Text style={[styles.secureNote, { color: colors.textMuted }]}>
              Your payment information is secure and encrypted
            </Text>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: Colors.background },
  flex: { flex: 1 },
  scrollContent: {
    flexGrow: 1,
    justifyContent: 'center',
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.xxxl,
  },
  backButton: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    marginBottom: Spacing.xxl,
    minHeight: 44,
    paddingVertical: Spacing.sm,
  },
  backText: {
    fontFamily: 'Inter-SemiBold',
    fontSize: FontSize.md,
    color: Colors.stone600,
    marginLeft: Spacing.sm,
  },
  card: {
    backgroundColor: Colors.cardBg,
    borderRadius: Radius.xl,
    padding: Spacing.xxl,
    alignItems: 'center',
    shadowColor: Colors.black,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.08,
    shadowRadius: 16,
    elevation: 6,
    borderWidth: 1,
    borderColor: Colors.cardBorder,
  },
  iconCircle: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: Colors.teal,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: Spacing.lg,
  },
  title: {
    fontFamily: 'Inter-Bold',
    fontSize: FontSize.xxl,
    color: Colors.textPrimary,
    marginBottom: Spacing.sm,
    textAlign: 'center',
  },
  subtitle: {
    fontFamily: 'Inter-Regular',
    fontSize: FontSize.sm,
    color: Colors.textSecondary,
    textAlign: 'center',
    marginBottom: Spacing.xl,
    lineHeight: 20,
  },
  priceCard: {
    flexDirection: 'row',
    alignItems: 'baseline',
    marginBottom: Spacing.lg,
  },
  priceAmount: {
    fontFamily: 'Inter-Bold',
    fontSize: 48,
    color: Colors.teal,
  },
  pricePeriod: {
    fontFamily: 'Inter-Regular',
    fontSize: FontSize.lg,
    color: Colors.textMuted,
    marginLeft: Spacing.xs,
  },
  featureList: {
    width: '100%',
    marginBottom: Spacing.xl,
    gap: Spacing.sm,
  },
  featureItem: {
    fontFamily: 'Inter-Regular',
    fontSize: FontSize.sm,
    color: Colors.textSecondary,
    paddingLeft: Spacing.lg,
    lineHeight: 22,
  },
  separator: {
    width: '100%',
    height: 1,
    backgroundColor: Colors.stone200,
    marginBottom: Spacing.xl,
  },
  inputGroup: { width: '100%', marginBottom: Spacing.lg },
  label: {
    fontFamily: 'Inter-SemiBold',
    fontSize: FontSize.sm,
    color: Colors.textPrimary,
    marginBottom: Spacing.sm,
  },
  input: {
    width: '100%',
    height: 50,
    backgroundColor: Colors.stone50,
    borderRadius: Radius.md,
    paddingHorizontal: Spacing.lg,
    fontFamily: 'Inter-Regular',
    fontSize: FontSize.md,
    color: Colors.textPrimary,
    borderWidth: 1,
    borderColor: Colors.stone200,
  },
  row: { flexDirection: 'row', width: '100%' },
  errorText: {
    fontFamily: 'Inter-SemiBold',
    fontSize: FontSize.sm,
    color: Colors.red,
    textAlign: 'center',
    marginBottom: Spacing.lg,
    width: '100%',
  },
  primaryButton: {
    width: '100%',
    height: 52,
    backgroundColor: Colors.teal,
    borderRadius: Radius.md,
    justifyContent: 'center',
    alignItems: 'center',
    flexDirection: 'row',
    gap: Spacing.sm,
    marginTop: Spacing.sm,
  },
  buttonDisabled: { opacity: 0.7 },
  primaryButtonText: {
    fontFamily: 'Inter-Bold',
    fontSize: FontSize.md,
    color: Colors.white,
  },
  secureNote: {
    fontFamily: 'Inter-Regular',
    fontSize: FontSize.xs,
    color: Colors.textMuted,
    marginTop: Spacing.lg,
    textAlign: 'center',
  },
});
