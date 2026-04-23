import { Ionicons } from '@expo/vector-icons';
import { zodResolver } from '@hookform/resolvers/zod';
import { forgotPasswordSchema, type ForgotPasswordInput } from '@tmjconnect/shared';
import { useRouter } from 'expo-router';
import { useState } from 'react';
import { Controller, useForm } from 'react-hook-form';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Button } from '../../src/components/Button';
import { TextField } from '../../src/components/TextField';
import { Wordmark } from '../../src/components/Wordmark';
import { ApiError } from '../../src/lib/api';
import { forgotPassword } from '../../src/lib/auth.api';
import { colors, radius, spacing, typography } from '../../src/theme/tokens';

export default function ForgotPassword() {
  const router = useRouter();
  const [sent, setSent] = useState(false);
  const {
    control,
    handleSubmit,
    setError,
    formState: { errors, isSubmitting },
  } = useForm<ForgotPasswordInput>({
    resolver: zodResolver(forgotPasswordSchema),
    defaultValues: { email: '' },
  });

  const onSubmit = async (values: ForgotPasswordInput) => {
    try {
      await forgotPassword(values);
      setSent(true);
    } catch (err) {
      setError('root', {
        message: err instanceof ApiError ? err.message : 'Could not send reset email.',
      });
    }
  };

  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.wordmark}><Wordmark /></View>

      <View style={styles.card}>
        <View style={styles.iconCircle}>
          <Ionicons name="key-outline" size={30} color={colors.gold.standard} />
        </View>
        <Text style={styles.title}>Reset Password</Text>
        <Text style={styles.body}>
          {sent
            ? 'Check your email for a reset link.'
            : 'Enter your account email and we\u2019ll send you a link to reset your password.'}
        </Text>

        {!sent ? (
          <Controller
            control={control}
            name="email"
            render={({ field }) => (
              <TextField
                label="Email"
                value={field.value}
                onChangeText={field.onChange}
                autoCapitalize="none"
                keyboardType="email-address"
                textContentType="emailAddress"
                autoComplete="email"
                error={errors.email?.message}
                containerStyle={styles.field}
              />
            )}
          />
        ) : null}

        {errors.root?.message ? <Text style={styles.formError}>{errors.root.message}</Text> : null}

        <Button
          title={sent ? 'Back to Sign In' : 'Send Reset Link'}
          onPress={sent ? () => router.replace('/(auth)/sign-in') : handleSubmit(onSubmit)}
          loading={isSubmitting}
          style={styles.submit}
        />

        {!sent ? (
          <Pressable onPress={() => router.back()} hitSlop={8} style={styles.back}>
            <Text style={styles.backText}>Back to Sign In</Text>
          </Pressable>
        ) : null}
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.surface.background, paddingHorizontal: spacing.xl },
  wordmark: { marginTop: spacing.lg, marginBottom: spacing.xl, alignItems: 'center' },
  card: {
    backgroundColor: colors.surface.card,
    borderRadius: radius.xl,
    borderWidth: 1,
    borderColor: colors.surface.border,
    padding: spacing.xl,
    alignItems: 'center',
  },
  iconCircle: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: colors.gold.ghost,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.lg,
  },
  title: { ...typography.h1, color: colors.ink.primary, marginBottom: spacing.sm },
  body: { ...typography.body, color: colors.ink.secondary, textAlign: 'center', marginBottom: spacing.lg },
  field: { alignSelf: 'stretch' },
  formError: { ...typography.caption, color: colors.danger.strong, marginBottom: spacing.sm, alignSelf: 'stretch' },
  submit: { alignSelf: 'stretch' },
  back: { marginTop: spacing.md },
  backText: { ...typography.label, color: colors.ink.secondary },
});
