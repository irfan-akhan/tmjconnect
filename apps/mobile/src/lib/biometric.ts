/**
 * Biometric unlock wrapper.
 *
 * Two concerns:
 *   1. DEVICE capability — does the device have Face ID / Touch ID set up?
 *      (`hasHardwareAsync` + `isEnrolledAsync`)
 *   2. USER preference — did the user opt in to biometric unlock inside the
 *      app? Stored as a SecureStore flag so it survives reinstalls but not
 *      app-data wipe.
 *
 * Rules:
 *   - We NEVER call `authenticateAsync` as an MFA factor — it only gates
 *     access to an already-valid session. Losing the phone + spoofing Face ID
 *     is not a TMJConnect attack vector we defend against here; the session
 *     still needs a valid refresh token server-side.
 *   - Device with no biometric enrolled → the unlock gate is skipped. The
 *     user's SecureStore preference stays set; if they later enrol Face ID,
 *     it activates automatically.
 */

import * as LocalAuthentication from 'expo-local-authentication';
import * as SecureStore from 'expo-secure-store';

const PREF_KEY = 'tmjc.biometric_enabled';

export async function isDeviceCapable(): Promise<boolean> {
  const [hasHardware, isEnrolled] = await Promise.all([
    LocalAuthentication.hasHardwareAsync(),
    LocalAuthentication.isEnrolledAsync(),
  ]);
  return hasHardware && isEnrolled;
}

export async function getUserPreference(): Promise<boolean> {
  const v = await SecureStore.getItemAsync(PREF_KEY);
  return v === '1';
}

export async function setUserPreference(enabled: boolean): Promise<void> {
  await SecureStore.setItemAsync(PREF_KEY, enabled ? '1' : '0');
}

export type BiometricResult = { success: true } | { success: false; reason: 'cancelled' | 'failed' | 'unavailable' };

export async function authenticate(promptMessage: string): Promise<BiometricResult> {
  if (!(await isDeviceCapable())) return { success: false, reason: 'unavailable' };
  const result = await LocalAuthentication.authenticateAsync({
    promptMessage,
    disableDeviceFallback: false, // allow device passcode as fallback
    cancelLabel: 'Cancel',
  });
  if (result.success) return { success: true };
  return { success: false, reason: result.error === 'user_cancel' ? 'cancelled' : 'failed' };
}
