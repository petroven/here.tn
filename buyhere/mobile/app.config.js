// Configuration Expo dynamique : reprend app.json et n'y change qu'une chose.
//
// Le trafic HTTP en clair (usesCleartextTraffic) sert uniquement au
// développement, quand l'app parle à `http://<IP-du-PC>:5000/api`. Une build de
// production n'appelle que l'API HTTPS : elle le désactive. Est considérée
// comme production une build EAS du profil `production` (EAS_BUILD_PROFILE),
// ou toute génération lancée avec APP_ENV=production (build locale).
function estProduction(env = process.env) {
  return env.EAS_BUILD_PROFILE === 'production' || env.APP_ENV === 'production';
}

module.exports = ({ config }) => ({
  ...config,
  plugins: (config.plugins || []).map((plugin) => {
    if (!Array.isArray(plugin) || plugin[0] !== 'expo-build-properties') return plugin;
    const [nom, options = {}] = plugin;
    return [nom, { ...options, android: { ...options.android, usesCleartextTraffic: !estProduction() } }];
  }),
});
module.exports.estProduction = estProduction;
