import { Routes } from '@angular/router';
import { Home }         from './pages/home/home';
import { Terrassement } from './pages/terrassement/terrassement';
import { Collectivites } from './pages/collectivites/collectivites';
import { EntreprisesPromoteurs } from './pages/entreprises-promoteurs/entreprises-promoteurs';
import { Tarifs }       from './pages/tarifs/tarifs';
import { Contact }      from './pages/contact/contact';
import { Compte }       from './pages/compte/compte';
import { Paiement }     from './pages/paiement/paiement';
import { Commande }     from './pages/commande/commande';
import { MotDePasseOublie } from './pages/mot-de-passe-oublie/mot-de-passe-oublie';
import { Admin }        from './pages/admin/admin';
import { AdminRdv }     from './pages/admin-rdv/admin-rdv';
import { Legal }        from './pages/legal/legal';
import { SaviezVous }   from './pages/saviez-vous/saviez-vous';
import { AideTravaux }  from './pages/saviez-vous/aide-travaux/aide-travaux';
import { ArretCuivre }  from './pages/saviez-vous/arret-cuivre/arret-cuivre';
import { Glossaire }    from './pages/saviez-vous/glossaire/glossaire';
import { Resilience }   from './pages/saviez-vous/resilience/resilience';
import { authGuard }    from './guards/auth.guard';
import { adminGuard }   from './guards/admin.guard';

export const routes: Routes = [
  { path: '',                          component: Home,         pathMatch: 'full' },
  { path: 'nos-services',              component: Tarifs },
  { path: 'nos-prestations',           component: Terrassement },
  { path: 'nos-collectivites',         component: Collectivites },
  { path: 'nos-entreprises-promoteurs', component: EntreprisesPromoteurs },
  { path: 'terrassement',              component: Terrassement },
  { path: 'tarifs',                    component: Tarifs },
  { path: 'contact',                   component: Contact },
  { path: 'compte',                    component: Compte },
  { path: 'paiement',                  component: Paiement,    canActivate: [authGuard] },
  { path: 'commande',                  component: Commande },
  { path: 'commandes/:id',             component: Commande,    canActivate: [authGuard] },
  { path: 'mot-de-passe-oublie',       component: MotDePasseOublie },
  { path: 'admin',                     component: Admin,       canActivate: [adminGuard] },
  { path: 'admin-rdv',                 component: AdminRdv,    canActivate: [adminGuard] },
  { path: 'mentions-legales',          component: Legal,       data: { page: 'mentions' } },
  { path: 'cgu',                       component: Legal,       data: { page: 'cgu' } },
  { path: 'confidentialite',           component: Legal,       data: { page: 'confidentialite' } },
  { path: 'cgv',                       component: Legal,       data: { page: 'cgv' } },
  { path: 'saviez-vous',               component: SaviezVous },
  { path: 'saviez-vous/aide-travaux',  component: AideTravaux },
  { path: 'saviez-vous/arret-cuivre',  component: ArretCuivre },
  { path: 'saviez-vous/glossaire',     component: Glossaire },
  { path: 'saviez-vous/resilience',    component: Resilience },
  { path: '**',                        redirectTo: '' },
];