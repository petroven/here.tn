import { useQuery, useQueryClient } from '@tanstack/react-query';
import { sellerApi, type StockFilter } from '@/api/vendor';
import { useAuthStore } from '@/store/auth';

export const SELLER_ROLES = ['vendeur', 'admin_boutique'];

/** Le compte connecté gère-t-il une boutique ? */
export const useIsSeller = () => useAuthStore((s) => !!s.user && SELLER_ROLES.includes(s.user.role));

export const sellerKeys = {
  all: ['seller'] as const,
  dashboard: ['seller', 'dashboard'] as const,
  stats: (days: 7 | 30) => ['seller', 'stats', days] as const,
  products: (filter: StockFilter) => ['seller', 'products', filter] as const,
  history: (orderId: string) => ['seller', 'history', orderId] as const,
};

export function useSellerDashboard() {
  const isSeller = useIsSeller();
  return useQuery({ queryKey: sellerKeys.dashboard, queryFn: sellerApi.dashboard, enabled: isSeller });
}

export function useSellerStats(days: 7 | 30) {
  const isSeller = useIsSeller();
  return useQuery({ queryKey: sellerKeys.stats(days), queryFn: () => sellerApi.stats(days), enabled: isSeller });
}

export function useSellerProducts(filter: StockFilter) {
  const isSeller = useIsSeller();
  return useQuery({
    queryKey: sellerKeys.products(filter),
    queryFn: () => sellerApi.products(filter),
    enabled: isSeller,
  });
}

/** Après une action vendeur : tableau de bord, stats, produits et retours sont relus. */
export function useRefreshSeller() {
  const qc = useQueryClient();
  return () => {
    qc.invalidateQueries({ queryKey: sellerKeys.all });
    qc.invalidateQueries({ queryKey: ['returns'] });
  };
}
