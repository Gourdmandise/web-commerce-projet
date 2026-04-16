import { Injectable, signal, effect } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, of, tap, map, catchError } from 'rxjs';
import { Utilisateur } from '../models/utilisateur.model';
import { environment } from '../../environments/environment';

const STORAGE_KEY = 'x3com_utilisateur';
const TOKEN_KEY   = 'x3com_token';

@Injectable({ providedIn: 'root' })
export class AuthService {
  private http = inject(HttpClient);
  private backend = environment.backendUrl;

  utilisateur = signal<Utilisateur | null>(this.chargerSession());

  constructor() {
    // Synchronise automatiquement le signal avec localStorage
    effect(() => {
      const u = this.utilisateur();
      if (u) {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(u));
      } else {
        localStorage.removeItem(STORAGE_KEY);
        localStorage.removeItem(TOKEN_KEY);
      }
    });
  }

  get connecte(): boolean {
    return this.utilisateur() !== null;
  }

  /**
   * Appelé après /login ou /register.
   * Stocke l'utilisateur ET le JWT.
   */
  connecter(user: Utilisateur, token: string): void {
    localStorage.setItem(TOKEN_KEY, token);
    this.utilisateur.set(user);
  }

  deconnecter(): void {
    this.utilisateur.set(null);
    // L'effect() supprime TOKEN_KEY automatiquement
  }

  /**
   * Renvoie le token JWT pour l'intercepteur HTTP.
   * Retourne null si l'utilisateur n'est pas connecté.
   */
  getToken(): string | null {
    return localStorage.getItem(TOKEN_KEY);
  }

  refreshToken(): Observable<string | null> {
    const token = this.getToken();
    if (!token) {
      return of(null);
    }

    return this.http.post<{ token: string }>(`${this.backend}/refresh-token`, { token }).pipe(
      map(response => response.token ?? null),
      tap(newToken => {
        if (newToken) {
          localStorage.setItem(TOKEN_KEY, newToken);
        }
      }),
      catchError(() => {
        this.deconnecter();
        return of(null);
      })
    );
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