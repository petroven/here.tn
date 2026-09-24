import { useState } from 'react';
import { ScrollView, Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { useMutation } from '@tanstack/react-query';
import { KeyRound, Mail } from 'lucide-react-native';
import { authApi } from '@/api/endpoints';
import { errorMessage } from '@/api/client';
import { Button } from '@/components/ui/Button';
import { Header } from '@/components/ui/Header';
import { Input } from '@/components/ui/Input';
import { Screen } from '@/components/ui/Screen';
import { useTheme } from '@/theme/useTheme';
import type { RootScreenProps } from '@/navigation/types';

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/**
 * Mot de passe oublié : comme sur le site, un lien de réinitialisation
 * (valable 1 h) est envoyé par email ; le nouveau mot de passe se choisit
 * sur la page ouverte par ce lien.
 */
export function ForgotPasswordScreen({ navigation }: RootScreenProps<'ForgotPassword'>) {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const [email, setEmail] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [sent, setSent] = useState(false);

  const request = useMutation({
    mutationFn: () => authApi.forgotPassword(email.trim()),
    onSuccess: () => setSent(true),
    onError: (err) => setError(errorMessage(err, t('common.networkError'))),
  });

  const submit = () => {
    setError(null);
    if (!EMAIL_RE.test(email.trim())) return setError(t('auth.invalidEmail'));
    request.mutate();
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
            label={t('auth.email')}
            placeholder="exemple@mail.com"
            value={email}
            onChangeText={setEmail}
            autoCapitalize="none"
            keyboardType="email-address"
            autoComplete="email"
            editable={!sent}
            leftIcon={<Mail size={18} color={colors.muted} />}
            onSubmitEditing={submit}
          />
        </View>

        {sent && !error ? (
          <View className="mt-4 rounded-xl bg-green-50 p-3 dark:bg-green-900/30">
            <Text className="text-sm text-success">{t('auth.linkSent')}</Text>
          </View>
        ) : null}
        {error ? (
          <View className="mt-4 rounded-xl bg-red-50 p-3 dark:bg-red-900/30">
            <Text className="text-sm text-danger">{error}</Text>
          </View>
        ) : null}

        {sent ? (
          <Button title={t('auth.backToLogin')} size="lg" className="mt-6" onPress={() => navigation.replace('Login', { redirect: 'back' })} />
        ) : (
          <Button title={t('auth.sendLink')} size="lg" className="mt-6" loading={request.isPending} onPress={submit} />
        )}
      </ScrollView>
    </Screen>
  );
}
