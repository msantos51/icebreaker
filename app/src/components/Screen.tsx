import type { ReactNode } from 'react';
import { KeyboardAvoidingView, Platform, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Spacing, useColors } from '@/theme';

/** Full-screen container: content on top, `footer` (usually the buttons) pinned to the bottom. */
export function Screen({ children, footer }: { children: ReactNode; footer?: ReactNode }) {
  const colors = useColors();
  return (
    <SafeAreaView style={[styles.safeArea, { backgroundColor: colors.background }]}>
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <View style={styles.content}>{children}</View>
        {footer ? <View style={styles.footer}>{footer}</View> : null}
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1 },
  flex: { flex: 1 },
  content: { flex: 1, justifyContent: 'center', gap: Spacing.md, padding: Spacing.lg },
  footer: { gap: Spacing.sm, padding: Spacing.lg },
});
