import { Routes } from '@angular/router';
import { Home }         from './pages/home/home';
import { Terrassement } from './pages/terrassement/terrassement';
import { Tarifs }       from './pages/tarifs/tarifs';
import { Contact }      from './pages/contact/contact';
import { Compte }       from './pages/compte/compte';
import { Paiement }     from './pages/paiement/paiement';
import { Commande }     from './pages/commande/commande';
import { Admin }        from './pages/admin/admin';
import { Legal }        from './pages/legal/legal';
import { SaviezVous }   from './pages/saviez-vous/saviez-vous';
import { authGuard }    from './guards/auth.guard';
import { adminGuard }   from './guards/admin.guard';

export const routes: Routes = [
  { path: '',                   component: Home,         pathMatch: 'full' },
  { path: 'nos-services',       component: Tarifs },
  { path: 'qui-sommes-nous',    component: Terrassement },
  { path: 'notre-territoire',   component: Contact },
  { path: 'terrassement',       component: Terrassement },
  { path: 'tarifs',             component: Tarifs },
  { path: 'contact',            component: Contact },
  { path: 'compte',           component: Compte },
  { path: 'paiement',         component: Paiement,  canActivate: [authGuard] },
  { path: 'commande',         component: Commande },
  { path: 'admin',            component: Admin,     canActivate: [adminGuard] },
  { path: 'mentions-legales', component: Legal,     data: { page: 'mentions' } },
  { path: 'cgu',              component: Legal,     data: { page: 'cgu' } },
  { path: 'confidentialite',  component: Legal,     data: { page: 'confidentialite' } },
  { path: 'cgv',              component: Legal,     data: { page: 'cgv' } },
  { path: 'saviez-vous',        component: SaviezVous },
  { path: '**',               redirectTo: '' },
];