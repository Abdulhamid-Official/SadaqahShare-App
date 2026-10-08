import React, { useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  Modal,
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import {
  Building2,
  Mail,
  MapPin,
  CreditCard,
  Info,
  ArrowRightLeft,
  LogOut,
  ChevronRight,
  Users,
  Key,
  MessageSquare,
  BarChart3,
  X,
  Moon,
  Sun,
} from 'lucide-react-native';
import { useAppContext } from '@/lib/context';
import { Colors, Spacing, Radius, FontSize, useTheme } from '@/lib/theme';

export default function SettingsScreen() {
  const { mosqueAccount, mosqueName, mosqueCity, mosqueState, isPaid, isAdmin, logout } =
    useAppContext();

  const [confirmAction, setConfirmAction] = useState<'signout' | 'switch' | null>(null);
  const { colors, isDark, toggleTheme } = useTheme();

  const handleConfirm = async () => {
    if (confirmAction === 'signout') {
      await logout();
      router.replace('/');
    } else if (confirmAction === 'switch') {
      await logout();
      router.replace('/role-select' as any);
    }
    setConfirmAction(null);
  };

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: colors.background }]} edges={['top']}>
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        <Text style={[styles.screenTitle, { color: colors.textPrimary }]}>Settings</Text>

        {/* Mosque Info Card */}
        <View style={[styles.infoCard, { backgroundColor: colors.cardBg, borderColor: colors.cardBorder }]}>
          <View style={styles.avatarCircle}>
            <Building2 size={28} color={Colors.white} />
          </View>

          <Text style={[styles.mosqueName, { color: colors.textPrimary }]}>{mosqueName || 'My Mosque'}</Text>

          {isAdmin && (
            <View style={styles.adminBadge}>
              <Text style={styles.adminBadgeText}>Admin Demo</Text>
            </View>
          )}

          {(mosqueCity || mosqueState) && (
            <View style={styles.locationRow}>
              <MapPin size={14} color={colors.textMuted} />
              <Text style={[styles.locationText, { color: colors.textMuted }]}>
                {[mosqueCity, mosqueState].filter(Boolean).join(', ')}
              </Text>
            </View>
          )}

          {mosqueAccount?.email && (
            <View style={styles.emailRow}>
              <Mail size={14} color={colors.textMuted} />
              <Text style={[styles.emailText, { color: colors.textMuted }]}>{mosqueAccount.email}</Text>
            </View>
          )}

          <View style={[styles.paymentCard, { backgroundColor: colors.stone50, borderColor: colors.stone200 }]}>
            <View style={styles.paymentHeaderRow}>
              <CreditCard size={18} color={Colors.teal} />
              <Text style={[styles.paymentPlanTitle, { color: colors.textPrimary }]}>Mosque Manager Plan</Text>
              <View
                style={[
                  styles.paymentStatusBadge,
                  { backgroundColor: isPaid || isAdmin ? '#ccfbf1' : Colors.redFaint },
                ]}
              >
                <Text
                  style={[
                    styles.paymentStatusText,
                    { color: isPaid || isAdmin ? Colors.teal : Colors.red },
                  ]}
                >
                  {isPaid || isAdmin ? 'Active' : 'Inactive'}
                </Text>
              </View>
            </View>

            <View style={styles.paymentPriceRow}>
              <Text style={styles.paymentPrice}>$35</Text>
              <Text style={[styles.paymentPricePeriod, { color: colors.textMuted }]}>/month</Text>
            </View>

            <View style={styles.paymentFeaturesList}>
              <View style={styles.paymentFeatureRow}>
                <View style={styles.paymentFeatureDot} />
                <Text style={[styles.paymentFeatureText, { color: colors.textSecondary }]}>Manage needs and fundraisers</Text>
              </View>
              <View style={styles.paymentFeatureRow}>
                <View style={styles.paymentFeatureDot} />
                <Text style={[styles.paymentFeatureText, { color: colors.textSecondary }]}>Create community polls</Text>
              </View>
              <View style={styles.paymentFeatureRow}>
                <View style={styles.paymentFeatureDot} />
                <Text style={[styles.paymentFeatureText, { color: colors.textSecondary }]}>View and manage pledges</Text>
              </View>
              <View style={styles.paymentFeatureRow}>
                <View style={styles.paymentFeatureDot} />
                <Text style={[styles.paymentFeatureText, { color: colors.textSecondary }]}>Member management</Text>
              </View>
            </View>

            {!(isPaid || isAdmin) && (
              <TouchableOpacity
                style={styles.paymentSubscribeBtn}
                onPress={() => router.push('/mosque-payment' as any)}
                activeOpacity={0.8}
              >
                <Text style={styles.paymentSubscribeBtnText}>Subscribe Now</Text>
              </TouchableOpacity>
            )}
          </View>
        </View>

        {/* Menu Items */}
        <View style={styles.menuSection}>
          <Text style={[styles.menuSectionTitle, { color: colors.textMuted }]}>Manage</Text>

          <TouchableOpacity
            style={[styles.menuItem, { backgroundColor: colors.cardBg, borderColor: colors.cardBorder }]}
            activeOpacity={0.7}
            onPress={() => router.push('/(mosque-tabs)/polls' as any)}
          >
            <View style={[styles.menuIconCircle, { backgroundColor: '#e0f2fe' }]}>
              <BarChart3 size={18} color={Colors.blue} />
            </View>
            <Text style={[styles.menuItemText, { color: colors.textPrimary }]}>Polls</Text>
            <ChevronRight size={18} color={colors.stone400} />
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.menuItem, { backgroundColor: colors.cardBg, borderColor: colors.cardBorder }]}
            activeOpacity={0.7}
            onPress={() => router.push('/(mosque-tabs)/members' as any)}
          >
            <View style={[styles.menuIconCircle, { backgroundColor: '#ccfbf1' }]}>
              <Users size={18} color={Colors.teal} />
            </View>
            <Text style={[styles.menuItemText, { color: colors.textPrimary }]}>Members</Text>
            <ChevronRight size={18} color={colors.stone400} />
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.menuItem, { backgroundColor: colors.cardBg, borderColor: colors.cardBorder }]}
            activeOpacity={0.7}
            onPress={() => router.push('/(mosque-tabs)/requests' as any)}
          >
            <View style={[styles.menuIconCircle, { backgroundColor: Colors.amberFaint }]}>
              <MessageSquare size={18} color={Colors.amber} />
            </View>
            <Text style={[styles.menuItemText, { color: colors.textPrimary }]}>Donor Suggestions</Text>
            <ChevronRight size={18} color={colors.stone400} />
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.menuItem, { backgroundColor: colors.cardBg, borderColor: colors.cardBorder }]}
            activeOpacity={0.7}
            onPress={() => router.push('/auth-settings' as any)}
          >
            <View style={[styles.menuIconCircle, { backgroundColor: Colors.amberFaint }]}>
              <LogOut size={18} color={Colors.amber} />
            </View>
            <Text style={[styles.menuItemText, { color: colors.textPrimary }]}>Account & Password</Text>
            <ChevronRight size={18} color={colors.stone400} />
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.menuItem, { backgroundColor: colors.cardBg, borderColor: colors.cardBorder }]}
            activeOpacity={0.7}
            onPress={() => router.push('/(mosque-tabs)/join-code' as any)}
          >
            <View style={[styles.menuIconCircle, { backgroundColor: Colors.blueFaint }]}>
              <Key size={18} color={Colors.blue} />
            </View>
            <Text style={[styles.menuItemText, { color: colors.textPrimary }]}>Join Code</Text>
            <ChevronRight size={18} color={colors.stone400} />
          </TouchableOpacity>
        </View>

        <View style={styles.menuSection}>
          <Text style={[styles.menuSectionTitle, { color: colors.textMuted }]}>General</Text>

          <TouchableOpacity style={[styles.menuItem, { backgroundColor: colors.cardBg, borderColor: colors.cardBorder }]} activeOpacity={0.7} onPress={toggleTheme}>
            <View style={[styles.menuIconCircle, { backgroundColor: isDark ? '#1e3a5f' : '#e0f2fe' }]}>
              {isDark ? <Sun size={18} color={colors.amber} /> : <Moon size={18} color={Colors.blue} />}
            </View>
            <Text style={[styles.menuItemText, { color: colors.textPrimary }]}>{isDark ? 'Light Mode' : 'Dark Mode'}</Text>
            <ChevronRight size={18} color={colors.stone400} />
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.menuItem, { backgroundColor: colors.cardBg, borderColor: colors.cardBorder }]}
            activeOpacity={0.7}
            onPress={() => router.push('/about' as any)}
          >
            <View style={[styles.menuIconCircle, { backgroundColor: '#ccfbf1' }]}>
              <Info size={18} color={Colors.teal} />
            </View>
            <Text style={[styles.menuItemText, { color: colors.textPrimary }]}>About SadaqahShare</Text>
            <ChevronRight size={18} color={colors.stone400} />
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.menuItem, { backgroundColor: colors.cardBg, borderColor: colors.cardBorder }]}
            activeOpacity={0.7}
            onPress={() => setConfirmAction('switch')}
          >
            <View style={[styles.menuIconCircle, { backgroundColor: Colors.blueFaint }]}>
              <ArrowRightLeft size={18} color={Colors.blue} />
            </View>
            <Text style={[styles.menuItemText, { color: colors.textPrimary }]}>Switch Role</Text>
            <ChevronRight size={18} color={colors.stone400} />
          </TouchableOpacity>
        </View>

        <View style={styles.dangerSection}>
          <Text style={[styles.menuSectionTitle, { color: colors.textMuted }]}>Account</Text>

          <TouchableOpacity
            style={[styles.dangerItem, { backgroundColor: colors.cardBg }]}
            activeOpacity={0.7}
            onPress={() => setConfirmAction('signout')}
          >
            <View style={[styles.menuIconCircle, { backgroundColor: Colors.redFaint }]}>
              <LogOut size={18} color={Colors.red} />
            </View>
            <Text style={[styles.dangerItemText, { color: Colors.red }]}>Sign Out</Text>
          </TouchableOpacity>
        </View>

        <Text style={[styles.footerText, { color: colors.stone400 }]}>
          SadaqahShare — Empowering mosques, connecting communities
        </Text>
      </ScrollView>

      {/* Confirmation Modal */}
      <Modal visible={confirmAction !== null} transparent animationType="fade">
        <View style={styles.overlay}>
          <TouchableOpacity style={styles.backdrop} activeOpacity={1} onPress={() => setConfirmAction(null)} />
          <View style={[styles.confirmCard, { backgroundColor: colors.cardBg }]}>
            <TouchableOpacity style={[styles.closeBtn, { backgroundColor: colors.stone100 }]} onPress={() => setConfirmAction(null)}>
              <X size={20} color={Colors.textSecondary} />
            </TouchableOpacity>
            <Text style={[styles.confirmTitle, { color: colors.textPrimary }]}>
              {confirmAction === 'signout' ? 'Sign Out' : 'Switch Role'}
            </Text>
            <Text style={[styles.confirmMessage, { color: colors.textSecondary }]}>
              {confirmAction === 'signout'
                ? 'Are you sure you want to sign out of your mosque account?'
                : 'Switch to a different role? You can always come back.'}
            </Text>
            <View style={styles.confirmButtons}>
              <TouchableOpacity
                style={[styles.cancelButton, { borderColor: colors.stone300 }]}
                onPress={() => setConfirmAction(null)}
                activeOpacity={0.7}
              >
                <Text style={[styles.cancelButtonText, { color: colors.textSecondary }]}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.confirmButton, confirmAction === 'signout' && styles.dangerButton]}
                onPress={handleConfirm}
                activeOpacity={0.7}
              >
                <Text style={styles.confirmButtonText}>
                  {confirmAction === 'signout' ? 'Sign Out' : 'Switch'}
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: Colors.background },
  scrollView: { flex: 1 },
  scrollContent: {
    paddingHorizontal: Spacing.lg,
    paddingTop: Spacing.xxl,
    paddingBottom: Spacing.huge,
  },
  screenTitle: {
    fontFamily: 'Inter-Bold',
    fontSize: FontSize.xxl,
    color: Colors.textPrimary,
    marginBottom: Spacing.xxl,
  },
  infoCard: {
    backgroundColor: Colors.cardBg,
    borderRadius: Radius.xl,
    padding: Spacing.xxl,
    alignItems: 'center',
    marginBottom: Spacing.xxl,
    borderWidth: 1,
    borderColor: Colors.cardBorder,
    ...Platform.select({
      ios: { shadowColor: Colors.black, shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.06, shadowRadius: 16 },
      android: { elevation: 4 },
    }),
  },
  avatarCircle: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: Colors.teal,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: Spacing.lg,
  },
  mosqueName: {
    fontFamily: 'Inter-Bold',
    fontSize: FontSize.xl,
    color: Colors.textPrimary,
    marginBottom: Spacing.xs,
    textAlign: 'center',
  },
  adminBadge: {
    backgroundColor: Colors.amberFaint,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.xs,
    borderRadius: Radius.full,
    marginBottom: Spacing.sm,
  },
  adminBadgeText: {
    fontFamily: 'Inter-SemiBold',
    fontSize: FontSize.xs,
    color: Colors.amber,
  },
  locationRow: { flexDirection: 'row', alignItems: 'center', gap: 4, marginBottom: Spacing.xs },
  locationText: { fontFamily: 'Inter-Regular', fontSize: FontSize.sm, color: Colors.textMuted },
  emailRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: Spacing.lg },
  emailText: { fontFamily: 'Inter-Regular', fontSize: FontSize.sm, color: Colors.textMuted },
  paymentCard: {
    width: '100%',
    borderRadius: Radius.lg,
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.lg,
    borderWidth: 1,
    borderColor: Colors.stone200,
    gap: Spacing.md,
  },
  paymentHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
  },
  paymentPlanTitle: { fontFamily: 'Inter-Bold', fontSize: FontSize.md, flex: 1 },
  paymentStatusBadge: { paddingHorizontal: Spacing.md, paddingVertical: Spacing.xs, borderRadius: Radius.full },
  paymentStatusText: { fontFamily: 'Inter-SemiBold', fontSize: FontSize.xs },
  paymentPriceRow: { flexDirection: 'row', alignItems: 'baseline', gap: 2 },
  paymentPrice: { fontFamily: 'Inter-Bold', fontSize: 32, color: Colors.teal },
  paymentPricePeriod: { fontFamily: 'Inter-Regular', fontSize: FontSize.md },
  paymentFeaturesList: { gap: Spacing.sm },
  paymentFeatureRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm },
  paymentFeatureDot: {
    width: 6, height: 6, borderRadius: 3, backgroundColor: Colors.teal,
  },
  paymentFeatureText: { fontFamily: 'Inter-Regular', fontSize: FontSize.sm, lineHeight: 20 },
  paymentSubscribeBtn: {
    backgroundColor: Colors.teal,
    borderRadius: Radius.md,
    paddingVertical: Spacing.lg,
    alignItems: 'center',
    minHeight: 48,
    justifyContent: 'center',
    marginTop: Spacing.xs,
  },
  paymentSubscribeBtnText: { fontFamily: 'Inter-Bold', fontSize: FontSize.md, color: Colors.white },
  menuSection: { marginBottom: Spacing.xxl },
  menuSectionTitle: {
    fontFamily: 'Inter-SemiBold',
    fontSize: FontSize.xs,
    color: Colors.textMuted,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: Spacing.md,
    paddingLeft: Spacing.xs,
  },
  menuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.cardBg,
    borderRadius: Radius.lg,
    padding: Spacing.lg,
    marginBottom: Spacing.sm,
    borderWidth: 1,
    borderColor: Colors.cardBorder,
    minHeight: 56,
    gap: Spacing.md,
  },
  menuIconCircle: { width: 36, height: 36, borderRadius: 18, justifyContent: 'center', alignItems: 'center' },
  menuItemText: { fontFamily: 'Inter-SemiBold', fontSize: FontSize.md, color: Colors.textPrimary, flex: 1 },
  dangerSection: { marginBottom: Spacing.xxl },
  dangerItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.cardBg,
    borderRadius: Radius.lg,
    padding: Spacing.lg,
    marginBottom: Spacing.sm,
    borderWidth: 1,
    borderColor: Colors.redFaint,
    minHeight: 56,
    gap: Spacing.md,
  },
  dangerItemText: { fontFamily: 'Inter-SemiBold', fontSize: FontSize.md, color: Colors.red, flex: 1 },
  footerText: {
    fontFamily: 'Inter-Regular',
    fontSize: FontSize.xs,
    color: Colors.stone400,
    textAlign: 'center',
    lineHeight: 18,
    paddingTop: Spacing.lg,
  },
  // Confirmation modal
  overlay: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  backdrop: { ...StyleSheet.absoluteFill, backgroundColor: 'rgba(0,0,0,0.5)' },
  confirmCard: {
    backgroundColor: Colors.white,
    borderRadius: Radius.xl,
    padding: Spacing.xxl,
    width: '85%',
    maxWidth: 380,
  },
  closeBtn: {
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
  confirmTitle: {
    fontFamily: 'Inter-Bold',
    fontSize: FontSize.xl,
    color: Colors.textPrimary,
    marginBottom: Spacing.md,
  },
  confirmMessage: {
    fontFamily: 'Inter-Regular',
    fontSize: FontSize.sm,
    color: Colors.textSecondary,
    lineHeight: 20,
    marginBottom: Spacing.xxl,
  },
  confirmButtons: { flexDirection: 'row', gap: Spacing.md },
  cancelButton: {
    flex: 1,
    paddingVertical: Spacing.md,
    borderRadius: Radius.md,
    borderWidth: 1.5,
    borderColor: Colors.stone300,
    alignItems: 'center',
    minHeight: 48,
    justifyContent: 'center',
  },
  cancelButtonText: { fontFamily: 'Inter-SemiBold', fontSize: FontSize.sm, color: Colors.textSecondary },
  confirmButton: {
    flex: 1,
    paddingVertical: Spacing.md,
    borderRadius: Radius.md,
    backgroundColor: Colors.teal,
    alignItems: 'center',
    minHeight: 48,
    justifyContent: 'center',
  },
  dangerButton: { backgroundColor: Colors.red },
  confirmButtonText: { fontFamily: 'Inter-Bold', fontSize: FontSize.sm, color: Colors.white },
});
