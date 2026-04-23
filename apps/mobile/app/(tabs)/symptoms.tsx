import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useMemo, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Button } from '../../src/components/Button';
import { SymptomCalendar } from '../../src/components/SymptomCalendar';
import { useSymptomCalendar } from '../../src/hooks/usePatient';
import { useSymptomHistory, useTodaysLog } from '../../src/hooks/useSymptoms';
import type { SymptomLog } from '../../src/lib/patient.api';
import { colors, radius, spacing, typography } from '../../src/theme/tokens';

type Mode = 'calendar' | 'list';

/**
 * "History" tab — two views of a patient's logged symptoms:
 * a month calendar (tone-coded by average pain) and a reverse-chron list.
 */
export default function HistoryTab() {
  const router = useRouter();
  const today = useTodaysLog();
  const [mode, setMode] = useState<Mode>('calendar');

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <View style={styles.header}>
        <Text style={styles.title}>Symptom History</Text>
        <Text style={styles.subtitle}>
          {mode === 'calendar' ? 'Tap a day to see your entry.' : 'Your most recent logs.'}
        </Text>

        <View style={styles.toggleRow}>
          <ModeBtn
            icon="calendar-outline"
            label="Calendar"
            active={mode === 'calendar'}
            onPress={() => setMode('calendar')}
          />
          <ModeBtn
            icon="list-outline"
            label="List"
            active={mode === 'list'}
            onPress={() => setMode('list')}
          />
        </View>
      </View>

      {mode === 'calendar' ? (
        <CalendarView onOpenLog={(id) => router.push(`/symptom/${id}`)} />
      ) : (
        <ListView onOpenLog={(id) => router.push(`/symptom/${id}`)} />
      )}

      <View style={styles.stickyCta}>
        <Button
          title={today.data ? 'Update Today\u2019s Log' : 'Log Today\u2019s Pain'}
          onPress={() => router.push('/symptom-log')}
        />
      </View>
    </SafeAreaView>
  );
}

// ─── Calendar view ─────────────────────────────────────────────────────────

function CalendarView({ onOpenLog }: { onOpenLog: (id: string) => void }) {
  const now = new Date();
  const [year, setYear] = useState(now.getFullYear());
  const [month, setMonth] = useState(now.getMonth() + 1);
  const [selectedDay, setSelectedDay] = useState<number | null>(now.getDate());

  const cal = useSymptomCalendar(year, month);
  const selectedDate = useMemo(() => {
    if (!selectedDay) return null;
    return `${year}-${String(month).padStart(2, '0')}-${String(selectedDay).padStart(2, '0')}`;
  }, [year, month, selectedDay]);
  const selectedData = cal.data?.find((d) => d.day === selectedDate);

  // Pull recent logs so calendar taps can route directly into the detail view.
  const history = useSymptomHistory();
  const selectedLog = useMemo(() => {
    if (!selectedDate || !history.data) return null;
    const match = history.data.pages
      .flatMap((p) => p.data)
      .find((l) => l.logged_at.startsWith(selectedDate));
    return match ?? null;
  }, [history.data, selectedDate]);

  const onNavigate = (delta: -1 | 1) => {
    const next = new Date(year, month - 1 + delta, 1);
    setYear(next.getFullYear());
    setMonth(next.getMonth() + 1);
    setSelectedDay(null);
  };

  return (
    <ScrollView contentContainerStyle={styles.content}>
      <SymptomCalendar
        year={year}
        month={month}
        selectedDay={selectedDay}
        onSelectDay={setSelectedDay}
        onNavigate={onNavigate}
      />

      <View style={styles.detail}>
        {selectedDay == null ? (
          <Text style={styles.detailEmpty}>Select a day to view details.</Text>
        ) : selectedData ? (
          <Pressable onPress={() => selectedLog && onOpenLog(selectedLog.id)}>
            <SelectedDayCard
              day={selectedDay}
              month={month}
              avgPain={selectedData.avg_pain}
              count={selectedData.count}
            />
          </Pressable>
        ) : (
          <View style={styles.noEntry}>
            <Ionicons name="calendar-outline" size={18} color={colors.ink.tertiary} />
            <Text style={styles.noEntryText}>No entry for this day.</Text>
          </View>
        )}
      </View>

    </ScrollView>
  );
}

// ─── List view ─────────────────────────────────────────────────────────────

function ListView({ onOpenLog }: { onOpenLog: (id: string) => void }) {
  const history = useSymptomHistory();
  const logs = useMemo(
    () => history.data?.pages.flatMap((p) => p.data) ?? [],
    [history.data],
  );

  return (
    <FlatList
      data={logs}
      keyExtractor={(l) => l.id}
      contentContainerStyle={styles.content}
      renderItem={({ item }) => <LogRow log={item} onPress={() => onOpenLog(item.id)} />}
      ItemSeparatorComponent={() => <View style={styles.rowSep} />}
      refreshControl={
        <RefreshControl refreshing={history.isRefetching} onRefresh={() => history.refetch()} />
      }
      onEndReachedThreshold={0.4}
      onEndReached={() => {
        if (history.hasNextPage && !history.isFetchingNextPage) history.fetchNextPage();
      }}
      ListFooterComponent={
        history.isFetchingNextPage ? (
          <ActivityIndicator color={colors.navy.standard} style={styles.footerLoader} />
        ) : null
      }
      ListEmptyComponent={
        history.isPending ? (
          <View style={styles.empty}>
            <ActivityIndicator color={colors.navy.standard} />
          </View>
        ) : (
          <View style={styles.empty}>
            <Ionicons name="document-text-outline" size={32} color={colors.ink.tertiary} />
            <Text style={styles.emptyText}>No logs yet. Start by logging today\u2019s pain.</Text>
          </View>
        )
      }
    />
  );
}

function LogRow({ log, onPress }: { log: SymptomLog; onPress: () => void }) {
  const tone = toneFor(log.pain_level);
  const date = new Date(log.logged_at);
  const dateLabel = date.toLocaleDateString(undefined, {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
  });
  const summaryParts: string[] = [];
  if (log.pain_types.length > 0) {
    summaryParts.push(log.pain_types.slice(0, 2).join(', '));
  }
  if (log.body_areas.length > 0) {
    summaryParts.push(
      log.body_areas
        .slice(0, 2)
        .map((b) => b.area)
        .join(', '),
    );
  }
  const summary = summaryParts.join(' · ') || 'No details';

  return (
    <Pressable onPress={onPress} style={({ pressed }) => [styles.row, pressed && styles.rowPressed]}>
      <View style={[styles.rowBadge, { backgroundColor: tone }]}>
        <Text style={styles.rowBadgeText}>{log.pain_level}</Text>
      </View>
      <View style={styles.flex1}>
        <Text style={styles.rowTitle}>{dateLabel}</Text>
        <Text style={styles.rowSub} numberOfLines={1}>
          Pain {log.pain_level}/10 · {summary}
        </Text>
      </View>
      <Ionicons name="chevron-forward" size={18} color={colors.ink.tertiary} />
    </Pressable>
  );
}

// ─── Shared bits ───────────────────────────────────────────────────────────

function ModeBtn({
  icon,
  label,
  active,
  onPress,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  active: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable onPress={onPress} style={[styles.modeBtn, active && styles.modeBtnActive]}>
      <Ionicons name={icon} size={16} color={active ? '#fff' : colors.ink.secondary} />
      <Text style={[styles.modeText, active && styles.modeTextActive]}>{label}</Text>
    </Pressable>
  );
}

function SelectedDayCard({
  day,
  month,
  avgPain,
  count,
}: {
  day: number;
  month: number;
  avgPain: number;
  count: number;
}) {
  const tone = toneFor(avgPain);
  const dateLabel = new Date(new Date().getFullYear(), month - 1, day).toLocaleDateString(undefined, {
    weekday: 'long',
    month: 'short',
    day: 'numeric',
  });
  return (
    <View style={styles.card}>
      <View style={styles.cardRow}>
        <View style={[styles.badge, { backgroundColor: tone }]}>
          <Text style={styles.badgeText}>{avgPain}</Text>
        </View>
        <View style={styles.flex1}>
          <Text style={styles.cardTitle}>{dateLabel}</Text>
          <Text style={styles.cardMeta}>
            Pain level {avgPain}/10 · {count} log{count === 1 ? '' : 's'}
          </Text>
        </View>
      </View>
    </View>
  );
}

function toneFor(n: number): string {
  if (n <= 3) return colors.success.base;
  if (n <= 6) return colors.warning.base;
  return colors.danger.base;
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.surface.background },
  header: { paddingHorizontal: spacing.lg, paddingTop: spacing.lg, paddingBottom: spacing.md },
  title: { ...typography.h1, color: colors.ink.primary },
  subtitle: { ...typography.body, color: colors.ink.secondary, marginTop: spacing.xs },
  toggleRow: { flexDirection: 'row', gap: spacing.sm, marginTop: spacing.md },
  modeBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: colors.surface.border,
  },
  modeBtnActive: { backgroundColor: colors.navy.standard, borderColor: colors.navy.standard },
  modeText: { ...typography.label, color: colors.ink.secondary },
  modeTextActive: { color: '#fff' },

  content: { paddingHorizontal: spacing.lg, paddingBottom: 120, paddingTop: spacing.md },
  detail: { marginTop: spacing.lg },
  detailEmpty: { ...typography.body, color: colors.ink.tertiary, textAlign: 'center', padding: spacing.lg },
  noEntry: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, padding: spacing.md },
  noEntryText: { ...typography.body, color: colors.ink.secondary },

  card: {
    backgroundColor: colors.surface.card,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.surface.border,
    padding: spacing.lg,
  },
  cardRow: { flexDirection: 'row', alignItems: 'center' },
  badge: {
    width: 44, height: 44, borderRadius: 22,
    alignItems: 'center', justifyContent: 'center',
    marginRight: spacing.md,
  },
  badgeText: { fontSize: 16, fontWeight: '700', color: '#fff' },
  cardTitle: { ...typography.bodyStrong, color: colors.ink.primary },
  cardMeta: { ...typography.caption, color: colors.ink.secondary, marginTop: 2 },
  flex1: { flex: 1 },
  stickyCta: {
    position: 'absolute',
    left: spacing.lg,
    right: spacing.lg,
    bottom: spacing.lg,
  },

  row: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: spacing.md,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.surface.border,
    backgroundColor: colors.surface.card,
    gap: spacing.md,
  },
  rowPressed: { backgroundColor: colors.surface.muted },
  rowBadge: {
    width: 40, height: 40, borderRadius: 20,
    alignItems: 'center', justifyContent: 'center',
  },
  rowBadgeText: { fontSize: 15, fontWeight: '700', color: '#fff' },
  rowTitle: { ...typography.bodyStrong, color: colors.ink.primary },
  rowSub: { ...typography.caption, color: colors.ink.secondary, marginTop: 2 },
  rowSep: { height: spacing.sm },

  footerLoader: { marginVertical: spacing.md },
  empty: { alignItems: 'center', gap: spacing.md, paddingVertical: spacing.xxl, paddingHorizontal: spacing.xl },
  emptyText: { ...typography.body, color: colors.ink.secondary, textAlign: 'center' },
});
