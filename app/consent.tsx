import React, { useState } from 'react';
import { View, Text, ScrollView, StyleSheet, TouchableOpacity, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { ShieldCheck, ArrowLeft } from 'lucide-react-native';
import { supabase } from '@/lib/supabase';
import { useAppContext } from '@/lib/context';
import { Colors, Spacing, Radius, FontSize, useTheme } from '@/lib/theme';
import { ConsentCheckbox } from '@/components/ConsentCheckbox';

export default function ConsentScreen() {
  const { session, role, refreshSession } = useAppContext();
  const { colors } = useTheme();
  const [termsAccepted, setTermsAccepted] = useState(false);
  const [privacyAccepted, setPrivacyAccepted] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleAccept = async () => {
    if (!termsAccepted || !privacyAccepted) {
      setError('You must accept both the Terms of Service and Privacy Policy to continue.');
      return;
    }

    if (!session?.user?.id) {
      setError('Session expired. Please sign in again.');
      router.replace('/');
      return;
    }

    setLoading(true);
    setError(null);
    try {
      const { error: updateError } = await supabase
        .from('profiles')
        .update({
          terms_accepted: true,
          terms_accepted_at: new Date().toISOString(),
          privacy_accepted: true,
          privacy_accepted_at: new Date().toISOString(),
          policy_version: '1.0',
        })
        .eq('id', session.user.id);

      if (updateError) throw updateError;

      await refreshSession();

      if (role === 'donor') {
        router.replace('/(donor-tabs)');
      } else if (role === 'mosque') {
        router.replace('/(mosque-tabs)');
      } else {
        router.replace('/');
      }
    } catch (e: any) {
      setError(e.message || 'Failed to save consent. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleDecline = async () => {
    try {
      await supabase.auth.signOut();
    } catch (err) {
      // ignore
    }
    router.replace('/');
  };

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: colors.background }]} edges={['top']}>
      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        <TouchableOpacity onPress={handleDecline} style={styles.backBtn} activeOpacity={0.7}>
          <ArrowLeft size={22} color={colors.stone600} />
          <Text style={[styles.backText, { color: colors.stone600 }]}>Sign Out</Text>
        </TouchableOpacity>

        <View style={styles.iconCircle}>
          <ShieldCheck size={36} color={Colors.white} />
        </View>

        <Text style={[styles.title, { color: colors.textPrimary }]}>Updated Terms & Privacy</Text>
        <Text style={[styles.subtitle, { color: colors.textSecondary }]}>
          We've updated our Terms of Service and Privacy Policy. Please review and accept to continue using SadaqahShare.
        </Text>

        <View style={[styles.card, { backgroundColor: colors.cardBg, borderColor: colors.cardBorder }]}>
          <ConsentCheckbox
            label="I have read and agree to the"
            linkText="Terms of Service"
            onLinkPress={() => router.push('/terms' as any)}
            checked={termsAccepted}
            onToggle={() => { setTermsAccepted(!termsAccepted); setError(null); }}
          />
          <ConsentCheckbox
            label="I have read and agree to the"
            linkText="Privacy Policy"
            onLinkPress={() => router.push('/privacy' as any)}
            checked={privacyAccepted}
            onToggle={() => { setPrivacyAccepted(!privacyAccepted); setError(null); }}
          />
        </View>

        {error && <Text style={styles.errorText}>{error}</Text>}

        <TouchableOpacity
          style={[styles.acceptButton, loading && styles.buttonDisabled]}
          onPress={handleAccept}
          activeOpacity={0.8}
          disabled={loading}
        >
          {loading ? (
            <ActivityIndicator color={Colors.white} size="small" />
          ) : (
            <Text style={styles.acceptButtonText}>Accept & Continue</Text>
          )}
        </TouchableOpacity>

        <TouchableOpacity onPress={handleDecline} style={styles.declineButton} activeOpacity={0.7}>
          <Text style={[styles.declineText, { color: colors.textMuted }]}>Decline & Sign Out</Text>
        </TouchableOpacity>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
  scrollContent: { paddingHorizontal: Spacing.lg, paddingVertical: Spacing.xxxl, flexGrow: 1 },
  backBtn: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm, marginBottom: Spacing.xxl, minHeight: 44, paddingVertical: Spacing.sm },
  backText: { fontFamily: 'Inter-SemiBold', fontSize: FontSize.md },
  iconCircle: {
    width: 72, height: 72, borderRadius: 36,
    backgroundColor: Colors.teal, justifyContent: 'center', alignItems: 'center',
    marginBottom: Spacing.lg, alignSelf: 'center',
  },
  title: { fontFamily: 'Inter-Bold', fontSize: FontSize.xxl, textAlign: 'center', marginBottom: Spacing.sm },
  subtitle: { fontFamily: 'Inter-Regular', fontSize: FontSize.sm, textAlign: 'center', lineHeight: 20, marginBottom: Spacing.xxl },
  card: {
    borderRadius: Radius.xl, padding: Spacing.xl, borderWidth: 1, marginBottom: Spacing.lg,
  },
  errorText: { fontFamily: 'Inter-SemiBold', fontSize: FontSize.sm, color: Colors.red, textAlign: 'center', marginBottom: Spacing.lg },
  acceptButton: {
    width: '100%', height: 52, backgroundColor: Colors.teal, borderRadius: Radius.md,
    justifyContent: 'center', alignItems: 'center',
  },
  buttonDisabled: { opacity: 0.7 },
  acceptButtonText: { fontFamily: 'Inter-Bold', fontSize: FontSize.md, color: Colors.white },
  declineButton: { width: '100%', height: 48, justifyContent: 'center', alignItems: 'center', marginTop: Spacing.md },
  declineText: { fontFamily: 'Inter-SemiBold', fontSize: FontSize.sm },
});
