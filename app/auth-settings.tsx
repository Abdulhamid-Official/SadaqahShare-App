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
import { ArrowLeft, Lock, Mail, Eye, EyeOff, CheckCircle, AlertCircle } from 'lucide-react-native';
import { useSafeBack } from '@/lib/navigation';
import { supabase } from '@/lib/supabase';
import { useAppContext } from '@/lib/context';
import { Colors, Spacing, Radius, FontSize, useTheme } from '@/lib/theme';

type Tab = 'password' | 'email';

export default function AuthSettingsScreen() {
  const { session, refreshSession } = useAppContext();
  const { colors } = useTheme();

  const [tab, setTab] = useState<Tab>('password');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  // Change password state
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);

  // Change email state
  const [newEmail, setNewEmail] = useState('');
  const goBack = useSafeBack('/(donor-tabs)');

  const handleChangePassword = async () => {
    setError(null);
    setSuccess(null);

    if (!currentPassword) {
      setError('Please enter your current password.');
      return;
    }
    if (!newPassword) {
      setError('Please enter a new password.');
      return;
    }
    if (newPassword.length < 6) {
      setError('New password must be at least 6 characters.');
      return;
    }
    if (newPassword !== confirmPassword) {
      setError('New passwords do not match.');
      return;
    }
    if (newPassword === currentPassword) {
      setError('New password must be different from your current password.');
      return;
    }

    setLoading(true);
    try {
      const { error: updateError } = await supabase.auth.updateUser({ password: newPassword });
      if (updateError) {
        setError(updateError.message);
        return;
      }
      setSuccess('Your password has been updated successfully.');
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
    } catch (e: any) {
      setError(e.message || 'Failed to update password.');
    } finally {
      setLoading(false);
    }
  };

  const handleChangeEmail = async () => {
    setError(null);
    setSuccess(null);

    const trimmedEmail = newEmail.trim().toLowerCase();
    if (!trimmedEmail) {
      setError('Please enter a new email address.');
      return;
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(trimmedEmail)) {
      setError('Please enter a valid email address.');
      return;
    }

    if (trimmedEmail === session?.user?.email) {
      setError('This is already your email address.');
      return;
    }

    setLoading(true);
    try {
      const { error: updateError } = await supabase.auth.updateUser({ email: trimmedEmail });
      if (updateError) {
        setError(updateError.message);
        return;
      }
      setSuccess('A verification link has been sent to your new email. Click the link to confirm the change. Your current email will continue to work until verification is complete.');
      setNewEmail('');
      await refreshSession();
    } catch (e: any) {
      setError(e.message || 'Failed to update email.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: colors.background }]} edges={['top']}>
      <View style={styles.header}>
        <TouchableOpacity onPress={goBack} style={styles.backBtn} activeOpacity={0.7}>
          <ArrowLeft size={22} color={colors.stone600} />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: colors.textPrimary }]}>Account Settings</Text>
      </View>

      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          {/* Email verification status */}
          {session?.user && (
            <View style={[styles.verifyCard, { backgroundColor: session.user.emailConfirmed ? Colors.primaryFaint : Colors.amberFaint }]}>
              {session.user.emailConfirmed ? (
                <CheckCircle size={18} color={Colors.primary} />
              ) : (
                <AlertCircle size={18} color={Colors.amber} />
              )}
              <Text style={[styles.verifyText, { color: session.user.emailConfirmed ? Colors.primary : Colors.amber }]}>
                {session.user.emailConfirmed ? 'Email verified' : 'Email not verified — some features may be restricted'}
              </Text>
            </View>
          )}

          {/* Tab Switcher */}
          <View style={styles.tabRow}>
            <TouchableOpacity
              style={[styles.tabBtn, tab === 'password' && { backgroundColor: Colors.teal }]}
              onPress={() => { setTab('password'); setError(null); setSuccess(null); }}
              activeOpacity={0.7}
            >
              <Lock size={16} color={tab === 'password' ? Colors.white : colors.textMuted} />
              <Text style={[styles.tabText, { color: tab === 'password' ? Colors.white : colors.textMuted }]}>Change Password</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.tabBtn, tab === 'email' && { backgroundColor: Colors.teal }]}
              onPress={() => { setTab('email'); setError(null); setSuccess(null); }}
              activeOpacity={0.7}
            >
              <Mail size={16} color={tab === 'email' ? Colors.white : colors.textMuted} />
              <Text style={[styles.tabText, { color: tab === 'email' ? Colors.white : colors.textMuted }]}>Change Email</Text>
            </TouchableOpacity>
          </View>

          {error && (
            <View style={styles.errorBanner}>
              <Text style={styles.errorBannerText}>{error}</Text>
            </View>
          )}

          {success && (
            <View style={styles.successBanner}>
              <Text style={styles.successBannerText}>{success}</Text>
            </View>
          )}

          {tab === 'password' && (
            <View style={[styles.card, { backgroundColor: colors.cardBg, borderColor: colors.cardBorder }]}>
              <View style={styles.inputGroup}>
                <Text style={[styles.label, { color: colors.textPrimary }]}>Current Password</Text>
                <View style={[styles.passwordContainer, { backgroundColor: colors.inputBg, borderColor: colors.inputBorder }]}>
                  <TextInput
                    style={[styles.passwordInput, { color: colors.textPrimary }]}
                    placeholder="Enter current password"
                    placeholderTextColor={Colors.stone400}
                    secureTextEntry={!showPassword}
                    autoCapitalize="none"
                    autoCorrect={false}
                    value={currentPassword}
                    onChangeText={(t) => { setCurrentPassword(t); setError(null); }}
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
                <Text style={[styles.label, { color: colors.textPrimary }]}>New Password</Text>
                <TextInput
                  style={[styles.input, { backgroundColor: colors.inputBg, borderColor: colors.inputBorder, color: colors.textPrimary }]}
                  placeholder="Min 6 characters"
                  placeholderTextColor={Colors.stone400}
                  secureTextEntry={!showPassword}
                  autoCapitalize="none"
                  autoCorrect={false}
                  value={newPassword}
                  onChangeText={(t) => { setNewPassword(t); setError(null); }}
                  editable={!loading}
                />
              </View>

              <View style={styles.inputGroup}>
                <Text style={[styles.label, { color: colors.textPrimary }]}>Confirm New Password</Text>
                <TextInput
                  style={[styles.input, { backgroundColor: colors.inputBg, borderColor: colors.inputBorder, color: colors.textPrimary }]}
                  placeholder="Re-enter new password"
                  placeholderTextColor={Colors.stone400}
                  secureTextEntry={!showPassword}
                  autoCapitalize="none"
                  autoCorrect={false}
                  value={confirmPassword}
                  onChangeText={(t) => { setConfirmPassword(t); setError(null); }}
                  editable={!loading}
                />
              </View>

              <TouchableOpacity
                style={[styles.primaryButton, loading && styles.buttonDisabled]}
                onPress={handleChangePassword}
                activeOpacity={0.8}
                disabled={loading}
              >
                {loading ? (
                  <ActivityIndicator color={Colors.white} size="small" />
                ) : (
                  <Text style={styles.primaryButtonText}>Update Password</Text>
                )}
              </TouchableOpacity>
            </View>
          )}

          {tab === 'email' && (
            <View style={[styles.card, { backgroundColor: colors.cardBg, borderColor: colors.cardBorder }]}>
              <View style={styles.currentEmailRow}>
                <Text style={[styles.label, { color: colors.textMuted }]}>Current Email</Text>
                <Text style={[styles.currentEmail, { color: colors.textPrimary }]}>{session?.user?.email}</Text>
              </View>

              <View style={styles.inputGroup}>
                <Text style={[styles.label, { color: colors.textPrimary }]}>New Email Address</Text>
                <TextInput
                  style={[styles.input, { backgroundColor: colors.inputBg, borderColor: colors.inputBorder, color: colors.textPrimary }]}
                  placeholder="new@email.com"
                  placeholderTextColor={Colors.stone400}
                  keyboardType="email-address"
                  autoCapitalize="none"
                  autoCorrect={false}
                  value={newEmail}
                  onChangeText={(t) => { setNewEmail(t); setError(null); }}
                  editable={!loading}
                />
                <Text style={styles.hint}>
                  You'll need to verify the new email before the change takes effect.
                </Text>
              </View>

              <TouchableOpacity
                style={[styles.primaryButton, loading && styles.buttonDisabled]}
                onPress={handleChangeEmail}
                activeOpacity={0.8}
                disabled={loading}
              >
                {loading ? (
                  <ActivityIndicator color={Colors.white} size="small" />
                ) : (
                  <Text style={styles.primaryButtonText}>Send Verification</Text>
                )}
              </TouchableOpacity>
            </View>
          )}
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: Colors.background },
  flex: { flex: 1 },
  header: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: Spacing.lg, paddingVertical: Spacing.lg, gap: Spacing.md,
  },
  backBtn: { width: 44, height: 44, justifyContent: 'center', alignItems: 'center' },
  headerTitle: { fontFamily: 'Inter-Bold', fontSize: FontSize.xxl, color: Colors.textPrimary },
  scrollContent: { paddingHorizontal: Spacing.lg, paddingBottom: Spacing.huge },
  verifyCard: {
    flexDirection: 'row', alignItems: 'center', gap: Spacing.sm,
    paddingHorizontal: Spacing.lg, paddingVertical: Spacing.md,
    borderRadius: Radius.md, marginBottom: Spacing.lg,
  },
  verifyText: { fontFamily: 'Inter-SemiBold', fontSize: FontSize.sm, flex: 1 },
  tabRow: { flexDirection: 'row', gap: Spacing.sm, marginBottom: Spacing.lg },
  tabBtn: {
    flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6,
    paddingVertical: Spacing.md, borderRadius: Radius.md, backgroundColor: Colors.stone100, minHeight: 48,
  },
  tabText: { fontFamily: 'Inter-SemiBold', fontSize: FontSize.sm },
  card: {
    backgroundColor: Colors.cardBg, borderRadius: Radius.xl, padding: Spacing.xxl,
    borderWidth: 1, borderColor: Colors.cardBorder,
  },
  inputGroup: { marginBottom: Spacing.lg },
  label: {
    fontFamily: 'Inter-SemiBold', fontSize: FontSize.sm,
    color: Colors.textPrimary, marginBottom: Spacing.sm,
  },
  input: {
    width: '100%', height: 50,
    backgroundColor: Colors.stone50, borderRadius: Radius.md,
    paddingHorizontal: Spacing.lg,
    fontFamily: 'Inter-Regular', fontSize: FontSize.md,
    color: Colors.textPrimary,
    borderWidth: 1, borderColor: Colors.stone200,
  },
  passwordContainer: {
    width: '100%', height: 50,
    backgroundColor: Colors.stone50, borderRadius: Radius.md,
    flexDirection: 'row', alignItems: 'center',
    borderWidth: 1, borderColor: Colors.stone200,
  },
  passwordInput: {
    flex: 1, height: '100%', paddingHorizontal: Spacing.lg,
    fontFamily: 'Inter-Regular', fontSize: FontSize.md,
    color: Colors.textPrimary,
  },
  eyeButton: { width: 44, height: 44, justifyContent: 'center', alignItems: 'center' },
  hint: {
    fontFamily: 'Inter-Regular', fontSize: FontSize.xs,
    color: Colors.textMuted, marginTop: Spacing.xs,
  },
  currentEmailRow: { marginBottom: Spacing.lg },
  currentEmail: { fontFamily: 'Inter-Regular', fontSize: FontSize.md, marginTop: 2 },
  errorBanner: {
    backgroundColor: Colors.redFaint, borderRadius: Radius.md,
    padding: Spacing.md, marginBottom: Spacing.lg, borderWidth: 1, borderColor: Colors.red,
  },
  errorBannerText: {
    fontFamily: 'Inter-SemiBold', fontSize: FontSize.sm,
    color: Colors.red, textAlign: 'center',
  },
  successBanner: {
    backgroundColor: Colors.primaryFaint, borderRadius: Radius.md,
    padding: Spacing.md, marginBottom: Spacing.lg,
  },
  successBannerText: {
    fontFamily: 'Inter-SemiBold', fontSize: FontSize.sm,
    color: Colors.primary, textAlign: 'center', lineHeight: 20,
  },
  primaryButton: {
    width: '100%', height: 52,
    backgroundColor: Colors.teal, borderRadius: Radius.md,
    justifyContent: 'center', alignItems: 'center',
    marginTop: Spacing.sm,
  },
  buttonDisabled: { opacity: 0.7 },
  primaryButtonText: {
    fontFamily: 'Inter-Bold', fontSize: FontSize.md, color: Colors.white,
  },
});
