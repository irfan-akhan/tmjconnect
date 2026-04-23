import { StyleSheet, Text, View } from 'react-native';
import Svg, { Rect, Text as SvgText } from 'react-native-svg';
import { colors, typography } from '../theme/tokens';

type Bar = { label: string; value: number };

export function MiniBarChart({
  data,
  height = 120,
  color = colors.navy.standard,
}: {
  data: Bar[];
  height?: number;
  color?: string;
}) {
  if (data.length === 0) return null;

  const W = 100;
  const H = 50;
  const PAD = 4;
  const max = Math.max(...data.map((d) => d.value), 1);
  const barW = Math.min(8, (W - PAD * 2) / data.length - 1);
  const gap = (W - PAD * 2 - barW * data.length) / (data.length + 1);

  return (
    <View style={{ height }}>
      <Svg viewBox={`0 0 ${W} ${H}`} width="100%" height="100%">
        {data.map((d, i) => {
          const x = PAD + gap + i * (barW + gap);
          const barH = Math.max(0.5, ((H - PAD * 2 - 8) * d.value) / max);
          const y = H - PAD - barH;
          return (
            <Rect key={i} x={x} y={y} width={barW} height={barH} rx={1.5} fill={color} opacity={0.85} />
          );
        })}
        {data.map((d, i) => {
          const x = PAD + gap + i * (barW + gap) + barW / 2;
          return (
            <SvgText key={`l${i}`} x={x} y={H - 1} textAnchor="middle" fontSize={3.5} fill={colors.ink.tertiary}>
              {d.label}
            </SvgText>
          );
        })}
      </Svg>
    </View>
  );
}
