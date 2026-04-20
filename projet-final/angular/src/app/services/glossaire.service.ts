import { Injectable } from '@angular/core';
import { environment } from '../../environments/environment';

@Injectable({ providedIn: 'root' })
export class GlossaireService {
  private termes: string[] = [];
  private promise: Promise<string[]> | null = null;

  charger(): Promise<string[]> {
    if (this.promise) return this.promise;
    this.promise = fetch(`${environment.backendUrl}/glossaire`)
      .then(r => r.json())
      .then((data: { terme: string }[]) => {
        this.termes = data.map(t => t.terme);
        return this.termes;
      })
      .catch(() => []);
    return this.promise;
  }
}
