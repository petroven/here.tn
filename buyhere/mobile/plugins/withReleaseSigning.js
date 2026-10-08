// Signature de l'APK / AAB de production avec la clé BuyHere.
//
// Le dossier android/ est régénéré par `expo prebuild` : on ne le modifie donc
// pas à la main, ce plugin ajoute la configuration à chaque génération.
// Les secrets ne sont jamais dans le dépôt : ils sont lus dans le
// gradle.properties de l'utilisateur (~/.gradle/gradle.properties) :
//   BUYHERE_UPLOAD_STORE_FILE, BUYHERE_UPLOAD_KEY_ALIAS,
//   BUYHERE_UPLOAD_STORE_PASSWORD, BUYHERE_UPLOAD_KEY_PASSWORD
// Sans ces valeurs, la build release retombe sur la clé de test (debug).
const { withAppBuildGradle } = require('expo/config-plugins');

const MARQUEUR = '// buyhere-release-signing';

module.exports = function withReleaseSigning(config) {
  return withAppBuildGradle(config, (cfg) => {
    let gradle = cfg.modResults.contents;
    if (gradle.includes(MARQUEUR)) return cfg;

    gradle = gradle.replace(
      /signingConfigs\s*\{/,
      `signingConfigs {
        ${MARQUEUR}
        release {
            if (project.hasProperty('BUYHERE_UPLOAD_STORE_FILE')) {
                storeFile file(BUYHERE_UPLOAD_STORE_FILE)
                storePassword BUYHERE_UPLOAD_STORE_PASSWORD
                keyAlias BUYHERE_UPLOAD_KEY_ALIAS
                keyPassword BUYHERE_UPLOAD_KEY_PASSWORD
            }
        }`,
    );
    // Build release : clé BuyHere si elle est configurée, sinon clé de test.
    gradle = gradle.replace(
      /(release\s*\{[^}]*?)signingConfig signingConfigs\.debug/,
      "$1signingConfig project.hasProperty('BUYHERE_UPLOAD_STORE_FILE') ? signingConfigs.release : signingConfigs.debug",
    );
    cfg.modResults.contents = gradle;
    return cfg;
  });
};
