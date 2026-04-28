import { Injectable, inject } from '@angular/core';
import { HttpClient }         from '@angular/common/http';
import { Observable }         from 'rxjs';
import { environment }        from '../../environments/environment';
import { Utilisateur }        from '../models/utilisateur.model';

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

  connecter(email: string, motDePasse: string): Observable<AuthResponse> {
    return this.http.post<AuthResponse>(`${this.backend}/login`, { email, motDePasse });
  }

  inscrire(email: string, motDePasse: string, prenom: string, nom: string): Observable<AuthResponse> {
    return this.http.post<AuthResponse>(`${this.backend}/register`, { email, motDePasse, prenom, nom });
  }

  mettreAJour(id: number, data: Partial<Utilisateur>): Observable<Utilisateur> {
    return this.http.patch<Utilisateur>(`${this.url}/${id}`, data);
  }

  changerMotDePasse(id: number, motDePasse: string): Observable<{ ok: boolean }> {
    return this.http.patch<{ ok: boolean }>(`${this.url}/${id}/password`, { motDePasse });
  }

  getAll(): Observable<Utilisateur[]> {
    return this.http.get<Utilisateur[]>(this.url);
  }

  supprimer(id: number): Observable<void> {
    return this.http.delete<void>(`${this.url}/${id}`);
  }
}