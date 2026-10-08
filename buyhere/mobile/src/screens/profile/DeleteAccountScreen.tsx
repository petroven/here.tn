import { useState } from 'react';
import { ScrollView, Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Lock, TriangleAlert } from 'lucide-react-native';
import { errorMessage } from '@/api/client';
import { meApi } from '@/api/endpoints';
import { Button } from '@/components/ui/Button';
import { Header } from '@/components/ui/Header';
import { Input } from '@/components/ui/Input';
import { Screen } from '@/components/ui/Screen';
import { confirm, toast } from '@/components/ui/toast';
import { useAuthStore } from '@/store/auth';
import { useTheme } from '@/theme/useTheme';
import type { RootScreenProps } from '@/navigation/types';

/**
 * Suppression du compte (exigée par Google Play et l'App Store) : données
 * personnelles effacées, commandes conservées anonymisées. Confirmation par
 * le mot de passe — ou le mot SUPPRIMER pour un compte Google / Facebook.
 */
export function DeleteAccountScreen({ navigation }: RootScreenProps<'DeleteAccount'>) {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const qc = useQueryClient();
  const clearSession = useAuthStore((s) => s.clearSession);
  const [secret, setSecret] = useState('');
  const [error, setError] = useState<string | null>(null);

  const remove = useMutation({
    mutationFn: () => meApi.deleteAccount(secret),
    onSuccess: async () => {
      // Le serveur a déjà retiré les jetons push et coupé les sessions.
      await clearSession();
      qc.clear();
      toast(t('deleteAccount.done'));
      navigation.reset({ index: 0, routes: [{ name: 'Main' }] });
    },
    onError: (err) => setError(errorMessage(err, t('common.networkError'))),
  });

  const submit = () => {
    setError(null);
    confirm(
      t('deleteAccount.confirmTitle'),
      t('deleteAccount.confirmText'),
      {
        confirm: t('deleteAccount.submit'),
        cancel: t('common.cancel'),
      },
      () => remove.mutate(),
    );
  };

  return (
    <Screen keyboard>
      <Header title={t('deleteAccount.title')} />
      <ScrollView contentContainerClassName="p-5 pb-10 gap-4" keyboardShouldPersistTaps="handled">
        <View className="flex-row gap-3 rounded-2xl bg-red-50 p-4 dark:bg-red-900/30">
          <TriangleAlert size={22} color={colors.danger} />
          <View className="flex-1 gap-1.5">
            <Text className="font-bold text-danger">{t('deleteAccount.warningTitle')}</Text>
            <Text className="text-sm leading-5 text-ink dark:text-gray-200">{t('deleteAccount.erased')}</Text>
            <Text className="text-sm leading-5 text-ink dark:text-gray-200">{t('deleteAccount.kept')}</Text>
            <Text className="text-sm leading-5 text-ink dark:text-gray-200">{t('deleteAccount.blocked')}</Text>
          </View>
        </View>

        <Input
          label={t('deleteAccount.passwordLabel')}
          value={secret}
          onChangeText={setSecret}
          secureTextEntry
          autoCapitalize="none"
          leftIcon={<Lock size={18} color={colors.subtle} />}
          hint={t('deleteAccount.socialHint')}
          error={error}
        />

        <Button
          title={t('deleteAccount.submit')}
          variant="danger"
          size="lg"
          disabled={!secret.trim()}
          loading={remove.isPending}
          onPress={submit}
        />
      </ScrollView>
    </Screen>
  );
}
