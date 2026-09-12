import React, { useEffect, useState, useCallback, useMemo } from 'react';
import {
  View,
  Text,
  TextInput,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  Image,
  useWindowDimensions,
  Modal,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import {
  Search,
  MapPin,
  Building2,
  ChevronRight,
  X,
  KeyRound,
  Plus,
} from 'lucide-react-native';
import { supabase } from '@/lib/supabase';
import { Mosque } from '@/lib/types';
import { Colors, Spacing, Radius, FontSize, useTheme } from '@/lib/theme';
import { useDeviceSize } from '@/lib/responsive';
import { useAppContext } from '@/lib/context';

interface MosqueWithCount extends Mosque {
  activeNeedsCount: number;
}

export default function MosquesScreen() {
  const deviceSize = useDeviceSize();
  const { width: screenWidth } = useWindowDimensions();
  const { donor, isAdmin } = useAppContext();
  const { colors } = useTheme();

  const [mosques, setMosques] = useState<MosqueWithCount[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [showJoinModal, setShowJoinModal] = useState(false);
  const [joinCode, setJoinCode] = useState('');
  const [joinError, setJoinError] = useState<string | null>(null);
  const [joining, setJoining] = useState(false);

  const numColumns = deviceSize === 'largeTablet' ? 3 : deviceSize === 'tablet' ? 2 : 1;

  const fetchMosques = useCallback(async () => {
    setLoading(true);
    try {
      if (isAdmin) {
        setMosques([{
          id: 'admin-mosque',
          name: 'Demo Mosque (Admin)',
          address: '123 Demo St',
          city: 'Demo City',
          state: 'Demo State',
          phone: null,
          email: null,
          description: 'A demo mosque for admin testing.',
          image_url: null,
          join_code: 'DEMO42',
          created_at: new Date().toISOString(),
          activeNeedsCount: 3,
        }]);
        setLoading(false);
        return;
      }

      if (!donor) { setLoading(false); return; }

      // Get mosques the donor is a member of
      const { data: memberships, error: memErr } = await supabase
        .from('mosque_members')
        .select('mosque_id')
        .eq('donor_id', donor.id);

      if (memErr) throw memErr;

      const mosqueIds = (memberships || []).map((m) => m.mosque_id);

      if (mosqueIds.length === 0) {
        setMosques([]);
        setLoading(false);
        return;
      }

      const { data: mosqueData, error } = await supabase
        .from('mosques')
        .select('*')
        .in('id', mosqueIds)
        .order('name');

      if (error) throw error;
      if (!mosqueData) { setMosques([]); setLoading(false); return; }

      const { data: needsData } = await supabase
        .from('needs')
        .select('mosque_id, quantity_needed, quantity_pledged')
        .in('mosque_id', mosqueIds);

      const needsCounts: Record<string, number> = {};
      if (needsData) {
        needsData.forEach((need) => {
          if (need.quantity_pledged < need.quantity_needed) {
            needsCounts[need.mosque_id] = (needsCounts[need.mosque_id] || 0) + 1;
          }
        });
      }

      const enriched: MosqueWithCount[] = mosqueData.map((m) => ({
        ...m,
        activeNeedsCount: needsCounts[m.id] || 0,
      }));

      setMosques(enriched);
    } catch (err) {
      console.error('Error:', err);
    } finally {
      setLoading(false);
    }
  }, [donor, isAdmin]);

  useEffect(() => { fetchMosques(); }, [fetchMosques]);

  const handleJoin = async () => {
    const code = joinCode.trim().toUpperCase();
    if (!code) { setJoinError('Please enter a join code.'); return; }

    if (isAdmin) {
      const newMosque: MosqueWithCount = {
        id: `admin-mosque-${Date.now()}`,
        name: `Joined Mosque (${code})`,
        address: '456 Joined Ave',
        city: 'Demo City',
        state: 'Demo State',
        phone: null,
        email: null,
        description: 'Joined via code in demo mode.',
        image_url: null,
        join_code: code,
        created_at: new Date().toISOString(),
        activeNeedsCount: 0,
      };
      setMosques((prev) => [...prev, newMosque]);
      setShowJoinModal(false);
      setJoinCode('');
      return;
    }

    if (!donor) { setJoinError('You must be logged in.'); return; }

    setJoining(true);
    setJoinError(null);

    try {
      const { data: mosque, error: findErr } = await supabase
        .from('mosques')
        .select('id, name')
        .eq('join_code', code)
        .maybeSingle();

      if (findErr) throw findErr;
      if (!mosque) { setJoinError('No mosque found with this code.'); setJoining(false); return; }

      // Check if already a member
      const { data: existing } = await supabase
        .from('mosque_members')
        .select('id')
        .eq('donor_id', donor.id)
        .eq('mosque_id', mosque.id)
        .maybeSingle();

      if (existing) { setJoinError('You are already a member of this mosque.'); setJoining(false); return; }

      const { error: insertErr } = await supabase
        .from('mosque_members')
        .insert({ donor_id: donor.id, mosque_id: mosque.id });
      if (insertErr) throw insertErr;

      // Also ensure donor_mosque_tokens row exists
      const { data: existingToken } = await supabase
        .from('donor_mosque_tokens')
        .select('id')
        .eq('donor_id', donor.id)
        .eq('mosque_id', mosque.id)
        .maybeSingle();

      if (!existingToken) {
        await supabase.from('donor_mosque_tokens').insert({ donor_id: donor.id, mosque_id: mosque.id, token_balance: 0 });
      }

      setShowJoinModal(false);
      setJoinCode('');
      fetchMosques();
    } catch (e: any) {
      setJoinError(e.message || 'Something went wrong.');
    } finally {
      setJoining(false);
    }
  };

  const filtered = useMemo(() => {
    if (!searchQuery.trim()) return mosques;
    const sq = searchQuery.trim().toLowerCase();
    return mosques.filter(
      (m) =>
        m.name.toLowerCase().includes(sq) ||
        (m.description && m.description.toLowerCase().includes(sq))
    );
  }, [mosques, searchQuery]);

  const cardWidth = useMemo(() => {
    const padding = Spacing.lg * 2;
    const gaps = (numColumns - 1) * Spacing.md;
    return (screenWidth - padding - gaps) / numColumns;
  }, [screenWidth, numColumns]);

  const renderMosqueCard = (mosque: MosqueWithCount) => (
    <TouchableOpacity
      key={mosque.id}
      style={[styles.mosqueCard, { width: numColumns > 1 ? cardWidth : '100%' as any, backgroundColor: colors.cardBg, borderColor: colors.cardBorder }]}
      activeOpacity={0.8}
      onPress={() => {
        if (isAdmin) return;
        router.push(`/mosque-detail/${mosque.id}` as any);
      }}
    >
      <View style={[styles.imageArea, { backgroundColor: colors.stone100 }]}>
        {mosque.image_url ? (
          <Image source={{ uri: mosque.image_url }} style={styles.mosqueImage} resizeMode="cover" />
        ) : (
          <View style={[styles.imagePlaceholder, { backgroundColor: colors.stone100 }]}><Building2 size={36} color={colors.textMuted} /></View>
        )}
        {mosque.activeNeedsCount > 0 && (
          <View style={styles.needsBadge}>
            <Text style={styles.needsBadgeText}>{mosque.activeNeedsCount} active need{mosque.activeNeedsCount !== 1 ? 's' : ''}</Text>
          </View>
        )}
      </View>
      <View style={styles.cardContent}>
        <Text style={[styles.mosqueName, { color: colors.textPrimary }]} numberOfLines={1}>{mosque.name}</Text>
        <View style={styles.locationRow}>
          <MapPin size={14} color={colors.textMuted} />
          <Text style={[styles.locationText, { color: colors.textMuted }]} numberOfLines={1}>{mosque.city}, {mosque.state}</Text>
        </View>
        {mosque.description ? <Text style={[styles.description, { color: colors.textSecondary }]} numberOfLines={2}>{mosque.description}</Text> : null}
        <TouchableOpacity
          style={styles.viewNeedsButton}
          activeOpacity={0.8}
          onPress={() => {
            if (isAdmin) return;
            router.push(`/mosque-detail/${mosque.id}` as any);
          }}
        >
          <Text style={styles.viewNeedsText}>View Needs</Text>
          <ChevronRight size={16} color={Colors.primary} />
        </TouchableOpacity>
      </View>
    </TouchableOpacity>
  );

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: colors.background }]} edges={['top']}>
      <View style={styles.header}>
        <View style={styles.headerRow}>
          <View style={{ flex: 1 }}>
            <Text style={[styles.headerTitle, { color: colors.textPrimary }]}>My Mosques</Text>
            <Text style={[styles.headerSubtitle, { color: colors.textMuted }]}>Mosques you've joined</Text>
          </View>
          <TouchableOpacity style={styles.joinBtn} onPress={() => setShowJoinModal(true)} activeOpacity={0.7}>
            <Plus size={18} color={Colors.white} />
            <Text style={styles.joinBtnText}>Join</Text>
          </TouchableOpacity>
        </View>
      </View>

      {mosques.length > 1 && (
        <View style={styles.searchContainer}>
          <View style={[styles.searchInputWrapper, { backgroundColor: colors.cardBg, borderColor: colors.cardBorder }]}>
            <Search size={18} color={colors.textMuted} />
            <TextInput
              style={[styles.searchInput, { color: colors.textPrimary }]}
              placeholder="Search your mosques..."
              placeholderTextColor={colors.textMuted}
              value={searchQuery}
              onChangeText={setSearchQuery}
            />
            {searchQuery.length > 0 && (
              <TouchableOpacity onPress={() => setSearchQuery('')}>
                <X size={16} color={colors.textMuted} />
              </TouchableOpacity>
            )}
          </View>
        </View>
      )}

      <ScrollView style={styles.scrollView} contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        {loading ? (
          <View style={styles.loadingContainer}><ActivityIndicator size="large" color={Colors.primary} /></View>
        ) : filtered.length > 0 ? (
          <View style={styles.gridContainer}>{filtered.map(renderMosqueCard)}</View>
        ) : (
          <View style={styles.emptyState}>
            <KeyRound size={48} color={colors.textMuted} />
            <Text style={[styles.emptyTitle, { color: colors.textSecondary }]}>No Mosques Yet</Text>
            <Text style={[styles.emptySubtitle, { color: colors.textMuted }]}>
              Tap "Join" above and enter a mosque's join code to get started.
            </Text>
          </View>
        )}
      </ScrollView>

      {/* Join Modal */}
      <Modal visible={showJoinModal} transparent animationType="fade">
        <KeyboardAvoidingView style={styles.overlay} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
          <TouchableOpacity style={styles.backdrop} activeOpacity={1} onPress={() => { setShowJoinModal(false); setJoinError(null); }} />
          <View style={[styles.joinCard, { backgroundColor: colors.cardBg }]}>
            <TouchableOpacity style={[styles.closeBtn, { backgroundColor: colors.stone100 }]} onPress={() => { setShowJoinModal(false); setJoinError(null); }}>
              <X size={20} color={colors.textSecondary} />
            </TouchableOpacity>
            <View style={styles.joinIconCircle}>
              <KeyRound size={28} color={Colors.white} />
            </View>
            <Text style={[styles.joinTitle, { color: colors.textPrimary }]}>Join a Mosque</Text>
            <Text style={[styles.joinSubtitle, { color: colors.textSecondary }]}>Enter the join code provided by your mosque.</Text>
            <TextInput
              style={[styles.joinInput, { backgroundColor: colors.inputBg, borderColor: colors.inputBorder, color: colors.textPrimary }]}
              value={joinCode}
              onChangeText={(t) => { setJoinCode(t.toUpperCase()); setJoinError(null); }}
              placeholder="Enter code (e.g. ABC123)"
              placeholderTextColor={colors.textMuted}
              autoCapitalize="characters"
              maxLength={10}
            />
            {joinError && <Text style={styles.joinErrorText}>{joinError}</Text>}
            <TouchableOpacity
              style={[styles.joinSubmitBtn, joining && { opacity: 0.7 }]}
              onPress={handleJoin}
              activeOpacity={0.7}
              disabled={joining}
            >
              {joining ? (
                <ActivityIndicator size="small" color={Colors.white} />
              ) : (
                <Text style={styles.joinSubmitText}>Join Mosque</Text>
              )}
            </TouchableOpacity>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: Colors.background },
  header: { paddingHorizontal: Spacing.lg, paddingTop: Spacing.lg, paddingBottom: Spacing.md },
  headerRow: { flexDirection: 'row', alignItems: 'center' },
  headerTitle: { fontFamily: 'Inter-Bold', fontSize: FontSize.xxl, color: Colors.textPrimary },
  headerSubtitle: { fontFamily: 'Inter-Regular', fontSize: FontSize.sm, color: Colors.textMuted, marginTop: Spacing.xs },
  joinBtn: {
    flexDirection: 'row', alignItems: 'center', gap: Spacing.sm,
    backgroundColor: Colors.primary, paddingVertical: Spacing.md, paddingHorizontal: Spacing.lg,
    borderRadius: Radius.md, minHeight: 44,
  },
  joinBtnText: { fontFamily: 'Inter-SemiBold', fontSize: FontSize.sm, color: Colors.white },
  searchContainer: { paddingHorizontal: Spacing.lg, gap: Spacing.sm, marginBottom: Spacing.md },
  searchInputWrapper: {
    flexDirection: 'row', alignItems: 'center', backgroundColor: Colors.cardBg,
    borderRadius: Radius.md, paddingHorizontal: Spacing.md, height: 46,
    borderWidth: 1, borderColor: Colors.stone200, gap: Spacing.sm,
  },
  searchInput: { flex: 1, fontFamily: 'Inter-Regular', fontSize: FontSize.md, color: Colors.textPrimary, height: '100%' },
  scrollView: { flex: 1 },
  scrollContent: { paddingHorizontal: Spacing.lg, paddingBottom: Spacing.huge },
  loadingContainer: { paddingTop: Spacing.huge },
  gridContainer: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.md },
  mosqueCard: {
    backgroundColor: Colors.cardBg, borderRadius: Radius.lg, overflow: 'hidden',
    borderWidth: 1, borderColor: Colors.cardBorder,
    shadowColor: Colors.black, shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.06, shadowRadius: 12, elevation: 3,
  },
  imageArea: { height: 140, backgroundColor: Colors.stone100, justifyContent: 'center', alignItems: 'center' },
  mosqueImage: { width: '100%', height: '100%' },
  imagePlaceholder: { justifyContent: 'center', alignItems: 'center' },
  needsBadge: { position: 'absolute', top: Spacing.sm, right: Spacing.sm, backgroundColor: Colors.primary, paddingHorizontal: Spacing.md, paddingVertical: Spacing.xs, borderRadius: Radius.full },
  needsBadgeText: { fontFamily: 'Inter-SemiBold', fontSize: FontSize.xs, color: Colors.white },
  cardContent: { padding: Spacing.lg },
  mosqueName: { fontFamily: 'Inter-Bold', fontSize: FontSize.md, color: Colors.textPrimary, marginBottom: Spacing.xs },
  locationRow: { flexDirection: 'row', alignItems: 'center', gap: 4, marginBottom: Spacing.sm },
  locationText: { fontFamily: 'Inter-Regular', fontSize: FontSize.sm, color: Colors.textMuted, flex: 1 },
  description: { fontFamily: 'Inter-Regular', fontSize: FontSize.sm, color: Colors.textSecondary, lineHeight: 20, marginBottom: Spacing.md },
  viewNeedsButton: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    borderWidth: 1.5, borderColor: Colors.primary, borderRadius: Radius.md, paddingVertical: Spacing.md, gap: 4, minHeight: 44,
  },
  viewNeedsText: { fontFamily: 'Inter-SemiBold', fontSize: FontSize.sm, color: Colors.primary },
  emptyState: { alignItems: 'center', paddingTop: Spacing.huge, paddingHorizontal: Spacing.xxl },
  emptyTitle: { fontFamily: 'Inter-SemiBold', fontSize: FontSize.lg, color: Colors.textSecondary, marginTop: Spacing.lg },
  emptySubtitle: { fontFamily: 'Inter-Regular', fontSize: FontSize.sm, color: Colors.textMuted, textAlign: 'center', marginTop: Spacing.sm, lineHeight: 20 },
  // Join Modal
  overlay: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  backdrop: { ...StyleSheet.absoluteFill, backgroundColor: 'rgba(0,0,0,0.5)' },
  joinCard: { backgroundColor: Colors.white, borderRadius: Radius.xl, padding: Spacing.xxl, width: '90%', maxWidth: 400, alignItems: 'center' },
  closeBtn: { position: 'absolute', top: Spacing.md, right: Spacing.md, width: 36, height: 36, borderRadius: 18, backgroundColor: Colors.stone100, justifyContent: 'center', alignItems: 'center' },
  joinIconCircle: { width: 64, height: 64, borderRadius: 32, backgroundColor: Colors.primary, justifyContent: 'center', alignItems: 'center', marginBottom: Spacing.lg },
  joinTitle: { fontFamily: 'Inter-Bold', fontSize: FontSize.xl, color: Colors.textPrimary, marginBottom: Spacing.sm },
  joinSubtitle: { fontFamily: 'Inter-Regular', fontSize: FontSize.sm, color: Colors.textSecondary, textAlign: 'center', marginBottom: Spacing.xl, lineHeight: 20 },
  joinInput: {
    width: '100%', height: 56, backgroundColor: Colors.stone50, borderRadius: Radius.md,
    paddingHorizontal: Spacing.lg, fontFamily: 'Inter-Bold', fontSize: FontSize.xl,
    color: Colors.textPrimary, borderWidth: 1, borderColor: Colors.stone200, textAlign: 'center', letterSpacing: 4,
  },
  joinErrorText: { fontFamily: 'Inter-SemiBold', fontSize: FontSize.sm, color: Colors.red, marginTop: Spacing.md, textAlign: 'center' },
  joinSubmitBtn: {
    width: '100%', height: 52, backgroundColor: Colors.primary, borderRadius: Radius.md,
    justifyContent: 'center', alignItems: 'center', marginTop: Spacing.xl,
  },
  joinSubmitText: { fontFamily: 'Inter-Bold', fontSize: FontSize.md, color: Colors.white },
});
