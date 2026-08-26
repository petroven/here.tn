import crypto from 'crypto';
import {
  Produit, Boutique, Categorie, Variante, Commande, LigneCommande,
  Paiement, Commission, Livraison, Livreur, Coupon, Utilisateur, Gouvernorat, Delegation, Avis,
  WalletTransaction,
} from '../models/index.js';
import { Op, literal } from 'sequelize';
import { genererNumeroCommande, genererTrackingId, genererAwbNumber } from '../utils/shipping.js';
import { initKonnectPayment, initFlouciPayment, confirmSandboxPayment } from '../utils/paymentGateway.js';
import { emailConfirmationCommande, emailGarantieCommande, emailFacture, emailContratRetour, emailConfirmationLien, envoyerRecuPaiement, emailCommandeAnnulee } from '../utils/email.js';
import { smsStatutLivraison, smsConfirmationCommande } from '../utils/sms.js';

const DUREE_CONFIRMATION_HEURES = 48;
import { generateInvoicePDF } from '../utils/pdf.js';
import { calculateCommission, calculateShipping, marketplaceConfig } from '../config/marketplace.js';
import { matchAndNotifyCourierForLivraison } from '../utils/courierMatching.js';
import { crediterCashback, plafonnerUtilisationWallet, crediterAnnulationCommande } from '../utils/wallet.js';

function getCommissionRate() {
  return marketplaceConfig.commissionRate;
}

function roundMoney(value) {
  return Math.round((Number(value) + Number.EPSILON) * 1000) / 1000;
}

export async function getProduits(req, res) {
  try {
    const page = Math.max(Number.parseInt(req.query.page, 10) || 1, 1);
    const limit = Math.min(Math.max(Number.parseInt(req.query.limit, 10) || 24, 1), 60);
    const offset = (page - 1) * limit;
    const { search, categoryId, storeId, minPrice, maxPrice, minRating, inStock, promotion, sort = 'newest' } = req.query;
    const where = { status: 'actif' };
    const andConditions = [];

    if (search) {
      where[Op.or] = [
        { nom: { [Op.like]: `%${search}%` } },
        { description: { [Op.like]: `%${search}%` } },
      ];
    }
    if (categoryId) {
      const category = await Categorie.findByPk(Number(categoryId), { attributes: ['id'] });
      const children = category
        ? await Categorie.findAll({ where: { parentId: category.id }, attributes: ['id'] })
        : [];
      where.categorieId = { [Op.in]: [Number(categoryId), ...children.map((child) => child.id)] };
    }
    if (storeId) where.boutiqueId = Number(storeId);
    if (minPrice || maxPrice) {
      where.prix = {};
      if (minPrice) where.prix[Op.gte] = Number(minPrice);
      if (maxPrice) where.prix[Op.lte] = Number(maxPrice);
    }
    if (inStock === 'true') where.stock = { [Op.gt]: 0 };
    if (promotion === 'true') andConditions.push(literal('"prixAvant" IS NOT NULL AND "prixAvant" > "prix"'));
    if (minRating) {
      andConditions.push(literal(`(SELECT AVG("note") FROM "Avis" WHERE "Avis"."produitId" = "Produit"."id" AND "Avis"."valide" = 1) >= ${Number(minRating)}`));
    }
    if (andConditions.length > 0) where[Op.and] = andConditions;

    const order = sort === 'price_asc'
      ? [['prix', 'ASC']]
      : sort === 'price_desc'
      ? [['prix', 'DESC']]
      : sort === 'rating'
      ? [[literal('(SELECT AVG("note") FROM "Avis" WHERE "Avis"."produitId" = "Produit"."id" AND "Avis"."valide" = 1)'), 'DESC']]
      : sort === 'best_sellers'
      ? [['createdAt', 'ASC']]
      : [['createdAt', 'DESC']];

    const result = await Produit.findAndCountAll({
      where,
      include: [
        { model: Boutique, as: 'boutique', where: { statut: 'validee' }, attributes: ['id', 'nom', 'logo', 'bannière', 'categorie', 'gouvernoratId', 'description'] },
        { model: Categorie, as: 'categorie', attributes: ['id', 'nom'] },
        { model: Variante, as: 'variantes' },
      ],
      attributes: {
        include: [
          [literal('(SELECT AVG("note") FROM "Avis" WHERE "Avis"."produitId" = "Produit"."id" AND "Avis"."valide" = 1)'), 'note'],
          [literal('(SELECT COUNT(*) FROM "Avis" WHERE "Avis"."produitId" = "Produit"."id" AND "Avis"."valide" = 1)'), 'nombreAvis'],
        ],
      },
      order,
      limit,
      offset,
      distinct: true,
    });
    res.json({ success: true, data: result.rows, count: result.count, pagination: { page, limit, totalPages: Math.ceil(result.count / limit) } });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
}

export async function getProduitById(req, res) {
  try {
    const produit = await Produit.findByPk(req.params.id, {
      include: [
        { model: Boutique, as: 'boutique' },
        { model: Categorie, as: 'categorie' },
        { model: Variante, as: 'variantes' },
        { model: Avis, where: { valide: true, type: 'produit' }, required: false, include: [{ model: Utilisateur, as: 'auteur', attributes: ['id', 'nom', 'prenom'] }] },
      ],
      attributes: {
        include: [
          [literal('(SELECT AVG("note") FROM "Avis" WHERE "Avis"."produitId" = "Produit"."id" AND "Avis"."valide" = 1)'), 'note'],
          [literal('(SELECT COUNT(*) FROM "Avis" WHERE "Avis"."produitId" = "Produit"."id" AND "Avis"."valide" = 1)'), 'nombreAvis'],
        ],
      },
    });
    if (!produit) return res.status(404).json({ success: false, message: 'Produit introuvable.' });
    res.json({ success: true, data: produit });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
}

export async function getBoutiques(_req, res) {
  try {
    const boutiques = await Boutique.findAll({
      where: { statut: 'validee' },
      include: [
        { model: Produit, where: { status: 'actif' }, required: false, attributes: ['id'] },
        { model: Gouvernorat, attributes: ['id', 'nom', 'nomAr'], required: false },
      ],
      order: [['createdAt', 'DESC']],
    });
    res.json({ success: true, data: boutiques.map((boutique) => ({
      ...boutique.toJSON(),
      nombreProduits: boutique.Produits?.length || 0,
    })), count: boutiques.length });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
}

export async function getBoutiqueById(req, res) {
  try {
    const boutique = await Boutique.findOne({
      where: { id: req.params.id, statut: 'validee' },
      include: [
        { model: Utilisateur, as: 'vendeur', attributes: ['id', 'nom', 'prenom'] },
        {
          model: Produit,
          where: { status: 'actif' },
          required: false,
          include: [{ model: Categorie, as: 'categorie', attributes: ['id', 'nom'] }],
        },
        { model: Gouvernorat, attributes: ['id', 'nom', 'nomAr'], required: false },
      ],
    });
    if (!boutique) return res.status(404).json({ success: false, message: 'Boutique introuvable.' });
    res.json({ success: true, data: { ...boutique.toJSON(), nombreProduits: boutique.Produits?.length || 0 } });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
}

async function validerCoupon(code, sousTotal) {
  if (!code) return { remise: 0, coupon: null };
  const coupon = await Coupon.findOne({
    where: { code: code.toUpperCase(), actif: true, dateExpiration: { [Op.gt]: new Date() } },
  });
  if (!coupon) throw new Error('Coupon invalide ou expiré.');
  if (coupon.utilisations >= coupon.limiteUtilisation) throw new Error('Coupon épuisé.');
  if (sousTotal < coupon.montantMinimum) throw new Error(`Montant minimum requis: ${coupon.montantMinimum} TND.`);

  const remise = coupon.type === 'pourcentage'
    ? sousTotal * (coupon.valeur / 100)
    : Math.min(coupon.valeur, sousTotal);

  return { remise, coupon };
}

export async function validerCouponEndpoint(req, res) {
  try {
    const { code, sousTotal } = req.body;
    const result = await validerCoupon(code, Number(sousTotal));
    res.json({ success: true, data: { remise: result.remise, code: result.coupon?.code, type: result.coupon?.type, valeur: result.coupon?.valeur } });
  } catch (error) {
    res.status(400).json({ success: false, message: error.message });
  }
}

export async function getCouponsActifs(req, res) {
  try {
    const coupons = await Coupon.findAll({
      where: { actif: true, dateExpiration: { [Op.gt]: new Date() } },
      attributes: ['code', 'type', 'valeur', 'montantMinimum', 'dateExpiration', 'limiteUtilisation', 'utilisations'],
      order: [['dateExpiration', 'ASC']],
    });
    const disponibles = coupons.filter((c) => c.utilisations < c.limiteUtilisation);
    res.json({ success: true, data: disponibles });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
}

export async function createCommande(req, res) {
  const transaction = await Commande.sequelize.transaction();
  try {
    const {
      lignes, adresseLivraison,
      gouvernoratId, delegationId, methodePaiement = 'cod', couponCode, walletMontant = 0,
      referenceVirement,
    } = req.body;

    if (!Array.isArray(lignes) || lignes.length === 0) {
      throw new Error('Aucune ligne de commande fournie.');
    }
    const clientId = req.user.id;

    const gouvernorat = await Gouvernorat.findByPk(gouvernoratId);
    if (!gouvernorat) throw new Error('Gouvernorat invalide.');

    let sousTotal = 0;
    const lignesValidees = [];
    const lignesParBoutique = new Map();
    const commissionRate = getCommissionRate();

    for (const ligne of lignes) {
      const produit = await Produit.findByPk(ligne.produitId, {
        include: [
          { model: Variante, as: 'variantes' },
          { model: Boutique, as: 'boutique', attributes: ['id', 'nom'] },
        ],
      });
      if (!produit || produit.status !== 'actif') throw new Error(`Produit ${ligne.produitId} indisponible.`);
      if (!produit.boutiqueId) throw new Error(`Produit ${ligne.produitId} sans boutique associée.`);

      let prix = produit.prix;
      let stockDispo = produit.stock;

      if (ligne.varianteId) {
        const variante = produit.variantes?.find((v) => v.id === ligne.varianteId);
        if (!variante) throw new Error('Variante introuvable.');
        prix += variante.prixSupplement || 0;
        stockDispo = variante.stock;
      }

      if (ligne.quantite > stockDispo) throw new Error(`Stock insuffisant pour ${produit.nom}.`);

      const totalLigne = prix * ligne.quantite;
      sousTotal += totalLigne;

      const ligneValidee = {
        ...ligne,
        boutiqueId: produit.boutiqueId,
        prixUnitaire: prix,
        totalLigne,
        produit,
      };
      lignesValidees.push(ligneValidee);

      const bucket = lignesParBoutique.get(produit.boutiqueId) || {
        boutiqueId: produit.boutiqueId,
        sousTotal: 0,
        lignes: [],
      };
      bucket.sousTotal += totalLigne;
      bucket.lignes.push(ligneValidee);
      lignesParBoutique.set(produit.boutiqueId, bucket);
    }

    const boutiquesIds = [...lignesParBoutique.keys()];
    if (boutiquesIds.length > 1 && methodePaiement !== 'cod') {
      throw new Error('Le paiement en ligne multi-boutiques n\'est pas encore disponible. Veuillez utiliser le paiement à la livraison.');
    }

    const { remise, coupon } = await validerCoupon(couponCode, sousTotal);
    const fraisLivraisonTotal = calculateShipping({
      baseFee: gouvernorat.fraisLivraison,
      storesCount: boutiquesIds.length,
      subtotal: sousTotal,
    });
    const fraisLivraisonUnitaire = boutiquesIds.length > 0
      ? fraisLivraisonTotal / boutiquesIds.length
      : 0;
    const groupeCommande = boutiquesIds.length > 1
      ? `GRP-${Date.now()}-${Math.floor(1000 + Math.random() * 9000)}`
      : null;

    // Wallet: le montant utilisable est toujours plafonné côté serveur au
    // solde réel du client et au sous-total des produits uniquement — les
    // frais de livraison doivent toujours être réglés par un vrai moyen de
    // paiement (COD ou carte), jamais couverts par le solde/cashback.
    const utilisateurCourant = await Utilisateur.findByPk(clientId, { transaction });
    const plafondWalletProduits = Math.max(0, roundMoney(sousTotal - remise));
    const walletUtiliseTotal = plafonnerUtilisationWallet(utilisateurCourant.soldeWallet, walletMontant, plafondWalletProduits);

    const commandesCreees = [];
    const paiementsCrees = [];
    const trackingIds = [];
    const requiertConfirmation = methodePaiement === 'cod';

    for (const boutiqueId of boutiquesIds) {
      const bucket = lignesParBoutique.get(boutiqueId);
      const remisePart = sousTotal > 0 ? (remise * bucket.sousTotal) / sousTotal : 0;
      const walletPart = sousTotal > 0 ? (walletUtiliseTotal * bucket.sousTotal) / sousTotal : 0;
      const totalCommande = roundMoney(Math.max(0, bucket.sousTotal + fraisLivraisonUnitaire - remisePart - walletPart));
      const totalDejaCouvert = totalCommande <= 0.001;
      const montantCommission = roundMoney(calculateCommission(bucket.sousTotal));
      const montantVendeur = roundMoney(bucket.sousTotal - montantCommission);

      const commande = await Commande.create({
        numeroCommande: genererNumeroCommande(),
        groupeCommande,
        clientId,
        boutiqueId,
        sousTotal: roundMoney(bucket.sousTotal),
        fraisLivraison: fraisLivraisonUnitaire,
        remiseCoupon: roundMoney(remisePart),
        walletUtilise: roundMoney(walletPart),
        total: totalCommande,
        montantCommission,
        montantVendeur,
        statut: totalDejaCouvert ? 'payee' : 'en_attente',
        adresseLivraison,
        gouvernoratId,
        delegationId,
        couponCode: coupon?.code,
        confirmationStatut: requiertConfirmation ? 'en_attente' : 'confirmee',
        confirmationToken: requiertConfirmation ? crypto.randomBytes(16).toString('hex') : null,
        confirmationExpiresAt: requiertConfirmation
          ? new Date(Date.now() + DUREE_CONFIRMATION_HEURES * 60 * 60 * 1000)
          : null,
      }, { transaction });

      for (const lv of bucket.lignes) {
        await LigneCommande.create({
          commandeId: commande.id,
          produitId: lv.produitId,
          varianteId: lv.varianteId || null,
          quantite: lv.quantite,
          prixUnitaire: lv.prixUnitaire,
        }, { transaction });

        if (lv.varianteId) {
          const variante = await Variante.findByPk(lv.varianteId, { transaction });
          await variante.update({ stock: variante.stock - lv.quantite }, { transaction });
        } else {
          await lv.produit.update({ stock: lv.produit.stock - lv.quantite }, { transaction });
        }
      }

      const paiementStatut = totalDejaCouvert
        ? 'valide'
        : (methodePaiement === 'cod'
          ? 'en_attente_livraison'
          : (methodePaiement === 'virement' ? 'en_attente_validation' : 'en_attente'));
      const paiement = await Paiement.create({
        commandeId: commande.id,
        montant: totalCommande,
        methode: methodePaiement,
        statut: paiementStatut,
        referenceVirement: methodePaiement === 'virement' ? (referenceVirement || null) : null,
      }, { transaction });

      await Commission.create({
        commandeId: commande.id,
        boutiqueId,
        montant: montantCommission,
        tauxCommission: commissionRate,
      }, { transaction });

      const trackingId = genererTrackingId();
      await Livraison.create({
        commandeId: commande.id,
        trackingId,
        awbNumber: genererAwbNumber(),
        fraisLivraison: fraisLivraisonUnitaire,
        statut: 'en_preparation',
        historiqueStatuts: [{ statut: 'en_preparation', date: new Date().toISOString() }],
      }, { transaction });

      commandesCreees.push(commande);
      paiementsCrees.push(paiement);
      trackingIds.push(trackingId);
    }

    if (coupon) {
      await coupon.update({ utilisations: coupon.utilisations + 1 }, { transaction });
    }

    if (walletUtiliseTotal > 0) {
      await utilisateurCourant.update(
        { soldeWallet: roundMoney(Number(utilisateurCourant.soldeWallet) - walletUtiliseTotal) },
        { transaction },
      );
      await WalletTransaction.create({
        utilisateurId: clientId,
        commandeId: commandesCreees[0].id,
        montant: walletUtiliseTotal,
        type: 'debit',
        motif: 'utilise_commande',
      }, { transaction });
    }

    let paymentRedirect = null;
    if ((methodePaiement === 'konnect' || methodePaiement === 'flouci') && commandesCreees.length === 1 && commandesCreees[0].total > 0) {
      const client = await Utilisateur.findByPk(clientId);
      const initFn = methodePaiement === 'konnect' ? initKonnectPayment : initFlouciPayment;
      paymentRedirect = await initFn({
        amount: commandesCreees[0].total,
        orderId: commandesCreees[0].id,
        email: client.email,
        phone: client.telephone,
      });
      await paiementsCrees[0].update({ reference: paymentRedirect.paymentRef, gatewayResponse: paymentRedirect }, { transaction });
    }

    await transaction.commit();

    const virementInstructions = methodePaiement === 'virement' && !paiementsCrees.every((p) => p.statut === 'valide')
      ? {
        ...marketplaceConfig.platformBank,
        montant: roundMoney(commandesCreees.reduce((sum, commande) => sum + commande.total, 0)),
        reference: commandesCreees[0].numeroCommande,
      }
      : null;

    for (const commande of commandesCreees) {
      if (commande.statut === 'payee') await crediterCashback(commande.id);
    }

    const client = await Utilisateur.findByPk(clientId);
    if (client) {
      for (const commande of commandesCreees) {
        await emailConfirmationCommande(commande, client);
        await emailGarantieCommande(commande, client);
        await emailContratRetour(commande, client).catch((error) => {
          console.error('[EMAIL] Échec envoi contrat de retour:', error.message);
        });
        // La facture part par email dès la création de la commande — elle
        // reste valable comme reçu même si le paiement se fait plus tard
        // (COD, virement), puisque les montants ne changent plus après coup.
        const bucket = lignesParBoutique.get(commande.boutiqueId);
        if (bucket?.lignes?.length) {
          await emailFacture(commande, client, bucket.lignes[0].produit.boutique, bucket.lignes).catch((error) => {
            console.error('[EMAIL] Échec envoi facture:', error.message);
          });
        }
        if (commande.confirmationToken) {
          await emailConfirmationLien(commande, client).catch((error) => {
            console.error('[EMAIL] Échec envoi lien de confirmation:', error.message);
          });
          if (client.telephone) {
            await smsConfirmationCommande(client.telephone, commande.numeroCommande, commande.confirmationToken);
          }
        }
      }
    }

    res.status(201).json({
      success: true,
      message: 'Commande créée avec succès.',
      data: {
        commande: commandesCreees[0],
        paiement: paiementsCrees[0],
        trackingId: trackingIds[0],
        commandes: commandesCreees,
        paiements: paiementsCrees,
        trackingIds,
        groupeCommande,
        isMultiVendor: commandesCreees.length > 1,
        financialSummary: {
          sousTotal: roundMoney(sousTotal),
          remise: roundMoney(remise),
          fraisLivraison: roundMoney(fraisLivraisonTotal),
          commissionRate,
          commissionPercent: commissionRate * 100,
          commissionTotale: roundMoney(calculateCommission(sousTotal)),
          total: roundMoney(commandesCreees.reduce((sum, commande) => sum + commande.total, 0)),
        },
        paymentRedirect,
        virementInstructions,
      },
    });
  } catch (error) {
    await transaction.rollback();
    res.status(400).json({ success: false, message: error.message });
  }
}

export async function confirmPayment(req, res) {
  try {
    const { paymentRef } = req.body;
    if (!paymentRef) return res.status(400).json({ success: false, message: 'Référence de paiement requise.' });

    const paiement = await Paiement.findOne({
      where: { reference: paymentRef },
      include: [{ model: Commande }],
    });
    if (!paiement) return res.status(404).json({ success: false, message: 'Paiement introuvable.' });

    // Seul le client propriétaire de la commande (ou un admin) peut confirmer
    // ce paiement — sans ce contrôle, connaître/deviner une référence
    // suffirait à valider la commande de n'importe qui.
    const commandeAssociee = paiement.Commande;
    if (!commandeAssociee || Number(commandeAssociee.clientId) !== Number(req.user.id)) {
      if (!['administrateur', 'super_admin'].includes(req.user.role)) {
        return res.status(403).json({ success: false, message: 'Accès à ce paiement refusé.' });
      }
    }

    if (paiement.statut === 'valide') {
      // Déjà confirmé (retry) — répondre succès sans rejouer les effets de bord.
      return res.json({ success: true, data: { success: true, statut: 'valide', reference: paymentRef, alreadyProcessed: true } });
    }

    const result = await confirmSandboxPayment(paymentRef);

    await paiement.update({ statut: 'valide', gatewayResponse: result });
    await Commande.update({ statut: 'payee' }, { where: { id: paiement.commandeId } });
    await crediterCashback(paiement.commandeId);
    envoyerRecuPaiement(paiement.commandeId).catch((error) => {
      console.error('[EMAIL] Échec envoi reçu de paiement:', error.message);
    });

    res.json({ success: true, data: result });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
}

export async function getCommandeFacture(req, res) {
  try {
    const commande = await Commande.findByPk(req.params.id, {
      include: [
        { model: LigneCommande, as: 'lignes', include: [{ model: Produit, as: 'produit' }] },
        { model: Boutique, as: 'boutique' },
        { model: Utilisateur, as: 'client' },
      ],
    });
    if (!commande) return res.status(404).json({ success: false, message: 'Commande introuvable.' });

    // Seul le client propriétaire, le vendeur de la boutique concernée ou un
    // admin peut télécharger cette facture — sans ce contrôle, un ID de
    // commande deviné suffirait à récupérer la facture de n'importe qui.
    const estProprietaire = Number(commande.clientId) === Number(req.user.id);
    const estVendeurBoutique = Number(commande.boutique?.vendeurId) === Number(req.user.id);
    const estAdmin = ['administrateur', 'super_admin'].includes(req.user.role);
    if (!estProprietaire && !estVendeurBoutique && !estAdmin) {
      return res.status(403).json({ success: false, message: 'Accès à cette facture refusé.' });
    }

    const lang = req.query.lang || 'fr';
    const pdf = await generateInvoicePDF(commande, commande.client, commande.boutique, commande.lignes, lang);

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename=facture-${commande.numeroCommande}.pdf`);
    res.send(pdf);
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
}

export async function getMesCommandes(req, res) {
  try {
    const commandes = await Commande.findAll({
      where: { clientId: req.user.id },
      include: [
        { model: LigneCommande, as: 'lignes', include: [{ model: Produit, as: 'produit' }] },
        { model: Paiement, as: 'paiement' },
        {
          model: Livraison,
          as: 'livraison',
          include: [{ model: Livreur, as: 'livreur', attributes: ['id', 'utilisateurId'] }],
        },
        { model: Boutique, as: 'boutique', attributes: ['id', 'nom'] },
      ],
      order: [['createdAt', 'DESC']],
    });
    res.json({ success: true, data: commandes });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
}

// Le client peut annuler lui-même sa commande tant qu'elle n'a pas encore
// été prise en charge pour l'expédition (Livraison.statut === 'en_preparation')
// — une fois le colis remis au transporteur/livreur, seule une demande de
// retour après livraison reste possible (voir retourRoutes.js).
export async function annulerCommandeParClient(req, res) {
  try {
    const { id } = req.params;
    const commande = await Commande.findOne({
      where: { id, clientId: req.user.id },
      include: [
        { model: Livraison, as: 'livraison' },
        { model: Paiement, as: 'paiement' },
        { model: LigneCommande, as: 'lignes' },
      ],
    });

    if (!commande) {
      return res.status(404).json({ success: false, message: 'Commande introuvable.' });
    }

    if (!['en_attente', 'payee'].includes(commande.statut)) {
      return res.status(400).json({ success: false, message: 'Cette commande ne peut plus être annulée.' });
    }

    if (commande.livraison && commande.livraison.statut !== 'en_preparation') {
      return res.status(400).json({
        success: false,
        message: 'Votre colis a déjà été pris en charge pour la livraison — l\'annulation n\'est plus possible. Vous pourrez faire une demande de retour une fois la commande livrée.',
      });
    }

    for (const ligne of commande.lignes || []) {
      if (ligne.varianteId) {
        const variante = await Variante.findByPk(ligne.varianteId);
        if (variante) await variante.update({ stock: variante.stock + ligne.quantite });
      } else {
        const produit = await Produit.findByPk(ligne.produitId);
        if (produit) await produit.update({ stock: produit.stock + ligne.quantite });
      }
    }

    await commande.update({ statut: 'annulee' });
    await crediterAnnulationCommande(commande);

    const client = await Utilisateur.findByPk(commande.clientId);
    if (client) {
      emailCommandeAnnulee(commande, client).catch((error) => {
        console.error('[EMAIL] Échec envoi confirmation annulation:', error.message);
      });
    }

    res.json({ success: true, data: commande, message: 'Commande annulée avec succès.' });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
}

export async function updateLivraisonStatut(req, res) {
  try {
    const { statut } = req.body;
    const livraison = await Livraison.findOne({
      where: { commandeId: req.params.commandeId },
      include: [{ model: Commande, include: [{ model: Utilisateur, as: 'client' }, { model: Paiement, as: 'paiement' }] }],
    });
    if (!livraison) return res.status(404).json({ success: false, message: 'Livraison introuvable.' });

    if (statut === 'expedie' && livraison.Commande?.confirmationStatut === 'en_attente') {
      return res.status(409).json({
        success: false,
        message: 'Le client doit d\'abord confirmer sa commande (lien envoyé par SMS) avant expédition.',
      });
    }

    const historique = [...(livraison.historiqueStatuts || []), { statut, date: new Date().toISOString() }];
    const updates = { statut, historiqueStatuts: historique };

    if (statut === 'expedie') updates.dateExpedition = new Date();
    if (statut === 'livre') {
      updates.dateLivraison = new Date();
      await Commande.update({ statut: 'livree' }, { where: { id: livraison.commandeId } });
      const paiement = livraison.Commande?.paiement;
      if (paiement?.methode === 'cod' && paiement.statut === 'en_attente_livraison') {
        await paiement.update({ statut: 'paye_livraison' });
        await Commande.update({ statut: 'payee' }, { where: { id: livraison.commandeId } });
      }
    }

    await livraison.update(updates);

    if (statut === 'expedie') {
      matchAndNotifyCourierForLivraison(livraison.id).catch((err) =>
        console.error('[MATCHING] Échec du matching automatique pour livraison', livraison.id, err),
      );
    }

    const client = livraison.Commande?.client;
    if (client) {
      if (client.telephone) await smsStatutLivraison(client.telephone, livraison.trackingId, statut);
    }

    res.json({ success: true, data: livraison });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
}

export async function assignDeliveryManually(req, res) {
  try {
    const livraison = await Livraison.findOne({ where: { commandeId: req.params.id } });
    if (!livraison) return res.status(404).json({ success: false, message: 'Livraison introuvable pour cette commande.' });

    if (livraison.statutAssignation !== 'en_attente' || livraison.livreurId) {
      return res.status(409).json({ success: false, message: 'Cette livraison est déjà assignée ou en cours de traitement.' });
    }

    const result = await matchAndNotifyCourierForLivraison(livraison.id);
    res.json({ success: true, data: result });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
}

export async function getTracking(req, res) {
  try {
    const livraison = await Livraison.findOne({
      where: { trackingId: req.params.trackingId },
      include: [{ model: Commande, attributes: ['numeroCommande', 'statut'] }],
    });
    if (!livraison) return res.status(404).json({ success: false, message: 'Tracking introuvable.' });
    res.json({ success: true, data: livraison });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
}

export async function getConfirmationCommande(req, res) {
  try {
    const commande = await Commande.findOne({
      where: { confirmationToken: req.params.token },
      include: [
        { model: LigneCommande, as: 'lignes', include: [{ model: Produit, as: 'produit', attributes: ['id', 'nom', 'image'] }] },
        { model: Boutique, as: 'boutique', attributes: ['id', 'nom'] },
      ],
    });
    if (!commande) return res.status(404).json({ success: false, message: 'Lien de confirmation invalide ou expiré.' });

    if (commande.confirmationStatut === 'en_attente' && commande.confirmationExpiresAt && new Date(commande.confirmationExpiresAt) < new Date()) {
      await commande.update({ confirmationStatut: 'expiree' });
    }

    res.json({ success: true, data: commande });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
}

export async function repondreConfirmationCommande(req, res) {
  const transaction = await Commande.sequelize.transaction();
  try {
    const { action } = req.body;
    if (!['confirmer', 'annuler'].includes(action)) {
      await transaction.rollback();
      return res.status(400).json({ success: false, message: 'Action invalide.' });
    }

    const commande = await Commande.findOne({
      where: { confirmationToken: req.params.token },
      include: [{ model: LigneCommande, as: 'lignes' }],
      transaction,
    });
    if (!commande) {
      await transaction.rollback();
      return res.status(404).json({ success: false, message: 'Lien de confirmation invalide.' });
    }
    if (commande.confirmationStatut !== 'en_attente') {
      await transaction.rollback();
      return res.status(409).json({ success: false, message: 'Cette commande a déjà été traitée.' });
    }
    if (commande.confirmationExpiresAt && new Date(commande.confirmationExpiresAt) < new Date()) {
      await commande.update({ confirmationStatut: 'expiree' }, { transaction });
      await transaction.commit();
      return res.status(410).json({ success: false, message: 'Le délai de confirmation de 48h est dépassé.' });
    }

    if (action === 'annuler') {
      for (const ligne of commande.lignes) {
        if (ligne.varianteId) {
          await Variante.increment('stock', { by: ligne.quantite, where: { id: ligne.varianteId }, transaction });
        } else {
          await Produit.increment('stock', { by: ligne.quantite, where: { id: ligne.produitId }, transaction });
        }
      }
      await commande.update({ confirmationStatut: 'refusee', statut: 'annulee', confirmationDate: new Date() }, { transaction });
    } else {
      await commande.update({ confirmationStatut: 'confirmee', confirmationDate: new Date() }, { transaction });
    }

    await transaction.commit();
    res.json({ success: true, data: commande });
  } catch (error) {
    await transaction.rollback();
    res.status(500).json({ success: false, message: error.message });
  }
}
