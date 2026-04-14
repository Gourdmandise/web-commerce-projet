import { Component, ViewEncapsulation, ChangeDetectorRef, inject } from '@angular/core';
import { RouterLink } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { environment } from '../../../../environments/environment';

@Component({
  selector: 'app-aide-travaux',
  standalone: true,
  imports: [RouterLink, FormsModule],
  templateUrl: './aide-travaux.html',
  styleUrls: ['./aide-travaux.css'],
  encapsulation: ViewEncapsulation.None,
})
export class AideTravaux {
  private cdr = inject(ChangeDetectorRef);

  // ── SIMULATEUR ──
  simulEtape: 'profil' | 'questions' | 'revenu' | 'resultat' = 'profil';
  simulProfil: 'particulier' | 'tpe' | null = null;
  simulReponses: {
    echecs_raccordement?: boolean;
    proprietaire?: boolean;
    premiere_demande?: boolean;
    echecs_pro?: boolean;
    ca_salaries?: boolean;
    activite_ok?: boolean;
    revenu_fiscal?: number;
    parts_fiscales?: number;
    ca_actual?: number;
    effectif?: number;
  } = {};
  simulMontant: number = 0;
  simulMessage: string = '';
  simulEligible: boolean = false;

  choisirProfil(profil: 'particulier' | 'tpe') {
    this.simulProfil = profil;
    this.simulReponses = {};
    this.simulEtape = 'questions';
  }

  repondrQuestion(key: string, value: boolean) {
    (this.simulReponses as any)[key] = value;
  }

  allerRevenu() {
    this.simulEtape = 'revenu';
  }

  retourQuestions() {
    this.simulEtape = 'questions';
  }

  retourProfil() {
    this.simulProfil = null;
    this.simulEtape = 'profil';
    this.simulReponses = {};
  }

  determineEligibility() {
    let eligible = false;

    if (this.simulProfil === 'particulier') {
      const rfParPart = (this.simulReponses.revenu_fiscal || 0) / (this.simulReponses.parts_fiscales || 1);

      eligible =
        !!this.simulReponses.echecs_raccordement &&
        !!this.simulReponses.proprietaire &&
        !!this.simulReponses.premiere_demande &&
        rfParPart < 29361;

      this.simulEligible = eligible;

      if (eligible) {
        const rf = rfParPart;
        if (rf < 15000) {
          this.simulMontant = 1200;
        } else if (rf < 25000) {
          this.simulMontant = 800;
        } else {
          this.simulMontant = 400;
        }
        this.simulMessage = `✅ Vous êtes éligible ! Montant estimé : ${this.simulMontant}€`;
      } else {
        this.simulMessage = '❌ Vous ne remplissez pas tous les critères d\'éligibilité.';
      }
    } else if (this.simulProfil === 'tpe') {
      eligible =
        !!this.simulReponses.echecs_pro &&
        !!this.simulReponses.ca_salaries &&
        !!this.simulReponses.activite_ok;

      this.simulEligible = eligible;

      if (eligible) {
        this.simulMontant = 2000;
        this.simulMessage = '✅ Votre entreprise est éligible ! Montant estimé : 2 000€';
      } else {
        this.simulMessage = '❌ Votre entreprise ne remplissez pas les critères d\'éligibilité.';
      }
    }

    this.simulEtape = 'resultat';
    this.cdr.detectChanges();
  }

  // ── CALENDRIER RDV ──
  today        = new Date();
  moisAffiche  = new Date(this.today.getFullYear(), this.today.getMonth(), 1);
  dateSelectionnee = '';
  dateLabel        = '';

  // ── CRÉNEAU RDV ──
  creneaux = ['09:00','09:30','10:00','10:30','11:00','11:30','14:00','14:30','15:00','15:30','16:00','16:30'];
  heureSelectionnee = '';

  // ── FORMULAIRE RDV ──
  rdvNom     = '';
  rdvEmail   = '';
  rdvTel     = '';
  rdvAdresse = '';
  rdvNotes   = '';

  // ── ÉTAT RDV ──
  rdvEtape: 'date' | 'creneau' | 'form' | 'succes' | 'erreur' = 'date';
  rdvEnvoi  = false;
  rdvErreur = '';

  get moisLabel(): string {
    return this.moisAffiche.toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' });
  }

  get joursCalendrier(): (Date | null)[] {
    const premier = new Date(this.moisAffiche.getFullYear(), this.moisAffiche.getMonth(), 1);
    const dernier = new Date(this.moisAffiche.getFullYear(), this.moisAffiche.getMonth() + 1, 0);
    const jours: (Date | null)[] = [];
    let premierJour = premier.getDay();
    premierJour = premierJour === 0 ? 6 : premierJour - 1;
    for (let i = 0; i < premierJour; i++) jours.push(null);
    for (let d = 1; d <= dernier.getDate(); d++) {
      jours.push(new Date(this.moisAffiche.getFullYear(), this.moisAffiche.getMonth(), d));
    }
    return jours;
  }

  moisPrecedent(): void {
    this.moisAffiche = new Date(this.moisAffiche.getFullYear(), this.moisAffiche.getMonth() - 1, 1);
  }

  moisSuivant(): void {
    this.moisAffiche = new Date(this.moisAffiche.getFullYear(), this.moisAffiche.getMonth() + 1, 1);
  }

  estPasse(d: Date): boolean {
    const auj = new Date(); auj.setHours(0, 0, 0, 0); return d < auj;
  }

  estWeekend(d: Date): boolean { return d.getDay() === 0 || d.getDay() === 6; }

  private dateVersString(d: Date): string {
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const j = String(d.getDate()).padStart(2, '0');
    return `${y}-${m}-${j}`;
  }

  estSelectionne(d: Date): boolean {
    return this.dateVersString(d) === this.dateSelectionnee;
  }

  choisirDate(d: Date): void {
    if (this.estPasse(d) || this.estWeekend(d)) return;
    this.dateSelectionnee = this.dateVersString(d);
    this.dateLabel = d.toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
    this.rdvEtape = 'creneau';
    this.cdr.detectChanges();
  }

  choisirHeure(h: string): void {
    this.heureSelectionnee = h;
    this.rdvEtape = 'form';
    this.cdr.detectChanges();
  }

  async confirmerRdv(): Promise<void> {
    if (!this.rdvNom || !this.rdvEmail || !this.rdvTel) return;
    this.rdvEnvoi = true;
    try {
      const r = await fetch(`${environment.backendUrl}/rdv`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          nom: this.rdvNom, email: this.rdvEmail,
          telephone: this.rdvTel, adresse: this.rdvAdresse,
          date: this.dateSelectionnee, heure: this.heureSelectionnee,
          service: 'diagnostic', rubrique: 'aide-travaux', notes: this.rdvNotes,
        }),
      });
      if (!r.ok) throw new Error();
      this.rdvEtape = 'succes';
    } catch {
      this.rdvErreur = 'Une erreur est survenue. Veuillez réessayer.';
      this.rdvEtape = 'erreur';
    } finally {
      this.rdvEnvoi = false;
      this.cdr.detectChanges();
    }
  }
}