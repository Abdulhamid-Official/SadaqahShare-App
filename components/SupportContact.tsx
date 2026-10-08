import { TouchableOpacity, Text, StyleSheet, Linking, Platform, View } from 'react-native';
import { Mail, Bug } from 'lucide-react-native';
import { Colors, Spacing, Radius, FontSize, useTheme } from '@/lib/theme';

const SUPPORT_EMAIL = 'SadaqahShare@protonmail.com';

interface SupportContactProps {
  variant?: 'footer' | 'card' | 'inline';
  showReportBug?: boolean;
}

export function SupportContact({ variant = 'footer', showReportBug = false }: SupportContactProps) {
  const { colors } = useTheme();

  const handleEmail = (subject: string) => {
    const url = `mailto:${SUPPORT_EMAIL}?subject=${encodeURIComponent(subject)}`;
    Linking.openURL(url).catch(() => {
      if (Platform.OS === 'web') {
        window.location.href = url;
      }
    });
  };

  if (variant === 'card') {
    return (
      <View style={styles.cardContainer}>
        <TouchableOpacity
          style={[styles.cardBtn, { backgroundColor: colors.cardBg, borderColor: colors.cardBorder }]}
          activeOpacity={0.7}
          onPress={() => handleEmail('SadaqahShare Support Request')}
        >
          <Mail size={18} color={colors.textMuted} />
          <View style={styles.cardTextWrap}>
            <Text style={[styles.cardLabel, { color: colors.textPrimary }]}>Contact Support</Text>
            <Text style={[styles.cardEmail, { color: colors.textMuted }]}>{SUPPORT_EMAIL}</Text>
          </View>
        </TouchableOpacity>
        {showReportBug && (
          <TouchableOpacity
            style={[styles.cardBtn, { backgroundColor: colors.cardBg, borderColor: colors.cardBorder }]}
            activeOpacity={0.7}
            onPress={() => handleEmail('SadaqahShare Bug Report')}
          >
            <Bug size={18} color={colors.textMuted} />
            <Text style={[styles.cardLabel, { color: colors.textPrimary }]}>Report a Problem</Text>
          </TouchableOpacity>
        )}
      </View>
    );
  }

  if (variant === 'inline') {
    return (
      <TouchableOpacity
        style={styles.inlineRow}
        activeOpacity={0.7}
        onPress={() => handleEmail('SadaqahShare Support Request')}
      >
        <Mail size={14} color={colors.textMuted} />
        <Text style={[styles.inlineText, { color: colors.textMuted }]}>{SUPPORT_EMAIL}</Text>
      </TouchableOpacity>
    );
  }

  // footer variant
  return (
    <View style={styles.footerContainer}>
      <TouchableOpacity
        activeOpacity={0.7}
        onPress={() => handleEmail('SadaqahShare Support Request')}
      >
        <Text style={[styles.footerText, { color: colors.textMuted }]}>
          Contact Support: {SUPPORT_EMAIL}
        </Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  cardContainer: { gap: Spacing.sm, marginBottom: Spacing.xxl },
  cardBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: Radius.lg,
    padding: Spacing.lg,
    borderWidth: 1,
    minHeight: 56,
    gap: Spacing.md,
  },
  cardTextWrap: { flex: 1 },
  cardLabel: { fontFamily: 'Inter-SemiBold', fontSize: FontSize.md },
  cardEmail: { fontFamily: 'Inter-Regular', fontSize: FontSize.sm, marginTop: 2 },
  inlineRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: Spacing.xs,
  },
  inlineText: { fontFamily: 'Inter-Regular', fontSize: FontSize.sm },
  footerContainer: { alignItems: 'center', paddingTop: Spacing.md },
  footerText: { fontFamily: 'Inter-Regular', fontSize: FontSize.xs, lineHeight: 18 },
});
