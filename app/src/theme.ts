import { useColorScheme } from 'react-native';

export const Colors = {
  light: {
    text: '#1C1B1A',
    textSecondary: '#5F5B57',
    background: '#FBF8F4',
    surface: '#F1ECE5',
    border: '#D9D2C9',
    accent: '#C8553D',
    onAccent: '#FFFFFF',
    error: '#B3261E',
  },
  dark: {
    text: '#F4F1EC',
    textSecondary: '#B3ADA6',
    background: '#151413',
    surface: '#24221F',
    border: '#3A3632',
    accent: '#E07A5F',
    onAccent: '#151413',
    error: '#F2B8B5',
  },
} as const;

export const Spacing = { xs: 4, sm: 8, md: 16, lg: 24, xl: 40 } as const;

export const Radius = { md: 12, lg: 20 } as const;

export function useColors() {
  return Colors[useColorScheme() === 'dark' ? 'dark' : 'light'];
}
