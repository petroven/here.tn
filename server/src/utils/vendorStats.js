import { Op } from 'sequelize';
import { Commande, LigneCommande, Retour } from '../models/index.js';
import { calculerFinancesBoutique } from './finance.js';
import { compterProduitsStockFaible } from './stock.js';
import { marketplaceConfig } from '../config/marketplace.js';

// Les journées sont découpées à l'heure de Tunis, pas à celle du serveur
// (Render/Railway tournent en UTC : une commande passée à 00h30 à Tunis
// tomberait sinon dans la journée précédente).
const FUSEAU = 'Africa/Tunis';
const formatJour = new Intl.DateTimeFormat('en-CA', { timeZone: FUSEAU, year: 'numeric', month: '2-digit', day: '2-digit' });

export function jourLocal(date) {
  return formatJour.format(date); // 'YYYY-MM-DD'
}

function decalerJour(jour, delta) {
  const d = new Date(`${jour}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + delta);
  return d.toISOString().slice(0, 10);
}

function roundMoney(value) {
  return Math.round((Number(value) + Number.EPSILON) * 1000) / 1000;
}

// Statuts exclus du chiffre d'affaires « commandé » : la vente n'a pas eu
// lieu (annulée) ou a été intégralement remboursée.
const STATUTS_EXCLUS_CA = ['annulee', 'retournee'];

/**
 * Statistiques du tableau de bord vendeur.
 *
 * Le CA est ici le montant des articles commandés (sous-total, hors frais de
 * livraison) des commandes non annulées et non remboursées, daté du jour de
 * la commande — ce que le vendeur a vendu ce jour-là. Les montants réellement
 * encaissés / retirables viennent de calculerFinancesBoutique (même source
 * que le reste du tableau de bord).
 */
export async function calculerStatsVendeur(boutiqueId, { jours = 7, maintenant = new Date() } = {}) {
  const aujourdHui = jourLocal(maintenant);
  const jourSemaine = new Date(`${aujourdHui}T12:00:00Z`).getUTCDay(); // 0 = dimanche
  const debutSemaine = decalerJour(aujourdHui, -((jourSemaine + 6) % 7)); // lundi
  const debutMois = `${aujourdHui.slice(0, 8)}01`;
  const debutSerie = decalerJour(aujourdHui, -(jours - 1));
  const debutRequete = [debutSemaine, debutMois, debutSerie].sort()[0];

  // Marge d'un jour avant la borne : la conversion au fuseau de Tunis se
  // fait ensuite en JS, commande par commande.
  const borne = new Date(`${decalerJour(debutRequete, -1)}T00:00:00Z`);
  const commandes = await Commande.findAll({
    where: { boutiqueId, createdAt: { [Op.gte]: borne }, statut: { [Op.notIn]: STATUTS_EXCLUS_CA } },
    attributes: ['id', 'sousTotal', 'createdAt'],
    include: [{ model: LigneCommande, as: 'lignes', attributes: ['quantite'] }],
  });

  const parJour = new Map();
  for (const commande of commandes) {
    const jour = jourLocal(commande.createdAt);
    const bucket = parJour.get(jour) || { ca: 0, commandes: 0, articles: 0 };
    bucket.ca += Number(commande.sousTotal || 0);
    bucket.commandes += 1;
    bucket.articles += (commande.lignes || []).reduce((sum, l) => sum + Number(l.quantite || 0), 0);
    parJour.set(jour, bucket);
  }

  const cumul = (depuis) => {
    const total = { ca: 0, commandes: 0, articles: 0 };
    for (const [jour, b] of parJour) {
      if (jour >= depuis && jour <= aujourdHui) {
        total.ca += b.ca;
        total.commandes += b.commandes;
        total.articles += b.articles;
      }
    }
    return { ca: roundMoney(total.ca), commandes: total.commandes, articles: total.articles };
  };

  const serie = [];
  for (let i = 0; i < jours; i += 1) {
    const jour = decalerJour(debutSerie, i);
    const b = parJour.get(jour) || { ca: 0, commandes: 0 };
    serie.push({ date: jour, ca: roundMoney(b.ca), commandes: b.commandes });
  }

  const mois = cumul(debutMois);

  // Taux de retour sur l'ensemble des commandes livrées un jour (livrées,
  // en retour, en litige ou remboursées).
  const commandesLivrees = await Commande.count({
    where: { boutiqueId, statut: { [Op.in]: ['livree', 'retour', 'litige', 'retournee'] } },
  });
  const retours = await Retour.count({ where: { boutiqueId } });

  const finances = await calculerFinancesBoutique(boutiqueId);
  const stockFaible = await compterProduitsStockFaible(boutiqueId);

  return {
    aujourdHui: cumul(aujourdHui),
    semaine: cumul(debutSemaine),
    mois,
    produitsVendusMois: mois.articles,
    panierMoyenMois: mois.commandes ? roundMoney(mois.ca / mois.commandes) : 0,
    tauxRetour: commandesLivrees ? Math.round((retours / commandesLivrees) * 1000) / 10 : 0, // en %
    commissions: finances.totalCommissions,
    soldeDisponible: finances.soldeDisponible,
    sequestre: finances.soldeEnAttenteEscrow,
    stockFaible,
    seuilStockFaible: marketplaceConfig.lowStockThreshold,
    serie,
  };
}
