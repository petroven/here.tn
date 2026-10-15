// Configuration de publication : identifiants cohérents entre iOS, Android et
// le serveur (assetlinks.json), builds EAS vers une API HTTPS, et signature
// release qui annonce explicitement le repli sur la clé de debug.
import { describe, expect, it } from '@jest/globals';
import fs from 'fs';
import path from 'path';
import appJson from '../app.json';
import easJson from '../eas.json';

const { ajouterSignatureRelease, AVERTISSEMENT } = require('../plugins/withReleaseSigning') as {
  ajouterSignatureRelease: (gradle: string) => string;
  AVERTISSEMENT: string;
};

// Extrait représentatif du android/app/build.gradle généré par `expo prebuild`.
const GRADLE_EXPO = `android {
    signingConfigs {
        debug {
            storeFile file('debug.keystore')
            storePassword 'android'
            keyAlias 'androiddebugkey'
            keyPassword 'android'
        }
    }
    buildTypes {
        debug {
            signingConfig signingConfigs.debug
        }
        release {
            // Caution! In production, you need to generate your own keystore file.
            signingConfig signingConfigs.debug
            minifyEnabled enableProguardInReleaseBuilds
        }
    }
}`;

describe('identifiants de l’application', () => {
  it('même identifiant iOS et Android', () => {
    expect(appJson.expo.android.package).toBe('tn.buyhere.app');
    expect(appJson.expo.ios.bundleIdentifier).toBe(appJson.expo.android.package);
  });

  it('le serveur publie assetlinks.json pour ce même package par défaut', () => {
    const source = fs.readFileSync(path.resolve(__dirname, '../../../server/src/routes/appLinkRoutes.js'), 'utf8');
    expect(source).toContain(`process.env.ANDROID_APP_PACKAGE || '${appJson.expo.android.package}'`);
  });

  it('les liens d’app Android sont vérifiés (autoVerify)', () => {
    expect(appJson.expo.android.intentFilters.every((f: { autoVerify?: boolean }) => f.autoVerify === true)).toBe(true);
  });
});

describe('profils EAS', () => {
  it.each(['preview', 'production'] as const)('%s : API en HTTPS', (profil) => {
    const url = easJson.build[profil].env.EXPO_PUBLIC_API_URL;
    expect(url).toMatch(/^https:\/\/[^/]+\/api$/);
  });

  it('production : même API que .env.production', () => {
    const env = fs.readFileSync(path.resolve(__dirname, '../.env.production'), 'utf8');
    expect(env).toContain(`EXPO_PUBLIC_API_URL=${easJson.build.production.env.EXPO_PUBLIC_API_URL}`);
  });
});

describe('versions et HTTP en clair', () => {
  const appConfig = require('../app.config.js') as (args: { config: typeof appJson.expo }) => typeof appJson.expo;
  const cleartext = (env: Record<string, string | undefined>) => {
    const sauvegarde = { EAS_BUILD_PROFILE: process.env.EAS_BUILD_PROFILE, APP_ENV: process.env.APP_ENV };
    delete process.env.EAS_BUILD_PROFILE;
    delete process.env.APP_ENV;
    Object.assign(process.env, env);
    try {
      const plugin = appConfig({ config: appJson.expo }).plugins.find(
        (p: unknown) => Array.isArray(p) && p[0] === 'expo-build-properties',
      ) as [string, { android: { usesCleartextTraffic: boolean } }];
      return plugin[1].android.usesCleartextTraffic;
    } finally {
      for (const [cle, valeur] of Object.entries(sauvegarde)) {
        if (valeur === undefined) delete process.env[cle];
        else process.env[cle] = valeur;
      }
    }
  };

  it('build EAS production : HTTP en clair désactivé', () => {
    expect(cleartext({ EAS_BUILD_PROFILE: 'production' })).toBe(false);
  });

  it('build locale de production (APP_ENV=production) : HTTP en clair désactivé', () => {
    expect(cleartext({ APP_ENV: 'production' })).toBe(false);
  });

  it('développement et profil preview : HTTP en clair autorisé (API sur l’IP du PC)', () => {
    expect(cleartext({})).toBe(true);
    expect(cleartext({ EAS_BUILD_PROFILE: 'preview' })).toBe(true);
  });

  it('app.config.js ne change rien d’autre que cette option', () => {
    const resultat = appConfig({ config: appJson.expo });
    expect({ ...resultat, plugins: undefined }).toEqual({ ...appJson.expo, plugins: undefined });
    expect(resultat.plugins).toHaveLength(appJson.expo.plugins.length);
  });

  it('numéros de version gérés par EAS et incrémentés à chaque build de production', () => {
    expect(easJson.cli.appVersionSource).toBe('remote');
    expect((easJson.build.production as { autoIncrement?: boolean }).autoIncrement).toBe(true);
  });
});

describe('signature release (plugins/withReleaseSigning)', () => {
  const resultat = ajouterSignatureRelease(GRADLE_EXPO);

  it('la build release utilise la clé BuyHere quand elle est configurée', () => {
    expect(resultat).toMatch(/release \{\s*\/\/ Caution![^\n]*\n\s*signingConfig project\.hasProperty\('BUYHERE_UPLOAD_STORE_FILE'\) \? signingConfigs\.release : signingConfigs\.debug/);
  });

  it('la build debug reste signée avec la clé de debug', () => {
    expect(resultat).toMatch(/debug \{\s*signingConfig signingConfigs\.debug\s*\}/);
  });

  it('sans clé : avertissement Gradle explicite (pas de repli silencieux)', () => {
    expect(resultat).toContain(`logger.warn("${AVERTISSEMENT}")`);
    expect(AVERTISSEMENT).toMatch(/non publiable/);
  });

  it('aucun secret dans la configuration générée', () => {
    expect(resultat).not.toMatch(/storePassword ['"][^'"]+['"]\s*\n\s*keyAlias BUYHERE/);
    expect(resultat).toContain('storePassword BUYHERE_UPLOAD_STORE_PASSWORD');
  });

  it('idempotent : un second prebuild ne duplique rien', () => {
    expect(ajouterSignatureRelease(resultat)).toBe(resultat);
  });
});
