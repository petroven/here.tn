// Authentification web (App.jsx) : connexion, échec, redirection par rôle,
// déconnexion, et session expirée détectée au chargement.
import React from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor, cleanup } from '@testing-library/react';
import { BrowserRouter } from 'react-router-dom';
import App from './App.jsx';

const json = (status, body) => ({ ok: status >= 200 && status < 300, status, json: async () => body });

// Toute route non listée renvoie une liste vide : seule l'authentification est testée ici.
function installerFetch(routes = {}) {
  const fetchMock = vi.fn(async (url, options = {}) => {
    for (const [suffixe, reponse] of Object.entries(routes)) {
      if (url.split('?')[0].endsWith(suffixe)) return typeof reponse === 'function' ? reponse(url, options) : reponse;
    }
    return json(200, { success: true, data: [] });
  });
  vi.stubGlobal('fetch', fetchMock);
  return fetchMock;
}

const connexionReussie = (role) => json(200, {
  success: true, token: `jeton-${role}`, user: { id: 7, nom: 'Test', prenom: 'Amel', email: 'amel@here.tn', role },
});

function demarrer(chemin = '/') {
  window.history.pushState({}, '', chemin);
  return render(<BrowserRouter><App /></BrowserRouter>);
}

async function seConnecter(email = 'amel@here.tn', password = 'MotDePasse2026') {
  fireEvent.click((await screen.findAllByText('Compte'))[0]);
  fireEvent.change(await screen.findByLabelText('Adresse email'), { target: { value: email } });
  fireEvent.change(screen.getByLabelText('Mot de passe'), { target: { value: password } });
  fireEvent.submit(screen.getByText('Continuer').closest('form'));
}

beforeEach(() => {
  localStorage.clear();
  window.scrollTo = vi.fn();
});

afterEach(() => {
  cleanup();
  localStorage.clear();
});

describe('connexion', () => {
  it('client : jeton enregistré, fenêtre fermée, reste sur la page en cours', async () => {
    const fetchMock = installerFetch({ '/auth/login': connexionReussie('client') });
    demarrer('/');
    await seConnecter();

    await waitFor(() => expect(localStorage.getItem('token')).toBe('jeton-client'));
    expect(localStorage.getItem('userRole')).toBe('client');
    const appel = fetchMock.mock.calls.find(([url]) => url.endsWith('/auth/login'));
    expect(JSON.parse(appel[1].body)).toEqual({ email: 'amel@here.tn', password: 'MotDePasse2026' });
    await waitFor(() => expect(screen.queryByLabelText('Mot de passe')).toBeNull());
    expect(window.location.pathname).toBe('/');
  });

  it('identifiants refusés : message du serveur affiché, rien n’est stocké', async () => {
    installerFetch({ '/auth/login': json(401, { success: false, message: 'Email ou mot de passe incorrect.' }) });
    demarrer('/');
    await seConnecter('amel@here.tn', 'mauvais');

    expect(await screen.findByText('Email ou mot de passe incorrect.')).toBeTruthy();
    expect(localStorage.getItem('token')).toBeNull();
  });

  it.each([
    ['super_admin', '/admin'],
    ['admin_boutique', '/vendeur'],
    ['livreur', '/livreur'],
  ])('rôle %s : redirection vers %s', async (role, chemin) => {
    installerFetch({ '/auth/login': connexionReussie(role) });
    demarrer('/');
    await seConnecter();
    await waitFor(() => expect(window.location.pathname).toBe(chemin));
  });
});

describe('session', () => {
  it('déconnexion : jeton et rôle effacés', async () => {
    localStorage.setItem('token', 'jeton-valide');
    localStorage.setItem('userId', '7');
    localStorage.setItem('userRole', 'client');
    installerFetch({ '/users/me': json(200, { success: true, data: { id: 7 } }) });
    demarrer('/');

    fireEvent.click((await screen.findAllByText('Déconnexion'))[0]);
    expect(localStorage.getItem('token')).toBeNull();
    expect(localStorage.getItem('userRole')).toBeNull();
    expect((await screen.findAllByText('Devenir vendeur')).length).toBeGreaterThan(0);
  });

  it('jeton expiré au chargement (401) : session effacée, l’interface repasse en invité', async () => {
    localStorage.setItem('token', 'jeton-expire');
    localStorage.setItem('userId', '7');
    localStorage.setItem('userRole', 'client');
    const fetchMock = installerFetch({ '/users/me': json(401, { success: false, message: 'Session expirée.' }) });
    demarrer('/');

    await waitFor(() => expect(localStorage.getItem('token')).toBeNull());
    expect(localStorage.getItem('userId')).toBeNull();
    expect((await screen.findAllByText('Devenir vendeur')).length).toBeGreaterThan(0);
    const appel = fetchMock.mock.calls.find(([url]) => url.endsWith('/users/me'));
    expect(appel[1].headers.Authorization).toBe('Bearer jeton-expire');
  });

  it('serveur injoignable au chargement : la session est conservée', async () => {
    localStorage.setItem('token', 'jeton-valide');
    localStorage.setItem('userId', '7');
    localStorage.setItem('userRole', 'client');
    installerFetch({ '/users/me': () => { throw new TypeError('Failed to fetch'); } });
    demarrer('/');

    expect((await screen.findAllByText('Déconnexion')).length).toBeGreaterThan(0);
    expect(localStorage.getItem('token')).toBe('jeton-valide');
  });
});
