import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Share, StyleSheet, Text } from 'react-native';

import { Button } from '@/components/Button';
import { Screen } from '@/components/Screen';
import { Body, ErrorText, Title } from '@/components/Text';
import { TextField } from '@/components/TextField';
import { useAccount } from '@/lib/account';
import { normalizePairingCode, PAIRING_CODE_LENGTH, pairingError, timeLeft } from '@/lib/pairing';
import { supabase } from '@/lib/supabase';
import { useColors } from '@/theme';

/** While showing our code, check this often whether the partner already redeemed it. */
const POLL_INTERVAL_MS = 3000;

type Mode =
  { kind: 'choose' } | { kind: 'show'; code: string; expiresAt: Date } | { kind: 'enter' };

export default function PairScreen() {
  const { t } = useTranslation();
  const { refresh } = useAccount();
  const colors = useColors();
  const [mode, setMode] = useState<Mode>({ kind: 'choose' });
  const [input, setInput] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [now, setNow] = useState(() => new Date());

  // Tick the countdown and poll for the partner while our code is on screen.
  useEffect(() => {
    if (mode.kind !== 'show') return;
    const tick = setInterval(() => setNow(new Date()), 1000);
    const poll = setInterval(refresh, POLL_INTERVAL_MS);
    return () => {
      clearInterval(tick);
      clearInterval(poll);
    };
  }, [mode.kind, refresh]);

  async function generate() {
    setLoading(true);
    setError(null);
    const { data, error: rpcError } = await supabase.rpc('create_pairing_code').single<{
      code: string;
      expires_at: string;
    }>();
    setLoading(false);
    if (rpcError || !data) {
      setError(t(`pairing.errors.${pairingError(rpcError?.message)}`));
      return;
    }
    setNow(new Date());
    setMode({ kind: 'show', code: data.code, expiresAt: new Date(data.expires_at) });
  }

  async function redeem() {
    setLoading(true);
    setError(null);
    const { error: rpcError } = await supabase.rpc('redeem_pairing_code', { p_code: input });
    if (rpcError) {
      setLoading(false);
      setError(t(`pairing.errors.${pairingError(rpcError.message)}`));
      return;
    }
    await refresh();
  }

  const back = (
    <Button
      variant="secondary"
      label={t('common.back')}
      onPress={() => {
        setMode({ kind: 'choose' });
        setError(null);
      }}
    />
  );

  if (mode.kind === 'show') {
    const left = timeLeft(mode.expiresAt, now);
    return (
      <Screen
        footer={
          <>
            {left ? (
              <Button
                label={t('pairing.share')}
                onPress={() =>
                  Share.share({ message: t('pairing.shareMessage', { code: mode.code }) })
                }
              />
            ) : (
              <Button label={t('pairing.generate')} onPress={generate} loading={loading} />
            )}
            {back}
          </>
        }
      >
        <Title>{t('pairing.codeTitle')}</Title>
        <Text
          selectable
          accessibilityLabel={mode.code.split('').join(' ')}
          style={[styles.code, { color: colors.text }]}
        >
          {mode.code}
        </Text>
        <Body>{left ? t('pairing.codeBody', { time: left }) : t('pairing.expired')}</Body>
        {error ? <ErrorText>{error}</ErrorText> : null}
      </Screen>
    );
  }

  if (mode.kind === 'enter') {
    return (
      <Screen
        footer={
          <>
            <Button
              label={t('pairing.pair')}
              onPress={redeem}
              loading={loading}
              disabled={input.length !== PAIRING_CODE_LENGTH}
            />
            {back}
          </>
        }
      >
        <Title>{t('pairing.haveCode')}</Title>
        <TextField
          label={t('pairing.enterLabel')}
          value={input}
          onChangeText={(value) => setInput(normalizePairingCode(value))}
          autoCapitalize="characters"
          autoCorrect={false}
          maxLength={PAIRING_CODE_LENGTH}
          style={styles.input}
          autoFocus
        />
        {error ? <ErrorText>{error}</ErrorText> : null}
      </Screen>
    );
  }

  return (
    <Screen
      footer={
        <>
          <Button label={t('pairing.generate')} onPress={generate} loading={loading} />
          <Button
            variant="secondary"
            label={t('pairing.haveCode')}
            onPress={() => setMode({ kind: 'enter' })}
          />
        </>
      }
    >
      <Title>{t('pairing.title')}</Title>
      <Body>{t('pairing.body')}</Body>
      {error ? <ErrorText>{error}</ErrorText> : null}
    </Screen>
  );
}

const styles = StyleSheet.create({
  code: { fontSize: 44, fontWeight: '700', letterSpacing: 8, fontVariant: ['tabular-nums'] },
  input: { fontSize: 24, letterSpacing: 6 },
});
