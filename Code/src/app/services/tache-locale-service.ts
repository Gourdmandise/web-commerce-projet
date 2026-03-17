import { Injectable } from '@angular/core';
import { EtatTache, Tache } from '../models/tache';

@Injectable({
  providedIn: 'root'
})
export class TacheLocalService {

  private taches : Tache[] = [
    {
      id  : 1,
      nom : "Première tache",
      etat: EtatTache.TERMINEE,
      memo: "Juste pour avoir une tâche pour commencer..."
    }
  ]

  constructor() {
    const jsonTaches = localStorage.getItem('listeTaches')
    if (jsonTaches) {
      this.taches = JSON.parse(jsonTaches)
    } else {
      this.saveAllTaches()
    }
  }
  private saveAllTaches() : void {
    localStorage['listeTaches'] = JSON.stringify(this.taches)
  }

  getTaches() : Tache[] {
    return this.taches
  }
  getTache( id:number ) : Tache | undefined {
    return this.taches.find( t => t.id == id )
  }
  addTache( nouvelleTache:Tache ) : Tache {
    // algo simplifié : la nouvelle tâche aura l'id de la dernière du tableau +1
    nouvelleTache.id = 1 + this.taches[this.taches.length-1].id
    this.taches.push(nouvelleTache)
    this.saveAllTaches()
    return nouvelleTache
  }
  updateTache(tache: Tache) {
    const tacheIn =  this.getTache(tache.id)
    if (tacheIn) {
      Object.assign( tacheIn, tache )
      this.saveAllTaches()
    }
  }
}