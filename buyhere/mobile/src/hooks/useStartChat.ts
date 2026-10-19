import { useState } from 'react';
import { useNavigation } from '@react-navigation/native';
import { useTranslation } from 'react-i18next';
import { chatApi } from '@/api/account';
import { errorMessage } from '@/api/client';
import { toast } from '@/components/ui/toast';
import { useRequireAuth } from './useRequireAuth';

/**
 * « Contacter la boutique » : ouvre (ou retrouve) la conversation avec le
 * vendeur puis affiche le fil. Passe par la connexion si besoin.
 */
export function useStartChat() {
  const navigation = useNavigation();
  const requireAuth = useRequireAuth();
  const { t } = useTranslation();
  const [opening, setOpening] = useState(false);

  const start = (vendorId: string | null | undefined, storeName: string, subject?: string) => {
    if (!vendorId) return;
    requireAuth(async () => {
      setOpening(true);
      try {
        const conversation = await chatApi.open(vendorId, subject);
        navigation.navigate('Chat', {
          conversationId: conversation.id,
          title: conversation.peer.name || storeName,
        });
      } catch (err) {
        toast(errorMessage(err, t('common.networkError')));
      } finally {
        setOpening(false);
      }
    });
  };

  return { start, opening };
}
