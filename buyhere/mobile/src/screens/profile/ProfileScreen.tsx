import { useEffect, type ReactNode } from 'react';
import { I18nManager, Linking, Pressable, ScrollView, Text, View } from 'react-native';
import { Image } from 'expo-image';
import Constants from 'expo-constants';
import { useTranslation } from 'react-i18next';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import {
  ChevronLeft,
  ChevronRight,
  CircleHelp,
  Globe,
  Heart,
  LogOut,
  MapPin,
  Moon,
  Package,
  Store,
  Wallet,
  UserRound,
  type LucideIcon,
} from 'lucide-react-native';
import { meApi } from '@/api/endpoints';
import { Button } from '@/components/ui/Button';
import { Screen } from '@/components/ui/Screen';
import { confirm } from '@/components/ui/toast';
import { SUPPORT_PHONE } from '@/config';
import { applyLanguage } from '@/i18n';
import { useAuthStore } from '@/store/auth';
import { useSettingsStore, type ThemePreference } from '@/store/settings';
import { useTheme } from '@/theme/useTheme';
import type { Language } from '@/api/types';
import { formatPrice } from '@/utils/format';
import type { TabScreenProps } from '@/navigation/types';

/** Profil : infos, commandes, adresses, notifications, langue, thème, déconnexion. */
export function ProfileScreen({ navigation }: TabScreenProps<'Profile'>) {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const qc = useQueryClient();
  const { user, clearSession, setUser } = useAuthStore();
  // Profil relu à chaque visite : le solde (cashback) évolue avec les commandes.
  const me = useQuery({ queryKey: ['me'], queryFn: meApi.get, enabled: !!user });
  useEffect(() => {
    if (me.data) setUser(me.data);
  }, [me.data, setUser]);
  const { language, setLanguage, theme, setTheme } = useSettingsStore();
  const Chevron = I18nManager.isRTL ? ChevronLeft : ChevronRight;

  const logout = async () => {
    await clearSession();
    qc.clear();
  };

  const changeLanguage = (lang: Language) => {
    if (lang === language) return;
    const run = async () => {
      setLanguage(lang);
      await applyLanguage(lang); // redémarre l'app si le sens d'écriture change
    };
    if ((lang === 'ar') !== I18nManager.isRTL) {
      confirm(t('profile.language'), t('profile.languageRestart'), { confirm: t('common.confirm'), cancel: t('common.cancel') }, run, false);
    } else {
      run();
    }
  };

  const Row = ({ icon: Icon, label, onPress, right, danger }: { icon: LucideIcon; label: string; onPress?: () => void; right?: ReactNode; danger?: boolean }) => (
    <Pressable
      onPress={onPress}
      disabled={!onPress}
      className="flex-row items-center gap-3 px-4 py-3.5 active:bg-gray-50 dark:active:bg-surface-dark-muted"
      accessibilityRole={onPress ? 'button' : undefined}
    >
      <View className={`h-9 w-9 items-center justify-center rounded-xl ${danger ? 'bg-red-50 dark:bg-red-900/30' : 'bg-primary-50 dark:bg-primary-900/30'}`}>
        <Icon size={18} color={danger ? colors.danger : colors.primary} />
      </View>
      <Text className={`flex-1 text-base ${danger ? 'text-danger' : 'text-ink dark:text-gray-100'}`}>{label}</Text>
      {right ?? (onPress ? <Chevron size={18} color={colors.subtle} /> : null)}
    </Pressable>
  );

  const Group = ({ children }: { children: ReactNode }) => (
    <View className="mx-4 mb-4 overflow-hidden rounded-2xl bg-white dark:bg-surface-dark-card">{children}</View>
  );

  const Segmented = <T extends string>({ options, value, onChange }: { options: { value: T; label: string }[]; value: T; onChange: (v: T) => void }) => (
    <View className="flex-row rounded-xl bg-surface-muted p-1 dark:bg-surface-dark-muted">
      {options.map((o) => (
        <Pressable
          key={o.value}
          onPress={() => onChange(o.value)}
          className={`rounded-lg px-2.5 py-1.5 ${value === o.value ? 'bg-white shadow-sm dark:bg-surface-dark-card' : ''}`}
          accessibilityRole="radio"
          accessibilityState={{ selected: value === o.value }}
        >
          <Text className={`text-xs font-semibold ${value === o.value ? 'text-primary' : 'text-ink-muted dark:text-gray-400'}`}>{o.label}</Text>
        </Pressable>
      ))}
    </View>
  );

  return (
    <Screen muted>
      <ScrollView contentContainerClassName="pb-10">
        <Text className="px-4 pb-4 pt-2 text-2xl font-extrabold text-ink dark:text-gray-100">{t('profile.title')}</Text>

        {/* Carte utilisateur */}
        <View className="mx-4 mb-4 flex-row items-center gap-4 rounded-2xl bg-white p-4 dark:bg-surface-dark-card">
          {user?.avatarUrl ? (
            <Image source={{ uri: user.avatarUrl }} style={{ width: 60, height: 60, borderRadius: 30 }} />
          ) : (
            <View className="h-[60px] w-[60px] items-center justify-center rounded-full bg-primary">
              <Text className="text-xl font-bold text-white">
                {user ? `${user.firstName.charAt(0)}${user.lastName.charAt(0)}` : '?'}
              </Text>
            </View>
          )}
          <View className="flex-1">
            <Text className="text-lg font-bold text-ink dark:text-gray-100">
              {user ? `${user.firstName} ${user.lastName}` : t('profile.guest')}
            </Text>
            <Text className="text-sm text-ink-muted dark:text-gray-400" numberOfLines={2}>
              {user ? user.email : t('profile.guestText')}
            </Text>
          </View>
        </View>

        {!user ? (
          <View className="mx-4 mb-4 gap-2.5">
            <Button title={t('auth.login')} onPress={() => navigation.navigate('Login', { redirect: 'back' })} />
            <Button title={t('auth.register')} variant="outline" onPress={() => navigation.navigate('Register')} />
          </View>
        ) : (
          <Group>
            <Row icon={Package} label={t('profile.myOrders')} onPress={() => navigation.navigate('Orders')} />
            <Row icon={Heart} label={t('favorites.title')} onPress={() => navigation.navigate('Favorites')} />
            <Row icon={MapPin} label={t('profile.addresses')} onPress={() => navigation.navigate('Addresses')} />
            <Row icon={UserRound} label={t('profile.personalInfo')} onPress={() => navigation.navigate('EditProfile')} />
            <Row
              icon={Wallet}
              label={t('profile.wallet')}
              right={<Text className="font-bold text-primary">{formatPrice(user.walletBalance ?? 0, language)}</Text>}
            />
          </Group>
        )}

        <Group>
          <Row icon={Store} label={t('stores.title')} onPress={() => navigation.navigate('Stores')} />
          {user?.role !== 'vendeur' && user?.role !== 'admin_boutique' ? (
            <Row icon={Store} label={t('vendor.cta')} onPress={() => navigation.navigate('BecomeVendor')} />
          ) : null}
        </Group>

        <Group>
          <Row
            icon={Globe}
            label={t('profile.language')}
            right={
              <Segmented<Language>
                value={language}
                onChange={changeLanguage}
                options={[
                  { value: 'fr', label: 'Français' },
                  { value: 'ar', label: 'العربية' },
                ]}
              />
            }
          />
          <Row
            icon={Moon}
            label={t('profile.theme')}
            right={
              <Segmented<ThemePreference>
                value={theme}
                onChange={setTheme}
                options={[
                  { value: 'system', label: t('profile.themeSystem') },
                  { value: 'light', label: t('profile.themeLight') },
                  { value: 'dark', label: t('profile.themeDark') },
                ]}
              />
            }
          />
          <Row icon={CircleHelp} label={t('profile.help')} onPress={() => Linking.openURL(`tel:${SUPPORT_PHONE.replace(/\s/g, '')}`)} />
        </Group>

        {user ? (
          <Group>
            <Row
              icon={LogOut}
              label={t('profile.logout')}
              danger
              onPress={() =>
                confirm(t('profile.logout'), t('profile.logoutConfirm'), { confirm: t('profile.logout'), cancel: t('common.cancel') }, logout)
              }
            />
          </Group>
        ) : null}

        <Text className="mt-2 text-center text-xs text-ink-subtle">
          BuyHere · {t('profile.version', { version: Constants.expoConfig?.version ?? '1.0.0' })}
        </Text>
      </ScrollView>
    </Screen>
  );
}
