import React, { useEffect, useState, useCallback } from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  Modal,
  TextInput,
  ViewStyle,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { UserX, Users, X, UserPlus, AlertCircle } from 'lucide-react-native';
import { supabase } from '@/lib/supabase';
import { useAppContext } from '@/lib/context';
import { Colors, Spacing, Radius, FontSize, useTheme } from '@/lib/theme';
import { useRealtimeTable } from '@/hooks/useRealtimeTable';

interface Member {
  id: string;
  donor_id: string;
  mosque_id: string;
  joined_at: string;
  donor_name: string;
  donor_email: string;
}

export default function MembersScreen() {
  const { mosqueAccount, isAdmin, isPaid } = useAppContext();
  const mosqueId = mosqueAccount?.mosque_id;
  const { colors } = useTheme();

  const [members, setMembers] = useState<Member[]>([]);
  const [loading, setLoading] = useState(true);
  const [kickTarget, setKickTarget] = useState<Member | null>(null);
  const [kicking, setKicking] = useState(false);
  const [addModal, setAddModal] = useState(false);
  const [addEmail, setAddEmail] = useState('');
  const [adding, setAdding] = useState(false);
  const [addError, setAddError] = useState<string | null>(null);
  const [addSuccess, setAddSuccess] = useState<string | null>(null);
  const [memberCount, setMemberCount] = useState(0);
  const [maxMembers, setMaxMembers] = useState(25);

  const fetchMembers = useCallback(async () => {
    if (!mosqueId || isAdmin) {
      setLoading(false);
      if (isAdmin) {
        setMembers([
          { id: '1', donor_id: 'd1', mosque_id: 'admin-mosque', joined_at: new Date().toISOString(), donor_name: 'Demo Donor 1', donor_email: 'donor1@demo.com' },
          { id: '2', donor_id: 'd2', mosque_id: 'admin-mosque', joined_at: new Date().toISOString(), donor_name: 'Demo Donor 2', donor_email: 'donor2@demo.com' },
        ]);
        setMemberCount(2);
      }
      return;
    }
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('mosque_members')
        .select('id, donor_id, mosque_id, joined_at, donors(name, email)')
        .eq('mosque_id', mosqueId);
      if (error) throw error;

      const enriched: Member[] = (data || []).map((m: any) => ({
        id: m.id,
        donor_id: m.donor_id,
        mosque_id: m.mosque_id,
        joined_at: m.joined_at,
        donor_name: m.donors?.name || 'Unknown',
        donor_email: m.donors?.email || '',
      }));
      setMembers(enriched);
      setMemberCount(enriched.length);

      if (mosqueAccount?.max_members) {
        setMaxMembers(mosqueAccount.max_members);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, [mosqueId, isAdmin, mosqueAccount]);

  useEffect(() => { fetchMembers(); }, [fetchMembers]);

  useRealtimeTable('mosque_members', mosqueId ? `mosque_id=eq.${mosqueId}` : null, fetchMembers, !!mosqueId);

  const handleKick = async () => {
    if (!kickTarget || isAdmin) {
      if (isAdmin && kickTarget) {
        setMembers((prev) => prev.filter((m) => m.id !== kickTarget.id));
      }
      setKickTarget(null);
      return;
    }
    setKicking(true);
    try {
      await supabase.from('mosque_members').delete().eq('id', kickTarget.id);
      setMembers((prev) => prev.filter((m) => m.id !== kickTarget.id));
      setMemberCount((prev) => prev - 1);
    } catch (err) {
      console.error(err);
    } finally {
      setKicking(false);
      setKickTarget(null);
    }
  };

  const handleAddDonor = async () => {
    const trimmedEmail = addEmail.trim().toLowerCase();
    if (!trimmedEmail) {
      setAddError('Please enter a donor email address.');
      return;
    }
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(trimmedEmail)) {
      setAddError('Please enter a valid email address.');
      return;
    }

    setAdding(true);
    setAddError(null);
    setAddSuccess(null);

    try {
      // Find the donor by email
      const { data: donor, error: donorErr } = await supabase
        .from('donors')
        .select('id, name')
        .eq('email', trimmedEmail)
        .maybeSingle();

      if (donorErr) throw donorErr;
      if (!donor) {
        setAddError('No donor found with that email. The donor must create an account first.');
        return;
      }

      // Use server-side function to add member (enforces cap + subscription)
      const { data, error: rpcErr } = await supabase.rpc('add_mosque_member', {
        p_donor_id: donor.id,
        p_mosque_id: mosqueId,
      });

      if (rpcErr) throw rpcErr;

      const result = data as any;
      if (!result.success) {
        setAddError(result.error || 'Failed to add member.');
        return;
      }

      setAddSuccess(`${donor.name} has been added to your mosque.`);
      setAddEmail('');
      fetchMembers();
      setTimeout(() => {
        setAddModal(false);
        setAddSuccess(null);
      }, 1500);
    } catch (e: any) {
      setAddError(e.message || 'Failed to add member.');
    } finally {
      setAdding(false);
    }
  };

  const atCapacity = memberCount >= maxMembers;
  const subscriptionInactive = !isPaid && !isAdmin;

  const cardStyle: ViewStyle = {
    backgroundColor: colors.cardBg,
    borderColor: colors.cardBorder,
  };

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: colors.background }]} edges={['top']}>
      <View style={styles.header}>
        <Text style={[styles.headerTitle, { color: colors.textPrimary }]}>Members</Text>
        <Text style={[styles.headerSubtitle, { color: colors.textMuted }]}>
          {memberCount} of {maxMembers} members
        </Text>
      </View>

      {/* Capacity / Subscription Warning */}
      {subscriptionInactive && !isAdmin && (
        <View style={styles.warningBanner}>
          <AlertCircle size={18} color={Colors.amber} />
          <Text style={styles.warningText}>
            Subscription inactive. New members cannot be added until the subscription is active.
          </Text>
        </View>
      )}
      {atCapacity && !subscriptionInactive && !isAdmin && (
        <View style={styles.warningBanner}>
          <AlertCircle size={18} color={Colors.amber} />
          <Text style={styles.warningText}>
            Member limit reached ({maxMembers}). Upgrade your plan to add more members.
          </Text>
        </View>
      )}

      {loading ? (
        <View style={styles.centered}><ActivityIndicator size="large" color={Colors.teal} /></View>
      ) : members.length === 0 ? (
        <View style={styles.centered}>
          <Users size={48} color={Colors.stone300} />
          <Text style={[styles.emptyTitle, { color: colors.textSecondary }]}>No Members Yet</Text>
          <Text style={[styles.emptySubtitle, { color: colors.textMuted }]}>Share your join code with donors or add them by email below.</Text>
        </View>
      ) : (
        <ScrollView contentContainerStyle={styles.list}>
          {members.map((m) => (
            <View key={m.id} style={[styles.memberCard, cardStyle]}>
              <View style={styles.memberInfo}>
                <Text style={[styles.memberName, { color: colors.textPrimary }]}>{m.donor_name}</Text>
                <Text style={[styles.memberEmail, { color: colors.textMuted }]}>{m.donor_email}</Text>
                <Text style={[styles.memberDate, { color: colors.stone400 }]}>
                  Joined {new Date(m.joined_at).toLocaleDateString()}
                </Text>
              </View>
              {!isAdmin ? (
                <TouchableOpacity
                  style={styles.kickBtn}
                  onPress={() => setKickTarget(m)}
                  activeOpacity={0.7}
                >
                  <UserX size={18} color={Colors.red} />
                </TouchableOpacity>
              ) : null}
            </View>
          ))}
        </ScrollView>
      )}

      {/* Add Donor Button */}
      {!isAdmin && (
        <View style={styles.bottomBar}>
          <TouchableOpacity
            style={[
              styles.addBtn,
              (atCapacity || subscriptionInactive) && { opacity: 0.5 },
            ]}
            onPress={() => {
              if (atCapacity) {
                router.push('/mosque-payment' as any);
                return;
              }
              if (subscriptionInactive) {
                router.push('/mosque-payment' as any);
                return;
              }
              setAddModal(true);
              setAddError(null);
              setAddSuccess(null);
              setAddEmail('');
            }}
            activeOpacity={0.8}
            disabled={false}
          >
            <UserPlus size={20} color={Colors.white} />
            <Text style={styles.addBtnText}>
              {atCapacity ? 'Upgrade Plan' : subscriptionInactive ? 'Activate Subscription' : 'Add Donor by Email'}
            </Text>
          </TouchableOpacity>
        </View>
      )}

      {/* Kick Member Modal */}
      <Modal visible={kickTarget !== null} transparent animationType="fade">
        <View style={styles.overlay}>
          <TouchableOpacity style={[styles.backdrop, { backgroundColor: colors.modalOverlay }]} activeOpacity={1} onPress={() => setKickTarget(null)} />
          <View style={[styles.confirmCard, { backgroundColor: colors.cardBg }]}>
            <TouchableOpacity style={[styles.closeBtn, { backgroundColor: colors.stone100 }]} onPress={() => setKickTarget(null)}>
              <X size={20} color={Colors.textSecondary} />
            </TouchableOpacity>
            <Text style={[styles.confirmTitle, { color: colors.textPrimary }]}>Remove Member</Text>
            <Text style={[styles.confirmMessage, { color: colors.textSecondary }]}>
              Remove {kickTarget?.donor_name} from your mosque? They can rejoin with the join code.
            </Text>
            <View style={styles.confirmButtons}>
              <TouchableOpacity style={[styles.cancelButton, { borderColor: colors.stone300 }]} onPress={() => setKickTarget(null)}>
                <Text style={[styles.cancelButtonText, { color: colors.textSecondary }]}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.confirmButton, kicking && { opacity: 0.7 }]}
                onPress={handleKick}
                disabled={kicking}
              >
                <Text style={styles.confirmButtonText}>{kicking ? 'Removing...' : 'Remove'}</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Add Donor Modal */}
      <Modal visible={addModal} transparent animationType="fade">
        <View style={styles.overlay}>
          <TouchableOpacity style={[styles.backdrop, { backgroundColor: colors.modalOverlay }]} activeOpacity={1} onPress={() => setAddModal(false)} />
          <View style={[styles.confirmCard, { backgroundColor: colors.cardBg }]}>
            <TouchableOpacity style={[styles.closeBtn, { backgroundColor: colors.stone100 }]} onPress={() => setAddModal(false)}>
              <X size={20} color={Colors.textSecondary} />
            </TouchableOpacity>
            <Text style={[styles.confirmTitle, { color: colors.textPrimary }]}>Add Donor by Email</Text>
            <Text style={[styles.confirmMessage, { color: colors.textSecondary }]}>
              Enter the email address of a registered donor to add them to your mosque.
            </Text>
            <View style={[styles.inputContainer, { backgroundColor: colors.inputBg, borderColor: colors.inputBorder }]}>
              <TextInput
                style={[styles.input, { color: colors.textPrimary }]}
                placeholder="donor@email.com"
                placeholderTextColor={Colors.stone400}
                keyboardType="email-address"
                autoCapitalize="none"
                autoCorrect={false}
                value={addEmail}
                onChangeText={(t) => { setAddEmail(t); setAddError(null); }}
                editable={!adding}
              />
            </View>
            {addError && <Text style={styles.errorText}>{addError}</Text>}
            {addSuccess && <Text style={styles.successText}>{addSuccess}</Text>}
            <View style={styles.confirmButtons}>
              <TouchableOpacity style={[styles.cancelButton, { borderColor: colors.stone300 }]} onPress={() => setAddModal(false)}>
                <Text style={[styles.cancelButtonText, { color: colors.textSecondary }]}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.confirmButton, { backgroundColor: Colors.teal }, adding && { opacity: 0.7 }]}
                onPress={handleAddDonor}
                disabled={adding}
              >
                <Text style={styles.confirmButtonText}>{adding ? 'Adding...' : 'Add Member'}</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

import { router } from 'expo-router';

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: Colors.background },
  header: { paddingHorizontal: Spacing.lg, paddingTop: Spacing.lg, paddingBottom: Spacing.md },
  headerTitle: { fontFamily: 'Inter-Bold', fontSize: FontSize.xxl },
  headerSubtitle: { fontFamily: 'Inter-Regular', fontSize: FontSize.sm, marginTop: Spacing.xs },
  warningBanner: {
    flexDirection: 'row', alignItems: 'center', gap: Spacing.sm,
    backgroundColor: Colors.amberFaint, paddingHorizontal: Spacing.lg, paddingVertical: Spacing.md,
    marginHorizontal: Spacing.lg, marginBottom: Spacing.md, borderRadius: Radius.md,
  },
  warningText: { flex: 1, fontFamily: 'Inter-SemiBold', fontSize: FontSize.xs, color: Colors.amber, lineHeight: 18 },
  centered: { flex: 1, justifyContent: 'center', alignItems: 'center', paddingHorizontal: Spacing.xxl },
  emptyTitle: { fontFamily: 'Inter-SemiBold', fontSize: FontSize.lg, marginTop: Spacing.lg },
  emptySubtitle: { fontFamily: 'Inter-Regular', fontSize: FontSize.sm, textAlign: 'center', marginTop: Spacing.sm, lineHeight: 20 },
  list: { paddingHorizontal: Spacing.lg, paddingBottom: 100 },
  memberCard: {
    flexDirection: 'row', alignItems: 'center',
    borderRadius: Radius.lg, padding: Spacing.lg, marginBottom: Spacing.sm,
    borderWidth: 1,
  },
  memberInfo: { flex: 1 },
  memberName: { fontFamily: 'Inter-SemiBold', fontSize: FontSize.md },
  memberEmail: { fontFamily: 'Inter-Regular', fontSize: FontSize.sm, marginTop: 2 },
  memberDate: { fontFamily: 'Inter-Regular', fontSize: FontSize.xs, marginTop: 4 },
  kickBtn: {
    width: 44, height: 44, borderRadius: 22, backgroundColor: Colors.redFaint,
    justifyContent: 'center', alignItems: 'center',
  },
  bottomBar: {
    position: 'absolute', bottom: 0, left: 0, right: 0,
    paddingHorizontal: Spacing.lg, paddingVertical: Spacing.lg,
    backgroundColor: 'transparent',
  },
  addBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: Spacing.sm,
    backgroundColor: Colors.teal, borderRadius: Radius.md,
    paddingVertical: Spacing.lg, minHeight: 52,
    shadowColor: Colors.teal, shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25, shadowRadius: 8, elevation: 4,
  },
  addBtnText: { fontFamily: 'Inter-Bold', fontSize: FontSize.md, color: Colors.white },
  overlay: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  backdrop: { ...StyleSheet.absoluteFill, backgroundColor: 'rgba(0,0,0,0.5)' },
  confirmCard: { borderRadius: Radius.xl, padding: Spacing.xxl, width: '85%', maxWidth: 380 },
  closeBtn: { position: 'absolute', top: Spacing.md, right: Spacing.md, width: 36, height: 36, borderRadius: 18, justifyContent: 'center', alignItems: 'center' },
  confirmTitle: { fontFamily: 'Inter-Bold', fontSize: FontSize.xl, marginBottom: Spacing.md },
  confirmMessage: { fontFamily: 'Inter-Regular', fontSize: FontSize.sm, lineHeight: 20, marginBottom: Spacing.lg },
  inputContainer: {
    width: '100%', height: 50, borderRadius: Radius.md, borderWidth: 1, justifyContent: 'center', marginBottom: Spacing.md,
  },
  input: {
    flex: 1, height: '100%', paddingHorizontal: Spacing.lg,
    fontFamily: 'Inter-Regular', fontSize: FontSize.md,
  },
  errorText: { fontFamily: 'Inter-SemiBold', fontSize: FontSize.sm, color: Colors.red, marginBottom: Spacing.sm, textAlign: 'center' },
  successText: { fontFamily: 'Inter-SemiBold', fontSize: FontSize.sm, color: Colors.teal, marginBottom: Spacing.sm, textAlign: 'center' },
  confirmButtons: { flexDirection: 'row', gap: Spacing.md },
  cancelButton: {
    flex: 1, paddingVertical: Spacing.md, borderRadius: Radius.md, borderWidth: 1.5,
    alignItems: 'center', minHeight: 48, justifyContent: 'center',
  },
  cancelButtonText: { fontFamily: 'Inter-SemiBold', fontSize: FontSize.sm },
  confirmButton: {
    flex: 1, paddingVertical: Spacing.md, borderRadius: Radius.md, backgroundColor: Colors.red,
    alignItems: 'center', minHeight: 48, justifyContent: 'center',
  },
  confirmButtonText: { fontFamily: 'Inter-Bold', fontSize: FontSize.sm, color: Colors.white },
});
