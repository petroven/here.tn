import { useState } from 'react';
import { ScrollView, Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Bike, Lock, Mail, Phone, User } from 'lucide-react-native';
import { errorMessage } from '@/api/client';
import { courierApi, type VehicleType } from '@/api/courier';
import { Button } from '@/components/ui/Button';
import { Chip } from '@/components/ui/Chip';
import { Header } from '@/components/ui/Header';
import { Input } from '@/components/ui/Input';
import { Screen } from '@/components/ui/Screen';
import { unregisterPushToken } from '@/hooks/usePushNotifications';
import { useAuthStore, useIsLoggedIn } from '@/store/auth';
import { useTheme } from '@/theme/useTheme';
import type { RootScreenProps } from '@/navigation/types';

type Form = { firstName: string; lastName: string; email: string; phone: string; password: string; confirm: string };
type Errors = Partial<Record<keyof Form, string>>;

const VEHICLES: VehicleType[] = ['moto', 'voiture', 'velo', 'camionnette'];
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const PHONE_RE = /^(\+216|00216)?[2-9]\d{7}$/;
const PASSWORD_RE = /^(?=.*[A-Za-z])(?=.*\d).{8,72}$/;

/**
 * « Devenir livreur » : crée un compte livreur dédié (comme la page du site).
 * Un compte client ne se convertit pas : il faut un autre email.
 */
export function CourierRegisterScreen({ navigation }: RootScreenProps<'CourierRegister'>) {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const qc = useQueryClient();
  const loggedIn = useIsLoggedIn();
  const setSession = useAuthStore((s) => s.setSession);
  const [form, setForm] = useState<Form>({ firstName: '', lastName: '', email: '', phone: '', password: '', confirm: '' });
  const [vehicle, setVehicle] = useState<VehicleType>('moto');
  const [errors, setErrors] = useState<Errors>({});
  const [apiError, setApiError] = useState<string | null>(null);

  const set = (key: keyof Form) => (value: string) => setForm((f) => ({ ...f, [key]: value }));

  const validate = () => {
    const e: Errors = {};
    if (form.firstName.trim().length < 2) e.firstName = t('common.required');
    if (form.lastName.trim().length < 2) e.lastName = t('common.required');
    if (!EMAIL_RE.test(form.email.trim())) e.email = t('auth.invalidEmail');
    if (!PHONE_RE.test(form.phone.replace(/[\s.-]/g, ''))) e.phone = t('auth.invalidPhone');
    if (!PASSWORD_RE.test(form.password)) e.password = t('auth.weakPassword');
    if (form.confirm !== form.password) e.confirm = t('auth.passwordsMismatch');
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const register = useMutation({
    mutationFn: () => courierApi.register({ ...form, phone: form.phone.replace(/[\s.-]/g, ''), vehicle }),
    onSuccess: async (session) => {
      // Le téléphone ne doit plus recevoir les notifications de l'ancien compte.
      if (loggedIn) await unregisterPushToken();
      await setSession(session);
      qc.clear();
      navigation.reset({ index: 1, routes: [{ name: 'Main' }, { name: 'CourierHome' }] });
    },
    onError: (err) => setApiError(errorMessage(err, t('common.networkError'))),
  });

  const submit = () => {
    setApiError(null);
    if (validate()) register.mutate();
  };

  return (
    <Screen keyboard>
      <Header title={t('courier.becomeTitle')} />
      <ScrollView contentContainerClassName="p-5 pb-10 gap-4" keyboardShouldPersistTaps="handled">
        <View className="items-center">
          <View className="h-16 w-16 items-center justify-center rounded-2xl bg-primary-50 dark:bg-primary-900/40">
            <Bike size={30} color={colors.primary} />
          </View>
          <Text className="mt-3 text-center text-sm leading-5 text-ink-muted dark:text-gray-400">
            {t('courier.becomeText')}
          </Text>
        </View>

        {loggedIn ? (
          <View className="rounded-2xl bg-amber-50 p-3.5 dark:bg-amber-900/30">
            <Text className="text-xs leading-5 text-ink dark:text-gray-200">{t('courier.becomeLoggedIn')}</Text>
          </View>
        ) : null}

        {apiError ? (
          <View className="rounded-2xl bg-red-50 p-3.5 dark:bg-red-900/30">
            <Text className="text-sm text-danger">{apiError}</Text>
          </View>
        ) : null}

        <View className="flex-row gap-3">
          <View className="flex-1">
            <Input
              label={t('auth.firstName')}
              value={form.firstName}
              onChangeText={set('firstName')}
              error={errors.firstName}
              leftIcon={<User size={18} color={colors.subtle} />}
              autoComplete="given-name"
            />
          </View>
          <View className="flex-1">
            <Input
              label={t('auth.lastName')}
              value={form.lastName}
              onChangeText={set('lastName')}
              error={errors.lastName}
              autoComplete="family-name"
            />
          </View>
        </View>
        <Input
          label={t('auth.email')}
          value={form.email}
          onChangeText={set('email')}
          error={errors.email}
          leftIcon={<Mail size={18} color={colors.subtle} />}
          keyboardType="email-address"
          autoCapitalize="none"
          autoComplete="email"
        />
        <Input
          label={t('auth.phone')}
          value={form.phone}
          onChangeText={set('phone')}
          error={errors.phone}
          leftIcon={<Phone size={18} color={colors.subtle} />}
          keyboardType="phone-pad"
          autoComplete="tel"
          hint={t('courier.phoneHint')}
        />

        <View>
          <Text className="mb-2 text-sm font-medium text-ink dark:text-gray-200">{t('courier.vehicle')}</Text>
          <View className="flex-row flex-wrap gap-2">
            {VEHICLES.map((v) => (
              <Chip key={v} label={t(`courier.vehicles.${v}`)} selected={vehicle === v} onPress={() => setVehicle(v)} />
            ))}
          </View>
        </View>

        <Input
          label={t('auth.password')}
          value={form.password}
          onChangeText={set('password')}
          error={errors.password}
          hint={errors.password ? undefined : t('auth.weakPassword')}
          leftIcon={<Lock size={18} color={colors.subtle} />}
          secureTextEntry
          autoComplete="new-password"
        />
        <Input
          label={t('auth.confirmPassword')}
          value={form.confirm}
          onChangeText={set('confirm')}
          error={errors.confirm}
          leftIcon={<Lock size={18} color={colors.subtle} />}
          secureTextEntry
          autoComplete="new-password"
        />

        <Button title={t('courier.becomeSubmit')} size="lg" loading={register.isPending} onPress={submit} />
      </ScrollView>
    </Screen>
  );
}
