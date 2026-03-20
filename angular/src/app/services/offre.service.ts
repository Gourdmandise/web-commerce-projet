import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../environments/environment';
import { Offre } from '../models/offre.model';

@Injectable({ providedIn: 'root' })
export class OffreService {
  private http = inject(HttpClient);
  private url = `${environment.apiUrl}/offres`;

  getAll(): Observable<Offre[]> {
    return this.http.get<Offre[]>(this.url);
  }

  getById(id: number): Observable<Offre> {
    return this.http.get<Offre>(`${this.url}/${id}`);
  }

  // Admin — créer une offre
  creer(offre: Omit<Offre, 'id'>): Observable<Offre> {
    return this.http.post<Offre>(this.url, offre);
  }

  // Admin — modifier une offre
  modifier(id: number, offre: Partial<Offre>): Observable<Offre> {
    return this.http.patch<Offre>(`${this.url}/${id}`, offre);
  }

  // Admin — supprimer une offre
  supprimer(id: number): Observable<void> {
    return this.http.delete<void>(`${this.url}/${id}`);
  }
}
