import type { PushMessage, PushResult, PushSender } from './send-mission.ts';

const EXPO_PUSH_URL = 'https://exp.host/--/api/v2/push/send';
/** Expo accepts at most 100 messages per request. */
const BATCH_SIZE = 100;

/** Android notification channel created by the app (see app/src/lib/notifications.ts). */
export const ANDROID_CHANNEL_ID = 'missions';

interface ExpoTicket {
  status: 'ok' | 'error';
  details?: { error?: string };
}

export function createExpoPushSender(
  accessToken?: string,
  fetchImpl: typeof fetch = fetch,
): PushSender {
  return {
    async send(messages: PushMessage[]): Promise<PushResult[]> {
      const results: PushResult[] = [];
      for (let i = 0; i < messages.length; i += BATCH_SIZE) {
        const batch = messages.slice(i, i + BATCH_SIZE).map((m) => ({
          ...m,
          sound: 'default',
          priority: 'high',
          channelId: ANDROID_CHANNEL_ID,
        }));
        const response = await fetchImpl(EXPO_PUSH_URL, {
          method: 'POST',
          headers: {
            Accept: 'application/json',
            'Content-Type': 'application/json',
            ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
          },
          body: JSON.stringify(batch),
        });
        if (!response.ok) {
          throw new Error(`Expo push failed with HTTP ${response.status}`);
        }
        const { data } = (await response.json()) as { data: ExpoTicket[] };
        for (const ticket of data) {
          results.push(
            ticket.status === 'ok'
              ? { ok: true }
              : { ok: false, deviceNotRegistered: ticket.details?.error === 'DeviceNotRegistered' },
          );
        }
      }
      return results;
    },
  };
}
