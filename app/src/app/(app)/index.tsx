import { snoozeUntil } from '@icebreaker/core';
import { router } from 'expo-router';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';

import { Button } from '@/components/Button';
import { NotificationsPrompt } from '@/components/NotificationsPrompt';
import { Screen } from '@/components/Screen';
import { Body, ErrorText, Title } from '@/components/Text';
import { useAccount } from '@/lib/account';
import { supabase } from '@/lib/supabase';

/**
 * The only screen of the app, on purpose: one button to ask for a mission, one to say "not today".
 * No history, no scores, nothing to come back for.
 */
export default function HomeScreen() {
  const { t } = useTranslation();
  const { profile, couple, refresh } = useAccount();
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<'bored' | 'snooze' | null>(null);

  const snoozed = !!profile?.snoozed_until && new Date(profile.snoozed_until) > new Date();

  async function bored() {
    setBusy('bored');
    setMessage(null);
    setError(null);
    const { data, error: invokeError } = await supabase.functions.invoke<{ sent: boolean }>(
      'trigger-mission',
      { method: 'POST' },
    );
    setBusy(null);
    if (invokeError) setError(t('common.genericError'));
    // Never say why it was blocked: it could reveal the partner's "hoje não".
    else setMessage(data?.sent ? t('home.boredSent') : t('home.boredBlocked'));
  }

  async function setSnooze(on: boolean) {
    setBusy('snooze');
    setMessage(null);
    setError(null);
    const until = on ? snoozeUntil(new Date(), couple!.timezone).toISOString() : null;
    const { error: updateError } = await supabase
      .from('profiles')
      .update({ snoozed_until: until })
      .eq('id', profile!.id);
    if (updateError) setError(t('common.genericError'));
    else await refresh();
    setBusy(null);
  }

  return (
    <Screen
      footer={
        <>
          {snoozed ? (
            <Button
              variant="secondary"
              label={t('home.undoNotToday')}
              onPress={() => setSnooze(false)}
              loading={busy === 'snooze'}
            />
          ) : (
            <>
              <Button label={t('home.bored')} onPress={bored} loading={busy === 'bored'} />
              <Button
                variant="secondary"
                label={t('home.notToday')}
                onPress={() => setSnooze(true)}
                loading={busy === 'snooze'}
              />
            </>
          )}
          <Button
            variant="secondary"
            label={t('home.settings')}
            onPress={() => router.push('/settings')}
          />
        </>
      }
    >
      <Title>{t('common.appName')}</Title>
      <Body>{snoozed ? t('home.notTodayActive') : t('home.tagline')}</Body>
      {message ? <Body>{message}</Body> : null}
      {error ? <ErrorText>{error}</ErrorText> : null}
      <NotificationsPrompt />
    </Screen>
  );
}
