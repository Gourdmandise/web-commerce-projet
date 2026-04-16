import { Component, ViewEncapsulation, inject, signal, OnInit } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { DatePipe } from '@angular/common';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { PanierService }      from '../../services/panier.service';
import { UtilisateurService } from '../../services/utilisateur.service';
import { CommandeService }    from '../../services/commande.service';
import { OffreService }       from '../../services/offre.service';
import { AuthService }        from '../../services/auth.service';

import { Utilisateur }        from '../../models/utilisateur.model';
import { Commande, StatutCommande } from '../../models/commande.model';
import { Offre } from '../../models/offre.model';
import { environment } from '../../../environments/environment';

export interface Rdv {
  id: number; nom: string; email: string; telephone: string; adresse: string;
  date: string; heure: string; service: string; rubrique: string; notes: string;
  statut: 'en_attente' | 'confirme' | 'annule'; datecreation: string;
}
type FiltreRdv = 'tous' | 'en_attente' | 'confirme' | 'annule';
type OngletAdmin = 'utilisateurs' | 'commandes' | 'offres' | 'rdv';

@Component({
  selector: 'app-admin',
  standalone: true,
  imports: [FormsModule, DatePipe],
  templateUrl: './admin.html',
  styleUrls: ['./admin.css'],
  encapsulation: ViewEncapsulation.None,
})
export class Admin implements OnInit {
  panier             = inject(PanierService);
  utilisateurService = inject(UtilisateurService);
  commandeService    = inject(CommandeService);
  offreService       = inject(OffreService);
  private http       = inject(HttpClient);
  private auth       = inject(AuthService);

  onglet       = signal<OngletAdmin>('utilisateurs');
  utilisateurs = signal<Utilisateur[]>([]);
  commandes    = signal<Commande[]>([]);
  offres       = signal<Offre[]>([]);
  stats        = signal<any | null>(null);
  statsChargement = false;

  // ── RDV ──
  rdvs          = signal<Rdv[]>([]);
  rdvFiltre     = signal<FiltreRdv>('tous');
  rdvChargement = false;

  get rdvFiltres(): Rdv[] {
    const f = this.rdvFiltre();
    if (f === 'tous') return this.rdvs();
    return this.rdvs().filter(r => r.statut === f);
  }

  get rdvNbParStatut() {
    const all = this.rdvs();
    return {
      tous:       all.length,
      en_attente: all.filter(r => r.statut === 'en_attente').length,
      confirme:   all.filter(r => r.statut === 'confirme').length,
      annule:     all.filter(r => r.statut === 'annule').length,
    };
  }

  private rdvHeaders(): HttpHeaders {
    const token = this.auth.getToken();
    return new HttpHeaders(token ? { Authorization: `Bearer ${token}` } : {});
  }

  // ── Édition utilisateur ──
  editUser: Utilisateur | null = null;
  nouveauMotDePasse = '';

  // ── Édition commande ──
  editCommande: Commande | null = null;

  // ── Édition offre ──
  editOffre: Partial<Offre> | null = null;
  modeOffre: 'creation' | 'edition' = 'creation';
  editFeature  = '';
  editOption   = '';

  readonly statuts: StatutCommande[] = [
    'en_attente', 'paiement_confirme', 'planification', 'intervention', 'termine', 'annulee'
  ];

  ngOnInit(): void {
    this.chargerTout();
  }

  chargerTout(): void {
    this.utilisateurService.getAll().subscribe(d => this.utilisateurs.set(d));
    this.commandeService.getAll().subscribe(d => this.commandes.set(d));
    this.offreService.getAll().subscribe(d => this.offres.set(d));
    this.chargerRdvs();
    this.chargerStats();
  }

  chargerStats(): void {
    this.statsChargement = true;
    this.http.get<any>(`${environment.backendUrl}/stats`, { headers: this.rdvHeaders() })
      .subscribe({
        next: data => { this.stats.set(data); this.statsChargement = false; },
        error: () => { this.stats.set(null); this.statsChargement = false; }
      });
  }

  chargerRdvs(): void {
    this.rdvChargement = true;
    this.http.get<Rdv[]>(`${environment.backendUrl}/rdv`, { headers: this.rdvHeaders() })
      .subscribe({ next: d => { this.rdvs.set(d); this.rdvChargement = false; }, error: () => { this.rdvChargement = false; } });
  }

  changerStatutRdv(rdv: Rdv, statut: 'confirme' | 'annule' | 'en_attente'): void {
    this.http.patch<Rdv>(`${environment.backendUrl}/rdv/${rdv.id}/statut`, { statut }, { headers: this.rdvHeaders() })
      .subscribe({
        next: updated => {
          this.rdvs.update(list => list.map(r => r.id === updated.id ? updated : r));
          this.panier.notify('✓', 'RDV mis à jour', `${updated.nom} — ${statut}`);
        },
        error: () => this.panier.notify('⚠', 'Erreur', 'Impossible de mettre à jour le RDV')
      });
  }

  formatDateRdv(dateStr: string): string {
    if (!dateStr) return '';
    const d = new Date(dateStr + 'T00:00:00');
    return d.toLocaleDateString('fr-FR', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' });
  }

  // ════════════════════════════════
  // UTILISATEURS
  // ════════════════════════════════

  ouvrirEditUser(u: Utilisateur): void {
    this.editUser = { ...u };
    this.nouveauMotDePasse = '';
  }

  fermerEditUser(): void {
    this.editUser = null;
    this.nouveauMotDePasse = '';
  }

  sauvegarderUser(): void {
    if (!this.editUser?.id) return;
    const { motDePasse, ...data } = this.editUser as any;
    const id = this.editUser.id;

    // Si un nouveau mot de passe est saisi, on le change via le backend (bcrypt serveur)
    const changeMdp$ = this.nouveauMotDePasse.trim()
      ? this.utilisateurService.changerMotDePasse(id, this.nouveauMotDePasse.trim())
      : null;

    const save = () => this.utilisateurService.mettreAJour(id, data).subscribe({
      next: (updated) => {
        this.utilisateurs.update(list => list.map(u => u.id === updated.id ? updated : u));
        this.panier.notify('✓', 'Utilisateur mis à jour', updated.email);
        this.fermerEditUser();
      },
      error: () => this.panier.notify('⚠', 'Erreur', 'Impossible de sauvegarder')
    });

    if (changeMdp$) {
      changeMdp$.subscribe({ next: () => save(), error: () => save() });
    } else {
      save();
    }
  }

  supprimerUser(u: Utilisateur): void {
    if (!confirm(`Supprimer le compte de ${u.prenom} ${u.nom} ?`)) return;
    this.utilisateurService.supprimer(u.id!).subscribe({
      next: () => {
        this.utilisateurs.update(list => list.filter(x => x.id !== u.id));
        this.panier.notify('✓', 'Compte supprimé', u.email);
      },
      error: () => this.panier.notify('⚠', 'Erreur', 'Impossible de supprimer')
    });
  }

  commandesDe(userId: number): Commande[] {
    return this.commandes().filter(c => c.utilisateurId === userId);
  }

  nomUtilisateur(id: number): string {
    const u = this.utilisateurs().find(x => x.id === id);
    return u ? `${u.prenom} ${u.nom}` : `#${id}`;
  }

  // ════════════════════════════════
  // COMMANDES
  // ════════════════════════════════

  ouvrirEditCommande(c: Commande): void {
    this.editCommande = { ...c };
  }

  fermerEditCommande(): void {
    this.editCommande = null;
  }

  sauvegarderCommande(): void {
    if (!this.editCommande?.id) return;
    this.commandeService.changerStatut(this.editCommande.id, this.editCommande.statut).subscribe({
      next: (updated) => {
        this.commandes.update(list => list.map(c => c.id === updated.id ? updated : c));
        this.panier.notify('✓', 'Statut mis à jour', this.statutLabel(updated.statut));
        this.fermerEditCommande();
      },
      error: () => this.panier.notify('⚠', 'Erreur', 'Impossible de mettre à jour')
    });
  }

  supprimerCommande(c: Commande): void {
    if (!confirm(`Supprimer la commande #${c.id} ?`)) return;
    this.commandeService.supprimer(c.id!).subscribe({
      next: () => {
        this.commandes.update(list => list.filter(x => x.id !== c.id));
        this.panier.notify('✓', 'Commande supprimée', `#${c.id}`);
      },
      error: () => this.panier.notify('⚠', 'Erreur', 'Impossible de supprimer')
    });
  }

  // ════════════════════════════════
  // OFFRES
  // ════════════════════════════════

  nouvelleOffre(): void {
    this.modeOffre = 'creation';
    this.editOffre = {
      nom: '', prix: 0, description: '', surface: '',
      populaire: false, features: [], options: []
    };
    this.editFeature = '';
    this.editOption  = '';
  }

  ouvrirEditOffre(o: Offre): void {
    this.modeOffre = 'edition';
    this.editOffre = {
      ...o,
      features: [...o.features],
      options:  [...o.options]
    };
    this.editFeature = '';
    this.editOption  = '';
  }

  fermerEditOffre(): void {
    this.editOffre = null;
  }

  ajouterFeature(): void {
    if (!this.editFeature.trim() || !this.editOffre) return;
    this.editOffre.features = [...(this.editOffre.features ?? []), this.editFeature.trim()];
    this.editFeature = '';
  }

  supprimerFeature(i: number): void {
    if (!this.editOffre?.features) return;
    this.editOffre.features = this.editOffre.features.filter((_, idx) => idx !== i);
  }

  ajouterOption(): void {
    if (!this.editOption.trim() || !this.editOffre) return;
    this.editOffre.options = [...(this.editOffre.options ?? []), this.editOption.trim()];
    this.editOption = '';
  }

  supprimerOption(i: number): void {
    if (!this.editOffre?.options) return;
    this.editOffre.options = this.editOffre.options.filter((_, idx) => idx !== i);
  }

  sauvegarderOffre(): void {
    if (!this.editOffre) return;

    if (this.modeOffre === 'creation') {
      this.offreService.creer(this.editOffre as Omit<Offre, 'id'>).subscribe({
        next: (created) => {
          this.offres.update(list => [...list, created]);
          this.panier.notify('✓', 'Offre créée', created.nom);
          this.fermerEditOffre();
        },
        error: () => this.panier.notify('⚠', 'Erreur', 'Impossible de créer')
      });
    } else {
      const id = (this.editOffre as Offre).id!;
      this.offreService.modifier(id, this.editOffre).subscribe({
        next: (updated) => {
          this.offres.update(list => list.map(o => o.id === updated.id ? updated : o));
          this.panier.notify('✓', 'Offre mise à jour', updated.nom);
          this.fermerEditOffre();
        },
        error: () => this.panier.notify('⚠', 'Erreur', 'Impossible de modifier')
      });
    }
  }

  monterOffre(o: Offre): void {
    const list = [...this.offres()];
    const idx = list.findIndex(x => x.id === o.id);
    if (idx <= 0) return;
    [list[idx - 1], list[idx]] = [list[idx], list[idx - 1]];
    this.offres.set(list);
    this.sauvegarderOrdre(list);
  }

  descendreOffre(o: Offre): void {
    const list = [...this.offres()];
    const idx = list.findIndex(x => x.id === o.id);
    if (idx < 0 || idx >= list.length - 1) return;
    [list[idx], list[idx + 1]] = [list[idx + 1], list[idx]];
    this.offres.set(list);
    this.sauvegarderOrdre(list);
  }

  private sauvegarderOrdre(list: Offre[]): void {
    const ordre = list.map((o, i) => ({ id: o.id!, ordre: i }));
    this.offreService.reordonner(ordre).subscribe({
      next: () => this.panier.notify('✓', 'Ordre sauvegardé', ''),
      error: () => this.panier.notify('⚠', 'Erreur', 'Impossible de sauvegarder l\'ordre')
    });
  }

  supprimerOffre(o: Offre): void {
    if (!confirm(`Supprimer l'offre "${o.nom}" ?`)) return;
    this.offreService.supprimer(o.id!).subscribe({
      next: () => {
        this.offres.update(list => list.filter(x => x.id !== o.id));
        this.panier.notify('✓', 'Offre supprimée', o.nom);
      },
      error: () => this.panier.notify('⚠', 'Erreur', 'Impossible de supprimer')
    });
  }

  // ════════════════════════════════
  // HELPERS
  // ════════════════════════════════

  statutLabel(statut: string): string {
    const labels: Record<string, string> = {
      'en_attente':        'En attente',
      'paiement_confirme': 'Payé',
      'planification':     'En cours',
      'intervention':      'Intervention',
      'termine':           'Terminé'
    };
    return labels[statut] ?? statut;
  }

  statutCouleur(statut: string): string {
    return ['intervention', 'termine'].includes(statut) ? 'em' : 'cy';
  }
}