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

// Supprime une image envoyée par uploadImage, quel que soit son stockage
// (déduit de l'URL, pas de la configuration courante : une photo stockée en
// base reste supprimable après l'activation de Cloudinary). Les URL externes
// ou inconnues sont ignorées. Renvoie true si une image a été supprimée ; un
// échec est journalisé, jamais présenté comme un succès.
export async function deleteImage(imageUrl) {
  if (!imageUrl || typeof imageUrl !== 'string') return false;

  const dbMatch = imageUrl.match(/^\/uploads\/db\/(\d+)$/);
  if (dbMatch) {
    const { Fichier } = await import('../models/index.js');
    return (await Fichier.destroy({ where: { id: Number(dbMatch[1]) } })) > 0;
  }

  const localMatch = imageUrl.match(/^\/uploads\/([^/\\]+)$/);
  if (localMatch) {
    const filePath = path.join(localUploadDir, localMatch[1]);
    if (path.dirname(filePath) !== localUploadDir) return false;
    try {
      fs.unlinkSync(filePath);
      return true;
    } catch (error) {
      if (error.code !== 'ENOENT') console.error('[UPLOAD] Suppression locale impossible:', imageUrl, error.message);
      return false;
    }
  }

  if (useCloudinary && /^https:\/\/res\.cloudinary\.com\//.test(imageUrl)) {
    const publicId = imageUrl.split('/').slice(-2).join('/').replace(/\.[^.]+$/, '');
    try {
      const result = await cloudinary.uploader.destroy(publicId);
      return result?.result === 'ok';
    } catch (error) {
      console.error('[UPLOAD] Suppression Cloudinary impossible:', imageUrl, error.message);
      return false;
    }
  }

  return false;
}

// Images envoyées par uploadImage (les URL externes, ex. photos de démo ou
// avatars Google, ne nous appartiennent pas).
const IMAGE_GEREE = /^(\/uploads\/(db\/\d+|[^/\\]+)|https:\/\/res\.cloudinary\.com\/.+)$/;

// Une même URL peut figurer dans plusieurs champs (Produit.image reprend
// images[0], une variante réutilise la photo du produit…) : une image n'est
// supprimée que lorsqu'aucun de ces champs ne la référence plus.
async function imageEncoreReferencee(url) {
  const { Op } = await import('sequelize');
  const models = await import('../models/index.js');
  const { default: sequelize } = await import('../config/database.js');
  const egal = [
    [models.Utilisateur, 'photo'], [models.Boutique, 'logo'], [models.Boutique, 'banniere'], [models.Categorie, 'image'],
    [models.Produit, 'image'], [models.Variante, 'image'], [models.Livraison, 'preuveLivraison'],
  ];
  for (const [model, champ] of egal) {
    if (await model.count({ where: { [champ]: url } })) return true;
  }
  // Champs JSON (tableaux d'URL) : recherche de la chaîne JSON exacte, guillemets compris.
  const listes = [[models.Produit, 'images'], [models.Retour, 'photos']];
  for (const [model, champ] of listes) {
    const where = sequelize.where(sequelize.cast(sequelize.col(champ), 'TEXT'), { [Op.like]: `%${JSON.stringify(url)}%` });
    if (await model.count({ where })) return true;
  }
  return false;
}

// À appeler APRÈS l'enregistrement du changement (remplacement ou
// suppression) avec les anciennes URL. Ne lève jamais : un échec de nettoyage
// ne doit pas faire échouer la requête, il est journalisé.
export async function supprimerImagesSiOrphelines(urls) {
  const candidates = [...new Set((urls || []).filter((u) => typeof u === 'string' && IMAGE_GEREE.test(u)))];
  let supprimees = 0;
  for (const url of candidates) {
    try {
      if (await imageEncoreReferencee(url)) continue;
      if (await deleteImage(url)) supprimees += 1;
    } catch (error) {
      console.error('[UPLOAD] Nettoyage de l\'image impossible:', url, error.message);
    }
  }
  return supprimees;
}

export function getStorageProvider() {
  if (useCloudinary) return 'cloudinary';
  return useDatabase ? 'database' : 'local';
}
