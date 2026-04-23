import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
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
import { useDisconnectLink } from '../../src/hooks/useLinking';
import { usePatientLinks } from '../../src/hooks/usePatient';
import { colors, radius, spacing, typography } from '../../src/theme/tokens';
import { initials } from '../../src/utils/format';

export default function LinkedProviders() {
  const router = useRouter();
  const links = usePatientLinks();
  const disconnect = useDisconnectLink();

  const confirmDisconnect = (linkId: string, name: string) => {
    Alert.alert(
      `Disconnect Dr. ${name}?`,
      'They\u2019ll no longer receive your reports or be able to assign exercises. You can reconnect with a new invite code anytime.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Disconnect',
          style: 'destructive',
          onPress: () => disconnect.mutate(linkId),
        },
      ],
    );
  };

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <ProfileScreenHeader title="Linked Providers" />
      <ScrollView contentContainerStyle={styles.scroll}>
        {links.isPending ? (
          <ActivityIndicator color={colors.navy.standard} style={{ marginTop: spacing.xxl }} />
        ) : (links.data?.length ?? 0) === 0 ? (
          <View style={styles.empty}>
            <Ionicons name="medical-outline" size={36} color={colors.ink.tertiary} />
            <Text style={styles.emptyText}>
              No providers connected yet. Ask your provider for a 6-character invite code.
            </Text>
          </View>
        ) : (
          links.data!.map((l) => (
            <View key={l.link_id} style={styles.card}>
              <View style={styles.avatar}>
                <Text style={styles.avatarText}>{initials(l.first_name, l.last_name)}</Text>
              </View>
              <View style={styles.body}>
                <Text style={styles.name}>
                  Dr. {l.first_name} {l.last_name}
                </Text>
                <Text style={styles.meta}>
                  Linked {new Date(l.linked_at).toLocaleDateString()}
                </Text>
              </View>
              <Pressable
                onPress={() => confirmDisconnect(l.link_id, `${l.first_name} ${l.last_name}`)}
                style={styles.disconnect}
                hitSlop={6}
              >
                <Text style={styles.disconnectText}>Disconnect</Text>
              </Pressable>
            </View>
          ))
        )}

        <Button
          title="+ Connect Another Provider"
          variant="secondary"
          onPress={() => router.push('/link-provider')}
          style={styles.connectBtn}
        />
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.surface.background },
  scroll: { padding: spacing.lg, paddingBottom: spacing.xl },
  empty: { alignItems: 'center', padding: spacing.xl, gap: spacing.md },
  emptyText: { ...typography.body, color: colors.ink.secondary, textAlign: 'center' },
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
  avatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: colors.navy.standard,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: { color: '#fff', fontWeight: '700' },
  body: { flex: 1 },
  name: { ...typography.bodyStrong, color: colors.ink.primary },
  meta: { ...typography.caption, color: colors.ink.secondary, marginTop: 2 },
  disconnect: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: colors.danger.base,
  },
  disconnectText: { ...typography.label, color: colors.danger.strong },
  connectBtn: { marginTop: spacing.lg },
});
