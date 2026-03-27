import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { HttpClient } from '@angular/common/http';
import { AuthService } from '../services/auth.service';
import { environment } from '../../environments/environment';
import { map, catchError } from 'rxjs/operators';
import { of } from 'rxjs';

export const adminGuard: CanActivateFn = () => {
  const auth   = inject(AuthService);
  const router = inject(Router);
  const http   = inject(HttpClient);

  // 1. Vérification locale rapide (expérience UX)
  if (!auth.connecte) {
    router.navigateByUrl('/compte');
    return false;
  }

  const userId = auth.utilisateur()?.id;
  if (!userId) {
    router.navigateByUrl('/compte');
    return false;
  }

  // 2. Vérification CÔTÉ SERVEUR — le rôle est lu depuis la BDD, pas localStorage
  return http.get<{ role: string }>(
    `${environment.backendUrl}/verify-admin/${userId}`
  ).pipe(
    map(res => {
      if (res.role === 'admin') return true;
      router.navigateByUrl('/');
      return false;
    }),
    catchError(() => {
      router.navigateByUrl('/');
      return of(false);
    })
  );
};
