// Révocation des sessions (tokenVersion) et rôle relu en base à chaque requête.
//
// Lancer : npm test (depuis server/)
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import jwt from 'jsonwebtoken';
import { startTestServer, stopTestServer, api, login, DEMO_ADMIN } from './helpers.js';

let models;

before(async () => {
  await startTestServer({ db: 'test-auth-revocation' });
  models = await import('../src/models/index.js');
});

after(async () => {
  await stopTestServer();
});

async function nouveauCompte(password = 'Session2026') {
  const email = `session.${Date.now()}.${Math.random().toString(36).slice(2, 7)}@here.tn`;
  const r = await api('/api/auth/register', {
    method: 'POST', body: { nom: 'Test', prenom: 'Session', email, password, accepteConditions: true },
  });
  assert.equal(r.status, 201, JSON.stringify(r.json));
  return { email, password, id: r.json.user.id };
}

const statutMe = async (token) => (await api('/api/users/me', { token })).status;

test('changement de mot de passe : autres sessions révoquées, la session courante continue avec le nouveau jeton', async () => {
  const compte = await nouveauCompte();
  const telephone = (await login(compte)).token;
  await new Promise((r) => setTimeout(r, 1100)); // iat différent → jeton distinct
  const ordinateur = (await login(compte)).token;

  const r = await api('/api/users/me/password', {
    method: 'PATCH', token: ordinateur, body: { currentPassword: compte.password, newPassword: 'Nouveau2026' },
  });
  assert.equal(r.status, 200, JSON.stringify(r.json));
  assert.ok(r.json.token, 'nouveau jeton renvoyé');

  assert.equal(await statutMe(telephone), 401, 'autre appareil toujours connecté');
  assert.equal(await statutMe(ordinateur), 401, 'ancien jeton de la session courante encore valide');
  assert.equal(await statutMe(r.json.token), 200, 'nouveau jeton refusé');
  assert.equal((await api('/api/auth/login', { method: 'POST', body: { email: compte.email, password: 'Nouveau2026' } })).status, 200);
});

test('réinitialisation par email : toutes les sessions révoquées', async () => {
  const compte = await nouveauCompte();
  const token = (await login(compte)).token;
  await models.PasswordResetToken.create({ token: `reset-${compte.id}-${Date.now()}`, expiresAt: new Date(Date.now() + 3600000), utilisateurId: compte.id });
  const reset = await models.PasswordResetToken.findOne({ where: { utilisateurId: compte.id } });

  const r = await api('/api/auth/reset-password', { method: 'POST', body: { token: reset.token, password: 'Reinit2026' } });
  assert.equal(r.status, 200, JSON.stringify(r.json));
  assert.equal(await statutMe(token), 401);
});

test('« déconnecter tous les appareils » : jeton courant et autres révoqués', async () => {
  const compte = await nouveauCompte();
  const token = (await login(compte)).token;
  const r = await api('/api/auth/logout-all', { method: 'POST', token });
  assert.equal(r.status, 200);
  assert.equal(await statutMe(token), 401);
  assert.equal(await statutMe((await login(compte)).token), 200, 'nouvelle connexion impossible');
});

test('rôle relu en base : un rôle retiré prend effet immédiatement, sans attendre l’expiration du jeton', async () => {
  const compte = await nouveauCompte();
  await models.Utilisateur.update({ role: 'administrateur' }, { where: { id: compte.id } });
  const token = (await login(compte)).token;
  assert.equal((await api('/api/admin/stats', { token })).status, 200);

  await models.Utilisateur.update({ role: 'client' }, { where: { id: compte.id } });
  assert.equal((await api('/api/admin/stats', { token })).status, 403, 'droits admin conservés avec un jeton périmé');
  assert.equal(await statutMe(token), 200, 'la session elle-même reste valide');
});

test('jeton émis avant tokenVersion (sans claim tv) : accepté, personne n’est déconnecté au déploiement', async () => {
  const admin = await login(DEMO_ADMIN);
  const ancien = jwt.sign({ id: admin.user.id, email: admin.user.email, role: admin.user.role }, process.env.JWT_SECRET, { expiresIn: '7d' });
  assert.equal(await statutMe(ancien), 200);
});

test('jeton signé avec un autre secret : refusé', async () => {
  const faux = jwt.sign({ id: 1, role: 'super_admin', tv: 0 }, 'autre_secret');
  assert.equal(await statutMe(faux), 401);
});
