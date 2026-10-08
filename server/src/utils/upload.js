import { v2 as cloudinary } from 'cloudinary';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const useCloudinary = Boolean(
  process.env.CLOUDINARY_CLOUD_NAME &&
  process.env.CLOUDINARY_API_KEY &&
  process.env.CLOUDINARY_API_SECRET,
);

if (useCloudinary) {
  cloudinary.config({
    cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
    api_key: process.env.CLOUDINARY_API_KEY,
    api_secret: process.env.CLOUDINARY_API_SECRET,
  });
}

// Sans Cloudinary : en production, les photos vont en base (le disque de
// l'hébergeur est effacé à chaque redéploiement) ; en développement, sur le
// disque (server/uploads/). UPLOAD_STORAGE=db|local force l'un ou l'autre.
const useDatabase = !useCloudinary && (
  process.env.UPLOAD_STORAGE === 'db'
  || (process.env.UPLOAD_STORAGE !== 'local' && process.env.NODE_ENV === 'production')
);
const MAX_DB_BYTES = 8 * 1024 * 1024;

const MIME_PAR_EXTENSION = {
  '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.png': 'image/png', '.webp': 'image/webp',
  '.gif': 'image/gif', '.heic': 'image/heic', '.heif': 'image/heif', '.avif': 'image/avif',
};

const localUploadDir = path.resolve(__dirname, '../../uploads');
fs.mkdirSync(localUploadDir, { recursive: true });

export async function uploadImage(file, folder = 'heretn') {
  if (!file) return null;

  if (useCloudinary) {
    const result = await cloudinary.uploader.upload(file.path || file, {
      folder,
      resource_type: 'image',
    });
    if (file.path) fs.unlinkSync(file.path);
    return result.secure_url;
  }

  if (useDatabase && file.path) {
    const data = fs.readFileSync(file.path);
    fs.unlinkSync(file.path);
    if (data.length > MAX_DB_BYTES) throw new Error('Image trop lourde (8 Mo maximum).');
    const nom = path.basename(file.originalname || file.path);
    const mime = file.mimetype || MIME_PAR_EXTENSION[path.extname(nom).toLowerCase()] || 'application/octet-stream';
    if (!mime.startsWith('image/')) throw new Error('Seules les images sont acceptées.');
    // Import différé : models/index.js importe la base, qui importe le seed…
    const { Fichier } = await import('../models/index.js');
    const fichier = await Fichier.create({ nom, mime, taille: data.length, data });
    return `/uploads/db/${fichier.id}`;
  }

  if (file.path) {
    const filename = `${Date.now()}-${path.basename(file.originalname || file.path)}`;
    const dest = path.join(localUploadDir, filename);
    fs.renameSync(file.path, dest);
    return `/uploads/${filename}`;
  }

  return file;
}

export async function deleteImage(imageUrl) {
  if (!imageUrl || !useCloudinary) return;
  const publicId = imageUrl.split('/').slice(-2).join('/').replace(/\.[^.]+$/, '');
  try {
    await cloudinary.uploader.destroy(publicId);
  } catch {
    // ignore deletion errors
  }
}

export function getStorageProvider() {
  if (useCloudinary) return 'cloudinary';
  return useDatabase ? 'database' : 'local';
}
