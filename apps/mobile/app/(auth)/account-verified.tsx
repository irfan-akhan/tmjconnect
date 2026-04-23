import { useRouter } from 'expo-router';
import { StyleSheet, Text, View } from 'react-native';
import { Button } from '../../src/components/Button';
import { Screen } from '../../src/components/Screen';
import { colors, spacing, typography } from '../../src/theme/tokens';

export default function AccountVerified() {
  const router = useRouter();
  return (
    <Screen>
      <View style={styles.hero}>
        <View style={styles.check}>
          <Text style={styles.checkIcon}>✓</Text>
        </View>
        <Text style={styles.title}>You&rsquo;re all set</Text>
        <Text style={styles.subtitle}>
          Your account is verified. Let&rsquo;s get you started tracking your symptoms and staying on
          top of your exercises.
        </Text>
      </View>
      <Button title="Continue" onPress={() => router.replace('/(tabs)/dashboard')} />
    </Screen>
  );
}

const styles = StyleSheet.create({
  hero: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: spacing.lg },
  check: {
    width: 88,
    height: 88,
    borderRadius: 44,
    backgroundColor: colors.success.soft,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.xl,
  },
  checkIcon: { fontSize: 44, color: colors.success.strong, fontWeight: '700' },
  title: { ...typography.h1, color: colors.ink.primary, marginBottom: spacing.sm, textAlign: 'center' },
  subtitle: { ...typography.body, color: colors.ink.secondary, textAlign: 'center' },
});
