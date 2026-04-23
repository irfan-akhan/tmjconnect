/**
 * Secure token storage.
 *
 * Per spec §7.6, mobile tokens MUST live in encrypted storage (Keychain on
 * iOS, encrypted SharedPreferences / Keystore on Android). Plaintext storage
 * is a HIPAA compliance violation. expo-secure-store provides the right
 * primitive; this file wraps it with the keys we actually use so the rest of
 * the app never touches SecureStore directly.
 */

import * as SecureStore from 'expo-secure-store';

const ACCESS_KEY = 'tmjc.access';
const REFRESH_KEY = 'tmjc.refresh';

export async function getAccessToken(): Promise<string | null> {
  return SecureStore.getItemAsync(ACCESS_KEY);
}

export async function getRefreshToken(): Promise<string | null> {
  return SecureStore.getItemAsync(REFRESH_KEY);
}

export async function saveTokens(access: string, refresh: string): Promise<void> {
  await Promise.all([
    SecureStore.setItemAsync(ACCESS_KEY, access, {
      keychainAccessible: SecureStore.WHEN_UNLOCKED_THIS_DEVICE_ONLY,
    }),
    SecureStore.setItemAsync(REFRESH_KEY, refresh, {
      keychainAccessible: SecureStore.WHEN_UNLOCKED_THIS_DEVICE_ONLY,
    }),
  ]);
}

export async function clearTokens(): Promise<void> {
  await Promise.all([
    SecureStore.deleteItemAsync(ACCESS_KEY).catch(() => {}),
    SecureStore.deleteItemAsync(REFRESH_KEY).catch(() => {}),
  ]);
}
