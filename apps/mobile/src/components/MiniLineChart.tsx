import { StyleSheet, Text, View } from 'react-native';
import Svg, { Defs, Line, LinearGradient, Path, Circle, Stop } from 'react-native-svg';
import { colors, typography, spacing } from '../theme/tokens';

type Point = { label: string; value: number };
type XY = { x: number; y: number };

function smoothPath(pts: XY[]): string {
  const t = 0.3;
  let d = `M ${pts[0]!.x} ${pts[0]!.y}`;
  for (let i = 0; i < pts.length - 1; i++) {
    const p0 = pts[Math.max(i - 1, 0)]!;
    const p1 = pts[i]!;
    const p2 = pts[i + 1]!;
    const p3 = pts[Math.min(i + 2, pts.length - 1)]!;
    const cp1x = p1.x + (p2.x - p0.x) * t;
    const cp1y = p1.y + (p2.y - p0.y) * t;
    const cp2x = p2.x - (p3.x - p1.x) * t;
    const cp2y = p2.y - (p3.y - p1.y) * t;
    d += ` C ${cp1x} ${cp1y}, ${cp2x} ${cp2y}, ${p2.x} ${p2.y}`;
  }
  return d;
}

export function MiniLineChart({
  data,
  height = 140,
  color = colors.navy.standard,
  yLabel,
}: {
  data: Point[];
  height?: number;
  color?: string;
  yLabel?: string;
}) {
  if (data.length < 2) {
    return (
      <View style={[styles.empty, { height }]}>
        <Text style={styles.emptyText}>Not enough data yet.</Text>
      </View>
    );
  }

  const W = 100;
  const H = 60;
  const PAD = 6;
  const values = data.map((d) => d.value);
  const min = Math.min(...values);
  const max = Math.max(...values);
  const range = max - min || 1;

  const pts = data.map((d, i) => ({
    x: PAD + ((W - PAD * 2) * i) / (data.length - 1),
    y: PAD + (H - PAD * 2) * (1 - (d.value - min) / range),
  }));

  const lineD = pts.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x} ${p.y}`).join(' ');
  const firstPt = pts[0]!;
  const lastPt = pts[pts.length - 1]!;
  const fillD = `${lineD} L ${lastPt.x} ${H} L ${firstPt.x} ${H} Z`;

  return (
    <View>
      {yLabel ? <Text style={styles.yLabel}>{yLabel}</Text> : null}
      <View style={{ height, aspectRatio: W / H }}>
        <Svg viewBox={`0 0 ${W} ${H}`} width="100%" height="100%">
          <Defs>
            <LinearGradient id="areaFill" x1="0" y1="0" x2="0" y2="1">
              <Stop offset="0" stopColor={color} stopOpacity={0.25} />
              <Stop offset="1" stopColor={color} stopOpacity={0.02} />
            </LinearGradient>
          </Defs>
          {[0, 0.5, 1].map((f) => (
            <Line
              key={f}
              x1={PAD} x2={W - PAD}
              y1={PAD + (H - PAD * 2) * f}
              y2={PAD + (H - PAD * 2) * f}
              stroke={colors.surface.border}
              strokeWidth={0.3}
            />
          ))}
          <Path d={fillD} fill="url(#areaFill)" />
          <Path d={lineD} fill="none" stroke={color} strokeWidth={1.2} strokeLinecap="round" strokeLinejoin="round" />
          {pts.length <= 30 && pts.map((p, i) => (
            <Circle key={i} cx={p.x} cy={p.y} r={1.5} fill={color} />
          ))}
        </Svg>
      </View>
      <View style={styles.xRow}>
        <Text style={styles.xLabel}>{data[0]!.label}</Text>
        <Text style={styles.xLabel}>{data[data.length - 1]!.label}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  empty: { alignItems: 'center', justifyContent: 'center' },
  emptyText: { ...typography.caption, color: colors.ink.tertiary },
  yLabel: { ...typography.tiny, color: colors.ink.tertiary, marginBottom: 2 },
  xRow: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 2 },
  xLabel: { ...typography.tiny, color: colors.ink.tertiary },
});
