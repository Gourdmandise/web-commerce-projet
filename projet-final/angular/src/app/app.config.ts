import { ApplicationConfig, provideBrowserGlobalErrorListeners } from '@angular/core';
import { provideRouter } from '@angular/router';
import { provideHttpClient, withInterceptors }                    from '@angular/common/http';
import { routes }          from './app.routes';
import { authInterceptor } from './interceptors/auth.interceptor';

export const appConfig: ApplicationConfig = {
  providers: [
    provideBrowserGlobalErrorListeners(),
    provideRouter(routes),
    // ✅ L'intercepteur injecte automatiquement le JWT sur chaque requête backend
    provideHttpClient(withInterceptors([authInterceptor])),
  ]
};