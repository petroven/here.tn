// Notifications opérationnelles (SMS, push Expo, configuration email) : un
// échec doit être journalisé et renvoyé comme un échec, jamais comme un
// succès, et ne jamais lever d'exception (l'action métier est déjà faite).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import os from 'node:os';
import path from 'node:path';

process.env.SQLITE_STORAGE = path.join(os.tmpdir(), `heretn-notif-${process.pid}.db`);

const SMS_VARS = ['NODE_ENV', 'SMS_PROVIDER', 'TWILIO_ACCOUNT_SID', 'TWILIO_AUTH_TOKEN', 'TWILIO_PHONE_NUMBER', 'WINSMS_API_KEY', 'SMTP_HOST', 'SMTP_USER', 'SMTP_PASS', 'PUSH_NOTIFICATIONS'];

// Exécute fn avec un environnement, un fetch simulé et la console capturée.
async function avec({ env = {}, fetchImpl } = {}, fn) {
  const saved = Object.fromEntries(SMS_VARS.map((k) => [k, process.env[k]]));
  const originalFetch = globalThis.fetch;
  const originals = { error: console.error, warn: console.warn, log: console.log };
  const logs = [];
  for (const k of SMS_VARS) delete process.env[k];
  Object.assign(process.env, env);
  globalThis.fetch = fetchImpl || (async () => { throw new Error('fetch inattendu'); });
  for (const level of ['error', 'warn', 'log']) console[level] = (...args) => logs.push({ level, text: args.join(' ') });
  try {
    return await fn(logs);
  } finally {
    globalThis.fetch = originalFetch;
    Object.assign(console, originals);
    for (const [k, v] of Object.entries(saved)) {
      if (v === undefined) delete process.env[k];
      else process.env[k] = v;
    }
  }
}

const reponse = (status, body) => ({ ok: status >= 200 && status < 300, status, json: async () => body });
const TWILIO = { SMS_PROVIDER: 'twilio', TWILIO_ACCOUNT_SID: 'ACtest', TWILIO_AUTH_TOKEN: 'tok', TWILIO_PHONE_NUMBER: '+15005550006' };

test('SMS mock en production : pas de faux succès, avertissement journalisé', async () => {
  const { sendSMS, smsConfigWarning } = await import('../src/utils/sms.js');
  await avec({ env: { NODE_ENV: 'production', SMS_PROVIDER: 'mock' } }, async (logs) => {
    const r = await sendSMS({ to: '+21622123456', message: 'test' });
    assert.equal(r.success, false);
    assert.ok(logs.some((l) => l.level === 'warn' && /Non envoyé/.test(l.text)));
    assert.match(smsConfigWarning(), /aucun SMS réel/);
  });
});

test('SMS mock en développement : simulé et signalé comme mock', async () => {
  const { sendSMS, smsConfigWarning } = await import('../src/utils/sms.js');
  await avec({ env: { NODE_ENV: 'development' } }, async () => {
    const r = await sendSMS({ to: '+21622123456', message: 'test' });
    assert.equal(r.success, true);
    assert.equal(r.mock, true);
    assert.equal(smsConfigWarning(), null);
  });
});

test('SMS : fournisseur réel sans identifiants → échec, plus de repli silencieux sur le mock', async () => {
  const { sendSMS, smsConfigWarning } = await import('../src/utils/sms.js');
  for (const provider of ['twilio', 'winsms', 'inconnu']) {
    await avec({ env: { NODE_ENV: 'production', SMS_PROVIDER: provider } }, async (logs) => {
      const r = await sendSMS({ to: '+21622123456', message: 'test' });
      assert.equal(r.success, false, provider);
      assert.notEqual(r.mock, true, `${provider} : repli silencieux sur le mock`);
      assert.ok(logs.some((l) => l.level === 'error' && /\[SMS\] Échec/.test(l.text)), provider);
      assert.ok(smsConfigWarning(), provider);
    });
  }
});

test('SMS : refus HTTP du fournisseur → échec journalisé', async () => {
  const { sendSMS } = await import('../src/utils/sms.js');
  await avec({ env: TWILIO, fetchImpl: async () => reponse(400, { message: 'invalid number' }) }, async (logs) => {
    const r = await sendSMS({ to: '+21622123456', message: 'test' });
    assert.equal(r.success, false);
    assert.equal(r.error, 'HTTP 400');
    assert.ok(logs.some((l) => l.level === 'error' && /HTTP 400/.test(l.text)));
  });
});

test('SMS : erreur réseau ou réponse non JSON → échec, sans exception', async () => {
  const { sendSMS, smsStatutLivraison } = await import('../src/utils/sms.js');
  await avec({ env: TWILIO, fetchImpl: async () => { throw new Error('ECONNRESET'); } }, async () => {
    const r = await smsStatutLivraison('+21622123456', 'TRK-1', 'livre');
    assert.equal(r.success, false);
    assert.match(r.error, /ECONNRESET/);
  });
  await avec({ env: TWILIO, fetchImpl: async () => ({ ok: false, status: 502, json: async () => { throw new SyntaxError('Unexpected token <'); } }) }, async () => {
    const r = await sendSMS({ to: '+21622123456', message: 'test' });
    assert.equal(r.success, false);
  });
});

test('SMS : envoi accepté par le fournisseur → succès', async () => {
  const { sendSMS } = await import('../src/utils/sms.js');
  await avec({ env: TWILIO, fetchImpl: async () => reponse(201, { sid: 'SM1' }) }, async () => {
    const r = await sendSMS({ to: '+21622123456', message: 'test' });
    assert.equal(r.success, true);
  });
});

test('push Expo : refus HTTP et tickets en erreur journalisés, non comptés comme envoyés', async () => {
  const { envoyerPushExpo } = await import('../src/utils/notifications.js');
  const tokens = [{ token: 'ExponentPushToken[a]' }, { token: 'ExponentPushToken[b]' }];
  const payload = { titre: 'T', message: 'M' };

  await avec({ env: { NODE_ENV: 'development' }, fetchImpl: async () => reponse(500, { errors: [{ message: 'boom' }] }) }, async (logs) => {
    assert.equal(await envoyerPushExpo(tokens, payload), 0);
    assert.ok(logs.some((l) => l.level === 'error' && /HTTP 500/.test(l.text)));
  });

  const tickets = { data: [{ status: 'ok', id: '1' }, { status: 'error', message: 'trop gros', details: { error: 'MessageTooBig' } }] };
  await avec({ env: { NODE_ENV: 'development' }, fetchImpl: async () => reponse(200, tickets) }, async (logs) => {
    assert.equal(await envoyerPushExpo(tokens, payload), 1);
    assert.ok(logs.some((l) => l.level === 'error' && /MessageTooBig/.test(l.text)));
  });

  await avec({ env: { NODE_ENV: 'development' }, fetchImpl: async () => { throw new Error('réseau coupé'); } }, async (logs) => {
    assert.equal(await envoyerPushExpo(tokens, payload), 0);
    assert.ok(logs.some((l) => l.level === 'error' && /réseau coupé/.test(l.text)));
  });
});

test('email : configuration SMTP manquante signalée en production uniquement', async () => {
  const { emailConfigWarning } = await import('../src/utils/email.js');
  await avec({ env: { NODE_ENV: 'production' } }, async () => assert.match(emailConfigWarning(), /SMTP_HOST absent/));
  await avec({ env: { NODE_ENV: 'production', SMTP_HOST: 'smtp.example.com' } }, async () => assert.match(emailConfigWarning(), /SMTP_USER\/SMTP_PASS/));
  await avec({ env: { NODE_ENV: 'production', SMTP_HOST: 'smtp.example.com', SMTP_USER: 'u', SMTP_PASS: 'p' } }, async () => assert.equal(emailConfigWarning(), null));
  await avec({ env: { NODE_ENV: 'development' } }, async () => assert.equal(emailConfigWarning(), null));
});
