import { Injectable, signal, effect } from '@angular/core';
import { Utilisateur } from '../models/utilisateur.model';

const STORAGE_KEY       = 'x3com_utilisateur';
const STORAGE_TOKEN_KEY = 'x3com_token';

@Injectable({ providedIn: 'root' })
export class AuthService {

  utilisateur = signal<Utilisateur | null>(this.chargerSession());
  token       = signal<string | null>(localStorage.getItem(STORAGE_TOKEN_KEY));

  constructor() {
    // Synchronise automatiquement le signal avec localStorage
    effect(() => {
      const u = this.utilisateur();
      if (u) {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(u));
      } else {
        localStorage.removeItem(STORAGE_KEY);
        localStorage.removeItem(STORAGE_TOKEN_KEY);
        this.token.set(null);
      }
    });
  }

  get connecte(): boolean {
    return this.utilisateur() !== null;
  }

  connecter(user: Utilisateur, token: string): void {
    localStorage.setItem(STORAGE_TOKEN_KEY, token);
    this.token.set(token);
    this.utilisateur.set(user);
  }

  deconnecter(): void {
    this.utilisateur.set(null);
  }

  private chargerSession(): Utilisateur | null {
    try {
      const data = localStorage.getItem(STORAGE_KEY);
      return data ? JSON.parse(data) : null;
    } catch {
      return null;
    }
  }
}
