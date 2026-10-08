import React from 'react';
import { View, Text, ScrollView, StyleSheet, TouchableOpacity } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { ArrowLeft } from 'lucide-react-native';
import { Colors, Spacing, FontSize, useTheme } from '@/lib/theme';

export default function PrivacyScreen() {
  const { colors } = useTheme();

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: colors.background }]} edges={['top']}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn} activeOpacity={0.7}>
          <ArrowLeft size={22} color={colors.stone600} />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: colors.textPrimary }]}>Privacy Policy</Text>
      </View>
      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        <Text style={[styles.lastUpdated, { color: colors.textMuted }]}>Last updated: October 8, 2026</Text>
        <Text style={[styles.heading, { color: colors.textPrimary }]}>1. Information We Collect</Text>
        <Text style={[styles.body, { color: colors.textSecondary }]}>
          We collect your name, email address, and mosque affiliation. We do not collect date of birth, home address, phone number (unless you provide it for mosque contact), or profile pictures.
        </Text>
        <Text style={[styles.heading, { color: colors.textPrimary }]}>2. How We Use Your Information</Text>
        <Text style={[styles.body, { color: colors.textSecondary }]}>
          Your name and email are used for account authentication and communication. Mosque managers can see member names and emails for their mosque. Donors can see mosque names and public information.
        </Text>
        <Text style={[styles.heading, { color: colors.textPrimary }]}>3. Data Sharing</Text>
        <Text style={[styles.body, { color: colors.textSecondary }]}>
          We do not sell or share your personal information with third parties. Your information is only visible to mosque members and managers within mosques you belong to.
        </Text>
        <Text style={[styles.heading, { color: colors.textPrimary }]}>4. Data Retention</Text>
        <Text style={[styles.body, { color: colors.textSecondary }]}>
          When you delete your account, your personal information is anonymized. Donation records, token transactions, and pledge history are retained for audit and financial integrity but are no longer linked to your identity.
        </Text>
        <Text style={[styles.heading, { color: colors.textPrimary }]}>5. Token and Financial Records</Text>
        <Text style={[styles.body, { color: colors.textSecondary }]}>
          Token transactions and donation records are maintained as an immutable audit trail. These records ensure financial integrity and cannot be deleted, even upon account deletion.
        </Text>
        <Text style={[styles.heading, { color: colors.textPrimary }]}>6. Your Rights</Text>
        <Text style={[styles.body, { color: colors.textSecondary }]}>
          You have the right to access your data, update your information, and delete your account. Account deletion anonymizes your personal data while preserving historical records.
        </Text>
        <Text style={[styles.heading, { color: colors.textPrimary }]}>7. Consent</Text>
        <Text style={[styles.body, { color: colors.textSecondary }]}>
          By creating an account, you consent to this Privacy Policy. You may withdraw consent by deleting your account.
        </Text>
        <Text style={[styles.heading, { color: colors.textPrimary }]}>8. Changes to This Policy</Text>
        <Text style={[styles.body, { color: colors.textSecondary }]}>
          We may update this Privacy Policy from time to time. Continued use after changes constitutes acceptance of the updated policy.
        </Text>
        <View style={{ height: Spacing.xxxl }} />
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
  header: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: Spacing.lg, paddingVertical: Spacing.lg, gap: Spacing.md,
  },
  backBtn: { width: 44, height: 44, justifyContent: 'center', alignItems: 'center' },
  headerTitle: { fontFamily: 'Inter-Bold', fontSize: FontSize.xxl },
  scrollContent: { paddingHorizontal: Spacing.lg, paddingBottom: Spacing.huge },
  lastUpdated: { fontFamily: 'Inter-Regular', fontSize: FontSize.xs, marginBottom: Spacing.lg },
  heading: { fontFamily: 'Inter-SemiBold', fontSize: FontSize.lg, marginTop: Spacing.xl, marginBottom: Spacing.sm },
  body: { fontFamily: 'Inter-Regular', fontSize: FontSize.md, lineHeight: 22 },
});
