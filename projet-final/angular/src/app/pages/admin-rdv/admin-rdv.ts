import { Component, OnInit, ViewEncapsulation, inject, signal, ChangeDetectorRef } from '@angular/core';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { environment } from '../../../environments/environment';
import { AuthService } from '../../services/auth.service';

export interface Rdv {
  id: number;
  nom: string;
  email: string;
  telephone: string;
  adresse: string;
  date: string;
  heure: string;
  service: string;
  rubrique: string;
  notes: string;
  statut: 'en_attente' | 'confirme' | 'annule';
  datecreation: string;
}

type Filtre = 'tous' | 'en_attente' | 'confirme' | 'annule';

@Component({
  selector: 'app-admin-rdv',
  standalone: true,
  imports: [],          // RouterLink supprimé (inutilisé)
  templateUrl: './admin-rdv.html',
  styleUrls: ['./admin-rdv.css'],
  encapsulation: ViewEncapsulation.None,
})
export class AdminRdv implements OnInit {
  private http = inject(HttpClient);
  private auth = inject(AuthService);
  private cdr  = inject(ChangeDetectorRef);

  rdvs       = signal<Rdv[]>([]);
  filtre     = signal<Filtre>('tous');
  chargement = true;
  erreur     = false;

  get rdvFiltres(): Rdv[] {
    const f = this.filtre();
    if (f === 'tous') return this.rdvs();
    return this.rdvs().filter(r => r.statut === f);
  }

  get nbParStatut() {
    const all = this.rdvs();
    return {
      tous:       all.length,
      en_attente: all.filter(r => r.statut === 'en_attente').length,
      confirme:   all.filter(r => r.statut === 'confirme').length,
      annule:     all.filter(r => r.statut === 'annule').length,
    };
  }

  ngOnInit(): void {
    this.charger();
  }

  private headers(): HttpHeaders {
    const token = this.auth.getToken();
    return new HttpHeaders(token ? { Authorization: `Bearer ${token}` } : {});
  }

  charger(): void {
    this.chargement = true;
    this.http.get<Rdv[]>(`${environment.backendUrl}/rdv`, { headers: this.headers() })
      .subscribe({
        next: data => {
          this.rdvs.set(data);
          this.chargement = false;
          this.cdr.detectChanges();
        },
        error: () => {
          this.erreur = true;
          this.chargement = false;
          this.cdr.detectChanges();
        }
      });
  }

  changerStatut(rdv: Rdv, statut: 'confirme' | 'annule' | 'en_attente'): void {
    this.http.patch<Rdv>(
      `${environment.backendUrl}/rdv/${rdv.id}/statut`,
      { statut },
      { headers: this.headers() }
    ).subscribe({
      next: updated => {
        this.rdvs.update(list => list.map(r => r.id === updated.id ? updated : r));
        this.cdr.detectChanges();
      },
      error: () => alert('Erreur lors de la mise à jour.')
    });
  }

  formatDate(dateStr: string): string {
  if (!dateStr) return '';
  // new Date("YYYY-MM-DD") est interprété en UTC — le constructeur local évite le décalage d'un jour
  const [year, month, day] = dateStr.split('-').map(Number);
  const d = new Date(year, month - 1, day);
  return d.toLocaleDateString('fr-FR', {
    weekday: 'long', day: 'numeric', month: 'long', year: 'numeric'
  });
}
}