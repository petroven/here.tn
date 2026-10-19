// Retour Google/Facebook : jeton lu dans le fragment (#token=…), stocké, puis
// effacé de la barre d'adresse et de l'historique.
import React from 'react';
import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';
import OAuthCallbackPage from './OAuthCallbackPage.jsx';

// En-tête et signature factices : seule la charge utile est décodée côté client.
const charge = btoa(JSON.stringify({ id: 7, role: 'client' })).replace(/=+$/, '').replace(/\+/g, '-').replace(/\//g, '_');
const JETON = `eyJhbGciOiJIUzI1NiJ9.${charge}.signature`;

function ouvrir(suffixe) {
  window.history.pushState({}, '', `/oauth/callback${suffixe}`);
  const onSuccess = vi.fn();
  render(<OAuthCallbackPage onSuccess={onSuccess} />);
  return onSuccess;
}

afterEach(() => {
  cleanup();
  localStorage.clear();
});

describe('OAuthCallbackPage', () => {
  it('jeton dans le fragment : session ouverte et URL nettoyée', () => {
    const onSuccess = ouvrir(`#token=${JETON}`);
    expect(onSuccess).toHaveBeenCalledWith({ id: 7, role: 'client' });
    expect(localStorage.getItem('token')).toBe(JETON);
    expect(localStorage.getItem('userRole')).toBe('client');
    expect(window.location.hash).toBe('');
    expect(window.location.href).not.toContain(JETON);
  });

  it('ancien lien (jeton en query) : encore accepté pendant la transition, puis effacé', () => {
    const onSuccess = ouvrir(`?token=${JETON}`);
    expect(onSuccess).toHaveBeenCalledWith({ id: 7, role: 'client' });
    expect(window.location.search).toBe('');
  });

  it('erreur du fournisseur : message affiché, rien stocké', () => {
    const onSuccess = ouvrir('?error=Connexion%20refus%C3%A9e.');
    expect(screen.getByText('Connexion refusée.')).toBeTruthy();
    expect(onSuccess).not.toHaveBeenCalled();
    expect(localStorage.getItem('token')).toBeNull();
  });

  it('jeton illisible : erreur, rien stocké', () => {
    const onSuccess = ouvrir('#token=pas-un-jwt');
    expect(screen.getByText('Connexion impossible : le lien de retour est invalide.')).toBeTruthy();
    expect(onSuccess).not.toHaveBeenCalled();
    expect(localStorage.getItem('token')).toBeNull();
  });
});
