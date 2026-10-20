import { useState } from 'react';
import { useTranslation } from 'react-i18next';

import { Button } from '@/components/Button';
import { Screen } from '@/components/Screen';
import { Body, ErrorText, Title } from '@/components/Text';
import { TextField } from '@/components/TextField';
import { useAccount } from '@/lib/account';
import { cleanName, isValidName, NAME_MAX_LENGTH } from '@/lib/profile';
import { useSession } from '@/lib/session';
import { supabase } from '@/lib/supabase';

export default function ProfileScreen() {
  const { t } = useTranslation();
  const { session } = useSession();
  const { profile, refresh } = useAccount();
  const [name, setName] = useState(profile?.display_name ?? '');
  const [nickname, setNickname] = useState(profile?.partner_nickname ?? '');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function save() {
    if (!isValidName(name) || !isValidName(nickname)) {
      setError(t('profile.invalid'));
      return;
    }
    setLoading(true);
    setError(null);
    const { error: updateError } = await supabase
      .from('profiles')
      .update({ display_name: cleanName(name), partner_nickname: cleanName(nickname) })
      .eq('id', session!.user.id);
    if (updateError) {
      setLoading(false);
      setError(t('common.genericError'));
      return;
    }
    await refresh();
  }

  return (
    <Screen footer={<Button label={t('common.save')} onPress={save} loading={loading} />}>
      <Title>{t('profile.title')}</Title>
      <Body>{t('profile.body')}</Body>
      <TextField
        label={t('profile.nameLabel')}
        value={name}
        onChangeText={setName}
        maxLength={NAME_MAX_LENGTH}
        autoComplete="given-name"
        textContentType="givenName"
      />
      <TextField
        label={t('profile.nicknameLabel')}
        value={nickname}
        onChangeText={setNickname}
        maxLength={NAME_MAX_LENGTH}
        autoCorrect={false}
      />
      <Body>
        {t('profile.nicknameHint', {
          name: cleanName(nickname) || t('profile.nicknameExample'),
        })}
      </Body>
      {error ? <ErrorText>{error}</ErrorText> : null}
    </Screen>
  );
}
