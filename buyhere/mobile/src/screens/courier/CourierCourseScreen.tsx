import { useState } from 'react';
import { Pressable, ScrollView, Text, View } from 'react-native';
import { Image } from 'expo-image';
import * as ImagePicker from 'expo-image-picker';
import { useTranslation } from 'react-i18next';
import { useMutation } from '@tanstack/react-query';
import { Banknote, Camera, Check, ImagePlus, MapPin, Navigation, Package, Phone, X } from 'lucide-react-native';
import { errorMessage } from '@/api/client';
import { courierApi, type Course } from '@/api/courier';
import { callPhone, CourseBadge, openDirections } from '@/components/courier/CourseCard';
import { InfoRow } from '@/components/seller/SellerCard';
import { Button } from '@/components/ui/Button';
import { Header } from '@/components/ui/Header';
import { Screen } from '@/components/ui/Screen';
import { Skeleton } from '@/components/ui/Skeleton';
import { EmptyState, ErrorState } from '@/components/ui/States';
import { confirm, toast } from '@/components/ui/toast';
import { useCourierCourses, useCourierLocation, useMarkAccepted, useRefreshCourier } from '@/hooks/useCourier';
import { formatRoute, LiveMap, type MapMarker, type RouteInfo } from '@/components/map/LiveMap';
import { useSettingsStore } from '@/store/settings';
import { useTheme } from '@/theme/useTheme';
import { formatPrice } from '@/utils/format';
import type { RootScreenProps } from '@/navigation/types';

function Stop({
  tone,
  label,
  title,
  address,
  onNavigate,
  onCall,
}: {
  tone: string;
  label: string;
  title: string;
  address: string | null;
  onNavigate?: () => void;
  onCall?: () => void;
}) {
  const { t } = useTranslation();
  const { colors } = useTheme();
  return (
    <View className="rounded-2xl bg-white p-4 dark:bg-surface-dark-card">
      <View className="flex-row items-start gap-2.5">
        <MapPin size={18} color={tone} />
        <View className="flex-1">
          <Text className="text-2xs font-bold uppercase tracking-wide text-ink-subtle">{label}</Text>
          <Text className="mt-0.5 font-bold text-ink dark:text-gray-100">{title}</Text>
          <Text className="mt-0.5 text-sm text-ink-muted dark:text-gray-300">{address || t('courier.noAddress')}</Text>
        </View>
      </View>
      {onNavigate || onCall ? (
        <View className="mt-3 flex-row gap-2">
          {onNavigate ? (
            <View className="flex-1">
              <Button
                title={t('courier.navigate')}
                size="sm"
                variant="secondary"
                icon={<Navigation size={15} color={colors.primary} />}
                onPress={onNavigate}
              />
            </View>
          ) : null}
          {onCall ? (
            <View className="flex-1">
              <Button
                title={t('courier.call')}
                size="sm"
                variant="outline"
                icon={<Phone size={15} color={colors.text} />}
                onPress={onCall}
              />
            </View>
          ) : null}
        </View>
      ) : null}
    </View>
  );
}

/** Remise au client : photo de preuve (facultative) puis « Livrée ». */
function DeliverPanel({ course, onDone }: { course: Course; onDone: (message: string) => void }) {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const lang = useSettingsStore((s) => s.language);
  const [photo, setPhoto] = useState<string | null>(null);

  const pick = async (camera: boolean) => {
    if (camera) {
      const permission = await ImagePicker.requestCameraPermissionsAsync();
      if (!permission.granted) return toast(t('returns.cameraDenied'));
    }
    const options: ImagePicker.ImagePickerOptions = { mediaTypes: ['images'], quality: 0.7 };
    const result = camera
      ? await ImagePicker.launchCameraAsync(options)
      : await ImagePicker.launchImageLibraryAsync(options);
    if (!result.canceled) setPhoto(result.assets[0].uri);
  };

  const deliver = useMutation({
    mutationFn: async (withPhoto: boolean) => {
      if (withPhoto && photo) await courierApi.uploadProof(course.id, photo);
      await courierApi.setCourseStatus(course.id, 'livree');
    },
    onSuccess: () => onDone(t('courier.delivered')),
    onError: (err) => toast(errorMessage(err, t('common.networkError'))),
  });

  const fail = useMutation({
    mutationFn: () => courierApi.setCourseStatus(course.id, 'echec'),
    onSuccess: () => onDone(t('courier.failedDone')),
    onError: (err) => toast(errorMessage(err, t('common.networkError'))),
  });

  const busy = deliver.isPending || fail.isPending;
  const askDeliver = (withPhoto: boolean) =>
    course.cashToCollect > 0
      ? confirm(
          t('courier.cashConfirmTitle'),
          t('courier.cashConfirmText', { amount: formatPrice(course.cashToCollect, lang) }),
          { confirm: t('courier.cashConfirm'), cancel: t('common.cancel') },
          () => deliver.mutate(withPhoto),
          false,
        )
      : deliver.mutate(withPhoto);

  return (
    <View className="gap-3 rounded-2xl bg-white p-4 dark:bg-surface-dark-card">
      <Text className="font-bold text-ink dark:text-gray-100">{t('courier.proofTitle')}</Text>
      <Text className="text-xs leading-5 text-ink-muted dark:text-gray-400">{t('courier.proofText')}</Text>
      {photo ? (
        <View>
          <Image source={{ uri: photo }} style={{ width: '100%', height: 200, borderRadius: 16 }} contentFit="cover" />
          <Pressable
            onPress={() => setPhoto(null)}
            className="absolute end-2 top-2 h-8 w-8 items-center justify-center rounded-full bg-black/60"
            accessibilityRole="button"
            accessibilityLabel={t('courier.removePhoto')}
          >
            <X size={16} color="#fff" />
          </Pressable>
        </View>
      ) : (
        <View className="flex-row gap-2">
          <View className="flex-1">
            <Button
              title={t('courier.takePhoto')}
              variant="secondary"
              size="sm"
              icon={<Camera size={15} color={colors.primary} />}
              onPress={() => pick(true)}
            />
          </View>
          <View className="flex-1">
            <Button
              title={t('courier.gallery')}
              variant="outline"
              size="sm"
              icon={<ImagePlus size={15} color={colors.text} />}
              onPress={() => pick(false)}
            />
          </View>
        </View>
      )}
      <Button
        title={photo ? t('courier.confirmDelivery') : t('courier.deliverNoPhoto')}
        loading={deliver.isPending}
        disabled={busy}
        onPress={() => askDeliver(!!photo)}
      />
      <Pressable
        onPress={() =>
          confirm(
            t('courier.failTitle'),
            t('courier.failText'),
            { confirm: t('courier.failConfirm'), cancel: t('common.cancel') },
            () => fail.mutate(),
          )
        }
        disabled={busy}
        className="items-center py-2"
        accessibilityRole="button"
      >
        <Text className="text-sm font-semibold text-danger">{t('courier.fail')}</Text>
      </Pressable>
    </View>
  );
}

const STEPS: Course['status'][] = ['en_attente', 'assignee', 'en_cours'];

/**
 * Carte de la course : position en direct du livreur et itinéraire routier
 * vers l'étape en cours (boutique puis client), durée et distance estimées,
 * frise des étapes et lancement du guidage GPS.
 */
function CourseMapCard({ course }: { course: Course }) {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const lang = useSettingsStore((s) => s.language);
  const me = useCourierLocation((s) => s.coords);
  const [routeInfo, setRouteInfo] = useState<RouteInfo | null>(null);

  const pickup = course.pickup.coords;
  const dropoff = course.dropoff.coords;
  const toStore = course.status !== 'en_cours';
  // Étape en cours : récupérer à la boutique, puis livrer chez le client.
  const target = toStore ? pickup : dropoff;
  const waypoints = [
    ...(me && course.status !== 'en_attente' ? [me] : []),
    ...(toStore && pickup ? [pickup] : []),
    ...(dropoff ? [dropoff] : []),
  ];

  const markers: MapMarker[] = [
    ...(pickup
      ? [{ id: 'pickup', kind: 'pickup' as const, ...pickup, label: course.pickup.name || t('courier.store') }]
      : []),
    ...(dropoff ? [{ id: 'dropoff', kind: 'dropoff' as const, ...dropoff, label: course.dropoff.address ?? '' }] : []),
    ...(me ? [{ id: 'me', kind: 'courier' as const, ...me }] : []),
  ];

  if (!markers.length) return null;
  const stepIndex = STEPS.indexOf(course.status);
  const navTarget = target ?? (toStore ? course.pickup.address : course.dropoff.address);

  return (
    <View className="overflow-hidden rounded-3xl bg-white dark:bg-surface-dark-card">
      <LiveMap
        title={course.orderNumber}
        markers={markers}
        route={waypoints}
        height={280}
        followCourier={course.status !== 'en_attente'}
        onRoute={setRouteInfo}
      />
      <View className="gap-3 p-4">
        <View className="flex-row items-center justify-between gap-3">
          <View className="flex-1">
            <Text className="text-2xs font-bold uppercase tracking-wide text-ink-subtle">
              {course.status === 'en_attente'
                ? t('courier.map.preview')
                : toStore
                  ? t('courier.map.toStore')
                  : t('courier.map.toCustomer')}
            </Text>
            <Text className="mt-0.5 text-lg font-extrabold text-ink dark:text-gray-100">
              {routeInfo ? formatRoute(routeInfo, lang) : t('courier.map.computing')}
            </Text>
            {routeInfo && !routeInfo.exact ? (
              <Text className="text-2xs text-ink-subtle">{t('courier.map.approxRoute')}</Text>
            ) : null}
          </View>
          {course.status !== 'en_attente' && navTarget ? (
            <Pressable
              onPress={() => openDirections(navTarget)}
              className="flex-row items-center gap-1.5 rounded-2xl bg-primary px-4 py-3 active:opacity-90"
              accessibilityRole="button"
            >
              <Navigation size={16} color="#fff" />
              <Text className="text-sm font-bold text-white">{t('courier.map.start')}</Text>
            </Pressable>
          ) : null}
        </View>
        {/* Frise des étapes */}
        <View className="flex-row items-center">
          {[t('courier.map.stepAccept'), t('courier.map.stepPickup'), t('courier.map.stepDeliver')].map((label, i) => {
            const doneStep = i < stepIndex;
            const current = i === stepIndex;
            return (
              <View key={label} className="flex-1 flex-row items-center">
                <View className="items-center">
                  <View
                    className={`h-6 w-6 items-center justify-center rounded-full ${
                      doneStep ? 'bg-success' : current ? 'bg-primary' : 'bg-gray-200 dark:bg-gray-700'
                    }`}
                  >
                    {doneStep ? (
                      <Check size={13} color="#fff" />
                    ) : (
                      <Text className="text-2xs font-bold text-white">{i + 1}</Text>
                    )}
                  </View>
                  <Text
                    className={`mt-1 text-2xs font-semibold ${current ? 'text-primary' : 'text-ink-muted dark:text-gray-400'}`}
                  >
                    {label}
                  </Text>
                </View>
                {i < 2 ? (
                  <View
                    className={`mx-1 mb-4 h-0.5 flex-1 ${doneStep ? 'bg-success' : 'bg-gray-200 dark:bg-gray-700'}`}
                  />
                ) : null}
              </View>
            );
          })}
        </View>
        {!me && course.status !== 'en_attente' ? (
          <Text className="text-2xs text-ink-subtle" style={{ color: colors.subtle }}>
            {t('courier.map.noGps')}
          </Text>
        ) : null}
      </View>
    </View>
  );
}

/** Détail d'une course : trajet, encaissement, et l'étape suivante. */
export function CourierCourseScreen({ route, navigation }: RootScreenProps<'CourierCourse'>) {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const lang = useSettingsStore((s) => s.language);
  const courses = useCourierCourses();
  const refresh = useRefreshCourier();
  const markAccepted = useMarkAccepted();
  const { courseId } = route.params;

  const course =
    courses.data?.active.find((c) => c.id === courseId) ?? courses.data?.available.find((c) => c.id === courseId);

  const done = (message: string) => {
    toast(message);
    refresh();
    navigation.goBack();
  };

  const advance = useMutation({
    mutationFn: async (step: 'accept' | 'pickup') => {
      if (step === 'accept') await courierApi.accept(courseId);
      else await courierApi.setCourseStatus(courseId, 'en_cours');
    },
    onSuccess: (_d, step) => {
      if (step === 'accept') markAccepted(courseId);
      toast(step === 'accept' ? t('courier.accepted') : t('courier.pickedUp'));
    },
    onError: (err) => toast(errorMessage(err, t('common.networkError'))),
    onSettled: refresh,
  });

  if (!course) {
    return (
      <Screen muted>
        <Header title={t('courier.course')} />
        {/* Course acceptée depuis une proposition : pas encore dans la liste relue. */}
        {courses.isError && !courses.data ? (
          <ErrorState error={courses.error} onRetry={() => courses.refetch()} />
        ) : courses.isLoading || courses.isFetching ? (
          <View className="gap-3 p-4">
            <Skeleton className="h-32 w-full rounded-2xl" />
            <Skeleton className="h-40 w-full rounded-2xl" />
          </View>
        ) : (
          <EmptyState
            icon={<Package size={40} color={colors.primary} />}
            title={t('courier.courseGone')}
            text={t('courier.courseGoneText')}
            action={{ label: t('courier.backToCourses'), onPress: () => navigation.goBack() }}
          />
        )}
      </Screen>
    );
  }

  return (
    <Screen muted keyboard>
      <Header title={course.orderNumber} />
      <ScrollView contentContainerClassName="p-4 pb-10 gap-3">
        <CourseMapCard course={course} />
        <View className="rounded-2xl bg-white p-4 dark:bg-surface-dark-card">
          <View className="mb-2 flex-row items-center justify-between">
            <Text className="text-2xs font-bold uppercase tracking-wide text-ink-subtle">{course.trackingId}</Text>
            <CourseBadge status={course.status} />
          </View>
          <InfoRow label={t('courier.yourFee')} value={formatPrice(course.fee, lang)} strong />
          <InfoRow label={t('courier.orderTotal')} value={formatPrice(course.orderTotal, lang)} />
          {course.distanceKm != null ? (
            <InfoRow label={t('courier.distance')} value={`${course.distanceKm.toFixed(1)} km`} />
          ) : null}
        </View>

        {course.cashToCollect > 0 ? (
          <View className="flex-row items-center gap-3 rounded-2xl bg-amber-50 p-4 dark:bg-amber-900/30">
            <Banknote size={24} color={colors.star} />
            <View className="flex-1">
              <Text className="text-xs text-ink-muted dark:text-gray-300">{t('courier.collectLabel')}</Text>
              <Text className="text-xl font-extrabold text-ink dark:text-gray-100">
                {formatPrice(course.cashToCollect, lang)}
              </Text>
            </View>
          </View>
        ) : (
          <Text className="px-1 text-xs text-ink-muted dark:text-gray-400">{t('courier.alreadyPaid')}</Text>
        )}

        <Stop
          tone={colors.primary}
          label={t('courier.pickup')}
          title={course.pickup.name || t('courier.store')}
          address={course.pickup.address}
          onNavigate={
            course.status === 'assignee' && course.pickup.address
              ? () => openDirections(course.pickup.address)
              : undefined
          }
        />
        <Stop
          tone={colors.success}
          label={t('courier.dropoff')}
          title={course.dropoff.name || t('courier.customer')}
          address={course.dropoff.address}
          onNavigate={
            course.status !== 'en_attente' && (course.dropoff.coords || course.dropoff.address)
              ? () => openDirections(course.dropoff.coords ?? course.dropoff.address)
              : undefined
          }
          onCall={
            course.status !== 'en_attente' && course.dropoff.phone ? () => callPhone(course.dropoff.phone) : undefined
          }
        />

        {course.status === 'en_attente' ? (
          <Button
            title={t('courier.acceptCourse')}
            size="lg"
            loading={advance.isPending}
            onPress={() => advance.mutate('accept')}
          />
        ) : null}
        {course.status === 'assignee' ? (
          <>
            <Text className="px-1 text-xs leading-5 text-ink-muted dark:text-gray-400">{t('courier.pickupHint')}</Text>
            <Button
              title={t('courier.pickedUpAction')}
              size="lg"
              loading={advance.isPending}
              onPress={() => advance.mutate('pickup')}
            />
          </>
        ) : null}
        {course.status === 'en_cours' ? <DeliverPanel course={course} onDone={done} /> : null}
      </ScrollView>
    </Screen>
  );
}
