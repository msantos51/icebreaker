import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { AppState, StyleSheet, View } from 'react-native';

import { Button } from '@/components/Button';
import { Body, Title } from '@/components/Text';
import { enableAutoDetection, isAutoDetectionAvailable } from '@/lib/background';
import { Radius, Spacing, useColors } from '@/theme';

import * as UsageStats from '../../modules/usage-stats';

/**
 * Android only: asks for "Usage access" so the app can trigger missions on its own. Optional: the
 * "Estamos aborrecidos" button works without it.
 */
export function UsageAccessPrompt() {
  const { t } = useTranslation();
  const colors = useColors();
  const [granted, setGranted] = useState(() => UsageStats.hasPermission());

  // The permission is granted in the system settings: check again when the user comes back.
  useEffect(() => {
    if (!isAutoDetectionAvailable) return;
    const subscription = AppState.addEventListener('change', (state) => {
      if (state === 'active') setGranted(UsageStats.hasPermission());
    });
    return () => subscription.remove();
  }, []);

  useEffect(() => {
    if (granted) enableAutoDetection().catch(console.warn);
  }, [granted]);

  if (!isAutoDetectionAvailable || granted) return null;

  return (
    <View style={[styles.card, { backgroundColor: colors.surface }]}>
      <Title style={styles.title}>{t('usageAccess.title')}</Title>
      <Body>{t('usageAccess.body')}</Body>
      <Button
        variant="secondary"
        label={t('usageAccess.grant')}
        onPress={() => UsageStats.openPermissionSettings()}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  card: { gap: Spacing.sm, padding: Spacing.md, borderRadius: Radius.lg },
  title: { fontSize: 20 },
});
