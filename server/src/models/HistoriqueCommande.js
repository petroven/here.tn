import { DataTypes } from 'sequelize';
import sequelize from '../config/database.js';

// Journal immuable de chaque transition de Commande.statut (et des
// événements notables sans changement de statut, ex: confirmation COD par le
// client) — alimente la chronologie affichée au client, au vendeur et à
// l'admin. Écrit exclusivement par utils/orderStatus.js.
// Statuts en STRING (pas ENUM) : l'historique doit rester lisible même si
// la liste des statuts évolue un jour.
const HistoriqueCommande = sequelize.define('HistoriqueCommande', {
  id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
  ancienStatut: { type: DataTypes.STRING, allowNull: true }, // null = création de la commande
  nouveauStatut: { type: DataTypes.STRING, allowNull: false },
  // null = action système (webhook de paiement, invité, tâche automatique)
  utilisateurId: { type: DataTypes.INTEGER, allowNull: true },
  commentaire: { type: DataTypes.STRING, allowNull: true },
}, {
  indexes: [{ fields: ['commandeId'] }],
});

export default HistoriqueCommande;
