// Migrations versionnées (Umzug). Chaque fichier de server/migrations/ est
// appliqué une seule fois et tracé dans la table SequelizeMeta. Exécutées par
// syncDatabase() après sequelize.sync() et le complément de colonnes : une
// migration peut donc compter sur l'existence des colonnes déclarées dans les
// modèles, et sert à ce que ce complément ne sait pas faire (contraintes,
// index, données, renommages) — voir DOCUMENTATION.md §15.
import path from 'path';
import { fileURLToPath, pathToFileURL } from 'url';
import { Umzug, SequelizeStorage } from 'umzug';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
export const DOSSIER_MIGRATIONS = path.resolve(__dirname, '../../migrations');

export function creerMigrateur(sequelize, { dossier = DOSSIER_MIGRATIONS } = {}) {
  return new Umzug({
    migrations: {
      glob: ['*.js', { cwd: dossier }],
      // Fichiers ES modules : chargés par import() plutôt que require().
      resolve: ({ name, path: fichier, context }) => {
        const charger = () => import(pathToFileURL(fichier).href);
        return {
          name,
          up: async () => (await charger()).up({ context }),
          down: async () => (await charger()).down({ context }),
        };
      },
    },
    context: sequelize.getQueryInterface(),
    storage: new SequelizeStorage({ sequelize }),
    logger: {
      info: (evenement) => {
        if (evenement?.event === 'migrated') console.log(`[MIGRATION] ${evenement.name} appliquée.`);
      },
      warn: (message) => console.warn('[MIGRATION]', message),
      error: (message) => console.error('[MIGRATION]', message),
      debug: () => {},
    },
  });
}

/** Applique les migrations en attente ; renvoie la liste des migrations appliquées. */
export async function appliquerMigrations(sequelize, options) {
  return creerMigrateur(sequelize, options).up();
}
