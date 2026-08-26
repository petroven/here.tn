import { Server } from 'socket.io';
import jwt from 'jsonwebtoken';
import { Livreur } from '../models/index.js';
import { corsOptions } from '../config/cors.js';

const JWT_SECRET = process.env.JWT_SECRET || 'dev_marketplace_secret';

let ioInstance = null;

export function initIo(httpServer) {
  ioInstance = new Server(httpServer, {
    cors: corsOptions,
  });

  ioInstance.use((socket, next) => {
    try {
      const token = socket.handshake.auth?.token;
      if (!token) throw new Error('Token manquant.');
      socket.user = jwt.verify(token, JWT_SECRET);
      next();
    } catch (error) {
      next(new Error('unauthorized'));
    }
  });

  ioInstance.on('connection', async (socket) => {
    if (socket.user.role === 'livreur') {
      try {
        const profil = await Livreur.findOne({ where: { utilisateurId: socket.user.id } });
        if (profil) socket.join(`livreur:${profil.id}`);
      } catch (error) {
        console.error('[SOCKET] Erreur lors de la connexion livreur:', error);
      }
    }
  });

  return ioInstance;
}

export function getIo() {
  if (!ioInstance) throw new Error('Socket.io n\'est pas initialisé.');
  return ioInstance;
}
