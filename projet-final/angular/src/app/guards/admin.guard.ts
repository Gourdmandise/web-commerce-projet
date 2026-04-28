import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { AuthService } from '../services/auth.service';
import { environment } from '../../environments/environment';
import { map, catchError } from 'rxjs/operators';
import { of } from 'rxjs';

export const adminGuard: CanActivateFn = () => {
  const auth   = inject(AuthService);
  const router = inject(Router);
  const http   = inject(HttpClient);

  if (!auth.connecte) {
    router.navigateByUrl('/compte');
    return false;
  }

  const userId = auth.utilisateur()?.id;
  if (!userId) {
    router.navigateByUrl('/compte');
    return false;
  }

  // Le rôle est relu depuis la BDD à chaque navigation vers /admin :
  // localStorage peut être modifié côté client, le serveur fait foi.
  return http.get<{ role: string }>(
    `${environment.backendUrl}/verify-admin/${userId}`,
    { headers: new HttpHeaders({ 'X-Requester-Id': String(userId) }) }
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
