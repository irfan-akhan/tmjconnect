/**
 * Tracks whether the patient has seen the onboarding carousel + permissions
 * screen on this device. Stored locally in SecureStore — intentionally *not*
 * server-side, because this is a UX "have you seen this intro yet?" flag,
 * not a regulatory or medical decision that needs to ride with the account.
 */

import * as SecureStore from 'expo-secure-store';

const KEY = 'tmjc.onboarded';

export async function hasOnboarded(): Promise<boolean> {
  try {
    const raw = await SecureStore.getItemAsync(KEY);
    return raw === '1';
  } catch {
    return false;
  }
}

export async function markOnboarded(): Promise<void> {
  try {
    await SecureStore.setItemAsync(KEY, '1');
  } catch {
    // SecureStore can fail on iOS simulator the first run after a reset —
    // treat as non-fatal; worst case the user sees onboarding once more.
  }
}

export async function resetOnboarded(): Promise<void> {
  try {
    await SecureStore.deleteItemAsync(KEY);
  } catch { /* silent */ }
}
