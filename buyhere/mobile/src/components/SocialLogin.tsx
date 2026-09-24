import { useState } from 'react';
import { ActivityIndicator, Pressable, Text, View } from 'react-native';
import Svg, { Path } from 'react-native-svg';
import { useTranslation } from 'react-i18next';
import { useQueryClient } from '@tanstack/react-query';
import { authApi } from '@/api/endpoints';
import { errorMessage } from '@/api/client';
import { useAuthStore } from '@/store/auth';
import { useTheme } from '@/theme/useTheme';

type Provider = 'google' | 'facebook';

/**
 * « Ou connectez-vous avec » — mêmes boutons Google / Facebook que la fenêtre
 * de connexion du site, mêmes comptes.
 */
export function SocialLogin({ onSuccess, onError }: { onSuccess: () => void; onError: (message: string) => void }) {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const qc = useQueryClient();
  const setSession = useAuthStore((s) => s.setSession);
  const [pending, setPending] = useState<Provider | null>(null);

  const signIn = async (provider: Provider) => {
    setPending(provider);
    try {
      const session = await authApi.oauth(provider);
      if (!session) return; // page fermée par l'utilisateur
      await setSession(session);
      qc.invalidateQueries();
      onSuccess();
    } catch (err) {
      onError(errorMessage(err, t('common.networkError')));
    } finally {
      setPending(null);
    }
  };

  return (
    <View className="mt-6">
      <View className="flex-row items-center gap-3">
        <View className="h-px flex-1 bg-[#E2D9CB] dark:bg-gray-700" />
        <Text className="text-xs font-semibold text-ink-subtle">{t('auth.orContinueWith')}</Text>
        <View className="h-px flex-1 bg-[#E2D9CB] dark:bg-gray-700" />
      </View>
      <View className="mt-4 flex-row justify-center gap-4">
        <Pressable
          onPress={() => signIn('google')}
          disabled={!!pending}
          className="h-12 w-12 items-center justify-center rounded-full border border-[#E2D9CB] bg-white active:opacity-80"
          accessibilityRole="button"
          accessibilityLabel={t('auth.continueWithGoogle')}
        >
          {pending === 'google' ? (
            <ActivityIndicator color={colors.primary} />
          ) : (
            <Svg width={22} height={22} viewBox="0 0 48 48">
              <Path fill="#4285F4" d="M45.12 24.5c0-1.56-.14-3.06-.4-4.5H24v8.51h11.84c-.51 2.75-2.06 5.08-4.39 6.64v5.52h7.11c4.16-3.83 6.56-9.47 6.56-16.17z" />
              <Path fill="#34A853" d="M24 46c5.94 0 10.92-1.97 14.56-5.33l-7.11-5.52c-1.97 1.32-4.49 2.1-7.45 2.1-5.73 0-10.58-3.87-12.31-9.07H4.34v5.7C7.96 41.07 15.4 46 24 46z" />
              <Path fill="#FBBC05" d="M11.69 28.18A13.98 13.98 0 0 1 10.9 24c0-1.45.25-2.86.69-4.18v-5.7H4.34A21.99 21.99 0 0 0 2 24c0 3.55.85 6.91 2.34 9.88l7.35-5.7z" />
              <Path fill="#EA4335" d="M24 10.75c3.23 0 6.13 1.11 8.41 3.29l6.31-6.31C34.91 4.18 29.93 2 24 2 15.4 2 7.96 6.93 4.34 14.12l7.35 5.7c1.73-5.2 6.58-9.07 12.31-9.07z" />
            </Svg>
          )}
        </Pressable>
        <Pressable
          onPress={() => signIn('facebook')}
          disabled={!!pending}
          className="h-12 w-12 items-center justify-center rounded-full bg-[#1877F2] active:opacity-80"
          accessibilityRole="button"
          accessibilityLabel={t('auth.continueWithFacebook')}
        >
          {pending === 'facebook' ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Svg width={20} height={20} viewBox="0 0 24 24">
              <Path
                fill="#fff"
                d="M22 12.06C22 6.5 17.52 2 12 2S2 6.5 2 12.06c0 5.02 3.66 9.18 8.44 9.94v-7.03H7.9v-2.91h2.54V9.85c0-2.5 1.49-3.89 3.77-3.89 1.09 0 2.23.2 2.23.2v2.46h-1.26c-1.24 0-1.63.77-1.63 1.56v1.88h2.78l-.45 2.91h-2.33V22c4.78-.76 8.44-4.92 8.44-9.94z"
              />
            </Svg>
          )}
        </Pressable>
      </View>
    </View>
  );
}
