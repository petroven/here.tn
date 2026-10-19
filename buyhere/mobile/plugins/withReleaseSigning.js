// Signature de l'APK / AAB de production avec la clé BuyHere.
//
// Le dossier android/ est régénéré par `expo prebuild` : on ne le modifie donc
// pas à la main, ce plugin ajoute la configuration à chaque génération.
// Les secrets ne sont jamais dans le dépôt : ils sont lus dans le
// gradle.properties de l'utilisateur (~/.gradle/gradle.properties) :
//   BUYHERE_UPLOAD_STORE_FILE, BUYHERE_UPLOAD_KEY_ALIAS,
//   BUYHERE_UPLOAD_STORE_PASSWORD, BUYHERE_UPLOAD_KEY_PASSWORD
// Sans ces valeurs, la build release retombe sur la clé de test (debug) — utile
// pour un APK de test, mais non publiable sur le Play Store et incompatible
// avec les App Links : Gradle l'annonce alors par un avertissement explicite.
const { withAppBuildGradle } = require('expo/config-plugins');

const MARQUEUR = '// buyhere-release-signing';
const AVERTISSEMENT = 'BuyHere : BUYHERE_UPLOAD_STORE_FILE absent, la build release est signée avec la clé de debug (APK de test, non publiable).';

/** Ajoute la signature BuyHere au build.gradle généré (idempotent). */
function ajouterSignatureRelease(gradle) {
  if (gradle.includes(MARQUEUR)) return gradle;

  let resultat = gradle.replace(
    /signingConfigs\s*\{/,
    `signingConfigs {
        ${MARQUEUR}
        release {
            if (project.hasProperty('BUYHERE_UPLOAD_STORE_FILE')) {
                storeFile file(BUYHERE_UPLOAD_STORE_FILE)
                storePassword BUYHERE_UPLOAD_STORE_PASSWORD
                keyAlias BUYHERE_UPLOAD_KEY_ALIAS
                keyPassword BUYHERE_UPLOAD_KEY_PASSWORD
            } else {
                logger.warn("${AVERTISSEMENT}")
            }
        }`,
  );
  // Build release : clé BuyHere si elle est configurée, sinon clé de test.
  resultat = resultat.replace(
    /(release\s*\{[^}]*?)signingConfig signingConfigs\.debug/,
    "$1signingConfig project.hasProperty('BUYHERE_UPLOAD_STORE_FILE') ? signingConfigs.release : signingConfigs.debug",
  );
  return resultat;
}

module.exports = function withReleaseSigning(config) {
  return withAppBuildGradle(config, (cfg) => {
    cfg.modResults.contents = ajouterSignatureRelease(cfg.modResults.contents);
    return cfg;
  });
};
module.exports.ajouterSignatureRelease = ajouterSignatureRelease;
module.exports.AVERTISSEMENT = AVERTISSEMENT;
