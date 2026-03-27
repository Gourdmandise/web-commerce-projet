import { Component, inject, signal, OnInit } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { DatePipe } from '@angular/common';
import { HttpErrorResponse }   from '@angular/common/http';
import { PanierService }       from '../../services/panier.service';
import { UtilisateurService }  from '../../services/utilisateur.service';
import { CommandeService }     from '../../services/commande.service';
import { AuthService }         from '../../services/auth.service';
import { Utilisateur }         from '../../models/utilisateur.model';
import { Commande }            from '../../models/commande.model';

type VueLogin = 'connexion' | 'inscription';

@Component({
  selector: 'app-compte',
  standalone: true,
  imports: [FormsModule, RouterLink, DatePipe],
  templateUrl: './compte.html',
  styleUrls: ['./compte.css'],
})
export class Compte implements OnInit {
  panier             = inject(PanierService);
  auth               = inject(AuthService);
  utilisateurService = inject(UtilisateurService);
  commandeService    = inject(CommandeService);

  vueLogin   = signal<VueLogin>('connexion');
  chargement = signal(false);
  commandes  = signal<Commande[]>([]);

  login       = { email: '', motDePasse: '' };
  inscription = {
    email: '', motDePasse: '', confirmMotDePasse: '',
    prenom: '', nom: '',
    accepteCgu: false
  };
  profil: Partial<Utilisateur> = {};

  ngOnInit(): void {
    if (this.auth.connecte) {
      this.profil = { ...this.auth.utilisateur() };
      this.chargerCommandes();
    }
  }

  seConnecter(): void {
    if (!this.login.email || !this.login.motDePasse) {
      this.panier.notify('⚠', 'Champs requis', 'E-mail et mot de passe obligatoires');
      return;
    }
    this.chargement.set(true);

    // Authentification déléguée au backend — vérification bcrypt côté serveur
    this.utilisateurService.connecter(this.login.email, this.login.motDePasse).subscribe({
      next: ({ utilisateur }) => {
        this.chargement.set(false);
        this.auth.connecter(utilisateur);
        this.profil = { ...utilisateur };
        this.chargerCommandes();
        this.panier.notify('✓', `Bienvenue ${utilisateur.prenom} !`, 'Connexion réussie');
      },
      error: (err: HttpErrorResponse) => {
        this.chargement.set(false);
        if (err.status === 401) {
          this.panier.notify('⚠', 'Identifiants incorrects', 'E-mail ou mot de passe invalide');
        } else {
          this.panier.notify('⚠', 'Serveur inaccessible', 'Vérifiez que le backend tourne sur le port 3001');
        }
      }
    });
  }

  sInscrire(): void {
    if (!this.inscription.email || !this.inscription.motDePasse || !this.inscription.prenom) {
      this.panier.notify('⚠', 'Champs requis', 'E-mail, prénom et mot de passe obligatoires');
      return;
    }
    if (this.inscription.motDePasse !== this.inscription.confirmMotDePasse) {
      this.panier.notify('⚠', 'Mots de passe différents', 'Veuillez saisir le même mot de passe');
      return;
    }
    if (!this.inscription.accepteCgu) {
      this.panier.notify('⚠', 'CGU non acceptées', 'Vous devez accepter les conditions générales');
      return;
    }
    this.chargement.set(true);

    this.utilisateurService.inscrire(
      this.inscription.email,
      this.inscription.motDePasse,
      this.inscription.prenom,
      this.inscription.nom
    ).subscribe({
      next: ({ utilisateur }) => {
        this.chargement.set(false);
        this.auth.connecter(utilisateur);
        this.profil = { ...utilisateur };
        this.commandes.set([]);
        this.panier.notify('✓', 'Compte créé !', `Bienvenue ${utilisateur.prenom}`);
      },
      error: (err: HttpErrorResponse) => {
        this.chargement.set(false);
        if (err.status === 409) {
          this.panier.notify('⚠', 'Compte déjà existant', 'Cet e-mail est déjà utilisé');
        } else {
          const detail = err?.error?.error || err?.message || 'Erreur inconnue';
          this.panier.notify('⚠', 'Erreur', detail);
        }
      }
    });
  }

  sauvegarder(): void {
    const user = this.auth.utilisateur();
    if (!user?.id) return;
    const { motDePasse, ...profilSansMotDePasse } = this.profil as Utilisateur;
    this.utilisateurService.mettreAJour(user.id, profilSansMotDePasse).subscribe({
      next: (updated) => {
        this.auth.connecter(updated);
        this.panier.notify('✓', 'Profil mis à jour', 'Sauvegarde effectuée');
      },
      error: () => this.panier.notify('⚠', 'Erreur', 'Impossible de sauvegarder')
    });
  }

  annulerCommande(commande: Commande): void {
    if (!confirm(`Annuler la commande "${commande.notes}" ?\n\nVous serez remboursé sous 14 jours conformément à nos CGV.`)) return;
    const annulables: string[] = ['en_attente', 'paiement_confirme'];
    if (!annulables.includes(commande.statut)) {
      this.panier.notify('⚠', 'Annulation impossible',
        'L\'intervention est déjà planifiée. Contactez-nous : contact@x3com.com');
      return;
    }
    this.commandeService.changerStatut(commande.id!, 'annulee' as any).subscribe({
      next: () => {
        this.chargerCommandes();
        this.panier.notify('✓', 'Commande annulée', 'Remboursement sous 14 jours ouvrés');
      },
      error: () => this.panier.notify('⚠', 'Erreur', 'Contactez contact@x3com.com')
    });
  }

  seDeconnecter(): void {
    this.auth.deconnecter();
    this.commandes.set([]);
    this.login       = { email: '', motDePasse: '' };
    this.inscription = { email: '', motDePasse: '', confirmMotDePasse: '', prenom: '', nom: '', accepteCgu: false };
    this.profil      = {};
  }

  private chargerCommandes(): void {
    const id = this.auth.utilisateur()?.id;
    if (!id) return;
    this.commandeService.getByUtilisateur(id).subscribe({
      next: (data) => this.commandes.set(data),
      error: () => this.commandes.set([])
    });
  }

  statutLabel(statut: string): string {
    const labels: Record<string, string> = {
      'en_attente':        'En attente',
      'paiement_confirme': 'Payé',
      'planification':     'En cours',
      'intervention':      'Intervention',
      'termine':           'Terminé',
      'annulee':           'Annulée'
    };
    return labels[statut] ?? statut;
  }

  statutCouleur(statut: string): string {
    if (statut === 'annulee') return 'mu';
    return ['intervention', 'termine'].includes(statut) ? 'em' : 'cy';
  }

  peutAnnuler(statut: string): boolean {
    return ['en_attente', 'paiement_confirme'].includes(statut);
  }

  etapesCommande(statut: string) {
    const etapes = [
      { label: 'Commande reçue',   key: 'paiement_confirme' },
      { label: 'Planification',    key: 'planification' },
      { label: 'Intervention',     key: 'intervention' },
      { label: 'Rapport transmis', key: 'termine' },
    ];
    const ordre = ['paiement_confirme', 'planification', 'intervention', 'termine'];
    const idx   = ordre.indexOf(statut);
    return etapes.map((e, i) => ({
      ...e,
      etat: i < idx ? 'done' : i === idx ? 'active' : 'pending'
    }));
  }
}
