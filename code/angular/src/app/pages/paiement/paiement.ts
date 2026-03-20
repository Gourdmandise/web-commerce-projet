import { Component, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { PanierService }   from '../../services/panier.service';
import { AuthService }     from '../../services/auth.service';
import { CommandeService } from '../../services/commande.service';

@Component({
  selector: 'app-paiement',
  standalone: true,
  imports: [FormsModule],
  templateUrl: './paiement.html',
  styleUrls: ['./paiement.css'],
})
export class Paiement {
  panier         = inject(PanierService);
  auth           = inject(AuthService);
  commandeService = inject(CommandeService);
  router         = inject(Router);

  carte = { numero: '', nom: '', expiration: '', cvv: '' };
  carteAffichee = signal('•••• •••• •••• ••••');
  nomAffiche    = signal('Votre nom');
  expAffichee   = signal('MM/AA');

  get tva()   { return Math.round((this.panier.offre()?.prix ?? 0) * 0.2); }
  get total() { return this.panier.offre()?.prix ?? 0; }

  onNumero(val: string): void {
    const raw = val.replace(/\D/g, '').substring(0, 16);
    this.carte.numero = raw.replace(/(.{4})/g, '$1 ').trim();
    const p = raw.padEnd(16, '•').replace(/(.{4})/g, '$1 ').trim();
    this.carteAffichee.set(p);
  }

  payer(): void {
    if (!this.carte.numero || !this.carte.nom) {
      this.panier.notify('⚠', 'Champs manquants', 'Veuillez compléter le formulaire');
      return;
    }

    const offre = this.panier.offre();
    const user  = this.auth.utilisateur();

    if (!offre || !user?.id) {
      this.panier.notify('⚠', 'Erreur', 'Offre ou utilisateur manquant');
      return;
    }

    // Créer la commande en BDD
    this.commandeService.creer({
      utilisateurId:      user.id,
      offreId:            offre.id!,
      statut:             'paiement_confirme',
      prix:               offre.prix,
      notes:              offre.nom,
      adresseIntervention: user.adresse ? `${user.adresse}, ${user.codePostal} ${user.ville}` : '',
      operateur:          ''
    }).subscribe({
      next: () => {
        this.panier.notify('✓', 'Paiement confirmé !', 'Commande enregistrée');
        setTimeout(() => this.router.navigateByUrl('/commande'), 900);
      },
      error: () => {
        this.panier.notify('⚠', 'Erreur BDD', 'Commande non enregistrée');
        setTimeout(() => this.router.navigateByUrl('/commande'), 900);
      }
    });
  }
}
