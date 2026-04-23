import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Pressable,
  ScrollView,
  Share,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import QRCode from 'react-native-qrcode-svg';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Button } from '../../src/components/Button';
import { ProfileScreenHeader } from '../../src/components/ProfileScreenHeader';
import { TextField } from '../../src/components/TextField';
import { useAuth } from '../../src/context/AuthContext';
import { useMe } from '../../src/hooks/usePatient';
import { ApiError } from '../../src/lib/api';
import {
  disablePatientMfa,
  initPatientMfa,
  setupMfa,
  verifyMfaSetup,
  type MfaSetupResult,
  type MfaVerifySetupResult,
} from '../../src/lib/mfa.api';
import { colors, radius, spacing, typography } from '../../src/theme/tokens';

type Step = 'idle' | 'qr' | 'verify' | 'codes' | 'disable';

/**
 * Patient MFA setup flow:
 *   idle → init → setup (QR) → verify-setup → show backup codes → done
 *
 * When already-enabled: offers a disable path (requires password confirmation).
 */
export default function MfaSettings() {
  const router = useRouter();
  const me = useMe();
  const { setAuthed } = useAuth();
  const [step, setStep] = useState<Step>('idle');
  const [setupToken, setSetupToken] = useState<string | null>(null);
  const [setupData, setSetupData] = useState<MfaSetupResult | null>(null);
  const [code, setCode] = useState('');
  const [password, setPassword] = useState('');
  const [result, setResult] = useState<MfaVerifySetupResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const enabled = me.data?.mfa_enabled ?? false;

  const onBegin = async () => {
    setError(null);
    setLoading(true);
    try {
      const { setup_token } = await initPatientMfa();
      const data = await setupMfa(setup_token);
      setSetupToken(setup_token);
      setSetupData(data);
      setStep('qr');
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not start MFA setup.');
    } finally {
      setLoading(false);
    }
  };

  const onVerify = async () => {
    setError(null);
    if (!setupToken) return;
    if (!/^\d{6}$/.test(code)) {
      setError('Enter the 6-digit code from your authenticator app.');
      return;
    }
    setLoading(true);
    try {
      const res = await verifyMfaSetup(setupToken, code);
      setResult(res);
      await setAuthed({ access_token: res.access_token, refresh_token: res.refresh_token });
      me.refetch();
      setStep('codes');
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Verification failed.');
    } finally {
      setLoading(false);
    }
  };

  const shareCodes = async () => {
    if (!result) return;
    await Share.share({
      message: `TMJConnect MFA Backup Codes\n\n${result.backup_codes.join('\n')}\n\nKeep these somewhere safe — you'll need one if you lose your authenticator.`,
    });
  };

  const onDisable = async () => {
    setError(null);
    if (!password) {
      setError('Enter your current password.');
      return;
    }
    setLoading(true);
    try {
      await disablePatientMfa(password);
      me.refetch();
      setStep('idle');
      setPassword('');
      Alert.alert('2FA disabled', 'Two-factor auth is now turned off.');
    } catch (err) {
      if (err instanceof ApiError && err.code === 'INVALID_PASSWORD') {
        setError('Password is incorrect.');
      } else {
        setError(err instanceof ApiError ? err.message : 'Could not disable MFA.');
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <ProfileScreenHeader title="Two-Factor Authentication" />
      <ScrollView contentContainerStyle={styles.scroll}>
        {step === 'idle' && (
          <>
            <View style={styles.heroIcon}>
              <Ionicons
                name={enabled ? 'shield-checkmark' : 'shield-outline'}
                size={44}
                color={enabled ? colors.success.strong : colors.navy.standard}
              />
            </View>
            <Text style={styles.title}>
              {enabled ? '2FA is on' : 'Protect your account'}
            </Text>
            <Text style={styles.body}>
              {enabled
                ? 'You\u2019ll enter a code from your authenticator app when you sign in.'
                : 'Add a second step to sign-in. You\u2019ll use an authenticator app like 1Password, Google Authenticator, or Authy.'}
            </Text>

            {!enabled ? (
              <Button title="Set Up 2FA" onPress={onBegin} loading={loading} />
            ) : (
              <Button title="Disable 2FA" variant="danger" onPress={() => setStep('disable')} />
            )}
            {error ? <Text style={styles.error}>{error}</Text> : null}
          </>
        )}

        {step === 'qr' && setupData && (
          <>
            <Text style={styles.title}>Scan with your authenticator</Text>
            <Text style={styles.body}>
              Open your authenticator app and scan this QR code. If you can\u2019t scan, copy the
              secret below.
            </Text>
            <View style={styles.qrCard}>
              <QRCode
                value={setupData.otpauth_url}
                size={200}
                backgroundColor="#fff"
                color={colors.navy.deep}
              />
            </View>
            <Text style={styles.secretLabel}>Or enter this secret manually</Text>
            <View style={styles.secretBox}>
              <Text style={styles.secretText} selectable>{setupData.secret}</Text>
            </View>
            <Button title="I\u2019ve scanned it" onPress={() => setStep('verify')} />
            <Pressable onPress={() => setStep('idle')} hitSlop={8} style={styles.back}>
              <Text style={styles.backText}>Cancel</Text>
            </Pressable>
          </>
        )}

        {step === 'verify' && (
          <>
            <Text style={styles.title}>Enter the 6-digit code</Text>
            <Text style={styles.body}>
              Your authenticator app should now show a 6-digit code that changes every 30 seconds.
              Enter it to confirm.
            </Text>
            <TextField
              label="Verification code"
              value={code}
              onChangeText={(t) => setCode(t.replace(/\D/g, '').slice(0, 6))}
              keyboardType="number-pad"
              textContentType="oneTimeCode"
              placeholder="123456"
              error={error}
            />
            <Button title="Confirm" onPress={onVerify} loading={loading} />
            <Pressable onPress={() => setStep('qr')} hitSlop={8} style={styles.back}>
              <Text style={styles.backText}>Back to QR code</Text>
            </Pressable>
          </>
        )}

        {step === 'codes' && result && (
          <>
            <View style={styles.heroIcon}>
              <Ionicons name="checkmark-circle" size={44} color={colors.success.strong} />
            </View>
            <Text style={styles.title}>Save your backup codes</Text>
            <Text style={styles.body}>
              Save these somewhere safe. They\u2019re the only way back in if you lose your
              authenticator app. Each code can only be used once.
            </Text>
            <View style={styles.codesCard}>
              {result.backup_codes.map((c, i) => (
                <Text key={i} style={styles.codeText} selectable>
                  {c}
                </Text>
              ))}
            </View>
            <Button title="Share / Save Codes" variant="secondary" onPress={shareCodes} style={styles.shareBtn} />
            <Button title="Done" onPress={() => router.back()} style={styles.done} />
          </>
        )}

        {step === 'disable' && (
          <>
            <Text style={styles.title}>Disable 2FA</Text>
            <Text style={styles.body}>
              Confirm your password to turn off two-factor authentication. Your account will be less
              secure without it.
            </Text>
            <TextField
              label="Current password"
              value={password}
              onChangeText={setPassword}
              secureTextEntry
              textContentType="password"
              error={error}
            />
            <Button title="Disable 2FA" variant="danger" onPress={onDisable} loading={loading} />
            <Pressable onPress={() => setStep('idle')} hitSlop={8} style={styles.back}>
              <Text style={styles.backText}>Cancel</Text>
            </Pressable>
          </>
        )}

        {step === 'idle' && loading ? (
          <ActivityIndicator color={colors.navy.standard} style={{ marginTop: spacing.lg }} />
        ) : null}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.surface.background },
  scroll: { padding: spacing.lg, paddingBottom: spacing.xxl },
  heroIcon: {
    width: 96,
    height: 96,
    borderRadius: 48,
    backgroundColor: colors.navy.ghost,
    alignItems: 'center',
    justifyContent: 'center',
    marginVertical: spacing.xl,
    alignSelf: 'center',
  },
  title: { ...typography.h1, color: colors.ink.primary, textAlign: 'center', marginBottom: spacing.sm },
  body: { ...typography.body, color: colors.ink.secondary, textAlign: 'center', marginBottom: spacing.xl },
  qrCard: {
    alignSelf: 'center',
    padding: spacing.lg,
    backgroundColor: '#fff',
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.surface.border,
    marginBottom: spacing.lg,
  },
  secretLabel: { ...typography.caption, color: colors.ink.secondary, textAlign: 'center', marginBottom: spacing.xs },
  secretBox: {
    padding: spacing.md,
    backgroundColor: colors.surface.muted,
    borderRadius: radius.md,
    marginBottom: spacing.lg,
  },
  secretText: { ...typography.bodyStrong, color: colors.ink.primary, textAlign: 'center', letterSpacing: 1.5 },
  codesCard: {
    padding: spacing.lg,
    backgroundColor: colors.surface.muted,
    borderRadius: radius.lg,
    marginBottom: spacing.lg,
    gap: spacing.xs,
  },
  codeText: { ...typography.bodyStrong, color: colors.ink.primary, letterSpacing: 1, textAlign: 'center' },
  shareBtn: { marginBottom: spacing.sm },
  done: {},
  back: { alignSelf: 'center', marginTop: spacing.md },
  backText: { ...typography.label, color: colors.ink.secondary },
  error: { ...typography.caption, color: colors.danger.strong, marginTop: spacing.sm, textAlign: 'center' },
});
