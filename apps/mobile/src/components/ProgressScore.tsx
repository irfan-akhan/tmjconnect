import { Ionicons } from '@expo/vector-icons';
import { StyleSheet, Text, View } from 'react-native';
import Svg, { Circle } from 'react-native-svg';
import { colors, radius, spacing, typography } from '../theme/tokens';

export function ProgressScore({
  avgPain,
  trend,
  exerciseRate,
  totalLogs,
}: {
  avgPain: number;
  trend: number;
  exerciseRate: number | null;
  totalLogs: number;
}) {
  const painScore = Math.max(0, 100 - avgPain * 10);
  const trendBonus = trend < 0 ? Math.min(15, Math.abs(trend) * 5) : trend > 0 ? -Math.min(15, trend * 5) : 0;
  const exerciseBonus = exerciseRate != null ? (exerciseRate > 50 ? 10 : exerciseRate > 0 ? 5 : 0) : 0;
  const consistencyBonus = totalLogs >= 20 ? 10 : totalLogs >= 7 ? 5 : 0;

  const score = Math.max(0, Math.min(100, Math.round(painScore + trendBonus + exerciseBonus + consistencyBonus)));
  const grade = score >= 80 ? 'Excellent' : score >= 60 ? 'Good' : score >= 40 ? 'Fair' : 'Needs work';
  const gradeColor = score >= 80 ? colors.success.base : score >= 60 ? colors.gold.standard : score >= 40 ? colors.warning.base : colors.danger.base;

  const size = 100;
  const strokeWidth = 8;
  const r = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * r;
  const progress = (score / 100) * circumference;

  return (
    <View style={styles.card}>
      <View style={styles.row}>
        <View style={{ width: size, height: size }}>
          <Svg width={size} height={size}>
            <Circle cx={size / 2} cy={size / 2} r={r} stroke={colors.surface.border} strokeWidth={strokeWidth} fill="none" />
            <Circle
              cx={size / 2} cy={size / 2} r={r}
              stroke={gradeColor}
              strokeWidth={strokeWidth}
              strokeDasharray={`${progress} ${circumference - progress}`}
              strokeDashoffset={circumference * 0.25}
              strokeLinecap="round"
              fill="none"
              rotation={-90}
              origin={`${size / 2}, ${size / 2}`}
            />
          </Svg>
          <View style={[styles.scoreCenter, { width: size, height: size }]}>
            <Text style={[styles.scoreNum, { color: gradeColor }]}>{score}</Text>
          </View>
        </View>

        <View style={styles.details}>
          <Text style={[styles.grade, { color: gradeColor }]}>{grade}</Text>
          <Text style={styles.gradeDesc}>Your health progress score</Text>

          <View style={styles.factors}>
            <Factor icon="analytics" label="Pain level" positive={avgPain <= 4} />
            <Factor icon="trending-down" label="Pain trend" positive={trend <= 0} />
            <Factor icon="fitness" label="Exercise" positive={(exerciseRate ?? 0) > 30} />
            <Factor icon="calendar" label="Consistency" positive={totalLogs >= 7} />
          </View>
        </View>
      </View>
    </View>
  );
}

function Factor({ icon, label, positive }: { icon: keyof typeof Ionicons.glyphMap; label: string; positive: boolean }) {
  return (
    <View style={styles.factor}>
      <Ionicons
        name={positive ? 'checkmark-circle' : 'alert-circle'}
        size={14}
        color={positive ? colors.success.base : colors.warning.base}
      />
      <Text style={styles.factorText}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.surface.card,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.surface.border,
    padding: spacing.lg,
  },
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing.lg },
  scoreCenter: { position: 'absolute', alignItems: 'center', justifyContent: 'center' },
  scoreNum: { fontSize: 32, fontWeight: '800' },
  details: { flex: 1 },
  grade: { fontSize: 20, fontWeight: '800' },
  gradeDesc: { ...typography.caption, color: colors.ink.tertiary, marginTop: 2, marginBottom: spacing.sm },
  factors: { gap: 4 },
  factor: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  factorText: { ...typography.caption, color: colors.ink.secondary },
});
