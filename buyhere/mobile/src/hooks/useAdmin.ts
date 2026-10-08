import { useInfiniteQuery, useQuery, useQueryClient } from '@tanstack/react-query';
import { ADMIN_ROLES, adminApi } from '@/api/admin';
import { useAuthStore } from '@/store/auth';

/** Le compte connecté est-il administrateur (ou super admin) ? */
export const useIsAdmin = () => useAuthStore((s) => !!s.user && ADMIN_ROLES.includes(s.user.role));

export const adminKeys = {
  all: ['admin'] as const,
  stats: ['admin', 'stats'] as const,
  stores: ['admin', 'stores'] as const,
  withdrawals: ['admin', 'withdrawals'] as const,
  transfers: ['admin', 'transfers'] as const,
  reviews: ['admin', 'reviews'] as const,
  orders: ['admin', 'orders'] as const,
  orderHistory: (id: string) => ['admin', 'orders', id, 'history'] as const,
  products: (lowStock: boolean) => ['admin', 'products', lowStock] as const,
  users: ['admin', 'users'] as const,
  audit: ['admin', 'audit'] as const,
  categories: ['admin', 'categories'] as const,
};

function useAdminQuery<T>(queryKey: readonly unknown[], queryFn: () => Promise<T>) {
  const isAdmin = useIsAdmin();
  return useQuery({ queryKey, queryFn, enabled: isAdmin });
}

export const useAdminStats = () => useAdminQuery(adminKeys.stats, adminApi.stats);
export const useAdminStores = () => useAdminQuery(adminKeys.stores, adminApi.stores);
export const useAdminWithdrawals = () => useAdminQuery(adminKeys.withdrawals, adminApi.withdrawals);
export const useAdminTransfers = () => useAdminQuery(adminKeys.transfers, adminApi.transfers);
export const useAdminReviews = () => useAdminQuery(adminKeys.reviews, adminApi.reviews);
export const useAdminOrders = () => useAdminQuery(adminKeys.orders, adminApi.orders);
export const useAdminUsers = () => useAdminQuery(adminKeys.users, adminApi.users);
export const useAdminCategories = () => useAdminQuery(adminKeys.categories, adminApi.categories);
export const useAdminProducts = (lowStock: boolean) =>
  useAdminQuery(adminKeys.products(lowStock), () => adminApi.products(lowStock));
export const useAdminOrderHistory = (id: string) =>
  useAdminQuery(adminKeys.orderHistory(id), () => adminApi.orderHistory(id));

/** Journal d'audit, paginé (30 par page), du plus récent au plus ancien. */
export function useAdminAudit() {
  const isAdmin = useIsAdmin();
  return useInfiniteQuery({
    queryKey: adminKeys.audit,
    queryFn: ({ pageParam }) => adminApi.auditLogs(pageParam),
    initialPageParam: 1,
    getNextPageParam: (last, pages) => (pages.length * last.limit < last.total ? pages.length + 1 : undefined),
    enabled: isAdmin,
  });
}

/** Après une action admin : tout l'espace admin est relu (+ retours, catalogue public). */
export function useRefreshAdmin() {
  const qc = useQueryClient();
  return () => {
    qc.invalidateQueries({ queryKey: adminKeys.all });
    qc.invalidateQueries({ queryKey: ['returns'] });
  };
}
