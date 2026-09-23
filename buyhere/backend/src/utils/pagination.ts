import { z } from 'zod';

export const PaginationQuery = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(50).default(20),
});

export type Pagination = z.infer<typeof PaginationQuery>;

/** Enveloppe standard des listes paginées (consommée par le scroll infini). */
export function paginated<T>(items: T[], total: number, { page, limit }: Pagination) {
  return {
    items,
    page,
    limit,
    total,
    hasMore: page * limit < total,
  };
}
