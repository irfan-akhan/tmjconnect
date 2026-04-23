import { Ionicons } from '@expo/vector-icons';
import { StyleSheet, Text, View } from 'react-native';
import { colors, radius, spacing, typography } from '../theme/tokens';

const TIPS = [
  'Rest your tongue on the roof of your mouth to naturally relax your jaw muscles.',
  'Apply a warm compress for 15 minutes to ease jaw tension and improve blood flow.',
  'Avoid chewing gum — it overworks the TMJ muscles and can increase pain.',
  'Practice the "N position": lightly touch your tongue behind your upper teeth and let your jaw relax open.',
  'Eat softer foods during flare-ups to reduce stress on your jaw joint.',
  'Sleep on your back if possible — side sleeping can put pressure on the TMJ.',
  'Stress is a top TMJ trigger. Try 5 minutes of deep breathing before bed.',
  'Gentle jaw stretches done consistently are more effective than aggressive ones done rarely.',
  'Stay hydrated — dehydration can contribute to muscle cramping and jaw tension.',
  'Avoid resting your chin on your hand — it pushes the jaw sideways and strains the joint.',
  'If you catch yourself clenching during the day, separate your teeth slightly and breathe.',
  'Massage the masseter muscle (where you feel clenching) in small circles for 30 seconds.',
  'A magnesium supplement (with your doctor\u2019s OK) may help reduce muscle tension and bruxism.',
  'Limit caffeine — it can increase jaw clenching and interfere with sleep quality.',
];

function tipOfTheDay(): string {
  const dayOfYear = Math.floor(
    (Date.now() - new Date(new Date().getFullYear(), 0, 0).getTime()) / 86400000,
  );
  return TIPS[dayOfYear % TIPS.length]!;
}

export function DailyTip() {
  return (
    <View style={styles.card}>
      <View style={styles.header}>
        <Ionicons name="bulb-outline" size={18} color={colors.gold.standard} />
        <Text style={styles.label}>Tip of the Day</Text>
      </View>
      <Text style={styles.tip}>{tipOfTheDay()}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.gold.ghost,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.gold.ghostStrong,
    padding: spacing.lg,
    marginTop: spacing.md,
  },
  header: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs, marginBottom: spacing.sm },
  label: { ...typography.label, color: colors.gold.standard, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.5 },
  tip: { ...typography.body, color: colors.ink.primary },
});
