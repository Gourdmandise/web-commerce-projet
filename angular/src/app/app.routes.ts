import { Routes } from '@angular/router';
import { home }         from './pages/home/home';
import { Terrassement } from './pages/terrassement/terrassement';
import { Tarifs }       from './pages/tarifs/tarifs';
import { Contact }      from './pages/contact/contact';
import { Compte }       from './pages/compte/compte';
import { Paiement }     from './pages/paiement/paiement';
import { Commande }     from './pages/commande/commande';
import { Admin }        from './pages/admin/admin';
import { authGuard }    from './guards/auth.guard';
import { adminGuard }   from './guards/admin.guard';

export const routes: Routes = [
  { path: '',             component: home,         pathMatch: 'full' },
  { path: 'terrassement', component: Terrassement },
  { path: 'tarifs',       component: Tarifs },
  { path: 'contact',      component: Contact },
  { path: 'compte',       component: Compte },
  { path: 'paiement',     component: Paiement,  canActivate: [authGuard] },
  { path: 'commande',     component: Commande,  canActivate: [authGuard] },
  { path: 'admin',        component: Admin,     canActivate: [adminGuard] },
  { path: '**',           redirectTo: '' },
];
