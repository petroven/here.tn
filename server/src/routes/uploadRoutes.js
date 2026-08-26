import express from 'express';
import multer from 'multer';
import { uploadImage } from '../utils/upload.js';
import { authMiddleware, requireRole } from '../middleware/auth.js';

const router = express.Router();

// Configure multer temporary storage
const upload = multer({ dest: 'uploads/temp/' });

// Upload image endpoint
router.post('/upload', authMiddleware, requireRole('vendeur', 'admin_boutique', 'administrateur', 'super_admin'), upload.single('image'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ success: false, message: 'Aucun fichier fourni.' });
    }

    const url = await uploadImage(req.file);
    return res.status(201).json({
      success: true,
      message: 'Fichier téléversé avec succès.',
      url,
    });
  } catch (error) {
    console.error('[UPLOAD] Erreur:', error);
    return res.status(500).json({ success: false, message: error.message });
  }
});

export default router;
