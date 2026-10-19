import { useState } from 'react';
import { KeyboardAvoidingView, Modal, Platform, Pressable, Text, TextInput, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { Button } from './Button';
import { useTheme } from '@/theme/useTheme';

type Props = {
  title: string;
  message?: string;
  placeholder?: string;
  confirmLabel: string;
  /** Longueur minimale du texte (0 = facultatif). */
  minLength?: number;
  destructive?: boolean;
  loading?: boolean;
  onConfirm: (text: string) => void;
  onClose: () => void;
};

/**
 * Saisie d'un motif ou d'un commentaire avant une action (refus, changement
 * de statut…). Alert.prompt n'existe que sur iOS : cette fenêtre marche partout.
 * Monter le composant pour l'ouvrir, le démonter pour le fermer.
 */
export function PromptModal({
  title,
  message,
  placeholder,
  confirmLabel,
  minLength = 0,
  destructive,
  loading,
  onConfirm,
  onClose,
}: Props) {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const [text, setText] = useState('');
  const valid = text.trim().length >= minLength;

  return (
    <Modal transparent animationType="fade" onRequestClose={onClose} statusBarTranslucent>
      <KeyboardAvoidingView className="flex-1" behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <Pressable className="flex-1 items-center justify-center bg-black/50 p-5" onPress={onClose}>
          <Pressable className="w-full max-w-md rounded-3xl bg-white p-5 dark:bg-surface-dark-card" onPress={() => undefined}>
            <Text className="text-lg font-bold text-ink dark:text-gray-100">{title}</Text>
            {message ? <Text className="mt-1 text-sm text-ink-muted dark:text-gray-400">{message}</Text> : null}
            <TextInput
              value={text}
              onChangeText={setText}
              placeholder={placeholder}
              placeholderTextColor={colors.subtle}
              multiline
              autoFocus
              className="mt-4 min-h-24 rounded-2xl bg-surface-muted p-3 text-sm text-ink dark:bg-surface-dark-muted dark:text-gray-100"
              accessibilityLabel={placeholder ?? title}
              style={{ textAlignVertical: 'top' }}
            />
            <View className="mt-4 flex-row gap-2">
              <Button title={t('common.cancel')} variant="ghost" size="sm" className="flex-1" onPress={onClose} />
              <Button
                title={confirmLabel}
                variant={destructive ? 'danger' : 'primary'}
                size="sm"
                className="flex-1"
                disabled={!valid}
                loading={loading}
                onPress={() => onConfirm(text.trim())}
              />
            </View>
          </Pressable>
        </Pressable>
      </KeyboardAvoidingView>
    </Modal>
  );
}
