import { Pressable, StyleSheet, Text, View } from 'react-native';

import { Radius, Spacing, useColors } from '@/theme';

interface StepperProps {
  label: string;
  value: string;
  onDecrement: () => void;
  onIncrement: () => void;
  decrementLabel: string;
  incrementLabel: string;
}

export function Stepper(props: StepperProps) {
  const colors = useColors();
  const button = (symbol: string, onPress: () => void, accessibilityLabel: string) => (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${props.label}: ${accessibilityLabel}`}
      onPress={onPress}
      hitSlop={8}
      style={({ pressed }) => [
        styles.button,
        { borderColor: colors.border, opacity: pressed ? 0.6 : 1 },
      ]}
    >
      <Text style={[styles.symbol, { color: colors.text }]}>{symbol}</Text>
    </Pressable>
  );

  return (
    <View style={styles.row}>
      <Text style={[styles.label, { color: colors.textSecondary }]}>{props.label}</Text>
      {button('−', props.onDecrement, props.decrementLabel)}
      <Text style={[styles.value, { color: colors.text }]}>{props.value}</Text>
      {button('+', props.onIncrement, props.incrementLabel)}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: Spacing.md },
  label: { flex: 1, fontSize: 17 },
  value: { fontSize: 20, fontWeight: '600', minWidth: 64, textAlign: 'center' },
  button: {
    width: 44,
    height: 44,
    borderRadius: Radius.md,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  symbol: { fontSize: 22 },
});
