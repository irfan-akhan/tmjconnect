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
import { useAssignments } from '../../src/hooks/usePatient';
import type { ExerciseAssignment } from '../../src/lib/patient.api';
import { colors, radius, spacing, typography } from '../../src/theme/tokens';

const FILTERS = ['Active', 'All'] as const;
type Filter = (typeof FILTERS)[number];

export default function ExercisesTab() {
  const router = useRouter();
  const assignments = useAssignments();
  const [filter, setFilter] = useState<Filter>('Active');

  const items = useMemo(() => {
    const all = assignments.data ?? [];
    return filter === 'Active' ? all.filter((a) => a.status === 'active') : all;
  }, [assignments.data, filter]);

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <View style={styles.header}>
        <Text style={styles.title}>My Exercises</Text>
        <Text style={styles.subtitle}>Complete your daily set to stay on track.</Text>

        <View style={styles.filterRow}>
          {FILTERS.map((f) => (
            <Pressable
              key={f}
              onPress={() => setFilter(f)}
              style={[styles.filter, filter === f && styles.filterActive]}
            >
              <Text style={[styles.filterText, filter === f && styles.filterTextActive]}>{f}</Text>
            </Pressable>
          ))}
        </View>
      </View>

      <FlatList
        data={items}
        keyExtractor={(a) => a.assignment_id}
        numColumns={2}
        columnWrapperStyle={styles.col}
        contentContainerStyle={styles.grid}
        renderItem={({ item }) => (
          <ExerciseTile item={item} onPress={() => router.push(`/exercise/${item.assignment_id}`)} />
        )}
        ListEmptyComponent={
          assignments.isPending ? (
            <View style={styles.loading}>
              <ActivityIndicator color={colors.navy.standard} />
            </View>
          ) : (
            <View style={styles.empty}>
              <Ionicons name="fitness-outline" size={36} color={colors.ink.tertiary} />
              <Text style={styles.emptyText}>
                No exercises here yet. Your provider will add some once you&rsquo;re connected.
              </Text>
            </View>
          )
        }
        refreshControl={
          <RefreshControl refreshing={assignments.isRefetching} onRefresh={() => assignments.refetch()} />
        }
      />
    </SafeAreaView>
  );
}

function ExerciseTile({ item, onPress }: { item: ExerciseAssignment; onPress: () => void }) {
  const mins = Math.max(1, Math.round(item.duration_seconds / 60));
  return (
    <Pressable style={styles.tile} onPress={onPress} accessibilityRole="button">
      <View style={styles.tileThumb}>
        <Ionicons name="play-circle" size={36} color="#fff" />
        {item.completed_today ? (
          <View style={styles.donePill}>
            <Ionicons name="checkmark" size={12} color="#fff" />
            <Text style={styles.donePillText}>Done today</Text>
          </View>
        ) : null}
      </View>
      <View style={styles.tileBody}>
        <View style={styles.tileCategory}>
          <Text style={styles.tileCategoryText}>{item.category}</Text>
        </View>
        <Text style={styles.tileTitle} numberOfLines={2}>
          {item.title}
        </Text>
        <Text style={styles.tileMeta}>
          {item.sets} × {mins} min · {item.frequency}
        </Text>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.surface.background },
  header: { paddingHorizontal: spacing.lg, paddingTop: spacing.lg },
  title: { ...typography.h1, color: colors.ink.primary },
  subtitle: { ...typography.body, color: colors.ink.secondary, marginTop: spacing.xs, marginBottom: spacing.lg },
  filterRow: { flexDirection: 'row', gap: spacing.sm, marginBottom: spacing.md },
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
  grid: { paddingHorizontal: spacing.lg, paddingBottom: spacing.xxxl },
  col: { gap: spacing.md, marginBottom: spacing.md },
  tile: {
    flex: 1,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.surface.border,
    backgroundColor: colors.surface.card,
    overflow: 'hidden',
  },
  tileThumb: {
    aspectRatio: 16 / 10,
    backgroundColor: colors.navy.standard,
    alignItems: 'center',
    justifyContent: 'center',
  },
  donePill: {
    position: 'absolute',
    top: 8,
    right: 8,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: radius.pill,
    backgroundColor: colors.success.base,
  },
  donePillText: { fontSize: 10, fontWeight: '700', color: '#fff', letterSpacing: 0.3 },
  tileBody: { padding: spacing.md },
  tileCategory: {
    alignSelf: 'flex-start',
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
    borderRadius: radius.pill,
    backgroundColor: colors.gold.ghostStrong,
    marginBottom: spacing.xs,
  },
  tileCategoryText: { ...typography.tiny, color: colors.navy.deep, fontWeight: '600' },
  tileTitle: { ...typography.bodyStrong, color: colors.ink.primary },
  tileMeta: { ...typography.caption, color: colors.ink.secondary, marginTop: 2 },
  loading: { paddingVertical: spacing.xxl, alignItems: 'center' },
  empty: { alignItems: 'center', paddingVertical: spacing.xxl, gap: spacing.md, paddingHorizontal: spacing.xl },
  emptyText: { ...typography.body, color: colors.ink.secondary, textAlign: 'center' },
});
