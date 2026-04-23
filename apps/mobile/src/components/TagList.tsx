import { Ionicons } from '@expo/vector-icons';
import { StyleSheet, Text, View } from 'react-native';
import { colors, radius, spacing, typography } from '../theme/tokens';

export type Tag = {
  label: string;
  icon?: keyof typeof Ionicons.glyphMap;
};

/**
 * Read-only chip row for rendering already-selected tags (pain types,
 * locations, triggers). Styled as subtle navy-ghost pills so they read as
 * "selected" without the heavy filled look of the input chips.
 */
export function TagList({ tags, empty }: { tags: Tag[]; empty?: string }) {
  if (tags.length === 0) {
    return empty ? <Text style={styles.empty}>{empty}</Text> : null;
  }
  return (
    <View style={styles.wrap}>
      {tags.map((t, i) => (
        <View key={`${t.label}-${i}`} style={styles.pill}>
          {t.icon ? (
            <Ionicons name={t.icon} size={13} color={colors.navy.deep} style={styles.icon} />
          ) : null}
          <Text style={styles.label}>{t.label}</Text>
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs },
  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.md,
    paddingVertical: 8,
    borderRadius: radius.pill,
    backgroundColor: colors.navy.ghost,
    borderWidth: 1,
    borderColor: colors.navy.ghostStrong,
  },
  icon: { marginRight: 5 },
  label: { ...typography.label, color: colors.navy.deep, fontWeight: '600' },
  empty: { ...typography.body, color: colors.ink.tertiary, fontStyle: 'italic' },
});
