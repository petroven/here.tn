const parsedCommissionRate = Number(process.env.COMMISSION_RATE);
const parsedMinimumWithdrawal = Number(process.env.MIN_WITHDRAWAL_AMOUNT);
const parsedSearchRadiusKm = Number(process.env.COURIER_SEARCH_RADIUS_KM);
const parsedNotificationTimeoutSeconds = Number(process.env.COURIER_NOTIFICATION_TIMEOUT_SECONDS);
const parsedCashbackRate = Number(process.env.WALLET_CASHBACK_RATE);

export const marketplaceConfig = {
  commissionRate: Number.isFinite(parsedCommissionRate) && parsedCommissionRate >= 0 && parsedCommissionRate <= 1
    ? parsedCommissionRate
    : 0.05,
  minimumWithdrawal: Number.isFinite(parsedMinimumWithdrawal) && parsedMinimumWithdrawal >= 0
    ? parsedMinimumWithdrawal
    : 50,
  shipping: {
    chargePerStore: process.env.SHIPPING_CHARGE_PER_STORE !== 'false',
    freeThreshold: Number(process.env.FREE_SHIPPING_THRESHOLD || 0),
  },
  courierMatching: {
    searchRadiusKm: Number.isFinite(parsedSearchRadiusKm) && parsedSearchRadiusKm > 0
      ? parsedSearchRadiusKm
      : 10,
    notificationTimeoutSeconds: Number.isFinite(parsedNotificationTimeoutSeconds) && parsedNotificationTimeoutSeconds > 0
      ? parsedNotificationTimeoutSeconds
      : 60,
  },
  wallet: {
    cashbackRate: Number.isFinite(parsedCashbackRate) && parsedCashbackRate >= 0 && parsedCashbackRate <= 1
      ? parsedCashbackRate
      : 0.01,
  },
  returnPolicy: {
    // Fenêtre par défaut (jours) pour tout produit dont la catégorie n'a pas
    // de delaiRetourJours configuré. Les catégories réelles (voir seed.js)
    // ont chacune leur propre valeur — ceci n'est qu'un filet de sécurité.
    defaultWindowDays: 14,
    // Délai laissé au vendeur pour répondre à une demande de retour avant
    // escalade automatique vers la médiation admin (statut 'litige').
    vendorResponseHours: 48,
  },
  // Compte bancaire de la plateforme affiché au client qui choisit "virement
  // bancaire" au paiement. Un virement ne peut jamais être vérifié
  // automatiquement (pas de webhook bancaire) — il reste "en attente de
  // validation" jusqu'à ce qu'un admin confirme la réception sur le relevé.
  platformBank: {
    titulaire: process.env.PLATFORM_BANK_TITULAIRE || '',
    rib: process.env.PLATFORM_BANK_RIB || '',
    banque: process.env.PLATFORM_BANK_NAME || '',
  },
};

export function calculateShipping({ baseFee, storesCount, subtotal }) {
  if (marketplaceConfig.shipping.freeThreshold > 0 && subtotal >= marketplaceConfig.shipping.freeThreshold) {
    return 0;
  }
  const multiplier = marketplaceConfig.shipping.chargePerStore ? Math.max(storesCount, 1) : 1;
  return Number(baseFee || 0) * multiplier;
}

export function calculateCommission(subtotal) {
  return Number(subtotal || 0) * marketplaceConfig.commissionRate;
}
