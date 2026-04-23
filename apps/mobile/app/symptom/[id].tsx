import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { BodyMap } from '../../src/components/BodyMap';
import { Button } from '../../src/components/Button';
import { ChipGroup, type ChipOption } from '../../src/components/ChipGroup';
import { DurationPicker } from '../../src/components/DurationPicker';
import { PainSlider } from '../../src/components/PainSlider';
import { TagList, type Tag } from '../../src/components/TagList';
import { TextField } from '../../src/components/TextField';
import { useDeleteSymptom, useSymptomLog, useUpdateSymptom } from '../../src/hooks/useSymptoms';
import { ApiError } from '../../src/lib/api';
import type { BodyArea } from '../../src/lib/patient.api';
import { colors, radius, spacing, typography } from '../../src/theme/tokens';

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

const TYPE_ICON_BY_VALUE = Object.fromEntries(
  PAIN_TYPES.map((o) => [typeof o === 'string' ? o : o.value, typeof o === 'string' ? undefined : o.icon]),
) as Record<string, keyof typeof Ionicons.glyphMap | undefined>;

const TRIGGER_ICON_BY_VALUE = Object.fromEntries(
  TRIGGERS.map((o) => [typeof o === 'string' ? o : o.value, typeof o === 'string' ? undefined : o.icon]),
) as Record<string, keyof typeof Ionicons.glyphMap | undefined>;

const BODY_AREA_ICON: Record<string, keyof typeof Ionicons.glyphMap> = {
  jaw: 'happy-outline',
  temple: 'flash-outline',
  ear: 'ear-outline',
  cheek: 'person-outline',
  neck: 'body-outline',
  shoulder: 'barbell-outline',
  forehead: 'sunny-outline',
  'top of head': 'aperture-outline',
};

function cap(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

function bodyAreaTag(a: BodyArea): Tag {
  const side = a.side && a.side !== 'center' ? ` (${a.side})` : '';
  return { label: `${cap(a.area)}${side}`, icon: BODY_AREA_ICON[a.area] };
}

function formatDuration(min: number | null): string | null {
  if (min == null) return null;
  if (min < 15) return 'Less than 15 minutes';
  if (min < 30) return '15–30 minutes';
  if (min < 60) return '30–60 minutes';
  if (min < 120) return '1–2 hours';
  if (min < 480) return 'More than 2 hours';
  return 'All day';
}

function toneFor(n: number): { bg: string; text: string; accent: string } {
  if (n <= 3) return { bg: colors.success.soft, text: colors.success.strong, accent: colors.success.base };
  if (n <= 6) return { bg: colors.warning.soft, text: colors.warning.strong, accent: colors.warning.base };
  return { bg: colors.danger.soft, text: colors.danger.strong, accent: colors.danger.base };
}

function painLabel(n: number): string {
  if (n === 0) return 'No pain';
  if (n <= 3) return 'Mild';
  if (n <= 6) return 'Moderate';
  if (n <= 8) return 'Severe';
  return 'Worst';
}

export default function SymptomDetail() {
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const q = useSymptomLog(id);
  const update = useUpdateSymptom(id ?? '');
  const del = useDeleteSymptom();

  const [editing, setEditing] = useState(false);
  const [painLevel, setPainLevel] = useState(0);
  const [painTypes, setPainTypes] = useState<string[]>([]);
  const [triggers, setTriggers] = useState<string[]>([]);
  const [bodyAreas, setBodyAreas] = useState<BodyArea[]>([]);
  const [durationMinutes, setDurationMinutes] = useState<number | null>(null);
  const [notes, setNotes] = useState('');
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    if (hydrated || !q.data) return;
    setPainLevel(q.data.pain_level);
    setPainTypes(q.data.pain_types);
    setTriggers(q.data.triggers);
    setBodyAreas(q.data.body_areas);
    setDurationMinutes(q.data.duration_minutes);
    setNotes(q.data.notes);
    setHydrated(true);
  }, [q.data, hydrated]);

  if (q.isPending) {
    return (
      <SafeAreaView style={styles.safe} edges={['top']}>
        <TopBar onBack={() => router.back()} />
        <View style={styles.loading}>
          <ActivityIndicator color={colors.navy.standard} />
        </View>
      </SafeAreaView>
    );
  }

  if (!q.data) {
    return (
      <SafeAreaView style={styles.safe} edges={['top']}>
        <TopBar onBack={() => router.back()} />
        <View style={styles.loading}>
          <Text style={styles.loadingText}>Could not load this entry.</Text>
          <Button title="Go back" variant="secondary" onPress={() => router.back()} />
        </View>
      </SafeAreaView>
    );
  }

  const log = q.data;
  const day = new Date(log.logged_at);
  const dateLabel = day.toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric' });
  const timeLabel = day.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' });
  const tone = toneFor(log.pain_level);
  const edited = log.updated_at && log.updated_at !== log.created_at;

  const now = new Date();
  const createdDay = new Date(log.created_at);
  const isToday =
    createdDay.getFullYear() === now.getFullYear() &&
    createdDay.getMonth() === now.getMonth() &&
    createdDay.getDate() === now.getDate();

  const toggle = (setter: React.Dispatch<React.SetStateAction<string[]>>) => (v: string) => {
    setter((prev) => (prev.includes(v) ? prev.filter((x) => x !== v) : [...prev, v]));
  };

  const onSave = async () => {
    try {
      await update.mutateAsync({
        pain_level: painLevel,
        pain_types: painTypes,
        triggers,
        body_areas: bodyAreas,
        duration_minutes: durationMinutes,
        notes: notes || null,
      });
      setEditing(false);
    } catch (err) {
      Alert.alert('Could not save', err instanceof ApiError ? err.message : 'Try again.');
    }
  };

  const onCancelEdit = () => {
    setEditing(false);
    setHydrated(false);
  };

  const onDelete = () => {
    Alert.alert('Delete this entry?', 'This cannot be undone.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          try {
            await del.mutateAsync(id!);
            router.back();
          } catch (err) {
            Alert.alert('Could not delete', err instanceof ApiError ? err.message : 'Try again.');
          }
        },
      },
    ]);
  };

  const typeTags: Tag[] = log.pain_types.map((t) => ({ label: cap(t), icon: TYPE_ICON_BY_VALUE[t] }));
  const triggerTags: Tag[] = log.triggers.map((t) => ({ label: cap(t), icon: TRIGGER_ICON_BY_VALUE[t] }));
  const locationTags: Tag[] = log.body_areas.map(bodyAreaTag);
  const durationText = formatDuration(log.duration_minutes);

  // Hide entirely-empty read-only sections so the layout doesn't fill with "—".
  const hasLocation = locationTags.length > 0;
  const hasTypes = typeTags.length > 0;
  const hasTriggers = triggerTags.length > 0;
  const hasDuration = durationText != null;
  const hasNotes = log.notes && log.notes.trim().length > 0;

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <TopBar
        onBack={() => router.back()}
        title={editing ? 'Edit entry' : dateLabel}
        right={
          editing ? (
            <Pressable onPress={onCancelEdit} hitSlop={10}>
              <Text style={styles.cancelText}>Cancel</Text>
            </Pressable>
          ) : isToday ? (
            <Pressable onPress={() => setEditing(true)} hitSlop={10}>
              <Text style={styles.editText}>Edit</Text>
            </Pressable>
          ) : null
        }
      />

      <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
        {/* ───── Hero pain card ───── */}
        {editing ? (
          <View style={styles.editSection}>
            <Text style={styles.editLabel}>Pain level</Text>
            <PainSlider value={painLevel} onChange={setPainLevel} />
          </View>
        ) : (
          <View style={[styles.hero, { backgroundColor: tone.bg }]}>
            <View style={styles.heroTop}>
              <Text style={[styles.heroDate, { color: tone.text }]}>{dateLabel}</Text>
              <Text style={[styles.heroTime, { color: tone.text }]}>{timeLabel}</Text>
            </View>
            <View style={styles.heroRow}>
              <View style={styles.heroValueBlock}>
                <Text style={[styles.heroValue, { color: tone.text }]}>{log.pain_level}</Text>
                <Text style={[styles.heroScale, { color: tone.text }]}>/ 10</Text>
              </View>
              <View style={styles.heroMeta}>
                <View style={[styles.heroBadge, { backgroundColor: tone.accent }]}>
                  <Text style={styles.heroBadgeText}>{painLabel(log.pain_level).toUpperCase()}</Text>
                </View>
                {hasTypes ? (
                  <Text style={[styles.heroSummary, { color: tone.text }]} numberOfLines={1}>
                    {typeTags.map((t) => t.label).join(' · ')}
                  </Text>
                ) : null}
              </View>
            </View>
          </View>
        )}

        {/* ───── Pain type ───── */}
        {editing ? (
          <View style={styles.editSection}>
            <Text style={styles.editLabel}>Pain type</Text>
            <ChipGroup options={PAIN_TYPES} selected={painTypes} onToggle={toggle(setPainTypes)} />
          </View>
        ) : hasTypes ? (
          <Section icon="flash-outline" title="Pain type">
            <TagList tags={typeTags} />
          </Section>
        ) : null}

        {/* ───── Location ───── */}
        {editing ? (
          <View style={styles.editSection}>
            <Text style={styles.editLabel}>Pain location</Text>
            <BodyMap value={bodyAreas} onChange={setBodyAreas} />
          </View>
        ) : hasLocation ? (
          <Section icon="body-outline" title="Pain location">
            <TagList tags={locationTags} />
          </Section>
        ) : null}

        {/* ───── Triggers ───── */}
        {editing ? (
          <View style={styles.editSection}>
            <Text style={styles.editLabel}>Triggers</Text>
            <ChipGroup options={TRIGGERS} selected={triggers} onToggle={toggle(setTriggers)} />
          </View>
        ) : hasTriggers ? (
          <Section icon="sparkles-outline" title="Triggers">
            <TagList tags={triggerTags} />
          </Section>
        ) : null}

        {/* ───── Duration ───── */}
        {editing ? (
          <View style={styles.editSection}>
            <Text style={styles.editLabel}>Duration</Text>
            <DurationPicker value={durationMinutes} onChange={setDurationMinutes} />
          </View>
        ) : hasDuration ? (
          <Section icon="time-outline" title="Duration">
            <Text style={styles.valueText}>{durationText}</Text>
          </Section>
        ) : null}

        {/* ───── Notes ───── */}
        {editing ? (
          <View style={styles.editSection}>
            <Text style={styles.editLabel}>Notes</Text>
            <TextField
              value={notes}
              onChangeText={setNotes}
              placeholder="Anything else?"
              multiline
              numberOfLines={4}
              style={styles.notesInput}
            />
          </View>
        ) : hasNotes ? (
          <Section icon="document-text-outline" title="Notes">
            <Text style={styles.notesText}>{log.notes}</Text>
          </Section>
        ) : null}

        {/* ───── Empty-entry nudge ───── */}
        {!editing && !hasTypes && !hasLocation && !hasTriggers && !hasDuration && !hasNotes ? (
          <Pressable onPress={() => setEditing(true)} style={styles.nudge}>
            <Ionicons name="add-circle-outline" size={18} color={colors.navy.standard} />
            <Text style={styles.nudgeText}>Add details to this entry</Text>
          </Pressable>
        ) : null}

        {!editing ? (
          <Text style={styles.meta}>
            Logged {timeLabel}
            {edited ? ` · Edited ${new Date(log.updated_at).toLocaleDateString()}` : ''}
          </Text>
        ) : null}
      </ScrollView>

      {editing ? (
        <View style={styles.footer}>
          <Button title="Save Changes" onPress={onSave} loading={update.isPending} />
          <Pressable onPress={onDelete} style={styles.deleteBtn}>
            <Ionicons name="trash-outline" size={16} color={colors.danger.base} />
            <Text style={styles.deleteBtnText}>Delete entry</Text>
          </Pressable>
        </View>
      ) : null}
    </SafeAreaView>
  );
}

function TopBar({
  onBack,
  title,
  right,
}: {
  onBack: () => void;
  title?: string;
  right?: React.ReactNode;
}) {
  return (
    <View style={styles.topBar}>
      <Pressable onPress={onBack} hitSlop={10} style={styles.topBtn}>
        <Ionicons name="chevron-back" size={24} color={colors.ink.primary} />
      </Pressable>
      {title ? (
        <Text style={styles.topTitle} numberOfLines={1}>{title}</Text>
      ) : (
        <View style={styles.topTitle} />
      )}
      <View style={styles.topBtn}>{right}</View>
    </View>
  );
}

function Section({
  icon,
  title,
  children,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <View style={styles.section}>
      <View style={styles.sectionHeader}>
        <View style={styles.sectionIconWrap}>
          <Ionicons name={icon} size={14} color={colors.navy.standard} />
        </View>
        <Text style={styles.sectionTitle}>{title}</Text>
      </View>
      <View style={styles.sectionBody}>{children}</View>
    </View>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.surface.muted },

  // Top bar
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    backgroundColor: colors.surface.background,
    borderBottomWidth: 1,
    borderBottomColor: colors.surface.border,
  },
  topBtn: { minWidth: 60, alignItems: 'center' },
  topTitle: { flex: 1, textAlign: 'center', ...typography.bodyStrong, color: colors.ink.primary },
  editText: { ...typography.label, color: colors.navy.standard, fontWeight: '600' },
  cancelText: { ...typography.label, color: colors.ink.secondary },

  // Loading / empty
  loading: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: spacing.md, padding: spacing.xl },
  loadingText: { ...typography.body, color: colors.ink.secondary },

  // Scroll
  scroll: { padding: spacing.lg, paddingBottom: spacing.xxl },

  // Hero
  hero: {
    borderRadius: radius.xl,
    padding: spacing.lg,
    marginBottom: spacing.md,
    shadowColor: colors.ink.primary,
    shadowOpacity: 0.04,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 2 },
  },
  heroTop: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: spacing.md },
  heroDate: { ...typography.caption, fontWeight: '600', letterSpacing: 0.3 },
  heroTime: { ...typography.caption, opacity: 0.7 },
  heroRow: { flexDirection: 'row', alignItems: 'flex-end' },
  heroValueBlock: { flexDirection: 'row', alignItems: 'flex-end', minWidth: 110 },
  heroValue: { fontSize: 64, fontWeight: '800', lineHeight: 64 },
  heroScale: { ...typography.body, marginLeft: 4, marginBottom: 10, opacity: 0.7 },
  heroMeta: { flex: 1, marginLeft: spacing.md, alignItems: 'flex-end' },
  heroBadge: {
    paddingHorizontal: spacing.sm,
    paddingVertical: 4,
    borderRadius: radius.pill,
    marginBottom: spacing.xs,
  },
  heroBadgeText: { fontSize: 10, fontWeight: '800', color: '#fff', letterSpacing: 0.8 },
  heroSummary: { ...typography.caption, textAlign: 'right' },

  // Sections
  section: {
    marginTop: spacing.sm,
    padding: spacing.lg,
    backgroundColor: colors.surface.card,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.surface.border,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: spacing.sm,
  },
  sectionIconWrap: {
    width: 22,
    height: 22,
    borderRadius: 6,
    backgroundColor: colors.navy.ghost,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sectionTitle: {
    ...typography.caption,
    color: colors.ink.secondary,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  sectionBody: { },

  valueText: { ...typography.body, color: colors.ink.primary },
  notesText: { ...typography.body, color: colors.ink.primary, lineHeight: 22 },

  // Edit sections
  editSection: {
    marginTop: spacing.sm,
    padding: spacing.lg,
    backgroundColor: colors.surface.card,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.surface.border,
  },
  editLabel: {
    ...typography.caption,
    color: colors.ink.secondary,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: spacing.sm,
  },
  notesInput: { minHeight: 96, textAlignVertical: 'top' },

  // Nudge
  nudge: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.xs,
    padding: spacing.lg,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.surface.border,
    borderStyle: 'dashed',
    backgroundColor: colors.surface.background,
    marginTop: spacing.sm,
  },
  nudgeText: { ...typography.label, color: colors.navy.standard, fontWeight: '600' },

  meta: { ...typography.caption, color: colors.ink.tertiary, textAlign: 'center', marginTop: spacing.xl },

  // Footer
  footer: {
    padding: spacing.lg,
    borderTopWidth: 1,
    borderTopColor: colors.surface.border,
    backgroundColor: colors.surface.background,
    gap: spacing.md,
  },
  deleteBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: spacing.sm,
  },
  deleteBtnText: { ...typography.label, color: colors.danger.base, fontWeight: '600' },
});
