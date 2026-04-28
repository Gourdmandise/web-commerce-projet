import { Component, ViewEncapsulation, inject, signal, OnInit } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router, ActivatedRoute, RouterLink } from '@angular/router';
import { PanierService }  from '../../services/panier.service';
import { AuthService }    from '../../services/auth.service';
import { StripeService }  from '../../services/stripe.service';

@Component({
  selector: 'app-paiement',
  standalone: true,
  imports: [FormsModule, RouterLink],
  templateUrl: './paiement.html',
  styleUrls: ['./paiement.css'],
  encapsulation: ViewEncapsulation.None,
})
export class Paiement implements OnInit {
  panier  = inject(PanierService);
  auth    = inject(AuthService);
  stripe  = inject(StripeService);
  router  = inject(Router);
  route   = inject(ActivatedRoute);

  chargement = signal(false);
  annule     = signal(false);

  ngOnInit(): void {
    this.route.queryParams.subscribe(p => {
      if (p['annule']) this.annule.set(true);
    });
  }

  // TVA incluse dans le prix TTC : tva = prix × 20/120, pas prix × 20%
  get tva()   { return Math.round((this.panier.offre()?.prix ?? 0) * 20 / 120); }
  get total() { return this.panier.offre()?.prix ?? 0; }

  payer(): void {
    const offre = this.panier.offre();
    const user  = this.auth.utilisateur();

    if (!offre) {
      this.panier.notify('⚠', 'Aucune offre sélectionnée', 'Retournez sur la page Tarifs');
      return;
    }
    if (!user?.id) {
      this.panier.notify('⚠', 'Connexion requise', 'Veuillez vous connecter');
      this.router.navigateByUrl('/compte');
      return;
    }

    this.chargement.set(true);

    this.stripe.createCheckoutSession({
      offreId:       offre.id!,
      prix:          offre.prix,
      nom:           offre.nom,
      utilisateurId: user.id!,
      emailClient:   user.email,
      prenom:        user.prenom       || '',
      nomClient:     user.nom          || '',
      telephone:     user.telephone    || '',
    }).subscribe({
      next: (session) => {
        window.location.href = session.url;
      },
      error: (err) => {
        this.chargement.set(false);
        console.error(err);
        this.panier.notify('⚠', 'Erreur de connexion', 'Le backend n\'est pas démarré (port 3001)');
      }
    });
  }
}