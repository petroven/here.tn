import { forwardRef, useState, type ReactNode } from 'react';
import { I18nManager, Pressable, Text, TextInput, View, type TextInputProps } from 'react-native';
import { Eye, EyeOff } from 'lucide-react-native';
import { useTheme } from '@/theme/useTheme';

type Props = TextInputProps & {
  label?: string;
  error?: string | null;
  hint?: string;
  leftIcon?: ReactNode;
  right?: ReactNode;
  containerClassName?: string;
};

/** Champ de saisie avec libellé, icône, message d'erreur et affichage du mot de passe. */
export const Input = forwardRef<TextInput, Props>(function Input(
  { label, error, hint, leftIcon, right, secureTextEntry, containerClassName = '', className = '', ...rest },
  ref,
) {
  const { colors } = useTheme();
  const [focused, setFocused] = useState(false);
  const [hidden, setHidden] = useState(true);
  const isPassword = !!secureTextEntry;

  const border = error
    ? 'border-danger'
    : focused
      ? 'border-primary'
      : 'border-gray-200 dark:border-gray-700';

  return (
    <View className={`w-full ${containerClassName}`}>
      {label ? <Text className="mb-1.5 text-sm font-medium text-ink dark:text-gray-200">{label}</Text> : null}
      <View
        className={`h-12 flex-row items-center rounded-2xl border bg-surface-muted px-3.5 dark:bg-surface-dark-muted ${border}`}
      >
        {leftIcon ? <View className="me-2.5">{leftIcon}</View> : null}
        <TextInput
          ref={ref}
          className={`h-full flex-1 text-base text-ink dark:text-gray-100 ${className}`}
          placeholderTextColor={colors.subtle}
          secureTextEntry={isPassword && hidden}
          onFocus={(e) => {
            setFocused(true);
            rest.onFocus?.(e);
          }}
          onBlur={(e) => {
            setFocused(false);
            rest.onBlur?.(e);
          }}
          style={{ textAlign: I18nManager.isRTL ? 'right' : 'left' }}
          {...rest}
        />
        {isPassword ? (
          <Pressable
            onPress={() => setHidden((h) => !h)}
            hitSlop={10}
            accessibilityRole="button"
            accessibilityLabel={hidden ? 'Afficher le mot de passe' : 'Masquer le mot de passe'}
          >
            {hidden ? <Eye size={20} color={colors.muted} /> : <EyeOff size={20} color={colors.muted} />}
          </Pressable>
        ) : (
          right
        )}
      </View>
      {error ? (
        <Text className="mt-1 text-xs text-danger">{error}</Text>
      ) : hint ? (
        <Text className="mt-1 text-xs text-ink-muted dark:text-gray-400">{hint}</Text>
      ) : null}
    </View>
  );
});
