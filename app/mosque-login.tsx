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
import { Building2, ArrowLeft, Eye, EyeOff, MailWarning } from 'lucide-react-native';
import { supabase } from '@/lib/supabase';
import { useAppContext } from '@/lib/context';
import { Colors, Spacing, Radius, FontSize, useTheme } from '@/lib/theme';
import { useDeviceSize } from '@/lib/responsive';

type Stage = 'input' | 'verify-email';

export default function MosqueLoginScreen() {
  const { setMosqueAccount, setMosqueName, setMosqueCity, setMosqueState, setIsPaid, setRole, setIsAdmin } =
    useAppContext();
  const deviceSize = useDeviceSize();
  const { colors } = useTheme();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [stage, setStage] = useState<Stage>('input');
  const [infoMessage, setInfoMessage] = useState<string | null>(null);
  const [emailFocused, setEmailFocused] = useState(false);
  const [passwordFocused, setPasswordFocused] = useState(false);

  const handleSignIn = async () => {
    const trimmedEmail = email.trim().toLowerCase();
    if (!trimmedEmail) {
      setError('Please enter your email address.');
      return;
    }
    if (!password) {
      setError('Please enter your password.');
      return;
    }

    setError(null);
    setInfoMessage(null);
    setLoading(true);

    try {
      const { data: signInData, error: signInError } = await supabase.auth.signInWithPassword({
        email: trimmedEmail,
        password,
      });

      if (signInError) {
        if (signInError.message.includes('not confirmed')) {
          setStage('verify-email');
          setLoading(false);
          return;
        }
        setError('Incorrect email or password. If you registered before our recent update, your account may need to be recreated — please use "Register Your Mosque" below.');
        setLoading(false);
        return;
      }

      if (!signInData.user) {
        setError('Sign in failed. Please try again.');
        setLoading(false);
        return;
      }

      if (!signInData.user.email_confirmed_at) {
        setStage('verify-email');
        setLoading(false);
        return;
      }

      // Profile data is loaded by onAuthStateChange, just navigate
      setIsAdmin(false);
      setRole('mosque');
      router.replace('/(mosque-tabs)');
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

  const cardMaxWidth = deviceSize !== 'phone' ? 440 : undefined;

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
            onPress={() => router.back()}
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          >
            <ArrowLeft size={22} color={Colors.stone600} />
            <Text style={styles.backText}>Back</Text>
          </TouchableOpacity>

          <View style={[styles.card, cardMaxWidth ? { maxWidth: cardMaxWidth, alignSelf: 'center' as const, width: '100%' } : undefined, { backgroundColor: colors.cardBg, borderColor: colors.cardBorder }]}>
            <View style={styles.iconCircle}>
              <Building2 size={32} color={Colors.white} />
            </View>

            <Text style={[styles.title, { color: colors.textPrimary }]}>Mosque Manager</Text>
            <Text style={[styles.subtitle, { color: colors.textSecondary }]}>
              {stage === 'verify-email'
                ? 'Verify your email to continue'
                : 'Sign in to manage your mosque'}
            </Text>

            {stage === 'input' && (
              <>
                <View style={styles.inputGroup}>
                  <Text style={[styles.label, { color: colors.textPrimary }]}>Email Address</Text>
                  <TextInput
                    style={[styles.input, emailFocused && styles.inputFocused, { backgroundColor: colors.inputBg, borderColor: colors.inputBorder, color: colors.textPrimary }]}
                    placeholder="mosque@email.com"
                    placeholderTextColor={Colors.stone400}
                    keyboardType="email-address"
                    autoCapitalize="none"
                    autoCorrect={false}
                    value={email}
                    onChangeText={(t) => { setEmail(t); setError(null); }}
                    onFocus={() => setEmailFocused(true)}
                    onBlur={() => setEmailFocused(false)}
                    editable={!loading}
                  />
                </View>

                <View style={styles.inputGroup}>
                  <Text style={[styles.label, { color: colors.textPrimary }]}>Password</Text>
                  <View style={[styles.passwordContainer, passwordFocused && styles.inputFocused, { backgroundColor: colors.inputBg, borderColor: colors.inputBorder }]}>
                    <TextInput
                      style={[styles.passwordInput, { color: colors.textPrimary }]}
                      placeholder="Enter your password"
                      placeholderTextColor={Colors.stone400}
                      secureTextEntry={!showPassword}
                      autoCapitalize="none"
                      autoCorrect={false}
                      value={password}
                      onChangeText={(t) => { setPassword(t); setError(null); }}
                      onFocus={() => setPasswordFocused(true)}
                      onBlur={() => setPasswordFocused(false)}
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

                {error && <Text style={styles.errorText}>{error}</Text>}

                <TouchableOpacity
                  style={[styles.primaryButton, loading && styles.buttonDisabled]}
                  onPress={handleSignIn}
                  activeOpacity={0.8}
                  disabled={loading}
                >
                  {loading ? (
                    <ActivityIndicator color={Colors.white} size="small" />
                  ) : (
                    <Text style={styles.primaryButtonText}>Sign In</Text>
                  )}
                </TouchableOpacity>

                <TouchableOpacity
                  style={styles.secondaryButton}
                  onPress={() => router.push('/forgot-password')}
                  activeOpacity={0.7}
                >
                  <Text style={styles.secondaryButtonText}>Forgot password?</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={styles.registerButton}
                  onPress={() => router.push('/mosque-register')}
                  activeOpacity={0.7}
                >
                  <Text style={styles.registerButtonText}>Register Your Mosque</Text>
                </TouchableOpacity>

                <Text style={[styles.supportHint, { color: colors.textMuted }]}>
                  Need help? Contact us at SadaqahShare@protonmail.com
                </Text>
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
                  onPress={() => { setStage('input'); setError(null); setInfoMessage(null); }}
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
    backgroundColor: Colors.teal,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: Spacing.lg,
    shadowColor: Colors.teal,
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
  inputFocused: { borderColor: Colors.teal, borderWidth: 2 },
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
    backgroundColor: Colors.teal,
    borderRadius: Radius.md,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: Colors.teal,
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
  registerButton: {
    width: '100%',
    height: 48,
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: Spacing.sm,
  },
  registerButtonText: {
    fontFamily: 'Inter-SemiBold',
    fontSize: FontSize.sm,
    color: Colors.teal,
  },
  supportHint: {
    fontFamily: 'Inter-Regular',
    fontSize: FontSize.xs,
    textAlign: 'center',
    marginTop: Spacing.lg,
    lineHeight: 18,
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
