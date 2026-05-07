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

  chargement     = signal(false);
  annule         = signal(false);
  nombreLogements = signal<number>(1);

  ngOnInit(): void {
    this.route.queryParams.subscribe(p => {
      if (p['annule']) this.annule.set(true);
    });
  }

  get estParLogement(): boolean {
    return (this.panier.offre()?.prixsuffix ?? '').toLowerCase().includes('logement');
  }

  get prixUnitaire(): number {
    return this.panier.offre()?.prix ?? 0;
  }

  // TVA incluse dans le prix TTC : tva = total × 20/120
  get tva()   { return Math.round(this.total * 20 / 120); }
  get total() { return this.estParLogement ? this.prixUnitaire * this.nombreLogements() : this.prixUnitaire; }

  incLogements(): void { this.nombreLogements.update(n => n + 1); }
  decLogements(): void { this.nombreLogements.update(n => Math.max(1, n - 1)); }
  setLogements(e: Event): void {
    const val = parseInt((e.target as HTMLInputElement).value) || 1;
    this.nombreLogements.set(Math.max(1, val));
  }

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

    const nomFinal = this.estParLogement
      ? `${offre.nom} — ${this.nombreLogements()} logement(s)`
      : offre.nom;

    this.stripe.createCheckoutSession({
      offreId:       offre.id!,
      prix:          this.total,
      nom:           nomFinal,
      utilisateurId: user.id!,
      emailClient:   user.email,
      prenom:        user.prenom    || '',
      nomClient:     user.nom       || '',
      telephone:     user.telephone || '',
    }).subscribe({
      next:  (session) => { window.location.href = session.url; },
      error: (err) => {
        this.chargement.set(false);
        console.error(err);
        this.panier.notify('⚠', 'Erreur de connexion', 'Le backend n\'est pas démarré (port 3001)');
      }
    });
  }
}