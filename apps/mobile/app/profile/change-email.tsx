import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useState } from 'react';
import { Alert, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Button } from '../../src/components/Button';
import { ProfileScreenHeader } from '../../src/components/ProfileScreenHeader';
import { TextField } from '../../src/components/TextField';
import { useMe } from '../../src/hooks/usePatient';
import { ApiError } from '../../src/lib/api';
import { requestEmailChange, verifyEmailChange } from '../../src/lib/change-email.api';
import { colors, radius, spacing, typography } from '../../src/theme/tokens';

type Step = 'request' | 'verify';

/**
 * Two-step email change flow. Step 1 collects the new email + current
 * password, hits `POST /auth/change-email/request`, then asks the user for
 * the 6-digit code sent to the new address. Step 2 posts that code to
 * `POST /auth/change-email/verify` and routes back.
 */
export default function ChangeEmail() {
  const router = useRouter();
  const me = useMe();
  const [step, setStep] = useState<Step>('request');
  const [newEmail, setNewEmail] = useState('');
  const [password, setPassword] = useState('');
  const [code, setCode] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const onRequest = async () => {
    setError(null);
    if (!/^\S+@\S+\.\S+$/.test(newEmail)) {
      setError('Enter a valid email address.');
      return;
    }
    if (password.length === 0) {
      setError('Enter your current password.');
      return;
    }
    setSubmitting(true);
    try {
      await requestEmailChange(newEmail, password);
      setStep('verify');
    } catch (err) {
      if (err instanceof ApiError) {
        if (err.code === 'INVALID_PASSWORD') setError('Current password is incorrect.');
        else if (err.status === 409 || err.code === 'CONFLICT') setError('That email is already in use.');
        else setError(err.message);
      } else {
        setError('Could not send verification. Try again.');
      }
    } finally {
      setSubmitting(false);
    }
  };

  const onVerify = async () => {
    setError(null);
    if (!/^\d{6}$/.test(code)) {
      setError('Enter the 6-digit code from the new email.');
      return;
    }
    setSubmitting(true);
    try {
      await verifyEmailChange(code);
      Alert.alert('Email updated', `Your email has been changed to ${newEmail}.`, [
        { text: 'OK', onPress: () => { me.refetch(); router.back(); } },
      ]);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not verify. Try again.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <ProfileScreenHeader title="Change Email" />
      <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
        {step === 'request' ? (
          <>
            <View style={styles.iconCircle}>
              <Ionicons name="mail-outline" size={28} color={colors.navy.standard} />
            </View>
            <Text style={styles.title}>New email address</Text>
            <Text style={styles.helper}>
              Your current email is{' '}
              <Text style={styles.helperStrong}>{me.data?.email ?? '—'}</Text>. We\u2019ll send a
              6-digit code to the new address before switching.
            </Text>

            <TextField
              label="New email"
              value={newEmail}
              onChangeText={setNewEmail}
              autoCapitalize="none"
              keyboardType="email-address"
              textContentType="emailAddress"
              autoComplete="email"
            />
            <TextField
              label="Current password"
              value={password}
              onChangeText={setPassword}
              secureTextEntry
              textContentType="password"
            />

            {error ? <Text style={styles.error}>{error}</Text> : null}

            <Button title="Send Verification Code" onPress={onRequest} loading={submitting} />
          </>
        ) : (
          <>
            <View style={styles.iconCircle}>
              <Ionicons name="shield-checkmark-outline" size={28} color={colors.success.strong} />
            </View>
            <Text style={styles.title}>Enter verification code</Text>
            <Text style={styles.helper}>
              We\u2019ve sent a 6-digit code to{' '}
              <Text style={styles.helperStrong}>{newEmail}</Text>. Enter it below to finish the
              change.
            </Text>

            <TextField
              label="6-digit code"
              value={code}
              onChangeText={(t) => setCode(t.replace(/\D/g, '').slice(0, 6))}
              keyboardType="number-pad"
              textContentType="oneTimeCode"
              placeholder="123456"
            />

            {error ? <Text style={styles.error}>{error}</Text> : null}

            <Button title="Confirm New Email" onPress={onVerify} loading={submitting} />
            <Pressable onPress={() => setStep('request')} hitSlop={8} style={styles.back}>
              <Text style={styles.backText}>Back</Text>
            </Pressable>
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.surface.background },
  scroll: { padding: spacing.lg, paddingBottom: spacing.xl },
  iconCircle: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: colors.navy.ghost,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.lg,
    alignSelf: 'center',
    marginTop: spacing.md,
  },
  title: { ...typography.h2, color: colors.ink.primary, textAlign: 'center', marginBottom: spacing.sm },
  helper: { ...typography.body, color: colors.ink.secondary, textAlign: 'center', marginBottom: spacing.xl },
  helperStrong: { ...typography.bodyStrong, color: colors.ink.primary },
  error: { ...typography.caption, color: colors.danger.strong, marginBottom: spacing.sm },
  back: { alignSelf: 'center', marginTop: spacing.lg },
  backText: { ...typography.label, color: colors.ink.secondary },
});
