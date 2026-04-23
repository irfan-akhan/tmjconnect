import { StyleSheet, Text, View } from 'react-native';
import { colors, radius, spacing, typography } from '../theme/tokens';

type Strength = { score: 0 | 1 | 2 | 3 | 4; label: string; tone: 'weak' | 'medium' | 'strong' };

export function scorePassword(pw: string): Strength {
  let score = 0;
  if (pw.length >= 8) score++;
  if (/\d/.test(pw)) score++;
  if (/[!@#$%^&*]/.test(pw)) score++;
  if (pw.length >= 12 && /[A-Z]/.test(pw) && /[a-z]/.test(pw)) score++;
  const s = Math.min(score, 4) as Strength['score'];
  if (s <= 1) return { score: s, label: 'Weak', tone: 'weak' };
  if (s <= 2) return { score: s, label: 'Okay', tone: 'medium' };
  if (s <= 3) return { score: s, label: 'Good', tone: 'medium' };
  return { score: s, label: 'Strong', tone: 'strong' };
}

export function PasswordStrength({ value }: { value: string }) {
  if (!value) return null;
  const s = scorePassword(value);
  const fillColor =
    s.tone === 'weak' ? colors.danger.base : s.tone === 'medium' ? colors.warning.base : colors.success.base;
  return (
    <View style={styles.wrap}>
      <View style={styles.track}>
        {[0, 1, 2, 3].map((i) => (
          <View
            key={i}
            style={[styles.seg, i < s.score && { backgroundColor: fillColor }]}
          />
        ))}
      </View>
      <Text style={[styles.label, { color: fillColor }]}>{s.label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, marginTop: -spacing.sm, marginBottom: spacing.lg },
  track: { flex: 1, flexDirection: 'row', gap: 4 },
  seg: {
    flex: 1,
    height: 4,
    borderRadius: radius.sm,
    backgroundColor: colors.surface.border,
  },
  label: { ...typography.tiny, minWidth: 52, textAlign: 'right' },
});
