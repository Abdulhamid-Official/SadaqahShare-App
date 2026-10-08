import { StyleSheet, Text, View, ScrollView, TouchableOpacity, Platform, Linking } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import Animated from 'react-native-reanimated';
import { Heart, Vote, Gift, Eye, BookOpen, Droplets, GraduationCap, ArrowRight, Sparkles } from 'lucide-react-native';
import { Colors, Spacing, Radius, FontSize, useTheme } from '@/lib/theme';
import { useContentWidth } from '@/lib/responsive';
import { useFadeInUp, useScaleIn } from '@/hooks/useEntranceAnimation';

const HOW_IT_HELPS = [
  {
    icon: Heart,
    title: 'Direct Impact',
    description: 'Your donations go directly to mosques in need — no middlemen, no overhead fees.',
  },
  {
    icon: Vote,
    title: 'Community Voting',
    description: 'Earn tokens and vote on how your mosque allocates its resources.',
  },
  {
    icon: Gift,
    title: 'Continuous Rewards',
    description: 'Every contribution becomes Sadaqah Jariyah — ongoing charity that earns rewards beyond this life.',
  },
  {
    icon: Eye,
    title: 'Full Transparency',
    description: 'Track every pledge, see real-time progress, and know exactly where your donations go.',
  },
];

const JARIYAH_TYPES = [
  {
    icon: BookOpen,
    title: 'Building Mosques',
    description:
      'The Prophet ﷺ said: "Whoever builds a mosque for Allah, Allah will build for him a house in Paradise." (Bukhari & Muslim)',
    color: Colors.primary,
    bgColor: Colors.primaryFaint,
  },
  {
    icon: Droplets,
    title: 'Providing Water',
    description:
      'Sa\'d ibn \'Ubadah asked: "Which charity is best?" The Prophet ﷺ replied: "Providing water." (Abu Dawud)',
    color: Colors.teal,
    bgColor: '#ccfbf1',
  },
  {
    icon: GraduationCap,
    title: 'Supporting Education',
    description:
      'Knowledge that benefits others continues to earn rewards for the giver, long after they are gone.',
    color: Colors.amber,
    bgColor: Colors.amberFaint,
  },
];

export default function LandingPage() {
  const router = useRouter();
  const { paddingHorizontal, maxWidth } = useContentWidth();
  const { colors } = useTheme();
  const heroStyle = useFadeInUp(0, 30);
  const pillStyle = useScaleIn(100);
  const ctaStyle = useFadeInUp(400, 20);
  const sectionStyle = useFadeInUp(500, 20);
  const bottomCtaStyle = useFadeInUp(800, 20);
  const helpCard0 = useFadeInUp(600, 20);
  const helpCard1 = useFadeInUp(680, 20);
  const helpCard2 = useFadeInUp(760, 20);
  const helpCard3 = useFadeInUp(840, 20);
  const helpCardStyles = [helpCard0, helpCard1, helpCard2, helpCard3];

  return (
    <SafeAreaView style={[styles.safeArea, { backgroundColor: colors.background }]}>
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={[styles.content, { maxWidth: maxWidth ?? undefined }]}
        showsVerticalScrollIndicator={false}
      >
        {/* ===== HERO SECTION ===== */}
        <Animated.View style={[styles.heroSection, { paddingHorizontal }, heroStyle]}>
          <Animated.View style={[styles.pill, pillStyle]}>
            <Sparkles size={14} color={Colors.primary} />
            <Text style={styles.pillText}>Sadaqah Jariyah — Continuous Charity</Text>
          </Animated.View>

          <Text style={[styles.heroTitle, { color: colors.textPrimary }]}>
            Give Once,{'\n'}
            <Text style={styles.heroTitleAccent}>Earn Rewards Forever</Text>
          </Text>

          <Text style={[styles.heroQuote, { color: colors.textSecondary }]}>
            "When a person dies, their deeds come to an end except for three: ongoing charity, beneficial
            knowledge, or a righteous child who prays for them."
          </Text>
          <Text style={[styles.heroQuoteSource, { color: colors.textMuted }]}>— Sahih Muslim 1631</Text>

          <Animated.View style={ctaStyle}>
            <TouchableOpacity
              style={styles.heroCta}
              onPress={() => router.push('/role-select')}
              activeOpacity={0.85}
            >
              <Text style={styles.heroCtaText}>Begin Your Journey</Text>
              <ArrowRight size={20} color={Colors.white} />
            </TouchableOpacity>
          </Animated.View>
        </Animated.View>

        {/* ===== HOW IT HELPS ===== */}
        <Animated.View style={[styles.section, { paddingHorizontal }, sectionStyle]}>
          <Text style={styles.sectionLabel}>WHY SADAQAHSHARE</Text>
          <Text style={[styles.sectionTitle, { color: colors.textPrimary }]}>How SadaqahShare Helps</Text>

          <View style={styles.cardGrid}>
            {HOW_IT_HELPS.map((item, idx) => {
              const Icon = item.icon;
              return (
                <Animated.View 
                  key={idx} 
                  style={[styles.helpCard, { backgroundColor: colors.cardBg, borderColor: colors.cardBorder }, helpCardStyles[idx]]}
                >
                  <View style={styles.helpIconWrap}>
                    <Icon size={24} color={Colors.primary} />
                  </View>
                  <Text style={[styles.helpCardTitle, { color: colors.textPrimary }]}>{item.title}</Text>
                  <Text style={[styles.helpCardDesc, { color: colors.textSecondary }]}>{item.description}</Text>
                </Animated.View>
              );
            })}
          </View>
        </Animated.View>

        {/* ===== WHAT IS SADAQAH JARIYAH ===== */}
        <View style={[styles.section, { paddingHorizontal }]}>
          <Text style={styles.sectionLabel}>LEARN</Text>
          <Text style={[styles.sectionTitle, { color: colors.textPrimary }]}>What is Sadaqah Jariyah?</Text>
          <Text style={[styles.sectionSubtitle, { color: colors.textSecondary }]}>
            Sadaqah Jariyah is a form of ongoing charity whose benefits continue to reach people — and whose
            rewards continue to reach you — long after the initial act.
          </Text>

          {JARIYAH_TYPES.map((item, idx) => {
            const Icon = item.icon;
            return (
              <View key={idx} style={[styles.jariyahCard, { backgroundColor: colors.cardBg, borderColor: colors.cardBorder }]}>
                <View style={[styles.jariyahIconWrap, { backgroundColor: item.bgColor }]}>
                  <Icon size={24} color={item.color} />
                </View>
                <View style={styles.jariyahContent}>
                  <Text style={[styles.jariyahTitle, { color: colors.textPrimary }]}>{item.title}</Text>
                  <Text style={[styles.jariyahDesc, { color: colors.textSecondary }]}>{item.description}</Text>
                </View>
              </View>
            );
          })}
        </View>

        {/* ===== BOTTOM CTA ===== */}
        <Animated.View style={[styles.bottomCta, { marginHorizontal: paddingHorizontal }, bottomCtaStyle]}>
          <Text style={styles.bottomCtaTitle}>Ready to Make an Impact?</Text>
          <Text style={styles.bottomCtaSubtitle}>
            Join a growing community of donors and mosques building a better future together.
          </Text>
          <TouchableOpacity
            style={styles.bottomCtaButton}
            onPress={() => router.push('/role-select')}
            activeOpacity={0.85}
          >
            <Text style={styles.bottomCtaButtonText}>Get Started</Text>
            <ArrowRight size={18} color={Colors.primary} />
          </TouchableOpacity>
        </Animated.View>

        <View style={styles.footer}>
          <TouchableOpacity onPress={() => router.push('/about')} activeOpacity={0.7}>
            <Text style={styles.footerLink}>How It Works</Text>
          </TouchableOpacity>
          <Text style={[styles.footerCopy, { color: colors.textMuted }]}>© {new Date().getFullYear()} SadaqahShare</Text>
          <TouchableOpacity onPress={() => Linking.openURL('mailto:SadaqahShare@protonmail.com').catch(() => {})} activeOpacity={0.7}>
            <Text style={[styles.footerCopy, { color: colors.textMuted }]}>SadaqahShare@protonmail.com</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
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

  /* ── Hero ── */
  heroSection: {
    paddingTop: Spacing.huge,
    paddingBottom: Spacing.xxxl,
    alignItems: 'center',
  },
  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    backgroundColor: Colors.primaryFaint,
    paddingVertical: Spacing.sm,
    paddingHorizontal: Spacing.lg,
    borderRadius: Radius.full,
    marginBottom: Spacing.xxl,
  },
  pillText: {
    fontFamily: 'Inter-SemiBold',
    fontSize: FontSize.sm,
    color: Colors.primaryDark,
  },
  heroTitle: {
    fontFamily: 'Inter-Bold',
    fontSize: FontSize.display,
    lineHeight: 44,
    color: Colors.textPrimary,
    textAlign: 'center',
    marginBottom: Spacing.xxl,
  },
  heroTitleAccent: {
    color: Colors.primary,
  },
  heroQuote: {
    fontFamily: 'Inter-Regular',
    fontSize: FontSize.md,
    lineHeight: 24,
    color: Colors.textSecondary,
    textAlign: 'center',
    fontStyle: 'italic',
    maxWidth: 420,
    marginBottom: Spacing.sm,
  },
  heroQuoteSource: {
    fontFamily: 'Inter-SemiBold',
    fontSize: FontSize.sm,
    color: Colors.textMuted,
    marginBottom: Spacing.xxxl,
  },
  heroCta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    backgroundColor: Colors.primary,
    paddingVertical: Spacing.lg,
    paddingHorizontal: Spacing.xxxl,
    borderRadius: Radius.xl,
    minHeight: 52,
    ...Platform.select({
      ios: {
        shadowColor: Colors.primary,
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.3,
        shadowRadius: 12,
      },
      android: { elevation: 6 },
      web: {
        shadowColor: Colors.primary,
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.3,
        shadowRadius: 12,
      },
    }),
  },
  heroCtaText: {
    fontFamily: 'Inter-SemiBold',
    fontSize: FontSize.lg,
    color: Colors.white,
  },

  /* ── Sections ── */
  section: {
    paddingTop: Spacing.xxxl,
    paddingBottom: Spacing.lg,
  },
  sectionLabel: {
    fontFamily: 'Inter-SemiBold',
    fontSize: FontSize.xs,
    color: Colors.primary,
    letterSpacing: 1.2,
    marginBottom: Spacing.sm,
    textAlign: 'center',
  },
  sectionTitle: {
    fontFamily: 'Inter-Bold',
    fontSize: FontSize.xxl,
    color: Colors.textPrimary,
    textAlign: 'center',
    marginBottom: Spacing.md,
  },
  sectionSubtitle: {
    fontFamily: 'Inter-Regular',
    fontSize: FontSize.md,
    color: Colors.textSecondary,
    textAlign: 'center',
    lineHeight: 24,
    maxWidth: 480,
    alignSelf: 'center',
    marginBottom: Spacing.xxl,
  },

  /* ── Help Cards ── */
  cardGrid: {
    marginTop: Spacing.xl,
    gap: Spacing.lg,
  },
  helpCard: {
    backgroundColor: Colors.cardBg,
    borderRadius: Radius.lg,
    padding: Spacing.xxl,
    borderWidth: 1,
    borderColor: Colors.cardBorder,
    ...Platform.select({
      ios: {
        shadowColor: Colors.black,
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.06,
        shadowRadius: 8,
      },
      android: { elevation: 2 },
      web: {
        shadowColor: Colors.black,
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.06,
        shadowRadius: 8,
      },
    }),
  },
  helpIconWrap: {
    width: 48,
    height: 48,
    borderRadius: Radius.md,
    backgroundColor: Colors.primaryFaint,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: Spacing.md,
  },
  helpCardTitle: {
    fontFamily: 'Inter-SemiBold',
    fontSize: FontSize.lg,
    color: Colors.textPrimary,
    marginBottom: Spacing.sm,
  },
  helpCardDesc: {
    fontFamily: 'Inter-Regular',
    fontSize: FontSize.md,
    color: Colors.textSecondary,
    lineHeight: 22,
  },

  /* ── Jariyah Cards ── */
  jariyahCard: {
    flexDirection: 'row',
    backgroundColor: Colors.cardBg,
    borderRadius: Radius.lg,
    padding: Spacing.xl,
    marginBottom: Spacing.lg,
    borderWidth: 1,
    borderColor: Colors.cardBorder,
    gap: Spacing.lg,
    ...Platform.select({
      ios: {
        shadowColor: Colors.black,
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.06,
        shadowRadius: 8,
      },
      android: { elevation: 2 },
      web: {
        shadowColor: Colors.black,
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.06,
        shadowRadius: 8,
      },
    }),
  },
  jariyahIconWrap: {
    width: 48,
    height: 48,
    borderRadius: Radius.md,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  jariyahContent: {
    flex: 1,
  },
  jariyahTitle: {
    fontFamily: 'Inter-SemiBold',
    fontSize: FontSize.lg,
    color: Colors.textPrimary,
    marginBottom: Spacing.xs,
  },
  jariyahDesc: {
    fontFamily: 'Inter-Regular',
    fontSize: FontSize.sm,
    color: Colors.textSecondary,
    lineHeight: 20,
  },

  /* ── Bottom CTA ── */
  bottomCta: {
    marginTop: Spacing.xxxl,
    backgroundColor: Colors.primary,
    borderRadius: Radius.xl,
    padding: Spacing.xxxl,
    alignItems: 'center',
    ...Platform.select({
      ios: {
        shadowColor: Colors.primary,
        shadowOffset: { width: 0, height: 6 },
        shadowOpacity: 0.25,
        shadowRadius: 16,
      },
      android: { elevation: 8 },
      web: {
        shadowColor: Colors.primary,
        shadowOffset: { width: 0, height: 6 },
        shadowOpacity: 0.25,
        shadowRadius: 16,
      },
    }),
  },
  bottomCtaTitle: {
    fontFamily: 'Inter-Bold',
    fontSize: FontSize.xxl,
    color: Colors.white,
    textAlign: 'center',
    marginBottom: Spacing.md,
  },
  bottomCtaSubtitle: {
    fontFamily: 'Inter-Regular',
    fontSize: FontSize.md,
    color: 'rgba(255,255,255,0.85)',
    textAlign: 'center',
    lineHeight: 22,
    marginBottom: Spacing.xxl,
    maxWidth: 360,
  },
  bottomCtaButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    backgroundColor: Colors.white,
    paddingVertical: Spacing.md,
    paddingHorizontal: Spacing.xxl,
    borderRadius: Radius.xl,
    minHeight: 48,
  },
  bottomCtaButtonText: {
    fontFamily: 'Inter-SemiBold',
    fontSize: FontSize.lg,
    color: Colors.primary,
  },

  /* ── Footer ── */
  footer: {
    alignItems: 'center',
    paddingTop: Spacing.xxxl,
    gap: Spacing.sm,
  },
  footerLink: {
    fontFamily: 'Inter-SemiBold',
    fontSize: FontSize.md,
    color: Colors.primary,
  },
  footerCopy: {
    fontFamily: 'Inter-Regular',
    fontSize: FontSize.xs,
    color: Colors.textMuted,
  },
});
