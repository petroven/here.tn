import multer from 'multer';
import { Utilisateur } from '../models/index.js';
import { uploadImage } from '../utils/upload.js';
import express from 'express';
import {
  register,
  login,
  forgotPassword,
  resetPassword,
  getMe,
  updateMe,
  changePassword,
  deleteMe,
} from '../controllers/authController.js';
import {
  validate,
  registerSchema,
  loginSchema,
  resetPasswordSchema,
  newPasswordSchema,
  updateProfileSchema,
  changePasswordSchema,
} from '../utils/validation.js';
import { authMiddleware } from '../middleware/auth.js';

const router = express.Router();

// Register route with validation
router.post('/auth/register', validate(registerSchema), register);

// Login route with validation
router.post('/auth/login', validate(loginSchema), login);

// Forgot password route
router.post('/auth/forgot-password', validate(resetPasswordSchema), forgotPassword);

// Reset password route
router.post('/auth/reset-password', validate(newPasswordSchema), resetPassword);

// Espace client (/compte) — profil de l'utilisateur connecté
router.get('/users/me', authMiddleware, getMe);
router.patch('/users/me', authMiddleware, validate(updateProfileSchema), updateMe);
router.patch('/users/me/password', authMiddleware, validate(changePasswordSchema), changePassword);
router.delete('/users/me', authMiddleware, deleteMe);

// Photo de profil (tous les comptes) : une image, 5 Mo maximum.
const photoUpload = multer({
  dest: 'uploads/temp/',
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => cb(null, /^image\/(jpeg|png|webp)$/.test(file.mimetype)),
});
router.put('/users/me/photo', authMiddleware, (req, res, next) => {
  photoUpload.single('photo')(req, res, (error) => {
    if (error) {
      const message = error.code === 'LIMIT_FILE_SIZE' ? 'Image trop lourde (5 Mo maximum).' : 'Envoi de la photo impossible.';
      return res.status(400).json({ success: false, message });
    }
    return next();
  });
}, async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ success: false, message: 'Aucune image JPEG, PNG ou WebP fournie.' });
    const user = await Utilisateur.findByPk(req.user.id);
    if (!user) return res.status(404).json({ success: false, message: 'Utilisateur introuvable.' });
    const photo = await uploadImage(req.file, 'avatars');
    await user.update({ photo });
    return res.json({ success: true, data: { photo } });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
});

export default router;
