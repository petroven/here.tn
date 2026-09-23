import express from 'express';
import {
  register,
  login,
  forgotPassword,
  resetPassword,
  getMe,
  updateMe,
  changePassword,
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

export default router;
