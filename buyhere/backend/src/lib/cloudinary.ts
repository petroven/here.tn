import { v2 as cloudinary, type UploadApiResponse } from 'cloudinary';
import { env } from '../config/env.js';
import { AppError } from '../utils/AppError.js';

const configured = !!(env.CLOUDINARY_CLOUD_NAME && env.CLOUDINARY_API_KEY && env.CLOUDINARY_API_SECRET);

if (configured) {
  cloudinary.config({
    cloud_name: env.CLOUDINARY_CLOUD_NAME,
    api_key: env.CLOUDINARY_API_KEY,
    api_secret: env.CLOUDINARY_API_SECRET,
    secure: true,
  });
}

/**
 * Envoie un fichier (buffer en mémoire, via multer) vers Cloudinary.
 * Les images sont redimensionnées côté Cloudinary (max 1200 px, qualité auto).
 */
export function uploadImage(buffer: Buffer, folder: string): Promise<UploadApiResponse> {
  if (!configured) {
    throw new AppError(503, 'UPLOAD_DISABLED', "Cloudinary n'est pas configuré sur le serveur");
  }
  return new Promise((resolve, reject) => {
    const stream = cloudinary.uploader.upload_stream(
      {
        folder: `buyhere/${folder}`,
        resource_type: 'image',
        transformation: [{ width: 1200, height: 1200, crop: 'limit', quality: 'auto', fetch_format: 'auto' }],
      },
      (error, result) => (error || !result ? reject(error ?? new Error('Upload vide')) : resolve(result)),
    );
    stream.end(buffer);
  });
}

export async function deleteImage(publicId: string) {
  if (configured) await cloudinary.uploader.destroy(publicId);
}
