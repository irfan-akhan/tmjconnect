import { useLocalSearchParams, useRouter } from 'expo-router';
import { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Button } from '../../src/components/Button';
import { Screen } from '../../src/components/Screen';
import { TextField } from '../../src/components/TextField';
import { useAuth } from '../../src/context/AuthContext';
import { ApiError } from '../../src/lib/api';
import { resendVerifyEmail, verifyEmail } from '../../src/lib/auth.api';
import { colors, spacing, typography } from '../../src/theme/tokens';

export default function VerifyEmail() {
  const router = useRouter();
  const { email: emailParam } = useLocalSearchParams<{ email?: string }>();
  const { setAuthed } = useAuth();
  const [code, setCode] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [resending, setResending] = useState(false);

  const email = emailParam ?? '';

  const onVerify = async () => {
    setError(null);
    if (!/^\d{6}$/.test(code)) {
      setError('Enter the 6-digit code from your email.');
      return;
    }
    if (!email) {
      setError('Missing email — start from sign-up again.');
      return;
    }
    setSubmitting(true);
    try {
      const result = await verifyEmail({ email, code });
      if (result.type === 'tokens') {
        await setAuthed({ access_token: result.access_token, refresh_token: result.refresh_token });
        router.replace('/(auth)/account-verified');
      } else {
        // Patients don't typically hit mfa_setup_required on first verify, but
        // the API can return it. Route to sign-in; MFA setup UI is a later gap.
        router.replace('/(auth)/sign-in');
      }
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Verification failed. Try again.');
    } finally {
      setSubmitting(false);
    }
  };

  const onResend = async () => {
    if (!email) return;
    setResending(true);
    setError(null);
    try {
      await resendVerifyEmail({ email });
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not resend.');
    } finally {
      setResending(false);
    }
  };

  return (
    <Screen>
      <View style={styles.top}>
        <Text style={styles.title}>Enter verification code</Text>
        <Text style={styles.subtitle}>Sent to {email || 'your email'}</Text>

        <TextField
          label="6-digit code"
          value={code}
          onChangeText={(t) => setCode(t.replace(/\D/g, '').slice(0, 6))}
          keyboardType="number-pad"
          textContentType="oneTimeCode"
          autoComplete="sms-otp"
          placeholder="123456"
          error={error}
          containerStyle={styles.field}
        />

        <Button title="Verify" onPress={onVerify} loading={submitting} />
        <Button
          title={resending ? 'Resending…' : 'Resend code'}
          variant="ghost"
          onPress={onResend}
          loading={resending}
          disabled={!email}
          style={styles.resend}
        />
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  top: { flex: 1 },
  title: { ...typography.h1, color: colors.ink.primary, marginBottom: spacing.sm },
  subtitle: { ...typography.body, color: colors.ink.secondary, marginBottom: spacing.xl },
  field: { marginTop: spacing.md },
  resend: { marginTop: spacing.sm },
});
