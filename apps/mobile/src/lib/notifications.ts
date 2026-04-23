/**
 * Local notification scheduling wrapper around expo-notifications.
 *
 * Push notifications (FCM) are stubbed for now — the server-side pipeline
 * will land with Phase 3d. What we do today:
 *
 *   - Request notification permissions (iOS + Android 13+).
 *   - Schedule weekly recurring local triggers for each active Reminder row,
 *     one per enabled weekday, so a reminder firing Mon + Thu creates two
 *     scheduled triggers.
 *   - Cancel all triggers for a reminder before re-scheduling (on edit) or
 *     on delete.
 *
 * Identifier shape: `reminder:<id>:<weekday>` — expo-notifications lets us
 * cancel by ID, and the shape lets us filter our own triggers without
 * stomping on unrelated ones that might be scheduled later.
 */

import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';

export type ReminderDay = 'mon' | 'tue' | 'wed' | 'thu' | 'fri' | 'sat' | 'sun';

// expo-notifications weekday: 1 = Sunday, 2 = Monday ... 7 = Saturday
const DAY_TO_WEEKDAY: Record<ReminderDay, number> = {
  sun: 1, mon: 2, tue: 3, wed: 4, thu: 5, fri: 6, sat: 7,
};

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowBanner: true,
    shouldShowList: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
    shouldShowAlert: true,
  }),
});

export async function requestPermissions(): Promise<boolean> {
  const current = await Notifications.getPermissionsAsync();
  if (current.granted) return true;
  if (!current.canAskAgain) return false;
  const next = await Notifications.requestPermissionsAsync({
    ios: { allowAlert: true, allowBadge: false, allowSound: true },
  });
  return next.granted;
}

export async function hasPermission(): Promise<boolean> {
  const { granted } = await Notifications.getPermissionsAsync();
  return granted;
}

/**
 * Schedule one weekly-recurring local notification per enabled day.
 *
 * Returns the array of scheduled identifiers so callers can persist them
 * if they want — we otherwise use the deterministic reminder:<id>:<day>
 * naming so that cancel-by-prefix works on re-sync.
 */
export async function scheduleReminder(params: {
  id: string;
  type: 'exercise' | 'symptom';
  time: string; // "HH:MM"
  days: ReminderDay[];
}): Promise<string[]> {
  await cancelReminder(params.id);

  const parts = params.time.split(':').map((s) => parseInt(s, 10));
  const hour = parts[0];
  const minute = parts[1];
  if (hour === undefined || minute === undefined || Number.isNaN(hour) || Number.isNaN(minute)) {
    return [];
  }

  const title = params.type === 'exercise'
    ? 'Exercise time'
    : 'Symptom check-in';
  const body = params.type === 'exercise'
    ? 'A gentle reminder to do your TMJ exercises.'
    : 'How has your pain been today? Log a quick entry.';

  const ids: string[] = [];
  for (const day of params.days) {
    const weekday = DAY_TO_WEEKDAY[day];
    const identifier = `reminder:${params.id}:${day}`;
    try {
      await Notifications.scheduleNotificationAsync({
        identifier,
        content: { title, body, data: { reminderId: params.id, type: params.type } },
        trigger: {
          type: Notifications.SchedulableTriggerInputTypes.WEEKLY,
          weekday,
          hour,
          minute,
        },
      });
      ids.push(identifier);
    } catch {
      // Swallow — unsupported platform / permissions revoked. Caller can
      // still show the reminder in the list; the server has the source of truth.
    }
  }
  return ids;
}

export async function cancelReminder(reminderId: string): Promise<void> {
  const all = await Notifications.getAllScheduledNotificationsAsync();
  const prefix = `reminder:${reminderId}:`;
  await Promise.all(
    all
      .filter((n) => n.identifier.startsWith(prefix))
      .map((n) => Notifications.cancelScheduledNotificationAsync(n.identifier)),
  );
}

export async function cancelAllReminders(): Promise<void> {
  const all = await Notifications.getAllScheduledNotificationsAsync();
  await Promise.all(
    all
      .filter((n) => n.identifier.startsWith('reminder:'))
      .map((n) => Notifications.cancelScheduledNotificationAsync(n.identifier)),
  );
}

export function isAndroid13Plus(): boolean {
  return Platform.OS === 'android' && Number(Platform.Version) >= 33;
}
