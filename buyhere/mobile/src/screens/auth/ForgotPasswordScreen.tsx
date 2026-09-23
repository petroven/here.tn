import { useState } from 'react';
import { ScrollView, Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { useMutation } from '@tanstack/react-query';
import { KeyRound, Lock, Mail } from 'lucide-react-native';
import { authApi } from '@/api/endpoints';
import { errorMessage } from '@/api/client';
import { Button } from '@/components/ui/Button';
import { Header } from '@/components/ui/Header';
import { Input } from '@/components/ui/Input';
import { Screen } from '@/components/ui/Screen';
import { toast } from '@/components/ui/toast';
import { useTheme } from '@/theme/useTheme';
import type { RootScreenProps } from '@/navigation/types';

/**
 * Mot de passe oublié en 2 étapes :
 *  1. email/téléphone → envoi d'un code à 6 chiffres
 *  2. code + nouveau mot de passe
 */
export function ForgotPasswordScreen({ navigation }: RootScreenProps<'ForgotPassword'>) {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const [identifier, setIdentifier] = useState('');
  const [code, setCode] = useState('');
  const [password, setPassword] = useState('');
  const [step, setStep] = useState<'request' | 'reset'>('request');
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);

  const requestCode = useMutation({
    mutationFn: () => authApi.forgotPassword(identifier.trim()),
    onSuccess: (res) => {
      setStep('reset');
      // En développement, l'API renvoie le code pour faciliter les tests.
      setInfo(res.devCode ? `${t('auth.codeSent')} (dev : ${res.devCode})` : t('auth.codeSent'));
    },
    onError: (err) => setError(errorMessage(err, t('common.networkError'))),
  });

  const reset = useMutation({
    mutationFn: () => authApi.resetPassword(identifier.trim(), code.trim(), password),
    onSuccess: () => {
      toast(t('auth.resetSuccess'));
      navigation.replace('Login', { redirect: 'back' });
    },
    onError: (err) => setError(errorMessage(err, t('common.networkError'))),
  });

  const submit = () => {
    setError(null);
    if (step === 'request') {
      if (identifier.trim().length < 3) return setError(t('common.required'));
      requestCode.mutate();
    } else {
      if (!/^\d{6}$/.test(code.trim())) return setError(t('auth.code'));
      if (!/^(?=.*[A-Za-z])(?=.*\d).{8,72}$/.test(password)) return setError(t('auth.weakPassword'));
      reset.mutate();
    }
  };

  return (
    <Screen keyboard edges={['top', 'bottom']}>
      <Header title={t('auth.forgotTitle')} transparent />
      <ScrollView contentContainerClassName="px-6 pb-8" keyboardShouldPersistTaps="handled">
        <View className="mb-6 mt-2 h-16 w-16 items-center justify-center rounded-2xl bg-primary-50 dark:bg-primary-900/30">
          <KeyRound size={30} color={colors.primary} />
        </View>
        <Text className="text-base leading-6 text-ink-muted dark:text-gray-400">{t('auth.forgotSubtitle')}</Text>

        <View className="mt-6 gap-4">
          <Input
            label={t('auth.identifier')}
            placeholder={t('auth.identifierPlaceholder')}
            value={identifier}
            onChangeText={setIdentifier}
            autoCapitalize="none"
            keyboardType="email-address"
            editable={step === 'request'}
            leftIcon={<Mail size={18} color={colors.muted} />}
          />
          {step === 'reset' ? (
            <>
              <Input
                label={t('auth.code')}
                value={code}
                onChangeText={(v) => setCode(v.replace(/\D/g, '').slice(0, 6))}
                keyboardType="number-pad"
                autoComplete="one-time-code"
                textContentType="oneTimeCode"
                placeholder="••••••"
                className="tracking-[6px]"
              />
              <Input
                label={t('auth.newPassword')}
                value={password}
                onChangeText={setPassword}
                secureTextEntry
                hint={t('auth.passwordHint')}
                autoComplete="new-password"
                leftIcon={<Lock size={18} color={colors.muted} />}
              />
            </>
          ) : null}
        </View>

        {info && !error ? (
          <View className="mt-4 rounded-xl bg-green-50 p-3 dark:bg-green-900/30">
            <Text className="text-sm text-success">{info}</Text>
          </View>
        ) : null}
        {error ? (
          <View className="mt-4 rounded-xl bg-red-50 p-3 dark:bg-red-900/30">
            <Text className="text-sm text-danger">{error}</Text>
          </View>
        ) : null}

        <Button
          title={step === 'request' ? t('auth.sendCode') : t('auth.resetPassword')}
          size="lg"
          className="mt-6"
          loading={requestCode.isPending || reset.isPending}
          onPress={submit}
        />
        {step === 'reset' ? (
          <Button
            title={t('auth.sendCode')}
            variant="ghost"
            className="mt-2"
            disabled={requestCode.isPending}
            onPress={() => requestCode.mutate()}
          />
        ) : null}
      </ScrollView>
    </Screen>
  );
}
