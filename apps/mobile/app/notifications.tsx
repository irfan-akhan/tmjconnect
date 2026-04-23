import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useMemo } from 'react';
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
import { ProfileScreenHeader } from '../src/components/ProfileScreenHeader';
import { useMarkAllRead, useMarkRead, useNotificationsInbox } from '../src/hooks/useNotificationsInbox';
import type { NotificationItem } from '../src/lib/patient.api';
import { colors, radius, spacing, typography } from '../src/theme/tokens';
import { formatRelative } from '../src/utils/format';

export default function NotificationsInbox() {
  const router = useRouter();
  const q = useNotificationsInbox(20);
  const markRead = useMarkRead();
  const markAll = useMarkAllRead();

  const items = useMemo(() => q.data?.pages.flatMap((p) => p.data) ?? [], [q.data]);
  const unread = items.filter((n) => !n.read).length;

  const onItemPress = (n: NotificationItem) => {
    if (!n.read) markRead.mutate(n.id);
    const d = (n.data ?? {}) as { type?: string; reportId?: string; assignmentId?: string };
    if (d.type === 'exercise' && d.assignmentId) router.push(`/exercise/${d.assignmentId}`);
    else if (d.type === 'report' && d.reportId) router.push(`/report/${d.reportId}`);
    else if (d.type === 'symptom') router.push('/symptom-log');
  };

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <ProfileScreenHeader
        title="Notifications"
        right={
          unread > 0 ? (
            <Pressable onPress={() => markAll.mutate()} hitSlop={6}>
              <Text style={styles.headerAction}>Mark all</Text>
            </Pressable>
          ) : null
        }
      />
      <FlatList
        data={items}
        keyExtractor={(n) => n.id}
        renderItem={({ item }) => <Row item={item} onPress={() => onItemPress(item)} />}
        ItemSeparatorComponent={() => <View style={styles.sep} />}
        contentContainerStyle={styles.list}
        ListEmptyComponent={
          q.isPending ? (
            <ActivityIndicator color={colors.navy.standard} style={{ marginTop: spacing.xxl }} />
          ) : (
            <View style={styles.empty}>
              <Ionicons name="notifications-off-outline" size={36} color={colors.ink.tertiary} />
              <Text style={styles.emptyText}>You're all caught up!</Text>
            </View>
          )
        }
        ListFooterComponent={
          q.isFetchingNextPage ? (
            <View style={{ paddingVertical: spacing.lg }}>
              <ActivityIndicator color={colors.navy.standard} />
            </View>
          ) : null
        }
        onEndReached={() => {
          if (q.hasNextPage && !q.isFetchingNextPage) q.fetchNextPage();
        }}
        onEndReachedThreshold={0.5}
        refreshControl={<RefreshControl refreshing={q.isRefetching} onRefresh={() => q.refetch()} />}
      />
    </SafeAreaView>
  );
}

function Row({ item, onPress }: { item: NotificationItem; onPress: () => void }) {
  const icon = iconFor(item.type);
  return (
    <Pressable style={[styles.row, !item.read && styles.rowUnread]} onPress={onPress}>
      <View style={[styles.icon, { backgroundColor: icon.bg }]}>
        <Ionicons name={icon.name} size={18} color={icon.tint} />
      </View>
      <View style={styles.body}>
        <View style={styles.rowHeader}>
          <Text style={[styles.title, !item.read && styles.titleUnread]} numberOfLines={1}>
            {item.title}
          </Text>
          {!item.read ? <View style={styles.unreadDot} /> : null}
        </View>
        <Text style={styles.bodyText} numberOfLines={2}>{item.body}</Text>
        <Text style={styles.time}>{formatRelative(item.created_at)}</Text>
      </View>
    </Pressable>
  );
}

function iconFor(type: string): { name: keyof typeof Ionicons.glyphMap; bg: string; tint: string } {
  if (type.includes('exercise')) return { name: 'fitness-outline', bg: colors.navy.ghost, tint: colors.navy.standard };
  if (type.includes('symptom')) return { name: 'pulse-outline', bg: colors.warning.soft, tint: colors.warning.strong };
  if (type.includes('report') || type.includes('response')) return { name: 'document-text-outline', bg: colors.success.soft, tint: colors.success.strong };
  if (type.includes('urgent') || type.includes('emergency')) return { name: 'warning-outline', bg: colors.danger.soft, tint: colors.danger.strong };
  return { name: 'notifications-outline', bg: colors.surface.muted, tint: colors.ink.secondary };
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.surface.background },
  headerAction: { ...typography.label, color: colors.navy.standard },
  list: { padding: spacing.md, paddingBottom: spacing.xl, flexGrow: 1 },
  sep: { height: spacing.sm },
  row: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.md,
    padding: spacing.md,
    backgroundColor: colors.surface.card,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.surface.border,
  },
  rowUnread: { borderColor: colors.navy.standard, backgroundColor: colors.navy.ghost },
  icon: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  body: { flex: 1 },
  rowHeader: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs },
  title: { ...typography.bodyStrong, color: colors.ink.primary, flex: 1 },
  titleUnread: { color: colors.navy.deep },
  unreadDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: colors.gold.standard },
  bodyText: { ...typography.caption, color: colors.ink.secondary, marginTop: 2 },
  time: { ...typography.tiny, color: colors.ink.tertiary, marginTop: spacing.xs },
  empty: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: spacing.md, paddingVertical: spacing.xxl },
  emptyText: { ...typography.body, color: colors.ink.secondary },
});
