import { useState } from 'react';
import { Pressable, ScrollView, Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Check, Lock, Mail, Phone, User, X } from 'lucide-react-native';
import { authApi } from '@/api/endpoints';
import { errorMessage } from '@/api/client';
import { SocialLogin } from '@/components/SocialLogin';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Screen } from '@/components/ui/Screen';
import { useAuthStore } from '@/store/auth';
import { useTheme } from '@/theme/useTheme';
import type { RootScreenProps } from '@/navigation/types';

type Form = {
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  password: string;
  confirm: string;
};
type Errors = Partial<Record<keyof Form, string>>;

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const PHONE_RE = /^(\+216|00216)?[2-9]\d{7}$/;
const PASSWORD_RE = /^(?=.*[A-Za-z])(?=.*\d).{8,72}$/;

/** Inscription : validation côté client (même règles que l'API) avant envoi. */
export function RegisterScreen({ navigation }: RootScreenProps<'Register'>) {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const qc = useQueryClient();
  const setSession = useAuthStore((s) => s.setSession);
  const [form, setForm] = useState<Form>({ firstName: '', lastName: '', email: '', phone: '', password: '', confirm: '' });
  const [errors, setErrors] = useState<Errors>({});
  const [apiError, setApiError] = useState<string | null>(null);
  // Le site exige une acceptation explicite des conditions de vente et de retour.
  const [accepted, setAccepted] = useState(false);
  const [termsError, setTermsError] = useState(false);

  const set = (key: keyof Form) => (value: string) => setForm((f) => ({ ...f, [key]: value }));

  const validate = (): boolean => {
    const e: Errors = {};
    if (form.firstName.trim().length < 2) e.firstName = t('common.required');
    if (form.lastName.trim().length < 2) e.lastName = t('common.required');
    if (!EMAIL_RE.test(form.email.trim())) e.email = t('auth.invalidEmail');
    const phone = form.phone.replace(/[\s.-]/g, '');
    if (phone && !PHONE_RE.test(phone)) e.phone = t('auth.invalidPhone');
    if (!PASSWORD_RE.test(form.password)) e.password = t('auth.weakPassword');
    if (form.confirm !== form.password) e.confirm = t('auth.passwordsMismatch');
    setErrors(e);
    setTermsError(!accepted);
    return Object.keys(e).length === 0 && accepted;
  };

  const register = useMutation({
    mutationFn: () =>
      authApi.register({
        firstName: form.firstName.trim(),
        lastName: form.lastName.trim(),
        email: form.email.trim().toLowerCase(),
        phone: form.phone.trim() || undefined,
        password: form.password,
      }),
    onSuccess: async (session) => {
      await setSession(session);
      qc.invalidateQueries();
      navigation.reset({ index: 0, routes: [{ name: 'Main' }] });
    },
    onError: (err) => setApiError(errorMessage(err, t('common.networkError'))),
  });

  const submit = () => {
    setApiError(null);
    if (validate()) register.mutate();
  };

  return (
    <Screen keyboard edges={['top', 'bottom']}>
      <ScrollView contentContainerClassName="px-6 pb-10" keyboardShouldPersistTaps="handled">
        <View className="h-12 flex-row items-center justify-end">
          <Pressable onPress={() => navigation.goBack()} hitSlop={10} accessibilityLabel={t('common.close')}>
            <X size={24} color={colors.text} />
          </Pressable>
        </View>

        <Text className="mt-2 text-3xl font-extrabold text-ink dark:text-gray-100">{t('auth.registerTitle')}</Text>
        <Text className="mt-2 text-base text-ink-muted dark:text-gray-400">{t('auth.registerSubtitle')}</Text>

        <View className="mt-7 gap-4">
          <View className="flex-row gap-3">
            <Input
              containerClassName="flex-1"
              label={t('auth.firstName')}
              value={form.firstName}
              onChangeText={set('firstName')}
              error={errors.firstName}
              autoComplete="given-name"
              leftIcon={<User size={18} color={colors.muted} />}
            />
            <Input
              containerClassName="flex-1"
              label={t('auth.lastName')}
              value={form.lastName}
              onChangeText={set('lastName')}
              error={errors.lastName}
              autoComplete="family-name"
            />
          </View>
          <Input
            label={t('auth.email')}
            value={form.email}
            onChangeText={set('email')}
            error={errors.email}
            keyboardType="email-address"
            autoCapitalize="none"
            autoComplete="email"
            leftIcon={<Mail size={18} color={colors.muted} />}
          />
          <Input
            label={t('auth.phoneOptional')}
            value={form.phone}
            onChangeText={set('phone')}
            error={errors.phone}
            keyboardType="phone-pad"
            autoComplete="tel"
            placeholder="22 123 456"
            leftIcon={
              <View className="flex-row items-center gap-1.5">
                <Phone size={18} color={colors.muted} />
                <Text className="text-ink-muted">+216</Text>
              </View>
            }
          />
          <Input
            label={t('auth.password')}
            value={form.password}
            onChangeText={set('password')}
            error={errors.password}
            hint={t('auth.passwordHint')}
            secureTextEntry
            autoComplete="new-password"
            textContentType="newPassword"
            leftIcon={<Lock size={18} color={colors.muted} />}
          />
          <Input
            label={t('auth.confirmPassword')}
            value={form.confirm}
            onChangeText={set('confirm')}
            error={errors.confirm}
            secureTextEntry
            autoComplete="new-password"
            leftIcon={<Lock size={18} color={colors.muted} />}
            onSubmitEditing={submit}
          />
        </View>

        {apiError ? (
          <View className="mt-4 rounded-xl bg-red-50 p-3 dark:bg-red-900/30">
            <Text className="text-sm text-danger">{apiError}</Text>
          </View>
        ) : null}

        <Pressable
          onPress={() => (setAccepted((v) => !v), setTermsError(false))}
          className="mt-5 flex-row items-start gap-3"
          accessibilityRole="checkbox"
          accessibilityState={{ checked: accepted }}
        >
          <View
            className={`mt-0.5 h-5 w-5 items-center justify-center rounded-md border-2 ${
              accepted ? 'border-primary bg-primary' : termsError ? 'border-danger' : 'border-gray-300 dark:border-gray-600'
            }`}
          >
            {accepted ? <Check size={14} color="#fff" strokeWidth={3} /> : null}
          </View>
          <Text className={`flex-1 text-sm ${termsError ? 'text-danger' : 'text-ink-muted dark:text-gray-400'}`}>
            {t('auth.acceptTerms')}
          </Text>
        </Pressable>

        <Button title={t('auth.register')} size="lg" className="mt-6" loading={register.isPending} onPress={submit} />

        <SocialLogin onSuccess={() => navigation.reset({ index: 0, routes: [{ name: 'Main' }] })} onError={setApiError} />

        <View className="mt-6 flex-row justify-center gap-1">
          <Text className="text-ink-muted dark:text-gray-400">{t('auth.haveAccount')}</Text>
          <Pressable onPress={() => navigation.replace('Login', { redirect: 'back' })} hitSlop={8}>
            <Text className="font-bold text-primary">{t('auth.login')}</Text>
          </Pressable>
        </View>
      </ScrollView>
    </Screen>
  );
}
