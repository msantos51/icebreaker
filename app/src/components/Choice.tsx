import { Pressable, StyleSheet, Text, View } from 'react-native';

import { Radius, Spacing, useColors } from '@/theme';

interface ChoiceProps<T extends string | number> {
  options: { value: T; label: string }[];
  value: T;
  onChange: (value: T) => void;
}

/** Segmented single choice. */
export function Choice<T extends string | number>({ options, value, onChange }: ChoiceProps<T>) {
  const colors = useColors();
  return (
    <View style={styles.row} accessibilityRole="radiogroup">
      {options.map((option) => {
        const selected = option.value === value;
        return (
          <Pressable
            key={String(option.value)}
            accessibilityRole="radio"
            accessibilityState={{ selected }}
            onPress={() => onChange(option.value)}
            style={[
              styles.option,
              selected
                ? { backgroundColor: colors.accent, borderColor: colors.accent }
                : { borderColor: colors.border },
            ]}
          >
            <Text style={[styles.label, { color: selected ? colors.onAccent : colors.text }]}>
              {option.label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', gap: Spacing.sm },
  option: {
    flex: 1,
    minHeight: 44,
    borderWidth: 1,
    borderRadius: Radius.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  label: { fontSize: 16, fontWeight: '600' },
});
