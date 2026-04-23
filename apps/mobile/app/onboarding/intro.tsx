import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Button } from '../../src/components/Button';
import { colors, radius, spacing, typography } from '../../src/theme/tokens';

type Slide = {
  icon: keyof typeof Ionicons.glyphMap;
  title: string;
  body: string;
};

const SLIDES: Slide[] = [
  {
    icon: 'grid-outline',
    title: 'Your Dashboard',
    body: 'See your progress, today\u2019s exercises, and pain trends at a glance.',
  },
  {
    icon: 'pulse-outline',
    title: 'Track Your Symptoms',
    body: 'Log pain levels, triggers, and types daily. Spot patterns over time.',
  },
  {
    icon: 'fitness-outline',
    title: 'Stay on Your Plan',
    body: 'Complete exercises assigned by your provider with guided videos.',
  },
  {
    icon: 'chatbubble-ellipses-outline',
    title: 'Connected Care',
    body: 'Send reports to your provider and see their responses in one place.',
  },
];

export default function OnboardingIntro() {
  const router = useRouter();
  const [index, setIndex] = useState(0);
  const slide = SLIDES[index]!;
  const isLast = index === SLIDES.length - 1;

  const next = () => {
    if (isLast) router.replace('/onboarding/permissions');
    else setIndex((i) => i + 1);
  };

  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.topRow}>
        <Pressable onPress={() => router.replace('/onboarding/permissions')} hitSlop={8}>
          <Text style={styles.skip}>Skip</Text>
        </Pressable>
      </View>

      <View style={styles.hero}>
        <View style={styles.iconSquare}>
          <Ionicons name={slide.icon} size={44} color="#fff" />
        </View>
        <Text style={styles.title}>{slide.title}</Text>
        <Text style={styles.body}>{slide.body}</Text>
      </View>

      <View style={styles.dots}>
        {SLIDES.map((_, i) => (
          <View key={i} style={[styles.dot, index === i && styles.dotActive]} />
        ))}
      </View>

      <View style={styles.footer}>
        <Button title={isLast ? 'Get Started' : 'Next'} onPress={next} />
        {!isLast ? (
          <Pressable onPress={() => setIndex((i) => Math.max(0, i - 1))} hitSlop={8} style={styles.back}>
            <Text style={[styles.backText, index === 0 && styles.backDisabled]}>Back</Text>
          </Pressable>
        ) : null}
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.surface.background },
  topRow: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    paddingHorizontal: spacing.xl,
    paddingVertical: spacing.md,
  },
  skip: { ...typography.label, color: colors.ink.secondary },
  hero: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.xl,
  },
  iconSquare: {
    width: 120,
    height: 120,
    borderRadius: radius.xl,
    backgroundColor: colors.navy.standard,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.xl,
  },
  title: { ...typography.h1, color: colors.ink.primary, textAlign: 'center', marginBottom: spacing.sm },
  body: { ...typography.body, color: colors.ink.secondary, textAlign: 'center' },
  dots: { flexDirection: 'row', gap: spacing.xs, justifyContent: 'center', marginBottom: spacing.lg },
  dot: { width: 8, height: 8, borderRadius: 4, backgroundColor: colors.surface.border },
  dotActive: { backgroundColor: colors.gold.standard, width: 24 },
  footer: { paddingHorizontal: spacing.xl, paddingBottom: spacing.lg },
  back: { alignSelf: 'center', marginTop: spacing.md },
  backText: { ...typography.label, color: colors.ink.secondary },
  backDisabled: { opacity: 0 },
});
