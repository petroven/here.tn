// Liens partagés interceptés par l'app mobile (https://buyhere.tn/...) : sans
// l'app installée, le site doit les ouvrir sur une vraie page, pas sur la page
// introuvable.
import React from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, waitFor, cleanup } from '@testing-library/react';
import { BrowserRouter } from 'react-router-dom';
import App from './App.jsx';

beforeEach(() => {
  localStorage.clear();
  window.scrollTo = vi.fn();
  vi.stubGlobal('fetch', vi.fn(async (url) => (/\/(boutiques|produits)\/\d+$/.test(url)
    ? { ok: false, status: 404, json: async () => ({ success: false, message: 'Introuvable.' }) }
    : { ok: true, status: 200, json: async () => ({ success: true, data: [] }) })));
});

afterEach(() => {
  cleanup();
});

describe('liens partagés interceptés par l’app', () => {
  it.each([
    ['/commandes/789', '/commandes'],
    ['/promotion/ETE2026', '/coupons'],
    ['/coupons/ETE2026', '/coupons'],
  ])('%s → %s', async (depart, arrivee) => {
    window.history.pushState({}, '', depart);
    render(<BrowserRouter><App /></BrowserRouter>);
    await waitFor(() => expect(window.location.pathname).toBe(arrivee));
  });

  it.each(['/produits/12', '/boutiques/5'])('%s reste sur sa page', async (chemin) => {
    window.history.pushState({}, '', chemin);
    render(<BrowserRouter><App /></BrowserRouter>);
    await new Promise((r) => setTimeout(r, 50));
    expect(window.location.pathname).toBe(chemin);
  });
});
