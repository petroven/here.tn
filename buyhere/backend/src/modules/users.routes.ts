import { Router } from 'express';
import multer from 'multer';
import bcrypt from 'bcryptjs';
import { z } from 'zod';
import { prisma } from '../lib/prisma.js';
import { uploadImage } from '../lib/cloudinary.js';
import { requireAuth, currentUser } from '../middleware/auth.js';
import { validate } from '../middleware/validate.js';
import { AppError } from '../utils/AppError.js';
import { GOVERNORATES } from '../utils/governorates.js';
import { Password, TunisianPhone, toUserDto } from '../utils/validators.js';

const router = Router();
router.use(requireAuth);

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => cb(null, /^image\/(jpeg|png|webp|heic)$/.test(file.mimetype)),
});

const UpdateMeBody = z.object({
  firstName: z.string().trim().min(2).max(50).optional(),
  lastName: z.string().trim().min(2).max(50).optional(),
  phone: TunisianPhone.nullable().optional(),
  language: z.enum(['fr', 'ar']).optional(),
});

const ChangePasswordBody = z.object({
  currentPassword: z.string().min(1),
  newPassword: Password,
});

const AddressBody = z.object({
  label: z.string().trim().min(1).max(30).default('Maison'),
  fullName: z.string().trim().min(3).max(100),
  phone: TunisianPhone,
  governorate: z.enum(GOVERNORATES),
  city: z.string().trim().min(2).max(60),
  street: z.string().trim().min(3).max(200),
  postalCode: z.string().trim().regex(/^\d{4}$/, 'Code postal à 4 chiffres').optional(),
  isDefault: z.boolean().default(false),
});

const IdParams = z.object({ id: z.string().min(1) });

// GET /users/me
router.get('/', async (req, res) => {
  const user = await prisma.user.findUnique({ where: { id: currentUser(req).id } });
  if (!user) throw AppError.notFound('Utilisateur introuvable');
  res.json(toUserDto(user));
});

// PATCH /users/me
router.patch('/', validate({ body: UpdateMeBody }), async (req, res) => {
  const user = await prisma.user.update({ where: { id: currentUser(req).id }, data: req.body });
  res.json(toUserDto(user));
});

// POST /users/me/avatar (multipart, champ "avatar")
router.post('/avatar', upload.single('avatar'), async (req, res) => {
  if (!req.file) throw AppError.badRequest('Image requise (jpeg, png, webp)');
  const result = await uploadImage(req.file.buffer, 'avatars');
  const user = await prisma.user.update({
    where: { id: currentUser(req).id },
    data: { avatarUrl: result.secure_url },
  });
  res.json(toUserDto(user));
});

// POST /users/me/password
router.post('/password', validate({ body: ChangePasswordBody }), async (req, res) => {
  const { currentPassword, newPassword } = req.body as z.infer<typeof ChangePasswordBody>;
  const user = await prisma.user.findUniqueOrThrow({ where: { id: currentUser(req).id } });
  if (!(await bcrypt.compare(currentPassword, user.passwordHash))) {
    throw AppError.badRequest('Mot de passe actuel incorrect', 'WRONG_PASSWORD');
  }
  await prisma.user.update({
    where: { id: user.id },
    data: { passwordHash: await bcrypt.hash(newPassword, 12) },
  });
  res.status(204).end();
});

// PUT /users/me/push-token — enregistre le token Expo Notifications de l'appareil.
router.put(
  '/push-token',
  validate({ body: z.object({ token: z.string().max(200).nullable() }) }),
  async (req, res) => {
    await prisma.user.update({
      where: { id: currentUser(req).id },
      data: { pushToken: (req.body as { token: string | null }).token },
    });
    res.status(204).end();
  },
);

// DELETE /users/me — suppression du compte (exigence des stores).
router.delete('/', async (req, res) => {
  const userId = currentUser(req).id;
  // Les commandes sont conservées (obligations comptables) mais anonymisées.
  await prisma.$transaction([
    prisma.user.update({
      where: { id: userId },
      data: {
        email: `deleted-${userId}@buyhere.invalid`,
        phone: null,
        firstName: 'Compte',
        lastName: 'supprimé',
        avatarUrl: null,
        pushToken: null,
        passwordHash: '!',
      },
    }),
    prisma.address.deleteMany({ where: { userId } }),
    prisma.refreshToken.deleteMany({ where: { userId } }),
    prisma.favorite.deleteMany({ where: { userId } }),
  ]);
  res.status(204).end();
});

// ─── Adresses ───

router.get('/addresses', async (req, res) => {
  const addresses = await prisma.address.findMany({
    where: { userId: currentUser(req).id },
    orderBy: [{ isDefault: 'desc' }, { createdAt: 'desc' }],
  });
  res.json(addresses);
});

router.post('/addresses', validate({ body: AddressBody }), async (req, res) => {
  const userId = currentUser(req).id;
  const body = req.body as z.infer<typeof AddressBody>;
  // La première adresse devient automatiquement l'adresse par défaut.
  const count = await prisma.address.count({ where: { userId } });
  const isDefault = body.isDefault || count === 0;

  const address = await prisma.$transaction(async (tx) => {
    if (isDefault) await tx.address.updateMany({ where: { userId }, data: { isDefault: false } });
    return tx.address.create({ data: { ...body, isDefault, userId } });
  });
  res.status(201).json(address);
});

router.patch(
  '/addresses/:id',
  validate({ params: IdParams, body: AddressBody.partial() }),
  async (req, res) => {
    const userId = currentUser(req).id;
    const existing = await prisma.address.findFirst({ where: { id: req.params.id as string, userId } });
    if (!existing) throw AppError.notFound('Adresse introuvable');

    const body = req.body as Partial<z.infer<typeof AddressBody>>;
    const address = await prisma.$transaction(async (tx) => {
      if (body.isDefault) await tx.address.updateMany({ where: { userId }, data: { isDefault: false } });
      return tx.address.update({ where: { id: existing.id }, data: body });
    });
    res.json(address);
  },
);

router.delete('/addresses/:id', validate({ params: IdParams }), async (req, res) => {
  const userId = currentUser(req).id;
  const existing = await prisma.address.findFirst({ where: { id: req.params.id as string, userId } });
  if (!existing) throw AppError.notFound('Adresse introuvable');
  await prisma.address.delete({ where: { id: existing.id } });

  // Si l'adresse par défaut est supprimée, la plus récente prend le relais.
  if (existing.isDefault) {
    const next = await prisma.address.findFirst({ where: { userId }, orderBy: { createdAt: 'desc' } });
    if (next) await prisma.address.update({ where: { id: next.id }, data: { isDefault: true } });
  }
  res.status(204).end();
});

export default router;
