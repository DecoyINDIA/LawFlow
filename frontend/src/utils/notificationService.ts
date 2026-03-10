import * as Notifications from 'expo-notifications';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Platform, Alert } from 'react-native';
import { Case, Hearing, AppSettings } from '../types';

// ── Constants ──────────────────────────────────────────────────────────
const PERMISSION_KEY = 'lawflow_notif_permission';
const NOTIF_PREFIX = 'lawflow_notif_';
export const DAILY_CHECK_ID = 'lawflow_daily_check';

// ── Configure notification handler (native only) ────────────────────────
if (Platform.OS !== 'web') {
  Notifications.setNotificationHandler({
    handleNotification: async () => ({
      shouldShowAlert: true,
      shouldPlaySound: true,
      shouldSetBadge: false,
    }),
  });
}

// ── FUNCTION 1 — requestPermissions ────────────────────────────────────
export async function requestPermissions(): Promise<boolean> {
  if (Platform.OS === 'web') return false;
  try {
    const { status, canAskAgain } = await Notifications.getPermissionsAsync();

    if (status === 'granted') {
      await AsyncStorage.setItem(PERMISSION_KEY, 'granted');
      return true;
    }

    if (canAskAgain) {
      const { status: newStatus } = await Notifications.requestPermissionsAsync();
      if (newStatus === 'granted') {
        await AsyncStorage.setItem(PERMISSION_KEY, 'granted');
        return true;
      }
      // Show one-time alert if denied
      const prev = await AsyncStorage.getItem(PERMISSION_KEY);
      if (prev !== 'denied-alerted') {
        Alert.alert(
          'Enable Notifications',
          'Enable notifications to get hearing reminders',
          [{ text: 'OK' }]
        );
        await AsyncStorage.setItem(PERMISSION_KEY, 'denied-alerted');
      }
      return false;
    }

    return false;
  } catch {
    return false;
  }
}

// ── FUNCTION 2 — scheduleHearingReminder ───────────────────────────────
export async function scheduleHearingReminder(
  hearing: Hearing,
  caseObj: Case,
  reminderDays: number
): Promise<void> {
  if (Platform.OS === 'web') return;
  try {
    await cancelHearingReminder(hearing.id);

    const triggerDate = new Date(hearing.hearingDate - reminderDays * 86400000);
    triggerDate.setHours(8, 0, 0, 0);
    if (triggerDate.getTime() <= Date.now()) return;

    const bodyDay =
      reminderDays === 0 ? 'today' :
      reminderDays === 1 ? 'tomorrow' :
      `in ${reminderDays} days`;

    const notifId = await Notifications.scheduleNotificationAsync({
      identifier: NOTIF_PREFIX + hearing.id,
      content: {
        title: `Hearing Reminder — ${caseObj.caseNumber}`,
        body: `You have a hearing at ${caseObj.courtName} ${bodyDay}`,
        data: { caseId: caseObj.id },
      },
      trigger: {
        type: Notifications.SchedulableTriggerInputTypes.DATE,
        date: triggerDate,
      },
    });

    await AsyncStorage.setItem(NOTIF_PREFIX + hearing.id, notifId);
  } catch {}
}

// ── FUNCTION 3 — cancelHearingReminder ────────────────────────────────
export async function cancelHearingReminder(hearingId: string): Promise<void> {
  if (Platform.OS === 'web') return;
  try {
    await Notifications.cancelScheduledNotificationAsync(NOTIF_PREFIX + hearingId);
    await AsyncStorage.removeItem(NOTIF_PREFIX + hearingId);
  } catch {}
}

// ── FUNCTION 4 — rescheduleAllReminders ───────────────────────────────
export async function rescheduleAllReminders(
  cases: Case[],
  hearings: Hearing[],
  settings: AppSettings
): Promise<number> {
  if (Platform.OS === 'web') return 0;
  try {
    await Notifications.cancelAllScheduledNotificationsAsync();
    if (!settings.hearingReminders) return 0;

    const now = Date.now();
    const caseMap = new Map(cases.map(c => [c.id, c]));
    let scheduled = 0;

    for (const hearing of hearings) {
      if (hearing.hearingDate <= now) continue;
      const caseObj = caseMap.get(hearing.caseId);
      if (!caseObj) continue;

      const triggerDate = new Date(
        hearing.hearingDate - settings.reminderDaysBeforeHearing * 86400000
      );
      triggerDate.setHours(8, 0, 0, 0);
      if (triggerDate.getTime() <= now) continue;

      const bodyDay =
        settings.reminderDaysBeforeHearing === 0 ? 'today' :
        settings.reminderDaysBeforeHearing === 1 ? 'tomorrow' :
        `in ${settings.reminderDaysBeforeHearing} days`;

      await Notifications.scheduleNotificationAsync({
        identifier: NOTIF_PREFIX + hearing.id,
        content: {
          title: `Hearing Reminder — ${caseObj.caseNumber}`,
          body: `You have a hearing at ${caseObj.courtName} ${bodyDay}`,
          data: { caseId: caseObj.id },
        },
        trigger: {
          type: Notifications.SchedulableTriggerInputTypes.DATE,
          date: triggerDate,
        },
      });

      await AsyncStorage.setItem(NOTIF_PREFIX + hearing.id, NOTIF_PREFIX + hearing.id);
      scheduled++;
    }

    return scheduled;
  } catch {
    return 0;
  }
}

// ── FUNCTION 5 — handleNotificationTap ────────────────────────────────
export function handleNotificationTap(
  response: Notifications.NotificationResponse,
  navigate: (path: string) => void
): void {
  const data = response.notification.request.content.data;
  // Handle firm invite deep link
  if (data?.type === 'firm_invite') {
    navigate('/firm');
    return;
  }
  const caseId = data?.caseId as string | undefined;
  if (caseId) navigate(`/cases/${caseId}`);
}

// ── Feature 4 — getExpoPushToken ──────────────────────────────────────
/**
 * Returns the device's Expo push token, or null if unavailable.
 * Call AFTER requestPermissions() has returned true.
 * Works in Expo Go (development) and standalone builds.
 */
export async function getExpoPushToken(): Promise<string | null> {
  if (Platform.OS === 'web') return null;
  try {
    const tokenData = await Notifications.getExpoPushTokenAsync();
    return tokenData.data;  // e.g. "ExponentPushToken[xxx]"
  } catch (err) {
    // getExpoPushTokenAsync requires a projectId in standalone builds.
    // In Expo Go this is inferred from the manifest automatically.
    console.warn('[notificationService] Could not get push token:', err);
    return null;
  }
}

// ── Feature 3 — scheduleDailyCheck ────────────────────────────────────
export async function scheduleDailyCheck(
  missedCount: number,
  settings: AppSettings
): Promise<void> {
  if (Platform.OS === 'web') return;
  try {
    await Notifications.cancelScheduledNotificationAsync(DAILY_CHECK_ID).catch(() => {});
    if (!settings.hearingReminders || missedCount === 0) return;

    const trigger = new Date();
    trigger.setHours(21, 0, 0, 0);
    if (trigger.getTime() <= Date.now()) {
      trigger.setDate(trigger.getDate() + 1);
    }

    await Notifications.scheduleNotificationAsync({
      identifier: DAILY_CHECK_ID,
      content: {
        title: 'LawFlow Daily Check',
        body: `You have ${missedCount} hearing(s) with no outcome recorded. Tap to review.`,
      },
      trigger: {
        type: Notifications.SchedulableTriggerInputTypes.DATE,
        date: trigger,
      },
    });
  } catch {}
}
