import type { Language } from '@/api/types';

/**
 * Formate un montant en millimes au format tunisien : 49900 => "49,900 DT".
 * Trois décimales (le millime), virgule décimale, espace pour les milliers :
 * 2199000 => "2 199,000 DT". En arabe : "49,900 د.ت".
 */
export function formatPrice(millimes: number, lang: Language = 'fr'): string {
  const negative = millimes < 0;
  const abs = Math.abs(Math.round(millimes));
  const dinars = Math.floor(abs / 1000);
  const rest = String(abs % 1000).padStart(3, '0');
  const grouped = String(dinars).replace(/\B(?=(\d{3})+(?!\d))/g, ' ');
  const currency = lang === 'ar' ? 'د.ت' : 'DT';
  return `${negative ? '-' : ''}${grouped},${rest} ${currency}`;
}

/** Date courte localisée : "23 sept. 2026". */
export function formatDate(iso: string, lang: Language = 'fr'): string {
  return new Date(iso).toLocaleDateString(lang === 'ar' ? 'ar-TN' : 'fr-TN', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
}

/** Date + heure : "23 sept. 2026, 14:05". */
export function formatDateTime(iso: string, lang: Language = 'fr'): string {
  return new Date(iso).toLocaleString(lang === 'ar' ? 'ar-TN' : 'fr-TN', {
    day: 'numeric',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  });
}

/** Temps relatif pour les notifications : "il y a 5 min". */
export function timeAgo(iso: string, lang: Language = 'fr'): string {
  const seconds = Math.round((new Date(iso).getTime() - Date.now()) / 1000);
  const rtf = new Intl.RelativeTimeFormat(lang, { numeric: 'auto' });
  const units: [Intl.RelativeTimeFormatUnit, number][] = [
    ['day', 86400],
    ['hour', 3600],
    ['minute', 60],
  ];
  for (const [unit, size] of units) {
    if (Math.abs(seconds) >= size) return rtf.format(Math.round(seconds / size), unit);
  }
  return rtf.format(0, 'minute');
}

/** Masque un numéro pour l'affichage : +21622123456 => "22 123 456". */
export function formatPhone(phone: string | null | undefined): string {
  if (!phone) return '';
  const digits = phone.replace(/\D/g, '').slice(-8);
  return digits.replace(/(\d{2})(\d{3})(\d{3})/, '$1 $2 $3');
}
