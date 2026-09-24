import { useRef, useState } from 'react';
import { FlatList, Modal, Pressable, ScrollView, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  Check,
  CheckCircle2,
  ChevronDown,
  Lock,
  Mail,
  MapPin,
  Package,
  PackageCheck,
  ShieldCheck,
  Store,
  Truck,
  User,
  UserPlus,
  Wallet,
  X,
  type LucideIcon,
} from 'lucide-react-native';
import { geoApi, vendorApi, type VendorApplication } from '@/api/endpoints';
import { errorMessage } from '@/api/client';
import { Button } from '@/components/ui/Button';
import { Chip } from '@/components/ui/Chip';
import { Header } from '@/components/ui/Header';
import { Input } from '@/components/ui/Input';
import { Screen } from '@/components/ui/Screen';
import { useAuthStore } from '@/store/auth';
import { useSettingsStore } from '@/store/settings';
import { useTheme } from '@/theme/useTheme';
import type { RootScreenProps } from '@/navigation/types';

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

type Account = VendorApplication['account'] & { confirm: string };
type StoreForm = Omit<VendorApplication['store'], 'governorateId' | 'delegationId'> & {
  governorateId: number;
  delegationId: number;
};

/**
 * « Devenir vendeur » — même parcours que la page du site : présentation,
 * puis inscription en 2 étapes (compte, boutique). La boutique est créée
 * « en attente » jusqu'à validation par l'administrateur.
 */
export function BecomeVendorScreen({ navigation }: RootScreenProps<'BecomeVendor'>) {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const lang = useSettingsStore((s) => s.language);
  const qc = useQueryClient();
  const setSession = useAuthStore((s) => s.setSession);
  const scrollRef = useRef<ScrollView>(null);
  const [formY, setFormY] = useState(0);

  const [step, setStep] = useState<1 | 2>(1);
  const [account, setAccount] = useState<Account>({ firstName: '', lastName: '', email: '', password: '', confirm: '' });
  const [store, setStore] = useState<StoreForm>({
    name: '',
    description: '',
    payoutMethod: 'iban',
    iban: '',
    flouciNumber: '',
    governorateId: 0,
    delegationId: 0,
    address: '',
  });
  const [accepted, setAccepted] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [done, setDone] = useState(false);

  const governorates = useQuery({ queryKey: ['governorates'], queryFn: geoApi.governorates, staleTime: Infinity });
  const delegations = useQuery({
    queryKey: ['delegations', store.governorateId],
    queryFn: () => geoApi.delegations(store.governorateId),
    enabled: store.governorateId > 0,
    staleTime: Infinity,
  });
  const selectedGov = governorates.data?.find((g) => g.id === store.governorateId);
  const govName = (g: { name: string; nameAr: string | null }) => (lang === 'ar' && g.nameAr ? g.nameAr : g.name);

  const setA = (k: keyof Account) => (v: string) => (setAccount((a) => ({ ...a, [k]: v })), setError(null));
  const setS = <K extends keyof StoreForm>(k: K, v: StoreForm[K]) => (setStore((s) => ({ ...s, [k]: v })), setError(null));

  const register = useMutation({
    mutationFn: () => vendorApi.register({ account, store }),
    onSuccess: async (session) => {
      await setSession(session);
      qc.invalidateQueries();
      setDone(true);
    },
    onError: (err) => setError(errorMessage(err, t('common.networkError'))),
  });

  const next = () => {
    if (account.firstName.trim().length < 2 || account.lastName.trim().length < 2 || !account.email.trim() || !account.password) {
      return setError(t('vendor.fillAll'));
    }
    if (!EMAIL_RE.test(account.email.trim())) return setError(t('auth.invalidEmail'));
    if (account.password.length < 6) return setError(t('vendor.passwordMin'));
    if (account.password !== account.confirm) return setError(t('auth.passwordsMismatch'));
    setError(null);
    setStep(2);
  };

  const submit = () => {
    if (!store.name.trim() || !store.governorateId || !store.delegationId || !store.address.trim()) {
      return setError(t('vendor.fillStore'));
    }
    if (store.payoutMethod === 'iban' && !store.iban.trim()) return setError(t('vendor.ibanRequired'));
    if (store.payoutMethod === 'flouci' && !store.flouciNumber.trim()) return setError(t('vendor.flouciRequired'));
    if (!accepted) return setError(t('vendor.acceptRequired'));
    setError(null);
    register.mutate();
  };

  if (done) {
    return (
      <Screen>
        <Header title={t('vendor.title')} />
        <View className="flex-1 items-center justify-center px-8">
          <View className="h-20 w-20 items-center justify-center rounded-full bg-green-50 dark:bg-green-900/30">
            <CheckCircle2 size={44} color={colors.success} />
          </View>
          <Text className="mt-5 text-center text-2xl font-extrabold text-ink dark:text-gray-100">{t('vendor.successTitle')}</Text>
          <Text className="mt-2 text-center text-base text-ink-muted dark:text-gray-400">{t('vendor.successText')}</Text>
          <Button title={t('common.continue')} size="lg" className="mt-8" onPress={() => navigation.reset({ index: 0, routes: [{ name: 'Main' }] })} />
        </View>
      </Screen>
    );
  }

  return (
    <Screen keyboard muted>
      <Header title={t('vendor.title')} />
      <ScrollView ref={scrollRef} contentContainerClassName="pb-12" keyboardShouldPersistTaps="handled">
        {/* Présentation */}
        <View className="bg-cream px-5 py-8 dark:bg-surface-dark-muted">
          <View className="self-start rounded-full bg-white px-3 py-1.5 dark:bg-surface-dark-card">
            <Text className="text-xs font-bold text-primary">{t('vendor.badge')}</Text>
          </View>
          <Text className="mt-4 text-3xl font-extrabold leading-9 text-ink dark:text-gray-100">{t('vendor.heroTitle')}</Text>
          <Text className="mt-3 text-base leading-6 text-ink-muted dark:text-gray-400">{t('vendor.heroText')}</Text>
          <Button title={t('vendor.createShop')} size="lg" className="mt-6" onPress={() => scrollRef.current?.scrollTo({ y: formY, animated: true })} />
        </View>

        <Text className="mt-8 px-5 text-center text-xl font-extrabold text-ink dark:text-gray-100">{t('vendor.whyTitle')}</Text>
        <View className="mt-5 flex-row flex-wrap px-3">
          <Feature icon={Store} label={t('vendor.why1')} />
          <Feature icon={MapPin} label={t('vendor.why2')} />
          <Feature icon={Package} label={t('vendor.why3')} />
          <Feature icon={Wallet} label={t('vendor.why4')} />
        </View>

        <View className="mx-4 mt-6 rounded-2xl bg-white p-5 dark:bg-surface-dark-card">
          <Text className="text-center text-xl font-extrabold text-ink dark:text-gray-100">{t('vendor.howTitle')}</Text>
          {[t('vendor.how1'), t('vendor.how2'), t('vendor.how3'), t('vendor.how4'), t('vendor.how5')].map((label, i) => (
            <View key={label} className="mt-4 flex-row items-center gap-3">
              <View className="h-9 w-9 items-center justify-center rounded-full bg-ink dark:bg-cream">
                <Text className="text-sm font-extrabold text-white dark:text-ink">{i + 1}</Text>
              </View>
              <Text className="text-base font-bold text-ink dark:text-gray-100">{label}</Text>
            </View>
          ))}
        </View>

        <View className="mx-4 mt-4 rounded-2xl border border-[#E2D9CB] bg-cream p-5 dark:border-gray-800 dark:bg-surface-dark-muted">
          <Text className="text-center text-xs font-bold uppercase tracking-wide text-primary-700">{t('vendor.commissionLabel')}</Text>
          <Text className="mt-2 text-center text-2xl font-extrabold text-ink dark:text-gray-100">{t('vendor.commissionTitle')}</Text>
          <Text className="mt-2 text-center text-sm text-ink-muted dark:text-gray-400">{t('vendor.commissionText')}</Text>
        </View>

        <View className="mx-4 mt-4 flex-row flex-wrap rounded-2xl bg-white py-3 dark:bg-surface-dark-card">
          <Trust icon={ShieldCheck} label={t('vendor.trust1')} />
          <Trust icon={PackageCheck} label={t('vendor.trust2')} />
          <Trust icon={UserPlus} label={t('vendor.trust3')} />
          <Trust icon={Truck} label={t('vendor.trust4')} />
        </View>

        {/* Formulaire */}
        <View onLayout={(e) => setFormY(e.nativeEvent.layout.y)} className="mx-4 mt-6 rounded-2xl bg-white p-5 dark:bg-surface-dark-card">
          <View className="mb-6 flex-row items-center justify-center">
            <StepDot n={1} label={t('vendor.stepAccount')} step={step} />
            <View className={`mx-3 mb-5 h-0.5 w-16 ${step > 1 ? 'bg-success' : 'bg-gray-200 dark:bg-gray-700'}`} />
            <StepDot n={2} label={t('vendor.stepShop')} step={step} />
          </View>

          {step === 1 ? (
            <View className="gap-4">
              <Text className="text-lg font-bold text-ink dark:text-gray-100">{t('vendor.accountTitle')}</Text>
              <View className="flex-row gap-3">
                <Input containerClassName="flex-1" label={t('auth.firstName')} value={account.firstName} onChangeText={setA('firstName')} leftIcon={<User size={18} color={colors.muted} />} />
                <Input containerClassName="flex-1" label={t('auth.lastName')} value={account.lastName} onChangeText={setA('lastName')} />
              </View>
              <Input
                label={t('auth.email')}
                value={account.email}
                onChangeText={setA('email')}
                keyboardType="email-address"
                autoCapitalize="none"
                autoComplete="email"
                leftIcon={<Mail size={18} color={colors.muted} />}
              />
              <Input label={t('auth.password')} value={account.password} onChangeText={setA('password')} secureTextEntry autoComplete="new-password" leftIcon={<Lock size={18} color={colors.muted} />} />
              <Input label={t('auth.confirmPassword')} value={account.confirm} onChangeText={setA('confirm')} secureTextEntry autoComplete="new-password" leftIcon={<Lock size={18} color={colors.muted} />} />
            </View>
          ) : (
            <View className="gap-4">
              <Text className="text-lg font-bold text-ink dark:text-gray-100">{t('vendor.shopTitle')}</Text>
              <Input label={t('vendor.shopName')} value={store.name} onChangeText={(v) => setS('name', v)} />
              <Input
                label={t('vendor.shopDescription')}
                value={store.description}
                onChangeText={(v) => setS('description', v)}
                multiline
                style={{ minHeight: 80, textAlignVertical: 'top' }}
              />

              <View>
                <Text className="mb-2 text-sm font-medium text-ink dark:text-gray-200">{t('vendor.payoutQuestion')}</Text>
                <View className="flex-row gap-3">
                  <PayoutOption active={store.payoutMethod === 'iban'} title={t('vendor.payoutIban')} text={t('vendor.payoutIbanText')} onPress={() => setS('payoutMethod', 'iban')} />
                  <PayoutOption active={store.payoutMethod === 'flouci'} title="Flouci" text={t('vendor.payoutFlouciText')} onPress={() => setS('payoutMethod', 'flouci')} />
                </View>
              </View>
              {store.payoutMethod === 'iban' ? (
                <Input label={t('vendor.iban')} value={store.iban} onChangeText={(v) => setS('iban', v)} autoCapitalize="characters" />
              ) : (
                <Input label={t('vendor.flouciNumber')} value={store.flouciNumber} onChangeText={(v) => setS('flouciNumber', v)} keyboardType="phone-pad" />
              )}

              <View>
                <Text className="mb-1.5 text-sm font-medium text-ink dark:text-gray-200">{t('address.governorate')}</Text>
                <Pressable
                  onPress={() => setPickerOpen(true)}
                  className="h-12 flex-row items-center justify-between rounded-2xl border border-gray-200 bg-surface-muted px-3.5 dark:border-gray-700 dark:bg-surface-dark-muted"
                  accessibilityRole="button"
                >
                  <Text className={selectedGov ? 'text-base text-ink dark:text-gray-100' : 'text-base text-ink-subtle'}>
                    {selectedGov ? govName(selectedGov) : t('address.chooseGovernorate')}
                  </Text>
                  <ChevronDown size={18} color={colors.muted} />
                </Pressable>
              </View>
              {store.governorateId ? (
                <View>
                  <Text className="mb-1.5 text-sm font-medium text-ink dark:text-gray-200">{t('address.city')}</Text>
                  <View className="flex-row flex-wrap gap-2">
                    {(delegations.data ?? []).map((d) => (
                      <Chip
                        key={d.id}
                        label={lang === 'ar' && d.nameAr ? d.nameAr : d.name}
                        selected={store.delegationId === d.id}
                        onPress={() => setS('delegationId', d.id)}
                      />
                    ))}
                  </View>
                </View>
              ) : null}
              <Input label={t('vendor.shopAddress')} value={store.address} onChangeText={(v) => setS('address', v)} />

              <View className="rounded-2xl bg-primary-50 p-4 dark:bg-primary-900/20">
                <Text className="text-sm text-primary-800 dark:text-primary-200">
                  {store.payoutMethod === 'flouci' ? t('vendor.noteFlouci') : t('vendor.noteIban')} {t('vendor.noteCommission')}
                </Text>
              </View>

              <Pressable
                onPress={() => (setAccepted((v) => !v), setError(null))}
                className="flex-row items-start gap-3"
                accessibilityRole="checkbox"
                accessibilityState={{ checked: accepted }}
              >
                <View className={`mt-0.5 h-5 w-5 items-center justify-center rounded-md border-2 ${accepted ? 'border-primary bg-primary' : 'border-gray-300 dark:border-gray-600'}`}>
                  {accepted ? <Check size={14} color="#fff" strokeWidth={3} /> : null}
                </View>
                <Text className="flex-1 text-sm text-ink-muted dark:text-gray-400">{t('vendor.acceptTerms')}</Text>
              </Pressable>
            </View>
          )}

          {error ? (
            <View className="mt-4 rounded-xl bg-red-50 p-3 dark:bg-red-900/30">
              <Text className="text-sm text-danger">{error}</Text>
            </View>
          ) : null}

          {step === 1 ? (
            <Button title={t('vendor.next')} size="lg" className="mt-6" onPress={next} />
          ) : (
            <View className="mt-6 flex-row gap-3">
              <Button title={t('common.back')} variant="outline" fullWidth={false} className="flex-1" onPress={() => (setStep(1), setError(null))} />
              <Button title={t('vendor.submit')} fullWidth={false} className="flex-[2]" loading={register.isPending} onPress={submit} />
            </View>
          )}
        </View>
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
            data={governorates.data ?? []}
            keyExtractor={(g) => String(g.id)}
            renderItem={({ item }) => (
              <Pressable
                onPress={() => {
                  if (store.governorateId !== item.id) setStore((s) => ({ ...s, governorateId: item.id, delegationId: 0 }));
                  setPickerOpen(false);
                }}
                className="flex-row items-center justify-between border-b border-gray-100 px-5 py-4 active:bg-gray-50 dark:border-gray-800"
              >
                <Text className="text-base text-ink dark:text-gray-100">{govName(item)}</Text>
                {store.governorateId === item.id ? <Check size={20} color={colors.primary} /> : null}
              </Pressable>
            )}
          />
        </SafeAreaView>
      </Modal>
    </Screen>
  );
}

function Feature({ icon: Icon, label }: { icon: LucideIcon; label: string }) {
  const { colors } = useTheme();
  return (
    <View className="w-1/2 items-center gap-2 px-2 pb-5">
      <View className="h-14 w-14 items-center justify-center rounded-full bg-primary-100 dark:bg-primary-900/30">
        <Icon size={24} color={colors.primary} />
      </View>
      <Text className="text-center text-sm font-bold text-ink dark:text-gray-200">{label}</Text>
    </View>
  );
}

function Trust({ icon: Icon, label }: { icon: LucideIcon; label: string }) {
  const { colors } = useTheme();
  return (
    <View className="w-1/2 items-center gap-1.5 px-2 py-3">
      <Icon size={22} color={colors.primary} />
      <Text className="text-center text-xs font-bold text-ink-muted dark:text-gray-300">{label}</Text>
    </View>
  );
}

function StepDot({ n, label, step }: { n: 1 | 2; label: string; step: 1 | 2 }) {
  const doneStep = step > n;
  const current = step === n;
  return (
    <View className="items-center gap-1.5">
      <View className={`h-11 w-11 items-center justify-center rounded-full ${doneStep ? 'bg-success' : current ? 'bg-primary' : 'bg-gray-100 dark:bg-surface-dark-muted'}`}>
        {doneStep ? <Check size={18} color="#fff" /> : <Text className={`font-extrabold ${current ? 'text-white' : 'text-ink-subtle'}`}>{n}</Text>}
      </View>
      <Text className={`text-xs font-bold ${step >= n ? 'text-primary' : 'text-ink-subtle'}`}>{label}</Text>
    </View>
  );
}

function PayoutOption({ active, title, text, onPress }: { active: boolean; title: string; text: string; onPress: () => void }) {
  return (
    <Pressable
      onPress={onPress}
      className={`flex-1 rounded-2xl border p-3.5 ${active ? 'border-primary bg-primary-50 dark:bg-primary-900/20' : 'border-gray-200 dark:border-gray-700'}`}
      accessibilityRole="radio"
      accessibilityState={{ selected: active }}
    >
      <Text className={`text-sm font-bold ${active ? 'text-primary' : 'text-ink dark:text-gray-100'}`}>{title}</Text>
      <Text className="text-xs text-ink-muted">{text}</Text>
    </Pressable>
  );
}
