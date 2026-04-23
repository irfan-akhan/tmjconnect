import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useQuery } from '@tanstack/react-query';
import { useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Button } from '../src/components/Button';
import { Wordmark } from '../src/components/Wordmark';
import { useAuth } from '../src/context/AuthContext';
import { acceptTos, getTosStatus } from '../src/lib/tos.api';
import { colors, radius, spacing, typography } from '../src/theme/tokens';

/**
 * Shown when GET /auth/tos/current returns accepted=false. User must accept
 * the current ToS version before continuing into the app.
 */
export default function UpdatedTerms() {
  const { completeTos } = useAuth();
  const tos = useQuery({ queryKey: ['auth', 'tos'], queryFn: getTosStatus });
  const [checked, setChecked] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const onAccept = async () => {
    if (!tos.data) return;
    setSubmitting(true);
    setError(null);
    try {
      await acceptTos(tos.data.current_version);
      completeTos();
    } catch {
      setError('Could not accept. Check your connection and try again.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.wordmark}><Wordmark /></View>
      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        <View style={styles.iconCircle}>
          <Ionicons name="document-text-outline" size={30} color={colors.navy.standard} />
        </View>
        <Text style={styles.title}>Updated Terms</Text>
        <Text style={styles.subtitle}>
          We&rsquo;ve updated our Terms of Service. Please review and accept to continue.
        </Text>

        {tos.isPending ? (
          <ActivityIndicator color={colors.navy.standard} style={{ marginVertical: spacing.lg }} />
        ) : (
          <View style={styles.termsCard}>
            <Text style={styles.termsHeader}>
              Version {tos.data?.current_version} · Published{' '}
              {tos.data ? new Date(tos.data.published_at).toLocaleDateString() : '—'}
            </Text>
            <Text style={styles.termsBody}>
              Your continued use of TMJConnect is subject to our updated Terms of Service and Privacy
              Policy. Key changes: clearer descriptions of how your symptom logs and reports are
              shared with your care team, updates to our data-retention policy, and new contact
              options for data requests.
            </Text>
            <Text style={styles.termsLink}>Read full Terms of Service</Text>
            <Text style={styles.termsLink}>Read Privacy Policy</Text>
          </View>
        )}

        <Pressable onPress={() => setChecked((v) => !v)} style={styles.agreeRow} hitSlop={6}>
          <View style={[styles.checkbox, checked && styles.checkboxOn]}>
            {checked ? <Ionicons name="checkmark" size={16} color="#fff" /> : null}
          </View>
          <Text style={styles.agreeText}>
            I have read and agree to the updated Terms of Service and Privacy Policy.
          </Text>
        </Pressable>

        {error ? <Text style={styles.error}>{error}</Text> : null}
      </ScrollView>

      <View style={styles.footer}>
        <Button
          title="Accept & Continue"
          onPress={onAccept}
          disabled={!checked || !tos.data}
          loading={submitting}
        />
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.surface.background },
  wordmark: { marginTop: spacing.lg, marginBottom: spacing.sm, alignItems: 'center' },
  scroll: { padding: spacing.xl, paddingBottom: spacing.lg },
  iconCircle: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: colors.navy.ghost,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.lg,
    alignSelf: 'center',
  },
  title: { ...typography.h1, color: colors.ink.primary, textAlign: 'center', marginBottom: spacing.xs },
  subtitle: { ...typography.body, color: colors.ink.secondary, textAlign: 'center', marginBottom: spacing.lg },
  termsCard: {
    backgroundColor: colors.surface.muted,
    borderRadius: radius.lg,
    padding: spacing.lg,
    marginBottom: spacing.lg,
  },
  termsHeader: { ...typography.caption, color: colors.ink.tertiary, marginBottom: spacing.sm },
  termsBody: { ...typography.body, color: colors.ink.primary, marginBottom: spacing.md },
  termsLink: { ...typography.label, color: colors.navy.standard, marginTop: spacing.sm },
  agreeRow: { flexDirection: 'row', alignItems: 'flex-start', gap: spacing.sm },
  checkbox: {
    width: 22,
    height: 22,
    borderRadius: radius.sm,
    borderWidth: 1.5,
    borderColor: colors.surface.border,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 2,
  },
  checkboxOn: { backgroundColor: colors.navy.standard, borderColor: colors.navy.standard },
  agreeText: { ...typography.body, color: colors.ink.primary, flex: 1 },
  error: { ...typography.caption, color: colors.danger.strong, marginTop: spacing.sm },
  footer: {
    padding: spacing.xl,
    borderTopWidth: 1,
    borderTopColor: colors.surface.border,
    backgroundColor: colors.surface.background,
  },
});
