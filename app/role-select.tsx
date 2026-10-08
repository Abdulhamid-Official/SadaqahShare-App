import { useState } from 'react';
import { StyleSheet, Text, View, ScrollView, TouchableOpacity, Platform, TextInput, Modal } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Heart, Building2, ChevronLeft, Check, Shield, X } from 'lucide-react-native';
import { Colors, Spacing, Radius, FontSize, useTheme } from '@/lib/theme';
import { useDeviceSize, useContentWidth } from '@/lib/responsive';
import { useAppContext } from '@/lib/context';

const DONOR_BENEFITS = [
  'Browse mosques and their specific needs',
  'Pledge items or monetary donations directly',
  'Earn tokens for every fulfilled pledge',
  'Vote on mosque decisions with your tokens',
  'Track your impact and Sadaqah Jariyah history',
];

const MOSQUE_BENEFITS = [
  'Create a profile and list your mosque\'s needs',
  'Receive pledges from donors worldwide',
  'Create polls for community input',
  'Manage donations and track fulfillment',
  'Build a transparent, engaged community',
];

const ADMIN_CODE = 'SadaqahShareAdmin_2026';

export default function RoleSelectPage() {
  const router = useRouter();
  const deviceSize = useDeviceSize();
  const { paddingHorizontal, maxWidth } = useContentWidth();
  const { colors } = useTheme();
  const { setIsAdmin, setRole } = useAppContext();
  const isWide = deviceSize !== 'phone';

  const [showAdminModal, setShowAdminModal] = useState(false);
  const [adminCode, setAdminCode] = useState('');
  const [adminError, setAdminError] = useState('');

  const handleAdminLogin = () => {
    if (adminCode.trim() === ADMIN_CODE) {
      setIsAdmin(true);
      setRole('mosque');
      setAdminError('');
      setAdminCode('');
      setShowAdminModal(false);
      router.replace('/(mosque-tabs)');
    } else {
      setAdminError('Invalid admin code');
    }
  };

  return (
    <SafeAreaView style={[styles.safeArea, { backgroundColor: colors.background }]}>
      {/* ── Header ── */}
      <View style={[styles.header, { paddingHorizontal }]}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton} activeOpacity={0.7}>
          <ChevronLeft size={24} color={colors.textPrimary} />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: colors.textPrimary }]}>Choose Your Role</Text>
        <View style={styles.backButton} />
      </View>

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={[
          styles.content,
          { paddingHorizontal, maxWidth: maxWidth ?? undefined },
        ]}
        showsVerticalScrollIndicator={false}
      >
        <Text style={[styles.subtitle, { color: colors.textSecondary }]}>
          Select how you'd like to use SadaqahShare. You can always switch roles later.
        </Text>

        <View style={[styles.cardRow, isWide && styles.cardRowWide]}>
          {/* ── Donor Card ── */}
          <View style={[styles.card, isWide && styles.cardHalf, { backgroundColor: colors.cardBg, borderColor: colors.cardBorder }]}>
            <View style={[styles.cardHeader, { backgroundColor: Colors.primary }]}>
              <View style={styles.cardIconWrap}>
                <Heart size={32} color={Colors.white} />
              </View>
              <Text style={styles.cardRole}>Donor</Text>
              <Text style={styles.cardRoleSubtitle}>Support mosques & earn rewards</Text>
            </View>

            <View style={styles.cardBody}>
              {DONOR_BENEFITS.map((benefit, idx) => (
                <View key={idx} style={styles.benefitRow}>
                  <View style={[styles.checkCircle, { backgroundColor: Colors.primaryFaint }]}>
                    <Check size={14} color={Colors.primary} />
                  </View>
                  <Text style={[styles.benefitText, { color: colors.textPrimary }]}>{benefit}</Text>
                </View>
              ))}

              <TouchableOpacity
                style={[styles.ctaButton, { backgroundColor: Colors.primary }]}
                onPress={() => router.push('/donor-login')}
                activeOpacity={0.85}
              >
                <Text style={styles.ctaButtonText}>Continue as Donor</Text>
              </TouchableOpacity>
            </View>
          </View>

          {/* ── Mosque Card ── */}
          <View style={[styles.card, isWide && styles.cardHalf, { backgroundColor: colors.cardBg, borderColor: colors.cardBorder }]}>
            <View style={[styles.cardHeader, { backgroundColor: Colors.teal }]}>
              <View style={styles.cardIconWrap}>
                <Building2 size={32} color={Colors.white} />
              </View>
              <Text style={styles.cardRole}>Mosque Manager</Text>
              <Text style={styles.cardRoleSubtitle}>Manage needs & engage donors</Text>
            </View>

            <View style={styles.cardBody}>
              {MOSQUE_BENEFITS.map((benefit, idx) => (
                <View key={idx} style={styles.benefitRow}>
                  <View style={[styles.checkCircle, { backgroundColor: '#ccfbf1' }]}>
                    <Check size={14} color={Colors.teal} />
                  </View>
                  <Text style={[styles.benefitText, { color: colors.textPrimary }]}>{benefit}</Text>
                </View>
              ))}

              <TouchableOpacity
                style={[styles.ctaButton, { backgroundColor: Colors.teal }]}
                onPress={() => router.push('/mosque-login')}
                activeOpacity={0.85}
              >
                <Text style={styles.ctaButtonText}>Continue as Mosque</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>

        {/* Admin Demo Access */}
        <TouchableOpacity
          style={[styles.adminLink, { borderColor: colors.cardBorder }]}
          activeOpacity={0.7}
          onPress={() => setShowAdminModal(true)}
        >
          <Shield size={16} color={colors.textMuted} />
          <Text style={[styles.adminLinkText, { color: colors.textMuted }]}>Admin / Demo Access</Text>
        </TouchableOpacity>
      </ScrollView>

      {/* Admin Login Modal */}
      <Modal visible={showAdminModal} transparent animationType="fade">
        <View style={styles.overlay}>
          <TouchableOpacity style={styles.backdrop} activeOpacity={1} onPress={() => setShowAdminModal(false)} />
          <View style={[styles.adminModal, { backgroundColor: colors.cardBg }]}>
            <TouchableOpacity style={styles.adminCloseBtn} onPress={() => setShowAdminModal(false)}>
              <X size={20} color={colors.textSecondary} />
            </TouchableOpacity>
            <View style={styles.adminIconCircle}>
              <Shield size={28} color={Colors.primary} />
            </View>
            <Text style={[styles.adminTitle, { color: colors.textPrimary }]}>Admin / Demo Mode</Text>
            <Text style={[styles.adminSubtitle, { color: colors.textMuted }]}>
              Enter the admin access code to try SadaqahShare in demo mode with unlimited tokens and no payment required.
            </Text>
            <TextInput
              style={[styles.adminInput, { color: colors.textPrimary, borderColor: adminError ? Colors.red : colors.cardBorder }]}
              value={adminCode}
              onChangeText={(text) => { setAdminCode(text); setAdminError(''); }}
              placeholder="Enter admin code"
              placeholderTextColor={colors.textMuted}
              secureTextEntry
              autoCapitalize="none"
              autoCorrect={false}
            />
            {adminError ? <Text style={styles.adminError}>{adminError}</Text> : null}
            <TouchableOpacity style={styles.adminBtn} activeOpacity={0.85} onPress={handleAdminLogin}>
              <Text style={styles.adminBtnText}>Enter Demo Mode</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  scrollView: {
    flex: 1,
  },
  content: {
    alignSelf: 'center',
    width: '100%',
    paddingBottom: Spacing.huge,
  },

  /* ── Header ── */
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: Spacing.md,
  },
  backButton: {
    width: 44,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: Radius.sm,
  },
  headerTitle: {
    fontFamily: 'Inter-Bold',
    fontSize: FontSize.xl,
    color: Colors.textPrimary,
  },

  subtitle: {
    fontFamily: 'Inter-Regular',
    fontSize: FontSize.md,
    color: Colors.textSecondary,
    textAlign: 'center',
    lineHeight: 22,
    marginBottom: Spacing.xxl,
    maxWidth: 400,
    alignSelf: 'center',
  },

  /* ── Card Grid ── */
  cardRow: {
    gap: Spacing.xl,
  },
  cardRowWide: {
    flexDirection: 'row',
  },
  card: {
    backgroundColor: Colors.cardBg,
    borderRadius: Radius.xl,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: Colors.cardBorder,
    ...Platform.select({
      ios: {
        shadowColor: Colors.black,
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.08,
        shadowRadius: 16,
      },
      android: { elevation: 4 },
      web: {
        shadowColor: Colors.black,
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.08,
        shadowRadius: 16,
      },
    }),
  },
  cardHalf: {
    flex: 1,
  },

  /* ── Card Header ── */
  cardHeader: {
    alignItems: 'center',
    paddingVertical: Spacing.xxxl,
    paddingHorizontal: Spacing.xl,
  },
  cardIconWrap: {
    width: 64,
    height: 64,
    borderRadius: Radius.full,
    backgroundColor: 'rgba(255,255,255,0.2)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: Spacing.md,
  },
  cardRole: {
    fontFamily: 'Inter-Bold',
    fontSize: FontSize.xxl,
    color: Colors.white,
    marginBottom: Spacing.xs,
  },
  cardRoleSubtitle: {
    fontFamily: 'Inter-Regular',
    fontSize: FontSize.sm,
    color: 'rgba(255,255,255,0.85)',
  },

  /* ── Card Body ── */
  cardBody: {
    padding: Spacing.xxl,
    gap: Spacing.md,
  },
  benefitRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: Spacing.md,
  },
  checkCircle: {
    width: 24,
    height: 24,
    borderRadius: Radius.full,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 1,
    flexShrink: 0,
  },
  benefitText: {
    fontFamily: 'Inter-Regular',
    fontSize: FontSize.md,
    color: Colors.textPrimary,
    lineHeight: 22,
    flex: 1,
  },

  /* ── CTA ── */
  ctaButton: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: Spacing.lg,
    borderRadius: Radius.lg,
    marginTop: Spacing.lg,
    minHeight: 52,
    ...Platform.select({
      ios: {
        shadowColor: Colors.black,
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.15,
        shadowRadius: 6,
      },
      android: { elevation: 3 },
      web: {
        shadowColor: Colors.black,
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.15,
        shadowRadius: 6,
      },
    }),
  },
  ctaButtonText: {
    fontFamily: 'Inter-SemiBold',
    fontSize: FontSize.lg,
    color: Colors.white,
  },

  /* ── Admin / Demo ── */
  adminLink: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.sm,
    paddingVertical: Spacing.md,
    marginTop: Spacing.xl,
    borderWidth: 1,
    borderRadius: Radius.md,
    borderStyle: 'dashed',
  },
  adminLinkText: {
    fontFamily: 'Inter-Regular',
    fontSize: FontSize.sm,
  },
  overlay: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  backdrop: {
    ...StyleSheet.absoluteFill,
    backgroundColor: 'rgba(0,0,0,0.5)',
  },
  adminModal: {
    borderRadius: Radius.xl,
    padding: Spacing.xxl,
    width: '90%',
    maxWidth: 400,
    alignItems: 'center',
  },
  adminCloseBtn: {
    position: 'absolute',
    top: Spacing.md,
    right: Spacing.md,
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: Colors.stone100,
    justifyContent: 'center',
    alignItems: 'center',
  },
  adminIconCircle: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: Colors.primaryFaint,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: Spacing.md,
  },
  adminTitle: {
    fontFamily: 'Inter-Bold',
    fontSize: FontSize.xl,
    marginBottom: Spacing.xs,
  },
  adminSubtitle: {
    fontFamily: 'Inter-Regular',
    fontSize: FontSize.sm,
    textAlign: 'center',
    lineHeight: 20,
    marginBottom: Spacing.lg,
  },
  adminInput: {
    width: '100%',
    borderWidth: 1.5,
    borderRadius: Radius.md,
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.md,
    fontFamily: 'Inter-Regular',
    fontSize: FontSize.md,
    minHeight: 48,
  },
  adminError: {
    fontFamily: 'Inter-Regular',
    fontSize: FontSize.sm,
    color: Colors.red,
    marginTop: Spacing.xs,
  },
  adminBtn: {
    backgroundColor: Colors.primary,
    borderRadius: Radius.md,
    paddingVertical: Spacing.md,
    paddingHorizontal: Spacing.xxl,
    marginTop: Spacing.lg,
    minHeight: 48,
    justifyContent: 'center',
    alignItems: 'center',
    width: '100%',
  },
  adminBtnText: {
    fontFamily: 'Inter-Bold',
    fontSize: FontSize.md,
    color: Colors.white,
  },
});
