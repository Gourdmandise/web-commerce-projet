import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../environments/environment';
import { Commande, StatutCommande } from '../models/commande.model';

@Injectable({ providedIn: 'root' })
export class CommandeService {
  private http = inject(HttpClient);
  private url  = `${environment.backendUrl}/commandes`;

  getByUtilisateur(utilisateurId: number): Observable<Commande[]> {
    return this.http.get<Commande[]>(`${this.url}?utilisateurId=${utilisateurId}`);
  }

  creer(commande: Omit<Commande, 'id'>): Observable<Commande> {
    return this.http.post<Commande>(this.url, {
      ...commande,
      dateCreation: new Date().toISOString(),
    });
  }

  getAll(): Observable<Commande[]> {
    return this.http.get<Commande[]>(this.url);
  }

  changerStatut(id: number, statut: StatutCommande): Observable<Commande> {
    return this.http.patch<Commande>(`${this.url}/${id}`, { statut });
  }

  supprimer(id: number): Observable<void> {
    return this.http.delete<void>(`${this.url}/${id}`);
  }
}
