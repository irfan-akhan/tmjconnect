import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useState } from 'react';
import { Alert, Pressable, ScrollView, StyleSheet, Switch, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Button } from '../src/components/Button';
import { TextField } from '../src/components/TextField';
import { useLogSleep, useSleepCorrelation } from '../src/hooks/useTracking';
import { ApiError } from '../src/lib/api';
import { colors, radius, spacing, typography } from '../src/theme/tokens';

const QUALITY = [
  { value: 1, emoji: '\ud83d\ude2b', label: 'Terrible' },
  { value: 2, emoji: '\ud83d\ude1e', label: 'Poor' },
  { value: 3, emoji: '\ud83d\ude10', label: 'Okay' },
  { value: 4, emoji: '\ud83d\ude42', label: 'Good' },
  { value: 5, emoji: '\ud83d\ude34', label: 'Great' },
];

const HOURS = ['< 5', '5-6', '6-7', '7-8', '8-9', '9+'];
const HOURS_MAP: Record<string, number> = { '< 5': 4, '5-6': 5.5, '6-7': 6.5, '7-8': 7.5, '8-9': 8.5, '9+': 9.5 };

export default function SleepLogScreen() {
  const router = useRouter();
  const log = useLogSleep();
  const corr = useSleepCorrelation(30);
  const [quality, setQuality] = useState<number | null>(null);
  const [hours, setHours] = useState('');
  const [bruxism, setBruxism] = useState(false);
  const [stiffness, setStiffness] = useState<number | null>(null);
  const [notes, setNotes] = useState('');

  const onSave = async () => {
    if (quality == null) { Alert.alert('Rate your sleep quality first.'); return; }
    try {
      await log.mutateAsync({
        quality,
        hours_slept: hours ? HOURS_MAP[hours] : undefined,
        bruxism_aware: bruxism,
        morning_stiffness: stiffness ?? undefined,
        notes: notes || undefined,
      });
      Alert.alert('Logged!', 'Sleep entry saved.');
      router.back();
    } catch (err) {
      Alert.alert('Error', err instanceof ApiError ? err.message : 'Try again.');
    }
  };

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} hitSlop={10}>
          <Ionicons name="chevron-back" size={24} color={colors.ink.primary} />
        </Pressable>
        <Text style={styles.title}>Morning Check-in</Text>
        <View style={{ width: 24 }} />
      </View>

      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <Text style={styles.question}>How did you sleep?</Text>
        <View style={styles.qualityRow}>
          {QUALITY.map((q) => (
            <Pressable
              key={q.value}
              onPress={() => setQuality(q.value)}
              style={[styles.qBtn, quality === q.value && styles.qBtnActive]}
            >
              <Text style={styles.qEmoji}>{q.emoji}</Text>
              <Text style={[styles.qLabel, quality === q.value && styles.qLabelActive]}>{q.label}</Text>
            </Pressable>
          ))}
        </View>

        <Text style={styles.section}>Hours slept</Text>
        <View style={styles.chipRow}>
          {HOURS.map((h) => (
            <Pressable
              key={h}
              onPress={() => setHours(hours === h ? '' : h)}
              style={[styles.chip, hours === h && styles.chipActive]}
            >
              <Text style={[styles.chipText, hours === h && styles.chipTextActive]}>{h}</Text>
            </Pressable>
          ))}
        </View>

        <View style={styles.switchRow}>
          <View style={styles.flex1}>
            <Text style={styles.switchTitle}>Teeth grinding / clenching</Text>
            <Text style={styles.switchSub}>Did you notice grinding or jaw clenching?</Text>
          </View>
          <Switch
            value={bruxism}
            onValueChange={setBruxism}
            trackColor={{ false: colors.surface.border, true: colors.navy.standard }}
            thumbColor="#fff"
          />
        </View>

        <Text style={styles.section}>Morning jaw stiffness (0–10)</Text>
        <View style={styles.chipRow}>
          {[0, 2, 4, 6, 8, 10].map((v) => (
            <Pressable
              key={v}
              onPress={() => setStiffness(stiffness === v ? null : v)}
              style={[styles.chip, stiffness === v && styles.chipActive]}
            >
              <Text style={[styles.chipText, stiffness === v && styles.chipTextActive]}>{v}</Text>
            </Pressable>
          ))}
        </View>

        <TextField placeholder="Notes (optional)" value={notes} onChangeText={setNotes} multiline style={styles.notes} />

        {corr.data && corr.data.length > 0 ? (
          <View style={styles.corrCard}>
            <Text style={styles.corrTitle}>Sleep \u2194 Pain (30 days)</Text>
            {corr.data.map((b) => (
              <View key={b.quality} style={styles.corrRow}>
                <Text style={styles.corrLabel}>{b.quality} sleep</Text>
                <Text style={styles.corrValue}>{b.avg_pain} avg pain ({b.days}d)</Text>
              </View>
            ))}
          </View>
        ) : null}
      </ScrollView>

      <View style={styles.footer}>
        <Button title="Save" onPress={onSave} loading={log.isPending} disabled={quality == null} />
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.surface.background },
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: spacing.lg, paddingVertical: spacing.md,
    borderBottomWidth: 1, borderBottomColor: colors.surface.border,
  },
  title: { ...typography.h2, color: colors.ink.primary },
  content: { padding: spacing.lg, paddingBottom: spacing.xxl },
  question: { ...typography.h3, color: colors.ink.primary, marginBottom: spacing.md },
  qualityRow: { flexDirection: 'row', gap: spacing.sm, marginBottom: spacing.lg },
  qBtn: {
    flex: 1, alignItems: 'center', padding: spacing.sm,
    borderRadius: radius.md, borderWidth: 1, borderColor: colors.surface.border,
    backgroundColor: colors.surface.card,
  },
  qBtnActive: { backgroundColor: colors.navy.standard, borderColor: colors.navy.standard },
  qEmoji: { fontSize: 22 },
  qLabel: { ...typography.tiny, color: colors.ink.secondary, marginTop: 2 },
  qLabelActive: { color: '#fff' },
  section: { ...typography.bodyStrong, color: colors.ink.primary, marginTop: spacing.lg, marginBottom: spacing.sm },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  chip: {
    paddingHorizontal: spacing.md, paddingVertical: spacing.sm,
    borderRadius: radius.pill, borderWidth: 1, borderColor: colors.surface.border,
    backgroundColor: colors.surface.card,
  },
  chipActive: { backgroundColor: colors.navy.standard, borderColor: colors.navy.standard },
  chipText: { ...typography.label, color: colors.ink.secondary },
  chipTextActive: { color: '#fff' },
  switchRow: {
    flexDirection: 'row', alignItems: 'center', gap: spacing.md,
    marginTop: spacing.lg, padding: spacing.md,
    borderRadius: radius.md, backgroundColor: colors.surface.card,
    borderWidth: 1, borderColor: colors.surface.border,
  },
  switchTitle: { ...typography.bodyStrong, color: colors.ink.primary },
  switchSub: { ...typography.caption, color: colors.ink.secondary, marginTop: 2 },
  flex1: { flex: 1 },
  notes: { marginTop: spacing.lg, minHeight: 80, textAlignVertical: 'top' },
  corrCard: {
    marginTop: spacing.lg, padding: spacing.lg,
    backgroundColor: colors.surface.card, borderRadius: radius.lg,
    borderWidth: 1, borderColor: colors.surface.border,
  },
  corrTitle: { ...typography.bodyStrong, color: colors.ink.primary, marginBottom: spacing.sm },
  corrRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: spacing.xs },
  corrLabel: { ...typography.body, color: colors.ink.primary },
  corrValue: { ...typography.caption, color: colors.ink.secondary },
  footer: { padding: spacing.lg, borderTopWidth: 1, borderTopColor: colors.surface.border },
});
