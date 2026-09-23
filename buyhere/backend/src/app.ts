import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import rateLimit from 'express-rate-limit';
import { env, isProd } from './config/env.js';
import { prisma } from './lib/prisma.js';
import { errorHandler, notFoundHandler } from './middleware/error.js';
import authRoutes from './modules/auth.routes.js';
import usersRoutes from './modules/users.routes.js';
import homeRoutes from './modules/home.routes.js';
import categoriesRoutes from './modules/categories.routes.js';
import productsRoutes from './modules/products.routes.js';
import cartRoutes from './modules/cart.routes.js';
import ordersRoutes from './modules/orders.routes.js';
import paymentsRoutes from './modules/payments.routes.js';
import favoritesRoutes from './modules/favorites.routes.js';
import reviewsRoutes from './modules/reviews.routes.js';
import notificationsRoutes from './modules/notifications.routes.js';

export function createApp() {
  const app = express();

  app.set('trust proxy', 1); // derrière un reverse proxy (Render, Railway, Nginx)
  app.use(helmet());
  app.use(
    cors({
      origin: env.CORS_ORIGINS === '*' ? true : env.CORS_ORIGINS.split(',').map((o) => o.trim()),
    }),
  );
  app.use(express.json({ limit: '1mb' }));
  app.use(morgan(isProd ? 'combined' : 'dev'));
  app.use(rateLimit({ windowMs: 60 * 1000, limit: 300, standardHeaders: 'draft-8', legacyHeaders: false }));

  // Santé : utilisé par l'hébergeur et le monitoring.
  app.get('/health', async (_req, res) => {
    await prisma.$queryRaw`SELECT 1`;
    res.json({ status: 'ok', uptime: Math.round(process.uptime()) });
  });

  app.use('/auth', authRoutes);
  app.use('/users/me', usersRoutes);
  app.use('/home', homeRoutes);
  app.use('/categories', categoriesRoutes);
  app.use('/products', productsRoutes);
  app.use('/cart', cartRoutes);
  app.use('/orders', ordersRoutes);
  app.use('/payments', paymentsRoutes);
  app.use('/favorites', favoritesRoutes);
  app.use('/reviews', reviewsRoutes);
  app.use('/notifications', notificationsRoutes);

  app.use(notFoundHandler);
  app.use(errorHandler);
  return app;
}
