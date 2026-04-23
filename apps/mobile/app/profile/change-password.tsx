import { useRouter } from 'expo-router';
import { useState } from 'react';
import { Alert, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Button } from '../../src/components/Button';
import { PasswordStrength, scorePassword } from '../../src/components/PasswordStrength';
import { ProfileScreenHeader } from '../../src/components/ProfileScreenHeader';
import { TextField } from '../../src/components/TextField';
import { ApiError } from '../../src/lib/api';
import { changePassword } from '../../src/lib/password.api';
import { colors, spacing, typography } from '../../src/theme/tokens';

export default function ChangePassword() {
  const router = useRouter();
  const [current, setCurrent] = useState('');
  const [next, setNext] = useState('');
  const [confirm, setConfirm] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const strong = scorePassword(next).score >= 2;
  const matches = next.length > 0 && next === confirm;
  const canSubmit = current.length > 0 && strong && matches;

  const onSubmit = async () => {
    setError(null);
    if (!matches) {
      setError('New password and confirmation don\u2019t match.');
      return;
    }
    setSubmitting(true);
    try {
      await changePassword(current, next);
      Alert.alert('Password updated', 'Your password has been changed.', [
        { text: 'OK', onPress: () => router.back() },
      ]);
    } catch (err) {
      if (err instanceof ApiError) {
        if (err.code === 'INVALID_PASSWORD' || err.status === 401) setError('Current password is incorrect.');
        else setError(err.message);
      } else {
        setError('Could not update password. Try again.');
      }
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <ProfileScreenHeader title="Change Password" />
      <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
        <Text style={styles.helper}>
          Use a password you haven\u2019t used on another account. Minimum 8 characters with a digit and
          special character.
        </Text>

        <TextField
          label="Current password"
          value={current}
          onChangeText={setCurrent}
          secureTextEntry
          textContentType="password"
        />
        <TextField
          label="New password"
          value={next}
          onChangeText={setNext}
          secureTextEntry
          textContentType="newPassword"
        />
        <PasswordStrength value={next} />
        <TextField
          label="Confirm new password"
          value={confirm}
          onChangeText={setConfirm}
          secureTextEntry
          textContentType="newPassword"
          error={confirm.length > 0 && !matches ? 'Passwords don\u2019t match' : null}
        />

        {error ? <Text style={styles.error}>{error}</Text> : null}
      </ScrollView>

      <View style={styles.footer}>
        <Button title="Update Password" onPress={onSubmit} loading={submitting} disabled={!canSubmit} />
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.surface.background },
  scroll: { padding: spacing.lg, paddingBottom: spacing.xl },
  helper: { ...typography.body, color: colors.ink.secondary, marginBottom: spacing.lg },
  error: { ...typography.caption, color: colors.danger.strong, marginTop: spacing.sm },
  footer: {
    padding: spacing.lg,
    borderTopWidth: 1,
    borderTopColor: colors.surface.border,
    backgroundColor: colors.surface.background,
  },
});
