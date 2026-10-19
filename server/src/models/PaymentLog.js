import { DataTypes } from 'sequelize';
import sequelize from '../config/database.js';

// Audit trail of payment events — who/when/amount/status only, never raw card data.
const PaymentLog = sequelize.define('PaymentLog', {
  id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
  evenement: { type: DataTypes.STRING, allowNull: false }, // e.g. 'initiate', 'webhook_recu', 'webhook_rejete'
  statut: { type: DataTypes.STRING, allowNull: false },
  montant: { type: DataTypes.FLOAT, allowNull: true },
  provider: { type: DataTypes.STRING, allowNull: true },
  message: { type: DataTypes.STRING, allowNull: true },
  ip: { type: DataTypes.STRING, allowNull: true },
});

// Anomalies recopiées dans les logs du serveur (Render) : sans ça, elles ne
// seraient visibles qu'en interrogeant la table. Un paiement encaissé sur une
// commande close est une erreur (remboursement manuel à faire).
const ANOMALIES = new Set(['signature_invalide', 'montant_invalide', 'transaction_introuvable', 'a_rembourser']);
export function niveauJournalPaiement({ evenement, statut }) {
  if (statut === 'a_rembourser') return 'error';
  if (ANOMALIES.has(statut) || evenement === 'webhook_rejete' || evenement === 'initiate_echec') return 'warn';
  return null;
}

PaymentLog.addHook('afterCreate', (log) => {
  const niveau = niveauJournalPaiement(log);
  if (!niveau) return;
  console[niveau](`[PAYMENT] ${log.evenement}/${log.statut}`, JSON.stringify({
    id: log.id, transactionId: log.transactionId ?? null, provider: log.provider, montant: log.montant, message: log.message, ip: log.ip,
  }));
});

export default PaymentLog;
