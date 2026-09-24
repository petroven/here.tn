import { useRef, useState } from 'react';
import { FlatList, Pressable, Text, View, useWindowDimensions, type ViewToken } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';
import { CreditCard, ShoppingBag, Truck, type LucideIcon } from 'lucide-react-native';
import { Button } from '@/components/ui/Button';
import { useSettingsStore } from '@/store/settings';
import type { RootScreenProps } from '@/navigation/types';

type Slide = { key: string; icon: LucideIcon; title: string; text: string };

/** Onboarding en 3 slides, affiché uniquement à la première ouverture. */
export function OnboardingScreen({ navigation }: RootScreenProps<'Onboarding'>) {
  const { t } = useTranslation();
  const { width } = useWindowDimensions();
  const completeOnboarding = useSettingsStore((s) => s.completeOnboarding);
  const listRef = useRef<FlatList<Slide>>(null);
  const [index, setIndex] = useState(0);

  const slides: Slide[] = [
    { key: '1', icon: ShoppingBag, title: t('onboarding.slide1Title'), text: t('onboarding.slide1Text') },
    { key: '2', icon: Truck, title: t('onboarding.slide2Title'), text: t('onboarding.slide2Text') },
    { key: '3', icon: CreditCard, title: t('onboarding.slide3Title'), text: t('onboarding.slide3Text') },
  ];
  const isLast = index === slides.length - 1;

  const finish = () => {
    completeOnboarding();
    navigation.reset({ index: 0, routes: [{ name: 'Main' }] });
  };

  const next = () => (isLast ? finish() : listRef.current?.scrollToIndex({ index: index + 1 }));

  const onViewable = useRef(({ viewableItems }: { viewableItems: ViewToken<Slide>[] }) => {
    if (viewableItems[0]?.index != null) setIndex(viewableItems[0].index);
  }).current;

  return (
    <SafeAreaView className="flex-1 bg-white dark:bg-surface-dark">
      <View className="h-12 flex-row items-center justify-end px-5">
        {!isLast ? (
          <Pressable onPress={finish} hitSlop={10} accessibilityRole="button">
            <Text className="font-semibold text-ink-muted dark:text-gray-400">{t('onboarding.skip')}</Text>
          </Pressable>
        ) : null}
      </View>

      <FlatList
        ref={listRef}
        data={slides}
        keyExtractor={(s) => s.key}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        onViewableItemsChanged={onViewable}
        viewabilityConfig={{ itemVisiblePercentThreshold: 60 }}
        getItemLayout={(_, i) => ({ length: width, offset: width * i, index: i })}
        renderItem={({ item }) => {
          const Icon = item.icon;
          return (
            <View style={{ width }} className="flex-1 items-center justify-center px-8">
              <View className="mb-10 h-56 w-56 items-center justify-center rounded-full bg-primary-50 dark:bg-primary-900/30">
                <View className="h-36 w-36 items-center justify-center rounded-full bg-primary-100 dark:bg-primary-900/50">
                  <Icon size={72} color="#C4532C" strokeWidth={1.6} />
                </View>
              </View>
              <Text className="text-center text-2xl font-extrabold text-ink dark:text-gray-100">{item.title}</Text>
              <Text className="mt-3 text-center text-base leading-6 text-ink-muted dark:text-gray-400">{item.text}</Text>
            </View>
          );
        }}
      />

      <View className="px-6 pb-6">
        <View className="mb-8 flex-row justify-center gap-2">
          {slides.map((s, i) => (
            <View
              key={s.key}
              className={`h-2 rounded-full ${i === index ? 'w-7 bg-primary' : 'w-2 bg-gray-300 dark:bg-gray-600'}`}
            />
          ))}
        </View>
        <Button title={isLast ? t('onboarding.start') : t('onboarding.next')} size="lg" onPress={next} />
      </View>
    </SafeAreaView>
  );
}
