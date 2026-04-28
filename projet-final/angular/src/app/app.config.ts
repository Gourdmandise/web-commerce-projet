import { APP_INITIALIZER, ApplicationConfig, provideBrowserGlobalErrorListeners } from '@angular/core';
import { provideRouter } from '@angular/router';
import { provideHttpClient, withInterceptors }                    from '@angular/common/http';
import { routes }          from './app.routes';
import { authInterceptor } from './interceptors/auth.interceptor';
import { AuthService } from './services/auth.service';

export function initialiserAuthentification(authService: AuthService) {
  return () => {
    if (!authService.getToken()) return;
    authService.refreshToken().subscribe();
  };
}

export const appConfig: ApplicationConfig = {
  providers: [
    provideBrowserGlobalErrorListeners(),
    provideRouter(routes),
    { provide: APP_INITIALIZER, useFactory: initialiserAuthentification, deps: [AuthService], multi: true },
    provideHttpClient(withInterceptors([authInterceptor])),
  ]
};