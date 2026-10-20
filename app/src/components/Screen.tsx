import type { ReactNode } from 'react';
import { KeyboardAvoidingView, Platform, ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Spacing, useColors } from '@/theme';

interface ScreenProps {
  children: ReactNode;
  /** Usually the buttons, pinned to the bottom. */
  footer?: ReactNode;
  /** Scrollable, top-aligned content (forms); otherwise content is centred. */
  scroll?: boolean;
}

export function Screen({ children, footer, scroll }: ScreenProps) {
  const colors = useColors();
  return (
    <SafeAreaView style={[styles.flex, { backgroundColor: colors.background }]}>
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        {scroll ? (
          <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
            {children}
          </ScrollView>
        ) : (
          <View style={styles.content}>{children}</View>
        )}
        {footer ? <View style={styles.footer}>{footer}</View> : null}
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  content: { flex: 1, justifyContent: 'center', gap: Spacing.md, padding: Spacing.lg },
  scroll: { gap: Spacing.md, padding: Spacing.lg },
  footer: { gap: Spacing.sm, padding: Spacing.lg },
});
