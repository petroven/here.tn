import { useState } from 'react';
import { ScrollView, Text, View } from 'react-native';
import { Image } from 'expo-image';
import * as ImagePicker from 'expo-image-picker';
import { useTranslation } from 'react-i18next';
import { useMutation } from '@tanstack/react-query';
import { BadgeCheck, Camera, FileImage } from 'lucide-react-native';
import { errorMessage } from '@/api/client';
import { sellerApi } from '@/api/vendor';
import { Button } from '@/components/ui/Button';
import { Header } from '@/components/ui/Header';
import { Input } from '@/components/ui/Input';
import { Screen } from '@/components/ui/Screen';
import { Skeleton } from '@/components/ui/Skeleton';
import { toast } from '@/components/ui/toast';
import { useRefreshSeller, useSellerDashboard } from '@/hooks/useSeller';
import { useTheme } from '@/theme/useTheme';
import type { RootScreenProps } from '@/navigation/types';

type Doc = { uri: string; mimeType?: string | null } | null;

/** Justificatif : aperçu + prise de photo ou choix dans la galerie. */
function DocPicker({
  label,
  doc,
  onChange,
  already,
}: {
  label: string;
  doc: Doc;
  onChange: (d: Doc) => void;
  already: boolean;
}) {
  const { t } = useTranslation();
  const { colors } = useTheme();

  const pick = async (camera: boolean) => {
    if (camera) {
      const permission = await ImagePicker.requestCameraPermissionsAsync();
      if (!permission.granted) return toast(t('returns.cameraDenied'));
    }
    const options: ImagePicker.ImagePickerOptions = { mediaTypes: ['images'], quality: 0.8 };
    const result = camera
      ? await ImagePicker.launchCameraAsync(options)
      : await ImagePicker.launchImageLibraryAsync(options);
    if (!result.canceled) onChange({ uri: result.assets[0].uri, mimeType: result.assets[0].mimeType });
  };

  return (
    <View>
      <Text className="mb-2 text-sm font-medium text-ink dark:text-gray-200">{label}</Text>
      <View className="flex-row items-center gap-3">
        {doc ? (
          <Image source={{ uri: doc.uri }} style={{ width: 72, height: 72, borderRadius: 12 }} />
        ) : (
          <View className="h-[72px] w-[72px] items-center justify-center rounded-xl bg-surface-muted dark:bg-surface-dark-muted">
            <FileImage size={24} color={colors.subtle} />
          </View>
        )}
        <View className="flex-1 gap-2">
          <View className="flex-row gap-2">
            <Button
              title={t('returns.camera')}
              size="sm"
              variant="secondary"
              icon={<Camera size={15} color={colors.primary} />}
              onPress={() => pick(true)}
            />
            <Button title={t('returns.gallery')} size="sm" variant="outline" onPress={() => pick(false)} />
          </View>
          {already && !doc ? <Text className="text-2xs text-ink-subtle">{t('seller.kycDocOnFile')}</Text> : null}
        </View>
      </View>
    </View>
  );
}

/**
 * Vérification d'identité (KYC) : numéro de CIN, RIB et leurs justificatifs
 * photographiés. Validée par un administrateur, elle donne le badge
 * « Boutique vérifiée ». Les documents restent sur le serveur here.tn.
 */
export function SellerKycScreen(_props: RootScreenProps<'SellerKyc'>) {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const dashboard = useSellerDashboard();
  const refresh = useRefreshSeller();
  const store = dashboard.data?.store;
  const [cinDraft, setCin] = useState<string | null>(null);
  const [ribDraft, setRib] = useState<string | null>(null);
  const cin = cinDraft ?? store?.kycCin ?? '';
  const rib = ribDraft ?? store?.kycRib ?? store?.iban ?? '';
  const [cinDoc, setCinDoc] = useState<Doc>(null);
  const [ribDoc, setRibDoc] = useState<Doc>(null);

  const submit = useMutation({
    mutationFn: () => {
      if (!/^\d{8}$/.test(cin.trim())) throw new Error(t('seller.kycCinInvalid'));
      if (rib.replace(/\s/g, '').length < 20) throw new Error(t('seller.ibanInvalid'));
      return sellerApi.submitKyc({ cin, rib, cinDocument: cinDoc, ribDocument: ribDoc });
    },
    onSuccess: () => {
      refresh();
      setCinDoc(null);
      setRibDoc(null);
      toast(t('seller.kycSent'));
    },
    onError: (err) => toast(errorMessage(err, t('common.networkError'))),
  });

  if (!store) {
    return (
      <Screen muted>
        <Header title={t('seller.kyc')} />
        <Skeleton className="m-4 h-80 rounded-2xl" />
      </Screen>
    );
  }

  const alreadySubmitted = store.kycStatus !== 'non_soumis';

  return (
    <Screen muted keyboard>
      <Header title={t('seller.kyc')} />
      <ScrollView contentContainerClassName="p-4 pb-10 gap-3" keyboardShouldPersistTaps="handled">
        <View
          className={`flex-row items-center gap-3 rounded-2xl p-4 ${
            store.kycStatus === 'valide'
              ? 'bg-green-50 dark:bg-green-900/20'
              : store.kycStatus === 'rejete'
                ? 'bg-red-50 dark:bg-red-900/20'
                : 'bg-amber-50 dark:bg-amber-900/20'
          }`}
        >
          <BadgeCheck size={22} color={store.kycStatus === 'valide' ? colors.success : colors.primary} />
          <View className="flex-1">
            <Text className="font-bold text-ink dark:text-gray-100">{t(`seller.kycStatus.${store.kycStatus}`)}</Text>
            {store.kycComment ? (
              <Text className="mt-0.5 text-xs text-ink-muted dark:text-gray-400">{store.kycComment}</Text>
            ) : null}
          </View>
        </View>

        {store.kycStatus !== 'valide' ? (
          <View className="gap-4 rounded-2xl bg-white p-4 dark:bg-surface-dark-card">
            <Text className="text-sm text-ink-muted dark:text-gray-400">{t('seller.kycIntro')}</Text>
            <Input
              label={t('seller.kycCin')}
              value={cin}
              onChangeText={setCin}
              keyboardType="number-pad"
              maxLength={8}
            />
            <DocPicker label={t('seller.kycCinDoc')} doc={cinDoc} onChange={setCinDoc} already={alreadySubmitted} />
            <Input
              label={t('seller.kycRib')}
              value={rib}
              onChangeText={setRib}
              autoCapitalize="characters"
              autoCorrect={false}
            />
            <DocPicker label={t('seller.kycRibDoc')} doc={ribDoc} onChange={setRibDoc} already={alreadySubmitted} />
            <Button
              title={alreadySubmitted ? t('seller.kycResubmit') : t('seller.kycSubmit')}
              size="lg"
              loading={submit.isPending}
              disabled={!alreadySubmitted && (!cinDoc || !ribDoc)}
              onPress={() => submit.mutate()}
            />
            <Text className="text-2xs text-ink-subtle">{t('seller.kycPrivacy')}</Text>
          </View>
        ) : null}
      </ScrollView>
    </Screen>
  );
}
