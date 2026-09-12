import { StyleSheet, Text, View, ScrollView, TouchableOpacity, Platform } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Search, Heart, Coins, Vote, Truck, Star, ChevronLeft, ArrowRight } from 'lucide-react-native';
import { Colors, Spacing, Radius, FontSize, useTheme } from '@/lib/theme';
import { useContentWidth } from '@/lib/responsive';

const STEPS = [
  {
    number: 1,
    icon: Search,
    title: 'Browse Mosques',
    description:
      'Explore verified mosques in your area or across the country. See their specific needs, from prayer rugs to HVAC systems.',
    color: Colors.primary,
    bgColor: Colors.primaryFaint,
  },
  {
    number: 2,
    icon: Heart,
    title: 'Pledge a Donation',
    description:
      'Choose an item or monetary need and pledge your support. You can ship items directly or drop them off in person.',
    color: '#dc2626',
    bgColor: '#fee2e2',
  },
  {
    number: 3,
    icon: Coins,
    title: 'Earn Tokens',
    description:
      'Once your pledge is fulfilled, you earn tokens tied to that mosque. Tokens represent your investment in the community.',
    color: Colors.amber,
    bgColor: Colors.amberFaint,
  },
  {
    number: 4,
    icon: Vote,
    title: 'Vote on Decisions',
    description:
      'Use your tokens to vote on mosque polls — how funds are spent, what projects to prioritize, and community decisions.',
    color: Colors.blue,
    bgColor: Colors.blueFaint,
  },
  {
    number: 5,
    icon: Truck,
    title: 'Ship or Drop Off',
    description:
      'Ship items using the purchase link provided by the mosque, or arrange a convenient drop-off time.',
    color: Colors.teal,
    bgColor: '#ccfbf1',
  },
  {
    number: 6,
    icon: Star,
    title: 'Earn Continuous Rewards',
    description:
      'Every contribution becomes Sadaqah Jariyah — ongoing charity. As the mosque benefits, your rewards continue insha\'Allah.',
    color: Colors.primary,
    bgColor: Colors.primaryFaint,
  },
];

export default function AboutPage() {
  const router = useRouter();
  const { paddingHorizontal, maxWidth } = useContentWidth();
  const { colors } = useTheme();

  return (
    <SafeAreaView style={[styles.safeArea, { backgroundColor: colors.background }]}>
      {/* ── Header ── */}
      <View style={[styles.header, { paddingHorizontal }]}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton} activeOpacity={0.7}>
          <ChevronLeft size={24} color={colors.textPrimary} />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: colors.textPrimary }]}>How It Works</Text>
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
        {/* ── Intro ── */}
        <View style={styles.intro}>
          <Text style={[styles.introTitle, { color: colors.textPrimary }]}>The SadaqahShare Loop</Text>
          <Text style={[styles.introSubtitle, { color: colors.textSecondary }]}>
            Six simple steps that turn a single donation into ongoing charity, community engagement, and
            continuous rewards.
          </Text>
        </View>

        {/* ── Steps ── */}
        <View style={styles.stepsContainer}>
          {STEPS.map((step, idx) => {
            const Icon = step.icon;
            const isLast = idx === STEPS.length - 1;

            return (
              <View key={step.number} style={styles.stepRow}>
                {/* Timeline Spine */}
                <View style={styles.timelineCol}>
                  <View style={[styles.stepNumberCircle, { backgroundColor: step.bgColor }]}>
                    <Text style={[styles.stepNumber, { color: step.color }]}>{step.number}</Text>
                  </View>
                  {!isLast && <View style={styles.timelineLine} />}
                </View>

                {/* Card */}
                <View style={[styles.stepCard, { backgroundColor: colors.cardBg, borderColor: colors.cardBorder }]}>
                  <View style={[styles.stepIconWrap, { backgroundColor: step.bgColor }]}>
                    <Icon size={22} color={step.color} />
                  </View>
                  <Text style={[styles.stepTitle, { color: colors.textPrimary }]}>{step.title}</Text>
                  <Text style={[styles.stepDesc, { color: colors.textSecondary }]}>{step.description}</Text>
                </View>
              </View>
            );
          })}
        </View>

        {/* ── Bottom CTA ── */}
        <View style={styles.bottomCta}>
          <Text style={styles.bottomCtaTitle}>Start Your Journey Today</Text>
          <Text style={styles.bottomCtaSubtitle}>
            Whether you're a donor looking to give or a mosque seeking support, SadaqahShare connects you to
            make a lasting impact.
          </Text>
          <TouchableOpacity
            style={styles.bottomCtaButton}
            onPress={() => router.push('/role-select')}
            activeOpacity={0.85}
          >
            <Text style={styles.bottomCtaButtonText}>Get Started</Text>
            <ArrowRight size={18} color={Colors.primary} />
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

  /* ── Intro ── */
  intro: {
    alignItems: 'center',
    paddingTop: Spacing.xl,
    paddingBottom: Spacing.xxxl,
  },
  introTitle: {
    fontFamily: 'Inter-Bold',
    fontSize: FontSize.xxxl,
    color: Colors.textPrimary,
    textAlign: 'center',
    marginBottom: Spacing.md,
  },
  introSubtitle: {
    fontFamily: 'Inter-Regular',
    fontSize: FontSize.md,
    color: Colors.textSecondary,
    textAlign: 'center',
    lineHeight: 24,
    maxWidth: 440,
  },

  /* ── Steps / Timeline ── */
  stepsContainer: {
    gap: 0,
  },
  stepRow: {
    flexDirection: 'row',
    gap: Spacing.lg,
  },

  /* Timeline Column */
  timelineCol: {
    alignItems: 'center',
    width: 44,
  },
  stepNumberCircle: {
    width: 36,
    height: 36,
    borderRadius: Radius.full,
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepNumber: {
    fontFamily: 'Inter-Bold',
    fontSize: FontSize.md,
  },
  timelineLine: {
    flex: 1,
    width: 2,
    backgroundColor: Colors.stone200,
    marginVertical: Spacing.xs,
  },

  /* Step Card */
  stepCard: {
    flex: 1,
    backgroundColor: Colors.cardBg,
    borderRadius: Radius.lg,
    padding: Spacing.xl,
    marginBottom: Spacing.lg,
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
  stepIconWrap: {
    width: 44,
    height: 44,
    borderRadius: Radius.md,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: Spacing.md,
  },
  stepTitle: {
    fontFamily: 'Inter-SemiBold',
    fontSize: FontSize.lg,
    color: Colors.textPrimary,
    marginBottom: Spacing.sm,
  },
  stepDesc: {
    fontFamily: 'Inter-Regular',
    fontSize: FontSize.md,
    color: Colors.textSecondary,
    lineHeight: 22,
  },

  /* ── Bottom CTA ── */
  bottomCta: {
    marginTop: Spacing.xxl,
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
    maxWidth: 400,
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
});
