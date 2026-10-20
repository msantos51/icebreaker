import { Text as RNText, type TextProps } from 'react-native';

import { useColors } from '@/theme';

export function Title({ style, ...props }: TextProps) {
  const colors = useColors();
  return (
    <RNText
      accessibilityRole="header"
      style={[{ color: colors.text, fontSize: 28, fontWeight: '700' }, style]}
      {...props}
    />
  );
}

export function Body({ style, ...props }: TextProps) {
  const colors = useColors();
  return (
    <RNText
      style={[{ color: colors.textSecondary, fontSize: 17, lineHeight: 24 }, style]}
      {...props}
    />
  );
}

export function ErrorText({ style, ...props }: TextProps) {
  const colors = useColors();
  return (
    <RNText
      accessibilityLiveRegion="polite"
      style={[{ color: colors.error, fontSize: 15 }, style]}
      {...props}
    />
  );
}
