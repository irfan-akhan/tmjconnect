import { zodResolver } from '@hookform/resolvers/zod';
import { registerPatientSchema, type RegisterPatientInput } from '@tmjconnect/shared';
import { useRouter } from 'expo-router';
import { Controller, useForm } from 'react-hook-form';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Button } from '../../src/components/Button';
import { PasswordStrength } from '../../src/components/PasswordStrength';
import { TextField } from '../../src/components/TextField';
import { Wordmark } from '../../src/components/Wordmark';
import { ApiError } from '../../src/lib/api';
import { registerPatient } from '../../src/lib/auth.api';
import { colors, spacing, typography } from '../../src/theme/tokens';

type FormValues = RegisterPatientInput;

export default function SignUp() {
  const router = useRouter();
  const {
    control,
    handleSubmit,
    setError,
    watch,
    formState: { errors, isSubmitting },
  } = useForm<FormValues>({
    resolver: zodResolver(registerPatientSchema),
    defaultValues: { email: '', password: '', first_name: '', last_name: '', phone: '' },
  });

  const password = watch('password');

  const onSubmit = async (values: FormValues) => {
    try {
      await registerPatient(values);
      router.replace({ pathname: '/(auth)/check-email', params: { email: values.email } });
    } catch (err) {
      if (err instanceof ApiError && err.code === 'CONFLICT') {
        setError('email', { message: 'An account with this email already exists.' });
      } else {
        setError('root', { message: err instanceof ApiError ? err.message : 'Could not create account.' });
      }
    }
  };

  return (
    <SafeAreaView style={styles.safe}>
      <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
        <View style={styles.wordmark}>
          <Wordmark />
        </View>

        <Text style={styles.step}>Step 1 of 1 · Registration</Text>
        <Text style={styles.title}>Create your account</Text>

        <View style={styles.nameRow}>
          <Controller
            control={control}
            name="first_name"
            render={({ field }) => (
              <TextField
                label="First name"
                value={field.value}
                onChangeText={field.onChange}
                autoCapitalize="words"
                textContentType="givenName"
                error={errors.first_name?.message}
                containerStyle={styles.half}
              />
            )}
          />
          <Controller
            control={control}
            name="last_name"
            render={({ field }) => (
              <TextField
                label="Last name"
                value={field.value}
                onChangeText={field.onChange}
                autoCapitalize="words"
                textContentType="familyName"
                error={errors.last_name?.message}
                containerStyle={styles.half}
              />
            )}
          />
        </View>

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
          name="phone"
          render={({ field }) => (
            <TextField
              label="Phone"
              value={field.value}
              onChangeText={field.onChange}
              keyboardType="phone-pad"
              textContentType="telephoneNumber"
              placeholder="+15551234567"
              error={errors.phone?.message}
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
              textContentType="newPassword"
              error={errors.password?.message}
            />
          )}
        />
        <PasswordStrength value={password || ''} />

        {errors.root?.message ? <Text style={styles.formError}>{errors.root.message}</Text> : null}

        <Button title="Create Account" onPress={handleSubmit(onSubmit)} loading={isSubmitting} />

        <View style={styles.footer}>
          <Text style={styles.footerText}>Already have an account? </Text>
          <Pressable onPress={() => router.replace('/(auth)/sign-in')} hitSlop={8}>
            <Text style={styles.footerLink}>Sign In</Text>
          </Pressable>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.surface.background },
  scroll: { paddingHorizontal: spacing.xl, paddingBottom: spacing.xl },
  wordmark: { marginTop: spacing.lg, marginBottom: spacing.xl, alignItems: 'center' },
  step: { ...typography.caption, color: colors.ink.tertiary, textAlign: 'center', marginBottom: spacing.xs },
  title: { ...typography.h1, color: colors.ink.primary, textAlign: 'center', marginBottom: spacing.xl },
  nameRow: { flexDirection: 'row', gap: spacing.md },
  half: { flex: 1 },
  formError: { ...typography.caption, color: colors.danger.strong, marginBottom: spacing.sm },
  footer: { flexDirection: 'row', justifyContent: 'center', marginTop: spacing.xl },
  footerText: { ...typography.body, color: colors.ink.secondary },
  footerLink: { ...typography.bodyStrong, color: colors.navy.standard },
});
