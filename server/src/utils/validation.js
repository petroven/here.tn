import Joi from 'joi';

export const registerSchema = Joi.object({
  nom: Joi.string().min(2).max(100).required(),
  prenom: Joi.string().min(2).max(100).required(),
  email: Joi.string().email().required(),
  password: Joi.string().min(6).max(128).required(),
  role: Joi.string().valid('client', 'vendeur').default('client'),
  telephone: Joi.string().pattern(/^(\+216)?[2-9][0-9]{7}$/).optional(),
  // Bloqué côté serveur, pas seulement côté UI : sans acceptation explicite
  // des conditions de vente/retour, aucune inscription n'est créée.
  accepteConditions: Joi.boolean().valid(true).required().messages({
    'any.only': 'Vous devez accepter les conditions de vente et de retour pour créer un compte.',
    'any.required': 'Vous devez accepter les conditions de vente et de retour pour créer un compte.',
  }),
});

export const loginSchema = Joi.object({
  email: Joi.string().email().required(),
  password: Joi.string().required(),
});

export const commandeSchema = Joi.object({
  clientId: Joi.number().integer().optional(),
  boutiqueId: Joi.number().integer().optional(),
  lignes: Joi.array().items(
    Joi.object({
      produitId: Joi.number().integer().required(),
      varianteId: Joi.number().integer().optional(),
      quantite: Joi.number().integer().min(1).required(),
    }),
  ).min(1).required(),
  adresseLivraison: Joi.string().min(5).required(),
  gouvernoratId: Joi.number().integer().required(),
  delegationId: Joi.number().integer().required(),
  methodePaiement: Joi.string().valid('cod', 'konnect', 'flouci', 'carte', 'virement').default('cod'),
  referenceVirement: Joi.string().max(100).optional(),
  couponCode: Joi.string().optional(),
});

export const avisSchema = Joi.object({
  produitId: Joi.number().integer().required(),
  commandeId: Joi.number().integer().required(),
  note: Joi.number().integer().min(1).max(5).required(),
  commentaire: Joi.string().max(1000).optional(),
});

export const couponSchema = Joi.object({
  code: Joi.string().min(3).max(30).required(),
  type: Joi.string().valid('pourcentage', 'montant_fixe').required(),
  valeur: Joi.number().positive().required(),
  dateExpiration: Joi.date().greater('now').required(),
  limiteUtilisation: Joi.number().integer().min(1).default(100),
  montantMinimum: Joi.number().min(0).default(0),
});

export const retourSchema = Joi.object({
  commandeId: Joi.number().integer().required(),
  motif: Joi.string().min(10).max(500).required(),
});

export const messageSchema = Joi.object({
  conversationId: Joi.number().integer().required(),
  contenu: Joi.string().min(1).max(2000).required(),
});

export const resetPasswordSchema = Joi.object({
  email: Joi.string().email().required(),
});

export const newPasswordSchema = Joi.object({
  token: Joi.string().required(),
  password: Joi.string().min(6).max(128).required(),
});

export function validate(schema) {
  return (req, res, next) => {
    const { error, value } = schema.validate(req.body, { abortEarly: false, stripUnknown: true });
    if (error) {
      return res.status(400).json({
        success: false,
        message: error.details.map((d) => d.message).join(', '),
      });
    }
    req.body = value;
    return next();
  };
}
