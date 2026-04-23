/**
 * Optional biometric-unlock credential store. When the user opts in after a
 * successful password login we stash their email + password in the system
 * keychain with a biometric-protected access control. On next sign-in they can
 * tap "Sign in with Face ID" to re-auth without typing the password.
 *
 * Why store the password? The API has no long-lived session that survives a
 * full app reinstall, and no device-auth API. After app-wipe or refresh-token
 * expiry we need a clean credential to exchange for a new token pair. A
 * biometric-gated keychain entry is the standard way to do that and matches
 * spec §7.5.
 */

import * as LocalAuthentication from 'expo-local-authentication';
import * as SecureStore from 'expo-secure-store';

const KEY = 'tmjc.bio.cred';
const OPT_IN_KEY = 'tmjc.bio.optIn';

const STORE_OPTS: SecureStore.SecureStoreOptions = {
  keychainAccessible: SecureStore.WHEN_UNLOCKED_THIS_DEVICE_ONLY,
  requireAuthentication: true,
  authenticationPrompt: 'Unlock TMJConnect',
};

type StoredCred = { email: string; password: string };

export async function canUseBiometrics(): Promise<boolean> {
  const hasHw = await LocalAuthentication.hasHardwareAsync().catch(() => false);
  if (!hasHw) return false;
  const enrolled = await LocalAuthentication.isEnrolledAsync().catch(() => false);
  return enrolled;
}

export async function hasBiometricCredentialStored(): Promise<boolean> {
  try {
    const flag = await SecureStore.getItemAsync(OPT_IN_KEY);
    return flag === '1';
  } catch {
    return false;
  }
}

export async function storeBiometricCredential(cred: StoredCred): Promise<void> {
  await SecureStore.setItemAsync(KEY, JSON.stringify(cred), STORE_OPTS);
  await SecureStore.setItemAsync(OPT_IN_KEY, '1');
}

export async function readBiometricCredential(): Promise<StoredCred | null> {
  try {
    const raw = await SecureStore.getItemAsync(KEY, STORE_OPTS);
    return raw ? (JSON.parse(raw) as StoredCred) : null;
  } catch {
    // User cancelled prompt or auth failed — treat as no credential.
    return null;
  }
}

export async function clearBiometricCredential(): Promise<void> {
  await SecureStore.deleteItemAsync(KEY).catch(() => {});
  await SecureStore.deleteItemAsync(OPT_IN_KEY).catch(() => {});
}
