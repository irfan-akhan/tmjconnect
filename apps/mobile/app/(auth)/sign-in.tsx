import { zodResolver } from '@hookform/resolvers/zod';
import { Ionicons } from '@expo/vector-icons';
import { loginSchema, type LoginInput } from '@tmjconnect/shared';
import { useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { Controller, useForm } from 'react-hook-form';
import { Alert, Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Button } from '../../src/components/Button';
import { TextField } from '../../src/components/TextField';
import { Wordmark } from '../../src/components/Wordmark';
import { useAuth } from '../../src/context/AuthContext';
import { ApiError } from '../../src/lib/api';
import { loginPatient } from '../../src/lib/auth.api';
import {
  canUseBiometrics,
  clearBiometricCredential,
  hasBiometricCredentialStored,
  readBiometricCredential,
  storeBiometricCredential,
} from '../../src/lib/biometricCredentials';
import { registerPushTokenIfGranted } from '../../src/lib/pushRegistration';
import { colors, radius, spacing, typography } from '../../src/theme/tokens';

export default function SignIn() {
  const router = useRouter();
  const { setAuthed } = useAuth();
  const {
    control,
    handleSubmit,
    setError,
    formState: { errors, isSubmitting },
  } = useForm<LoginInput>({
    resolver: zodResolver(loginSchema),
    defaultValues: { email: '', password: '' },
  });

  const [bioAvailable, setBioAvailable] = useState(false);

  useEffect(() => {
    (async () => {
      const ok = (await canUseBiometrics()) && (await hasBiometricCredentialStored());
      setBioAvailable(ok);
    })();
  }, []);

  const onSubmit = async (values: LoginInput) => {
    try {
      const result = await loginPatient(values);
      if (result.type === 'tokens') {
        await setAuthed({ access_token: result.access_token, refresh_token: result.refresh_token });
        // Fire-and-forget — don't block the UI on push registration.
        registerPushTokenIfGranted().catch(() => {});
        // Offer biometric storage for faster future sign-ins. Skipped silently
        // if biometrics aren't available or the user has already opted in.
        if ((await canUseBiometrics()) && !(await hasBiometricCredentialStored())) {
          Alert.alert(
            'Sign in with Face ID next time?',
            'We\u2019ll store your credentials securely in the device keychain so you can unlock with Face ID.',
            [
              { text: 'Not now', style: 'cancel' },
              {
                text: 'Enable',
                onPress: async () => {
                  try {
                    await storeBiometricCredential({ email: values.email, password: values.password });
                  } catch { /* user cancelled biometric enrollment prompt */ }
                },
              },
            ],
          );
        }
      } else {
        router.replace({
          pathname: '/(auth)/mfa-verify',
          params: { mfa_token: result.mfa_token },
        });
      }
    } catch (err) {
      if (err instanceof ApiError) {
        if (err.status === 429 || err.code === 'ACCOUNT_LOCKED' || err.code === 'TOO_MANY_REQUESTS') {
          const until = (err.details as { locked_until?: string } | null | undefined)?.locked_until;
          router.replace({ pathname: '/(auth)/account-locked', params: { until: until ?? '' } });
          return;
        }
        if (err.status === 401) setError('root', { message: 'Incorrect email or password.' });
        else if (err.code === 'EMAIL_NOT_VERIFIED') setError('root', { message: 'Please verify your email first.' });
        else setError('root', { message: err.message });
      } else {
        setError('root', { message: 'Could not sign in. Check your connection.' });
      }
    }
  };

  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.content}>
        <View style={styles.wordmark}>
          <Wordmark />
        </View>

        <Text style={styles.step}>Step 2 of 3 · Log in</Text>
        <Text style={styles.title}>Welcome back</Text>

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
            />
          )}
        />
        <Controller
          control={control}
          name="password"
          render={({ field }) => (
            <TextField
              label="Password"
              value={field.value}
              onChangeText={field.onChange}
              secureTextEntry
              textContentType="password"
              autoComplete="password"
              error={errors.password?.message}
            />
          )}
        />

        <Pressable onPress={() => router.push('/(auth)/forgot-password')} style={styles.forgot} hitSlop={8}>
          <Text style={styles.forgotText}>Forgot Password?</Text>
        </Pressable>

        {errors.root?.message ? <Text style={styles.formError}>{errors.root.message}</Text> : null}

        <Button title="Sign In" onPress={handleSubmit(onSubmit)} loading={isSubmitting} />

        <View style={styles.dividerRow}>
          <View style={styles.divider} />
          <Text style={styles.dividerText}>OR</Text>
          <View style={styles.divider} />
        </View>

        <Pressable
          style={[styles.faceIdBtn, !bioAvailable && styles.faceIdDisabled]}
          accessibilityRole="button"
          accessibilityState={{ disabled: !bioAvailable }}
          disabled={!bioAvailable}
          onPress={async () => {
            const cred = await readBiometricCredential();
            if (!cred) {
              Alert.alert(
                'Biometric unlock unavailable',
                'Sign in with your password once to enable Face ID for next time.',
                [{ text: 'OK' }, { text: 'Reset', style: 'destructive', onPress: clearBiometricCredential }],
              );
              return;
            }
            try {
              const result = await loginPatient({ email: cred.email, password: cred.password });
              if (result.type === 'tokens') {
                await setAuthed({
                  access_token: result.access_token,
                  refresh_token: result.refresh_token,
                });
                registerPushTokenIfGranted().catch(() => {});
              } else {
                router.replace({
                  pathname: '/(auth)/mfa-verify',
                  params: { mfa_token: result.mfa_token },
                });
              }
            } catch (err) {
              if (err instanceof ApiError && err.status === 401) {
                await clearBiometricCredential();
                Alert.alert(
                  'Stored credential rejected',
                  'Your password may have changed. Sign in manually to re-enable Face ID.',
                );
              } else {
                Alert.alert('Could not sign in', 'Check your connection and try again.');
              }
            }
          }}
        >
          <Ionicons name="scan-outline" size={20} color={colors.navy.standard} style={styles.faceIdIcon} />
          <Text style={styles.faceIdText}>
            {bioAvailable ? 'Sign in with Face ID' : 'Face ID (set up after first sign-in)'}
          </Text>
        </Pressable>
      </View>

      <View style={styles.footer}>
        <Text style={styles.footerText}>New to TMJConnect? </Text>
        <Pressable onPress={() => router.replace('/(auth)/sign-up')} hitSlop={8}>
          <Text style={styles.footerLink}>Create Account</Text>
        </Pressable>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.surface.background },
  content: { flex: 1, paddingHorizontal: spacing.xl, paddingTop: spacing.lg },
  wordmark: { marginBottom: spacing.xl, alignItems: 'center' },
  step: { ...typography.caption, color: colors.ink.tertiary, textAlign: 'center', marginBottom: spacing.xs },
  title: { ...typography.h1, color: colors.ink.primary, textAlign: 'center', marginBottom: spacing.xl },
  forgot: { alignSelf: 'flex-end', marginTop: -spacing.sm, marginBottom: spacing.lg },
  forgotText: { ...typography.label, color: colors.navy.standard },
  formError: { ...typography.caption, color: colors.danger.strong, marginBottom: spacing.sm },
  dividerRow: { flexDirection: 'row', alignItems: 'center', marginVertical: spacing.xl, gap: spacing.md },
  divider: { flex: 1, height: 1, backgroundColor: colors.surface.border },
  dividerText: { ...typography.tiny, color: colors.ink.tertiary, letterSpacing: 1 },
  faceIdBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    height: 52,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.surface.border,
    backgroundColor: colors.surface.background,
  },
  faceIdDisabled: { opacity: 0.5 },
  faceIdIcon: { marginRight: spacing.sm },
  faceIdText: { ...typography.bodyStrong, color: colors.ink.primary },
  footer: { flexDirection: 'row', justifyContent: 'center', paddingBottom: spacing.xl },
  footerText: { ...typography.body, color: colors.ink.secondary },
  footerLink: { ...typography.bodyStrong, color: colors.navy.standard },
});
