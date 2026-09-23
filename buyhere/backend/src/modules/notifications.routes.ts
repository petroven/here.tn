import { Router } from 'express';
import { prisma } from '../lib/prisma.js';
import { requireAuth, currentUser } from '../middleware/auth.js';
import { validate, getQuery } from '../middleware/validate.js';
import { PaginationQuery, paginated, type Pagination } from '../utils/pagination.js';

const router = Router();
router.use(requireAuth);

// GET /notifications — paginées, plus récentes d'abord, avec le nombre de non lues.
router.get('/', validate({ query: PaginationQuery }), async (req, res) => {
  const pg = getQuery<Pagination>(res);
  const userId = currentUser(req).id;
  const [rows, total, unread] = await prisma.$transaction([
    prisma.notification.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      skip: (pg.page - 1) * pg.limit,
      take: pg.limit,
    }),
    prisma.notification.count({ where: { userId } }),
    prisma.notification.count({ where: { userId, readAt: null } }),
  ]);
  res.json({ ...paginated(rows, total, pg), unread });
});

// GET /notifications/unread-count — badge de l'icône cloche.
router.get('/unread-count', async (req, res) => {
  const unread = await prisma.notification.count({ where: { userId: currentUser(req).id, readAt: null } });
  res.json({ unread });
});

// POST /notifications/read-all
router.post('/read-all', async (req, res) => {
  await prisma.notification.updateMany({
    where: { userId: currentUser(req).id, readAt: null },
    data: { readAt: new Date() },
  });
  res.status(204).end();
});

// POST /notifications/:id/read
router.post('/:id/read', async (req, res) => {
  await prisma.notification.updateMany({
    where: { id: req.params.id as string, userId: currentUser(req).id, readAt: null },
    data: { readAt: new Date() },
  });
  res.status(204).end();
});

export default router;
