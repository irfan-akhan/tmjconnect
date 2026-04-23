import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useState } from 'react';
import { Linking, Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Button } from '../../src/components/Button';
import { Wordmark } from '../../src/components/Wordmark';
import { ApiError } from '../../src/lib/api';
import { resendVerifyEmail } from '../../src/lib/auth.api';
import { colors, radius, spacing, typography } from '../../src/theme/tokens';

export default function CheckEmail() {
  const router = useRouter();
  const { email } = useLocalSearchParams<{ email?: string }>();
  const [status, setStatus] = useState<'idle' | 'sending' | 'sent' | 'error'>('idle');
  const [message, setMessage] = useState<string | null>(null);

  const openMail = async () => {
    const url = 'message://';
    const ok = await Linking.canOpenURL(url).catch(() => false);
    if (ok) await Linking.openURL(url);
    else router.push({ pathname: '/(auth)/verify-email', params: { email } });
  };

  const resend = async () => {
    if (!email) return;
    setStatus('sending');
    setMessage(null);
    try {
      await resendVerifyEmail({ email });
      setStatus('sent');
      setMessage('New code sent. Check your inbox.');
    } catch (err) {
      setStatus('error');
      setMessage(err instanceof ApiError ? err.message : 'Could not resend. Try again.');
    }
  };

  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.wordmark}><Wordmark /></View>
      <Text style={styles.step}>Step 3 of 3 · Email Activation</Text>

      <View style={styles.card}>
        <View style={styles.iconCircle}>
          <Ionicons name="mail-outline" size={32} color={colors.navy.standard} />
        </View>
        <Text style={styles.title}>Check Email</Text>
        <Text style={styles.body}>
          We&rsquo;ve sent a verification code to{' '}
          <Text style={styles.emailText}>{email ?? 'your inbox'}</Text>. Tap the link or enter the code
          to activate your account.
        </Text>

        <View style={styles.notice}>
          <Ionicons name="information-circle" size={16} color={colors.warning.strong} />
          <Text style={styles.noticeText}>Didn&rsquo;t get it? Check spam or resend below.</Text>
        </View>

        <Button title="Open Email App" variant="accent" onPress={openMail} style={styles.openBtn} />

        <Pressable onPress={resend} hitSlop={8} style={styles.resend}>
          <Text style={styles.resendText}>
            {status === 'sending' ? 'Resending…' : 'Resend Email'}
          </Text>
        </Pressable>
        {message ? (
          <Text style={[styles.message, status === 'error' && styles.messageError]}>{message}</Text>
        ) : null}
      </View>

      <Pressable onPress={() => router.push({ pathname: '/(auth)/verify-email', params: { email } })} hitSlop={8} style={styles.enterCode}>
        <Text style={styles.enterCodeText}>Enter code manually</Text>
      </Pressable>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.surface.background, paddingHorizontal: spacing.xl },
  wordmark: { marginTop: spacing.lg, marginBottom: spacing.sm, alignItems: 'center' },
  step: { ...typography.caption, color: colors.ink.tertiary, textAlign: 'center', marginBottom: spacing.xl },
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
    backgroundColor: colors.navy.ghost,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.lg,
  },
  title: { ...typography.h1, color: colors.ink.primary, marginBottom: spacing.sm },
  body: { ...typography.body, color: colors.ink.secondary, textAlign: 'center', marginBottom: spacing.lg },
  emailText: { ...typography.bodyStrong, color: colors.ink.primary },
  notice: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    backgroundColor: colors.warning.soft,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: radius.md,
    marginBottom: spacing.lg,
  },
  noticeText: { ...typography.caption, color: colors.warning.strong, flexShrink: 1 },
  openBtn: { alignSelf: 'stretch' },
  resend: { marginTop: spacing.md },
  resendText: { ...typography.label, color: colors.navy.standard },
  message: { ...typography.caption, color: colors.success.strong, textAlign: 'center', marginTop: spacing.sm },
  messageError: { color: colors.danger.strong },
  enterCode: { alignSelf: 'center', marginTop: spacing.lg },
  enterCodeText: { ...typography.label, color: colors.ink.secondary },
});
