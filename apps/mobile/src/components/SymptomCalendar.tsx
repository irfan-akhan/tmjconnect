import { Ionicons } from '@expo/vector-icons';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useSymptomCalendar } from '../hooks/usePatient';
import { colors, radius, spacing, typography } from '../theme/tokens';

const WEEK = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];

export function SymptomCalendar({
  year,
  month,
  selectedDay,
  onSelectDay,
  onNavigate,
}: {
  year: number;
  month: number; // 1-12
  selectedDay: number | null;
  onSelectDay: (day: number) => void;
  onNavigate: (delta: -1 | 1) => void;
}) {
  const q = useSymptomCalendar(year, month);
  const daysInMonth = new Date(year, month, 0).getDate();
  const firstDow = new Date(year, month - 1, 1).getDay();
  const today = new Date();
  const isCurrentMonth = year === today.getFullYear() && month === today.getMonth() + 1;
  const label = new Date(year, month - 1, 1).toLocaleDateString(undefined, { month: 'long', year: 'numeric' });

  const byDay = new Map<string, number>();
  (q.data ?? []).forEach((d) => byDay.set(d.day, d.avg_pain));

  const isFutureMonth =
    year > today.getFullYear() ||
    (year === today.getFullYear() && month > today.getMonth() + 1);

  const cells: Array<{ day: number | null; pain?: number; isToday?: boolean; isFuture?: boolean }> = [];
  for (let i = 0; i < firstDow; i++) cells.push({ day: null });
  for (let d = 1; d <= daysInMonth; d++) {
    const key = `${year}-${String(month).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
    const isFuture = isFutureMonth || (isCurrentMonth && d > today.getDate());
    cells.push({
      day: d,
      pain: byDay.get(key),
      isToday: isCurrentMonth && d === today.getDate(),
      isFuture,
    });
  }

  return (
    <View style={styles.wrap}>
      <View style={styles.header}>
        <Pressable onPress={() => onNavigate(-1)} hitSlop={8} style={styles.navBtn}>
          <Ionicons name="chevron-back" size={20} color={colors.ink.primary} />
        </Pressable>
        <Text style={styles.monthLabel}>{label}</Text>
        <Pressable onPress={() => onNavigate(1)} hitSlop={8} style={styles.navBtn}>
          <Ionicons name="chevron-forward" size={20} color={colors.ink.primary} />
        </Pressable>
      </View>

      <View style={styles.weekRow}>
        {WEEK.map((d, i) => (
          <Text key={i} style={styles.weekLabel}>{d}</Text>
        ))}
      </View>

      <View style={styles.grid}>
        {cells.map((c, i) => {
          if (c.day == null) return <View key={i} style={styles.cell} />;
          const tone = c.pain != null ? toneFor(c.pain) : null;
          const selected = selectedDay === c.day;
          const disabled = !!c.isFuture;
          return (
            <Pressable
              key={i}
              style={styles.cell}
              onPress={() => onSelectDay(c.day!)}
              disabled={disabled}
              accessibilityRole="button"
              accessibilityState={{ disabled, selected }}
            >
              <View
                style={[
                  styles.dayCell,
                  tone && !disabled && { backgroundColor: tone.bg },
                  c.isToday && !selected && styles.dayToday,
                  selected && styles.daySelected,
                  disabled && styles.dayDisabled,
                ]}
              >
                <Text
                  style={[
                    styles.dayText,
                    tone && !disabled && { color: tone.text, fontWeight: '600' },
                    selected && styles.dayTextSelected,
                    disabled && styles.dayTextDisabled,
                  ]}
                >
                  {c.day}
                </Text>
              </View>
            </Pressable>
          );
        })}
      </View>

      <View style={styles.legend}>
        <LegendDot color={colors.success.soft} label="Low" />
        <LegendDot color={colors.warning.soft} label="Medium" />
        <LegendDot color={colors.danger.soft} label="High" />
      </View>
    </View>
  );
}

function LegendDot({ color, label }: { color: string; label: string }) {
  return (
    <View style={styles.legendItem}>
      <View style={[styles.legendDot, { backgroundColor: color }]} />
      <Text style={styles.legendText}>{label}</Text>
    </View>
  );
}

function toneFor(n: number): { bg: string; text: string } {
  if (n <= 3) return { bg: colors.success.soft, text: colors.success.strong };
  if (n <= 6) return { bg: colors.warning.soft, text: colors.warning.strong };
  return { bg: colors.danger.soft, text: colors.danger.strong };
}

const styles = StyleSheet.create({
  wrap: {
    backgroundColor: colors.surface.card,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.surface.border,
    padding: spacing.lg,
  },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: spacing.md },
  navBtn: { width: 32, height: 32, alignItems: 'center', justifyContent: 'center', borderRadius: radius.sm },
  monthLabel: { ...typography.h3, color: colors.ink.primary },
  weekRow: { flexDirection: 'row', marginBottom: spacing.xs },
  weekLabel: { flex: 1, textAlign: 'center', ...typography.tiny, color: colors.ink.tertiary },
  grid: { flexDirection: 'row', flexWrap: 'wrap' },
  cell: { width: `${100 / 7}%`, aspectRatio: 1, alignItems: 'center', justifyContent: 'center', padding: 2 },
  dayCell: {
    width: 38,
    height: 38,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dayToday: { borderWidth: 1.5, borderColor: colors.navy.standard },
  daySelected: {
    backgroundColor: colors.navy.standard,
    borderWidth: 0,
  },
  dayText: { ...typography.label, color: colors.ink.primary },
  dayTextSelected: { color: '#fff', fontWeight: '700' },
  dayDisabled: { backgroundColor: 'transparent' },
  dayTextDisabled: { color: colors.ink.tertiary, opacity: 0.45, fontWeight: '400' },
  legend: { flexDirection: 'row', gap: spacing.lg, marginTop: spacing.md, justifyContent: 'center' },
  legendItem: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs },
  legendDot: { width: 10, height: 10, borderRadius: 3 },
  legendText: { ...typography.caption, color: colors.ink.secondary },
});
