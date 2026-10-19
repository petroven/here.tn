import { useState } from 'react';
import { Linking, Pressable, RefreshControl, ScrollView, Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Bike, Clock, History, MapPinOff, Power, type LucideIcon } from 'lucide-react-native';
import { errorMessage } from '@/api/client';
import { courierApi, type CourierStatus } from '@/api/courier';
import { CourseCard } from '@/components/courier/CourseCard';
import { LiveMap, type MapMarker } from '@/components/map/LiveMap';
import { Header } from '@/components/ui/Header';
import { Screen } from '@/components/ui/Screen';
import { ListItemSkeleton } from '@/components/ui/Skeleton';
import { EmptyState, ErrorState } from '@/components/ui/States';
import { toast } from '@/components/ui/toast';
import {
  courierKeys,
  useCourierCourses,
  useCourierLocation,
  useCourierStats,
  useMarkAccepted,
  useRefreshCourier,
} from '@/hooks/useCourier';
import { useSettingsStore } from '@/store/settings';
import { useTheme } from '@/theme/useTheme';
import { formatPrice } from '@/utils/format';
import type { RootScreenProps } from '@/navigation/types';

const STATUSES: { value: CourierStatus; icon: LucideIcon }[] = [
  { value: 'disponible', icon: Bike },
  { value: 'occupe', icon: Clock },
  { value: 'hors_ligne', icon: Power },
];

function Tile({ label, value, accent }: { label: string; value: string; accent?: boolean }) {
  return (
    <View className={`flex-1 rounded-2xl p-3.5 ${accent ? 'bg-ink' : 'bg-white dark:bg-surface-dark-card'}`}>
      <Text className={`text-xs ${accent ? 'text-white/70' : 'text-ink-muted dark:text-gray-400'}`}>{label}</Text>
      <Text
        className={`mt-1 text-lg font-extrabold ${accent ? 'text-white' : 'text-ink dark:text-gray-100'}`}
        numberOfLines={1}
        adjustsFontSizeToFit
      >
        {value}
      </Text>
    </View>
  );
}

/**
 * Espace livreur : disponibilité, gains, courses en cours et courses libres.
 * Les propositions de course s'affichent par-dessus (CourierRuntime).
 */
export function CourierHomeScreen({ navigation }: RootScreenProps<'CourierHome'>) {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const lang = useSettingsStore((s) => s.language);
  const qc = useQueryClient();
  const stats = useCourierStats();
  const courses = useCourierCourses();
  const refresh = useRefreshCourier();
  const markAccepted = useMarkAccepted();
  const permission = useCourierLocation((s) => s.permission);
  const myCoords = useCourierLocation((s) => s.coords);
  const [acceptingId, setAcceptingId] = useState<string | null>(null);

  const status = stats.data?.status;

  const setStatus = useMutation({
    mutationFn: courierApi.setStatus,
    onSuccess: (_d, value) => {
      qc.setQueryData(courierKeys.stats, (old: typeof stats.data) => (old ? { ...old, status: value } : old));
      refresh();
    },
    onError: (err) => toast(errorMessage(err, t('common.networkError'))),
  });

  const accept = useMutation({
    mutationFn: (courseId: string) => courierApi.accept(courseId),
    onMutate: (courseId) => setAcceptingId(courseId),
    onSuccess: (_d, courseId) => {
      markAccepted(courseId);
      toast(t('courier.accepted'));
      navigation.navigate('CourierCourse', { courseId });
    },
    // 409 : un autre livreur l'a prise juste avant — le message du serveur l'explique.
    onError: (err) => toast(errorMessage(err, t('common.networkError'))),
    onSettled: () => {
      setAcceptingId(null);
      refresh();
    },
  });

  if (stats.isError && !stats.data) {
    return (
      <Screen>
        <Header title={t('courier.title')} />
        <ErrorState error={stats.error} onRetry={() => stats.refetch()} />
      </Screen>
    );
  }

  const active = courses.data?.active ?? [];
  const available = courses.data?.available ?? [];
  // Un repère par course (point de retrait, sinon adresse du client) + ma position.
  const mapMarkers: MapMarker[] = [
    ...[...active, ...available].flatMap((c) => {
      const at =
        c.status === 'en_cours' ? (c.dropoff.coords ?? c.pickup.coords) : (c.pickup.coords ?? c.dropoff.coords);
      if (!at) return [];
      const kind: MapMarker['kind'] = c.status === 'en_cours' || !c.pickup.coords ? 'dropoff' : 'pickup';
      return [{ id: c.id, kind, ...at, label: `${c.orderNumber} · ${formatPrice(c.fee, lang)}` }];
    }),
    ...(myCoords ? [{ id: 'me', kind: 'courier' as const, ...myCoords }] : []),
  ];

  return (
    <Screen muted>
      <Header
        title={t('courier.title')}
        right={
          <Pressable
            onPress={() => navigation.navigate('CourierHistory')}
            className="me-1 h-10 w-10 items-center justify-center rounded-full active:bg-gray-100 dark:active:bg-surface-dark-muted"
            accessibilityRole="button"
            accessibilityLabel={t('courier.history')}
          >
            <History size={22} color={colors.text} />
          </Pressable>
        }
      />
      <ScrollView
        contentContainerClassName="p-4 pb-10"
        refreshControl={
          <RefreshControl
            refreshing={courses.isRefetching || stats.isRefetching}
            onRefresh={refresh}
            tintColor={colors.primary}
            colors={[colors.primary]}
          />
        }
      >
        {/* Disponibilité */}
        <View className="flex-row gap-2" accessibilityRole="radiogroup">
          {STATUSES.map(({ value, icon: Icon }) => {
            const selected = status === value;
            return (
              <Pressable
                key={value}
                onPress={() => !selected && setStatus.mutate(value)}
                disabled={setStatus.isPending || !status}
                className={`flex-1 flex-row items-center justify-center gap-1.5 rounded-2xl py-3 ${
                  selected ? 'bg-primary' : 'bg-white dark:bg-surface-dark-card'
                } ${setStatus.isPending ? 'opacity-60' : ''}`}
                accessibilityRole="radio"
                accessibilityState={{ selected }}
              >
                <Icon size={15} color={selected ? '#fff' : colors.muted} />
                <Text className={`text-sm font-bold ${selected ? 'text-white' : 'text-ink dark:text-gray-200'}`}>
                  {t(`courier.availability.${value}`)}
                </Text>
              </Pressable>
            );
          })}
        </View>
        <Text className="mt-2 text-xs leading-5 text-ink-muted dark:text-gray-400">
          {status ? t(`courier.availabilityHint.${status}`) : ' '}
        </Text>

        {status && status !== 'hors_ligne' && permission === 'denied' ? (
          <Pressable
            onPress={() => Linking.openSettings()}
            className="mt-3 flex-row items-center gap-3 rounded-2xl bg-red-50 p-3.5 dark:bg-red-900/30"
            accessibilityRole="button"
          >
            <MapPinOff size={20} color={colors.danger} />
            <View className="flex-1">
              <Text className="text-sm font-bold text-danger">{t('courier.locationOff')}</Text>
              <Text className="text-xs text-ink-muted dark:text-gray-300">{t('courier.locationOffText')}</Text>
            </View>
          </Pressable>
        ) : null}

        {/* Gains */}
        <View className="mt-4 flex-row gap-2.5">
          <Tile accent label={t('courier.earningsToday')} value={formatPrice(stats.data?.earningsToday ?? 0, lang)} />
          <Tile label={t('courier.earningsWeek')} value={formatPrice(stats.data?.earningsWeek ?? 0, lang)} />
        </View>

        {/* Carte : ma position et les points de retrait de mes courses */}
        {mapMarkers.length ? (
          <View className="mt-4 overflow-hidden rounded-3xl bg-white dark:bg-surface-dark-card">
            <LiveMap
              title={t('courier.map.myCourses')}
              markers={mapMarkers}
              height={220}
              onMarkerPress={(id) => id !== 'me' && navigation.navigate('CourierCourse', { courseId: id })}
            />
            <View className="flex-row flex-wrap gap-x-4 gap-y-1 px-4 py-3">
              <Text className="text-xs text-ink-muted dark:text-gray-400">{t('courier.map.legendCourses')}</Text>
            </View>
          </View>
        ) : null}

        {/* Courses en cours */}
        {active.length > 0 ? (
          <>
            <Text className="mb-2.5 mt-6 text-base font-bold text-ink dark:text-gray-100">
              {t('courier.activeCourses', { count: active.length })}
            </Text>
            {active.map((c) => (
              <CourseCard
                key={c.id}
                course={c}
                onOpen={() => navigation.navigate('CourierCourse', { courseId: c.id })}
              />
            ))}
          </>
        ) : null}

        {/* Courses libres */}
        <Text className="mb-2.5 mt-6 text-base font-bold text-ink dark:text-gray-100">
          {t('courier.availableCourses')}
        </Text>
        {courses.isLoading ? (
          <>
            <ListItemSkeleton />
            <ListItemSkeleton />
          </>
        ) : courses.isError && !courses.data ? (
          <ErrorState error={courses.error} onRetry={() => courses.refetch()} />
        ) : available.length === 0 ? (
          <EmptyState
            icon={<Bike size={40} color={colors.primary} />}
            title={t('courier.noCourses')}
            text={status === 'hors_ligne' ? t('courier.noCoursesOffline') : t('courier.noCoursesText')}
          />
        ) : (
          available.map((c) => (
            <CourseCard
              key={c.id}
              course={c}
              onOpen={() => navigation.navigate('CourierCourse', { courseId: c.id })}
              onAccept={() => accept.mutate(c.id)}
              accepting={acceptingId === c.id}
            />
          ))
        )}
      </ScrollView>
    </Screen>
  );
}
