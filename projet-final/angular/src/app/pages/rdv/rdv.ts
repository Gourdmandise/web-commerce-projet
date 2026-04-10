import { Component, OnInit, ViewEncapsulation, ChangeDetectorRef, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { HttpClient } from '@angular/common/http';
import { environment } from '../../../environments/environment';

@Component({
  selector: 'app-rdv',
  standalone: true,
  imports: [FormsModule, RouterLink],
  templateUrl: './rdv.html',
  styleUrls: ['./rdv.css'],
  encapsulation: ViewEncapsulation.None,
})
export class Rdv implements OnInit {
  private cdr  = inject(ChangeDetectorRef);
  private http = inject(HttpClient);

  // ── Calendrier ──
  today       = new Date();
  moisAffiche = new Date(this.today.getFullYear(), this.today.getMonth(), 1);
  dateSelectionnee: string = '';
  dateLabel: string = '';

  // ── Créneaux ──
  creneaux = [
    '09:00','09:30','10:00','10:30',
    '11:00','11:30','14:00','14:30',
    '15:00','15:30','16:00','16:30',
  ];
  heureSelectionnee   = '';
  creneauxPris: string[] = [];
  chargementCreneaux  = false;

  // ── Formulaire ──
  nom       = '';
  email     = '';
  telephone = '';
  adresse   = '';
  notes     = '';

  // ── État ──
  etape: 'date' | 'creneau' | 'form' | 'succes' | 'erreur' = 'date';
  envoi     = false;
  msgErreur = '';

  // ── Helpers ──

  // ✅ CORRECTION BUG DATE : toISOString() convertit en UTC et décale d'un jour
  // en France (UTC+2). On formate manuellement en heure locale.
  private dateVersString(d: Date): string {
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const j = String(d.getDate()).padStart(2, '0');
    return `${y}-${m}-${j}`;
  }

  get joursCalendrier(): (Date | null)[] {
    const premier    = new Date(this.moisAffiche.getFullYear(), this.moisAffiche.getMonth(), 1);
    const dernier    = new Date(this.moisAffiche.getFullYear(), this.moisAffiche.getMonth() + 1, 0);
    const jours: (Date | null)[] = [];
    let premierJour  = premier.getDay();
    premierJour      = premierJour === 0 ? 6 : premierJour - 1;
    for (let i = 0; i < premierJour; i++) jours.push(null);
    for (let d = 1; d <= dernier.getDate(); d++) {
      jours.push(new Date(this.moisAffiche.getFullYear(), this.moisAffiche.getMonth(), d));
    }
    return jours;
  }

  get moisLabel(): string {
    return this.moisAffiche.toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' });
  }

  ngOnInit(): void {}

  moisPrecedent(): void {
    this.moisAffiche = new Date(this.moisAffiche.getFullYear(), this.moisAffiche.getMonth() - 1, 1);
    this.cdr.detectChanges();
  }

  moisSuivant(): void {
    this.moisAffiche = new Date(this.moisAffiche.getFullYear(), this.moisAffiche.getMonth() + 1, 1);
    this.cdr.detectChanges();
  }

  estPasse(d: Date): boolean {
    const aujourd = new Date();
    aujourd.setHours(0, 0, 0, 0);
    return d < aujourd;
  }

  estWeekend(d: Date): boolean {
    return d.getDay() === 0 || d.getDay() === 6;
  }

  // ✅ CORRECTION : utilise dateVersString() au lieu de toISOString()
  estSelectionne(d: Date): boolean {
    return this.dateVersString(d) === this.dateSelectionnee;
  }

  estCreneauPris(h: string): boolean {
    return this.creneauxPris.includes(h);
  }

  choisirDate(d: Date): void {
    if (this.estPasse(d) || this.estWeekend(d)) return;
    console.log('DEBUG date cliquée:', d, '→ string:', this.dateVersString(d)); // ← ajoute ça
    this.dateSelectionnee = this.dateVersString(d);
  
    if (this.estPasse(d) || this.estWeekend(d)) return;

    // ✅ CORRECTION : dateVersString() → date locale, plus de décalage UTC
    this.dateSelectionnee   = this.dateVersString(d);
    this.dateLabel          = d.toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
    this.creneauxPris       = [];
    this.chargementCreneaux = true;
    this.etape              = 'creneau';
    this.cdr.detectChanges();

    // Charge les créneaux déjà pris pour ce jour
    this.http.get<string[]>(`${environment.backendUrl}/rdv/creneaux-pris?date=${this.dateSelectionnee}`)
      .subscribe({
        next: pris => {
          this.creneauxPris       = pris;
          this.chargementCreneaux = false;
          this.cdr.detectChanges();
        },
        error: () => {
          // Erreur réseau : on laisse tous les créneaux disponibles
          this.chargementCreneaux = false;
          this.cdr.detectChanges();
        }
      });
  }

  choisirHeure(h: string): void {
    if (this.estCreneauPris(h)) return;
    this.heureSelectionnee = h;
    this.etape = 'form';
    this.cdr.detectChanges();
  }

  retourDate(): void    { this.etape = 'date'; this.heureSelectionnee = ''; }
  retourCreneau(): void { this.etape = 'creneau'; }

  async confirmer(): Promise<void> {
    if (!this.nom || !this.email || !this.telephone) return;
    this.envoi = true;
    try {
      const r = await fetch(`${environment.backendUrl}/rdv`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          nom:       this.nom,
          email:     this.email,
          telephone: this.telephone,
          adresse:   this.adresse,
          date:      this.dateSelectionnee,
          heure:     this.heureSelectionnee,
          service:   'diagnostic',
          rubrique:  'site',
          notes:     this.notes,
        }),
      });

      // Créneau pris au dernier moment (race condition)
      if (r.status === 409) {
        this.http.get<string[]>(`${environment.backendUrl}/rdv/creneaux-pris?date=${this.dateSelectionnee}`)
          .subscribe(pris => { this.creneauxPris = pris; this.cdr.detectChanges(); });
        this.msgErreur         = 'Ce créneau vient d\'être réservé. Veuillez en choisir un autre.';
        this.etape             = 'creneau';
        this.heureSelectionnee = '';
        return;
      }

      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      this.etape = 'succes';
    } catch {
      this.msgErreur = 'Une erreur est survenue. Veuillez réessayer.';
      this.etape     = 'erreur';
    } finally {
      this.envoi = false;
      this.cdr.detectChanges();
    }
  }
  
}