// Contraintes d'unicité et index déclarés dans les modèles mais absents des
// bases créées avant leur déclaration : le complément de colonnes de
// syncDatabase() ajoute une colonne sans `unique` ni index (DOCUMENTATION.md
// §15.2). Pour chaque entrée : table ou colonne absente → ignorée ; index
// équivalent déjà présent (base récente) → rien à faire ; doublons → échec
// explicite, sans rien modifier, pour qu'ils soient traités à la main.
//
// Liste figée au 2026-10-14 (une migration ne doit pas dépendre des modèles
// futurs) — toute nouvelle contrainte passe par une nouvelle migration.
export const UNIQUES = [
  ['Utilisateurs', ['email']],
  ['Gouvernorats', ['nom']],
  ['Categories', ['slug']],
  ['Produits', ['reference']],
  ['Commandes', ['numeroCommande']],
  ['Commandes', ['confirmationToken']],
  ['Transactions', ['providerReference']],
  ['Transactions', ['idempotencyKey']],
  ['Livraisons', ['trackingId']],
  ['Coupons', ['code']],
  ['PasswordResetTokens', ['token']],
  ['PushTokens', ['token']],
  ['Wishlists', ['utilisateurId', 'produitId']],
];

export const INDEX = [
  ['HistoriqueCommandes', ['commandeId']],
  ['Notifications', ['utilisateurId', 'lu']],
  ['AuditLogs', ['entite', 'entiteId']],
  ['AuditLogs', ['acteurId']],
];

const nomIndex = (table, colonnes, unique) => `${table}_${colonnes.join('_')}_${unique ? 'uniq' : 'idx'}`;

async function colonnesPresentes(queryInterface, tables, table, colonnes) {
  if (!tables.includes(table)) return false;
  const description = await queryInterface.describeTable(table);
  return colonnes.every((c) => description[c]);
}

async function indexEquivalent(queryInterface, table, colonnes, unique) {
  const index = await queryInterface.showIndex(table);
  return index.some((i) => {
    const champs = (i.fields || []).map((f) => f.attribute);
    return (!unique || i.unique) && champs.length === colonnes.length && colonnes.every((c, n) => champs[n] === c);
  });
}

async function doublons(queryInterface, table, colonnes) {
  const q = (identifiant) => queryInterface.quoteIdentifier(identifiant);
  const liste = colonnes.map(q).join(', ');
  const nonNuls = colonnes.map((c) => `${q(c)} IS NOT NULL`).join(' AND ');
  return queryInterface.sequelize.query(
    `SELECT ${liste}, COUNT(*) AS n FROM ${q(table)} WHERE ${nonNuls} GROUP BY ${liste} HAVING COUNT(*) > 1 LIMIT 5`,
    { type: queryInterface.sequelize.QueryTypes.SELECT },
  );
}

async function tablesExistantes(queryInterface) {
  return (await queryInterface.showAllTables()).map((t) => (typeof t === 'string' ? t : t.tableName));
}

export async function up({ context: queryInterface }) {
  const tables = await tablesExistantes(queryInterface);
  const aCreer = [];
  const conflits = [];

  for (const [liste, unique] of [[UNIQUES, true], [INDEX, false]]) {
    for (const [table, colonnes] of liste) {
      if (!(await colonnesPresentes(queryInterface, tables, table, colonnes))) continue;
      if (await indexEquivalent(queryInterface, table, colonnes, unique)) continue;
      if (unique) {
        const lignes = await doublons(queryInterface, table, colonnes);
        if (lignes.length) {
          conflits.push(`${table}(${colonnes.join(', ')}) : ${lignes.map((l) => `${colonnes.map((c) => l[c]).join('/')} ×${l.n}`).join(', ')}`);
          continue;
        }
      }
      aCreer.push({ table, colonnes, unique });
    }
  }

  // Tout ou rien : aucun index n'est créé tant qu'un doublon subsiste.
  if (conflits.length) {
    throw new Error(`Doublons à corriger avant d'ajouter les contraintes d'unicité — ${conflits.join(' ; ')}`);
  }
  for (const { table, colonnes, unique } of aCreer) {
    await queryInterface.addIndex(table, colonnes, { unique, name: nomIndex(table, colonnes, unique) });
  }
}

export async function down({ context: queryInterface }) {
  const tables = await tablesExistantes(queryInterface);
  for (const [liste, unique] of [[UNIQUES, true], [INDEX, false]]) {
    for (const [table, colonnes] of liste) {
      if (!tables.includes(table)) continue;
      const nom = nomIndex(table, colonnes, unique);
      const index = await queryInterface.showIndex(table);
      if (index.some((i) => i.name === nom)) await queryInterface.removeIndex(table, nom);
    }
  }
}
