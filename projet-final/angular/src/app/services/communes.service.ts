import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../environments/environment';

export interface Commune {
  id: number;
  commune: string;
  code_postal: string;
  region: string;
  departement: string;
  date_fermeture_commerciale: string | null;
  date_fermeture_technique: string | null;
  statut: 'programmee' | 'effective' | 'effectuee';
}

@Injectable({ providedIn: 'root' })
export class CommunesService {
  private http = inject(HttpClient);
  private backend = environment.backendUrl;

  /**
   * Recherche une commune par nom ou code postal
   */
  rechercher(query: string): Observable<Commune[]> {
    return this.http.get<Commune[]>(`${this.backend}/communes/recherche`, {
      params: { q: query }
    });
  }
}
