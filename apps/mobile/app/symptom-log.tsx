import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { Alert, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { BodyMap } from '../src/components/BodyMap';
import { Button } from '../src/components/Button';
import { ChipGroup, type ChipOption } from '../src/components/ChipGroup';
import { DurationPicker } from '../src/components/DurationPicker';
import { PainSlider } from '../src/components/PainSlider';
import { TextField } from '../src/components/TextField';
import { useTodaysLog, useUpdateSymptom, useUpsertSymptom } from '../src/hooks/useSymptoms';
import { ApiError } from '../src/lib/api';
import type { BodyArea } from '../src/lib/patient.api';
import { colors, spacing, typography } from '../src/theme/tokens';

const PAIN_TYPES: ChipOption[] = [
  { value: 'sharp', label: 'Sharp', icon: 'flash-outline' },
  { value: 'dull', label: 'Dull', icon: 'ellipse-outline' },
  { value: 'throbbing', label: 'Throbbing', icon: 'pulse-outline' },
  { value: 'shooting', label: 'Shooting', icon: 'arrow-forward-outline' },
  { value: 'burning', label: 'Burning', icon: 'flame-outline' },
  { value: 'aching', label: 'Aching', icon: 'bandage-outline' },
];

const TRIGGERS: ChipOption[] = [
  { value: 'stress', label: 'Stress', icon: 'sparkles-outline' },
  { value: 'chewing', label: 'Chewing', icon: 'restaurant-outline' },
  { value: 'teeth grinding', label: 'Teeth grinding', icon: 'construct-outline' },
  { value: 'jaw clenching', label: 'Jaw clenching', icon: 'lock-closed-outline' },
  { value: 'cold', label: 'Cold', icon: 'snow-outline' },
  { value: 'exercise', label: 'Exercise', icon: 'fitness-outline' },
  { value: 'sleep', label: 'Sleep', icon: 'moon-outline' },
];

export default function SymptomLogScreen() {
  const router = useRouter();
  const today = useTodaysLog();
  const upsert = useUpsertSymptom();
  // If the user already logged today, we PATCH the same row to preserve the id.
  const update = useUpdateSymptom(today.data?.id ?? '');

  const existing = today.data;
  const [painLevel, setPainLevel] = useState<number | null>(null);
  const [painTypes, setPainTypes] = useState<string[]>([]);
  const [triggers, setTriggers] = useState<string[]>([]);
  const [bodyAreas, setBodyAreas] = useState<BodyArea[]>([]);
  const [durationMinutes, setDurationMinutes] = useState<number | null>(null);
  const [notes, setNotes] = useState<string>('');
  const [hydrated, setHydrated] = useState(false);

  // Hydrate once today's log resolves. Guarded so user edits aren't clobbered.
  useEffect(() => {
    if (hydrated) return;
    if (today.isPending) return;
    if (existing) {
      setPainLevel(existing.pain_level);
      setPainTypes(existing.pain_types);
      setTriggers(existing.triggers);
      setBodyAreas(existing.body_areas);
      setDurationMinutes(existing.duration_minutes);
      setNotes(existing.notes);
    }
    setHydrated(true);
  }, [existing, today.isPending, hydrated]);

  const pending = upsert.isPending || update.isPending;

  const toggle = (setter: (fn: (prev: string[]) => string[]) => void) => (value: string) => {
    setter((prev) => (prev.includes(value) ? prev.filter((v) => v !== value) : [...prev, value]));
  };

  const onSave = async () => {
    if (painLevel == null) {
      Alert.alert('Pain level required', 'Pick a number from 0 to 10.');
      return;
    }
    const payload = {
      pain_level: painLevel,
      pain_types: painTypes,
      triggers,
      body_areas: bodyAreas,
      duration_minutes: durationMinutes,
      notes: notes || null,
    };
    try {
      if (existing) {
        await update.mutateAsync(payload);
      } else {
        await upsert.mutateAsync(payload);
      }
      router.back();
    } catch (err) {
      Alert.alert(
        'Could not save',
        err instanceof ApiError ? err.message : 'Check your connection and try again.',
      );
    }
  };

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} hitSlop={10} style={styles.back}>
          <Ionicons name="close" size={24} color={colors.ink.primary} />
        </Pressable>
        <Text style={styles.headerTitle}>{existing ? 'Update today' : 'Log pain'}</Text>
        <View style={styles.back} />
      </View>
      <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
        <Text style={styles.question}>Pain Level</Text>
        <Text style={styles.helper}>Slide or tap anywhere on the track (0 = none, 10 = worst).</Text>
        <View style={styles.block}>
          <PainSlider value={painLevel ?? 0} onChange={setPainLevel} />
        </View>

        <Text style={styles.sectionTitle}>Pain type</Text>
        <Text style={styles.sectionHelper}>Pick any that apply.</Text>
        <View style={styles.block}>
          <ChipGroup options={PAIN_TYPES} selected={painTypes} onToggle={toggle(setPainTypes)} />
        </View>

        <Text style={styles.sectionTitle}>Pain location</Text>
        <Text style={styles.sectionHelper}>Tap the spots on the diagram where you feel pain.</Text>
        <View style={styles.block}>
          <BodyMap value={bodyAreas} onChange={setBodyAreas} />
        </View>

        <Text style={styles.sectionTitle}>Triggers</Text>
        <Text style={styles.sectionHelper}>What do you think brought this on?</Text>
        <View style={styles.block}>
          <ChipGroup options={TRIGGERS} selected={triggers} onToggle={toggle(setTriggers)} />
        </View>

        <Text style={styles.sectionTitle}>How long has it lasted?</Text>
        <View style={styles.block}>
          <DurationPicker value={durationMinutes} onChange={setDurationMinutes} />
        </View>

        <Text style={styles.sectionTitle}>Notes</Text>
        <TextField
          placeholder="Anything else? (optional)"
          value={notes}
          onChangeText={setNotes}
          multiline
          numberOfLines={4}
          style={styles.notes}
        />
      </ScrollView>
      <View style={styles.footer}>
        <Button
          title={existing ? 'Update log' : 'Save log'}
          onPress={onSave}
          loading={pending}
          disabled={painLevel == null}
        />
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.surface.background },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.surface.border,
  },
  headerTitle: { ...typography.bodyStrong, color: colors.ink.primary },
  back: { width: 36, height: 36, alignItems: 'center', justifyContent: 'center' },
  scroll: { padding: spacing.lg, paddingBottom: spacing.xxl },
  question: { ...typography.h2, color: colors.ink.primary, marginBottom: spacing.xs },
  helper: { ...typography.caption, color: colors.ink.secondary, marginBottom: spacing.lg },
  sectionTitle: { ...typography.h3, color: colors.ink.primary, marginTop: spacing.lg, marginBottom: 2 },
  sectionHelper: { ...typography.caption, color: colors.ink.secondary, marginBottom: spacing.sm },
  block: { marginBottom: spacing.md },
  notes: { minHeight: 96, textAlignVertical: 'top' },
  footer: {
    padding: spacing.lg,
    borderTopWidth: 1,
    borderTopColor: colors.surface.border,
    backgroundColor: colors.surface.background,
  },
});
