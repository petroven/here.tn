import { Gouvernorat, Delegation } from '../models/index.js';

export async function getGouvernorats(_req, res) {
  try {
    const gouvernorats = await Gouvernorat.findAll({
      order: [['nom', 'ASC']],
      attributes: ['id', 'nom', 'nomAr', 'code', 'fraisLivraison'],
    });
    res.json({ success: true, data: gouvernorats, count: gouvernorats.length });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
}

export async function getDelegations(req, res) {
  try {
    const { gouvernoratId } = req.params;
    const delegations = await Delegation.findAll({
      where: { gouvernoratId },
      order: [['nom', 'ASC']],
      attributes: ['id', 'nom', 'nomAr', 'gouvernoratId'],
    });
    res.json({ success: true, data: delegations, count: delegations.length });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
}

export async function getFraisLivraison(req, res) {
  try {
    const gouvernorat = await Gouvernorat.findByPk(req.params.gouvernoratId);
    if (!gouvernorat) {
      return res.status(404).json({ success: false, message: 'Gouvernorat introuvable.' });
    }
    res.json({ success: true, data: { fraisLivraison: gouvernorat.fraisLivraison, gouvernorat: gouvernorat.nom } });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
}
