import { Avis, Boutique, Commande, Produit, Utilisateur } from '../models/index.js';

function isValidNote(note) {
  const n = Number(note);
  return Number.isInteger(n) && n >= 1 && n <= 5;
}

export async function getAvisByProduit(req, res) {
  try {
    const avis = await Avis.findAll({
      where: { produitId: req.params.produitId, valide: true, type: 'produit' },
      include: [{ model: Utilisateur, as: 'auteur', attributes: ['id', 'prenom', 'nom'] }],
      order: [['createdAt', 'DESC']],
    });
    res.json({ success: true, data: avis, count: avis.length });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
}

export async function createAvis(req, res) {
  try {
    const { produitId, commandeId, note, commentaire } = req.body;
    if (!produitId || !commandeId) {
      return res.status(400).json({ success: false, message: 'produitId et commandeId requis.' });
    }
    if (!isValidNote(note)) {
      return res.status(400).json({ success: false, message: 'La note doit être un entier entre 1 et 5.' });
    }

    const commande = await Commande.findOne({
      where: { id: commandeId, clientId: req.user.id, statut: 'livree' },
    });
    if (!commande) {
      return res.status(403).json({
        success: false,
        message: 'Vous ne pouvez laisser un avis que sur un produit acheté et livré.',
      });
    }

    const existing = await Avis.findOne({
      where: { auteurId: req.user.id, produitId, commandeId, type: 'produit' },
    });
    if (existing) {
      return res.status(409).json({ success: false, message: 'Vous avez déjà laissé un avis pour cette commande.' });
    }

    const avis = await Avis.create({
      type: 'produit', produitId, commandeId, auteurId: req.user.id, note, commentaire, verifie: true, valide: true,
    });

    res.status(201).json({ success: true, data: avis, message: 'Avis publié avec succès.' });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
}

// Notation double sens: le vendeur note le client sur une commande livrée.
export async function createAvisClient(req, res) {
  try {
    const { commandeId, note, commentaire } = req.body;
    if (!commandeId) {
      return res.status(400).json({ success: false, message: 'commandeId requis.' });
    }
    if (!isValidNote(note)) {
      return res.status(400).json({ success: false, message: 'La note doit être un entier entre 1 et 5.' });
    }

    const commande = await Commande.findOne({
      where: { id: commandeId, statut: 'livree' },
      include: [{ model: Boutique, as: 'boutique' }],
    });
    if (!commande) {
      return res.status(403).json({ success: false, message: 'Vous ne pouvez noter un client que pour une commande livrée.' });
    }

    const isOwner = commande.boutique
      && (Number(commande.boutique.vendeurId) === Number(req.user.id) || ['administrateur', 'super_admin'].includes(req.user.role));
    if (!isOwner) {
      return res.status(403).json({ success: false, message: 'Cette commande n\'appartient pas à votre boutique.' });
    }

    const existing = await Avis.findOne({
      where: { auteurId: req.user.id, commandeId, type: 'client' },
    });
    if (existing) {
      return res.status(409).json({ success: false, message: 'Vous avez déjà noté ce client pour cette commande.' });
    }

    const avis = await Avis.create({
      type: 'client', commandeId, auteurId: req.user.id, cibleId: commande.clientId, note, commentaire, verifie: true, valide: true,
    });

    res.status(201).json({ success: true, data: avis, message: 'Évaluation client publiée.' });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
}

export async function getReputationClient(req, res) {
  try {
    const { clientId } = req.params;
    const avis = await Avis.findAll({ where: { cibleId: clientId, type: 'client', valide: true } });
    const count = avis.length;
    const moyenne = count > 0 ? avis.reduce((sum, a) => sum + a.note, 0) / count : null;
    res.json({ success: true, data: { clientId: Number(clientId), moyenne, count } });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
}

export async function moderateAvis(req, res) {
  try {
    const avis = await Avis.findByPk(req.params.id);
    if (!avis) return res.status(404).json({ success: false, message: 'Avis introuvable.' });
    await avis.update({ valide: req.body.valide ?? !avis.valide });
    res.json({ success: true, data: avis });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
}
