import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { EtatTache, Tache } from '../models/tache';
import { Observable } from 'rxjs';
import { environment } from '../../environments/environment';

@Injectable({
  providedIn: 'root'
})
export class TacheService {

  readonly tacheAPI = environment.apiUrl+"/taches"

  private http = inject(HttpClient)

  constructor() { }

  getTaches() : Observable<Tache[]> {
    return this.http.get<Tache[]>(this.tacheAPI)
  }
  getTache( id:number ) : Observable<Tache> {
    return this.http.get<Tache>(this.tacheAPI+"/"+id)
  }
  addTache( nouvelleTache:Tache ) : Observable<Tache> {
    return this.http.post<Tache>(this.tacheAPI, nouvelleTache)
  }
  updateTache(tache: Tache) : Observable<Tache> {
    return this.http.put<Tache>(this.tacheAPI+'/'+tache.id, tache)
  }
  deleteTache(id: number) : Observable<void> {
    return this.http.delete<void>(this.tacheAPI+'/'+id)
  }
}
