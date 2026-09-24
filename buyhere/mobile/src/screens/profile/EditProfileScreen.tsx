import { useState } from 'react';
import { ScrollView, Text, View } from 'react-native';
import { Image } from 'expo-image';
import { useTranslation } from 'react-i18next';
import { useMutation } from '@tanstack/react-query';
import { Lock, Phone, User } from 'lucide-react-native';
import { meApi } from '@/api/endpoints';
import { errorMessage } from '@/api/client';
import { Button } from '@/components/ui/Button';
import { Header } from '@/components/ui/Header';
import { Input } from '@/components/ui/Input';
import { Screen } from '@/components/ui/Screen';
import { toast } from '@/components/ui/toast';
import { useAuthStore } from '@/store/auth';
import { useTheme } from '@/theme/useTheme';
import { formatPhone } from '@/utils/format';
import type { RootScreenProps } from '@/navigation/types';

const PHONE_RE = /^(\+216|00216)?[2-9]\d{7}$/;
const PASSWORD_RE = /^(?=.*[A-Za-z])(?=.*\d).{8,72}$/;

/** Informations personnelles et mot de passe (même compte que sur le site web). */
export function EditProfileScreen({ navigation }: RootScreenProps<'EditProfile'>) {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const user = useAuthStore((s) => s.user)!;
  const setUser = useAuthStore((s) => s.setUser);
  const [firstName, setFirstName] = useState(user.firstName);
  const [lastName, setLastName] = useState(user.lastName);
  const [phone, setPhone] = useState(formatPhone(user.phone));
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [error, setError] = useState<string | null>(null);

  const save = useMutation({
    mutationFn: () => {
      const cleaned = phone.replace(/[\s.-]/g, '');
      if (cleaned && !PHONE_RE.test(cleaned)) throw new Error(t('auth.invalidPhone'));
      return meApi.update({ firstName: firstName.trim(), lastName: lastName.trim(), phone: cleaned || null });
    },
    onSuccess: async (updated) => {
      await setUser(updated);
      toast(t('profile.saved'));
      navigation.goBack();
    },
    onError: (err) => setError(err instanceof Error && !('code' in err) ? err.message : errorMessage(err, t('common.networkError'))),
  });

  const changePassword = useMutation({
    mutationFn: () => {
      if (!PASSWORD_RE.test(newPassword)) throw new Error(t('auth.weakPassword'));
      return meApi.changePassword(currentPassword, newPassword);
    },
    onSuccess: () => {
      setCurrentPassword('');
      setNewPassword('');
      toast(t('profile.saved'));
    },
    onError: (err) => toast(err instanceof Error && !('code' in err) ? err.message : errorMessage(err, t('common.networkError'))),
  });

  return (
    <Screen keyboard>
      <Header title={t('profile.personalInfo')} />
      <ScrollView contentContainerClassName="px-4 pb-10 pt-5" keyboardShouldPersistTaps="handled">
        {/* Photo (celle du compte Google/Facebook le cas échéant) */}
        <View className="mb-6 items-center">
            {user.avatarUrl ? (
              <Image source={{ uri: user.avatarUrl }} style={{ width: 96, height: 96, borderRadius: 48 }} />
            ) : (
              <View className="h-24 w-24 items-center justify-center rounded-full bg-primary">
                <Text className="text-3xl font-bold text-white">{user.firstName.charAt(0)}</Text>
              </View>
            )}
        </View>

        <View className="gap-4">
          <Input label={t('auth.firstName')} value={firstName} onChangeText={setFirstName} leftIcon={<User size={18} color={colors.muted} />} />
          <Input label={t('auth.lastName')} value={lastName} onChangeText={setLastName} />
          <Input label={t('auth.email')} value={user.email} editable={false} className="text-ink-muted" />
          <Input
            label={t('auth.phone')}
            value={phone}
            onChangeText={setPhone}
            keyboardType="phone-pad"
            placeholder="22 123 456"
            leftIcon={<Phone size={18} color={colors.muted} />}
          />
        </View>
        {error ? <Text className="mt-3 text-sm text-danger">{error}</Text> : null}
        <Button title={t('common.save')} className="mt-5" loading={save.isPending} onPress={() => (setError(null), save.mutate())} />

        {/* Mot de passe */}
        <Text className="mb-3 mt-10 text-lg font-bold text-ink dark:text-gray-100">{t('profile.changePassword')}</Text>
        <View className="gap-4">
          <Input
            label={t('profile.currentPassword')}
            value={currentPassword}
            onChangeText={setCurrentPassword}
            secureTextEntry
            leftIcon={<Lock size={18} color={colors.muted} />}
          />
          <Input
            label={t('auth.newPassword')}
            value={newPassword}
            onChangeText={setNewPassword}
            secureTextEntry
            hint={t('auth.passwordHint')}
            leftIcon={<Lock size={18} color={colors.muted} />}
          />
        </View>
        <Button
          title={t('profile.changePassword')}
          variant="outline"
          className="mt-5"
          disabled={!currentPassword || !newPassword}
          loading={changePassword.isPending}
          onPress={() => changePassword.mutate()}
        />
      </ScrollView>
    </Screen>
  );
}
