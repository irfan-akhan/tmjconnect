import { zodResolver } from '@hookform/resolvers/zod';
import { resetPasswordSchema, type ResetPasswordInput } from '@tmjconnect/shared';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect } from 'react';
import { Controller, useForm } from 'react-hook-form';
import { StyleSheet, Text, View } from 'react-native';
import { Button } from '../../src/components/Button';
import { Screen } from '../../src/components/Screen';
import { TextField } from '../../src/components/TextField';
import { ApiError } from '../../src/lib/api';
import { resetPassword } from '../../src/lib/auth.api';
import { colors, spacing, typography } from '../../src/theme/tokens';

/**
 * Deep-link target. Opened via tmjconnect://reset-password?token=XYZ from the
 * reset email. If the token is missing, route back to forgot-password so the
 * user can request a new link.
 */
export default function ResetPassword() {
  const router = useRouter();
  const { token } = useLocalSearchParams<{ token?: string }>();

  const {
    control,
    handleSubmit,
    setError,
    formState: { errors, isSubmitting, isSubmitSuccessful },
  } = useForm<ResetPasswordInput>({
    resolver: zodResolver(resetPasswordSchema),
    defaultValues: { token: token ?? '', new_password: '' },
  });

  useEffect(() => {
    if (!token) {
      setError('root', { message: 'Missing reset token. Request a new email.' });
    }
  }, [token, setError]);

  const onSubmit = async (values: ResetPasswordInput) => {
    try {
      await resetPassword(values);
      router.replace('/(auth)/sign-in');
    } catch (err) {
      setError('root', {
        message:
          err instanceof ApiError
            ? err.code === 'INVALID_TOKEN' || err.status === 400
              ? 'This reset link is invalid or expired. Request a new one.'
              : err.message
            : 'Could not reset password.',
      });
    }
  };

  if (isSubmitSuccessful) {
    return (
      <Screen>
        <View style={styles.hero}>
          <Text style={styles.title}>Password reset</Text>
          <Text style={styles.subtitle}>You can now sign in with your new password.</Text>
        </View>
        <Button title="Sign in" onPress={() => router.replace('/(auth)/sign-in')} />
      </Screen>
    );
  }

  return (
    <Screen>
      <Text style={styles.title}>Set a new password</Text>
      <Text style={styles.subtitle}>Choose a strong password you haven&rsquo;t used before.</Text>

      <Controller
        control={control}
        name="new_password"
        render={({ field }) => (
          <TextField
            label="New password"
            value={field.value}
            onChangeText={field.onChange}
            secureTextEntry
            textContentType="newPassword"
            hint="8+ chars, 1 digit, 1 special character (!@#$%^&*)"
            error={errors.new_password?.message}
          />
        )}
      />

      {errors.root?.message ? <Text style={styles.formError}>{errors.root.message}</Text> : null}

      <Button
        title="Reset password"
        onPress={handleSubmit(onSubmit)}
        loading={isSubmitting}
        disabled={!token}
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  hero: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  title: { ...typography.h1, color: colors.ink.primary, marginBottom: spacing.sm, marginTop: spacing.xl },
  subtitle: { ...typography.body, color: colors.ink.secondary, marginBottom: spacing.xl },
  formError: { ...typography.caption, color: colors.danger.strong, marginBottom: spacing.sm },
});
