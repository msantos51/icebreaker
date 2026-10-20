import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Linking, StyleSheet, View } from 'react-native';

import { Button } from '@/components/Button';
import { Body, Title } from '@/components/Text';
import {
  getPermission,
  type PermissionState,
  registerPushToken,
  requestPermission,
} from '@/lib/notifications';
import { Radius, Spacing, useColors } from '@/theme';

/** Registers the push token when allowed; otherwise asks for permission. */
export function NotificationsPrompt() {
  const { t } = useTranslation();
  const colors = useColors();
  const [permission, setPermission] = useState<PermissionState | null>(null);

  useEffect(() => {
    getPermission().then(setPermission);
  }, []);

  useEffect(() => {
    if (permission === 'granted') registerPushToken().catch(console.warn);
  }, [permission]);

  if (permission === null || permission === 'granted') return null;

  return (
    <View style={[styles.card, { backgroundColor: colors.surface }]}>
      <Title style={styles.title}>{t('notifications.title')}</Title>
      <Body>{t('notifications.body')}</Body>
      {permission === 'undetermined' ? (
        <Button
          label={t('notifications.enable')}
          onPress={async () => setPermission(await requestPermission())}
        />
      ) : (
        <Button
          variant="secondary"
          label={t('notifications.openSettings')}
          onPress={() => Linking.openSettings()}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  card: { gap: Spacing.sm, padding: Spacing.md, borderRadius: Radius.lg },
  title: { fontSize: 20 },
});
