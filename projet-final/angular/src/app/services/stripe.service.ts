import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../environments/environment';

export interface CheckoutSession {
  url:       string;
  sessionId: string;
}

export interface SessionStatus {
  status:        string;
  customerEmail: string;
  metadata:      Record<string, string>;
}

@Injectable({ providedIn: 'root' })
export class StripeService {
  private http    = inject(HttpClient);
  private backend = environment.backendUrl;

  createCheckoutSession(params: {
    offreId:       number;
    prix:          number;
    nom:           string;
    utilisateurId: number;
    emailClient?:  string;
    prenom?:       string;
    nomClient?:    string;
    telephone?:    string;
  }): Observable<CheckoutSession> {
    return this.http.post<CheckoutSession>(
      `${this.backend}/create-checkout-session`,
      params
    );
  }

  getSessionStatus(sessionId: string): Observable<SessionStatus> {
    return this.http.get<SessionStatus>(
      `${this.backend}/session/${sessionId}`
    );
  }
}