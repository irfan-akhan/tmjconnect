import { ActivityIndicator, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ProfileScreenHeader } from '../../src/components/ProfileScreenHeader';
import { SettingsRow, SettingsSection } from '../../src/components/SettingsRow';
import { useNotificationPrefs, useUpdateNotificationPrefs } from '../../src/hooks/useProfile';
import type { NotificationPrefs } from '../../src/lib/patient.api';
import { colors, spacing, typography } from '../../src/theme/tokens';

export default function NotificationSettings() {
  const prefs = useNotificationPrefs();
  const update = useUpdateNotificationPrefs();

  const toggle = (key: keyof NotificationPrefs) => (value: boolean) => {
    update.mutate({ [key]: value } as Partial<NotificationPrefs>);
  };

  if (prefs.isPending || !prefs.data) {
    return (
      <SafeAreaView style={styles.safe} edges={['top']}>
        <ProfileScreenHeader title="Notifications" />
        <View style={styles.loading}>
          <ActivityIndicator color={colors.navy.standard} />
        </View>
      </SafeAreaView>
    );
  }

  const p = prefs.data;

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <ProfileScreenHeader title="Notifications" />
      <ScrollView contentContainerStyle={styles.scroll}>
        <Text style={styles.helper}>
          Push and email notifications you receive from TMJConnect.
        </Text>

        <SettingsSection title="Reminders">
          <SettingsRow
            icon="fitness-outline"
            title="Exercise Reminders"
            subtitle="Gentle nudges for your daily exercises"
            toggle={{ value: p.exercise_reminders, onChange: toggle('exercise_reminders') }}
          />
          <SettingsRow
            icon="pulse-outline"
            title="Symptom Check-in"
            subtitle="Ping when it\u2019s time to log how you feel"
            toggle={{ value: p.symptom_checkin, onChange: toggle('symptom_checkin') }}
          />
        </SettingsSection>

        <SettingsSection title="From your care team">
          <SettingsRow
            icon="chatbubble-ellipses-outline"
            title="Provider Messages"
            subtitle="When your provider responds"
            toggle={{ value: p.provider_messages, onChange: toggle('provider_messages') }}
          />
          <SettingsRow
            icon="document-text-outline"
            title="Report Updates"
            subtitle="Status changes on your reports"
            toggle={{ value: p.report_updates, onChange: toggle('report_updates') }}
          />
        </SettingsSection>

        <SettingsSection title="Marketing">
          <SettingsRow
            icon="bulb-outline"
            title="Tips & Updates"
            subtitle="Occasional wellness tips and product news"
            toggle={{ value: p.tips_updates, onChange: toggle('tips_updates') }}
          />
        </SettingsSection>

        <Text style={styles.footnote}>
          Digest delivery: {p.email_digest === 'instant' ? 'Immediate email' : p.email_digest}
        </Text>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.surface.muted },
  scroll: { padding: spacing.lg, paddingBottom: spacing.xl },
  loading: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  helper: { ...typography.body, color: colors.ink.secondary, marginBottom: spacing.lg },
  footnote: { ...typography.caption, color: colors.ink.tertiary, marginTop: spacing.md, textAlign: 'center' },
});
