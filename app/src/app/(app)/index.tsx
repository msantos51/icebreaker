import { router } from 'expo-router';
import { useTranslation } from 'react-i18next';

import { Button } from '@/components/Button';
import { NotificationsPrompt } from '@/components/NotificationsPrompt';
import { Screen } from '@/components/Screen';
import { Body, Title } from '@/components/Text';

export default function HomeScreen() {
  const { t } = useTranslation();
  return (
    <Screen
      footer={
        <Button
          variant="secondary"
          label={t('home.settings')}
          onPress={() => router.push('/settings')}
        />
      }
    >
      <Title>{t('common.appName')}</Title>
      <Body>{t('home.tagline')}</Body>
      <NotificationsPrompt />
    </Screen>
  );
}
