import { Component, inject, signal, OnInit } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { DatePipe } from '@angular/common';
import { PanierService }      from '../../services/panier.service';
import { UtilisateurService } from '../../services/utilisateur.service';
import { CommandeService }    from '../../services/commande.service';
import { AuthService }        from '../../services/auth.service';
import { HashService }        from '../../services/hash.service';
import { Utilisateur }        from '../../models/utilisateur.model';
import { Commande }           from '../../models/commande.model';

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
  hash               = inject(HashService);
  utilisateurService = inject(UtilisateurService);
  commandeService    = inject(CommandeService);

  vueLogin   = signal<VueLogin>('connexion');
  chargement = signal(false);
  commandes  = signal<Commande[]>([]);

  login        = { email: '', motDePasse: '' };
  inscription  = { email: '', motDePasse: '', confirmMotDePasse: '', prenom: '', nom: '' };
  profil: Partial<Utilisateur> = {};

  ngOnInit(): void {
    if (this.auth.connecte) {
      this.profil = { ...this.auth.utilisateur() };
      this.chargerCommandes();
    }
  }

  async seConnecter(): Promise<void> {
    if (!this.login.email || !this.login.motDePasse) {
      this.panier.notify('⚠', 'Champs requis', 'E-mail et mot de passe obligatoires');
      return;
    }
    this.chargement.set(true);
    const hashMdp = await this.hash.hash(this.login.motDePasse);

    this.utilisateurService.getByEmailEtMotDePasse(this.login.email, hashMdp).subscribe({
      next: (resultats) => {
        this.chargement.set(false);
        if (resultats.length > 0) {
          const user = resultats[0];
          this.auth.connecter(user);
          this.profil = { ...user };
          this.chargerCommandes();
          this.panier.notify('✓', `Bienvenue ${user.prenom} !`, 'Connexion réussie');
        } else {
          this.panier.notify('⚠', 'Identifiants incorrects', 'E-mail ou mot de passe invalide');
        }
      },
      error: () => {
        this.chargement.set(false);
        this.panier.notify('⚠', 'BDD inaccessible', 'Vérifiez que json-server tourne sur le port 3000');
      }
    });
  }

  async sInscrire(): Promise<void> {
    if (!this.inscription.email || !this.inscription.motDePasse || !this.inscription.prenom) {
      this.panier.notify('⚠', 'Champs requis', 'E-mail, prénom et mot de passe obligatoires');
      return;
    }
    if (this.inscription.motDePasse !== this.inscription.confirmMotDePasse) {
      this.panier.notify('⚠', 'Mots de passe différents', 'Veuillez saisir le même mot de passe');
      return;
    }
    this.chargement.set(true);

    this.utilisateurService.getByEmail(this.inscription.email).subscribe({
      next: async (existants) => {
        if (existants.length > 0) {
          this.chargement.set(false);
          this.panier.notify('⚠', 'Compte déjà existant', 'Cet e-mail est déjà utilisé');
          return;
        }
        const hashMdp = await this.hash.hash(this.inscription.motDePasse);
        const nouveau: Omit<Utilisateur, 'id'> = {
          email:      this.inscription.email,
          motDePasse: hashMdp,
          prenom:     this.inscription.prenom,
          nom:        this.inscription.nom || '',
          role:       'client'
        };
        this.utilisateurService.creer(nouveau).subscribe({
          next: (created) => {
            this.chargement.set(false);
            this.auth.connecter(created);
            this.profil = { ...created };
            this.commandes.set([]);
            this.panier.notify('✓', 'Compte créé !', `Bienvenue ${created.prenom}`);
          },
          error: () => {
            this.chargement.set(false);
            this.panier.notify('⚠', 'Erreur', 'Impossible de créer le compte');
          }
        });
      },
      error: () => {
        this.chargement.set(false);
        this.panier.notify('⚠', 'Erreur', 'BDD inaccessible');
      }
    });
  }

  sauvegarder(): void {
    const user = this.auth.utilisateur();
    if (!user?.id) return;
    // Ne jamais écraser le mot de passe depuis ce formulaire
    const { motDePasse, ...profilSansMotDePasse } = this.profil as Utilisateur;
    this.utilisateurService.mettreAJour(user.id, profilSansMotDePasse).subscribe({
      next: (updated) => {
        this.auth.connecter(updated);
        this.panier.notify('✓', 'Profil mis à jour', 'Sauvegarde effectuée');
      },
      error: () => this.panier.notify('⚠', 'Erreur', 'Impossible de sauvegarder')
    });
  }

  seDeconnecter(): void {
    this.auth.deconnecter();
    this.commandes.set([]);
    this.login = { email: '', motDePasse: '' };
    this.inscription = { email: '', motDePasse: '', confirmMotDePasse: '', prenom: '', nom: '' };
    this.profil = {};
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
      'termine':           'Terminé'
    };
    return labels[statut] ?? statut;
  }

  statutCouleur(statut: string): string {
    return ['intervention', 'termine'].includes(statut) ? 'em' : 'cy';
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
