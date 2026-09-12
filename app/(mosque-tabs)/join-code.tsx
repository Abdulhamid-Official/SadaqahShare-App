import React, { useEffect, useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  TextInput,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ArrowLeft, Key, RefreshCw, Copy, Check } from 'lucide-react-native';
import { router } from 'expo-router';
import * as Clipboard from 'expo-clipboard';
import { supabase } from '@/lib/supabase';
import { useAppContext } from '@/lib/context';
import { Colors, Spacing, Radius, FontSize, useTheme } from '@/lib/theme';

function generateCode(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let code = '';
  for (let i = 0; i < 6; i++) {
    code += chars[Math.floor(Math.random() * chars.length)];
  }
  return code;
}

export default function JoinCodeScreen() {
  const { mosqueAccount, isAdmin } = useAppContext();
  const mosqueId = mosqueAccount?.mosque_id;
  const { colors } = useTheme();

  const [joinCode, setJoinCode] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [regenerating, setRegenerating] = useState(false);
  const [copied, setCopied] = useState(false);

  const fetchCode = useCallback(async () => {
    if (isAdmin) {
      setJoinCode('DEMO42');
      setLoading(false);
      return;
    }
    if (!mosqueId) { setLoading(false); return; }
    try {
      const { data, error } = await supabase
        .from('mosques')
        .select('join_code')
        .eq('id', mosqueId)
        .maybeSingle();
      if (error) throw error;

      if (data?.join_code) {
        setJoinCode(data.join_code);
      } else {
        const code = generateCode();
        await supabase.from('mosques').update({ join_code: code }).eq('id', mosqueId);
        setJoinCode(code);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, [mosqueId, isAdmin]);

  useEffect(() => { fetchCode(); }, [fetchCode]);

  const handleRegenerate = async () => {
    if (isAdmin) {
      setJoinCode(generateCode());
      return;
    }
    if (!mosqueId) return;
    setRegenerating(true);
    try {
      const code = generateCode();
      const { error } = await supabase.from('mosques').update({ join_code: code }).eq('id', mosqueId);
      if (error) throw error;
      setJoinCode(code);
    } catch (err) {
      console.error(err);
    } finally {
      setRegenerating(false);
    }
  };

  const handleCopy = async () => {
    if (!joinCode) return;
    await Clipboard.setStringAsync(joinCode);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: colors.background }]} edges={['top']}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <ArrowLeft size={22} color={colors.stone600} />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: colors.textPrimary }]}>Join Code</Text>
      </View>

      {loading ? (
        <View style={styles.centered}><ActivityIndicator size="large" color={Colors.teal} /></View>
      ) : (
        <View style={styles.content}>
          <View style={[styles.codeCard, { backgroundColor: colors.cardBg, borderColor: colors.cardBorder }]}>
            <View style={styles.iconCircle}>
              <Key size={28} color={Colors.white} />
            </View>
            <Text style={[styles.label, { color: colors.textMuted }]}>Your Mosque Join Code</Text>
            <Text style={styles.codeDisplay}>{joinCode}</Text>
            <Text style={[styles.hint, { color: colors.textSecondary }]}>
              Share this code with donors so they can join your mosque and start donating.
            </Text>

            <View style={styles.actions}>
              <TouchableOpacity style={[styles.actionBtn, { borderColor: colors.stone200 }]} onPress={handleCopy} activeOpacity={0.7}>
                {copied ? <Check size={18} color={Colors.teal} /> : <Copy size={18} color={Colors.teal} />}
                <Text style={styles.actionBtnText}>{copied ? 'Copied!' : 'Copy'}</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.actionBtn, { borderColor: colors.stone200 }, regenerating && { opacity: 0.7 }]}
                onPress={handleRegenerate}
                activeOpacity={0.7}
                disabled={regenerating}
              >
                <RefreshCw size={18} color={Colors.amber} />
                <Text style={[styles.actionBtnText, { color: Colors.amber }]}>
                  {regenerating ? 'Generating...' : 'New Code'}
                </Text>
              </TouchableOpacity>
            </View>
          </View>

          <Text style={[styles.warningText, { color: colors.textMuted }]}>
            Generating a new code will not remove existing members. Only new joins will require the updated code.
          </Text>
        </View>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: Colors.background },
  header: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: Spacing.lg, paddingVertical: Spacing.lg, gap: Spacing.md },
  backBtn: { width: 44, height: 44, justifyContent: 'center', alignItems: 'center' },
  headerTitle: { fontFamily: 'Inter-Bold', fontSize: FontSize.xxl, color: Colors.textPrimary },
  centered: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  content: { flex: 1, paddingHorizontal: Spacing.lg },
  codeCard: {
    backgroundColor: Colors.cardBg, borderRadius: Radius.xl, padding: Spacing.xxl,
    alignItems: 'center', borderWidth: 1, borderColor: Colors.cardBorder,
    shadowColor: Colors.black, shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.06, shadowRadius: 16, elevation: 4,
  },
  iconCircle: {
    width: 64, height: 64, borderRadius: 32, backgroundColor: Colors.teal,
    justifyContent: 'center', alignItems: 'center', marginBottom: Spacing.lg,
  },
  label: { fontFamily: 'Inter-SemiBold', fontSize: FontSize.sm, color: Colors.textMuted, marginBottom: Spacing.md },
  codeDisplay: {
    fontFamily: 'Inter-Bold', fontSize: 40, color: Colors.teal,
    letterSpacing: 8, marginBottom: Spacing.lg,
  },
  hint: { fontFamily: 'Inter-Regular', fontSize: FontSize.sm, color: Colors.textSecondary, textAlign: 'center', lineHeight: 20, marginBottom: Spacing.xl },
  actions: { flexDirection: 'row', gap: Spacing.md },
  actionBtn: {
    flexDirection: 'row', alignItems: 'center', gap: Spacing.sm,
    paddingVertical: Spacing.md, paddingHorizontal: Spacing.xl,
    borderRadius: Radius.md, borderWidth: 1.5, borderColor: Colors.stone200, minHeight: 48,
  },
  actionBtnText: { fontFamily: 'Inter-SemiBold', fontSize: FontSize.sm, color: Colors.teal },
  warningText: {
    fontFamily: 'Inter-Regular', fontSize: FontSize.xs, color: Colors.textMuted,
    textAlign: 'center', marginTop: Spacing.xl, lineHeight: 18, paddingHorizontal: Spacing.lg,
  },
});
