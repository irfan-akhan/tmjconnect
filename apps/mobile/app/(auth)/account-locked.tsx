import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Button } from '../../src/components/Button';
import { Wordmark } from '../../src/components/Wordmark';
import { colors, radius, spacing, typography } from '../../src/theme/tokens';

/**
 * Rate-limit / account-lock screen. Routed to from sign-in when the API returns
 * 429 / auth.locked after too many failed attempts. `until` is an ISO timestamp;
 * we render a countdown and auto-return to sign-in when it elapses.
 */
export default function AccountLocked() {
  const router = useRouter();
  const { until } = useLocalSearchParams<{ until?: string }>();
  const untilMs = until ? Date.parse(until) : Date.now() + 5 * 60_000;
  const [remaining, setRemaining] = useState(() => Math.max(0, untilMs - Date.now()));

  useEffect(() => {
    const id = setInterval(() => {
      setRemaining(Math.max(0, untilMs - Date.now()));
    }, 1000);
    return () => clearInterval(id);
  }, [untilMs]);

  const locked = remaining > 0;
  const mm = Math.floor(remaining / 60_000);
  const ss = Math.floor((remaining % 60_000) / 1000);

  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.wordmark}><Wordmark /></View>

      <View style={styles.card}>
        <View style={styles.iconCircle}>
          <Ionicons name="lock-closed" size={32} color={colors.danger.strong} />
        </View>
        <Text style={styles.title}>Account Locked</Text>
        <Text style={styles.body}>
          Too many sign-in attempts. For your security, your account is temporarily locked. Please
          wait or reset your password.
        </Text>

        <View style={styles.timer}>
          <Text style={styles.timerValue}>
            {String(mm).padStart(2, '0')}:{String(ss).padStart(2, '0')}
          </Text>
          <Text style={styles.timerLabel}>Time remaining</Text>
        </View>

        <Button
          title={locked ? 'Reset Password' : 'Back to Sign In'}
          onPress={() =>
            locked
              ? router.replace('/(auth)/forgot-password')
              : router.replace('/(auth)/sign-in')
          }
          variant={locked ? 'secondary' : 'primary'}
          style={styles.cta}
        />
        {locked ? (
          <Button
            title="Back to Sign In"
            variant="ghost"
            onPress={() => router.replace('/(auth)/sign-in')}
            style={styles.secondary}
          />
        ) : null}
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.surface.background, paddingHorizontal: spacing.xl },
  wordmark: { marginTop: spacing.lg, marginBottom: spacing.xl, alignItems: 'center' },
  card: {
    backgroundColor: colors.surface.card,
    borderRadius: radius.xl,
    borderWidth: 1,
    borderColor: colors.surface.border,
    padding: spacing.xl,
    alignItems: 'center',
  },
  iconCircle: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: colors.danger.soft,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.lg,
  },
  title: { ...typography.h1, color: colors.ink.primary, marginBottom: spacing.sm },
  body: { ...typography.body, color: colors.ink.secondary, textAlign: 'center', marginBottom: spacing.lg },
  timer: {
    backgroundColor: colors.surface.muted,
    paddingHorizontal: spacing.xl,
    paddingVertical: spacing.lg,
    borderRadius: radius.lg,
    alignItems: 'center',
    marginBottom: spacing.lg,
    alignSelf: 'stretch',
  },
  timerValue: { fontSize: 40, fontWeight: '800', color: colors.ink.primary, fontVariant: ['tabular-nums'] },
  timerLabel: { ...typography.caption, color: colors.ink.secondary, marginTop: spacing.xs },
  cta: { alignSelf: 'stretch' },
  secondary: { alignSelf: 'stretch', marginTop: spacing.sm },
});
