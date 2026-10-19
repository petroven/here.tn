import { FlatList, Pressable, RefreshControl, Text, View } from 'react-native';
import { Image } from 'expo-image';
import { useTranslation } from 'react-i18next';
import { useQuery } from '@tanstack/react-query';
import { Check, RotateCcw } from 'lucide-react-native';
import { returnsApi } from '@/api/account';
import type { ReturnRequest, ReturnStatus } from '@/api/types';
import { Header } from '@/components/ui/Header';
import { Screen } from '@/components/ui/Screen';
import { ListItemSkeleton } from '@/components/ui/Skeleton';
import { EmptyState, ErrorState } from '@/components/ui/States';
import { useSettingsStore } from '@/store/settings';
import { useTheme } from '@/theme/useTheme';
import { formatDate, formatPrice } from '@/utils/format';
import type { RootScreenProps } from '@/navigation/types';

const STATUS_STYLES: Record<ReturnStatus, { box: string; text: string }> = {
  demande: {
    box: 'bg-amber-100 dark:bg-amber-900/40',
    text: 'text-amber-700 dark:text-amber-300',
  },
  approuve: {
    box: 'bg-blue-100 dark:bg-blue-900/40',
    text: 'text-blue-700 dark:text-blue-300',
  },
  rembourse: {
    box: 'bg-green-100 dark:bg-green-900/40',
    text: 'text-green-700 dark:text-green-300',
  },
  refuse: {
    box: 'bg-gray-200 dark:bg-gray-700',
    text: 'text-gray-600 dark:text-gray-300',
  },
  litige: {
    box: 'bg-red-100 dark:bg-red-900/40',
    text: 'text-red-700 dark:text-red-300',
  },
};

// Étapes d'un retour : Demande envoyée → Examen par la boutique → Acceptée
// → Remboursement. Un refus s'arrête à l'examen ; un litige y est transmis
// à la médiation here.tn.
const STEPS = ['sent', 'review', 'accepted', 'refunded'] as const;
const STEP_REACHED: Record<ReturnStatus, number> = {
  demande: 1,
  litige: 1,
  refuse: 1,
  approuve: 2,
  rembourse: 3,
};

function ReturnCard({ item }: { item: ReturnRequest }) {
  const { t } = useTranslation();
  const lang = useSettingsStore((s) => s.language);
  const style = STATUS_STYLES[item.status];
  const reached = STEP_REACHED[item.status];
  const stopped = item.status === 'refuse';

  return (
    <View className="mx-4 mb-3 rounded-2xl bg-white p-4 dark:bg-surface-dark-card">
      <View className="flex-row items-start justify-between gap-2">
        <View className="flex-1">
          <Text className="font-bold text-ink dark:text-gray-100">{t('returns.rma', { id: item.id })}</Text>
          <Text className="mt-0.5 text-xs text-ink-muted dark:text-gray-400">
            {t('orders.order', { number: item.orderNumber })}
            {item.storeName ? ` · ${item.storeName}` : ''} · {formatDate(item.createdAt, lang)}
          </Text>
        </View>
        <View className={`rounded-full px-2.5 py-1 ${style.box}`}>
          <Text className={`text-xs font-semibold ${style.text}`}>{t(`returns.status.${item.status}`)}</Text>
        </View>
      </View>

      <Text className="mt-3 text-sm text-ink dark:text-gray-200">
        <Text className="font-semibold">{t(`returns.reason.${item.reasonCategory}`)} — </Text>
        {item.reason}
      </Text>

      {item.photos.length ? (
        <View className="mt-3 flex-row gap-2">
          {item.photos.slice(0, 5).map((uri) => (
            <Image key={uri} source={{ uri }} style={{ width: 48, height: 48, borderRadius: 10 }} />
          ))}
        </View>
      ) : null}

      {/* Progression */}
      <View className="mt-4 flex-row">
        {STEPS.map((step, i) => {
          const done = i <= reached;
          const isRefusal = stopped && i === 1;
          // Un segment est coloré quand l'étape à laquelle il mène est atteinte.
          const lineIn = i > 0 && done && !isRefusal ? 'bg-primary' : 'bg-gray-200 dark:bg-gray-700';
          const lineOut = i + 1 <= reached && !stopped ? 'bg-primary' : 'bg-gray-200 dark:bg-gray-700';
          return (
            <View key={step} className="flex-1 items-center">
              <View className="w-full flex-row items-center">
                <View className={`h-0.5 flex-1 ${i === 0 ? 'opacity-0' : lineIn}`} />
                <View
                  className={`h-6 w-6 items-center justify-center rounded-full ${
                    isRefusal
                      ? 'bg-gray-400'
                      : done
                        ? 'bg-primary'
                        : 'border-2 border-gray-200 bg-white dark:border-gray-700 dark:bg-surface-dark-card'
                  }`}
                >
                  {done ? <Check size={13} color="#fff" strokeWidth={3} /> : null}
                </View>
                <View className={`h-0.5 flex-1 ${i === STEPS.length - 1 ? 'opacity-0' : lineOut}`} />
              </View>
              <Text
                className={`mt-1.5 text-center text-2xs font-semibold ${done ? 'text-ink dark:text-gray-200' : 'text-ink-subtle'}`}
              >
                {isRefusal ? t('returns.status.refuse') : t(`returns.step.${step}`)}
              </Text>
            </View>
          );
        })}
      </View>

      {item.status === 'litige' ? (
        <Text className="mt-3 text-xs text-ink-muted dark:text-gray-400">{t('returns.mediationText')}</Text>
      ) : null}
      {item.status === 'demande' && item.vendorDeadline ? (
        <Text className="mt-3 text-xs text-ink-muted dark:text-gray-400">
          {t('returns.deadline', {
            date: formatDate(item.vendorDeadline, lang),
          })}
        </Text>
      ) : null}
      {item.sellerComment ? (
        <Text className="mt-3 rounded-xl bg-surface-muted p-3 text-xs text-ink-muted dark:bg-surface-dark-muted dark:text-gray-300">
          {t('returns.sellerComment')} : {item.sellerComment}
        </Text>
      ) : null}
      {item.status === 'rembourse' && item.refundAmount !== null ? (
        <Text className="mt-3 text-sm font-semibold text-success">
          {t('returns.refunded', {
            amount: formatPrice(item.refundAmount, lang),
          })}
        </Text>
      ) : null}
    </View>
  );
}

/** Mes retours : demandes en cours et passées, avec leur avancement. */
export function ReturnsScreen({ navigation }: RootScreenProps<'Returns'>) {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const returns = useQuery({ queryKey: ['returns'], queryFn: returnsApi.list });

  return (
    <Screen muted>
      <Header title={t('returns.title')} />
      {returns.isError && !returns.data ? (
        <ErrorState error={returns.error} onRetry={() => returns.refetch()} />
      ) : (
        <FlatList
          data={returns.data ?? []}
          keyExtractor={(r) => r.id}
          contentContainerClassName="pt-3 pb-6 flex-grow"
          renderItem={({ item }) => (
            <Pressable
              onPress={() => navigation.navigate('OrderDetail', { orderId: item.orderId })}
              accessibilityRole="button"
            >
              <ReturnCard item={item} />
            </Pressable>
          )}
          ListEmptyComponent={
            returns.isLoading ? (
              <>
                <ListItemSkeleton />
                <ListItemSkeleton />
              </>
            ) : (
              <EmptyState
                icon={<RotateCcw size={40} color={colors.primary} />}
                title={t('returns.empty')}
                text={t('returns.emptyText')}
              />
            )
          }
          refreshControl={
            <RefreshControl
              refreshing={returns.isRefetching}
              onRefresh={() => returns.refetch()}
              tintColor={colors.primary}
              colors={[colors.primary]}
            />
          }
        />
      )}
    </Screen>
  );
}
