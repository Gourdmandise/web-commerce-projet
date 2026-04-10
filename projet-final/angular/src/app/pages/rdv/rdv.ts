import { Component, OnInit, ViewEncapsulation, signal, ChangeDetectorRef, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
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
  private cdr = inject(ChangeDetectorRef);

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
  heureSelectionnee = '';

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

  get joursCalendrier(): (Date | null)[] {
    const premier = new Date(this.moisAffiche.getFullYear(), this.moisAffiche.getMonth(), 1);
    const dernier = new Date(this.moisAffiche.getFullYear(), this.moisAffiche.getMonth() + 1, 0);
    const jours: (Date | null)[] = [];
    // Padding début (lundi = 1, dimanche = 0 → 6)
    let premierJour = premier.getDay(); // 0=dim
    premierJour = premierJour === 0 ? 6 : premierJour - 1; // lundi = 0
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

  choisirDate(d: Date): void {
    if (this.estPasse(d) || this.estWeekend(d)) return;
    this.dateSelectionnee = d.toISOString().split('T')[0];
    this.dateLabel = d.toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
    this.etape = 'creneau';
    this.cdr.detectChanges();
  }

  estSelectionne(d: Date): boolean {
    return d.toISOString().split('T')[0] === this.dateSelectionnee;
  }

  choisirHeure(h: string): void {
    this.heureSelectionnee = h;
    this.etape = 'form';
    this.cdr.detectChanges();
  }

  retourDate(): void { this.etape = 'date'; this.heureSelectionnee = ''; }
  retourCreneau(): void { this.etape = 'creneau'; }

  async confirmer(): Promise<void> {
    if (!this.nom || !this.email || !this.telephone) return;
    this.envoi = true;
    try {
      const r = await fetch(`${environment.backendUrl}/rdv`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          nom: this.nom,
          email: this.email,
          telephone: this.telephone,
          adresse: this.adresse,
          date: this.dateSelectionnee,
          heure: this.heureSelectionnee,
          service: 'diagnostic',
          rubrique: 'site',
          notes: this.notes,
        }),
      });
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      this.etape = 'succes';
    } catch (e: any) {
      this.msgErreur = 'Une erreur est survenue. Veuillez réessayer.';
      this.etape = 'erreur';
    } finally {
      this.envoi = false;
      this.cdr.detectChanges();
    }
  }
}