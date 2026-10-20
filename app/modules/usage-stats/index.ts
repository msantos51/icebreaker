import type { ScreenEvent } from '@icebreaker/core';
import { requireOptionalNativeModule } from 'expo';

interface NativeUsageStats {
  isSupported: boolean;
  hasPermission(): boolean;
  openPermissionSettings(): void;
  getScreenEvents(sinceMs: number): { type: 'on' | 'off'; at: number }[];
  isDoNotDisturbOn(): boolean;
}

// Android only. On iOS (Screen Time API, Phase 3) and web the module is absent.
const native = requireOptionalNativeModule<NativeUsageStats>('UsageStats');

/** Whether automatic detection can work on this device (Android 9+). */
export const isSupported = native?.isSupported ?? false;

/** Whether the user granted "Usage access" in the system settings. */
export function hasPermission(): boolean {
  return native?.hasPermission() ?? false;
}

/** Opens the system "Usage access" page, where the user can grant the permission. */
export function openPermissionSettings(): void {
  native?.openPermissionSettings();
}

/** Screen on/off events since the given instant. They stay on the device. */
export function getScreenEvents(since: Date): ScreenEvent[] {
  return (native?.getScreenEvents(since.getTime()) ?? []).map((e) => ({
    type: e.type,
    at: new Date(e.at),
  }));
}

export function isDoNotDisturbOn(): boolean {
  return native?.isDoNotDisturbOn() ?? false;
}
