import { FlatList, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { MapPin, Plus } from 'lucide-react-native';
import { meApi } from '@/api/endpoints';
import { AddressCard } from '@/components/AddressCard';
import { Button } from '@/components/ui/Button';
import { Header } from '@/components/ui/Header';
import { Screen } from '@/components/ui/Screen';
import { ListItemSkeleton } from '@/components/ui/Skeleton';
import { EmptyState, ErrorState } from '@/components/ui/States';
import { qk, useAddresses } from '@/hooks/queries';
import { useTheme } from '@/theme/useTheme';
import type { RootScreenProps } from '@/navigation/types';

/**
 * Carnet d'adresses. En mode sélection (depuis le checkout), toucher une
 * adresse la définit par défaut et revient au paiement.
 */
export function AddressesScreen({ navigation, route }: RootScreenProps<'Addresses'>) {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const qc = useQueryClient();
  const addresses = useAddresses();
  const selectMode = !!route.params?.selectMode;

  const makeDefault = useMutation({
    mutationFn: (id: string) => meApi.updateAddress(id, { isDefault: true }),
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: qk.addresses });
      navigation.goBack();
    },
  });

  return (
    <Screen muted>
      <Header title={t('address.title')} />
      {addresses.isError && !addresses.data ? (
        <ErrorState error={addresses.error} onRetry={() => addresses.refetch()} />
      ) : (
        <FlatList
          data={addresses.data ?? []}
          keyExtractor={(a) => a.id}
          contentContainerClassName="gap-3 p-4 flex-grow"
          renderItem={({ item }) => (
            <AddressCard
              address={item}
              selected={selectMode && item.isDefault}
              onPress={selectMode ? () => makeDefault.mutate(item.id) : () => navigation.navigate('AddressForm', { addressId: item.id })}
              onEdit={() => navigation.navigate('AddressForm', { addressId: item.id })}
            />
          )}
          ListEmptyComponent={
            addresses.isLoading ? (
              <View className="-mx-4">
                <ListItemSkeleton />
                <ListItemSkeleton />
              </View>
            ) : (
              <EmptyState icon={<MapPin size={40} color={colors.primary} />} title={t('address.empty')} text={t('address.emptyText')} />
            )
          }
        />
      )}
      <View className="border-t border-gray-100 bg-white px-4 py-3 dark:border-gray-800 dark:bg-surface-dark">
        <Button
          title={t('address.new')}
          icon={<Plus size={18} color="#fff" />}
          onPress={() => navigation.navigate('AddressForm')}
        />
      </View>
    </Screen>
  );
}
