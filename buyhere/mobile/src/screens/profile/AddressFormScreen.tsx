import { useEffect, useState } from 'react';
import { FlatList, Modal, Pressable, ScrollView, Switch, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Check, ChevronDown, X } from 'lucide-react-native';
import { meApi } from '@/api/endpoints';
import { errorMessage } from '@/api/client';
import type { AddressInput } from '@/api/types';
import { Button } from '@/components/ui/Button';
import { Chip } from '@/components/ui/Chip';
import { Header } from '@/components/ui/Header';
import { Input } from '@/components/ui/Input';
import { Screen } from '@/components/ui/Screen';
import { confirm } from '@/components/ui/toast';
import { qk, useAddresses } from '@/hooks/queries';
import { useAuthStore } from '@/store/auth';
import { useSettingsStore } from '@/store/settings';
import { useTheme } from '@/theme/useTheme';
import { formatPhone } from '@/utils/format';
import { GOVERNORATES, governorateLabel } from '@/utils/governorates';
import type { RootScreenProps } from '@/navigation/types';

const PHONE_RE = /^(\+216|00216)?[2-9]\d{7}$/;
type Errors = Partial<Record<keyof AddressInput, string>>;

/** Création / modification d'une adresse : gouvernorat (24) + ville + rue. */
export function AddressFormScreen({ navigation, route }: RootScreenProps<'AddressForm'>) {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const lang = useSettingsStore((s) => s.language);
  const user = useAuthStore((s) => s.user);
  const qc = useQueryClient();
  const { data: addresses } = useAddresses();
  const addressId = route.params?.addressId;
  const existing = addresses?.find((a) => a.id === addressId);

  const [form, setForm] = useState<AddressInput>({
    label: t('address.labelHome'),
    fullName: user ? `${user.firstName} ${user.lastName}` : '',
    phone: formatPhone(user?.phone),
    governorate: '',
    city: '',
    street: '',
    postalCode: '',
    isDefault: false,
  });
  const [errors, setErrors] = useState<Errors>({});
  const [apiError, setApiError] = useState<string | null>(null);
  const [pickerOpen, setPickerOpen] = useState(false);

  useEffect(() => {
    if (existing) {
      setForm({ ...existing, phone: formatPhone(existing.phone), postalCode: existing.postalCode ?? '' });
    }
  }, [existing]);

  const set = <K extends keyof AddressInput>(key: K, value: AddressInput[K]) => setForm((f) => ({ ...f, [key]: value }));
  const cities = GOVERNORATES.find((g) => g.value === form.governorate)?.cities ?? [];

  const validate = () => {
    const e: Errors = {};
    if (form.fullName.trim().length < 3) e.fullName = t('common.required');
    if (!PHONE_RE.test(form.phone.replace(/[\s.-]/g, ''))) e.phone = t('auth.invalidPhone');
    if (!form.governorate) e.governorate = t('common.required');
    if (form.city.trim().length < 2) e.city = t('common.required');
    if (form.street.trim().length < 3) e.street = t('common.required');
    if (form.postalCode && !/^\d{4}$/.test(form.postalCode)) e.postalCode = '4 chiffres';
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const save = useMutation({
    mutationFn: () => {
      const payload: AddressInput = {
        ...form,
        label: form.label.trim() || t('address.labelHome'),
        fullName: form.fullName.trim(),
        phone: form.phone.replace(/[\s.-]/g, ''),
        city: form.city.trim(),
        street: form.street.trim(),
        postalCode: form.postalCode?.trim() || undefined,
      };
      return addressId ? meApi.updateAddress(addressId, payload) : meApi.createAddress(payload);
    },
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: qk.addresses });
      navigation.goBack();
    },
    onError: (err) => setApiError(errorMessage(err, t('common.networkError'))),
  });

  const remove = useMutation({
    mutationFn: () => meApi.deleteAddress(addressId!),
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: qk.addresses });
      navigation.goBack();
    },
  });

  const labels = [t('address.labelHome'), t('address.labelWork'), t('address.labelOther')];

  return (
    <Screen keyboard>
      <Header title={addressId ? t('address.edit') : t('address.new')} />
      <ScrollView contentContainerClassName="px-4 pb-10 pt-4 gap-4" keyboardShouldPersistTaps="handled">
        <View>
          <Text className="mb-2 text-sm font-medium text-ink dark:text-gray-200">{t('address.label')}</Text>
          <View className="flex-row gap-2">
            {labels.map((l) => (
              <Chip key={l} label={l} selected={form.label === l} onPress={() => set('label', l)} />
            ))}
          </View>
        </View>

        <Input label={t('address.fullName')} value={form.fullName} onChangeText={(v) => set('fullName', v)} error={errors.fullName} autoComplete="name" />
        <Input
          label={t('address.phone')}
          value={form.phone}
          onChangeText={(v) => set('phone', v)}
          error={errors.phone}
          keyboardType="phone-pad"
          placeholder="22 123 456"
          leftIcon={<Text className="text-ink-muted">+216</Text>}
        />

        {/* Gouvernorat : sélecteur plein écran */}
        <View>
          <Text className="mb-1.5 text-sm font-medium text-ink dark:text-gray-200">{t('address.governorate')}</Text>
          <Pressable
            onPress={() => setPickerOpen(true)}
            className={`h-12 flex-row items-center justify-between rounded-2xl border bg-surface-muted px-3.5 dark:bg-surface-dark-muted ${
              errors.governorate ? 'border-danger' : 'border-gray-200 dark:border-gray-700'
            }`}
            accessibilityRole="button"
          >
            <Text className={form.governorate ? 'text-base text-ink dark:text-gray-100' : 'text-base text-ink-subtle'}>
              {form.governorate ? governorateLabel(form.governorate, lang) : t('address.chooseGovernorate')}
            </Text>
            <ChevronDown size={18} color={colors.muted} />
          </Pressable>
          {errors.governorate ? <Text className="mt-1 text-xs text-danger">{errors.governorate}</Text> : null}
        </View>

        <View>
          <Input label={t('address.city')} value={form.city} onChangeText={(v) => set('city', v)} error={errors.city} />
          {cities.length ? (
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerClassName="gap-2 pt-2" keyboardShouldPersistTaps="handled">
              {cities.map((c) => (
                <Chip key={c} label={c} selected={form.city === c} onPress={() => set('city', c)} />
              ))}
            </ScrollView>
          ) : null}
        </View>

        <Input label={t('address.street')} value={form.street} onChangeText={(v) => set('street', v)} error={errors.street} autoComplete="street-address" />
        <Input
          label={t('address.postalCode')}
          value={form.postalCode}
          onChangeText={(v) => set('postalCode', v.replace(/\D/g, '').slice(0, 4))}
          error={errors.postalCode}
          keyboardType="number-pad"
          placeholder="1000"
        />

        <View className="flex-row items-center justify-between rounded-2xl bg-surface-muted px-4 py-3 dark:bg-surface-dark-muted">
          <Text className="text-base text-ink dark:text-gray-100">{t('address.setDefault')}</Text>
          <Switch
            value={form.isDefault}
            onValueChange={(v) => set('isDefault', v)}
            trackColor={{ true: colors.primary, false: colors.border }}
            thumbColor="#fff"
          />
        </View>

        {apiError ? <Text className="text-sm text-danger">{apiError}</Text> : null}
        <Button title={t('common.save')} size="lg" loading={save.isPending} onPress={() => (setApiError(null), validate() && save.mutate())} />
        {addressId ? (
          <Button
            title={t('common.delete')}
            variant="ghost"
            loading={remove.isPending}
            onPress={() =>
              confirm(t('common.delete'), t('address.deleteConfirm'), { confirm: t('common.delete'), cancel: t('common.cancel') }, () =>
                remove.mutate(),
              )
            }
          />
        ) : null}
      </ScrollView>

      <Modal visible={pickerOpen} animationType="slide" presentationStyle="pageSheet" onRequestClose={() => setPickerOpen(false)}>
        <SafeAreaView className="flex-1 bg-white dark:bg-surface-dark" edges={['top', 'bottom']}>
          <View className="h-14 flex-row items-center justify-between border-b border-gray-100 px-4 dark:border-gray-800">
            <Text className="text-lg font-bold text-ink dark:text-gray-100">{t('address.chooseGovernorate')}</Text>
            <Pressable onPress={() => setPickerOpen(false)} hitSlop={10}>
              <X size={24} color={colors.text} />
            </Pressable>
          </View>
          <FlatList
            data={GOVERNORATES}
            keyExtractor={(g) => g.value}
            renderItem={({ item }) => (
              <Pressable
                onPress={() => {
                  set('governorate', item.value);
                  if (form.governorate !== item.value) set('city', '');
                  setPickerOpen(false);
                }}
                className="flex-row items-center justify-between border-b border-gray-100 px-5 py-4 active:bg-gray-50 dark:border-gray-800"
              >
                <Text className="text-base text-ink dark:text-gray-100">{lang === 'ar' ? item.ar : item.value}</Text>
                {form.governorate === item.value ? <Check size={20} color={colors.primary} /> : null}
              </Pressable>
            )}
          />
        </SafeAreaView>
      </Modal>
    </Screen>
  );
}
