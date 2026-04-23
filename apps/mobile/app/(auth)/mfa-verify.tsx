import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Button } from '../../src/components/Button';
import { TextField } from '../../src/components/TextField';
import { Wordmark } from '../../src/components/Wordmark';
import { useAuth } from '../../src/context/AuthContext';
import { ApiError } from '../../src/lib/api';
import { sendMfaSms, verifyMfaLogin } from '../../src/lib/mfa.api';
import { colors, radius, spacing, typography } from '../../src/theme/tokens';

type Mode = 'totp' | 'sms' | 'backup';

export default function MfaVerify() {
  const router = useRouter();
  const { mfa_token } = useLocalSearchParams<{ mfa_token?: string }>();
  const { setAuthed } = useAuth();
  const [mode, setMode] = useState<Mode>('totp');
  const [code, setCode] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [smsSent, setSmsSent] = useState(false);

  const onVerify = async () => {
    setError(null);
    if (!mfa_token) {
      setError('Sign-in session expired. Start over.');
      return;
    }
    const trimmed = code.trim();
    if (mode === 'totp' && !/^\d{6}$/.test(trimmed)) {
      setError('Enter the 6-digit code from your authenticator app.');
      return;
    }
    if (mode === 'sms' && !/^\d{6}$/.test(trimmed)) {
      setError('Enter the 6-digit code sent to your phone.');
      return;
    }
    if (mode === 'backup' && trimmed.length < 8) {
      setError('Enter one of your backup codes.');
      return;
    }
    setSubmitting(true);
    try {
      const result = await verifyMfaLogin(mfa_token, trimmed, mode);
      await setAuthed({ access_token: result.access_token, refresh_token: result.refresh_token });
    } catch (err) {
      if (err instanceof ApiError) {
        if (err.code === 'INVALID_CODE') setError('That code is incorrect. Try again.');
        else if (err.status === 401) setError('Sign-in session expired. Start over.');
        else setError(err.message);
      } else {
        setError('Could not verify. Check your connection.');
      }
    } finally {
      setSubmitting(false);
    }
  };

  const onSendSms = async () => {
    if (!mfa_token) return;
    try {
      await sendMfaSms(mfa_token);
      setSmsSent(true);
      setMode('sms');
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not send SMS.');
    }
  };

  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.wordmark}><Wordmark /></View>
      <View style={styles.content}>
        <View style={styles.iconCircle}>
          <Ionicons name="shield-checkmark-outline" size={28} color={colors.navy.standard} />
        </View>
        <Text style={styles.title}>Verify it\u2019s you</Text>
        <Text style={styles.subtitle}>
          {mode === 'totp' && 'Enter the 6-digit code from your authenticator app.'}
          {mode === 'sms' && (smsSent ? 'Enter the code we texted you.' : 'Send a code to your phone via SMS.')}
          {mode === 'backup' && 'Enter one of the backup codes you saved when you set up 2FA.'}
        </Text>

        <View style={styles.modeRow}>
          <ModeChip active={mode === 'totp'} label="App" onPress={() => setMode('totp')} />
          <ModeChip active={mode === 'sms'} label="SMS" onPress={() => setMode('sms')} />
          <ModeChip active={mode === 'backup'} label="Backup" onPress={() => setMode('backup')} />
        </View>

        {mode === 'sms' && !smsSent ? (
          <Button title="Send SMS Code" variant="secondary" onPress={onSendSms} style={styles.smsBtn} />
        ) : (
          <TextField
            label={mode === 'backup' ? 'Backup code' : '6-digit code'}
            value={code}
            onChangeText={(t) => setCode(mode === 'backup' ? t : t.replace(/\D/g, '').slice(0, 6))}
            keyboardType={mode === 'backup' ? 'default' : 'number-pad'}
            autoCapitalize={mode === 'backup' ? 'characters' : 'none'}
            autoCorrect={false}
            textContentType={mode === 'backup' ? 'none' : 'oneTimeCode'}
            placeholder={mode === 'backup' ? 'XXXX-XXXX' : '123456'}
          />
        )}

        {error ? <Text style={styles.error}>{error}</Text> : null}

        {(mode !== 'sms' || smsSent) ? (
          <Button title="Verify" onPress={onVerify} loading={submitting} />
        ) : null}

        <Pressable onPress={() => router.replace('/(auth)/sign-in')} hitSlop={8} style={styles.cancel}>
          <Text style={styles.cancelText}>Back to sign in</Text>
        </Pressable>
      </View>
    </SafeAreaView>
  );
}

function ModeChip({ active, label, onPress }: { active: boolean; label: string; onPress: () => void }) {
  return (
    <Pressable onPress={onPress} style={[styles.chip, active && styles.chipActive]}>
      <Text style={[styles.chipText, active && styles.chipTextActive]}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.surface.background, paddingHorizontal: spacing.xl },
  wordmark: { marginTop: spacing.lg, marginBottom: spacing.xl, alignItems: 'center' },
  content: { flex: 1 },
  iconCircle: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: colors.navy.ghost,
    alignItems: 'center',
    justifyContent: 'center',
    alignSelf: 'center',
    marginBottom: spacing.lg,
  },
  title: { ...typography.h1, color: colors.ink.primary, textAlign: 'center', marginBottom: spacing.sm },
  subtitle: { ...typography.body, color: colors.ink.secondary, textAlign: 'center', marginBottom: spacing.lg },
  modeRow: { flexDirection: 'row', gap: spacing.sm, marginBottom: spacing.lg },
  chip: {
    flex: 1,
    paddingVertical: spacing.sm,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: colors.surface.border,
    alignItems: 'center',
  },
  chipActive: { borderColor: colors.navy.standard, backgroundColor: colors.navy.ghost },
  chipText: { ...typography.label, color: colors.ink.secondary },
  chipTextActive: { color: colors.navy.deep, fontWeight: '600' },
  smsBtn: { marginTop: spacing.md, marginBottom: spacing.md },
  error: { ...typography.caption, color: colors.danger.strong, marginBottom: spacing.md },
  cancel: { alignSelf: 'center', marginTop: spacing.xl },
  cancelText: { ...typography.label, color: colors.ink.secondary },
});
