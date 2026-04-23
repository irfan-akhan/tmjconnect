import { Ionicons } from '@expo/vector-icons';
import * as LocalAuthentication from 'expo-local-authentication';
import * as Notifications from 'expo-notifications';
import { useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { StyleSheet, Switch, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Button } from '../../src/components/Button';
import { registerPushTokenIfGranted } from '../../src/lib/pushRegistration';
import { colors, radius, spacing, typography } from '../../src/theme/tokens';

type PermState = 'unknown' | 'granted' | 'denied' | 'unavailable';

export default function PermissionsScreen() {
  const router = useRouter();
  const [notifState, setNotifState] = useState<PermState>('unknown');
  const [biometricState, setBiometricState] = useState<PermState>('unknown');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    (async () => {
      const notif = await Notifications.getPermissionsAsync();
      setNotifState(notif.granted ? 'granted' : notif.canAskAgain ? 'unknown' : 'denied');

      const available = await LocalAuthentication.hasHardwareAsync();
      if (!available) {
        setBiometricState('unavailable');
      } else {
        const enrolled = await LocalAuthentication.isEnrolledAsync();
        setBiometricState(enrolled ? 'granted' : 'unknown');
      }
    })();
  }, []);

  const onToggleNotif = async (on: boolean) => {
    if (!on) {
      setNotifState('denied');
      return;
    }
    const res = await Notifications.requestPermissionsAsync();
    const granted = !!res.granted;
    setNotifState(granted ? 'granted' : 'denied');
    if (granted) {
      // Fire-and-forget FCM registration — don't block the UI.
      registerPushTokenIfGranted().catch(() => {});
    }
  };

  const onToggleBiometric = async (on: boolean) => {
    if (!on) {
      setBiometricState('denied');
      return;
    }
    const res = await LocalAuthentication.authenticateAsync({
      promptMessage: 'Enable biometric unlock for TMJConnect',
      disableDeviceFallback: false,
    });
    setBiometricState(res.success ? 'granted' : 'denied');
  };

  const onContinue = async () => {
    setSaving(true);
    router.replace('/onboarding/profile-setup');
  };

  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.content}>
        <View style={styles.iconCircle}>
          <Ionicons name="notifications" size={32} color={colors.navy.standard} />
        </View>
        <Text style={styles.title}>Stay on Track</Text>
        <Text style={styles.subtitle}>
          Turn these on so we can help you log consistently and keep your account secure.
        </Text>

        <PermissionRow
          icon="notifications-outline"
          title="Notifications"
          description="Gentle reminders for symptom check-ins and exercises."
          state={notifState}
          onChange={onToggleNotif}
        />

        <PermissionRow
          icon="finger-print-outline"
          title="Biometric Unlock"
          description="Use Face ID or Touch ID to secure your health data."
          state={biometricState}
          onChange={onToggleBiometric}
        />

        <Text style={styles.note}>You can change these anytime in your profile settings.</Text>
      </View>

      <View style={styles.footer}>
        <Button title="Continue" onPress={onContinue} loading={saving} />
      </View>
    </SafeAreaView>
  );
}

function PermissionRow({
  icon,
  title,
  description,
  state,
  onChange,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  title: string;
  description: string;
  state: PermState;
  onChange: (on: boolean) => void;
}) {
  const unavailable = state === 'unavailable';
  const on = state === 'granted';
  return (
    <View style={styles.row}>
      <View style={styles.rowIcon}>
        <Ionicons name={icon} size={22} color={colors.navy.standard} />
      </View>
      <View style={styles.flex1}>
        <Text style={styles.rowTitle}>{title}</Text>
        <Text style={styles.rowDesc}>{unavailable ? 'Not available on this device' : description}</Text>
      </View>
      <Switch
        value={on}
        onValueChange={onChange}
        disabled={unavailable}
        trackColor={{ false: colors.surface.border, true: colors.navy.standard }}
        thumbColor="#fff"
      />
    </View>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.surface.background },
  content: { flex: 1, padding: spacing.xl },
  iconCircle: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: colors.navy.ghost,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.lg,
    alignSelf: 'center',
  },
  title: { ...typography.h1, color: colors.ink.primary, textAlign: 'center', marginBottom: spacing.sm },
  subtitle: { ...typography.body, color: colors.ink.secondary, textAlign: 'center', marginBottom: spacing.xl },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    padding: spacing.lg,
    backgroundColor: colors.surface.card,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.surface.border,
    marginBottom: spacing.md,
  },
  rowIcon: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: colors.navy.ghost,
    alignItems: 'center',
    justifyContent: 'center',
  },
  rowTitle: { ...typography.bodyStrong, color: colors.ink.primary },
  rowDesc: { ...typography.caption, color: colors.ink.secondary, marginTop: 2 },
  flex1: { flex: 1 },
  note: {
    ...typography.caption,
    color: colors.ink.tertiary,
    textAlign: 'center',
    marginTop: spacing.xl,
  },
  footer: { padding: spacing.xl, borderTopWidth: 1, borderTopColor: colors.surface.border },
});
