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
  return useCloudinary ? 'cloudinary' : 'local';
}
