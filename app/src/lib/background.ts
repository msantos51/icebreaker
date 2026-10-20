// Android background heartbeat (WorkManager through expo-background-task, every ~15 minutes, with
// no visible notification). Must be imported at startup so the task is defined in global scope.
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as BackgroundTask from 'expo-background-task';
import * as TaskManager from 'expo-task-manager';
import { Platform } from 'react-native';

import * as UsageStats from '../../modules/usage-stats';
import { buildHeartbeat, type CoupleWindow, SCREEN_EVENTS_LOOKBACK_MS } from './heartbeat';
import { measurementAction, type PendingMeasurement } from './offphone';
import { supabase } from './supabase';

export const HEARTBEAT_TASK = 'icebreaker-heartbeat';
const WINDOW_KEY = 'couple:window';
const PENDING_KEY = 'offphone:pending';
const REPORTED_KEY = 'offphone:reported';
const INTERVAL_MINUTES = 15;

export const isAutoDetectionAvailable = Platform.OS === 'android' && UsageStats.isSupported;

/** Kept locally so the background task knows the window without querying the backend. */
export async function rememberCoupleWindow(window: CoupleWindow | null): Promise<void> {
  if (window) await AsyncStorage.setItem(WINDOW_KEY, JSON.stringify(window));
  else await AsyncStorage.removeItem(WINDOW_KEY);
}

async function sendHeartbeat(): Promise<void> {
  const stored = await AsyncStorage.getItem(WINDOW_KEY);
  if (!stored) return;

  const now = new Date();
  const events = UsageStats.getScreenEvents(new Date(now.getTime() - SCREEN_EVENTS_LOOKBACK_MS));
  const payload = buildHeartbeat(now, JSON.parse(stored), events, UsageStats.isDoNotDisturbOn());
  if (!payload) return;
  const { data } = await supabase.functions.invoke<{ measure: PendingMeasurement | null }>(
    'heartbeat',
    { method: 'POST', body: payload },
  );

  const measure = data?.measure;
  if (measure && measure.runId !== (await AsyncStorage.getItem(REPORTED_KEY))) {
    await AsyncStorage.setItem(PENDING_KEY, JSON.stringify(measure));
  }
}

/** Reports how long the phone stayed down after the last mission, once that is known. */
async function reportOffPhone(): Promise<void> {
  const stored = await AsyncStorage.getItem(PENDING_KEY);
  if (!stored) return;
  const pending: PendingMeasurement = JSON.parse(stored);

  const now = new Date();
  const events = UsageStats.getScreenEvents(new Date(new Date(pending.sentAt).getTime() - 60_000));
  const next = measurementAction(pending, events, now);
  if (next.action === 'wait') return;
  if (next.action === 'report') {
    const { error } = await supabase.functions.invoke('report-offphone', {
      method: 'POST',
      body: { runId: pending.runId, minutes: next.minutes },
    });
    if (error) throw error;
  }
  await AsyncStorage.setItem(REPORTED_KEY, pending.runId);
  await AsyncStorage.removeItem(PENDING_KEY);
}

async function runBackgroundWork(): Promise<void> {
  if (!UsageStats.hasPermission()) return;
  const { data } = await supabase.auth.getSession();
  if (!data.session) return;
  // The measurement may continue after the window closes; heartbeats stop at the window's end.
  await sendHeartbeat();
  await reportOffPhone();
}

if (isAutoDetectionAvailable) {
  TaskManager.defineTask(HEARTBEAT_TASK, async () => {
    try {
      await runBackgroundWork();
      return BackgroundTask.BackgroundTaskResult.Success;
    } catch (error) {
      console.warn('heartbeat failed', error);
      return BackgroundTask.BackgroundTaskResult.Failed;
    }
  });
}

/** Registers the periodic heartbeat once usage access was granted. Idempotent. */
export async function enableAutoDetection(): Promise<void> {
  if (!isAutoDetectionAvailable || !UsageStats.hasPermission()) return;
  if (await TaskManager.isTaskRegisteredAsync(HEARTBEAT_TASK)) return;
  await BackgroundTask.registerTaskAsync(HEARTBEAT_TASK, { minimumInterval: INTERVAL_MINUTES });
}

export async function disableAutoDetection(): Promise<void> {
  if (!isAutoDetectionAvailable) return;
  if (await TaskManager.isTaskRegisteredAsync(HEARTBEAT_TASK)) {
    await BackgroundTask.unregisterTaskAsync(HEARTBEAT_TASK);
  }
  await rememberCoupleWindow(null);
  await AsyncStorage.multiRemove([PENDING_KEY, REPORTED_KEY]);
}
