import React, { useState, useEffect } from 'react';
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
import { ArrowLeft, KeyRound, CheckCircle, Eye, EyeOff, AlertCircle } from 'lucide-react-native';
import { supabase } from '@/lib/supabase';
import { Colors, Spacing, Radius, FontSize, useTheme } from '@/lib/theme';

type Stage = 'loading' | 'input' | 'success' | 'error';

export default function ResetPasswordScreen() {
  const { colors } = useTheme();

  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [stage, setStage] = useState<Stage>('loading');

  useEffect(() => {
    (async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        if (session?.user) {
          setStage('input');
        } else {
          // Check for access token in URL (deep link from email)
          const url = window.location.href;
          if (url.includes('access_token') || url.includes('type=recovery')) {
            // Supabase handles the token exchange automatically
            const { data: { session: recoveredSession } } = await supabase.auth.getSession();
            if (recoveredSession?.user) {
              setStage('input');
            } else {
              setStage('error');
              setError('This reset link is invalid or has expired. Please request a new one.');
            }
          } else {
            setStage('error');
            setError('This reset link is invalid or has expired. Please request a new one.');
          }
        }
      } catch (err) {
        setStage('error');
        setError('Something went wrong. Please try again.');
      }
    })();
  }, []);

  const handleReset = async () => {
    if (!password) {
      setError('Please enter a new password.');
      return;
    }
    if (password.length < 6) {
      setError('Password must be at least 6 characters.');
      return;
    }
    if (password !== confirmPassword) {
      setError('Passwords do not match.');
      return;
    }

    setError(null);
    setLoading(true);

    try {
      const { error: updateError } = await supabase.auth.updateUser({ password });
      if (updateError) {
        setError(updateError.message);
        return;
      }
      setStage('success');
    } catch (e: any) {
      setError(e.message || 'Failed to reset password.');
    } finally {
      setLoading(false);
    }
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
          {stage !== 'success' && stage !== 'loading' && (
            <TouchableOpacity
              style={styles.backButton}
              onPress={() => router.replace('/')}
              hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
            >
              <ArrowLeft size={22} color={Colors.stone600} />
              <Text style={styles.backText}>Back</Text>
            </TouchableOpacity>
          )}

          <View style={[styles.card, { backgroundColor: colors.cardBg, borderColor: colors.cardBorder }]}>
            {stage === 'loading' && (
              <View style={styles.centeredContent}>
                <ActivityIndicator size="large" color={Colors.teal} />
                <Text style={[styles.loadingText, { color: colors.textSecondary }]}>Verifying reset link...</Text>
              </View>
            )}

            {stage === 'input' && (
              <>
                <View style={styles.iconCircle}>
                  <KeyRound size={32} color={Colors.white} />
                </View>
                <Text style={[styles.title, { color: colors.textPrimary }]}>Set New Password</Text>
                <Text style={[styles.subtitle, { color: colors.textSecondary }]}>
                  Enter your new password below.
                </Text>

                <View style={styles.inputGroup}>
                  <Text style={[styles.label, { color: colors.textPrimary }]}>New Password</Text>
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

                <View style={styles.inputGroup}>
                  <Text style={[styles.label, { color: colors.textPrimary }]}>Confirm Password</Text>
                  <TextInput
                    style={[styles.input, { backgroundColor: colors.inputBg, borderColor: colors.inputBorder, color: colors.textPrimary }]}
                    placeholder="Re-enter password"
                    placeholderTextColor={Colors.stone400}
                    secureTextEntry={!showPassword}
                    autoCapitalize="none"
                    autoCorrect={false}
                    value={confirmPassword}
                    onChangeText={(t) => { setConfirmPassword(t); setError(null); }}
                    editable={!loading}
                  />
                </View>

                {error && <Text style={styles.errorText}>{error}</Text>}

                <TouchableOpacity
                  style={[styles.primaryButton, loading && styles.buttonDisabled]}
                  onPress={handleReset}
                  activeOpacity={0.8}
                  disabled={loading}
                >
                  {loading ? (
                    <ActivityIndicator color={Colors.white} size="small" />
                  ) : (
                    <Text style={styles.primaryButtonText}>Set New Password</Text>
                  )}
                </TouchableOpacity>
              </>
            )}

            {stage === 'success' && (
              <>
                <View style={styles.iconCircleSuccess}>
                  <CheckCircle size={32} color={Colors.teal} />
                </View>
                <Text style={[styles.title, { color: colors.textPrimary }]}>Password Updated</Text>
                <Text style={[styles.subtitle, { color: colors.textSecondary }]}>
                  Your password has been changed successfully. You can now sign in with your new password.
                </Text>

                <TouchableOpacity
                  style={styles.primaryButton}
                  onPress={async () => {
                    await supabase.auth.signOut();
                    router.replace('/role-select');
                  }}
                  activeOpacity={0.8}
                >
                  <Text style={styles.primaryButtonText}>Continue to Sign In</Text>
                </TouchableOpacity>
              </>
            )}

            {stage === 'error' && (
              <>
                <View style={styles.iconCircleError}>
                  <AlertCircle size={32} color={Colors.red} />
                </View>
                <Text style={[styles.title, { color: colors.textPrimary }]}>Link Expired</Text>
                <Text style={[styles.subtitle, { color: colors.textSecondary }]}>
                  {error || 'This reset link is invalid or has expired.'}
                </Text>

                <TouchableOpacity
                  style={styles.primaryButton}
                  onPress={() => router.push('/forgot-password')}
                  activeOpacity={0.8}
                >
                  <Text style={styles.primaryButtonText}>Request New Link</Text>
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
  centeredContent: { alignItems: 'center', paddingVertical: Spacing.xxl },
  loadingText: {
    fontFamily: 'Inter-Regular',
    fontSize: FontSize.sm,
    marginTop: Spacing.lg,
  },
  iconCircle: {
    width: 72, height: 72, borderRadius: 36,
    backgroundColor: Colors.teal,
    justifyContent: 'center', alignItems: 'center',
    marginBottom: Spacing.lg,
  },
  iconCircleSuccess: {
    width: 72, height: 72, borderRadius: 36,
    backgroundColor: Colors.primaryFaint,
    justifyContent: 'center', alignItems: 'center',
    marginBottom: Spacing.lg,
  },
  iconCircleError: {
    width: 72, height: 72, borderRadius: 36,
    backgroundColor: Colors.redFaint,
    justifyContent: 'center', alignItems: 'center',
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
  primaryButton: {
    width: '100%',
    height: 52,
    backgroundColor: Colors.teal,
    borderRadius: Radius.md,
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: Spacing.sm,
  },
  buttonDisabled: { opacity: 0.7 },
  primaryButtonText: {
    fontFamily: 'Inter-Bold',
    fontSize: FontSize.md,
    color: Colors.white,
  },
});
