import { Ionicons } from '@expo/vector-icons';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { colors, radius, spacing, typography } from '../theme/tokens';

export type ChipOption = string | { value: string; label?: string; icon?: keyof typeof Ionicons.glyphMap };

function normalize(o: ChipOption): { value: string; label: string; icon?: keyof typeof Ionicons.glyphMap } {
  return typeof o === 'string' ? { value: o, label: cap(o) } : { value: o.value, label: o.label ?? cap(o.value), icon: o.icon };
}

function cap(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

/**
 * Premium multi-select chip row.
 * Selected  → solid navy fill, white text, subtle lift shadow, tiny gold dot.
 * Unselected → white card, slim ink.tertiary border, dark text.
 * Optional per-option Ionicon on the left gives each tag a clear visual anchor.
 */
export function ChipGroup({
  options,
  selected,
  onToggle,
}: {
  options: ChipOption[];
  selected: string[];
  onToggle: (value: string) => void;
}) {
  return (
    <View style={styles.wrap}>
      {options.map((opt) => {
        const n = normalize(opt);
        const isSelected = selected.includes(n.value);
        return (
          <Pressable
            key={n.value}
            onPress={() => onToggle(n.value)}
            style={({ pressed }) => [
              styles.chip,
              isSelected && styles.chipSelected,
              pressed && !isSelected && styles.chipPressed,
              pressed && isSelected && styles.chipSelectedPressed,
            ]}
            accessibilityRole="button"
            accessibilityLabel={n.label}
            accessibilityState={{ selected: isSelected }}
          >
            {n.icon ? (
              <Ionicons
                name={n.icon}
                size={14}
                color={isSelected ? '#fff' : colors.ink.secondary}
                style={styles.icon}
              />
            ) : null}
            <Text style={[styles.label, isSelected && styles.labelSelected]}>{n.label}</Text>
            {isSelected ? <View style={styles.goldDot} /> : null}
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.md,
    paddingVertical: 10,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: colors.surface.border,
    backgroundColor: colors.surface.card,
    // Subtle resting shadow on iOS / modest elevation on Android for lift.
    shadowColor: colors.ink.primary,
    shadowOpacity: 0.03,
    shadowRadius: 2,
    shadowOffset: { width: 0, height: 1 },
    elevation: 0,
  },
  chipPressed: {
    backgroundColor: colors.surface.muted,
    transform: [{ scale: 0.97 }],
  },
  chipSelected: {
    backgroundColor: colors.navy.standard,
    borderColor: colors.navy.standard,
    shadowOpacity: 0.18,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 3 },
    elevation: 3,
  },
  chipSelectedPressed: {
    backgroundColor: colors.navy.dark,
    transform: [{ scale: 0.97 }],
  },
  icon: { marginRight: 6 },
  label: { ...typography.label, color: colors.ink.primary, letterSpacing: 0.1 },
  labelSelected: { color: '#fff', fontWeight: '600' },
  goldDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: colors.gold.standard,
    marginLeft: 8,
  },
});
