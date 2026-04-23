import { Ionicons } from '@expo/vector-icons';
import { StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { colors, radius, spacing, typography } from '../theme/tokens';

export function ComingSoon({ title, icon, description }: { title: string; icon: keyof typeof Ionicons.glyphMap; description: string }) {
  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <View style={styles.body}>
        <View style={styles.iconWrap}>
          <Ionicons name={icon} size={36} color={colors.navy.standard} />
        </View>
        <Text style={styles.title}>{title}</Text>
        <Text style={styles.description}>{description}</Text>
        <View style={styles.pill}>
          <Text style={styles.pillText}>Coming next</Text>
        </View>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.surface.background },
  body: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: spacing.xl },
  iconWrap: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: colors.navy.ghost,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.lg,
  },
  title: { ...typography.h2, color: colors.ink.primary, marginBottom: spacing.sm },
  description: { ...typography.body, color: colors.ink.secondary, textAlign: 'center', marginBottom: spacing.lg },
  pill: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    borderRadius: radius.pill,
    backgroundColor: colors.navy.ghost,
  },
  pillText: { ...typography.caption, color: colors.navy.deep },
});
