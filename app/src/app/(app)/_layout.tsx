import { Stack } from 'expo-router';

import { AccountProvider, isProfileComplete, useAccount } from '@/lib/account';

export default function AppLayout() {
  return (
    <AccountProvider>
      <AppStack />
    </AccountProvider>
  );
}

function AppStack() {
  const { profile, couple, loading } = useAccount();
  if (loading) return null;

  const hasProfile = isProfileComplete(profile);
  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Protected guard={!hasProfile}>
        <Stack.Screen name="profile" />
      </Stack.Protected>
      <Stack.Protected guard={hasProfile && !couple}>
        <Stack.Screen name="pair" />
      </Stack.Protected>
      <Stack.Protected guard={hasProfile && !!couple}>
        <Stack.Screen name="index" />
        <Stack.Screen name="settings" />
      </Stack.Protected>
    </Stack>
  );
}
