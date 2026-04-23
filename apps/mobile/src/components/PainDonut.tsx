import { StyleSheet, Text, View } from 'react-native';
import Svg, { Circle, G } from 'react-native-svg';
import { colors, typography, spacing } from '../theme/tokens';

type Segment = { label: string; value: number; color: string };

export function PainDonut({
  data,
  size = 140,
}: {
  data: { date: string; avg_pain: number }[];
  size?: number;
}) {
  if (data.length === 0) return null;

  const buckets: Segment[] = [
    { label: 'Low (0-3)', value: 0, color: colors.success.base },
    { label: 'Mid (4-6)', value: 0, color: colors.warning.base },
    { label: 'High (7-10)', value: 0, color: colors.danger.base },
  ];

  for (const d of data) {
    if (d.avg_pain <= 3) buckets[0]!.value++;
    else if (d.avg_pain <= 6) buckets[1]!.value++;
    else buckets[2]!.value++;
  }

  const total = data.length;
  const cx = size / 2;
  const cy = size / 2;
  const r = size / 2 - 14;
  const strokeWidth = 14;
  const circumference = 2 * Math.PI * r;

  let offset = 0;

  return (
    <View style={styles.wrap}>
      <View style={{ width: size, height: size }}>
        <Svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
          <Circle cx={cx} cy={cy} r={r} stroke={colors.surface.border} strokeWidth={strokeWidth} fill="none" />
          <G rotation={-90} origin={`${cx}, ${cy}`}>
            {buckets.filter((b) => b.value > 0).map((b) => {
              const pct = b.value / total;
              const dashArray = `${circumference * pct} ${circumference * (1 - pct)}`;
              const dashOffset = -offset;
              offset += circumference * pct;
              return (
                <Circle
                  key={b.label}
                  cx={cx} cy={cy} r={r}
                  stroke={b.color}
                  strokeWidth={strokeWidth}
                  strokeDasharray={dashArray}
                  strokeDashoffset={dashOffset}
                  strokeLinecap="round"
                  fill="none"
                />
              );
            })}
          </G>
        </Svg>
        <View style={[styles.centerLabel, { width: size, height: size }]}>
          <Text style={styles.centerValue}>{total}</Text>
          <Text style={styles.centerSub}>days</Text>
        </View>
      </View>

      <View style={styles.legend}>
        {buckets.map((b) => (
          <View key={b.label} style={styles.legendRow}>
            <View style={[styles.legendDot, { backgroundColor: b.color }]} />
            <Text style={styles.legendLabel}>{b.label}</Text>
            <Text style={styles.legendValue}>{b.value} ({total > 0 ? Math.round((b.value / total) * 100) : 0}%)</Text>
          </View>
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { flexDirection: 'row', alignItems: 'center', gap: spacing.lg },
  centerLabel: { position: 'absolute', alignItems: 'center', justifyContent: 'center' },
  centerValue: { fontSize: 28, fontWeight: '800', color: colors.ink.primary },
  centerSub: { ...typography.tiny, color: colors.ink.tertiary },
  legend: { flex: 1, gap: 8 },
  legendRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  legendDot: { width: 10, height: 10, borderRadius: 5 },
  legendLabel: { ...typography.caption, color: colors.ink.secondary, flex: 1 },
  legendValue: { ...typography.caption, color: colors.ink.primary, fontWeight: '600' },
});
