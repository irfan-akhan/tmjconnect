import { Ionicons } from '@expo/vector-icons';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { colors, radius, spacing, typography } from '../theme/tokens';

type Preset = { label: string; value: number };

// Preset durations picked to match typical TMJ episodes. Each value is the
// midpoint of the range we're labeling — good enough for trend analysis.
const PRESETS: readonly Preset[] = [
  { label: '< 5 min',   value: 3 },
  { label: '5–15 min',  value: 10 },
  { label: '15–30 min', value: 22 },
  { label: '30–60 min', value: 45 },
  { label: '1–2 hrs',   value: 90 },
  { label: '> 2 hrs',   value: 180 },
  { label: 'All day',   value: 480 },
];

export function DurationPicker({
  value,
  onChange,
}: {
  value: number | null;
  onChange: (n: number | null) => void;
}) {
  return (
    <View style={styles.wrap}>
      {PRESETS.map((p) => {
        const on = value === p.value;
        return (
          <Pressable
            key={p.label}
            onPress={() => onChange(on ? null : p.value)}
            style={({ pressed }) => [
              styles.pill,
              on && styles.pillOn,
              pressed && !on && styles.pillPressed,
              pressed && on && styles.pillOnPressed,
            ]}
            accessibilityRole="button"
            accessibilityState={{ selected: on }}
          >
            {on ? (
              <Ionicons name="time" size={14} color="#fff" style={styles.icon} />
            ) : (
              <Ionicons name="time-outline" size={14} color={colors.ink.secondary} style={styles.icon} />
            )}
            <Text style={[styles.label, on && styles.labelOn]}>{p.label}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.md,
    paddingVertical: 10,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: colors.surface.border,
    backgroundColor: colors.surface.card,
    shadowColor: colors.ink.primary,
    shadowOpacity: 0.03,
    shadowRadius: 2,
    shadowOffset: { width: 0, height: 1 },
  },
  pillPressed: { backgroundColor: colors.surface.muted, transform: [{ scale: 0.97 }] },
  pillOn: {
    backgroundColor: colors.navy.standard,
    borderColor: colors.navy.standard,
    shadowOpacity: 0.18,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 3 },
    elevation: 3,
  },
  pillOnPressed: { backgroundColor: colors.navy.dark, transform: [{ scale: 0.97 }] },
  icon: { marginRight: 6 },
  label: { ...typography.label, color: colors.ink.primary },
  labelOn: { color: '#fff', fontWeight: '600' },
});
