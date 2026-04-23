import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useMemo } from 'react';
import { Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { DailyTip } from '../../src/components/DailyTip';
import { ErrorState } from '../../src/components/ScreenState';
import { Wordmark } from '../../src/components/Wordmark';
import { useDashboard } from '../../src/hooks/usePatient';
import { useMyIntakeAssignments } from '../../src/hooks/useIntakeForms';
import { colors, radius, spacing, typography } from '../../src/theme/tokens';
import { greeting } from '../../src/utils/format';

export default function Dashboard() {
  const router = useRouter();
  const dash = useDashboard();
  const intakeAssignments = useMyIntakeAssignments();
  const d = dash.data;

  const name = d?.profile?.first_name ?? '';
  const todayPain = d?.today_log?.pain_level ?? null;
  const stats = d?.streak ?? { streak: 0, longest: 0 };
  const activeAssignments = useMemo(
    () => (d?.assignments ?? []).filter((a) => a.status === 'active'),
    [d?.assignments],
  );
  const completedToday = activeAssignments.filter((a) => a.completed_today).length;
  const totalToday = activeAssignments.length;
  const unreadCount = d?.unread_count ?? 0;

  const onRefresh = () => dash.refetch();

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <View style={styles.topbar}>
        <Wordmark align="left" />
        <Pressable
          style={styles.bell}
          hitSlop={8}
          onPress={() => router.push('/notifications')}
          accessibilityRole="button"
          accessibilityLabel={`${unreadCount} unread notifications`}
        >
          <Ionicons name="notifications-outline" size={22} color={colors.ink.primary} />
          {unreadCount > 0 ? (
            <View style={styles.badge}>
              <Text style={styles.badgeText}>{unreadCount}</Text>
            </View>
          ) : null}
        </Pressable>
      </View>

      <ScrollView
        contentContainerStyle={styles.content}
        refreshControl={<RefreshControl refreshing={false} onRefresh={onRefresh} />}
      >
        {dash.isError ? (
          <ErrorState message="Could not load your dashboard." onRetry={onRefresh} />
        ) : null}

        <HeroCard
          name={name}
          todayPain={todayPain}
          streak={stats.streak}
          exercisesDone={completedToday}
          exercisesTotal={totalToday}
          onLog={() => router.push('/symptom-log')}
          onExercises={() => router.push('/(tabs)/exercises')}
          onInsights={() => router.push('/insights')}
        />

        <View style={styles.statsRow}>
          <StatTile icon="flame" iconColor={colors.gold.standard} value={stats.streak} label="Day Streak" />
          <StatTile
            icon="checkmark-circle"
            iconColor={colors.success.base}
            value={`${completedToday}/${totalToday || 0}`}
            label="Today's Progress"
          />
          <StatTile icon="trophy" iconColor={colors.navy.standard} value={stats.longest} label="Longest Streak" />
        </View>

        {/* Pending intake forms */}
        {(intakeAssignments.data ?? []).length > 0 ? (
          <View style={styles.intakeBanner}>
            <View style={styles.intakeBannerIcon}>
              <Ionicons name="clipboard-outline" size={20} color={colors.gold.standard} />
            </View>
            <View style={styles.flex1}>
              <Text style={styles.intakeBannerTitle}>
                {intakeAssignments.data!.length === 1 ? 'You have a form to fill out' : `You have ${intakeAssignments.data!.length} forms to fill out`}
              </Text>
              <Text style={styles.intakeBannerSub}>
                From {intakeAssignments.data![0]!.provider_name}
              </Text>
            </View>
            <Pressable
              onPress={() => router.push(`/intake-form?formId=${intakeAssignments.data![0]!.form_id}`)}
              style={styles.intakeBannerBtn}
            >
              <Text style={styles.intakeBannerBtnText}>Open</Text>
              <Ionicons name="chevron-forward" size={14} color={colors.navy.deep} />
            </Pressable>
          </View>
        ) : null}

        <View style={styles.actionsRow}>
          <ActionCard
            icon="pulse"
            label="Log Symptoms"
            onPress={() => router.push('/symptom-log')}
          />
          <ActionCard
            icon="fitness"
            label="Start Exercises"
            onPress={() => router.push('/(tabs)/exercises')}
          />
        </View>

        <View style={styles.actionsRow}>
          <ActionCard
            icon="analytics"
            label="Insights"
            onPress={() => router.push('/insights')}
          />
          <ActionCard
            icon="moon"
            label="Sleep Log"
            onPress={() => router.push('/sleep-log')}
          />
        </View>

        <View style={styles.quickLinks}>
          <QuickLink icon="resize-outline" label="Jaw Mobility" onPress={() => router.push('/jaw-mobility')} />
          <QuickLink icon="medkit-outline" label="Medications" onPress={() => router.push('/medication-log')} />
          <QuickLink icon="document-text-outline" label="PDF Report" onPress={() => router.push('/progress-report')} />
        </View>

        <View style={styles.planCard}>
          <View style={styles.planHeader}>
            <Text style={styles.planTitle}>Today&rsquo;s Plan</Text>
            <Text style={styles.planCount}>{activeAssignments.length} tasks</Text>
          </View>
          {activeAssignments.length === 0 ? (
            <Text style={styles.planEmpty}>No tasks yet — your provider hasn&rsquo;t assigned any exercises.</Text>
          ) : (
            activeAssignments.slice(0, 3).map((a, i) => (
              <Pressable
                key={a.assignment_id}
                onPress={() => router.push(`/exercise/${a.assignment_id}`)}
                style={[styles.planItem, i > 0 && styles.planItemBorder]}
              >
                {a.completed_today ? (
                  <View style={styles.planCheck}>
                    <Ionicons name="checkmark" size={14} color="#fff" />
                  </View>
                ) : (
                  <View style={styles.planDot} />
                )}
                <View style={styles.flex1}>
                  <Text
                    style={[
                      styles.planItemTitle,
                      a.completed_today && styles.planItemTitleDone,
                    ]}
                  >
                    {a.title}
                  </Text>
                  <Text style={styles.planItemMeta}>
                    {a.sets} × {Math.round(a.duration_seconds / 60) || 1} min · {a.frequency}
                  </Text>
                </View>
                <Ionicons name="chevron-forward" size={18} color={colors.ink.tertiary} />
              </Pressable>
            ))
          )}
        </View>

        <DailyTip />
      </ScrollView>
    </SafeAreaView>
  );
}

function HeroCard({
  name,
  todayPain,
  streak,
  exercisesDone,
  exercisesTotal,
  onLog,
  onExercises,
  onInsights,
}: {
  name: string;
  todayPain: number | null;
  streak: number | string;
  exercisesDone: number;
  exercisesTotal: number;
  onLog: () => void;
  onExercises: () => void;
  onInsights: () => void;
}) {
  const logged = todayPain != null;

  if (!logged) {
    return (
      <View style={styles.hero}>
        <Text style={styles.heroGreeting}>
          {greeting()}
          {name ? `, ${name}` : ''}
        </Text>
        <Text style={styles.heroSubtitle}>How are you feeling today?</Text>
        <Pressable style={styles.heroBtn} onPress={onLog} accessibilityRole="button">
          <Text style={styles.heroBtnText}>Start Today's Log</Text>
          <Ionicons name="arrow-forward" size={18} color={colors.navy.deep} />
        </Pressable>
      </View>
    );
  }

  const allExercisesDone = exercisesTotal > 0 && exercisesDone >= exercisesTotal;
  const encouragement =
    todayPain <= 3
      ? 'Great day! Keep up the good work.'
      : todayPain <= 6
        ? 'Hang in there. Your exercises can help.'
        : 'Tough day. Take it easy and follow your plan.';

  return (
    <View style={styles.heroLogged}>
      <View style={styles.heroLoggedTop}>
        <View style={styles.heroLoggedCheck}>
          <Ionicons name="checkmark" size={16} color="#fff" />
        </View>
        <Text style={styles.heroLoggedGreeting}>
          {greeting()}
          {name ? `, ${name}` : ''}
        </Text>
      </View>

      <Text style={styles.heroEncouragement}>{encouragement}</Text>

      <View style={styles.heroChips}>
        <View style={styles.heroChip}>
          <Ionicons name="flame" size={14} color={colors.gold.standard} />
          <Text style={styles.heroChipText}>{streak} day streak</Text>
        </View>
        <View style={styles.heroChip}>
          <Ionicons name="pulse" size={14} color={todayPain <= 3 ? colors.success.base : todayPain <= 6 ? colors.warning.base : colors.danger.base} />
          <Text style={styles.heroChipText}>{todayPain}/10 pain</Text>
        </View>
        {exercisesTotal > 0 ? (
          <View style={styles.heroChip}>
            <Ionicons name={allExercisesDone ? 'checkmark-circle' : 'fitness'} size={14} color={allExercisesDone ? colors.success.base : colors.navy.standard} />
            <Text style={styles.heroChipText}>{exercisesDone}/{exercisesTotal} exercises</Text>
          </View>
        ) : null}
      </View>

      <View style={styles.heroActions}>
        {!allExercisesDone && exercisesTotal > 0 ? (
          <Pressable style={styles.heroActionBtn} onPress={onExercises} accessibilityRole="button">
            <Ionicons name="fitness" size={16} color={colors.navy.deep} />
            <Text style={styles.heroActionText}>Do Exercises</Text>
          </Pressable>
        ) : (
          <Pressable style={styles.heroActionBtn} onPress={onInsights} accessibilityRole="button">
            <Ionicons name="analytics" size={16} color={colors.navy.deep} />
            <Text style={styles.heroActionText}>View Insights</Text>
          </Pressable>
        )}
      </View>
    </View>
  );
}

function StatTile({
  icon,
  iconColor,
  value,
  label,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  iconColor: string;
  value: string | number;
  label: string;
}) {
  return (
    <View style={styles.stat}>
      <Ionicons name={icon} size={20} color={iconColor} />
      <Text style={styles.statValue}>{value}</Text>
      <Text style={styles.statLabel}>{label}</Text>
    </View>
  );
}

function ActionCard({
  icon,
  label,
  onPress,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  onPress: () => void;
}) {
  return (
    <Pressable onPress={onPress} style={styles.action} accessibilityRole="button">
      <View style={styles.actionIcon}>
        <Ionicons name={icon} size={22} color={colors.navy.standard} />
      </View>
      <Text style={styles.actionLabel}>{label}</Text>
      <Ionicons name="arrow-forward" size={16} color={colors.ink.tertiary} style={styles.actionArrow} />
    </Pressable>
  );
}

function QuickLink({ icon, label, onPress }: { icon: keyof typeof Ionicons.glyphMap; label: string; onPress: () => void }) {
  return (
    <Pressable onPress={onPress} style={styles.quickLink} accessibilityRole="button">
      <Ionicons name={icon} size={18} color={colors.navy.standard} />
      <Text style={styles.quickLinkText}>{label}</Text>
      <Ionicons name="chevron-forward" size={16} color={colors.ink.tertiary} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.surface.background },
  topbar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
  },
  bell: {
    width: 40,
    height: 40,
    borderRadius: radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.surface.muted,
  },
  badge: {
    position: 'absolute',
    top: 6,
    right: 6,
    minWidth: 16,
    height: 16,
    paddingHorizontal: 3,
    borderRadius: 8,
    backgroundColor: colors.gold.standard,
    alignItems: 'center',
    justifyContent: 'center',
  },
  badgeText: { fontSize: 10, fontWeight: '700', color: colors.navy.deep },
  content: { padding: spacing.lg, paddingBottom: spacing.xxxl },

  hero: {
    backgroundColor: colors.gold.standard,
    borderRadius: radius.xl,
    padding: spacing.xl,
    marginBottom: spacing.lg,
  },
  heroGreeting: { ...typography.h2, color: colors.navy.deep },
  heroSubtitle: { ...typography.body, color: colors.navy.deep, opacity: 0.75, marginTop: spacing.xs },
  heroLogged: {
    backgroundColor: colors.surface.card,
    borderRadius: radius.xl,
    padding: spacing.xl,
    marginBottom: spacing.lg,
    borderWidth: 1,
    borderColor: colors.surface.border,
  },
  heroLoggedTop: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginBottom: spacing.sm,
  },
  heroLoggedCheck: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: colors.success.base,
    alignItems: 'center',
    justifyContent: 'center',
  },
  heroLoggedGreeting: { ...typography.h3, color: colors.ink.primary, flex: 1 },
  heroEncouragement: { ...typography.body, color: colors.ink.secondary, marginBottom: spacing.md },
  heroChips: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm, marginBottom: spacing.md },
  heroChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: spacing.md,
    paddingVertical: 6,
    borderRadius: radius.pill,
    backgroundColor: colors.surface.muted,
  },
  heroChipText: { ...typography.label, color: colors.ink.primary, fontWeight: '600' },
  heroActions: { flexDirection: 'row', gap: spacing.sm },
  heroActionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    backgroundColor: colors.gold.ghost,
    borderWidth: 1,
    borderColor: colors.gold.ghostStrong,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.lg,
    borderRadius: radius.md,
  },
  heroActionText: { ...typography.label, color: colors.navy.deep, fontWeight: '600' },
  heroBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    backgroundColor: colors.surface.background,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.lg,
    borderRadius: radius.md,
    marginTop: spacing.lg,
  },
  heroBtnText: { ...typography.bodyStrong, color: colors.navy.deep },

  statsRow: { flexDirection: 'row', gap: spacing.sm, marginBottom: spacing.lg },
  stat: {
    flex: 1,
    backgroundColor: colors.surface.card,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.surface.border,
    padding: spacing.md,
    alignItems: 'flex-start',
    gap: spacing.xs,
  },
  statValue: { fontSize: 24, fontWeight: '700', color: colors.ink.primary },
  statLabel: { ...typography.tiny, color: colors.ink.secondary },

  actionsRow: { flexDirection: 'row', gap: spacing.md, marginBottom: spacing.lg },
  action: {
    flex: 1,
    backgroundColor: colors.navy.standard,
    borderRadius: radius.lg,
    padding: spacing.lg,
    minHeight: 120,
    justifyContent: 'space-between',
  },
  actionIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.15)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  actionLabel: { ...typography.bodyStrong, color: '#fff', marginTop: spacing.sm },
  actionArrow: { position: 'absolute', top: spacing.lg, right: spacing.lg, color: '#fff' },

  planCard: {
    backgroundColor: colors.surface.card,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.surface.border,
    padding: spacing.lg,
  },
  planHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.md,
  },
  planTitle: { ...typography.h3, color: colors.ink.primary },
  planCount: { ...typography.caption, color: colors.ink.tertiary },
  planEmpty: { ...typography.body, color: colors.ink.secondary },
  planItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: spacing.md,
  },
  planItemBorder: { borderTopWidth: 1, borderTopColor: colors.surface.border },
  planDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: colors.gold.standard,
    marginRight: spacing.md,
    marginLeft: 6,
  },
  planCheck: {
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: colors.success.base,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: spacing.md,
  },
  planItemTitle: { ...typography.bodyStrong, color: colors.ink.primary },
  planItemTitleDone: { color: colors.ink.tertiary, textDecorationLine: 'line-through' },
  planItemMeta: { ...typography.caption, color: colors.ink.secondary, marginTop: 2 },
  flex1: { flex: 1 },
  quickLinks: {
    backgroundColor: colors.surface.card,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.surface.border,
    overflow: 'hidden',
  },
  quickLink: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.surface.border,
  },
  quickLinkText: { ...typography.body, color: colors.ink.primary, flex: 1 },

  // ─── Intake banner ──────
  intakeBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    backgroundColor: colors.gold.ghost,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.gold.standard + '30',
    padding: spacing.md,
    marginBottom: spacing.xs,
  },
  intakeBannerIcon: {
    width: 40, height: 40, borderRadius: 12,
    backgroundColor: colors.gold.standard + '18',
    alignItems: 'center', justifyContent: 'center',
  },
  intakeBannerTitle: { ...typography.bodyStrong, color: colors.ink.primary },
  intakeBannerSub: { ...typography.caption, color: colors.ink.tertiary, marginTop: 1 },
  intakeBannerBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 2,
    backgroundColor: colors.gold.standard,
    paddingHorizontal: spacing.md, paddingVertical: 8,
    borderRadius: radius.md,
  },
  intakeBannerBtnText: { ...typography.label, color: colors.navy.deep, fontWeight: '700' },
});
