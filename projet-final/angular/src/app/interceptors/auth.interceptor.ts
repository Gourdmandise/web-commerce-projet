import { HttpInterceptorFn, HttpRequest, HttpHandlerFn } from '@angular/common/http';
import { inject } from '@angular/core';
import { AuthService } from '../services/auth.service';
import { environment } from '../../environments/environment';

/**
 * Intercepteur HTTP — ajoute automatiquement le header Authorization: Bearer <token>
 * sur toutes les requêtes destinées au backend.
 *
 * Les requêtes vers d'autres domaines (Stripe, CDN…) ne sont PAS modifiées.
 */
export const authInterceptor: HttpInterceptorFn = (
  req: HttpRequest<unknown>,
  next: HttpHandlerFn
) => {
  const auth  = inject(AuthService);
  const token = auth.getToken();

  // N'ajouter le token que pour les appels vers notre backend
  const estRequeteBackend = req.url.startsWith(environment.backendUrl);

  if (token && estRequeteBackend) {
    const reqAuth = req.clone({
      setHeaders: { Authorization: `Bearer ${token}` }
    });
    return next(reqAuth);
  }

  return next(req);
};
