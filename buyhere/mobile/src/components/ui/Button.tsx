import { ActivityIndicator, Pressable, Text, View, type PressableProps } from 'react-native';
import type { ReactNode } from 'react';

type Variant = 'primary' | 'secondary' | 'outline' | 'ghost' | 'danger';
type Size = 'sm' | 'md' | 'lg';

type Props = Omit<PressableProps, 'children'> & {
  title: string;
  variant?: Variant;
  size?: Size;
  loading?: boolean;
  icon?: ReactNode;
  fullWidth?: boolean;
  className?: string;
};

const variants: Record<Variant, { box: string; text: string; spinner: string }> = {
  primary: { box: 'bg-primary active:bg-primary-600', text: 'text-white', spinner: '#FFFFFF' },
  secondary: {
    box: 'bg-primary-50 active:bg-primary-100 dark:bg-primary-900/40',
    text: 'text-primary-600 dark:text-primary-300',
    spinner: '#FF6B00',
  },
  outline: {
    box: 'border border-gray-300 bg-transparent active:bg-gray-100 dark:border-gray-600 dark:active:bg-surface-dark-muted',
    text: 'text-ink dark:text-gray-100',
    spinner: '#FF6B00',
  },
  ghost: { box: 'bg-transparent active:bg-gray-100 dark:active:bg-surface-dark-muted', text: 'text-primary', spinner: '#FF6B00' },
  danger: { box: 'bg-danger active:opacity-90', text: 'text-white', spinner: '#FFFFFF' },
};

const sizes: Record<Size, { box: string; text: string }> = {
  sm: { box: 'h-9 px-3 rounded-xl', text: 'text-sm' },
  md: { box: 'h-12 px-5 rounded-2xl', text: 'text-base' },
  lg: { box: 'h-14 px-6 rounded-2xl', text: 'text-base' },
};

/** Bouton principal de l'app : variantes, tailles, état de chargement et icône. */
export function Button({
  title,
  variant = 'primary',
  size = 'md',
  loading = false,
  disabled,
  icon,
  fullWidth = true,
  className = '',
  ...rest
}: Props) {
  const v = variants[variant];
  const s = sizes[size];
  const isDisabled = disabled || loading;

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ disabled: isDisabled, busy: loading }}
      disabled={isDisabled}
      className={`flex-row items-center justify-center ${s.box} ${v.box} ${fullWidth ? 'w-full' : 'self-start'} ${
        isDisabled ? 'opacity-50' : ''
      } ${className}`}
      {...rest}
    >
      {loading ? (
        <ActivityIndicator color={v.spinner} />
      ) : (
        <View className="flex-row items-center gap-2">
          {icon}
          <Text className={`font-semibold ${s.text} ${v.text}`} numberOfLines={1}>
            {title}
          </Text>
        </View>
      )}
    </Pressable>
  );
}
