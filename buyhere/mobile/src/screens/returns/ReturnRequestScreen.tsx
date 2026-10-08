import { useState } from 'react';
import { Pressable, ScrollView, Text, TextInput, View } from 'react-native';
import { Image } from 'expo-image';
import * as ImagePicker from 'expo-image-picker';
import { useTranslation } from 'react-i18next';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Camera, ImagePlus, X } from 'lucide-react-native';
import { returnsApi } from '@/api/account';
import { errorMessage } from '@/api/client';
import type { ReturnReason } from '@/api/types';
import { Button } from '@/components/ui/Button';
import { Chip } from '@/components/ui/Chip';
import { Header } from '@/components/ui/Header';
import { Screen } from '@/components/ui/Screen';
import { toast } from '@/components/ui/toast';
import { useTheme } from '@/theme/useTheme';
import type { RootScreenProps } from '@/navigation/types';

const MAX_PHOTOS = 5;
const REASONS: ReturnReason[] = ['defaut', 'non_conforme', 'changement_avis'];

type Photo = {
  uri: string;
  mimeType?: string | null;
  fileName?: string | null;
};

/**
 * Demande de retour d'une commande livrée — mêmes règles que le site : motif
 * catégorisé, description, au moins une photo, dans la fenêtre de retour
 * des articles. La boutique a 48 h pour répondre, sinon la demande passe en
 * médiation.
 */
export function ReturnRequestScreen({ route, navigation }: RootScreenProps<'ReturnRequest'>) {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const qc = useQueryClient();
  const { orderId, orderNumber } = route.params;
  const [reasonCategory, setReasonCategory] = useState<ReturnReason | null>(null);
  const [reason, setReason] = useState('');
  const [photos, setPhotos] = useState<Photo[]>([]);

  const addPhotos = async (source: 'library' | 'camera') => {
    const options: ImagePicker.ImagePickerOptions = {
      mediaTypes: ['images'],
      quality: 0.7,
      allowsMultipleSelection: source === 'library',
      selectionLimit: MAX_PHOTOS - photos.length,
    };
    if (source === 'camera') {
      const permission = await ImagePicker.requestCameraPermissionsAsync();
      if (!permission.granted) {
        toast(t('returns.cameraDenied'));
        return;
      }
    }
    const result =
      source === 'camera'
        ? await ImagePicker.launchCameraAsync(options)
        : await ImagePicker.launchImageLibraryAsync(options);
    if (result.canceled) return;
    setPhotos((current) =>
      [
        ...current,
        ...result.assets.map((a) => ({
          uri: a.uri,
          mimeType: a.mimeType,
          fileName: a.fileName,
        })),
      ].slice(0, MAX_PHOTOS),
    );
  };

  const submit = useMutation({
    mutationFn: () =>
      returnsApi.create({
        orderId,
        reasonCategory: reasonCategory!,
        reason: reason.trim(),
        photos,
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['returns'] });
      qc.invalidateQueries({ queryKey: ['orders'] });
      qc.invalidateQueries({ queryKey: ['order', orderId] });
      toast(t('returns.sent'));
      navigation.replace('Returns');
    },
    onError: (err) => toast(errorMessage(err, t('common.networkError'))),
  });

  const ready = reasonCategory && reason.trim().length >= 10 && photos.length > 0;

  return (
    <Screen muted keyboard>
      <Header title={t('returns.requestTitle')} />
      <ScrollView contentContainerClassName="p-4 pb-8 gap-4" keyboardShouldPersistTaps="handled">
        <Text className="text-sm text-ink-muted dark:text-gray-400">
          {t('returns.requestIntro', { number: orderNumber })}
        </Text>

        <View className="rounded-2xl bg-white p-4 dark:bg-surface-dark-card">
          <Text className="mb-3 font-bold text-ink dark:text-gray-100">{t('returns.reasonLabel')}</Text>
          <View className="flex-row flex-wrap gap-2">
            {REASONS.map((r) => (
              <Chip
                key={r}
                label={t(`returns.reason.${r}`)}
                selected={reasonCategory === r}
                onPress={() => setReasonCategory(r)}
              />
            ))}
          </View>
          {reasonCategory ? (
            <Text className="mt-3 text-xs text-ink-muted dark:text-gray-400">
              {reasonCategory === 'changement_avis' ? t('returns.feesClient') : t('returns.feesSeller')}
            </Text>
          ) : null}
        </View>

        <View className="rounded-2xl bg-white p-4 dark:bg-surface-dark-card">
          <Text className="mb-2 font-bold text-ink dark:text-gray-100">{t('returns.descriptionLabel')}</Text>
          <TextInput
            value={reason}
            onChangeText={setReason}
            placeholder={t('returns.descriptionPlaceholder')}
            placeholderTextColor={colors.subtle}
            multiline
            maxLength={1000}
            textAlignVertical="top"
            className="min-h-28 rounded-2xl bg-surface-muted p-3.5 text-base text-ink dark:bg-surface-dark-muted dark:text-gray-100"
            accessibilityLabel={t('returns.descriptionLabel')}
          />
          {reason.trim().length > 0 && reason.trim().length < 10 ? (
            <Text className="mt-1.5 text-xs text-danger">{t('returns.descriptionTooShort')}</Text>
          ) : null}
        </View>

        <View className="rounded-2xl bg-white p-4 dark:bg-surface-dark-card">
          <Text className="font-bold text-ink dark:text-gray-100">
            {t('returns.photosLabel', {
              count: photos.length,
              max: MAX_PHOTOS,
            })}
          </Text>
          <Text className="mb-3 mt-0.5 text-xs text-ink-muted dark:text-gray-400">{t('returns.photosHint')}</Text>
          <View className="flex-row flex-wrap gap-2.5">
            {photos.map((photo, i) => (
              <View key={photo.uri}>
                <Image source={{ uri: photo.uri }} style={{ width: 84, height: 84, borderRadius: 14 }} />
                <Pressable
                  onPress={() => setPhotos((list) => list.filter((_, j) => j !== i))}
                  className="absolute -end-1.5 -top-1.5 h-6 w-6 items-center justify-center rounded-full bg-ink"
                  accessibilityRole="button"
                  accessibilityLabel={t('returns.removePhoto')}
                  hitSlop={6}
                >
                  <X size={14} color="#fff" />
                </Pressable>
              </View>
            ))}
            {photos.length < MAX_PHOTOS ? (
              <>
                <Pressable
                  onPress={() => addPhotos('camera')}
                  className="h-[84px] w-[84px] items-center justify-center gap-1 rounded-2xl border border-dashed border-gray-300 dark:border-gray-600"
                  accessibilityRole="button"
                  accessibilityLabel={t('returns.takePhoto')}
                >
                  <Camera size={22} color={colors.primary} />
                  <Text className="text-2xs font-semibold text-primary">{t('returns.camera')}</Text>
                </Pressable>
                <Pressable
                  onPress={() => addPhotos('library')}
                  className="h-[84px] w-[84px] items-center justify-center gap-1 rounded-2xl border border-dashed border-gray-300 dark:border-gray-600"
                  accessibilityRole="button"
                  accessibilityLabel={t('returns.pickPhoto')}
                >
                  <ImagePlus size={22} color={colors.primary} />
                  <Text className="text-2xs font-semibold text-primary">{t('returns.gallery')}</Text>
                </Pressable>
              </>
            ) : null}
          </View>
        </View>

        <Text className="text-xs leading-5 text-ink-muted dark:text-gray-400">{t('returns.policy')}</Text>
      </ScrollView>

      <View className="border-t border-gray-100 bg-white px-4 py-3 dark:border-gray-800 dark:bg-surface-dark">
        <Button
          title={t('returns.submit')}
          size="lg"
          disabled={!ready}
          loading={submit.isPending}
          onPress={() => submit.mutate()}
        />
      </View>
    </Screen>
  );
}
