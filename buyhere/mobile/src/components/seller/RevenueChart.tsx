import { useState } from 'react';
import { Pressable, Text, View, useWindowDimensions } from 'react-native';
import Svg, { Line, Path, Rect, Text as SvgText } from 'react-native-svg';
import { useTranslation } from 'react-i18next';
import { useSettingsStore } from '@/store/settings';
import { useTheme } from '@/theme/useTheme';
import { formatPrice } from '@/utils/format';

type Point = { date: string; revenue: number; orders: number };

// Graduations « propres » (0 / 50 / 100…) couvrant le maximum, en dinars.
function ticks(maxTnd: number) {
  if (maxTnd <= 0) return [0, 1];
  const raw = maxTnd / 3;
  const power = 10 ** Math.floor(Math.log10(raw));
  const step = [1, 2, 2.5, 5, 10].map((m) => m * power).find((s) => s >= raw) ?? raw;
  const out: number[] = [];
  for (let v = 0; v < maxTnd + step; v += step) out.push(Math.round(v * 1000) / 1000);
  return out;
}

/**
 * Chiffre d'affaires quotidien (une seule série, donc pas de légende : le
 * titre la nomme). Colonnes ≤ 24 px à bout arrondi posées sur la ligne de
 * base, grille fine ; seule la valeur maximale est écrite. Toucher une
 * colonne affiche le détail du jour ; la vue « Tableau » donne toutes les
 * valeurs (lecteurs d'écran compris).
 */
export function RevenueChart({ series }: { series: Point[] }) {
  const { t } = useTranslation();
  const { colors, isDark } = useTheme();
  const lang = useSettingsStore((s) => s.language);
  const { width: screen } = useWindowDimensions();
  const [selected, setSelected] = useState<number | null>(null);
  const [table, setTable] = useState(false);

  const width = screen - 32 - 32; // marges écran + carte
  const height = 170;
  const pad = { top: 18, right: 4, bottom: 22, left: 40 };
  const plotW = width - pad.left - pad.right;
  const plotH = height - pad.top - pad.bottom;

  const maxTnd = Math.max(0, ...series.map((p) => p.revenue / 1000));
  const scale = ticks(maxTnd);
  const top = scale[scale.length - 1] || 1;
  const band = plotW / Math.max(series.length, 1);
  const barW = Math.min(24, Math.max(4, band - 2));
  const y = (tnd: number) => pad.top + plotH - (tnd / top) * plotH;
  const maxIndex = maxTnd > 0 ? series.findIndex((p) => p.revenue / 1000 === maxTnd) : -1;
  const labelEvery = series.length <= 7 ? 1 : 5;
  const grid = isDark ? '#3A342E' : '#E8E3DA';
  const muted = colors.muted;

  const day = (date: string, short: boolean) =>
    new Date(`${date}T12:00:00Z`).toLocaleDateString(
      lang === 'ar' ? 'ar-TN' : 'fr-FR',
      short
        ? series.length <= 7
          ? { weekday: 'narrow' }
          : { day: 'numeric' }
        : { weekday: 'long', day: 'numeric', month: 'long' },
    );

  // Colonne : base carrée sur la ligne de base, bout arrondi de 4 px.
  const column = (x: number, topY: number, h: number) => {
    if (h <= 0) return '';
    const r = Math.min(4, h, barW / 2);
    const base = topY + h;
    return `M${x},${base} V${topY + r} Q${x},${topY} ${x + r},${topY} H${x + barW - r} Q${x + barW},${topY} ${x + barW},${topY + r} V${base} Z`;
  };

  const point = selected !== null ? series[selected] : null;

  return (
    <View>
      <View className="mb-2 flex-row items-center justify-between">
        <Text className="text-xs text-ink-muted dark:text-gray-400" numberOfLines={1}>
          {point
            ? `${day(point.date, false)} · ${formatPrice(point.revenue, lang)} · ${t('seller.ordersCount', { count: point.orders })}`
            : t('seller.chartHint')}
        </Text>
        <Pressable onPress={() => setTable((v) => !v)} hitSlop={8} accessibilityRole="button">
          <Text className="text-xs font-semibold text-primary">{table ? t('seller.chart') : t('seller.table')}</Text>
        </Pressable>
      </View>

      {table ? (
        <View>
          {series.map((p) => (
            <View
              key={p.date}
              className="flex-row justify-between border-b border-gray-100 py-1.5 dark:border-gray-800"
            >
              <Text className="text-sm text-ink dark:text-gray-200">{day(p.date, false)}</Text>
              <Text className="text-sm font-semibold text-ink dark:text-gray-100">
                {formatPrice(p.revenue, lang)} · {p.orders}
              </Text>
            </View>
          ))}
        </View>
      ) : (
        <View accessible accessibilityLabel={t('seller.chartA11y', { max: formatPrice(maxTnd * 1000, lang) })}>
          <Svg width={width} height={height}>
            {scale.map((v) => (
              <Line
                key={`g${v}`}
                x1={pad.left}
                x2={width - pad.right}
                y1={y(v)}
                y2={y(v)}
                stroke={grid}
                strokeWidth={1}
              />
            ))}
            {scale.map((v) => (
              <SvgText key={`t${v}`} x={pad.left - 6} y={y(v) + 3} fontSize={9} fill={muted} textAnchor="end">
                {v.toLocaleString('fr-TN')}
              </SvgText>
            ))}
            {series.map((p, i) => {
              const xBand = pad.left + i * band;
              const x = xBand + (band - barW) / 2;
              const topY = y(p.revenue / 1000);
              const h = pad.top + plotH - topY;
              const active = selected === null || selected === i;
              return <Path key={p.date} d={column(x, topY, h)} fill={colors.primary} opacity={active ? 1 : 0.45} />;
            })}
            {maxIndex >= 0 ? (
              <SvgText
                x={pad.left + maxIndex * band + band / 2}
                y={y(maxTnd) - 5}
                fontSize={10}
                fontWeight="bold"
                fill={colors.text}
                textAnchor="middle"
              >
                {maxTnd.toLocaleString('fr-TN', { maximumFractionDigits: 0 })}
              </SvgText>
            ) : null}
            {series.map((p, i) =>
              i % labelEvery === 0 ? (
                <SvgText
                  key={`l${p.date}`}
                  x={pad.left + i * band + band / 2}
                  y={height - 6}
                  fontSize={10}
                  fill={muted}
                  textAnchor="middle"
                >
                  {day(p.date, true)}
                </SvgText>
              ) : null,
            )}
            {/* Zones tactiles : toute la bande, pas seulement la colonne */}
            {series.map((p, i) => (
              <Rect
                key={`h${p.date}`}
                x={pad.left + i * band}
                y={pad.top}
                width={band}
                height={plotH}
                fill="transparent"
                onPress={() => setSelected((cur) => (cur === i ? null : i))}
              />
            ))}
          </Svg>
        </View>
      )}
    </View>
  );
}
