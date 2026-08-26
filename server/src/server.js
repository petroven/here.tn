import express from 'express';
import http from 'http';
import cors from 'cors';
import helmet from 'helmet';
import dotenv from 'dotenv';
import rateLimit from 'express-rate-limit';
import path from 'path';
import './models/index.js';
import { syncDatabase } from './config/database.js';
import { initIo } from './realtime/io.js';
import { corsOptions } from './config/cors.js';
import healthRoutes from './routes/healthRoutes.js';
import marketRoutes from './routes/marketRoutes.js';
import authRoutes from './routes/authRoutes.js';
import vendorRoutes from './routes/vendorRoutes.js';
import adminRoutes from './routes/adminRoutes.js';
import deliveryRoutes from './routes/deliveryRoutes.js';
import livreurRoutes from './routes/livreurRoutes.js';
import uploadRoutes from './routes/uploadRoutes.js';
import chatRoutes from './routes/chatRoutes.js';
import retourRoutes from './routes/retourRoutes.js';
import paymentRoutes from './routes/paymentRoutes.js';
import walletRoutes from './routes/walletRoutes.js';
import oauthRoutes from './routes/oauthRoutes.js';
import passport from './config/passport.js';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 5000;

// crossOriginResourcePolicy relaxed: the client (a different origin/port)
// loads uploaded product images directly via <img src> — Helmet's default
// same-origin policy would otherwise block that.
app.use(helmet({ crossOriginResourcePolicy: { policy: 'cross-origin' } }));
app.use(cors(corsOptions));
// Capture the raw request body alongside the parsed JSON — payment webhook
// signatures are computed over the exact bytes, not the re-serialized object.
app.use(express.json({
  verify: (req, _res, buf) => {
    req.rawBody = buf;
  },
}));
app.use(passport.initialize());

// Serve uploads static folder
app.use('/uploads', express.static(path.resolve('uploads')));

// Rate limiting for auth routes
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 mins
  max: 100, // max 100 requests per IP
  message: { success: false, message: 'Trop de requêtes depuis cette IP, réessayez après 15 minutes.' },
  standardHeaders: true,
  legacyHeaders: false,
});

app.use('/api/auth', authLimiter);

// Rate limiting for payment routes — blunt protection against brute-forcing
// idempotency keys / spamming payment initiation or webhook endpoints.
const paymentLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 60,
  message: { success: false, message: 'Trop de requêtes de paiement depuis cette IP, réessayez plus tard.' },
  standardHeaders: true,
  legacyHeaders: false,
});

app.use('/api/payments', paymentLimiter);

// Register routes
app.use('/api', healthRoutes);
app.use('/api', marketRoutes);
app.use('/api', authRoutes);
app.use('/api', vendorRoutes);
app.use('/api', adminRoutes);
app.use('/api', deliveryRoutes);
app.use('/api', livreurRoutes);
app.use('/api', uploadRoutes);
app.use('/api', chatRoutes);
app.use('/api', retourRoutes);
app.use('/api', paymentRoutes);
app.use('/api', walletRoutes);
app.use('/api', oauthRoutes);

app.use((error, _req, res, _next) => {
  console.error('[SERVER] Error:', error);
  res.status(500).json({ success: false, message: 'Erreur interne du serveur.' });
});

const startServer = async () => {
  try {
    console.log('[SERVER] Syncing database...');
    await syncDatabase();
    console.log('[SERVER] Database synced successfully.');

    const httpServer = http.createServer(app);
    initIo(httpServer);

    httpServer.listen(PORT, () => {
      console.log(`[SERVER] Marketplace API listening on http://localhost:${PORT}`);
    });
  } catch (error) {
    console.error('[SERVER] Unable to start marketplace server:', error);
    process.exit(1);
  }
};

startServer();
