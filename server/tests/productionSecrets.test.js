import test from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

// La garde de JWT_SECRET s'exécute au chargement du module : on charge
// auth.js dans un processus séparé pour observer le démarrage réel.
const serverRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

function loadAuth(env) {
  const result = spawnSync(process.execPath, ['--input-type=module', '-e', "await import('./src/middleware/auth.js')"], {
    cwd: serverRoot,
    env: { ...process.env, ...env },
    encoding: 'utf8',
  });
  return { ok: result.status === 0, stderr: result.stderr };
}

test('production : démarrage refusé si JWT_SECRET est absent', () => {
  const { ok, stderr } = loadAuth({ NODE_ENV: 'production', JWT_SECRET: '' });
  assert.equal(ok, false);
  assert.match(stderr, /JWT_SECRET doit être défini/);
});

test('production : démarrage refusé si JWT_SECRET fait moins de 32 caractères', () => {
  const { ok, stderr } = loadAuth({ NODE_ENV: 'production', JWT_SECRET: 'trop_court' });
  assert.equal(ok, false);
  assert.match(stderr, /32 caractères minimum/);
});

test('production : démarrage refusé avec la valeur d\'exemple de .env.example', () => {
  const { ok, stderr } = loadAuth({ NODE_ENV: 'production', JWT_SECRET: 'change_me_generate_a_long_random_string' });
  assert.equal(ok, false);
  assert.match(stderr, /valeur d'exemple publique/);
});

test('production : démarrage accepté avec un secret aléatoire', () => {
  const { ok, stderr } = loadAuth({ NODE_ENV: 'production', JWT_SECRET: 'q7Vx2LpR9sKe4TnW8yBc3HfJ6mZa1UdG5oQi0NrE' });
  assert.equal(ok, true, stderr);
});

test('développement : un JWT_SECRET absent reste toléré (secret de dev)', () => {
  const { ok, stderr } = loadAuth({ NODE_ENV: 'development', JWT_SECRET: '' });
  assert.equal(ok, true, stderr);
});
