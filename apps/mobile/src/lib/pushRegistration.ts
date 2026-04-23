/**
 * Registers the device's push token with the API. Call after sign-in and each
 * time the app comes back to the foreground while authed. Safely no-ops on
 * simulator / when permission isn't granted.
 */

import Constants from 'expo-constants';
import * as Device from 'expo-device';
import * as Notifications from 'expo-notifications';
import { updateFcmToken } from './auth.api';

export async function registerPushTokenIfGranted(): Promise<boolean> {
  try {
    if (!Device.isDevice) return false;
    const perm = await Notifications.getPermissionsAsync();
    if (!perm.granted) return false;

    const projectId =
      Constants.expoConfig?.extra?.eas?.projectId ??
      Constants.easConfig?.projectId;

    // Prefer the Expo push token since the server layer hands off to FCM/APNs
    // through Expo's push service. If projectId is the placeholder, we fall
    // back to the native device token (still stored by the API, still routable
    // once FCM/APNs certs are wired).
    let token: string | null = null;
    try {
      const res = await Notifications.getExpoPushTokenAsync(
        projectId && projectId !== 'placeholder-replace-before-first-eas-build'
          ? { projectId }
          : undefined,
      );
      token = res.data;
    } catch {
      const dev = await Notifications.getDevicePushTokenAsync();
      token = dev.data as string;
    }

    if (!token) return false;
    await updateFcmToken(token);
    return true;
  } catch {
    // Never let push registration block the app — worst case, no push.
    return false;
  }
}
