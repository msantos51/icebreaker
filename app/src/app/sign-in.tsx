import { useState } from 'react';
import { useTranslation } from 'react-i18next';

import { Button } from '@/components/Button';
import { Screen } from '@/components/Screen';
import { Body, ErrorText, Title } from '@/components/Text';
import { TextField } from '@/components/TextField';
import { isCompleteOtp, isValidEmail, normalizeEmail, normalizeOtp, OTP_LENGTH } from '@/lib/auth';
import { supabase } from '@/lib/supabase';

export default function SignInScreen() {
  const { t } = useTranslation();
  const [step, setStep] = useState<'email' | 'code'>('email');
  const [email, setEmail] = useState('');
  const [code, setCode] = useState('');
  const [message, setMessage] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function sendCode() {
    if (!isValidEmail(email)) {
      setMessage(t('signIn.invalidEmail'));
      return;
    }
    setLoading(true);
    setMessage(null);
    setNotice(null);
    const { error } = await supabase.auth.signInWithOtp({
      email: normalizeEmail(email),
      options: { shouldCreateUser: true },
    });
    setLoading(false);
    if (error) {
      setMessage(t('signIn.sendFailed'));
      return;
    }
    if (step === 'code') setNotice(t('signIn.codeResent'));
    setStep('code');
  }

  async function verify() {
    setLoading(true);
    setMessage(null);
    const { error } = await supabase.auth.verifyOtp({
      email: normalizeEmail(email),
      token: normalizeOtp(code),
      type: 'email',
    });
    setLoading(false);
    // On success the session listener in the root layout takes over the navigation.
    if (error) setMessage(t('signIn.invalidCode'));
  }

  if (step === 'email') {
    return (
      <Screen footer={<Button label={t('signIn.sendCode')} onPress={sendCode} loading={loading} />}>
        <Title>{t('signIn.title')}</Title>
        <Body>{t('signIn.body')}</Body>
        <TextField
          label={t('signIn.emailLabel')}
          value={email}
          onChangeText={setEmail}
          onSubmitEditing={sendCode}
          autoCapitalize="none"
          autoComplete="email"
          autoCorrect={false}
          keyboardType="email-address"
          textContentType="emailAddress"
          returnKeyType="send"
        />
        {message ? <ErrorText>{message}</ErrorText> : null}
      </Screen>
    );
  }

  return (
    <Screen
      footer={
        <>
          <Button
            label={t('signIn.verify')}
            onPress={verify}
            loading={loading}
            disabled={!isCompleteOtp(code)}
          />
          <Button variant="secondary" label={t('signIn.resend')} onPress={sendCode} />
          <Button
            variant="secondary"
            label={t('signIn.changeEmail')}
            onPress={() => {
              setStep('email');
              setCode('');
              setMessage(null);
              setNotice(null);
            }}
          />
        </>
      }
    >
      <Title>{t('signIn.codeTitle')}</Title>
      <Body>{t('signIn.codeBody', { email: normalizeEmail(email) })}</Body>
      <TextField
        label={t('signIn.codeLabel')}
        value={code}
        onChangeText={(value) => setCode(normalizeOtp(value))}
        keyboardType="number-pad"
        autoComplete="one-time-code"
        textContentType="oneTimeCode"
        maxLength={OTP_LENGTH}
        autoFocus
      />
      {notice ? <Body>{notice}</Body> : null}
      {message ? <ErrorText>{message}</ErrorText> : null}
    </Screen>
  );
}
