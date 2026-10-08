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
import { Heart, ArrowLeft, Eye, EyeOff, MailWarning } from 'lucide-react-native';
import { useSafeBack } from '@/lib/navigation';
import { supabase } from '@/lib/supabase';
import { useAppContext } from '@/lib/context';
import { Colors, Spacing, Radius, FontSize, useTheme } from '@/lib/theme';
import { ConsentCheckbox } from '@/components/ConsentCheckbox';

type Mode = 'signin' | 'signup';
type Stage = 'form' | 'verify-email';

// Don't pass a custom redirect URL — Supabase will use its configured Site URL.
// The webcontainer preview host isn't in the allowed redirect URLs list,
// so passing it causes the email link to fail. Let Supabase use its default.

export default function DonorLoginScreen() {
  const { setRole, setDonor, setIsAdmin } = useAppContext();
  const { colors } = useTheme();

  const [mode, setMode] = useState<Mode>('signin');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [stage, setStage] = useState<Stage>('form');
  const [infoMessage, setInfoMessage] = useState<string | null>(null);
  const [termsAccepted, setTermsAccepted] = useState(false);
  const [privacyAccepted, setPrivacyAccepted] = useState(false);
  const goBack = useSafeBack('/role-select');

  const switchMode = (newMode: Mode) => {
    setMode(newMode);
    setError(null);
    setInfoMessage(null);
  };

  const handleSignIn = async (trimmedEmail: string) => {
    const { data, error: signInError } = await supabase.auth.signInWithPassword({
      email: trimmedEmail,
      password,
    });

    if (signInError) {
      if (signInError.message.includes('not confirmed')) {
        setStage('verify-email');
        setInfoMessage('Your email has not been verified yet. Click the link in the email we sent, or resend it below.');
        return;
      }
      setError('Incorrect email or password. If you don\'t have an account, switch to Sign Up.');
      return;
    }

    if (!data.user) {
      setError('Sign in failed. Please try again.');
      return;
    }

    if (!data.user.email_confirmed_at) {
      setStage('verify-email');
      setInfoMessage('Your email has not been verified yet. Click the link in the email we sent, or resend it below.');
      return;
    }

    setIsAdmin(false);
    setRole('donor');
    router.replace('/(donor-tabs)');
  };

  const handleSignUp = async (trimmedEmail: string, trimmedName: string) => {
    if (!trimmedName) {
      setError('Please enter your name to create an account.');
      return;
    }

    if (!termsAccepted || !privacyAccepted) {
      setError('You must accept the Terms of Service and Privacy Policy to create an account.');
      return;
    }

    const { data: signUpData, error: signUpError } = await supabase.auth.signUp({
      email: trimmedEmail,
      password,
    });

    if (signUpError) {
      if (signUpError.message.includes('already registered') || signUpError.message.includes('User already')) {
        setError('An account with this email already exists. Switch to Sign In to continue.');
      } else {
        setError(signUpError.message);
      }
      return;
    }

    if (!signUpData.user) {
      setError('Sign up failed. Please try again.');
      return;
    }

    // Check if a donor record already exists for this email (avoids duplicate key error)
    const { data: existingDonor } = await supabase
      .from('donors')
      .select('id, name')
      .eq('email', trimmedEmail)
      .maybeSingle();

    let donorId: string;

    if (existingDonor) {
      // Donor record exists from the old prototype — link it to the new auth user
      donorId = (existingDonor as any).id;
      await supabase
        .from('donors')
        .update({ auth_id: signUpData.user.id, name: trimmedName || (existingDonor as any).name })
        .eq('id', donorId);
    } else {
      // Create new donor record
      const { data: newDonor, error: donorErr } = await supabase
        .from('donors')
        .insert({
          email: trimmedEmail,
          name: trimmedName,
          auth_id: signUpData.user.id,
        })
        .select('*')
        .single();

      if (donorErr) {
        console.error('Donor creation error:', donorErr);
        setError('Account created but profile setup failed. Please contact support at SadaqahShare@protonmail.com.');
        return;
      }
      donorId = newDonor.id;
    }

    // Create profile linking auth user to donor (with consent)
    const { error: profileErr } = await supabase.from('profiles').upsert({
      id: signUpData.user.id,
      role: 'donor',
      donor_id: donorId,
      email: trimmedEmail,
      terms_accepted: true,
      terms_accepted_at: new Date().toISOString(),
      privacy_accepted: true,
      privacy_accepted_at: new Date().toISOString(),
      policy_version: '1.0',
    });

    if (profileErr) {
      console.error('Profile creation error:', profileErr);
    }

    // Check if email confirmation is required
    if (!signUpData.session && !signUpData.user.email_confirmed_at) {
      setStage('verify-email');
      setInfoMessage('We sent a verification link to ' + trimmedEmail + '. Please check your inbox and click the link to verify your account.');
      return;
    }

    // If session was created (email confirmation disabled), navigate
    setIsAdmin(false);
    setRole('donor');
    router.replace('/(donor-tabs)');
  };

  const handleContinue = async () => {
    const trimmedEmail = email.trim().toLowerCase();
    const trimmedName = name.trim();

    if (!trimmedEmail) {
      setError('Please enter your email address.');
      return;
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(trimmedEmail)) {
      setError('Please enter a valid email address.');
      return;
    }

    if (!password) {
      setError('Please enter your password.');
      return;
    }

    if (password.length < 6) {
      setError('Password must be at least 6 characters.');
      return;
    }

    setError(null);
    setInfoMessage(null);
    setLoading(true);

    try {
      if (mode === 'signin') {
        await handleSignIn(trimmedEmail);
      } else {
        await handleSignUp(trimmedEmail, trimmedName);
      }
    } catch (e: any) {
      setError(e.message || 'Something went wrong. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleResendVerification = async () => {
    const trimmedEmail = email.trim().toLowerCase();
    if (!trimmedEmail) return;

    setLoading(true);
    setError(null);
    try {
      const { error: resendError } = await supabase.auth.resend({
        type: 'signup',
        email: trimmedEmail,
      });
      if (resendError) {
        setError(resendError.message);
      } else {
        setInfoMessage('Verification email sent. Please check your inbox.');
      }
    } catch (e: any) {
      setError(e.message || 'Failed to resend verification.');
    } finally {
      setLoading(false);
    }
  };

  const handleBackToInput = () => {
    setStage('form');
    setError(null);
    setInfoMessage(null);
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
            onPress={goBack}
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
              {stage === 'verify-email'
                ? 'Verify your email to continue'
                : mode === 'signin'
                  ? 'Sign in to your donor account'
                  : 'Create a new donor account'}
            </Text>

            {stage === 'form' && (
              <>
                {/* Mode Toggle */}
                <View style={styles.modeToggle}>
                  <TouchableOpacity
                    style={[styles.modeBtn, mode === 'signin' && styles.modeBtnActive, { borderColor: mode === 'signin' ? Colors.primary : colors.cardBorder }]}
                    onPress={() => switchMode('signin')}
                    activeOpacity={0.7}
                  >
                    <Text style={[styles.modeText, mode === 'signin' && styles.modeTextActive]}>Sign In</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[styles.modeBtn, mode === 'signup' && styles.modeBtnActive, { borderColor: mode === 'signup' ? Colors.primary : colors.cardBorder }]}
                    onPress={() => switchMode('signup')}
                    activeOpacity={0.7}
                  >
                    <Text style={[styles.modeText, mode === 'signup' && styles.modeTextActive]}>Sign Up</Text>
                  </TouchableOpacity>
                </View>

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
                    onChangeText={(t) => { setEmail(t); setError(null); }}
                    editable={!loading}
                  />
                </View>

                <View style={styles.inputGroup}>
                  <Text style={[styles.label, { color: colors.textPrimary }]}>Password</Text>
                  <View style={[styles.passwordContainer, { backgroundColor: colors.inputBg, borderColor: colors.inputBorder }]}>
                    <TextInput
                      style={[styles.passwordInput, { color: colors.textPrimary }]}
                      placeholder="Min 6 characters"
                      placeholderTextColor={Colors.stone400}
                      secureTextEntry={!showPassword}
                      autoCapitalize="none"
                      autoCorrect={false}
                      value={password}
                      onChangeText={(t) => { setPassword(t); setError(null); }}
                      editable={!loading}
                    />
                    <TouchableOpacity
                      style={styles.eyeButton}
                      onPress={() => setShowPassword(!showPassword)}
                      hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                    >
                      {showPassword ? <EyeOff size={20} color={Colors.stone400} /> : <Eye size={20} color={Colors.stone400} />}
                    </TouchableOpacity>
                  </View>
                </View>

                {mode === 'signup' && (
                  <View style={styles.inputGroup}>
                    <Text style={[styles.label, { color: colors.textPrimary }]}>Your Name</Text>
                    <TextInput
                      style={[styles.input, { backgroundColor: colors.inputBg, borderColor: colors.inputBorder, color: colors.textPrimary }]}
                      placeholder="Enter your full name"
                      placeholderTextColor={Colors.stone400}
                      autoCapitalize="words"
                      value={name}
                      onChangeText={(t) => { setName(t); setError(null); }}
                      editable={!loading}
                    />
                  </View>
                )}

                {mode === 'signup' && (
                  <View style={styles.consentSection}>
                    <ConsentCheckbox
                      label="I agree to the"
                      linkText="Terms of Service"
                      onLinkPress={() => router.push('/terms' as any)}
                      checked={termsAccepted}
                      onToggle={() => { setTermsAccepted(!termsAccepted); setError(null); }}
                    />
                    <ConsentCheckbox
                      label="I agree to the"
                      linkText="Privacy Policy"
                      onLinkPress={() => router.push('/privacy' as any)}
                      checked={privacyAccepted}
                      onToggle={() => { setPrivacyAccepted(!privacyAccepted); setError(null); }}
                    />
                  </View>
                )}

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
                    <Text style={styles.primaryButtonText}>
                      {mode === 'signin' ? 'Sign In' : 'Create Account'}
                    </Text>
                  )}
                </TouchableOpacity>

                {mode === 'signin' && (
                  <TouchableOpacity
                    style={styles.secondaryButton}
                    onPress={() => router.push('/forgot-password')}
                    activeOpacity={0.7}
                  >
                    <Text style={styles.secondaryButtonText}>Forgot password?</Text>
                  </TouchableOpacity>
                )}
              </>
            )}

            {stage === 'verify-email' && (
              <>
                <View style={styles.welcomeContainer}>
                  <View style={styles.checkCircle}>
                    <MailWarning size={48} color={Colors.amber} strokeWidth={1.5} />
                  </View>
                  <Text style={[styles.welcomeTitle, { color: colors.textPrimary }]}>Verify Your Email</Text>
                  <Text style={[styles.welcomeEmail, { color: colors.textMuted }]}>
                    We sent a verification link to {email.trim().toLowerCase()}
                  </Text>
                  <Text style={[styles.verifyInstructions, { color: colors.textSecondary }]}>
                    Click the link in your email to verify your account, then return here to sign in.
                  </Text>
                </View>

                {infoMessage && <Text style={styles.infoText}>{infoMessage}</Text>}
                {error && <Text style={styles.errorText}>{error}</Text>}

                <TouchableOpacity
                  style={[styles.primaryButton, loading && styles.buttonDisabled]}
                  onPress={handleResendVerification}
                  activeOpacity={0.8}
                  disabled={loading}
                >
                  {loading ? (
                    <ActivityIndicator color={Colors.white} size="small" />
                  ) : (
                    <Text style={styles.primaryButtonText}>Resend Verification</Text>
                  )}
                </TouchableOpacity>

                <TouchableOpacity
                  style={styles.secondaryButton}
                  onPress={handleBackToInput}
                  activeOpacity={0.7}
                >
                  <Text style={styles.secondaryButtonText}>Back to Sign In</Text>
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
  modeToggle: {
    flexDirection: 'row',
    gap: Spacing.sm,
    width: '100%',
    marginBottom: Spacing.lg,
  },
  modeBtn: {
    flex: 1,
    paddingVertical: Spacing.md,
    borderRadius: Radius.md,
    borderWidth: 1.5,
    alignItems: 'center',
    minHeight: 44,
    justifyContent: 'center',
  },
  modeBtnActive: {
    backgroundColor: Colors.primaryFaint,
  },
  modeText: {
    fontFamily: 'Inter-SemiBold',
    fontSize: FontSize.sm,
    color: Colors.stone500,
  },
  modeTextActive: {
    color: Colors.primary,
  },
  inputGroup: { width: '100%', marginBottom: Spacing.lg },
  consentSection: {
    width: '100%',
    marginBottom: Spacing.lg,
    paddingHorizontal: Spacing.xs,
  },
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
  passwordContainer: {
    width: '100%',
    height: 50,
    backgroundColor: Colors.stone50,
    borderRadius: Radius.md,
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: Colors.stone200,
  },
  passwordInput: {
    flex: 1,
    height: '100%',
    paddingHorizontal: Spacing.lg,
    fontFamily: 'Inter-Regular',
    fontSize: FontSize.md,
    color: Colors.textPrimary,
  },
  eyeButton: { width: 44, height: 44, justifyContent: 'center', alignItems: 'center' },
  errorText: {
    fontFamily: 'Inter-SemiBold',
    fontSize: FontSize.sm,
    color: Colors.red,
    textAlign: 'center',
    marginBottom: Spacing.lg,
    width: '100%',
  },
  infoText: {
    fontFamily: 'Inter-Regular',
    fontSize: FontSize.sm,
    color: Colors.teal,
    textAlign: 'center',
    marginBottom: Spacing.lg,
    width: '100%',
    lineHeight: 20,
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
  welcomeEmail: {
    fontFamily: 'Inter-Regular',
    fontSize: FontSize.sm,
    color: Colors.textMuted,
    marginBottom: Spacing.md,
    textAlign: 'center',
  },
  verifyInstructions: {
    fontFamily: 'Inter-Regular',
    fontSize: FontSize.sm,
    color: Colors.textSecondary,
    textAlign: 'center',
    lineHeight: 20,
  },
});
