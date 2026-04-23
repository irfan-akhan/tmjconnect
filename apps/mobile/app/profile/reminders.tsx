import { Ionicons } from '@expo/vector-icons';
import { useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Button } from '../../src/components/Button';
import { ProfileScreenHeader } from '../../src/components/ProfileScreenHeader';
import {
  useCreateReminder,
  useDeleteReminder,
  useReminders,
  useUpdateReminder,
} from '../../src/hooks/useReminders';
import type { Reminder, ReminderDay, ReminderType } from '../../src/lib/reminders.api';
import { colors, radius, spacing, typography } from '../../src/theme/tokens';

const DAY_ORDER: ReminderDay[] = ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'];
const DAY_LABEL: Record<ReminderDay, string> = {
  mon: 'M',
  tue: 'T',
  wed: 'W',
  thu: 'T',
  fri: 'F',
  sat: 'S',
  sun: 'S',
};

export default function RemindersScreen() {
  const reminders = useReminders();
  const [editing, setEditing] = useState<Reminder | 'new' | null>(null);

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <ProfileScreenHeader
        title="Reminders"
        right={
          <Pressable onPress={() => setEditing('new')} hitSlop={6}>
            <Ionicons name="add" size={24} color={colors.navy.standard} />
          </Pressable>
        }
      />

      <ScrollView contentContainerStyle={styles.scroll}>
        <Text style={styles.helper}>
          Schedule push + email nudges for daily symptom check-ins and assigned exercises.
        </Text>

        {reminders.isPending ? (
          <ActivityIndicator color={colors.navy.standard} style={{ marginTop: spacing.xl }} />
        ) : (reminders.data?.length ?? 0) === 0 ? (
          <View style={styles.empty}>
            <Ionicons name="alarm-outline" size={36} color={colors.ink.tertiary} />
            <Text style={styles.emptyText}>
              No reminders yet. Tap + to add one.
            </Text>
          </View>
        ) : (
          reminders.data!.map((r) => (
            <ReminderRow key={r.id} reminder={r} onEdit={() => setEditing(r)} />
          ))
        )}

        <Button
          title="+ New Reminder"
          variant="secondary"
          onPress={() => setEditing('new')}
          style={styles.addBtn}
        />
      </ScrollView>

      <Modal
        visible={editing !== null}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setEditing(null)}
      >
        {editing !== null ? (
          <ReminderEditor
            existing={editing === 'new' ? null : editing}
            onClose={() => setEditing(null)}
          />
        ) : null}
      </Modal>
    </SafeAreaView>
  );
}

function ReminderRow({ reminder, onEdit }: { reminder: Reminder; onEdit: () => void }) {
  const update = useUpdateReminder();
  const icon = reminder.type === 'exercise' ? 'fitness-outline' : 'pulse-outline';
  const toggle = (v: boolean) => update.mutate({ id: reminder.id, input: { enabled: v } });

  return (
    <Pressable onPress={onEdit} style={styles.row}>
      <View style={styles.iconWrap}>
        <Ionicons name={icon} size={20} color={colors.navy.standard} />
      </View>
      <View style={styles.body}>
        <Text style={styles.title}>
          {reminder.type === 'exercise' ? 'Exercise' : 'Symptom check-in'} · {formatTime(reminder.time)}
        </Text>
        <Text style={styles.meta}>{daysLabel(reminder.days)}</Text>
      </View>
      <Pressable onPress={() => toggle(!reminder.enabled)} hitSlop={10} style={[styles.toggle, reminder.enabled && styles.toggleOn]}>
        <View style={[styles.toggleKnob, reminder.enabled && styles.toggleKnobOn]} />
      </Pressable>
    </Pressable>
  );
}

function ReminderEditor({ existing, onClose }: { existing: Reminder | null; onClose: () => void }) {
  const create = useCreateReminder();
  const update = useUpdateReminder();
  const del = useDeleteReminder();

  const [type, setType] = useState<ReminderType>(existing?.type ?? 'symptom');
  const [hour, setHour] = useState<number>(
    existing ? parseInt(existing.time.slice(0, 2), 10) : 20,
  );
  const [minute, setMinute] = useState<number>(
    existing ? parseInt(existing.time.slice(3, 5), 10) : 0,
  );
  const [days, setDays] = useState<ReminderDay[]>(existing?.days ?? [...DAY_ORDER]);
  const [enabled, setEnabled] = useState(existing?.enabled ?? true);
  const [err, setErr] = useState<string | null>(null);

  const submitting = create.isPending || update.isPending || del.isPending;

  const toggleDay = (d: ReminderDay) => {
    setDays((prev) => (prev.includes(d) ? prev.filter((x) => x !== d) : [...prev, d]));
  };

  const onSave = async () => {
    setErr(null);
    if (days.length === 0) {
      setErr('Pick at least one day.');
      return;
    }
    const time = `${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}`;
    try {
      if (existing) {
        await update.mutateAsync({ id: existing.id, input: { type, time, days, enabled } });
      } else {
        await create.mutateAsync({ type, time, days, enabled });
      }
      onClose();
    } catch {
      setErr('Could not save. Try again.');
    }
  };

  const onDelete = () => {
    if (!existing) return;
    Alert.alert('Delete reminder?', 'This action cannot be undone.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          await del.mutateAsync(existing.id);
          onClose();
        },
      },
    ]);
  };

  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.modalHeader}>
        <Pressable onPress={onClose} hitSlop={10}>
          <Text style={styles.cancelText}>Cancel</Text>
        </Pressable>
        <Text style={styles.modalTitle}>{existing ? 'Edit Reminder' : 'New Reminder'}</Text>
        <Pressable onPress={onSave} hitSlop={10} disabled={submitting}>
          <Text style={[styles.saveText, submitting && { opacity: 0.5 }]}>
            {submitting ? 'Saving…' : 'Save'}
          </Text>
        </Pressable>
      </View>

      <ScrollView contentContainerStyle={styles.editorBody}>
        <Text style={styles.label}>Type</Text>
        <View style={styles.segRow}>
          {(['symptom', 'exercise'] as ReminderType[]).map((t) => (
            <Pressable
              key={t}
              onPress={() => setType(t)}
              style={[styles.seg, type === t && styles.segActive]}
            >
              <Text style={[styles.segText, type === t && styles.segTextActive]}>
                {t === 'symptom' ? 'Symptom check-in' : 'Exercise'}
              </Text>
            </Pressable>
          ))}
        </View>

        <Text style={styles.label}>Time</Text>
        <TimePicker hour={hour} minute={minute} onChange={(h, m) => { setHour(h); setMinute(m); }} />

        <Text style={styles.label}>Days of week</Text>
        <View style={styles.dayRow}>
          {DAY_ORDER.map((d) => {
            const on = days.includes(d);
            return (
              <Pressable key={d} onPress={() => toggleDay(d)} style={[styles.day, on && styles.dayOn]}>
                <Text style={[styles.dayText, on && styles.dayTextOn]}>{DAY_LABEL[d]}</Text>
              </Pressable>
            );
          })}
        </View>

        <Pressable onPress={() => setEnabled((v) => !v)} style={styles.enabledRow}>
          <Text style={styles.label}>Enabled</Text>
          <View style={[styles.toggle, enabled && styles.toggleOn]}>
            <View style={[styles.toggleKnob, enabled && styles.toggleKnobOn]} />
          </View>
        </Pressable>

        {err ? <Text style={styles.error}>{err}</Text> : null}

        {existing ? (
          <Button title="Delete Reminder" variant="danger" onPress={onDelete} style={styles.deleteBtn} />
        ) : null}
      </ScrollView>
    </SafeAreaView>
  );
}

function TimePicker({
  hour,
  minute,
  onChange,
}: {
  hour: number;
  minute: number;
  onChange: (h: number, m: number) => void;
}) {
  const HOURS = Array.from({ length: 24 }, (_, i) => i);
  const MINUTES = [0, 15, 30, 45];
  return (
    <View style={styles.timeCard}>
      <ScrollPicker values={HOURS} value={hour} onChange={(h) => onChange(h, minute)} format={(n) => String(n).padStart(2, '0')} />
      <Text style={styles.timeSep}>:</Text>
      <ScrollPicker values={MINUTES} value={minute} onChange={(m) => onChange(hour, m)} format={(n) => String(n).padStart(2, '0')} />
    </View>
  );
}

function ScrollPicker<T>({
  values,
  value,
  onChange,
  format,
}: {
  values: T[];
  value: T;
  onChange: (v: T) => void;
  format: (v: T) => string;
}) {
  const [idx, setIdx] = useState(() => Math.max(0, values.indexOf(value)));
  useEffect(() => {
    onChange(values[idx]!);
  }, [idx]);
  return (
    <View style={styles.picker}>
      <Pressable style={styles.pickerBtn} onPress={() => setIdx((i) => (i - 1 + values.length) % values.length)} hitSlop={6}>
        <Ionicons name="chevron-up" size={18} color={colors.ink.secondary} />
      </Pressable>
      <Text style={styles.pickerValue}>{format(values[idx]!)}</Text>
      <Pressable style={styles.pickerBtn} onPress={() => setIdx((i) => (i + 1) % values.length)} hitSlop={6}>
        <Ionicons name="chevron-down" size={18} color={colors.ink.secondary} />
      </Pressable>
    </View>
  );
}

function formatTime(hms: string): string {
  const [hh, mm] = hms.split(':');
  const h = parseInt(hh!, 10);
  const suffix = h >= 12 ? 'PM' : 'AM';
  const h12 = ((h + 11) % 12) + 1;
  return `${h12}:${mm} ${suffix}`;
}

function daysLabel(days: ReminderDay[]): string {
  if (days.length === 7) return 'Every day';
  const weekdays = (['mon','tue','wed','thu','fri'] as ReminderDay[]).every((d) => days.includes(d));
  const weekend = (['sat','sun'] as ReminderDay[]).every((d) => days.includes(d));
  if (weekdays && !weekend) return 'Weekdays';
  if (weekend && !weekdays) return 'Weekends';
  return days.map((d) => d.charAt(0).toUpperCase() + d.slice(1)).join(' · ');
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.surface.background },
  scroll: { padding: spacing.lg, paddingBottom: spacing.xl },
  helper: { ...typography.body, color: colors.ink.secondary, marginBottom: spacing.lg },
  empty: { alignItems: 'center', padding: spacing.xl, gap: spacing.md },
  emptyText: { ...typography.body, color: colors.ink.secondary },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    padding: spacing.md,
    backgroundColor: colors.surface.card,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.surface.border,
    marginBottom: spacing.sm,
  },
  iconWrap: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: colors.navy.ghost,
    alignItems: 'center',
    justifyContent: 'center',
  },
  body: { flex: 1 },
  title: { ...typography.bodyStrong, color: colors.ink.primary },
  meta: { ...typography.caption, color: colors.ink.secondary, marginTop: 2 },
  toggle: {
    width: 48,
    height: 28,
    borderRadius: 14,
    backgroundColor: colors.surface.border,
    padding: 2,
    justifyContent: 'center',
  },
  toggleOn: { backgroundColor: colors.navy.standard },
  toggleKnob: { width: 24, height: 24, borderRadius: 12, backgroundColor: '#fff' },
  toggleKnobOn: { alignSelf: 'flex-end' },
  addBtn: { marginTop: spacing.lg },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: spacing.lg,
    borderBottomWidth: 1,
    borderBottomColor: colors.surface.border,
  },
  cancelText: { ...typography.label, color: colors.ink.secondary },
  modalTitle: { ...typography.bodyStrong, color: colors.ink.primary },
  saveText: { ...typography.bodyStrong, color: colors.navy.standard },
  editorBody: { padding: spacing.lg },
  label: { ...typography.label, color: colors.ink.primary, marginBottom: spacing.sm, marginTop: spacing.md },
  segRow: { flexDirection: 'row', gap: spacing.sm },
  seg: {
    flex: 1,
    paddingVertical: spacing.md,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.surface.border,
    alignItems: 'center',
  },
  segActive: { borderColor: colors.navy.standard, backgroundColor: colors.navy.ghost },
  segText: { ...typography.bodyStrong, color: colors.ink.secondary },
  segTextActive: { color: colors.navy.deep },
  timeCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.md,
    backgroundColor: colors.surface.muted,
    padding: spacing.lg,
    borderRadius: radius.lg,
  },
  picker: { alignItems: 'center', gap: spacing.xs },
  pickerBtn: { padding: 4 },
  pickerValue: { fontSize: 36, fontWeight: '700', color: colors.ink.primary, fontVariant: ['tabular-nums'] },
  timeSep: { fontSize: 32, fontWeight: '700', color: colors.ink.primary },
  dayRow: { flexDirection: 'row', gap: spacing.xs, justifyContent: 'space-between' },
  day: {
    flex: 1,
    aspectRatio: 1,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: colors.surface.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dayOn: { backgroundColor: colors.navy.standard, borderColor: colors.navy.standard },
  dayText: { ...typography.bodyStrong, color: colors.ink.secondary },
  dayTextOn: { color: '#fff' },
  enabledRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: spacing.md,
    marginTop: spacing.md,
    borderTopWidth: 1,
    borderTopColor: colors.surface.border,
  },
  error: { ...typography.caption, color: colors.danger.strong, marginTop: spacing.md },
  deleteBtn: { marginTop: spacing.xl },
});
