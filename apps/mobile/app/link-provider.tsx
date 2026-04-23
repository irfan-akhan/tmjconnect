import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useState } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Button } from '../src/components/Button';
import { useAcceptLinkingCode } from '../src/hooks/useLinking';
import { ApiError } from '../src/lib/api';
import { colors, radius, spacing, typography } from '../src/theme/tokens';

/**
 * "No Provider Linked" / linking-code entry screen. Matches the standalone
 * design screen 24 — icon circle, description, code input, gold CTA, 3-step
 * "How It Works" list at the bottom.
 */
export default function LinkProvider() {
  const router = useRouter();
  const accept = useAcceptLinkingCode();
  const [code, setCode] = useState('');
  const [error, setError] = useState<string | null>(null);

  const onConnect = async () => {
    setError(null);
    if (code.length !== 6) {
      setError('Enter the full 6-character code.');
      return;
    }
    try {
      await accept.mutateAsync(code);
      router.back();
    } catch (err) {
      if (err instanceof ApiError) {
        if (err.status === 404) setError('That code is not valid.');
        else if (err.status === 410 || err.code === 'EXPIRED') setError('This code has expired. Ask for a new one.');
        else if (err.status === 409) setError('You\u2019re already connected to this provider.');
        else setError(err.message);
      } else {
        setError('Could not connect. Check your connection and try again.');
      }
    }
  };

  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.topRow}>
        <Pressable onPress={() => router.back()} hitSlop={10}>
          <Ionicons name="chevron-back" size={24} color={colors.ink.primary} />
        </Pressable>
        <Text style={styles.topTitle}>Connect Provider</Text>
        <View style={{ width: 24 }} />
      </View>

      <View style={styles.content}>
        <View style={styles.iconCircle}>
          <Ionicons name="person-add-outline" size={32} color={colors.navy.standard} />
        </View>
        <Text style={styles.title}>No Provider Linked</Text>
        <Text style={styles.subtitle}>
          You need to connect with a provider before submitting reports. Ask your provider for an
          invite code.
        </Text>

        <View style={styles.card}>
          <Text style={styles.label}>Enter Invite Code</Text>
          <TextInput
            style={styles.input}
            placeholder="Enter 6-digit code"
            placeholderTextColor={colors.ink.tertiary}
            value={code}
            onChangeText={(t) => setCode(t.replace(/[^a-zA-Z0-9]/g, '').toUpperCase().slice(0, 6))}
            autoCapitalize="characters"
            autoCorrect={false}
            maxLength={6}
          />
          {error ? <Text style={styles.error}>{error}</Text> : null}
          <Button
            title="Connect to Provider"
            variant="accent"
            onPress={onConnect}
            loading={accept.isPending}
            disabled={code.length !== 6}
            style={styles.cta}
          />
        </View>

        <Text style={styles.howTitle}>How It Works</Text>
        <Step num={1} text="Ask your provider for a unique invite code." />
        <Step num={2} text="Enter the code above to link your account." />
        <Step num={3} text="Start submitting reports and receiving exercises." />
      </View>
    </SafeAreaView>
  );
}

function Step({ num, text }: { num: number; text: string }) {
  return (
    <View style={styles.step}>
      <View style={styles.stepNum}>
        <Text style={styles.stepNumText}>{num}</Text>
      </View>
      <Text style={styles.stepText}>{text}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.surface.background },
  topRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
  },
  topTitle: { ...typography.bodyStrong, color: colors.ink.primary },
  content: { paddingHorizontal: spacing.xl, paddingTop: spacing.lg },
  iconCircle: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: colors.surface.muted,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.lg,
    alignSelf: 'center',
  },
  title: { ...typography.h1, color: colors.ink.primary, textAlign: 'center', marginBottom: spacing.sm },
  subtitle: { ...typography.body, color: colors.ink.secondary, textAlign: 'center', marginBottom: spacing.xl },
  card: {
    backgroundColor: colors.surface.card,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.surface.border,
    padding: spacing.lg,
    marginBottom: spacing.xl,
  },
  label: { ...typography.label, color: colors.ink.primary, marginBottom: spacing.sm },
  input: {
    height: 52,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.surface.border,
    paddingHorizontal: spacing.md,
    ...typography.body,
    fontWeight: '600',
    letterSpacing: 4,
    color: colors.ink.primary,
    textAlign: 'center',
    backgroundColor: colors.surface.background,
  },
  error: { ...typography.caption, color: colors.danger.strong, marginTop: spacing.sm },
  cta: { marginTop: spacing.md },
  howTitle: { ...typography.h3, color: colors.ink.primary, marginBottom: spacing.md },
  step: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, marginBottom: spacing.md },
  stepNum: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: colors.navy.standard,
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepNumText: { fontSize: 13, fontWeight: '700', color: '#fff' },
  stepText: { ...typography.body, color: colors.ink.primary, flex: 1 },
});
