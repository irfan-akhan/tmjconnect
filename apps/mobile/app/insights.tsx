import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useState } from 'react';
import { ActivityIndicator, Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { MiniBarChart } from '../src/components/MiniBarChart';
import { MiniLineChart } from '../src/components/MiniLineChart';
import { PainDonut } from '../src/components/PainDonut';
import { ProgressScore } from '../src/components/ProgressScore';
import { EmptyState, ErrorState } from '../src/components/ScreenState';
import { usePainInsights, useExerciseCorrelation, useMedicationCorrelation, useSleepCorrelation, useMobilityTrend } from '../src/hooks/useTracking';
import { colors, radius, spacing, typography } from '../src/theme/tokens';

const DOW = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const RANGES = [
  { label: '7 Days', days: 7 },
  { label: '30 Days', days: 30 },
  { label: '90 Days', days: 90 },
] as const;

export default function InsightsScreen() {
  const router = useRouter();
  const [days, setDays] = useState(30);
  const insights = usePainInsights(days);
  const correlation = useExerciseCorrelation(days);
  const medCorr = useMedicationCorrelation(days);
  const sleepCorr = useSleepCorrelation(days);
  const mobilityTrend = useMobilityTrend(days);

  const d = insights.data;
  const loading = insights.isPending;

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} hitSlop={10}>
          <Ionicons name="chevron-back" size={24} color={colors.ink.primary} />
        </Pressable>
        <Text style={styles.headerTitle}>Insights</Text>
        <View style={{ width: 24 }} />
      </View>

      {/* ─── Time range tabs ─── */}
      <View style={styles.tabBar}>
        {RANGES.map((r) => (
          <Pressable
            key={r.days}
            onPress={() => setDays(r.days)}
            style={[styles.tab, days === r.days && styles.tabActive]}
          >
            <Text style={[styles.tabText, days === r.days && styles.tabTextActive]}>{r.label}</Text>
          </Pressable>
        ))}
      </View>

      <ScrollView
        contentContainerStyle={styles.content}
        refreshControl={
          <RefreshControl
            refreshing={false}
            onRefresh={() => { insights.refetch(); correlation.refetch(); medCorr.refetch(); sleepCorr.refetch(); mobilityTrend.refetch(); }}
          />
        }
      >
        {loading ? (
          <ActivityIndicator color={colors.navy.standard} style={{ marginTop: spacing.xxl }} />
        ) : insights.isError ? (
          <ErrorState message="Could not load insights." onRetry={() => insights.refetch()} />
        ) : d && d.overall.total_logs === 0 ? (
          <EmptyState
            icon="analytics-outline"
            title="No data yet"
            message="Start logging your symptoms to see trends, patterns, and correlations here."
          />
        ) : d ? (
          <>
            {/* ───── Hero summary ───── */}
            <View style={styles.heroCard}>
              <View style={styles.heroLeft}>
                <Text style={styles.heroAvg}>{d.overall.avg_pain}</Text>
                <Text style={styles.heroAvgUnit}>/ 10</Text>
              </View>
              <View style={styles.heroRight}>
                <View style={styles.heroStatRow}>
                  <Ionicons
                    name={d.overall.trend < 0 ? 'trending-down' : d.overall.trend > 0 ? 'trending-up' : 'remove'}
                    size={20}
                    color={d.overall.trend < 0 ? colors.success.base : d.overall.trend > 0 ? colors.danger.base : colors.ink.tertiary}
                  />
                  <Text style={[
                    styles.heroTrend,
                    { color: d.overall.trend < 0 ? colors.success.base : d.overall.trend > 0 ? colors.danger.base : colors.ink.tertiary },
                  ]}>
                    {d.overall.trend > 0 ? '+' : ''}{d.overall.trend} vs prior period
                  </Text>
                </View>
                <View style={styles.heroMeta}>
                  <View style={styles.heroMetaItem}>
                    <Ionicons name="document-text-outline" size={14} color={colors.ink.secondary} />
                    <Text style={styles.heroMetaText}>{d.overall.total_logs} logs</Text>
                  </View>
                  <View style={styles.heroMetaItem}>
                    <Ionicons name="calendar-outline" size={14} color={colors.ink.secondary} />
                    <Text style={styles.heroMetaText}>{days} days</Text>
                  </View>
                </View>
              </View>
            </View>

            {/* ───── Progress Score ───── */}
            <ProgressScore
              avgPain={d.overall.avg_pain}
              trend={d.overall.trend}
              exerciseRate={correlation.data ? (correlation.data.exercise_days_count > 0 ? Math.round((correlation.data.exercise_days_count / (correlation.data.exercise_days_count + correlation.data.no_exercise_days_count)) * 100) : 0) : null}
              totalLogs={d.overall.total_logs}
            />

            {/* ───── Pain trend line ───── */}
            <SectionCard icon="analytics-outline" title="Pain Over Time">
              <MiniLineChart
                data={d.daily_averages.map((p) => ({ label: p.date.slice(5), value: p.avg_pain }))}
                yLabel="Avg pain level"
                height={160}
              />
            </SectionCard>

            {/* ───── Day of week ───── */}
            <SectionCard icon="calendar-outline" title="Pain by Day of Week">
              <MiniBarChart
                data={d.day_of_week.map((p) => ({ label: DOW[p.day] ?? '?', value: p.avg_pain }))}
                color={colors.gold.standard}
                height={130}
              />
              {d.day_of_week.length > 0 ? (
                <Text style={styles.insightCaption}>
                  Worst day: {DOW[d.day_of_week.reduce((a, b) => (b.avg_pain > a.avg_pain ? b : a), d.day_of_week[0]!).day] ?? '?'}
                </Text>
              ) : null}
            </SectionCard>

            {/* ───── Pain distribution donut ───── */}
            {d.daily_averages.length >= 3 ? (
              <SectionCard icon="pie-chart-outline" title="Pain Distribution">
                <PainDonut data={d.daily_averages} />
              </SectionCard>
            ) : null}

            {/* ───── Triggers ───── */}
            {d.trigger_frequency.length > 0 ? (
              <SectionCard icon="flash-outline" title="Top Triggers">
                {d.trigger_frequency.slice(0, 6).map((t, i) => (
                  <View key={t.trigger} style={styles.triggerRow}>
                    <View style={styles.triggerRank}>
                      <Text style={styles.triggerRankText}>{i + 1}</Text>
                    </View>
                    <Text style={styles.triggerLabel}>{t.trigger}</Text>
                    <View style={styles.triggerBarWrap}>
                      <View style={[styles.triggerBarFill, { width: `${Math.max(8, (t.count / d.trigger_frequency[0]!.count) * 100)}%` }]} />
                    </View>
                    <Text style={styles.triggerCount}>{t.count}x</Text>
                  </View>
                ))}
              </SectionCard>
            ) : null}

            {/* ───── Pain types ───── */}
            {d.pain_type_frequency.length > 0 ? (
              <SectionCard icon="pulse-outline" title="Pain Types">
                <View style={styles.typeChips}>
                  {d.pain_type_frequency.map((t) => (
                    <View key={t.type} style={styles.typeChip}>
                      <Text style={styles.typeChipCount}>{t.count}</Text>
                      <Text style={styles.typeChipLabel}>{t.type}</Text>
                    </View>
                  ))}
                </View>
              </SectionCard>
            ) : null}

            {/* ───── Exercise correlation ───── */}
            {correlation.data && correlation.data.exercise_days_count > 0 ? (
              <SectionCard icon="fitness-outline" title="Exercise Impact">
                <Text style={styles.insightText}>
                  Your pain averages <Text style={{ fontWeight: '700', color: colors.success.base }}>{correlation.data.exercise_days_avg_pain}</Text> on
                  exercise days vs <Text style={{ fontWeight: '700', color: colors.danger.base }}>{correlation.data.no_exercise_days_avg_pain}</Text> on
                  rest days.
                </Text>
                <View style={styles.compareRow}>
                  <CompareCard
                    icon="checkmark-circle"
                    iconColor={colors.success.base}
                    label="Exercise days"
                    value={correlation.data.exercise_days_avg_pain}
                    sub={`${correlation.data.exercise_days_count} days`}
                    accent={colors.success.soft}
                  />
                  <CompareCard
                    icon="close-circle"
                    iconColor={colors.danger.base}
                    label="Rest days"
                    value={correlation.data.no_exercise_days_avg_pain}
                    sub={`${correlation.data.no_exercise_days_count} days`}
                    accent={colors.danger.soft}
                  />
                </View>
              </SectionCard>
            ) : correlation.data ? (
              <SectionCard icon="fitness-outline" title="Exercise Impact">
                <EmptyHint text="Start completing exercises to see their impact on your pain levels." />
              </SectionCard>
            ) : null}

            {/* ───── Medication correlation ───── */}
            {medCorr.data && medCorr.data.medication_days_count > 0 ? (
              <SectionCard icon="medkit-outline" title="Medication Impact">
                <View style={styles.compareRow}>
                  <CompareCard
                    icon="medkit"
                    iconColor={colors.success.base}
                    label="With meds"
                    value={medCorr.data.medication_days_avg_pain}
                    sub={`${medCorr.data.medication_days_count} days`}
                    accent={colors.success.soft}
                  />
                  <CompareCard
                    icon="remove-circle"
                    iconColor={colors.ink.tertiary}
                    label="Without"
                    value={medCorr.data.no_medication_days_avg_pain}
                    sub={`${medCorr.data.no_medication_days_count} days`}
                    accent={colors.surface.muted}
                  />
                </View>
              </SectionCard>
            ) : null}

            {/* ───── Mobility trend ───── */}
            {mobilityTrend.data && mobilityTrend.data.length >= 2 ? (
              <SectionCard icon="resize-outline" title="Jaw Mobility Trend">
                <MiniLineChart
                  data={mobilityTrend.data.map((p) => ({ label: p.date.slice(5), value: p.avg_mm }))}
                  yLabel="Jaw opening (mm)"
                  height={140}
                  color={colors.success.base}
                />
                <View style={styles.mobilityStats}>
                  <View style={styles.mobilityStat}>
                    <Text style={styles.mobilityStatValue}>{mobilityTrend.data[mobilityTrend.data.length - 1]!.avg_mm}mm</Text>
                    <Text style={styles.mobilityStatLabel}>Latest</Text>
                  </View>
                  <View style={styles.mobilityStat}>
                    <Text style={styles.mobilityStatValue}>
                      {Math.round(mobilityTrend.data.reduce((s, p) => s + p.avg_mm, 0) / mobilityTrend.data.length)}mm
                    </Text>
                    <Text style={styles.mobilityStatLabel}>Average</Text>
                  </View>
                  <View style={styles.mobilityStat}>
                    <Text style={styles.mobilityStatValue}>
                      {Math.max(...mobilityTrend.data.map((p) => p.avg_mm))}mm
                    </Text>
                    <Text style={styles.mobilityStatLabel}>Best</Text>
                  </View>
                </View>
              </SectionCard>
            ) : null}

            {/* ───── Sleep correlation ───── */}
            {sleepCorr.data && sleepCorr.data.length > 0 ? (
              <SectionCard icon="moon-outline" title="Sleep Quality \u2194 Pain">
                {sleepCorr.data.map((b) => {
                  const tone = b.quality === 'good' ? colors.success : b.quality === 'fair' ? colors.warning : colors.danger;
                  return (
                    <View key={b.quality} style={[styles.sleepRow, { backgroundColor: tone.soft }]}>
                      <View style={[styles.sleepDot, { backgroundColor: tone.base }]} />
                      <Text style={[styles.sleepLabel, { color: tone.strong }]}>{b.quality} sleep</Text>
                      <Text style={styles.sleepValue}>{b.avg_pain} avg pain</Text>
                      <Text style={styles.sleepDays}>{b.days}d</Text>
                    </View>
                  );
                })}
              </SectionCard>
            ) : null}
          </>
        ) : null}
      </ScrollView>
    </SafeAreaView>
  );
}

// ─── Sub-components ────────────────────────────────────────────────────────

function SectionCard({ icon, title, children }: { icon: keyof typeof Ionicons.glyphMap; title: string; children: React.ReactNode }) {
  return (
    <View style={styles.card}>
      <View style={styles.cardHeader}>
        <View style={styles.cardIconWrap}>
          <Ionicons name={icon} size={16} color={colors.navy.standard} />
        </View>
        <Text style={styles.cardTitle}>{title}</Text>
      </View>
      {children}
    </View>
  );
}

function CompareCard({ icon, iconColor, label, value, sub, accent }: {
  icon: keyof typeof Ionicons.glyphMap;
  iconColor: string;
  label: string;
  value: number;
  sub: string;
  accent: string;
}) {
  return (
    <View style={[styles.compareCard, { backgroundColor: accent }]}>
      <Ionicons name={icon} size={22} color={iconColor} />
      <Text style={styles.compareValue}>{value}</Text>
      <Text style={styles.compareLabel}>{label}</Text>
      <Text style={styles.compareSub}>{sub}</Text>
    </View>
  );
}

function EmptyHint({ text }: { text: string }) {
  return (
    <View style={styles.emptyHint}>
      <Ionicons name="information-circle-outline" size={18} color={colors.ink.tertiary} />
      <Text style={styles.emptyHintText}>{text}</Text>
    </View>
  );
}

// ─── Styles ────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.surface.background },
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: spacing.lg, paddingVertical: spacing.md,
  },
  headerTitle: { ...typography.h2, color: colors.ink.primary },

  // ─── Tab bar ──────
  tabBar: {
    flexDirection: 'row',
    marginHorizontal: spacing.lg,
    marginBottom: spacing.md,
    backgroundColor: colors.surface.muted,
    borderRadius: radius.md,
    padding: 3,
  },
  tab: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: radius.md - 2,
    alignItems: 'center',
  },
  tabActive: {
    backgroundColor: colors.navy.standard,
    shadowColor: colors.navy.deep,
    shadowOpacity: 0.15,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 2 },
    elevation: 2,
  },
  tabText: { ...typography.label, color: colors.ink.secondary, fontWeight: '600' },
  tabTextActive: { color: '#fff' },

  content: { paddingHorizontal: spacing.lg, paddingBottom: spacing.xxxl, gap: spacing.md },

  // ─── Hero card ──────
  heroCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.navy.standard,
    borderRadius: radius.xl,
    padding: spacing.xl,
    gap: spacing.lg,
  },
  heroLeft: { flexDirection: 'row', alignItems: 'baseline' },
  heroAvg: { fontSize: 48, fontWeight: '800', color: '#fff' },
  heroAvgUnit: { fontSize: 18, fontWeight: '500', color: 'rgba(255,255,255,0.6)', marginLeft: 4 },
  heroRight: { flex: 1, gap: spacing.sm },
  heroStatRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  heroTrend: { ...typography.label, fontWeight: '700' },
  heroMeta: { flexDirection: 'row', gap: spacing.md },
  heroMetaItem: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  heroMetaText: { ...typography.tiny, color: 'rgba(255,255,255,0.7)' },

  // ─── Section card ──────
  card: {
    backgroundColor: colors.surface.card,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.surface.border,
    padding: spacing.lg,
  },
  cardHeader: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, marginBottom: spacing.md },
  cardIconWrap: {
    width: 28, height: 28, borderRadius: 14,
    backgroundColor: colors.navy.ghost,
    alignItems: 'center', justifyContent: 'center',
  },
  cardTitle: { ...typography.bodyStrong, color: colors.ink.primary, flex: 1 },

  // ─── Insight text ──────
  insightText: { ...typography.body, color: colors.ink.secondary, marginBottom: spacing.md, lineHeight: 22 },
  insightCaption: { ...typography.caption, color: colors.ink.tertiary, textAlign: 'center', marginTop: spacing.sm },

  // ─── Compare cards ──────
  compareRow: { flexDirection: 'row', gap: spacing.md },
  compareCard: {
    flex: 1, alignItems: 'center', padding: spacing.md,
    borderRadius: radius.lg, gap: 4,
  },
  compareValue: { fontSize: 32, fontWeight: '800', color: colors.ink.primary },
  compareLabel: { ...typography.label, color: colors.ink.secondary },
  compareSub: { ...typography.tiny, color: colors.ink.tertiary },

  // ─── Trigger rows ──────
  triggerRow: {
    flexDirection: 'row', alignItems: 'center', gap: spacing.sm,
    paddingVertical: 8,
  },
  triggerRank: {
    width: 22, height: 22, borderRadius: 11,
    backgroundColor: colors.navy.ghost,
    alignItems: 'center', justifyContent: 'center',
  },
  triggerRankText: { fontSize: 11, fontWeight: '700', color: colors.navy.deep },
  triggerLabel: { ...typography.body, color: colors.ink.primary, width: 90 },
  triggerBarWrap: { flex: 1, height: 6, borderRadius: 3, backgroundColor: colors.surface.muted },
  triggerBarFill: { height: 6, borderRadius: 3, backgroundColor: colors.gold.standard },
  triggerCount: { ...typography.caption, color: colors.ink.secondary, width: 32, textAlign: 'right' },

  // ─── Pain type chips ──────
  typeChips: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  typeChip: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    paddingHorizontal: spacing.md, paddingVertical: 8,
    borderRadius: radius.pill, backgroundColor: colors.navy.ghost,
  },
  typeChipCount: { ...typography.label, color: colors.navy.deep, fontWeight: '700' },
  typeChipLabel: { ...typography.label, color: colors.navy.deep },

  // ─── Sleep rows ──────
  sleepRow: {
    flexDirection: 'row', alignItems: 'center', gap: spacing.sm,
    paddingHorizontal: spacing.md, paddingVertical: 10,
    borderRadius: radius.md, marginBottom: spacing.xs,
  },
  sleepDot: { width: 8, height: 8, borderRadius: 4 },
  sleepLabel: { ...typography.bodyStrong, flex: 1 },
  sleepValue: { ...typography.body, color: colors.ink.primary },
  sleepDays: { ...typography.caption, color: colors.ink.tertiary, width: 28, textAlign: 'right' },

  // ─── Mobility stats ──────
  mobilityStats: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    marginTop: spacing.md,
    paddingTop: spacing.md,
    borderTopWidth: 1,
    borderTopColor: colors.surface.border,
  },
  mobilityStat: { alignItems: 'center' },
  mobilityStatValue: { fontSize: 20, fontWeight: '800', color: colors.ink.primary },
  mobilityStatLabel: { ...typography.tiny, color: colors.ink.tertiary, marginTop: 2 },

  // ─── Empty hint ──────
  emptyHint: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, padding: spacing.md },
  emptyHintText: { ...typography.body, color: colors.ink.tertiary, flex: 1 },
});
