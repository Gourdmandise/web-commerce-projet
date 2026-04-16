import { Injectable, inject } from '@angular/core';
import { HttpClient }         from '@angular/common/http';
import { Observable }         from 'rxjs';
import { environment }        from '../../environments/environment';
import { Utilisateur }        from '../models/utilisateur.model';

/** Réponse renvoyée par /login et /register — inclut désormais le JWT */
export interface AuthResponse {
  utilisateur: Utilisateur;
  token: string;
}

@Injectable({ providedIn: 'root' })
export class UtilisateurService {
  private http    = inject(HttpClient);
  private backend = environment.backendUrl;
  private url     = `${environment.backendUrl}/utilisateurs`;

  forgotPassword(email: string): Observable<{ message: string; token_expires_in: number }> {
    return this.http.post<{ message: string; token_expires_in: number }>(`${this.backend}/forgot-password`, { email });
  }

  resetPassword(token: string, newPassword: string): Observable<{ ok: boolean }> {
    return this.http.post<{ ok: boolean }>(`${this.backend}/reset-password`, { token, new_password: newPassword });
  }

  /**
   * POST /login
   * Retourne { utilisateur, token } — le token doit être passé à AuthService.connecter()
   */
  connecter(email: string, motDePasse: string): Observable<AuthResponse> {
    return this.http.post<AuthResponse>(`${this.backend}/login`, { email, motDePasse });
  }

  /**
   * POST /register
   * Retourne { utilisateur, token }
   */
  inscrire(email: string, motDePasse: string, prenom: string, nom: string): Observable<AuthResponse> {
    return this.http.post<AuthResponse>(`${this.backend}/register`, { email, motDePasse, prenom, nom });
  }

  /**
   * PATCH /utilisateurs/:id
   * Requiert d'être connecté et propriétaire du compte (ou admin).
   * Le JWT est ajouté automatiquement par l'intercepteur.
   */
  mettreAJour(id: number, data: Partial<Utilisateur>): Observable<Utilisateur> {
    return this.http.patch<Utilisateur>(`${this.url}/${id}`, data);
  }

  /**
   * PATCH /utilisateurs/:id/password
   * Requiert d'être connecté et propriétaire du compte (ou admin).
   */
  changerMotDePasse(id: number, motDePasse: string): Observable<{ ok: boolean }> {
    return this.http.patch<{ ok: boolean }>(`${this.url}/${id}/password`, { motDePasse });
  }

  /**
   * GET /utilisateurs
   * ADMIN UNIQUEMENT — retourne tous les comptes.
   */
  getAll(): Observable<Utilisateur[]> {
    return this.http.get<Utilisateur[]>(this.url);
  }

  /**
   * DELETE /utilisateurs/:id
   * Propriétaire ou admin uniquement.
   */
  supprimer(id: number): Observable<void> {
    return this.http.delete<void>(`${this.url}/${id}`);
  }
}