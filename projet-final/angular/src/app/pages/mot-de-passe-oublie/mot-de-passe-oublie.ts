import { Component, ViewEncapsulation, inject, signal, OnInit } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterLink, ActivatedRoute } from '@angular/router';
import { HttpErrorResponse } from '@angular/common/http';
import { UtilisateurService } from '../../services/utilisateur.service';
import { PanierService } from '../../services/panier.service';

@Component({
  selector: 'app-mot-de-passe-oublie',
  standalone: true,
  imports: [FormsModule, RouterLink],
  templateUrl: './mot-de-passe-oublie.html',
  styleUrls: ['./mot-de-passe-oublie.css'],
  encapsulation: ViewEncapsulation.None,
})
export class MotDePasseOublie implements OnInit {
  route = inject(ActivatedRoute);
  utilisateurService = inject(UtilisateurService);
  panier = inject(PanierService);

  chargement = signal(false);
  token = signal<string | null>(null);
  tokenExpiresIn = signal<number | null>(null);
  message = signal('');
  erreur = signal('');

  demande = { email: '' };
  reset = { nouveauMotDePasse: '', confirmerMotDePasse: '' };

  ngOnInit(): void {
    this.token.set(this.route.snapshot.queryParamMap.get('token'));
  }

  demanderLien(): void {
    if (!this.demande.email) {
      this.erreur.set('Veuillez saisir votre adresse e-mail.');
      return;
    }

    this.chargement.set(true);
    this.erreur.set('');
    this.message.set('');

    this.utilisateurService.forgotPassword(this.demande.email).subscribe({
      next: (response) => {
        this.chargement.set(false);
        this.message.set(response.message);
        this.tokenExpiresIn.set(response.token_expires_in);
        this.panier.notify('✓', 'E-mail envoyé', response.message);
      },
      error: (err: HttpErrorResponse) => {
        this.chargement.set(false);
        this.erreur.set(err?.error?.error || 'Impossible d’envoyer le lien de réinitialisation.');
      }
    });
  }

  reinitialiser(): void {
    if (!this.token()) {
      this.erreur.set('Lien de réinitialisation invalide.');
      return;
    }
    if (!this.reset.nouveauMotDePasse || !this.reset.confirmerMotDePasse) {
      this.erreur.set('Tous les champs sont obligatoires.');
      return;
    }
    if (this.reset.nouveauMotDePasse !== this.reset.confirmerMotDePasse) {
      this.erreur.set('Les mots de passe ne correspondent pas.');
      return;
    }
    if (this.reset.nouveauMotDePasse.length < 8) {
      this.erreur.set('Le mot de passe doit contenir au moins 8 caractères.');
      return;
    }

    this.chargement.set(true);
    this.erreur.set('');
    this.message.set('');

    this.utilisateurService.resetPassword(this.token()!, this.reset.nouveauMotDePasse).subscribe({
      next: () => {
        this.chargement.set(false);
        this.message.set('Votre mot de passe a été réinitialisé. Vous pouvez maintenant vous connecter.');
        this.panier.notify('✓', 'Mot de passe mis à jour', 'Réinitialisation réussie');
      },
      error: (err: HttpErrorResponse) => {
        this.chargement.set(false);
        this.erreur.set(err?.error?.error || 'Impossible de réinitialiser le mot de passe.');
      }
    });
  }
}
