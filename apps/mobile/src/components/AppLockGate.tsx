import { Ionicons } from '@expo/vector-icons';
import { useCallback, useEffect, useRef, useState } from 'react';
import { Alert, AppState, Pressable, StyleSheet, Text, View } from 'react-native';
import { useAuth } from '../context/AuthContext';
import { loginPatient } from '../lib/auth.api';
import { getPatientMe } from '../lib/patient.api';
import { authenticate, getUserPreference, isDeviceCapable } from '../lib/biometric';
import { Button } from './Button';
import { TextField } from './TextField';
import { colors, radius, spacing, typography } from '../theme/tokens';

const LOCK_TIMEOUT_MS = 60_000;
const MAX_BIO_ATTEMPTS = 3;

export function AppLockGate({ children }: { children: React.ReactNode }) {
  const { status, signOut } = useAuth();
  const [locked, setLocked] = useState(false);
  const [mode, setMode] = useState<'bio' | 'password'>('bio');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const bioAttempts = useRef(0);
  const wentBackgroundAt = useRef<number | null>(null);

  useEffect(() => {
    const sub = AppState.addEventListener('change', (next) => {
      if (next === 'background' || next === 'inactive') {
        wentBackgroundAt.current = Date.now();
      } else if (next === 'active' && wentBackgroundAt.current != null) {
        const elapsed = Date.now() - wentBackgroundAt.current;
        wentBackgroundAt.current = null;
        if (elapsed >= LOCK_TIMEOUT_MS && status === 'authed') {
          checkAndLock();
        }
      }
    });
    return () => sub.remove();
  }, [status]);

  const checkAndLock = useCallback(async () => {
    const [capable, pref] = await Promise.all([isDeviceCapable(), getUserPreference()]);
    if (capable && pref) {
      bioAttempts.current = 0;
      setMode('bio');
      setPassword('');
      setError('');
      setLocked(true);
    }
  }, []);

  const attemptBiometric = useCallback(async () => {
    const result = await authenticate('Unlock TMJConnect');
    if (result.success) {
      setLocked(false);
      return;
    }
    bioAttempts.current += 1;
    if (bioAttempts.current >= MAX_BIO_ATTEMPTS) {
      setMode('password');
    }
  }, []);

  useEffect(() => {
    if (locked && mode === 'bio') {
      attemptBiometric();
    }
  }, [locked, mode, attemptBiometric]);

  const onPasswordSubmit = useCallback(async () => {
    setError('');
    setBusy(true);
    try {
      const me = await getPatientMe();
      await loginPatient({ email: me.email, password });
      setLocked(false);
    } catch {
      setError('Incorrect password. Try again.');
    } finally {
      setBusy(false);
    }
  }, [password]);

  const onSignOut = useCallback(() => {
    Alert.alert('Sign out?', 'You\u2019ll need to sign in again.', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Sign out', style: 'destructive', onPress: () => { setLocked(false); signOut(); } },
    ]);
  }, [signOut]);

  if (!locked) return <>{children}</>;

  return (
    <View style={styles.overlay}>
      <View style={styles.card}>
        <Ionicons name="lock-closed" size={40} color={colors.navy.standard} />
        <Text style={styles.title}>Session Locked</Text>
        <Text style={styles.subtitle}>
          {mode === 'bio'
            ? 'Authenticate to continue.'
            : 'Enter your password to unlock.'}
        </Text>

        {mode === 'bio' ? (
          <Button title="Try Again" onPress={attemptBiometric} />
        ) : (
          <View style={styles.form}>
            <TextField
              placeholder="Password"
              value={password}
              onChangeText={setPassword}
              secureTextEntry
              autoFocus
            />
            {error ? <Text style={styles.error}>{error}</Text> : null}
            <Button title="Unlock" onPress={onPasswordSubmit} loading={busy} disabled={!password} />
          </View>
        )}

        <Pressable onPress={onSignOut} style={styles.signOutBtn}>
          <Text style={styles.signOutText}>Sign out instead</Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  overlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: colors.surface.background,
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 999,
    padding: spacing.xl,
  },
  card: {
    width: '100%',
    maxWidth: 340,
    alignItems: 'center',
    gap: spacing.md,
  },
  title: { ...typography.h2, color: colors.ink.primary },
  subtitle: { ...typography.body, color: colors.ink.secondary, textAlign: 'center' },
  form: { width: '100%', gap: spacing.md },
  error: { ...typography.caption, color: colors.danger.base, textAlign: 'center' },
  signOutBtn: { marginTop: spacing.md },
  signOutText: { ...typography.label, color: colors.ink.tertiary },
});
