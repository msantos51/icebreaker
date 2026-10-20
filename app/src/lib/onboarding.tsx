import AsyncStorage from '@react-native-async-storage/async-storage';
import { createContext, type ReactNode, useCallback, useContext, useEffect, useState } from 'react';

const KEY = 'onboarding:done';

interface OnboardingState {
  /** Null while reading from storage. */
  done: boolean | null;
  finish: () => Promise<void>;
}

const OnboardingContext = createContext<OnboardingState>({ done: null, finish: async () => {} });

export function OnboardingProvider({ children }: { children: ReactNode }) {
  const [done, setDone] = useState<boolean | null>(null);

  useEffect(() => {
    AsyncStorage.getItem(KEY)
      .then((value) => setDone(value === '1'))
      .catch(() => setDone(false));
  }, []);

  const finish = useCallback(async () => {
    await AsyncStorage.setItem(KEY, '1');
    setDone(true);
  }, []);

  return (
    <OnboardingContext.Provider value={{ done, finish }}>{children}</OnboardingContext.Provider>
  );
}

export function useOnboarding(): OnboardingState {
  return useContext(OnboardingContext);
}
