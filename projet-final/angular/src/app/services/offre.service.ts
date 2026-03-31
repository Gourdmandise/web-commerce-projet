import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../environments/environment';
import { Offre } from '../models/offre.model';

@Injectable({ providedIn: 'root' })
export class OffreService {
  private http = inject(HttpClient);
  private url  = `${environment.backendUrl}/offres`;

  getAll(): Observable<Offre[]> {
    return this.http.get<Offre[]>(this.url);
  }

  getById(id: number): Observable<Offre> {
    return this.http.get<Offre>(`${this.url}/${id}`);
  }

  creer(offre: Omit<Offre, 'id'>): Observable<Offre> {
    return this.http.post<Offre>(this.url, offre);
  }

  modifier(id: number, offre: Partial<Offre>): Observable<Offre> {
    return this.http.patch<Offre>(`${this.url}/${id}`, offre);
  }

  supprimer(id: number): Observable<void> {
    return this.http.delete<void>(`${this.url}/${id}`);
  }

  reordonner(ordre: { id: number; ordre: number }[]): Observable<{ ok: boolean }> {
    return this.http.post<{ ok: boolean }>(`${this.url}/reordonner`, { ordre });
  }
}