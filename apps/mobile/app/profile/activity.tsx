import { Ionicons } from '@expo/vector-icons';
import { ActivityIndicator, FlatList, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ProfileScreenHeader } from '../../src/components/ProfileScreenHeader';
import { useActivity } from '../../src/hooks/useProfile';
import type { PatientActivity } from '../../src/lib/patient.api';
import { colors, radius, spacing, typography } from '../../src/theme/tokens';

export default function ActivityScreen() {
  const activity = useActivity();

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <ProfileScreenHeader title="Account Activity" />
      <FlatList
        data={activity.data ?? []}
        keyExtractor={(a) => a.id}
        contentContainerStyle={styles.list}
        renderItem={({ item }) => <Row item={item} />}
        ItemSeparatorComponent={() => <View style={{ height: 1, backgroundColor: colors.surface.border, marginLeft: 56 }} />}
        ListEmptyComponent={
          activity.isPending ? (
            <ActivityIndicator color={colors.navy.standard} style={{ marginTop: spacing.xxl }} />
          ) : (
            <View style={styles.empty}>
              <Text style={styles.emptyText}>No account activity yet.</Text>
            </View>
          )
        }
      />
    </SafeAreaView>
  );
}

function Row({ item }: { item: PatientActivity }) {
  const m = describe(item.action);
  return (
    <View style={styles.row}>
      <View style={[styles.icon, { backgroundColor: m.bg }]}>
        <Ionicons name={m.icon} size={18} color={m.tint} />
      </View>
      <View style={styles.body}>
        <Text style={styles.title}>{m.title}</Text>
        <Text style={styles.meta}>
          {friendlyDate(item.created_at)}
          {item.user_agent ? ` · ${shortUA(item.user_agent)}` : ''}
          {item.ip_address ? ` · ${item.ip_address}` : ''}
        </Text>
      </View>
    </View>
  );
}

function describe(action: string): { title: string; icon: keyof typeof import('@expo/vector-icons').Ionicons.glyphMap; bg: string; tint: string } {
  if (action.startsWith('auth.patient_registered')) return { title: 'Account created', icon: 'person-add-outline', bg: colors.navy.ghost, tint: colors.navy.standard };
  if (action === 'auth.login' || action.endsWith('.login')) return { title: 'Successful login', icon: 'checkmark-circle-outline', bg: colors.success.soft, tint: colors.success.strong };
  if (action.endsWith('login.failed')) return { title: 'Failed login attempt', icon: 'close-circle-outline', bg: colors.danger.soft, tint: colors.danger.strong };
  if (action === 'auth.logout' || action === 'auth.logout_all') return { title: 'Signed out', icon: 'log-out-outline', bg: colors.surface.muted, tint: colors.ink.secondary };
  if (action === 'auth.change_password') return { title: 'Password changed', icon: 'key-outline', bg: colors.warning.soft, tint: colors.warning.strong };
  if (action === 'auth.password_reset') return { title: 'Password reset', icon: 'refresh-circle-outline', bg: colors.warning.soft, tint: colors.warning.strong };
  if (action === 'auth.verify_email') return { title: 'Email verified', icon: 'mail-open-outline', bg: colors.success.soft, tint: colors.success.strong };
  if (action === 'profile_updated') return { title: 'Profile updated', icon: 'create-outline', bg: colors.navy.ghost, tint: colors.navy.standard };
  if (action === 'linking_code_accepted') return { title: 'Provider linked', icon: 'link-outline', bg: colors.success.soft, tint: colors.success.strong };
  if (action === 'link_disconnected') return { title: 'Provider disconnected', icon: 'unlink-outline', bg: colors.surface.muted, tint: colors.ink.secondary };
  if (action === 'report_submitted') return { title: 'Report submitted', icon: 'document-text-outline', bg: colors.navy.ghost, tint: colors.navy.standard };
  if (action === 'session_revoked') return { title: 'Session revoked', icon: 'shield-checkmark-outline', bg: colors.warning.soft, tint: colors.warning.strong };
  return { title: action.replace(/[._]/g, ' '), icon: 'ellipse-outline', bg: colors.surface.muted, tint: colors.ink.secondary };
}

function friendlyDate(iso: string): string {
  const d = new Date(iso);
  return `${d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })} · ${d.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' })}`;
}

function shortUA(ua: string): string {
  if (/TMJConnect/i.test(ua)) return 'Mobile app';
  if (/curl/i.test(ua)) return 'curl';
  if (/Mozilla/i.test(ua)) return 'Browser';
  return ua.slice(0, 20);
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.surface.background },
  list: { padding: spacing.lg, paddingBottom: spacing.xl },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingVertical: spacing.md,
  },
  icon: {
    width: 40,
    height: 40,
    borderRadius: radius.sm,
    alignItems: 'center',
    justifyContent: 'center',
  },
  body: { flex: 1 },
  title: { ...typography.bodyStrong, color: colors.ink.primary },
  meta: { ...typography.caption, color: colors.ink.secondary, marginTop: 2 },
  empty: { padding: spacing.xl, alignItems: 'center' },
  emptyText: { ...typography.body, color: colors.ink.secondary },
});
