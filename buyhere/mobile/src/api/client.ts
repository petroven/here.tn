import axios, { AxiosError } from 'axios';
import { API_URL } from '@/config';
import { useAuthStore } from '@/store/auth';
import { useSettingsStore } from '@/store/settings';
import type { ApiErrorBody } from './types';

// 60 s : sur l'offre gratuite Render, le serveur en veille met jusqu'à ~50 s à se réveiller.
export const api = axios.create({ baseURL: API_URL, timeout: 60_000 });

/** Erreur normalisée consommée par l'UI (message déjà rédigé par l'API). */
export class ApiError extends Error {
  constructor(
    public code: string,
    message: string,
    public status?: number,
    public details?: unknown,
  ) {
    super(message);
  }
}

// Ajoute le jeton et la langue à chaque requête.
api.interceptors.request.use((config) => {
  // Un jeton passé explicitement (connexion / inscription en cours) n'est jamais remplacé.
  const token = useAuthStore.getState().accessToken;
  if (token && !config.headers.Authorization) config.headers.Authorization = `Bearer ${token}`;
  config.headers['Accept-Language'] = useSettingsStore.getState().language;
  return config;
});

/**
 * L'API web répond { success: false, message } en cas d'erreur.
 * Un 401 sur une requête authentifiée signifie que le JWT (7 jours) a expiré :
 * la session locale est fermée, l'utilisateur devra se reconnecter.
 */
api.interceptors.response.use(
  (res) => res,
  async (error: AxiosError<ApiErrorBody>) => {
    const status = error.response?.status;
    const sentToken = !!error.config?.headers?.Authorization;

    if (status === 401 && sentToken) {
      await useAuthStore.getState().clearSession();
      throw new ApiError('UNAUTHORIZED', error.response?.data?.message ?? 'Session expirée.', status);
    }
    if (error.response?.data?.message) {
      throw new ApiError(status === 400 ? 'VALIDATION_ERROR' : 'API_ERROR', error.response.data.message, status);
    }
    if (error.code === 'ECONNABORTED' || !error.response) {
      throw new ApiError('NETWORK', 'network');
    }
    throw new ApiError('UNKNOWN', error.message, status);
  },
);

/** Message d'erreur à afficher, sinon le message de repli (erreur réseau). */
export function errorMessage(err: unknown, fallback: string): string {
  if (err instanceof ApiError) {
    if (err.code === 'NETWORK') return fallback;
    return err.message;
  }
  return fallback;
}
