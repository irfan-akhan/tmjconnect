import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { Alert, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Button } from '../src/components/Button';
import { TextField } from '../src/components/TextField';
import { usePatientLinks } from '../src/hooks/usePatient';
import { useSubmitReport } from '../src/hooks/useReports';
import { ApiError } from '../src/lib/api';
import type { ReportUrgency } from '../src/lib/reports.api';
import { colors, radius, spacing, typography } from '../src/theme/tokens';

const URGENCIES: Array<{ value: ReportUrgency; label: string }> = [
  { value: 'routine', label: 'Routine' },
  { value: 'concerning', label: 'Concerning' },
  { value: 'urgent', label: 'Urgent' },
];

export default function SubmitReport() {
  const router = useRouter();
  const submit = useSubmitReport();
  const links = usePatientLinks();

  const [providerId, setProviderId] = useState<string | null>(null);
  const [urgency, setUrgency] = useState<ReportUrgency>('routine');
  const [description, setDescription] = useState('');
  const [error, setError] = useState<string | null>(null);

  // Default to the first linked provider once the list loads.
  useEffect(() => {
    if (!providerId && links.data && links.data.length > 0) {
      setProviderId(links.data[0]!.provider_id);
    }
  }, [links.data, providerId]);

  useEffect(() => {
    if (!links.isPending && (links.data?.length ?? 0) === 0) {
      router.replace('/link-provider');
    }
  }, [links.isPending, links.data, router]);

  const onSubmit = async () => {
    setError(null);
    if (!providerId) {
      setError('Select a provider to send this to.');
      return;
    }
    if (urgency === 'urgent') {
      Alert.alert(
        'Submitting urgent report',
        'Urgent reports are reviewed as soon as possible — but they are not a substitute for emergency care. If this is a medical emergency, call 911 now.',
        [
          { text: 'Call 911 instead', style: 'destructive', onPress: () => router.replace('/emergency') },
          { text: 'Submit anyway', onPress: doSubmit },
        ],
      );
      return;
    }
    await doSubmit();
  };

  const doSubmit = async () => {
    try {
      await submit.mutateAsync({
        provider_id: providerId!,
        urgency,
        description,
      });
      router.back();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not submit. Try again.');
    }
  };

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <View style={styles.topRow}>
        <Pressable onPress={() => router.back()} hitSlop={10}>
          <Ionicons name="close" size={24} color={colors.ink.primary} />
        </Pressable>
        <Text style={styles.topTitle}>Submit Report</Text>
        <View style={{ width: 24 }} />
      </View>

      <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
        <Text style={styles.sectionLabel}>Send to</Text>
        {links.data && links.data.length > 0 ? (
          <View style={styles.providerList}>
            {links.data.map((l) => {
              const selected = providerId === l.provider_id;
              return (
                <Pressable
                  key={l.link_id}
                  onPress={() => setProviderId(l.provider_id)}
                  style={[styles.providerCard, selected && styles.providerCardSelected]}
                >
                  <View style={styles.providerAvatar}>
                    <Text style={styles.providerAvatarText}>
                      {l.first_name.charAt(0)}
                      {l.last_name.charAt(0)}
                    </Text>
                  </View>
                  <Text style={styles.providerName}>
                    Dr. {l.first_name} {l.last_name}
                  </Text>
                  {selected ? <Ionicons name="checkmark-circle" size={20} color={colors.navy.standard} /> : null}
                </Pressable>
              );
            })}
          </View>
        ) : null}

        <Text style={styles.sectionLabel}>Urgency</Text>
        <View style={styles.urgencyRow}>
          {URGENCIES.map((u) => {
            const selected = urgency === u.value;
            const tone = toneFor(u.value);
            return (
              <Pressable
                key={u.value}
                onPress={() => setUrgency(u.value)}
                style={[
                  styles.urgency,
                  { borderColor: selected ? tone.strong : colors.surface.border },
                  selected && { backgroundColor: tone.soft },
                ]}
              >
                <Text style={[styles.urgencyLabel, { color: selected ? tone.strong : colors.ink.secondary }]}>
                  {u.label}
                </Text>
              </Pressable>
            );
          })}
        </View>

        <Text style={styles.sectionLabel}>What&rsquo;s going on?</Text>
        <TextField
          value={description}
          onChangeText={setDescription}
          placeholder="Describe what you\u2019re experiencing, when it started, and anything unusual."
          multiline
          numberOfLines={8}
          style={styles.descInput}
          containerStyle={styles.descWrap}
        />

        {error ? <Text style={styles.error}>{error}</Text> : null}
      </ScrollView>

      <View style={styles.footer}>
        <Button
          title="Submit Report"
          onPress={onSubmit}
          loading={submit.isPending}
          disabled={!providerId || description.trim().length === 0}
        />
      </View>
    </SafeAreaView>
  );
}

function toneFor(u: ReportUrgency) {
  if (u === 'urgent') return { soft: colors.danger.soft, strong: colors.danger.strong };
  if (u === 'concerning') return { soft: colors.warning.soft, strong: colors.warning.strong };
  return { soft: colors.success.soft, strong: colors.success.strong };
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.surface.background },
  topRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.surface.border,
  },
  topTitle: { ...typography.bodyStrong, color: colors.ink.primary },
  scroll: { padding: spacing.lg, paddingBottom: spacing.xxl },
  sectionLabel: { ...typography.label, color: colors.ink.primary, marginBottom: spacing.sm, marginTop: spacing.md },
  providerList: { gap: spacing.sm, marginBottom: spacing.md },
  providerCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    padding: spacing.md,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.surface.border,
    backgroundColor: colors.surface.background,
  },
  providerCardSelected: { borderColor: colors.navy.standard, backgroundColor: colors.navy.ghost },
  providerAvatar: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: colors.navy.standard,
    alignItems: 'center',
    justifyContent: 'center',
  },
  providerAvatarText: { color: '#fff', fontWeight: '700' },
  providerName: { ...typography.bodyStrong, color: colors.ink.primary, flex: 1 },
  urgencyRow: { flexDirection: 'row', gap: spacing.sm, marginBottom: spacing.md },
  urgency: {
    flex: 1,
    paddingVertical: spacing.md,
    borderRadius: radius.md,
    borderWidth: 1,
    alignItems: 'center',
    backgroundColor: colors.surface.background,
  },
  urgencyLabel: { ...typography.bodyStrong },
  descWrap: { marginBottom: spacing.md },
  descInput: { minHeight: 140, textAlignVertical: 'top' },
  error: { ...typography.caption, color: colors.danger.strong, marginTop: spacing.sm },
  footer: { padding: spacing.lg, borderTopWidth: 1, borderTopColor: colors.surface.border, backgroundColor: colors.surface.background },
});
