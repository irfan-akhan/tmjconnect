import { useMemo, useRef, useState } from 'react';
import {
  LayoutChangeEvent,
  PanResponder,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { colors, radius, spacing, typography } from '../theme/tokens';

const MIN = 0;
const MAX = 10;

/**
 * Tap-or-drag pain slider (0–10). Uses React Native's built-in PanResponder
 * instead of gesture-handler so the callbacks run on the JS thread without
 * needing reanimated worklets — earlier gesture-handler + reanimated combo
 * surfaced "tried to synchronously call a non-worklet" errors.
 */
export function PainSlider({ value, onChange }: { value: number; onChange: (n: number) => void }) {
  const [trackWidth, setTrackWidth] = useState(1);
  const widthRef = useRef(1);

  const toValue = (x: number) => {
    const w = widthRef.current || 1;
    const clamped = Math.max(0, Math.min(x, w));
    const step = w / (MAX - MIN);
    return MIN + Math.round(clamped / step);
  };

  const panResponder = useMemo(
    () =>
      PanResponder.create({
        onStartShouldSetPanResponder: () => true,
        onMoveShouldSetPanResponder: () => true,
        onPanResponderGrant: (_e, g) => {
          onChange(toValue(g.x0 - (g.x0 - g.dx)));
          // `g.x0` is absolute page coordinate; we need the x *within* the
          // track. Fall back to capturing via `onLayout` + locationX on the
          // event object instead.
        },
        onPanResponderMove: (e) => {
          onChange(toValue(e.nativeEvent.locationX));
        },
        onPanResponderRelease: (e) => {
          onChange(toValue(e.nativeEvent.locationX));
        },
      }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [],
  );

  const onLayout = (e: LayoutChangeEvent) => {
    const w = e.nativeEvent.layout.width;
    widthRef.current = w;
    setTrackWidth(w);
  };

  const pct = trackWidth > 0 ? ((value - MIN) / (MAX - MIN)) * 100 : 0;
  const tone = toneFor(value);

  return (
    <View>
      <View style={styles.valueRow}>
        <Text style={[styles.value, { color: tone.text }]}>{value}</Text>
        <Text style={styles.scale}>/ {MAX}</Text>
      </View>

      <View style={styles.trackWrap} onLayout={onLayout} {...panResponder.panHandlers}>
        <View style={styles.track} />
        <View style={[styles.fill, { width: `${pct}%`, backgroundColor: tone.fill }]} />
        {Array.from({ length: MAX + 1 }).map((_, i) => (
          <View
            key={i}
            style={[
              styles.notch,
              { left: `${(i / MAX) * 100}%` },
              value === i && { backgroundColor: tone.fill },
            ]}
          />
        ))}
        <View
          style={[styles.thumb, { left: `${pct}%`, borderColor: tone.fill }]}
          pointerEvents="none"
        />
      </View>

      <View style={styles.axis}>
        <Text style={styles.axisText}>No pain</Text>
        <Text style={styles.axisText}>Worst</Text>
      </View>
    </View>
  );
}

function toneFor(n: number): { fill: string; text: string } {
  if (n <= 3) return { fill: colors.success.base, text: colors.success.strong };
  if (n <= 6) return { fill: colors.warning.base, text: colors.warning.strong };
  return { fill: colors.danger.base, text: colors.danger.strong };
}

const styles = StyleSheet.create({
  valueRow: { flexDirection: 'row', alignItems: 'baseline', justifyContent: 'center', marginBottom: spacing.md },
  value: { fontSize: 56, fontWeight: '800' },
  scale: { ...typography.body, color: colors.ink.tertiary, marginLeft: spacing.xs },
  trackWrap: { height: 44, justifyContent: 'center' },
  track: {
    height: 6,
    borderRadius: radius.sm,
    backgroundColor: colors.surface.muted,
  },
  fill: {
    position: 'absolute',
    left: 0,
    height: 6,
    borderRadius: radius.sm,
  },
  notch: {
    position: 'absolute',
    width: 4,
    height: 10,
    marginLeft: -2,
    top: 17,
    borderRadius: 2,
    backgroundColor: colors.surface.border,
  },
  thumb: {
    position: 'absolute',
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: colors.surface.background,
    borderWidth: 3,
    marginLeft: -12,
    top: 10,
    shadowColor: colors.ink.primary,
    shadowOpacity: 0.15,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 2 },
    elevation: 2,
  },
  axis: { flexDirection: 'row', justifyContent: 'space-between', marginTop: spacing.sm },
  axisText: { ...typography.tiny, color: colors.ink.tertiary },
});
