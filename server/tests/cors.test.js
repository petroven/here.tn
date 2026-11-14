import test from 'node:test';
import assert from 'node:assert/strict';
import { corsOptions } from '../src/config/cors.js';

const verifier = (origin) => new Promise((resolve) => {
  corsOptions.origin(origin, (err, ok) => resolve(!err && ok === true));
});

test('CORS : buyhere.tn et buyhere.com (avec et sans www) sont autorisés en production', async () => {
  const avant = { NODE_ENV: process.env.NODE_ENV, CLIENT_URL: process.env.CLIENT_URL };
  process.env.NODE_ENV = 'production';
  process.env.CLIENT_URL = 'https://buyhere.tn';
  try {
    for (const origin of ['https://buyhere.tn', 'https://www.buyhere.tn', 'https://buyhere.com', 'https://www.buyhere.com']) {
      assert.equal(await verifier(origin), true, origin);
    }
    assert.equal(await verifier('https://evil.example'), false);
    assert.equal(await verifier('http://localhost:5173'), false);
  } finally {
    for (const [k, v] of Object.entries(avant)) { if (v === undefined) delete process.env[k]; else process.env[k] = v; }
  }
});

test('CORS : CLIENT_URLS ajoute des origines supplémentaires', async () => {
  const avant = process.env.CLIENT_URLS;
  process.env.CLIENT_URLS = 'https://a.example, https://b.example/';
  try {
    assert.equal(await verifier('https://a.example'), true);
    assert.equal(await verifier('https://b.example'), true);
  } finally {
    if (avant === undefined) delete process.env.CLIENT_URLS; else process.env.CLIENT_URLS = avant;
  }
});
