import { Routes } from '@angular/router';
import { TacheList } from './tache/tache-list/tache-list';
import { TacheDetail } from './tache/tache-detail/tache-detail';
import { Accueil } from './accueil/accueil';
import { TacheEdit } from './tache/tache-edit/tache-edit';

export const routes: Routes = [
    { path: 'taches',    component:TacheList   },
    { path: 'tache/new', component:TacheEdit },
    { path: 'tache/edit/:id', component:TacheEdit },
    { path: 'tache/:id', component:TacheDetail },
    { path: '',          component:Accueil, pathMatch:'full' },
    { path: '**',        redirectTo:''} // redirection pour les URL inconnues
];
