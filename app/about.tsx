import { StyleSheet, Text, View, ScrollView, TouchableOpacity, Platform } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import {
  ChevronLeft,
  UserPlus,
  Search,
  Package,
  CheckCircle,
  Coins,
  Vote,
  ArrowRight,
} from 'lucide-react-native';
import { Colors, Spacing, Radius, FontSize, useTheme } from '@/lib/theme';
import { useContentWidth } from '@/lib/responsive';

const STEPS = [
  {
    number: 1,
    Icon: UserPlus,
    title: 'Join a Mosque',
    description: 'Browse mosques on SadaqahShare and join one using a join code from your mosque manager.',
    color: Colors.primary,
    bgColor: Colors.primaryFaint,
  },
  {
    number: 2,
    Icon: Search,
    title: 'Find a Need',
    description: 'Explore the items and fundraisers your mosque has requested. Choose something you can give.',
    color: Colors.teal,
    bgColor: '#ccfbf1',
  },
  {
    number: 3,
    Icon: Package,
    title: 'Drop It Off',
    description: 'Pledge the item, then physically drop it off at the mosque. No shipping needed — just bring it.',
    color: Colors.amber,
    bgColor: Colors.amberFaint,
  },
  {
    number: 4,
    Icon: CheckCircle,
    title: 'Mosque Confirms It',
    description: 'The mosque manager confirms they received your donation. This step verifies your contribution.',
    color: Colors.blue,
    bgColor: Colors.blueFaint,
  },
  {
    number: 5,
    Icon: Coins,
    title: 'Earn Tokens',
    description: 'Once confirmed, you receive tokens based on the value of your donation. The more you give, the more you earn.',
    color: Colors.amber,
    bgColor: Colors.amberFaint,
  },
  {
    number: 6,
    Icon: Vote,
    title: 'Use Tokens to Vote',
    description: 'Spend your tokens to vote on community polls and decisions. Your voice shapes what the mosque prioritizes.',
    color: Colors.primary,
    bgColor: Colors.primaryFaint,
  },
];

export default function HowItWorksPage() {
  const router = useRouter();
  const { paddingHorizontal, maxWidth } = useContentWidth();
  const { colors } = useTheme();

  return (
    <SafeAreaView style={[styles.safeArea, { backgroundColor: colors.background }]}>
      {/* Header */}
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
        {/* Intro */}
        <View style={styles.introSection}>
          <Text style={[styles.introTitle, { color: colors.textPrimary }]}>
            The SadaqahShare Loop
          </Text>
          <Text style={[styles.introSubtitle, { color: colors.textSecondary }]}>
            Six simple steps from joining your mosque to shaping community decisions.
            It's a cycle of giving that keeps giving back.
          </Text>
        </View>

        {/* Steps Timeline */}
        <View style={styles.timeline}>
          {STEPS.map((step, index) => {
            const isLast = index === STEPS.length - 1;
            return (
              <View key={step.number} style={styles.stepRow}>
                {/* Timeline connector */}
                {!isLast && (
                  <View style={[styles.timelineLine, { backgroundColor: colors.cardBorder }]} />
                )}

                {/* Step content */}
                <View style={[styles.stepCard, { backgroundColor: colors.cardBg, borderColor: colors.cardBorder }]}>
                  <View style={[styles.stepIconCircle, { backgroundColor: step.bgColor }]}>
                    <step.Icon size={24} color={step.color} />
                  </View>
                  <View style={styles.stepContent}>
                    <View style={styles.stepHeader}>
                      <View style={[styles.stepNumberBadge, { backgroundColor: step.color }]}>
                        <Text style={styles.stepNumberText}>{step.number}</Text>
                      </View>
                      <Text style={[styles.stepTitle, { color: colors.textPrimary }]}>{step.title}</Text>
                    </View>
                    <Text style={[styles.stepDescription, { color: colors.textMuted }]}>
                      {step.description}
                    </Text>
                  </View>
                </View>
              </View>
            );
          })}
        </View>

        {/* Flow diagram */}
        <View style={[styles.flowCard, { backgroundColor: colors.cardBg, borderColor: colors.cardBorder }]}>
          <Text style={[styles.flowTitle, { color: colors.textPrimary }]}>The Cycle Continues</Text>
          <Text style={[styles.flowText, { color: colors.textMuted }]}>
            Every confirmed donation earns tokens. Every token becomes a vote. Every vote shapes your community.
            Keep the loop going — give again, earn again, vote again.
          </Text>
        </View>

        {/* CTA */}
        <TouchableOpacity
          style={[styles.ctaButton, { backgroundColor: Colors.primary }]}
          onPress={() => router.push('/role-select')}
          activeOpacity={0.85}
        >
          <Text style={styles.ctaButtonText}>Get Started</Text>
          <ArrowRight size={18} color={Colors.white} />
        </TouchableOpacity>

        <View style={{ height: Spacing.xxxl }} />
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

  /* Header */
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
  },

  /* Intro */
  introSection: {
    alignItems: 'center',
    marginBottom: Spacing.xxl,
    paddingHorizontal: Spacing.lg,
  },
  introTitle: {
    fontFamily: 'Inter-Bold',
    fontSize: FontSize.xxl,
    marginBottom: Spacing.sm,
    textAlign: 'center',
  },
  introSubtitle: {
    fontFamily: 'Inter-Regular',
    fontSize: FontSize.md,
    textAlign: 'center',
    lineHeight: 22,
    maxWidth: 360,
  },

  /* Timeline */
  timeline: {
    gap: 0,
  },
  stepRow: {
    position: 'relative',
  },
  timelineLine: {
    position: 'absolute',
    left: 36,
    top: 64,
    bottom: 0,
    width: 2,
    zIndex: 0,
  },
  stepCard: {
    flexDirection: 'row',
    borderRadius: Radius.lg,
    padding: Spacing.lg,
    marginBottom: Spacing.md,
    borderWidth: 1,
    ...Platform.select({
      ios: { shadowColor: Colors.black, shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.04, shadowRadius: 8 },
      android: { elevation: 2 },
      web: { shadowColor: Colors.black, shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.04, shadowRadius: 8 },
    }),
  },
  stepIconCircle: {
    width: 52,
    height: 52,
    borderRadius: 26,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: Spacing.md,
    flexShrink: 0,
  },
  stepContent: {
    flex: 1,
  },
  stepHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    marginBottom: Spacing.xs,
  },
  stepNumberBadge: {
    width: 24,
    height: 24,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
  },
  stepNumberText: {
    fontFamily: 'Inter-Bold',
    fontSize: FontSize.xs,
    color: Colors.white,
  },
  stepTitle: {
    fontFamily: 'Inter-SemiBold',
    fontSize: FontSize.lg,
    flex: 1,
  },
  stepDescription: {
    fontFamily: 'Inter-Regular',
    fontSize: FontSize.sm,
    lineHeight: 20,
  },

  /* Flow card */
  flowCard: {
    borderRadius: Radius.lg,
    padding: Spacing.xxl,
    borderWidth: 1,
    alignItems: 'center',
    marginBottom: Spacing.xl,
    marginTop: Spacing.md,
  },
  flowTitle: {
    fontFamily: 'Inter-Bold',
    fontSize: FontSize.lg,
    marginBottom: Spacing.sm,
  },
  flowText: {
    fontFamily: 'Inter-Regular',
    fontSize: FontSize.sm,
    textAlign: 'center',
    lineHeight: 22,
  },

  /* CTA */
  ctaButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.sm,
    paddingVertical: Spacing.lg,
    borderRadius: Radius.lg,
    minHeight: 52,
    ...Platform.select({
      ios: { shadowColor: Colors.black, shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.15, shadowRadius: 6 },
      android: { elevation: 3 },
      web: { shadowColor: Colors.black, shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.15, shadowRadius: 6 },
    }),
  },
  ctaButtonText: {
    fontFamily: 'Inter-SemiBold',
    fontSize: FontSize.lg,
    color: Colors.white,
  },
});
