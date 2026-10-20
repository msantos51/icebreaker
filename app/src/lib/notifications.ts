import * as Device from 'expo-device';
import * as Notifications from 'expo-notifications';
import { AndroidImportance } from 'expo-notifications';
import { Platform } from 'react-native';

import { supabase } from './supabase';

/** Must match ANDROID_CHANNEL_ID in supabase/functions/_shared/expo-push.ts. */
const ANDROID_CHANNEL_ID = 'missions';

// Missions are the whole point of a notification: show them even with the app open.
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowBanner: true,
    shouldShowList: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
  }),
});

export type PermissionState = 'granted' | 'undetermined' | 'denied';

export async function getPermission(): Promise<PermissionState> {
  const { status } = await Notifications.getPermissionsAsync();
  return status === 'granted' ? 'granted' : status === 'denied' ? 'denied' : 'undetermined';
}

export async function requestPermission(): Promise<PermissionState> {
  if (Platform.OS === 'android') {
    // The channel must exist before asking on Android 13+.
    await Notifications.setNotificationChannelAsync(ANDROID_CHANNEL_ID, {
      name: 'Missões',
      importance: AndroidImportance.HIGH,
    });
  }
  const { status } = await Notifications.requestPermissionsAsync();
  return status === 'granted' ? 'granted' : status === 'denied' ? 'denied' : 'undetermined';
}

/**
 * Sends this device's push token to the backend. Only the token is sent: nothing about how the
 * phone is used. No-op on simulators, which cannot receive push notifications.
 */
export async function registerPushToken(): Promise<void> {
  if (!Device.isDevice || (Platform.OS !== 'ios' && Platform.OS !== 'android')) return;
  const { data: token } = await Notifications.getExpoPushTokenAsync();
  const { error } = await supabase.rpc('register_push_token', {
    p_token: token,
    p_platform: Platform.OS,
  });
  if (error) throw error;
}
