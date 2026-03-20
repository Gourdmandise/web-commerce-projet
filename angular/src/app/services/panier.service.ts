import { Injectable, signal } from '@angular/core';
import { Offre } from '../models/offre.model';

@Injectable({ providedIn: 'root' })
export class PanierService {

  offre = signal<Offre | null>(null);

  notifVisible = signal(false);
  notifIco     = signal('✓');
  notifMsg     = signal('Action réalisée');
  notifSub     = signal('X3COM');

  choisir(offre: Offre): void {
    this.offre.set(offre);
  }

  notify(ico: string, msg: string, sub: string = 'X3COM'): void {
    this.notifIco.set(ico);
    this.notifMsg.set(msg);
    this.notifSub.set(sub);
    this.notifVisible.set(true);
    setTimeout(() => this.notifVisible.set(false), 3500);
  }
}