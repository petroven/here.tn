import express from 'express';
import {
  register,
  login,
  forgotPassword,
  resetPassword,
} from '../controllers/authController.js';
import {
  validate,
  registerSchema,
  loginSchema,
  resetPasswordSchema,
  newPasswordSchema,
} from '../utils/validation.js';

const router = express.Router();

// Register route with validation
router.post('/auth/register', validate(registerSchema), register);

// Login route with validation
router.post('/auth/login', validate(loginSchema), login);

// Forgot password route
router.post('/auth/forgot-password', validate(resetPasswordSchema), forgotPassword);

// Reset password route
router.post('/auth/reset-password', validate(newPasswordSchema), resetPassword);

export default router;
