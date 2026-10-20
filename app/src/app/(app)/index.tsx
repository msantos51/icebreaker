import { useTranslation } from 'react-i18next';

import { Button } from '@/components/Button';
import { Screen } from '@/components/Screen';
import { Body, Title } from '@/components/Text';
import { supabase } from '@/lib/supabase';

export default function HomeScreen() {
  const { t } = useTranslation();
  return (
    <Screen
      footer={
        <Button
          variant="secondary"
          label={t('home.signOut')}
          onPress={() => supabase.auth.signOut()}
        />
      }
    >
      <Title>{t('common.appName')}</Title>
      <Body>{t('home.tagline')}</Body>
    </Screen>
  );
}
