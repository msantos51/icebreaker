import { validateSettings } from '@icebreaker/core';
import { router } from 'expo-router';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Alert, StyleSheet, Text } from 'react-native';

import { Button } from '@/components/Button';
import { Choice } from '@/components/Choice';
import { Screen } from '@/components/Screen';
import { Stepper } from '@/components/Stepper';
import { Body, ErrorText, Title } from '@/components/Text';
import { TextField } from '@/components/TextField';
import { useAccount } from '@/lib/account';
import { shiftClock, toHHMM } from '@/lib/clock';
import { cleanName, isValidName, NAME_MAX_LENGTH } from '@/lib/profile';
import { supabase } from '@/lib/supabase';
import { Spacing, useColors } from '@/theme';

const WINDOW_STEP_MIN = 30;
const USAGE_STEP_MIN = 5;
const USAGE_MIN = 10;
const USAGE_MAX = 60;
/** Level 3 ("picante") arrives with the paid packs (Phase 4). */
const LEVELS = [1, 2] as const;

export default function SettingsScreen() {
  const { t } = useTranslation();
  const colors = useColors();
  const { profile, couple, refresh } = useAccount();
  const myLevelColumn = couple!.user_a_id === profile!.id ? 'level_a' : 'level_b';

  const [name, setName] = useState(profile!.display_name ?? '');
  const [nickname, setNickname] = useState(profile!.partner_nickname ?? '');
  const [windowStart, setWindowStart] = useState(toHHMM(couple!.window_start));
  const [windowEnd, setWindowEnd] = useState(toHHMM(couple!.window_end));
  const [level, setLevel] = useState<number>(couple![myLevelColumn]);
  const [usageThreshold, setUsageThreshold] = useState(couple!.usage_threshold_min);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  async function save() {
    setError(null);
    setNotice(null);
    if (!isValidName(name) || !isValidName(nickname)) {
      setError(t('profile.invalid'));
      return;
    }
    const problems = validateSettings({
      timezone: couple!.timezone,
      windowStart,
      windowEnd,
      usageThresholdMin: usageThreshold,
      silencePeriodMin: couple!.silence_period_min,
      maxMissionsPerNight: couple!.max_missions_per_night,
    });
    if (problems.length > 0) {
      setError(t('settings.invalidWindow'));
      return;
    }

    setSaving(true);
    const [profileUpdate, coupleUpdate] = await Promise.all([
      supabase
        .from('profiles')
        .update({ display_name: cleanName(name), partner_nickname: cleanName(nickname) })
        .eq('id', profile!.id),
      supabase
        .from('couples')
        .update({
          window_start: windowStart,
          window_end: windowEnd,
          usage_threshold_min: usageThreshold,
          [myLevelColumn]: level,
        })
        .eq('id', couple!.id),
    ]);
    setSaving(false);
    if (profileUpdate.error || coupleUpdate.error) {
      setError(t('common.genericError'));
      return;
    }
    setNotice(t('settings.saved'));
    await refresh();
  }

  function confirmUnpair() {
    Alert.alert(t('settings.unpairTitle'), t('settings.unpairBody'), [
      { text: t('common.cancel'), style: 'cancel' },
      {
        text: t('settings.unpair'),
        style: 'destructive',
        onPress: async () => {
          // Deleting the couple deletes its whole history (on delete cascade).
          const { error: deleteError } = await supabase
            .from('couples')
            .delete()
            .eq('id', couple!.id);
          if (deleteError) Alert.alert(t('common.genericError'));
          else await refresh();
        },
      },
    ]);
  }

  const section = (title: string) => (
    <Text accessibilityRole="header" style={[styles.section, { color: colors.text }]}>
      {title}
    </Text>
  );

  return (
    <Screen
      scroll
      footer={
        <>
          <Button label={t('common.save')} onPress={save} loading={saving} />
          <Button variant="secondary" label={t('common.back')} onPress={() => router.back()} />
        </>
      }
    >
      <Title>{t('settings.title')}</Title>

      {section(t('settings.names'))}
      <TextField
        label={t('profile.nameLabel')}
        value={name}
        onChangeText={setName}
        maxLength={NAME_MAX_LENGTH}
      />
      <TextField
        label={t('profile.nicknameLabel')}
        value={nickname}
        onChangeText={setNickname}
        maxLength={NAME_MAX_LENGTH}
        autoCorrect={false}
      />

      {section(t('settings.window'))}
      <Body>{t('settings.windowHint')}</Body>
      <Stepper
        label={t('settings.from')}
        value={windowStart}
        onDecrement={() => setWindowStart(shiftClock(windowStart, -WINDOW_STEP_MIN))}
        onIncrement={() => setWindowStart(shiftClock(windowStart, WINDOW_STEP_MIN))}
        decrementLabel={t('settings.earlier')}
        incrementLabel={t('settings.later')}
      />
      <Stepper
        label={t('settings.to')}
        value={windowEnd}
        onDecrement={() => setWindowEnd(shiftClock(windowEnd, -WINDOW_STEP_MIN))}
        onIncrement={() => setWindowEnd(shiftClock(windowEnd, WINDOW_STEP_MIN))}
        decrementLabel={t('settings.earlier')}
        incrementLabel={t('settings.later')}
      />

      {section(t('settings.usage'))}
      <Body>{t('settings.usageHint')}</Body>
      <Stepper
        label={t('settings.usage')}
        value={t('settings.usageValue', { count: usageThreshold })}
        onDecrement={() => setUsageThreshold(Math.max(USAGE_MIN, usageThreshold - USAGE_STEP_MIN))}
        onIncrement={() => setUsageThreshold(Math.min(USAGE_MAX, usageThreshold + USAGE_STEP_MIN))}
        decrementLabel={t('settings.less')}
        incrementLabel={t('settings.more')}
      />

      {section(t('settings.level'))}
      <Body>{t('settings.levelHint')}</Body>
      <Choice
        options={LEVELS.map((value) => ({ value, label: t(`settings.levels.${value}`) }))}
        value={level}
        onChange={setLevel}
      />

      {error ? <ErrorText>{error}</ErrorText> : null}
      {notice ? <Body>{notice}</Body> : null}

      {section(t('settings.account'))}
      <Button variant="secondary" label={t('settings.unpair')} onPress={confirmUnpair} />
      <Button
        variant="secondary"
        label={t('settings.signOut')}
        onPress={() => supabase.auth.signOut()}
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  section: { fontSize: 20, fontWeight: '600', marginTop: Spacing.md },
});
