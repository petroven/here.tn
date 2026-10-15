import express from 'express';
import sequelize from '../config/database.js';

const router = express.Router();

const DB_TIMEOUT_MS = 3000;

// Health check utilisé par Render (healthCheckPath) : vérifie réellement la
// base, sinon un service sans base serait considéré comme sain. Public : ne
// renvoie que des états, jamais de configuration ni de message d'erreur brut.
router.get('/health', async (_req, res) => {
  let database = 'ok';
  try {
    await Promise.race([
      sequelize.query('SELECT 1'),
      new Promise((_, reject) => setTimeout(() => reject(new Error('timeout')), DB_TIMEOUT_MS).unref()),
    ]);
  } catch (error) {
    database = 'error';
    console.error('[HEALTH] Base de données injoignable:', error.message);
  }
  const ok = database === 'ok';
  res.status(ok ? 200 : 503).json({
    status: ok ? 'ok' : 'degraded',
    service: 'marketplace-api',
    database,
    uptimeSeconds: Math.round(process.uptime()),
  });
});

export default router;
