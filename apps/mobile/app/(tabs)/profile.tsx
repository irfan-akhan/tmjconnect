import { useRouter } from 'expo-router';
import { Image, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Button } from '../../src/components/Button';
import { SettingsRow, SettingsSection } from '../../src/components/SettingsRow';
import { useAuth } from '../../src/context/AuthContext';
import { useMe, usePatientLinks } from '../../src/hooks/usePatient';
import { colors, radius, spacing, typography } from '../../src/theme/tokens';
import { initials } from '../../src/utils/format';

export default function ProfileTab() {
  const router = useRouter();
  const me = useMe();
  const links = usePatientLinks();
  const { signOut } = useAuth();

  const providerCount = links.data?.length ?? 0;

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.profileCard}>
          {me.data?.avatar_url ? (
            <Image source={{ uri: me.data.avatar_url }} style={styles.avatar} accessibilityLabel="Profile picture" />
          ) : (
            <View style={[styles.avatar, styles.avatarFallback]}>
              <Text style={styles.avatarInitials}>
                {me.data ? initials(me.data.first_name, me.data.last_name) : '··'}
              </Text>
            </View>
          )}
          <Text style={styles.name}>
            {me.data ? `${me.data.first_name} ${me.data.last_name}` : ' '}
          </Text>
          <Text style={styles.email}>{me.data?.email ?? ' '}</Text>
        </View>

        <SettingsSection title="Account">
          <SettingsRow icon="person-outline" title="Edit Profile" onPress={() => router.push('/profile/edit')} />
          <SettingsRow icon="lock-closed-outline" title="Change Password" onPress={() => router.push('/profile/change-password')} />
          <SettingsRow
            icon="medical-outline"
            title="Linked Providers"
            subtitle={providerCount === 0 ? 'No providers connected' : `${providerCount} connected`}
            onPress={() => router.push('/profile/linked-providers')}
          />
          <SettingsRow icon="phone-portrait-outline" title="Active Sessions" onPress={() => router.push('/profile/sessions')} />
          <SettingsRow icon="time-outline" title="Account Activity" onPress={() => router.push('/profile/activity')} />
        </SettingsSection>

        <SettingsSection title="Preferences">
          <SettingsRow icon="notifications-outline" title="Notification Settings" onPress={() => router.push('/profile/notifications')} />
          <SettingsRow icon="alarm-outline" title="Reminders" onPress={() => router.push('/profile/reminders')} />
          <SettingsRow icon="shield-checkmark-outline" title="Two-Factor Auth" onPress={() => router.push('/profile/mfa')} />
          <SettingsRow icon="help-circle-outline" title="Help & Support" onPress={() => router.push('/profile/help')} />
        </SettingsSection>

        <SettingsSection title="Danger zone">
          <SettingsRow icon="trash-outline" title="Delete Account" destructive onPress={() => router.push('/profile/delete-account')} />
        </SettingsSection>

        <Button title="Sign Out" variant="secondary" onPress={signOut} style={styles.signOut} />

        <Text style={styles.version}>TMJConnect · v0.1.0</Text>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.surface.muted },
  content: { padding: spacing.lg, paddingBottom: spacing.xxxl },
  profileCard: {
    backgroundColor: colors.surface.card,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.surface.border,
    padding: spacing.xl,
    alignItems: 'center',
    marginBottom: spacing.lg,
  },
  avatar: { width: 96, height: 96, borderRadius: 48, marginBottom: spacing.md },
  avatarFallback: {
    backgroundColor: colors.navy.standard,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarInitials: { fontSize: 32, fontWeight: '700', color: '#fff' },
  name: { ...typography.h2, color: colors.ink.primary },
  email: { ...typography.body, color: colors.ink.secondary, marginTop: 2 },
  signOut: { marginTop: spacing.md },
  version: {
    ...typography.caption,
    color: colors.ink.tertiary,
    textAlign: 'center',
    marginTop: spacing.lg,
  },
});
