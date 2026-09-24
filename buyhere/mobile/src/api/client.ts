import axios, { AxiosError, type InternalAxiosRequestConfig } from 'axios';
import { API_URL } from '@/config';
import { useAuthStore } from '@/store/auth';
import { useSettingsStore } from '@/store/settings';
import type { ApiErrorBody, AuthResponse } from './types';

// 60 s : sur l'offre gratuite Render, le serveur en veille met jusqu'à ~50 s à se réveiller.
export const api = axios.create({ baseURL: API_URL, timeout: 60_000 });

/** Erreur normalisée consommée par l'UI (message déjà traduit par l'API). */
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
  const token = useAuthStore.getState().accessToken;
  if (token) config.headers.Authorization = `Bearer ${token}`;
  config.headers['Accept-Language'] = useSettingsStore.getState().language;
  return config;
});

/**
 * Refresh unique partagé : si plusieurs requêtes reçoivent TOKEN_EXPIRED en
 * même temps, un seul appel /auth/refresh est effectué et toutes attendent.
 */
let refreshing: Promise<string | null> | null = null;

async function refreshAccessToken(): Promise<string | null> {
  const { refreshToken, setSession, clearSession } = useAuthStore.getState();
  if (!refreshToken) return null;
  try {
    const { data } = await axios.post<AuthResponse>(`${API_URL}/auth/refresh`, { refreshToken });
    await setSession(data);
    return data.accessToken;
  } catch {
    await clearSession();
    return null;
  }
}

type RetriableConfig = InternalAxiosRequestConfig & { _retried?: boolean };

api.interceptors.response.use(
  (res) => res,
  async (error: AxiosError<ApiErrorBody>) => {
    const original = error.config as RetriableConfig | undefined;
    const code = error.response?.data?.error?.code;

    if (error.response?.status === 401 && code === 'TOKEN_EXPIRED' && original && !original._retried) {
      original._retried = true;
      refreshing ??= refreshAccessToken().finally(() => (refreshing = null));
      const token = await refreshing;
      if (token) {
        original.headers.Authorization = `Bearer ${token}`;
        return api(original);
      }
    }

    if (error.response?.data?.error) {
      const e = error.response.data.error;
      throw new ApiError(e.code, e.message, error.response.status, e.details);
    }
    if (error.code === 'ECONNABORTED' || !error.response) {
      throw new ApiError('NETWORK', 'network');
    }
    throw new ApiError('UNKNOWN', error.message, error.response.status);
  },
);

/** Premier message de validation Zod, sinon le message global. */
export function errorMessage(err: unknown, fallback: string): string {
  if (err instanceof ApiError) {
    if (err.code === 'NETWORK') return fallback;
    const details = err.details as { message?: string }[] | undefined;
    if (err.code === 'VALIDATION_ERROR' && Array.isArray(details) && details[0]?.message) {
      return details[0].message;
    }
    return err.message;
  }
  return fallback;
}
