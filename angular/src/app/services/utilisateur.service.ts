import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../environments/environment';
import { Utilisateur } from '../models/utilisateur.model';

@Injectable({ providedIn: 'root' })
export class UtilisateurService {
  private http = inject(HttpClient);
  private url = `${environment.apiUrl}/utilisateurs`;

  // Connexion : cherche par email + mot de passe (déjà haché)
  getByEmailEtMotDePasse(email: string, motDePasse: string): Observable<Utilisateur[]> {
    return this.http.get<Utilisateur[]>(`${this.url}?email=${email}&motDePasse=${motDePasse}`);
  }

  // Vérifie si l'email existe déjà
  getByEmail(email: string): Observable<Utilisateur[]> {
    return this.http.get<Utilisateur[]>(`${this.url}?email=${email}`);
  }

  // Inscription
  creer(user: Omit<Utilisateur, 'id'>): Observable<Utilisateur> {
    return this.http.post<Utilisateur>(this.url, {
      ...user,
      role: 'client',
      dateCreation: new Date().toISOString()
    });
  }

  // Mise à jour partielle
  mettreAJour(id: number, data: Partial<Utilisateur>): Observable<Utilisateur> {
    return this.http.patch<Utilisateur>(`${this.url}/${id}`, data);
  }

  // Admin — liste tous les utilisateurs
  getAll(): Observable<Utilisateur[]> {
    return this.http.get<Utilisateur[]>(this.url);
  }

  // Admin — supprimer un utilisateur
  supprimer(id: number): Observable<void> {
    return this.http.delete<void>(`${this.url}/${id}`);
  }
}
