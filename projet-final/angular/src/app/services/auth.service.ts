import { Injectable, signal, effect } from '@angular/core';
import { Utilisateur } from '../models/utilisateur.model';

const STORAGE_KEY = 'x3com_utilisateur';

@Injectable({ providedIn: 'root' })
export class AuthService {

  utilisateur = signal<Utilisateur | null>(this.chargerSession());

  constructor() {
    effect(() => {
      const u = this.utilisateur();
      if (u) {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(u));
      } else {
        localStorage.removeItem(STORAGE_KEY);
      }
    });
  }

  get connecte(): boolean {
    return this.utilisateur() !== null;
  }

  // token en paramètre optionnel pour compatibilité ascendante
  connecter(user: Utilisateur, token?: string): void {
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