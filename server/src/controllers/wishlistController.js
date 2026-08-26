import { Wishlist, Produit, Boutique, Categorie } from '../models/index.js';

export async function getWishlist(req, res) {
  try {
    const items = await Wishlist.findAll({
      where: { utilisateurId: req.user.id },
      include: [{
        model: Produit,
        as: 'produit',
        include: [
          { model: Boutique, as: 'boutique', attributes: ['id', 'nom'] },
          { model: Categorie, as: 'categorie', attributes: ['id', 'nom'] },
        ],
      }],
      order: [['createdAt', 'DESC']],
    });
    res.json({ success: true, data: items, count: items.length });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
}

export async function addToWishlist(req, res) {
  try {
    const { produitId } = req.body;
    const produit = await Produit.findByPk(produitId);
    if (!produit) return res.status(404).json({ success: false, message: 'Produit introuvable.' });

    const [item, created] = await Wishlist.findOrCreate({
      where: { utilisateurId: req.user.id, produitId },
    });

    res.status(created ? 201 : 200).json({
      success: true,
      message: created ? 'Ajouté à la wishlist.' : 'Déjà dans la wishlist.',
      data: item,
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
}

export async function removeFromWishlist(req, res) {
  try {
    const deleted = await Wishlist.destroy({
      where: { utilisateurId: req.user.id, produitId: req.params.produitId },
    });
    if (!deleted) return res.status(404).json({ success: false, message: 'Élément introuvable.' });
    res.json({ success: true, message: 'Retiré de la wishlist.' });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
}

export async function checkWishlist(req, res) {
  try {
    const ids = req.query.ids?.split(',').map(Number).filter(Boolean) || [];
    const items = await Wishlist.findAll({
      where: { utilisateurId: req.user.id, produitId: ids },
      attributes: ['produitId'],
    });
    res.json({ success: true, data: items.map((i) => i.produitId) });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
}
