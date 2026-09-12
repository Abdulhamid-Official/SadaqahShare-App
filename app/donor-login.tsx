import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
  ScrollView,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { Heart, ArrowLeft, CheckCircle } from 'lucide-react-native';
import { supabase } from '@/lib/supabase';
import { useAppContext } from '@/lib/context';
import { Donor } from '@/lib/types';
import { Colors, Spacing, Radius, FontSize, useTheme } from '@/lib/theme';

type Stage = 'input' | 'welcome-back';

export default function DonorLoginScreen() {
  const { setRole, setDonor, setIsAdmin } = useAppContext();
  const { colors } = useTheme();

  const [email, setEmail] = useState('');
  const [name, setName] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [stage, setStage] = useState<Stage>('input');
  const [foundDonor, setFoundDonor] = useState<Donor | null>(null);

  const handleContinue = async () => {
    const trimmedEmail = email.trim().toLowerCase();
    const trimmedName = name.trim();

    // Admin mode
    if (trimmedEmail === 'admin' && trimmedName === 'admin') {
      const adminDonor: Donor = {
        id: 'admin-donor',
        email: 'admin@sadaqahshare.demo',
        name: 'Admin (Demo)',
        token_balance: 999999,
        is_member: true,
        created_at: new Date().toISOString(),
      };
      setIsAdmin(true);
      setRole('donor');
      setDonor(adminDonor);
      router.replace('/(donor-tabs)');
      return;
    }

    if (!trimmedEmail) {
      setError('Please enter your email address.');
      return;
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(trimmedEmail)) {
      setError('Please enter a valid email address.');
      return;
    }

    setError(null);
    setLoading(true);

    try {
      const { data: existing, error: fetchError } = await supabase
        .from('donors')
        .select('*')
        .eq('email', trimmedEmail)
        .maybeSingle();

      if (fetchError) {
        setError(fetchError.message);
        setLoading(false);
        return;
      }

      if (existing) {
        setFoundDonor(existing as Donor);
        setStage('welcome-back');
        setLoading(false);
        return;
      }

      if (!trimmedName) {
        setError('Please enter your name to create an account.');
        setLoading(false);
        return;
      }

      const { data: newDonor, error: createError } = await supabase
        .from('donors')
        .upsert(
          { email: trimmedEmail, name: trimmedName },
          { onConflict: 'email' }
        )
        .select('*')
        .single();

      if (createError) {
        setError(createError.message);
        setLoading(false);
        return;
      }

      setIsAdmin(false);
      setRole('donor');
      setDonor(newDonor as Donor);
      router.replace('/(donor-tabs)');
    } catch (e: any) {
      setError(e.message || 'Something went wrong. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleGoToDashboard = () => {
    if (!foundDonor) return;
    setIsAdmin(false);
    setRole('donor');
    setDonor(foundDonor);
    router.replace('/(donor-tabs)');
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
        >
          <TouchableOpacity
            style={styles.backButton}
            onPress={() => router.back()}
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          >
            <ArrowLeft size={22} color={Colors.stone600} />
            <Text style={styles.backText}>Back</Text>
          </TouchableOpacity>

          <View style={[styles.card, { backgroundColor: colors.cardBg, borderColor: colors.cardBorder }]}>
            <View style={styles.iconCircle}>
              <Heart size={32} color={Colors.white} fill={Colors.white} />
            </View>

            <Text style={[styles.title, { color: colors.textPrimary }]}>Donor Access</Text>
            <Text style={[styles.subtitle, { color: colors.textSecondary }]}>
              Enter your email to continue or create a new account
            </Text>

            {stage === 'input' && (
              <>
                <View style={styles.inputGroup}>
                  <Text style={[styles.label, { color: colors.textPrimary }]}>Email Address</Text>
                  <TextInput
                    style={[styles.input, { backgroundColor: colors.inputBg, borderColor: colors.inputBorder, color: colors.textPrimary }]}
                    placeholder="your@email.com"
                    placeholderTextColor={Colors.stone400}
                    keyboardType="email-address"
                    autoCapitalize="none"
                    autoCorrect={false}
                    value={email}
                    onChangeText={(t) => {
                      setEmail(t);
                      setError(null);
                    }}
                    editable={!loading}
                  />
                </View>

                <View style={styles.inputGroup}>
                  <Text style={[styles.label, { color: colors.textPrimary }]}>Your Name</Text>
                  <TextInput
                    style={[styles.input, { backgroundColor: colors.inputBg, borderColor: colors.inputBorder, color: colors.textPrimary }]}
                    placeholder="Enter your full name"
                    placeholderTextColor={Colors.stone400}
                    autoCapitalize="words"
                    value={name}
                    onChangeText={(t) => {
                      setName(t);
                      setError(null);
                    }}
                    editable={!loading}
                  />
                  <Text style={styles.hint}>
                    Required for new accounts
                  </Text>
                </View>

                {error && <Text style={styles.errorText}>{error}</Text>}

                <TouchableOpacity
                  style={[styles.primaryButton, loading && styles.buttonDisabled]}
                  onPress={handleContinue}
                  activeOpacity={0.8}
                  disabled={loading}
                >
                  {loading ? (
                    <ActivityIndicator color={Colors.white} size="small" />
                  ) : (
                    <Text style={styles.primaryButtonText}>Continue</Text>
                  )}
                </TouchableOpacity>
              </>
            )}

            {stage === 'welcome-back' && foundDonor && (
              <>
                <View style={styles.welcomeContainer}>
                  <View style={styles.checkCircle}>
                    <CheckCircle
                      size={48}
                      color={Colors.primary}
                      strokeWidth={1.5}
                    />
                  </View>
                  <Text style={[styles.welcomeTitle, { color: colors.textPrimary }]}>Welcome Back!</Text>
                  <Text style={styles.welcomeName}>{foundDonor.name}</Text>
                  <Text style={[styles.welcomeEmail, { color: colors.textMuted }]}>{foundDonor.email}</Text>
                  {foundDonor.is_member && (
                    <View style={styles.memberBadge}>
                      <Text style={styles.memberBadgeText}>Member</Text>
                    </View>
                  )}
                </View>

                {error && <Text style={styles.errorText}>{error}</Text>}

                <TouchableOpacity
                  style={styles.primaryButton}
                  onPress={handleGoToDashboard}
                  activeOpacity={0.8}
                >
                  <Text style={styles.primaryButtonText}>Go to Dashboard</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={styles.secondaryButton}
                  onPress={() => {
                    setStage('input');
                    setFoundDonor(null);
                    setError(null);
                  }}
                  activeOpacity={0.7}
                >
                  <Text style={styles.secondaryButtonText}>
                    Use a different account
                  </Text>
                </TouchableOpacity>
              </>
            )}
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
    backgroundColor: Colors.primary,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: Spacing.lg,
    shadowColor: Colors.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 12,
    elevation: 4,
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
    marginBottom: Spacing.xxl,
    lineHeight: 20,
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
  hint: {
    fontFamily: 'Inter-Regular',
    fontSize: FontSize.xs,
    color: Colors.textMuted,
    marginTop: Spacing.xs,
  },
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
    backgroundColor: Colors.primary,
    borderRadius: Radius.md,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: Colors.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 8,
    elevation: 4,
    marginTop: Spacing.sm,
  },
  buttonDisabled: { opacity: 0.7 },
  primaryButtonText: {
    fontFamily: 'Inter-Bold',
    fontSize: FontSize.md,
    color: Colors.white,
  },
  secondaryButton: {
    width: '100%',
    height: 48,
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: Spacing.md,
  },
  secondaryButtonText: {
    fontFamily: 'Inter-SemiBold',
    fontSize: FontSize.sm,
    color: Colors.textSecondary,
  },
  welcomeContainer: { alignItems: 'center', marginBottom: Spacing.xxl },
  checkCircle: { marginBottom: Spacing.lg },
  welcomeTitle: {
    fontFamily: 'Inter-Bold',
    fontSize: FontSize.xl,
    color: Colors.textPrimary,
    marginBottom: Spacing.sm,
  },
  welcomeName: {
    fontFamily: 'Inter-SemiBold',
    fontSize: FontSize.lg,
    color: Colors.primary,
    marginBottom: Spacing.xs,
  },
  welcomeEmail: {
    fontFamily: 'Inter-Regular',
    fontSize: FontSize.sm,
    color: Colors.textMuted,
    marginBottom: Spacing.md,
  },
  memberBadge: {
    backgroundColor: Colors.primaryFaint,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.xs,
    borderRadius: Radius.full,
  },
  memberBadgeText: {
    fontFamily: 'Inter-SemiBold',
    fontSize: FontSize.xs,
    color: Colors.primary,
  },
});
