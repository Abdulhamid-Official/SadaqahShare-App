import React from 'react';
import { View, Text, ScrollView, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { ArrowLeft } from 'lucide-react-native';
import { TouchableOpacity } from 'react-native';
import { Colors, Spacing, Radius, FontSize, useTheme } from '@/lib/theme';
import { useSafeBack } from '@/lib/navigation';

export default function TermsScreen() {
  const { colors } = useTheme();
  const goBack = useSafeBack('/');

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: colors.background }]} edges={['top']}>
      <View style={styles.header}>
        <TouchableOpacity onPress={goBack} style={styles.backBtn} activeOpacity={0.7}>
          <ArrowLeft size={22} color={colors.stone600} />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: colors.textPrimary }]}>Terms of Service</Text>
      </View>
      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        <Text style={[styles.lastUpdated, { color: colors.textMuted }]}>Last updated: October 8, 2026</Text>
        <Text style={[styles.heading, { color: colors.textPrimary }]}>1. Acceptance of Terms</Text>
        <Text style={[styles.body, { color: colors.textSecondary }]}>
          By creating an account and using SadaqahShare, you agree to these Terms of Service. If you do not agree, you may not use the platform.
        </Text>
        <Text style={[styles.heading, { color: colors.textPrimary }]}>2. Platform Description</Text>
        <Text style={[styles.body, { color: colors.textSecondary }]}>
          SadaqahShare connects mosques with donors to facilitate item donations, community needs, polls, and announcements. Tokens are earned through confirmed donations and can be used for voting in community polls.
        </Text>
        <Text style={[styles.heading, { color: colors.textPrimary }]}>3. User Responsibilities</Text>
        <Text style={[styles.body, { color: colors.textSecondary }]}>
          You are responsible for the accuracy of information you provide. Donors must only pledge items they intend to deliver. Mosques must accurately represent their needs and confirm donations upon receipt.
        </Text>
        <Text style={[styles.heading, { color: colors.textPrimary }]}>4. Token System</Text>
        <Text style={[styles.body, { color: colors.textSecondary }]}>
          Tokens are earned only through confirmed donations and may only be spent on poll votes within the mosque where they were earned. Tokens have no monetary value, cannot be purchased, sold, or transferred between users.
        </Text>
        <Text style={[styles.heading, { color: colors.textPrimary }]}>5. Account Deletion</Text>
        <Text style={[styles.body, { color: colors.textSecondary }]}>
          You may delete your account at any time. Upon deletion, your personal information will be anonymized. Historical donation and token records will be preserved for audit purposes but will no longer be linked to your identity.
        </Text>
        <Text style={[styles.heading, { color: colors.textPrimary }]}>6. Prohibited Conduct</Text>
        <Text style={[styles.body, { color: colors.textSecondary }]}>
          You may not attempt to manipulate token balances, bypass member limits, create duplicate accounts to abuse the system, or use the platform for any unlawful purpose.
        </Text>
        <Text style={[styles.heading, { color: colors.textPrimary }]}>7. Limitation of Liability</Text>
        <Text style={[styles.body, { color: colors.textSecondary }]}>
          SadaqahShare is provided "as is" without warranties. We are not liable for any indirect, incidental, or consequential damages arising from use of the platform.
        </Text>
        <Text style={[styles.heading, { color: colors.textPrimary }]}>8. Changes to Terms</Text>
        <Text style={[styles.body, { color: colors.textSecondary }]}>
          We may update these Terms from time to time. Continued use of the platform after changes constitutes acceptance of the new Terms.
        </Text>
        <Text style={[styles.heading, { color: colors.textPrimary }]}>9. Contact Us</Text>
        <Text style={[styles.body, { color: colors.textSecondary }]}>
          If you have questions about these Terms, please contact us at SadaqahShare@protonmail.com.
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
