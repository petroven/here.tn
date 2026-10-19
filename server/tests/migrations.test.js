// Migrations versionnées (config/migrations.js, server/migrations/) sur
// SQLite, et sur PostgreSQL quand TEST_POSTGRES_URL est défini (job CI dédié).
// Chaque cas repart de tables vides créées à la main, telles qu'une base
// ancienne les a laissées : colonnes présentes, contraintes d'unicité absentes.
import { test, describe, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { Sequelize } from 'sequelize';
import { up, down } from '../migrations/0002-contraintes-uniques.js';
import { appliquerMigrations } from '../src/config/migrations.js';

const DIALECTES = [['sqlite', () => new Sequelize({ dialect: 'sqlite', storage: ':memory:', logging: false })]];
if (process.env.TEST_POSTGRES_URL) {
  DIALECTES.push(['postgres', () => new Sequelize(process.env.TEST_POSTGRES_URL, { dialect: 'postgres', logging: false })]);
}

for (const [dialecte, creer] of DIALECTES) {
  describe(`migrations — ${dialecte}`, () => {
    let sequelize;
    let qi;

    before(async () => {
      sequelize = creer();
      qi = sequelize.getQueryInterface();
    });

    after(async () => {
      await sequelize.close();
    });

    // Tables « anciennes » : colonnes ajoutées après coup, donc sans contrainte.
    async function baseAncienne() {
      for (const table of ['Commandes', 'Transactions', 'Wishlists', 'SequelizeMeta']) await qi.dropTable(table);
      await sequelize.query('CREATE TABLE "Commandes" ("id" INTEGER PRIMARY KEY, "numeroCommande" VARCHAR(255), "confirmationToken" VARCHAR(255))');
      await sequelize.query('CREATE TABLE "Transactions" ("id" INTEGER PRIMARY KEY, "providerReference" VARCHAR(255), "idempotencyKey" VARCHAR(255))');
      await sequelize.query('CREATE TABLE "Wishlists" ("id" INTEGER PRIMARY KEY, "utilisateurId" INTEGER, "produitId" INTEGER)');
    }

    const inserer = (table, valeurs) => {
      const colonnes = Object.keys(valeurs);
      return sequelize.query(
        `INSERT INTO "${table}" (${colonnes.map((c) => `"${c}"`).join(', ')}) VALUES (${colonnes.map(() => '?').join(', ')})`,
        { replacements: Object.values(valeurs) },
      );
    };

    const unique = async (table, colonnes) => (await qi.showIndex(table)).some((i) => i.unique
      && i.fields.map((f) => f.attribute).join(',') === colonnes.join(','));

    test('base ancienne : contraintes d’unicité ajoutées, doublons ensuite refusés', async () => {
      await baseAncienne();
      await inserer('Commandes', { id: 1, numeroCommande: 'CMD-1' });
      await inserer('Commandes', { id: 2, numeroCommande: null });
      await inserer('Commandes', { id: 3, numeroCommande: null }); // plusieurs NULL restent permis

      await up({ context: qi });

      assert.ok(await unique('Commandes', ['numeroCommande']));
      assert.ok(await unique('Commandes', ['confirmationToken']));
      assert.ok(await unique('Transactions', ['providerReference']));
      assert.ok(await unique('Transactions', ['idempotencyKey']));
      assert.ok(await unique('Wishlists', ['utilisateurId', 'produitId']));
      await assert.rejects(inserer('Commandes', { id: 4, numeroCommande: 'CMD-1' }), 'doublon de numéro de commande accepté');
      await assert.rejects(inserer('Transactions', { id: 1, idempotencyKey: 'k' }).then(() => inserer('Transactions', { id: 2, idempotencyKey: 'k' })));
    });

    test('idempotente : un second passage ne recrée rien et ne lève pas d’erreur', async () => {
      const avant = (await qi.showIndex('Commandes')).length;
      await up({ context: qi });
      assert.equal((await qi.showIndex('Commandes')).length, avant);
    });

    test('doublons existants : échec explicite, aucune contrainte créée', async () => {
      await baseAncienne();
      await inserer('Transactions', { id: 1, providerReference: 'KNK-9' });
      await inserer('Transactions', { id: 2, providerReference: 'KNK-9' });

      await assert.rejects(up({ context: qi }), (error) => {
        assert.match(error.message, /Doublons à corriger/);
        assert.match(error.message, /Transactions\(providerReference\) : KNK-9 ×2/);
        return true;
      });
      assert.equal(await unique('Commandes', ['numeroCommande']), false, 'contrainte créée malgré l’échec (tout ou rien)');
    });

    test('down : retire les index créés par la migration', async () => {
      await baseAncienne();
      await up({ context: qi });
      await down({ context: qi });
      assert.equal(await unique('Commandes', ['numeroCommande']), false);
    });

    test('lanceur : migrations tracées dans SequelizeMeta, rien de rejoué au démarrage suivant', async () => {
      await baseAncienne();
      const premieres = await appliquerMigrations(sequelize);
      assert.deepEqual(premieres.map((m) => m.name), ['0001-baseline.js', '0002-contraintes-uniques.js']);
      const tracees = await sequelize.query('SELECT "name" FROM "SequelizeMeta" ORDER BY "name"', { type: Sequelize.QueryTypes.SELECT });
      assert.deepEqual(tracees.map((r) => r.name), ['0001-baseline.js', '0002-contraintes-uniques.js']);
      assert.deepEqual(await appliquerMigrations(sequelize), []);
    });
  });
}
