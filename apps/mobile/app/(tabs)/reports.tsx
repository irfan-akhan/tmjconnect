import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useMemo, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Pressable,
  RefreshControl,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Button } from '../../src/components/Button';
import { usePatientLinks } from '../../src/hooks/usePatient';
import { useMyReports } from '../../src/hooks/useReports';
import type { ReportSummary, ReportUrgency } from '../../src/lib/reports.api';
import { colors, radius, spacing, typography } from '../../src/theme/tokens';

const FILTERS: Array<{ label: string; value?: ReportUrgency }> = [
  { label: 'All' },
  { label: 'Routine', value: 'routine' },
  { label: 'Concerning', value: 'concerning' },
  { label: 'Urgent', value: 'urgent' },
];

export default function ReportsTab() {
  const router = useRouter();
  const [filterIdx, setFilterIdx] = useState(0);
  const filter = FILTERS[filterIdx]!;
  const reports = useMyReports(filter.value);
  const links = usePatientLinks();

  const items = useMemo(
    () => reports.data?.pages.flatMap((p) => p.data) ?? [],
    [reports.data],
  );

  const hasLinkedProvider = (links.data?.length ?? 0) > 0;

  const onNew = () => {
    if (!hasLinkedProvider) router.push('/link-provider');
    else router.push('/report-submit');
  };

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <View style={styles.header}>
        <View style={styles.headerRow}>
          <Text style={styles.title}>My Reports</Text>
          <Pressable onPress={() => router.push('/emergency')} style={styles.emergencyBtn} hitSlop={6}>
            <Ionicons name="warning" size={16} color={colors.danger.strong} />
            <Text style={styles.emergencyText}>Emergency</Text>
          </Pressable>
        </View>

        <View style={styles.filterRow}>
          {FILTERS.map((f, i) => (
            <Pressable
              key={f.label}
              onPress={() => setFilterIdx(i)}
              style={[styles.filter, filterIdx === i && styles.filterActive]}
            >
              <Text style={[styles.filterText, filterIdx === i && styles.filterTextActive]}>{f.label}</Text>
            </Pressable>
          ))}
        </View>
      </View>

      <FlatList
        data={items}
        keyExtractor={(r) => r.id}
        contentContainerStyle={styles.list}
        renderItem={({ item }) => <ReportRow r={item} onPress={() => router.push(`/report/${item.id}`)} />}
        ItemSeparatorComponent={() => <View style={{ height: spacing.sm }} />}
        onEndReached={() => {
          if (reports.hasNextPage && !reports.isFetchingNextPage) reports.fetchNextPage();
        }}
        onEndReachedThreshold={0.5}
        ListEmptyComponent={
          reports.isPending ? (
            <View style={styles.loading}>
              <ActivityIndicator color={colors.navy.standard} />
            </View>
          ) : (
            <View style={styles.empty}>
              <Ionicons name="document-text-outline" size={36} color={colors.ink.tertiary} />
              <Text style={styles.emptyText}>No reports yet. Tap the button below to send your first.</Text>
            </View>
          )
        }
        ListFooterComponent={
          reports.isFetchingNextPage ? (
            <View style={styles.footerLoading}>
              <ActivityIndicator color={colors.navy.standard} />
            </View>
          ) : null
        }
        refreshControl={
          <RefreshControl
            refreshing={reports.isRefetching}
            onRefresh={() => {
              reports.refetch();
              links.refetch();
            }}
          />
        }
      />

      <View style={styles.cta}>
        <Button title="New Report" onPress={onNew} />
      </View>
    </SafeAreaView>
  );
}

function ReportRow({ r, onPress }: { r: ReportSummary; onPress: () => void }) {
  const tone = urgencyTone(r.urgency);
  return (
    <Pressable style={styles.row} onPress={onPress} accessibilityRole="button">
      <View style={[styles.urgencyBar, { backgroundColor: tone.border }]} />
      <View style={styles.rowBody}>
        <View style={styles.rowHeader}>
          <View style={[styles.urgencyPill, { backgroundColor: tone.soft }]}>
            <Text style={[styles.urgencyText, { color: tone.strong }]}>{r.urgency}</Text>
          </View>
          <Text style={styles.rowDate}>
            {new Date(r.submitted_at).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}
          </Text>
        </View>
        <Text style={styles.rowPreview} numberOfLines={2}>
          {r.description_preview || 'No description'}
        </Text>
        <View style={styles.rowMeta}>
          <Text style={styles.rowProvider}>Dr. {r.provider_first_name} {r.provider_last_name}</Text>
          {r.response_count > 0 ? (
            <View style={styles.replyBadge}>
              <Ionicons name="chatbubble" size={12} color={colors.navy.standard} />
              <Text style={styles.replyText}>{r.response_count}</Text>
            </View>
          ) : (
            <Text style={[styles.rowStatus, r.status === 'submitted' && styles.rowStatusPending]}>
              {r.status}
            </Text>
          )}
        </View>
      </View>
    </Pressable>
  );
}

function urgencyTone(u: ReportUrgency) {
  if (u === 'urgent') return { soft: colors.danger.soft, strong: colors.danger.strong, border: colors.danger.base };
  if (u === 'concerning') return { soft: colors.warning.soft, strong: colors.warning.strong, border: colors.warning.base };
  return { soft: colors.success.soft, strong: colors.success.strong, border: colors.success.base };
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.surface.background },
  header: { paddingHorizontal: spacing.lg, paddingTop: spacing.lg },
  headerRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  title: { ...typography.h1, color: colors.ink.primary },
  emergencyBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: radius.pill,
    backgroundColor: colors.danger.soft,
  },
  emergencyText: { ...typography.label, color: colors.danger.strong },
  filterRow: { flexDirection: 'row', gap: spacing.sm, marginTop: spacing.md },
  filter: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: colors.surface.border,
  },
  filterActive: { backgroundColor: colors.navy.standard, borderColor: colors.navy.standard },
  filterText: { ...typography.label, color: colors.ink.secondary },
  filterTextActive: { color: '#fff' },
  list: { padding: spacing.lg, paddingBottom: 120 },
  loading: { paddingVertical: spacing.xxl, alignItems: 'center' },
  footerLoading: { paddingVertical: spacing.lg, alignItems: 'center' },
  empty: { alignItems: 'center', paddingVertical: spacing.xxl, gap: spacing.md, paddingHorizontal: spacing.lg },
  emptyText: { ...typography.body, color: colors.ink.secondary, textAlign: 'center' },
  row: {
    flexDirection: 'row',
    backgroundColor: colors.surface.card,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.surface.border,
    overflow: 'hidden',
  },
  urgencyBar: { width: 4 },
  rowBody: { flex: 1, padding: spacing.md },
  rowHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: spacing.xs },
  urgencyPill: { paddingHorizontal: spacing.sm, paddingVertical: 2, borderRadius: radius.pill },
  urgencyText: { ...typography.tiny, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.5 },
  rowDate: { ...typography.caption, color: colors.ink.tertiary },
  rowPreview: { ...typography.body, color: colors.ink.primary, marginBottom: spacing.xs },
  rowMeta: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: spacing.xs },
  rowProvider: { ...typography.caption, color: colors.ink.secondary },
  rowStatus: { ...typography.caption, color: colors.ink.secondary, textTransform: 'capitalize' },
  rowStatusPending: { color: colors.warning.strong },
  replyBadge: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  replyText: { ...typography.caption, color: colors.navy.standard, fontWeight: '600' },
  cta: {
    position: 'absolute',
    left: spacing.lg,
    right: spacing.lg,
    bottom: spacing.lg,
  },
});
