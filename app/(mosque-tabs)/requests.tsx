import React, { useEffect, useState, useCallback } from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  ActivityIndicator,
  TouchableOpacity,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ArrowLeft, MessageSquare } from 'lucide-react-native';
import { router } from 'expo-router';
import { supabase } from '@/lib/supabase';
import { useAppContext } from '@/lib/context';
import { Colors, Spacing, Radius, FontSize, useTheme } from '@/lib/theme';
import { useRealtimeTable } from '@/hooks/useRealtimeTable';

interface RequestItem {
  id: string;
  title: string;
  description: string | null;
  donor_name: string;
  created_at: string;
}

export default function RequestsScreen() {
  const { mosqueAccount, isAdmin } = useAppContext();
  const mosqueId = mosqueAccount?.mosque_id;
  const { colors } = useTheme();

  const [requests, setRequests] = useState<RequestItem[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchRequests = useCallback(async () => {
    if (isAdmin) {
      setRequests([
        { id: '1', title: 'Quran Classes', description: 'Would love Quran classes for kids on weekends.', donor_name: 'Demo Donor', created_at: new Date().toISOString() },
        { id: '2', title: 'Wheelchair Ramp', description: 'Accessibility ramp needed at the main entrance.', donor_name: 'Demo Donor 2', created_at: new Date().toISOString() },
      ]);
      setLoading(false);
      return;
    }
    if (!mosqueId) { setLoading(false); return; }
    try {
      const { data, error } = await supabase
        .from('donor_requests')
        .select('id, title, description, donor_id, created_at')
        .eq('mosque_id', mosqueId)
        .order('created_at', { ascending: false });
      if (error) throw error;

      const enriched: RequestItem[] = [];
      for (const r of data || []) {
        const { data: donor } = await supabase
          .from('donors')
          .select('name')
          .eq('id', r.donor_id)
          .maybeSingle();
        enriched.push({
          id: r.id,
          title: r.title,
          description: r.description,
          donor_name: donor?.name || 'Anonymous',
          created_at: r.created_at,
        });
      }
      setRequests(enriched);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, [mosqueId, isAdmin]);

  useEffect(() => { fetchRequests(); }, [fetchRequests]);

  useRealtimeTable('donor_requests', mosqueId ? `mosque_id=eq.${mosqueId}` : null, fetchRequests, !!mosqueId && !isAdmin);

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: colors.background }]} edges={['top']}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <ArrowLeft size={22} color={colors.stone600} />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: colors.textPrimary }]}>Donor Requests</Text>
      </View>

      {loading ? (
        <View style={styles.centered}><ActivityIndicator size="large" color={Colors.teal} /></View>
      ) : requests.length === 0 ? (
        <View style={styles.centered}>
          <MessageSquare size={48} color={Colors.stone300} />
          <Text style={[styles.emptyTitle, { color: colors.textSecondary }]}>No Requests Yet</Text>
          <Text style={[styles.emptySubtitle, { color: colors.textMuted }]}>Donors can submit requests for things they'd like the mosque to provide.</Text>
        </View>
      ) : (
        <ScrollView contentContainerStyle={styles.list}>
          {requests.map((r) => (
            <View key={r.id} style={[styles.requestCard, { backgroundColor: colors.cardBg, borderColor: colors.cardBorder }]}>
              <Text style={[styles.requestTitle, { color: colors.textPrimary }]}>{r.title}</Text>
              {r.description && <Text style={[styles.requestDesc, { color: colors.textSecondary }]}>{r.description}</Text>}
              <View style={styles.requestMeta}>
                <Text style={[styles.requestDonor, { color: colors.textMuted }]}>From: {r.donor_name}</Text>
                <Text style={[styles.requestDate, { color: colors.stone400 }]}>{new Date(r.created_at).toLocaleDateString()}</Text>
              </View>
            </View>
          ))}
        </ScrollView>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: Colors.background },
  header: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: Spacing.lg, paddingVertical: Spacing.lg, gap: Spacing.md },
  backBtn: { width: 44, height: 44, justifyContent: 'center', alignItems: 'center' },
  headerTitle: { fontFamily: 'Inter-Bold', fontSize: FontSize.xxl, color: Colors.textPrimary },
  centered: { flex: 1, justifyContent: 'center', alignItems: 'center', paddingHorizontal: Spacing.xxl },
  emptyTitle: { fontFamily: 'Inter-SemiBold', fontSize: FontSize.lg, color: Colors.textSecondary, marginTop: Spacing.lg },
  emptySubtitle: { fontFamily: 'Inter-Regular', fontSize: FontSize.sm, color: Colors.textMuted, textAlign: 'center', marginTop: Spacing.sm, lineHeight: 20 },
  list: { paddingHorizontal: Spacing.lg, paddingBottom: Spacing.huge },
  requestCard: {
    backgroundColor: Colors.cardBg, borderRadius: Radius.lg, padding: Spacing.lg,
    marginBottom: Spacing.sm, borderWidth: 1, borderColor: Colors.cardBorder,
  },
  requestTitle: { fontFamily: 'Inter-SemiBold', fontSize: FontSize.md, color: Colors.textPrimary, marginBottom: Spacing.xs },
  requestDesc: { fontFamily: 'Inter-Regular', fontSize: FontSize.sm, color: Colors.textSecondary, lineHeight: 20, marginBottom: Spacing.md },
  requestMeta: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  requestDonor: { fontFamily: 'Inter-Regular', fontSize: FontSize.xs, color: Colors.textMuted },
  requestDate: { fontFamily: 'Inter-Regular', fontSize: FontSize.xs, color: Colors.stone400 },
});
