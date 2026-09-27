import { useEffect, useState } from 'react';

// Mode sombre : le choix du visiteur (clair/sombre) est gardé dans le
// navigateur ; sans choix, le site suit le thème de l'appareil. La classe
// `dark` sur <html> active les couleurs de src/dark.css.
const KEY = 'theme';
const EVENT = 'theme-change';
const media = typeof window !== 'undefined' && window.matchMedia
  ? window.matchMedia('(prefers-color-scheme: dark)')
  : null;

function savedChoice() {
  try {
    const value = localStorage.getItem(KEY);
    return value === 'dark' || value === 'light' ? value : null;
  } catch {
    return null;
  }
}

export function isDarkTheme() {
  const choice = savedChoice();
  if (choice) return choice === 'dark';
  // L'aperçu Claude indique le thème choisi par le lecteur sur <html>.
  const stamped = document.documentElement.dataset.theme;
  if (stamped === 'dark' || stamped === 'light') return stamped === 'dark';
  return Boolean(media?.matches);
}

export function applyTheme() {
  const dark = isDarkTheme();
  document.documentElement.classList.toggle('dark', dark);
  document.documentElement.style.colorScheme = dark ? 'dark' : 'light';
  window.dispatchEvent(new Event(EVENT));
}

export function initTheme() {
  applyTheme();
  media?.addEventListener?.('change', () => { if (!savedChoice()) applyTheme(); });
}

export function useTheme() {
  const [dark, setDark] = useState(isDarkTheme);
  useEffect(() => {
    const sync = () => setDark(isDarkTheme());
    window.addEventListener(EVENT, sync);
    return () => window.removeEventListener(EVENT, sync);
  }, []);

  const toggle = () => {
    try {
      localStorage.setItem(KEY, dark ? 'light' : 'dark');
    } catch {
      // Stockage indisponible : on bascule quand même pour cette visite.
      document.documentElement.dataset.theme = dark ? 'light' : 'dark';
    }
    applyTheme();
  };

  return { dark, toggle };
}
