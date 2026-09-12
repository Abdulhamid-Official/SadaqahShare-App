import React, { useEffect, useState, useCallback } from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  Modal,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { UserX, Users, X } from 'lucide-react-native';
import { supabase } from '@/lib/supabase';
import { useAppContext } from '@/lib/context';
import { Colors, Spacing, Radius, FontSize, useTheme } from '@/lib/theme';

interface Member {
  id: string;
  donor_id: string;
  mosque_id: string;
  joined_at: string;
  donor_name: string;
  donor_email: string;
}

export default function MembersScreen() {
  const { mosqueAccount, isAdmin } = useAppContext();
  const mosqueId = mosqueAccount?.mosque_id;
  const { colors } = useTheme();

  const [members, setMembers] = useState<Member[]>([]);
  const [loading, setLoading] = useState(true);
  const [kickTarget, setKickTarget] = useState<Member | null>(null);
  const [kicking, setKicking] = useState(false);

  const fetchMembers = useCallback(async () => {
    if (!mosqueId || isAdmin) {
      setLoading(false);
      if (isAdmin) {
        setMembers([
          { id: '1', donor_id: 'd1', mosque_id: 'admin-mosque', joined_at: new Date().toISOString(), donor_name: 'Demo Donor 1', donor_email: 'donor1@demo.com' },
          { id: '2', donor_id: 'd2', mosque_id: 'admin-mosque', joined_at: new Date().toISOString(), donor_name: 'Demo Donor 2', donor_email: 'donor2@demo.com' },
        ]);
      }
      return;
    }
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('mosque_members')
        .select('id, donor_id, mosque_id, joined_at')
        .eq('mosque_id', mosqueId);
      if (error) throw error;

      const enriched: Member[] = [];
      for (const m of data || []) {
        const { data: donor } = await supabase
          .from('donors')
          .select('name, email')
          .eq('id', m.donor_id)
          .maybeSingle();
        enriched.push({
          ...m,
          donor_name: donor?.name || 'Unknown',
          donor_email: donor?.email || '',
        });
      }
      setMembers(enriched);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, [mosqueId, isAdmin]);

  useEffect(() => { fetchMembers(); }, [fetchMembers]);

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
    } catch (err) {
      console.error(err);
    } finally {
      setKicking(false);
      setKickTarget(null);
    }
  };

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: colors.background }]} edges={['top']}>
      <View style={styles.header}>
        <Text style={[styles.headerTitle, { color: colors.textPrimary }]}>Members</Text>
        <Text style={[styles.headerSubtitle, { color: colors.textMuted }]}>Manage your mosque community</Text>
      </View>

      {loading ? (
        <View style={styles.centered}><ActivityIndicator size="large" color={Colors.teal} /></View>
      ) : members.length === 0 ? (
        <View style={styles.centered}>
          <Users size={48} color={Colors.stone300} />
          <Text style={[styles.emptyTitle, { color: colors.textSecondary }]}>No Members Yet</Text>
          <Text style={[styles.emptySubtitle, { color: colors.textMuted }]}>Share your join code with donors so they can join your mosque.</Text>
        </View>
      ) : (
        <ScrollView contentContainerStyle={styles.list}>
          {members.map((m) => (
            <View key={m.id} style={[styles.memberCard, { backgroundColor: colors.cardBg, borderColor: colors.cardBorder }]}>
              <View style={styles.memberInfo}>
                <Text style={[styles.memberName, { color: colors.textPrimary }]}>{m.donor_name}</Text>
                <Text style={[styles.memberEmail, { color: colors.textMuted }]}>{m.donor_email}</Text>
                <Text style={[styles.memberDate, { color: colors.stone400 }]}>
                  Joined {new Date(m.joined_at).toLocaleDateString()}
                </Text>
              </View>
              <TouchableOpacity
                style={styles.kickBtn}
                onPress={() => setKickTarget(m)}
                activeOpacity={0.7}
              >
                <UserX size={18} color={Colors.red} />
              </TouchableOpacity>
            </View>
          ))}
        </ScrollView>
      )}

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
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: Colors.background },
  header: { paddingHorizontal: Spacing.lg, paddingTop: Spacing.lg, paddingBottom: Spacing.md },
  headerTitle: { fontFamily: 'Inter-Bold', fontSize: FontSize.xxl, color: Colors.textPrimary },
  headerSubtitle: { fontFamily: 'Inter-Regular', fontSize: FontSize.sm, color: Colors.textMuted, marginTop: Spacing.xs },
  centered: { flex: 1, justifyContent: 'center', alignItems: 'center', paddingHorizontal: Spacing.xxl },
  emptyTitle: { fontFamily: 'Inter-SemiBold', fontSize: FontSize.lg, color: Colors.textSecondary, marginTop: Spacing.lg },
  emptySubtitle: { fontFamily: 'Inter-Regular', fontSize: FontSize.sm, color: Colors.textMuted, textAlign: 'center', marginTop: Spacing.sm, lineHeight: 20 },
  list: { paddingHorizontal: Spacing.lg, paddingBottom: Spacing.huge },
  memberCard: {
    flexDirection: 'row', alignItems: 'center', backgroundColor: Colors.cardBg,
    borderRadius: Radius.lg, padding: Spacing.lg, marginBottom: Spacing.sm,
    borderWidth: 1, borderColor: Colors.cardBorder,
  },
  memberInfo: { flex: 1 },
  memberName: { fontFamily: 'Inter-SemiBold', fontSize: FontSize.md, color: Colors.textPrimary },
  memberEmail: { fontFamily: 'Inter-Regular', fontSize: FontSize.sm, color: Colors.textMuted, marginTop: 2 },
  memberDate: { fontFamily: 'Inter-Regular', fontSize: FontSize.xs, color: Colors.stone400, marginTop: 4 },
  kickBtn: {
    width: 44, height: 44, borderRadius: 22, backgroundColor: Colors.redFaint,
    justifyContent: 'center', alignItems: 'center',
  },
  overlay: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  backdrop: { ...StyleSheet.absoluteFill, backgroundColor: 'rgba(0,0,0,0.5)' },
  confirmCard: { backgroundColor: Colors.white, borderRadius: Radius.xl, padding: Spacing.xxl, width: '85%', maxWidth: 380 },
  closeBtn: { position: 'absolute', top: Spacing.md, right: Spacing.md, width: 36, height: 36, borderRadius: 18, backgroundColor: Colors.stone100, justifyContent: 'center', alignItems: 'center' },
  confirmTitle: { fontFamily: 'Inter-Bold', fontSize: FontSize.xl, color: Colors.textPrimary, marginBottom: Spacing.md },
  confirmMessage: { fontFamily: 'Inter-Regular', fontSize: FontSize.sm, color: Colors.textSecondary, lineHeight: 20, marginBottom: Spacing.xxl },
  confirmButtons: { flexDirection: 'row', gap: Spacing.md },
  cancelButton: { flex: 1, paddingVertical: Spacing.md, borderRadius: Radius.md, borderWidth: 1.5, borderColor: Colors.stone300, alignItems: 'center', minHeight: 48, justifyContent: 'center' },
  cancelButtonText: { fontFamily: 'Inter-SemiBold', fontSize: FontSize.sm, color: Colors.textSecondary },
  confirmButton: { flex: 1, paddingVertical: Spacing.md, borderRadius: Radius.md, backgroundColor: Colors.red, alignItems: 'center', minHeight: 48, justifyContent: 'center' },
  confirmButtonText: { fontFamily: 'Inter-Bold', fontSize: FontSize.sm, color: Colors.white },
});
