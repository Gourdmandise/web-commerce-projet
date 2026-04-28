import { HttpInterceptorFn, HttpRequest, HttpHandlerFn } from '@angular/common/http';
import { inject } from '@angular/core';
import { AuthService } from '../services/auth.service';
import { environment } from '../../environments/environment';

export const authInterceptor: HttpInterceptorFn = (
  req: HttpRequest<unknown>,
  next: HttpHandlerFn
) => {
  const auth  = inject(AuthService);
  const token = auth.getToken();

  const estRequeteBackend = req.url.startsWith(environment.backendUrl);

  if (token && estRequeteBackend) {
    const reqAuth = req.clone({
      setHeaders: { Authorization: `Bearer ${token}` }
    });
    return next(reqAuth);
  }

  return next(req);
};
