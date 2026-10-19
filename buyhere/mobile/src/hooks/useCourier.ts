import { useEffect, useState } from 'react';
import { AppState } from 'react-native';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { create } from 'zustand';
import { courierApi, type CourierCourses } from '@/api/courier';
import { useAuthStore } from '@/store/auth';

/** Le compte connecté est-il un livreur ? */
export const useIsCourier = () => useAuthStore((s) => s.user?.role === 'livreur');

export const courierKeys = {
  all: ['courier'] as const,
  courses: ['courier', 'courses'] as const,
  stats: ['courier', 'stats'] as const,
  history: ['courier', 'history'] as const,
  offer: ['courier', 'offer'] as const,
};

/** L'app est-elle au premier plan ? (les sondages s'arrêtent en arrière-plan) */
export function useAppActive() {
  const [active, setActive] = useState(AppState.currentState === 'active');
  useEffect(() => {
    const sub = AppState.addEventListener('change', (state) => setActive(state === 'active'));
    return () => sub.remove();
  }, []);
  return active;
}

export function useCourierStats() {
  const isCourier = useIsCourier();
  return useQuery({ queryKey: courierKeys.stats, queryFn: courierApi.stats, enabled: isCourier });
}

/** Courses disponibles et en cours, relues toutes les 15 s comme sur le site. */
export function useCourierCourses() {
  const isCourier = useIsCourier();
  const active = useAppActive();
  return useQuery({
    queryKey: courierKeys.courses,
    queryFn: courierApi.courses,
    enabled: isCourier,
    refetchInterval: active ? 15_000 : false,
  });
}

export function useCourierHistory() {
  const isCourier = useIsCourier();
  return useQuery({ queryKey: courierKeys.history, queryFn: courierApi.history, enabled: isCourier });
}

/** Après une action livreur : courses, statistiques et historique sont relus. */
export function useRefreshCourier() {
  const qc = useQueryClient();
  return () => qc.invalidateQueries({ queryKey: courierKeys.all });
}

/** Course acceptée : passe tout de suite dans « en cours » en attendant la relecture. */
export function useMarkAccepted() {
  const qc = useQueryClient();
  return (courseId: string) =>
    qc.setQueryData<CourierCourses>(courierKeys.courses, (old) => {
      const course = old?.available.find((c) => c.id === courseId);
      if (!old || !course) return old;
      return {
        available: old.available.filter((c) => c.id !== courseId),
        active: [...old.active, { ...course, status: 'assignee' }],
      };
    });
}

/** État du suivi GPS, partagé entre le service de fond et l'écran livreur. */
type CourierLocationState = {
  permission: 'unknown' | 'granted' | 'denied';
  lastSentAt: number | null;
  /** Dernière position connue du téléphone (carte du livreur, en direct). */
  coords: { latitude: number; longitude: number } | null;
};
export const useCourierLocation = create<
  CourierLocationState & { set: (patch: Partial<CourierLocationState>) => void }
>((set) => ({
  permission: 'unknown',
  lastSentAt: null,
  coords: null,
  set: (patch) => set(patch),
}));
