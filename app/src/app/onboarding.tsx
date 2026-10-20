import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { StyleSheet, View } from 'react-native';

import { Button } from '@/components/Button';
import { Screen } from '@/components/Screen';
import { Body, Title } from '@/components/Text';
import { useOnboarding } from '@/lib/onboarding';
import { Spacing, useColors } from '@/theme';

const PAGE_COUNT = 3;

export default function OnboardingScreen() {
  const { t } = useTranslation();
  const { finish } = useOnboarding();
  const colors = useColors();
  const [page, setPage] = useState(0);
  const isLast = page === PAGE_COUNT - 1;

  return (
    <Screen
      footer={
        <Button
          label={isLast ? t('common.start') : t('common.next')}
          onPress={() => (isLast ? finish() : setPage(page + 1))}
        />
      }
    >
      <Title>{t(`onboarding.pages.${page}.title`)}</Title>
      <Body>{t(`onboarding.pages.${page}.body`)}</Body>
      <View style={styles.dots} accessibilityLabel={`${page + 1} / ${PAGE_COUNT}`}>
        {Array.from({ length: PAGE_COUNT }, (_, i) => (
          <View
            key={i}
            style={[styles.dot, { backgroundColor: i === page ? colors.accent : colors.border }]}
          />
        ))}
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  dots: { flexDirection: 'row', gap: Spacing.sm, marginTop: Spacing.md },
  dot: { width: 8, height: 8, borderRadius: 4 },
});
