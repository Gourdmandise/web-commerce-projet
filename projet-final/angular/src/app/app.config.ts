import { ApplicationConfig, provideBrowserGlobalErrorListeners } from '@angular/core';
import { provideRouter, withHashLocation }                        from '@angular/router';
import { provideHttpClient, withInterceptors }                    from '@angular/common/http';
import { routes }          from './app.routes';
import { authInterceptor } from './interceptors/auth.interceptor';

export const appConfig: ApplicationConfig = {
  providers: [
    provideBrowserGlobalErrorListeners(),
    provideRouter(routes, withHashLocation()),
    // ✅ L'intercepteur injecte automatiquement le JWT sur chaque requête backend
    provideHttpClient(withInterceptors([authInterceptor])),
  ]
};