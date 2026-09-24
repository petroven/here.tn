import { useState } from 'react';
import { Pressable, ScrollView, Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Lock, Mail, X } from 'lucide-react-native';
import { authApi } from '@/api/endpoints';
import { errorMessage } from '@/api/client';
import { SocialLogin } from '@/components/SocialLogin';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Screen } from '@/components/ui/Screen';
import { useAuthStore } from '@/store/auth';
import { useTheme } from '@/theme/useTheme';
import type { RootScreenProps } from '@/navigation/types';

/** Connexion par email et mot de passe — le même compte que sur le site web. */
export function LoginScreen({ navigation, route }: RootScreenProps<'Login'>) {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const qc = useQueryClient();
  const setSession = useAuthStore((s) => s.setSession);
  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);

  const afterLogin = () => {
    if (route.params?.redirect === 'back' && navigation.canGoBack()) navigation.goBack();
    else navigation.reset({ index: 0, routes: [{ name: 'Main' }] });
  };

  const login = useMutation({
    mutationFn: () => authApi.login(identifier.trim(), password),
    onSuccess: async (session) => {
      await setSession(session);
      qc.invalidateQueries(); // recharge panier, favoris, prix personnalisés...
      afterLogin();
    },
    onError: (err) => setError(errorMessage(err, t('common.networkError'))),
  });

  const submit = () => {
    setError(null);
    if (!identifier.trim() || !password) return setError(t('common.required'));
    login.mutate();
  };

  return (
    <Screen keyboard edges={['top', 'bottom']}>
      <ScrollView contentContainerClassName="flex-grow px-6 pb-8" keyboardShouldPersistTaps="handled">
        <View className="h-12 flex-row items-center justify-end">
          <Pressable onPress={() => navigation.goBack()} hitSlop={10} accessibilityLabel={t('common.close')}>
            <X size={24} color={colors.text} />
          </Pressable>
        </View>

        <Text className="mt-4 text-3xl font-extrabold text-ink dark:text-gray-100">{t('auth.loginTitle')}</Text>
        <Text className="mt-2 text-base text-ink-muted dark:text-gray-400">{t('auth.loginSubtitle')}</Text>

        <View className="mt-8 gap-4">
          <Input
            label={t('auth.email')}
            placeholder="exemple@mail.com"
            value={identifier}
            onChangeText={setIdentifier}
            autoCapitalize="none"
            autoComplete="email"
            keyboardType="email-address"
            textContentType="username"
            leftIcon={<Mail size={18} color={colors.muted} />}
            returnKeyType="next"
          />
          <Input
            label={t('auth.password')}
            value={password}
            onChangeText={setPassword}
            secureTextEntry
            autoComplete="current-password"
            textContentType="password"
            leftIcon={<Lock size={18} color={colors.muted} />}
            returnKeyType="go"
            onSubmitEditing={submit}
          />
          <Pressable onPress={() => navigation.navigate('ForgotPassword')} className="self-end" hitSlop={8}>
            <Text className="font-semibold text-primary">{t('auth.forgotPassword')}</Text>
          </Pressable>
        </View>

        {error ? (
          <View className="mt-4 rounded-xl bg-red-50 p-3 dark:bg-red-900/30">
            <Text className="text-sm text-danger">{error}</Text>
          </View>
        ) : null}

        <Button title={t('auth.login')} size="lg" className="mt-6" loading={login.isPending} onPress={submit} />

        <SocialLogin onSuccess={afterLogin} onError={setError} />

        <View className="mt-6 flex-row justify-center gap-1">
          <Text className="text-ink-muted dark:text-gray-400">{t('auth.noAccount')}</Text>
          <Pressable onPress={() => navigation.replace('Register')} hitSlop={8}>
            <Text className="font-bold text-primary">{t('auth.register')}</Text>
          </Pressable>
        </View>

        <Pressable onPress={() => navigation.goBack()} className="mt-auto items-center pt-8" hitSlop={8}>
          <Text className="font-medium text-ink-muted underline dark:text-gray-400">{t('auth.continueAsGuest')}</Text>
        </Pressable>
      </ScrollView>
    </Screen>
  );
}
