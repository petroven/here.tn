import { useEffect, useRef, useState } from 'react';
import { FlatList, Pressable, Text, View, useWindowDimensions, type ViewToken } from 'react-native';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import type { Banner } from '@/api/types';

type Props = { banners: Banner[]; onPress: (banner: Banner) => void };

const AUTOPLAY_MS = 4500;

/** Carrousel de bannières promo : défilement automatique, pagination par points. */
export function BannerCarousel({ banners, onPress }: Props) {
  const { width } = useWindowDimensions();
  const itemWidth = width - 32;
  const listRef = useRef<FlatList<Banner>>(null);
  const [index, setIndex] = useState(0);

  // Défilement automatique (redémarre après chaque changement manuel).
  useEffect(() => {
    if (banners.length < 2) return;
    const id = setTimeout(() => {
      const next = (index + 1) % banners.length;
      listRef.current?.scrollToIndex({ index: next, animated: true });
    }, AUTOPLAY_MS);
    return () => clearTimeout(id);
  }, [index, banners.length]);

  const onViewable = useRef(({ viewableItems }: { viewableItems: ViewToken<Banner>[] }) => {
    if (viewableItems[0]?.index != null) setIndex(viewableItems[0].index);
  }).current;

  if (banners.length === 0) return null;

  return (
    <View>
      <FlatList
        ref={listRef}
        data={banners}
        keyExtractor={(b) => b.id}
        horizontal
        pagingEnabled
        snapToInterval={itemWidth + 12}
        decelerationRate="fast"
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={{ paddingHorizontal: 16, gap: 12 }}
        onViewableItemsChanged={onViewable}
        viewabilityConfig={{ itemVisiblePercentThreshold: 60 }}
        getItemLayout={(_, i) => ({ length: itemWidth + 12, offset: (itemWidth + 12) * i, index: i })}
        renderItem={({ item }) => (
          <Pressable
            onPress={() => onPress(item)}
            style={{ width: itemWidth, height: itemWidth * 0.46 }}
            className="overflow-hidden rounded-3xl"
            accessibilityRole="button"
            accessibilityLabel={item.title}
          >
            <Image source={{ uri: item.imageUrl }} style={{ width: '100%', height: '100%' }} contentFit="cover" transition={250} />
            <LinearGradient
              colors={['rgba(0,0,0,0.65)', 'rgba(0,0,0,0.05)']}
              start={{ x: 0, y: 0.5 }}
              end={{ x: 1, y: 0.5 }}
              style={{ position: 'absolute', inset: 0 }}
            />
            <View className="absolute inset-0 justify-center px-5">
              <Text className="max-w-[70%] text-xl font-extrabold leading-7 text-white">{item.title}</Text>
              {item.subtitle ? <Text className="mt-1 text-sm text-white/90">{item.subtitle}</Text> : null}
              <View className="mt-3 self-start rounded-full bg-primary px-3 py-1.5">
                <Text className="text-xs font-bold text-white">Shop →</Text>
              </View>
            </View>
          </Pressable>
        )}
      />
      <View className="mt-3 flex-row justify-center gap-1.5">
        {banners.map((b, i) => (
          <View
            key={b.id}
            className={`h-1.5 rounded-full ${i === index ? 'w-5 bg-primary' : 'w-1.5 bg-gray-300 dark:bg-gray-600'}`}
          />
        ))}
      </View>
    </View>
  );
}
