import { Ionicons } from '@expo/vector-icons';
import * as Application from 'expo-application';
import { useEffect, useMemo, useState } from 'react';
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
import { Button } from '../../src/components/Button';
import { ProfileScreenHeader } from '../../src/components/ProfileScreenHeader';
import { useRevokeSession, useSessions } from '../../src/hooks/useProfile';
import { api } from '../../src/lib/api';
import { colors, radius, spacing, typography } from '../../src/theme/tokens';
import { formatRelative } from '../../src/utils/format';

/**
 * Shows current + other sessions. The API doesn't flag which row is the
 * current device, so we use "most recent last_active" as a heuristic — good
 * enough since this device just made the request.
 */
export default function SessionsScreen() {
  const sessions = useSessions();
  const revoke = useRevokeSession();
  const [loggingOutAll, setLoggingOutAll] = useState(false);

  const current = useMemo(() => {
    if (!sessions.data?.length) return null;
    return [...sessions.data].sort(
      (a, b) => new Date(b.last_active).getTime() - new Date(a.last_active).getTime(),
    )[0];
  }, [sessions.data]);

  const others = useMemo(
    () => (sessions.data ?? []).filter((s) => s.id !== current?.id),
    [sessions.data, current],
  );

  useEffect(() => {
    // No-op: just forcing expo-application to be imported so its native
    // info is available without warnings.
    void Application.applicationId;
  }, []);

  const confirmRevoke = (id: string) => {
    Alert.alert('Sign out this session?', 'That device will be signed out immediately.', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Sign out', style: 'destructive', onPress: () => revoke.mutate(id) },
    ]);
  };

  const onLogoutAll = () => {
    Alert.alert(
      'Log out of all other sessions?',
      'You\u2019ll stay signed in here. All other devices will be signed out.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Log out',
          style: 'destructive',
          onPress: async () => {
            setLoggingOutAll(true);
            try {
              await api.delete('/auth/logout-all');
              sessions.refetch();
            } finally {
              setLoggingOutAll(false);
            }
          },
        },
      ],
    );
  };

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <ProfileScreenHeader title="Active Sessions" />
      <ScrollView contentContainerStyle={styles.scroll}>
        {sessions.isPending ? (
          <ActivityIndicator color={colors.navy.standard} />
        ) : (
          <>
            {current ? (
              <View style={styles.sectionWrap}>
                <Text style={styles.sectionTitle}>This Device</Text>
                <SessionCard session={current} isCurrent />
              </View>
            ) : null}

            <View style={styles.sectionWrap}>
              <Text style={styles.sectionTitle}>Other Sessions</Text>
              {others.length === 0 ? (
                <View style={styles.empty}>
                  <Text style={styles.emptyText}>No other sessions. You\u2019re only signed in here.</Text>
                </View>
              ) : (
                others.map((s) => (
                  <SessionCard key={s.id} session={s} onRevoke={() => confirmRevoke(s.id)} />
                ))
              )}
            </View>

            {others.length > 0 ? (
              <Button
                title="Log Out All Other Sessions"
                variant="danger"
                onPress={onLogoutAll}
                loading={loggingOutAll}
                style={styles.logoutAll}
              />
            ) : null}
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

function SessionCard({
  session,
  isCurrent,
  onRevoke,
}: {
  session: { id: string; device_info: string | null; ip_address: string | null; last_active: string };
  isCurrent?: boolean;
  onRevoke?: () => void;
}) {
  const device = friendlyDevice(session.device_info);
  return (
    <View style={styles.card}>
      <View style={styles.deviceIcon}>
        <Ionicons name={device.icon} size={20} color={colors.navy.standard} />
      </View>
      <View style={styles.flex1}>
        <View style={styles.rowTop}>
          <Text style={styles.deviceName}>{device.name}</Text>
          {isCurrent ? (
            <View style={styles.currentPill}>
              <Text style={styles.currentText}>This device</Text>
            </View>
          ) : null}
        </View>
        <Text style={styles.deviceMeta}>
          {session.ip_address ?? 'Unknown IP'} · {formatRelative(session.last_active)}
        </Text>
      </View>
      {onRevoke ? (
        <Pressable onPress={onRevoke} hitSlop={6} style={styles.revoke}>
          <Text style={styles.revokeText}>Sign out</Text>
        </Pressable>
      ) : null}
    </View>
  );
}

function friendlyDevice(ua: string | null): { name: string; icon: 'phone-portrait-outline' | 'laptop-outline' | 'globe-outline' } {
  if (!ua) return { name: 'Unknown device', icon: 'globe-outline' };
  if (/TMJConnect.*CFNetwork/i.test(ua) || /iPhone|iOS/i.test(ua)) return { name: 'TMJConnect — iOS', icon: 'phone-portrait-outline' };
  if (/Android/i.test(ua)) return { name: 'TMJConnect — Android', icon: 'phone-portrait-outline' };
  if (/curl/i.test(ua)) return { name: 'Terminal (curl)', icon: 'laptop-outline' };
  if (/Mozilla/i.test(ua)) return { name: 'Web browser', icon: 'laptop-outline' };
  return { name: ua.slice(0, 40), icon: 'globe-outline' };
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.surface.background },
  scroll: { padding: spacing.lg, paddingBottom: spacing.xl },
  sectionWrap: { marginBottom: spacing.lg },
  sectionTitle: {
    ...typography.caption,
    color: colors.ink.tertiary,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: spacing.sm,
  },
  card: {
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
  deviceIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: colors.navy.ghost,
    alignItems: 'center',
    justifyContent: 'center',
  },
  flex1: { flex: 1 },
  rowTop: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  deviceName: { ...typography.bodyStrong, color: colors.ink.primary },
  deviceMeta: { ...typography.caption, color: colors.ink.secondary, marginTop: 2 },
  currentPill: {
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
    borderRadius: radius.pill,
    backgroundColor: colors.success.soft,
  },
  currentText: { ...typography.tiny, color: colors.success.strong, fontWeight: '700' },
  revoke: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: colors.danger.base,
  },
  revokeText: { ...typography.label, color: colors.danger.strong },
  empty: { padding: spacing.md },
  emptyText: { ...typography.body, color: colors.ink.secondary },
  logoutAll: { marginTop: spacing.md },
});
