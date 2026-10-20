import { router } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { Alert } from 'react-native';

import { Button } from '@/components/Button';
import { Screen } from '@/components/Screen';
import { Title } from '@/components/Text';
import { useAccount } from '@/lib/account';
import { supabase } from '@/lib/supabase';

export default function SettingsScreen() {
  const { t } = useTranslation();
  const { couple, refresh } = useAccount();

  function confirmUnpair() {
    Alert.alert(t('settings.unpairTitle'), t('settings.unpairBody'), [
      { text: t('common.cancel'), style: 'cancel' },
      {
        text: t('settings.unpair'),
        style: 'destructive',
        onPress: async () => {
          // Deleting the couple deletes its whole history (on delete cascade).
          const { error } = await supabase.from('couples').delete().eq('id', couple!.id);
          if (error) Alert.alert(t('common.genericError'));
          else await refresh();
        },
      },
    ]);
  }

  return (
    <Screen
      footer={
        <>
          <Button variant="secondary" label={t('settings.unpair')} onPress={confirmUnpair} />
          <Button
            variant="secondary"
            label={t('settings.signOut')}
            onPress={() => supabase.auth.signOut()}
          />
          <Button variant="secondary" label={t('common.back')} onPress={() => router.back()} />
        </>
      }
    >
      <Title>{t('settings.title')}</Title>
    </Screen>
  );
}
