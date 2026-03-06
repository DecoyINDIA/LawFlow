import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { AppProvider, useApp } from '../src/context/AppContext';
import { useEffect } from 'react';
import { useRouter } from 'expo-router';
import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';
import {
  requestPermissions,
  scheduleDailyCheck,
  handleNotificationTap,
  getExpoPushToken,
} from '../src/utils/notificationService';
import { registerPushToken } from '../src/services/api';

function ThemedStatusBar() {
  const { settings } = useApp();
  return <StatusBar style={settings.darkMode ? 'light' : 'dark'} />;
}

function NotificationSetup() {
  const { hearings, cases, settings } = useApp();
  const router = useRouter();

  // Request permissions + schedule daily check on mount
  useEffect(() => {
    const init = async () => {
      const granted = await requestPermissions();
      const today = new Date(); today.setHours(0, 0, 0, 0);
      const missedCount = hearings.filter(
        h => h.hearingDate < today.getTime() && !h.outcome
      ).length;
      await scheduleDailyCheck(missedCount, settings);

      // Register push token with backend for daily digest
      if (granted) {
        const pushToken = await getExpoPushToken();
        if (pushToken) {
          registerPushToken(pushToken, Platform.OS).catch(() => {
            // Non-fatal — backend will retry on next app open
          });
        }
      }
    };
    init();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Notification tap handler
  useEffect(() => {
    if (Platform.OS === 'web') return;
    const sub = Notifications.addNotificationResponseReceivedListener(response => {
      handleNotificationTap(response, path => router.push(path as any));
    });
    return () => sub.remove();
  }, [router]);

  return null;
}

export default function RootLayout() {
  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <AppProvider>
          <ThemedStatusBar />
          <NotificationSetup />
          <Stack screenOptions={{ headerShown: false }}>
            <Stack.Screen name="index" options={{ animation: 'none' }} />
            <Stack.Screen name="login" options={{ animation: 'slide_from_right' }} />
            <Stack.Screen name="otp" options={{ animation: 'slide_from_right' }} />
            <Stack.Screen name="(tabs)" options={{ animation: 'fade' }} />
            <Stack.Screen name="cases/[id]" options={{ animation: 'slide_from_right' }} />
            <Stack.Screen name="cases/new" options={{ animation: 'slide_from_bottom', presentation: 'modal' }} />
            <Stack.Screen name="ecourts-review" options={{ animation: 'slide_from_right', headerShown: false }} />
            <Stack.Screen name="clients/[id]" options={{ animation: 'slide_from_right' }} />
            <Stack.Screen name="clients/new" options={{ animation: 'slide_from_bottom', presentation: 'modal' }} />
            <Stack.Screen name="notifications" options={{ animation: 'slide_from_right' }} />
            <Stack.Screen name="communication" options={{ animation: 'slide_from_right' }} />
            <Stack.Screen name="documents/index" options={{ animation: 'slide_from_right' }} />
            <Stack.Screen name="voice-notes" options={{ animation: 'slide_from_right' }} />
            <Stack.Screen name="analytics" options={{ animation: 'slide_from_right' }} />
            <Stack.Screen name="search" options={{ animation: 'slide_from_right' }} />
            <Stack.Screen name="export" options={{ animation: 'slide_from_right' }} />
            <Stack.Screen name="settings" options={{ animation: 'slide_from_right' }} />
            <Stack.Screen name="profile" options={{ animation: 'slide_from_right' }} />
            <Stack.Screen name="bulk-reminders" options={{ animation: 'slide_from_right' }} />
          </Stack>
        </AppProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}
