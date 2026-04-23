import { QueryClientProvider } from '@tanstack/react-query';
import { Stack, useRouter, useSegments } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useEffect } from 'react';
import { ActivityIndicator, StyleSheet, View } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { AppLockGate } from '../src/components/AppLockGate';
import { OfflineBanner } from '../src/components/OfflineBanner';
import { AuthProvider, useAuth } from '../src/context/AuthContext';
import { attachOfflineQueueListeners } from '../src/lib/offlineQueue';
import { hasOnboarded } from '../src/lib/onboarding';
import { queryClient } from '../src/lib/queryClient';
import { getTosStatus } from '../src/lib/tos.api';
import { colors } from '../src/theme/tokens';

function AuthGate() {
  const { status, postAuth, setPostAuth } = useAuth();
  const segments = useSegments();
  const router = useRouter();

  useEffect(() => {
    return attachOfflineQueueListeners();
  }, []);

  // Determine post-auth state when user becomes authed.
  useEffect(() => {
    if (status !== 'authed') {
      setPostAuth('loading');
      return;
    }
    let alive = true;
    (async () => {
      try {
        const tos = await getTosStatus();
        if (!alive) return;
        if (!tos.accepted) { setPostAuth('needs-tos'); return; }
        const onboarded = await hasOnboarded();
        if (!alive) return;
        setPostAuth(onboarded ? 'ready' : 'needs-onboarding');
      } catch {
        if (alive) setPostAuth('ready');
      }
    })();
    return () => { alive = false; };
  }, [status, setPostAuth]);

  // Route guard — redirect based on auth + post-auth state.
  useEffect(() => {
    if (status === 'loading') return;
    const top = segments[0] as string | undefined;
    const inAuth = top === '(auth)';
    const inOnboarding = top === 'onboarding';
    const isTosScreen = top === 'updated-terms';
    const atRoot = !top || top === 'index';

    if (status === 'anon') {
      if (!inAuth) router.replace('/(auth)/sign-in');
      return;
    }

    if (postAuth === 'loading') return;

    if (postAuth === 'needs-tos' && !isTosScreen) {
      router.replace('/updated-terms');
    } else if (postAuth === 'needs-onboarding' && !inOnboarding) {
      router.replace('/onboarding/intro');
    } else if (postAuth === 'ready' && (inAuth || inOnboarding || isTosScreen || atRoot)) {
      router.replace('/(tabs)/dashboard');
    }
  }, [status, postAuth, segments, router]);

  if (status === 'loading' || (status === 'authed' && postAuth === 'loading')) {
    return (
      <View style={styles.loading}>
        <ActivityIndicator color={colors.navy.standard} />
      </View>
    );
  }
  return (
    <Stack
      screenOptions={{
        headerShown: false,
        animation: 'fade_from_bottom',
        animationDuration: 350,
      }}
    >
      <Stack.Screen name="symptom-log" options={{ presentation: 'modal', animation: 'slide_from_bottom' }} />
      <Stack.Screen name="sleep-log" options={{ presentation: 'modal', animation: 'slide_from_bottom' }} />
      <Stack.Screen name="medication-log" options={{ presentation: 'modal', animation: 'slide_from_bottom' }} />
      <Stack.Screen name="jaw-mobility" options={{ presentation: 'modal', animation: 'slide_from_bottom' }} />
      <Stack.Screen name="emergency" options={{ presentation: 'modal', animation: 'slide_from_bottom' }} />
    </Stack>
  );
}

export default function RootLayout() {
  return (
    <GestureHandlerRootView style={styles.root}>
      <SafeAreaProvider>
        <QueryClientProvider client={queryClient}>
          <AuthProvider>
            <StatusBar style="dark" />
            <OfflineBanner />
            <AppLockGate>
              <AuthGate />
            </AppLockGate>
          </AuthProvider>
        </QueryClientProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  loading: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.surface.background },
});
