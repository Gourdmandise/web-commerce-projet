import { Injectable } from '@angular/core';

@Injectable({ providedIn: 'root' })
export class HashService {

  /** Hash un mot de passe en SHA-256 (retourne une Promise) */
  async hash(motDePasse: string): Promise<string> {
    const encoder = new TextEncoder();
    const data    = encoder.encode(motDePasse);
    const buffer  = await crypto.subtle.digest('SHA-256', data);
    return Array.from(new Uint8Array(buffer))
      .map(b => b.toString(16).padStart(2, '0'))
      .join('');
  }

  /** Vérifie un mot de passe en clair contre un hash stocké */
  async verifier(motDePasse: string, hashStocke: string): Promise<boolean> {
    const hashSaisi = await this.hash(motDePasse);
    return hashSaisi === hashStocke;
  }
}
