import React, { useEffect, useState, useCallback } from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  Modal,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import {
  User,
  Mail,
  Star,
  Coins,
  Info,
  ArrowRightLeft,
  LogOut,
  X,
  Moon,
  Sun,
  Building2,
  ChevronRight,
} from 'lucide-react-native';
import { supabase } from '@/lib/supabase';
import { useAppContext } from '@/lib/context';
import { Colors, Spacing, Radius, FontSize, useTheme } from '@/lib/theme';
import { useRealtimeTable } from '@/hooks/useRealtimeTable';

export default function ProfileScreen() {
  const { donor, isAdmin, logout } = useAppContext();
  const { colors, isDark, toggleTheme } = useTheme();
  const [totalTokens, setTotalTokens] = useState(0);
  const [confirmAction, setConfirmAction] = useState<'signout' | 'switch' | null>(null);
  const [joinedMosques, setJoinedMosques] = useState<{ id: string; name: string; city: string; state: string; member_id: string }[]>([]);
  const [leaveMosque, setLeaveMosque] = useState<{ id: string; name: string; member_id: string } | null>(null);
  const [leaving, setLeaving] = useState(false);
  const [leaveError, setLeaveError] = useState<string | null>(null);

  const fetchTokens = useCallback(async () => {
    if (!donor || isAdmin) return;
    try {
      const { data, error } = await supabase
        .from('donor_mosque_tokens')
        .select('token_balance')
        .eq('donor_id', donor.id);
      if (error) return;
      const total = (data || []).reduce((sum, t) => sum + (t.token_balance || 0), 0);
      setTotalTokens(total);
    } catch (err) {
      console.error('Error:', err);
    }
  }, [donor, isAdmin]);

  const fetchMosques = useCallback(async () => {
    if (!donor || isAdmin) return;
    try {
      const { data, error } = await supabase
        .from('mosque_members')
        .select('id, mosque_id, mosques(name, city, state)')
        .eq('donor_id', donor.id);
      if (error) return;
      if (data) {
        const mapped = data.map((m: any) => ({
          id: m.mosque_id,
          name: m.mosques?.name ?? 'Mosque',
          city: m.mosques?.city ?? '',
          state: m.mosques?.state ?? '',
          member_id: m.id,
        }));
        setJoinedMosques(mapped);
      }
    } catch (err) {
      console.error('Error fetching mosques:', err);
    }
  }, [donor, isAdmin]);

  useEffect(() => {
    if (!donor || isAdmin) {
      if (isAdmin) setTotalTokens(999999);
      return;
    }
    fetchTokens();
    fetchMosques();
  }, [donor, isAdmin, fetchTokens, fetchMosques]);

  useRealtimeTable('donor_mosque_tokens', donor ? `donor_id=eq.${donor.id}` : null, fetchTokens, !!donor && !isAdmin);

  const getInitial = (name: string) => name.charAt(0).toUpperCase();

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

  const handleLeaveMosque = async () => {
    if (!leaveMosque || !donor) return;
    setLeaving(true);
    setLeaveError(null);
    try {
      const { error } = await supabase
        .from('mosque_members')
        .delete()
        .eq('id', leaveMosque.member_id);
      if (error) throw error;
      setJoinedMosques(prev => prev.filter(m => m.id !== leaveMosque.id));
      setLeaveMosque(null);
    } catch (e: any) {
      setLeaveError(e.message ?? 'Failed to leave mosque.');
    } finally {
      setLeaving(false);
    }
  };

  if (!donor) {
    return (
      <SafeAreaView style={[styles.safe, { backgroundColor: colors.background }]} edges={['top']}>
        <View style={styles.centered}>
          <Text style={styles.noProfileText}>No donor profile found</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: colors.background }]} edges={['top']}>
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        <View style={[styles.profileCard, { backgroundColor: colors.cardBg, borderColor: colors.cardBorder }]}>
          <View style={styles.avatarCircle}>
            <Text style={styles.avatarText}>{getInitial(donor.name)}</Text>
          </View>

          <Text style={[styles.profileName, { color: colors.textPrimary }]}>{donor.name}</Text>

          {isAdmin && (
            <View style={styles.adminBadge}>
              <Text style={styles.adminBadgeText}>Admin Demo</Text>
            </View>
          )}

          <View style={styles.emailRow}>
            <Mail size={14} color={Colors.textMuted} />
            <Text style={[styles.emailText, { color: colors.textMuted }]}>{donor.email}</Text>
          </View>

          {donor.is_member && (
            <View style={styles.memberBadge}>
              <Star size={14} color={Colors.amber} fill={Colors.amber} />
              <Text style={styles.memberBadgeText}>Community Member</Text>
            </View>
          )}

          <View style={[styles.tokenSummary, { backgroundColor: colors.inputBg, borderColor: colors.inputBorder }]}>
            <Coins size={22} color={Colors.amber} />
            <View style={styles.tokenInfo}>
              <Text style={styles.tokenCount}>{isAdmin ? 'Unlimited' : totalTokens}</Text>
              <Text style={styles.tokenLabel}>Total Tokens</Text>
            </View>
          </View>
        </View>

        <View style={styles.menuSection}>
          <Text style={styles.menuSectionTitle}>General</Text>

          <TouchableOpacity style={[styles.menuItem, { backgroundColor: colors.cardBg, borderColor: colors.cardBorder }]} activeOpacity={0.7} onPress={toggleTheme}>
            <View style={[styles.menuIconCircle, { backgroundColor: isDark ? '#1e3a5f' : '#e0f2fe' }]}>
              {isDark ? <Sun size={18} color={colors.amber} /> : <Moon size={18} color={Colors.blue} />}
            </View>
            <Text style={[styles.menuItemText, { color: colors.textPrimary }]}>{isDark ? 'Light Mode' : 'Dark Mode'}</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.menuItem, { backgroundColor: colors.cardBg, borderColor: colors.cardBorder }]}
            activeOpacity={0.7}
            onPress={() => router.push('/about' as any)}
          >
            <View style={[styles.menuIconCircle, { backgroundColor: Colors.primaryFaint }]}>
              <Info size={18} color={Colors.primary} />
            </View>
            <Text style={[styles.menuItemText, { color: colors.textPrimary }]}>About SadaqahShare</Text>
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
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.menuItem, { backgroundColor: colors.cardBg, borderColor: colors.cardBorder }]}
            activeOpacity={0.7}
            onPress={() => router.push('/auth-settings' as any)}
          >
            <View style={[styles.menuIconCircle, { backgroundColor: Colors.amberFaint }]}>
              <Info size={18} color={Colors.amber} />
            </View>
            <Text style={[styles.menuItemText, { color: colors.textPrimary }]}>Account & Password</Text>
          </TouchableOpacity>
        </View>

        {joinedMosques.length > 0 && (
          <View style={styles.menuSection}>
            <Text style={styles.menuSectionTitle}>My Mosques</Text>
            {joinedMosques.map((m) => (
              <View
                key={m.id}
                style={[styles.menuItem, { backgroundColor: colors.cardBg, borderColor: colors.cardBorder }]}
              >
                <View style={[styles.menuIconCircle, { backgroundColor: Colors.primaryFaint }]}>
                  <Building2 size={18} color={Colors.primary} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={[styles.menuItemText, { color: colors.textPrimary }]} numberOfLines={1}>{m.name}</Text>
                  {m.city ? (
                    <Text style={[styles.mosqueCityText, { color: colors.textMuted }]} numberOfLines={1}>{m.city}, {m.state}</Text>
                  ) : null}
                </View>
                <TouchableOpacity
                  style={styles.leaveBtn}
                  onPress={() => { setLeaveMosque({ id: m.id, name: m.name, member_id: m.member_id }); setLeaveError(null); }}
                  activeOpacity={0.7}
                >
                  <Text style={styles.leaveBtnText}>Leave</Text>
                </TouchableOpacity>
              </View>
            ))}
          </View>
        )}

        <View style={styles.dangerSection}>
          <Text style={styles.dangerSectionTitle}>Account</Text>

          <TouchableOpacity
            style={[styles.dangerItem, { backgroundColor: colors.cardBg }]}
            activeOpacity={0.7}
            onPress={() => setConfirmAction('signout')}
          >
            <View style={[styles.menuIconCircle, { backgroundColor: Colors.redFaint }]}>
              <LogOut size={18} color={Colors.red} />
            </View>
            <Text style={styles.dangerItemText}>Sign Out</Text>
          </TouchableOpacity>
        </View>

        <Text style={[styles.footerText, { color: colors.textMuted }]}>
          SadaqahShare — Connecting generous hearts with mosque needs
        </Text>
      </ScrollView>

      {/* Confirmation Modal */}
      <Modal visible={confirmAction !== null} transparent animationType="fade">
        <View style={styles.overlay}>
          <TouchableOpacity style={[styles.backdrop, { backgroundColor: colors.modalOverlay }]} activeOpacity={1} onPress={() => setConfirmAction(null)} />
          <View style={[styles.confirmCard, { backgroundColor: colors.cardBg }]}>
            <TouchableOpacity style={styles.closeBtn} onPress={() => setConfirmAction(null)}>
              <X size={20} color={Colors.textSecondary} />
            </TouchableOpacity>
            <Text style={[styles.confirmTitle, { color: colors.textPrimary }]}>
              {confirmAction === 'signout' ? 'Sign Out' : 'Switch Role'}
            </Text>
            <Text style={[styles.confirmMessage, { color: colors.textSecondary }]}>
              {confirmAction === 'signout'
                ? 'Are you sure you want to sign out?'
                : 'Switch to a different role? You can always come back.'}
            </Text>
            <View style={styles.confirmButtons}>
              <TouchableOpacity
                style={styles.cancelButton}
                onPress={() => setConfirmAction(null)}
                activeOpacity={0.7}
              >
                <Text style={styles.cancelButtonText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.confirmButton, confirmAction === 'signout' && styles.dangerConfirmButton]}
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

      {/* Leave Mosque Modal */}
      <Modal visible={leaveMosque !== null} transparent animationType="fade">
        <View style={styles.overlay}>
          <TouchableOpacity style={[styles.backdrop, { backgroundColor: colors.modalOverlay }]} activeOpacity={1} onPress={() => setLeaveMosque(null)} />
          <View style={[styles.confirmCard, { backgroundColor: colors.cardBg }]}>
            <TouchableOpacity style={styles.closeBtn} onPress={() => setLeaveMosque(null)}>
              <X size={20} color={Colors.textSecondary} />
            </TouchableOpacity>
            <Text style={[styles.confirmTitle, { color: colors.textPrimary }]}>Leave Mosque?</Text>
            <Text style={[styles.confirmMessage, { color: colors.textSecondary }]}>
              You will no longer receive updates or be able to donate to {leaveMosque?.name}. Your token balance for this mosque will remain but you can only use it if you rejoin.
            </Text>
            {leaveError ? <Text style={styles.leaveErrorText}>{leaveError}</Text> : null}
            <View style={styles.confirmButtons}>
              <TouchableOpacity style={styles.cancelButton} onPress={() => setLeaveMosque(null)} activeOpacity={0.7}>
                <Text style={styles.cancelButtonText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.confirmButton, styles.dangerConfirmButton, leaving && { opacity: 0.7 }]}
                onPress={handleLeaveMosque}
                activeOpacity={0.7}
                disabled={leaving}
              >
                <Text style={styles.confirmButtonText}>{leaving ? 'Leaving…' : 'Leave'}</Text>
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
  centered: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  noProfileText: { fontFamily: 'Inter-Regular', fontSize: FontSize.md, color: Colors.textMuted },
  scrollView: { flex: 1 },
  scrollContent: { paddingHorizontal: Spacing.lg, paddingTop: Spacing.xxl, paddingBottom: Spacing.huge },
  profileCard: {
    backgroundColor: Colors.cardBg,
    borderRadius: Radius.xl,
    padding: Spacing.xxl,
    alignItems: 'center',
    marginBottom: Spacing.xxl,
    borderWidth: 1,
    borderColor: Colors.cardBorder,
    shadowColor: Colors.black,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.06,
    shadowRadius: 16,
    elevation: 4,
  },
  avatarCircle: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: Colors.primary,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: Spacing.lg,
  },
  avatarText: { fontFamily: 'Inter-Bold', fontSize: FontSize.xxxl, color: Colors.white },
  profileName: {
    fontFamily: 'Inter-Bold',
    fontSize: FontSize.xl,
    color: Colors.textPrimary,
    marginBottom: Spacing.xs,
  },
  adminBadge: {
    backgroundColor: Colors.amberFaint,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.xs,
    borderRadius: Radius.full,
    marginBottom: Spacing.sm,
  },
  adminBadgeText: { fontFamily: 'Inter-SemiBold', fontSize: FontSize.xs, color: Colors.amber },
  emailRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: Spacing.md },
  emailText: { fontFamily: 'Inter-Regular', fontSize: FontSize.sm, color: Colors.textMuted },
  memberBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.amberFaint,
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.sm,
    borderRadius: Radius.full,
    gap: 6,
    marginBottom: Spacing.lg,
  },
  memberBadgeText: { fontFamily: 'Inter-SemiBold', fontSize: FontSize.sm, color: Colors.amber },
  tokenSummary: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.stone50,
    borderRadius: Radius.lg,
    padding: Spacing.lg,
    width: '100%',
    gap: Spacing.md,
    borderWidth: 1,
    borderColor: Colors.stone200,
  },
  tokenInfo: { flex: 1 },
  tokenCount: { fontFamily: 'Inter-Bold', fontSize: FontSize.xxl, color: Colors.amber },
  tokenLabel: { fontFamily: 'Inter-Regular', fontSize: FontSize.xs, color: Colors.textMuted, marginTop: 2 },
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
  mosqueCityText: { fontFamily: 'Inter-Regular', fontSize: FontSize.xs, marginTop: 2 },
  leaveBtn: {
    backgroundColor: Colors.redFaint,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    borderRadius: Radius.md,
  },
  leaveBtnText: { fontFamily: 'Inter-SemiBold', fontSize: FontSize.sm, color: Colors.red },
  dangerSection: { marginBottom: Spacing.xxl },
  dangerSectionTitle: {
    fontFamily: 'Inter-SemiBold',
    fontSize: FontSize.xs,
    color: Colors.textMuted,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: Spacing.md,
    paddingLeft: Spacing.xs,
  },
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
  confirmTitle: { fontFamily: 'Inter-Bold', fontSize: FontSize.xl, color: Colors.textPrimary, marginBottom: Spacing.md },
  confirmMessage: { fontFamily: 'Inter-Regular', fontSize: FontSize.sm, color: Colors.textSecondary, lineHeight: 20, marginBottom: Spacing.xxl },
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
    backgroundColor: Colors.primary,
    alignItems: 'center',
    minHeight: 48,
    justifyContent: 'center',
  },
  dangerConfirmButton: { backgroundColor: Colors.red },
  confirmButtonText: { fontFamily: 'Inter-Bold', fontSize: FontSize.sm, color: Colors.white },
  leaveErrorText: { fontFamily: 'Inter-Regular', fontSize: FontSize.sm, color: Colors.red, marginBottom: Spacing.md, textAlign: 'center' },
});
