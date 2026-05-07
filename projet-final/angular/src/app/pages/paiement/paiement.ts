import { Component, ViewEncapsulation, inject, signal, OnInit, effect } from '@angular/core';
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

  chargement      = signal(false);
  annule          = signal(false);
  nombreLogements = 1;

  constructor() {
    effect(() => {
      this.panier.offre(); // écoute les changements d'offre
      if (this.estParLogement) this.nombreLogements = this.minLogements;
    });
  }

  ngOnInit(): void {
    this.route.queryParams.subscribe(p => {
      if (p['annule']) this.annule.set(true);
    });
  }

  get estParLogement(): boolean {
    const suffix = (this.panier.offre()?.prixsuffix ?? '').toLowerCase();
    return suffix.includes('lgt') || suffix.includes('logement');
  }

  get minLogements(): number {
    const nom = this.panier.offre()?.nom ?? '';
    const range = nom.match(/(\d+)\s*[àa]\s*(\d+)/i);
    if (range) return parseInt(range[1]);
    const gt = nom.match(/>\s*(\d+)/);
    if (gt) return parseInt(gt[1]) + 1;
    return 1;
  }

  get maxLogements(): number {
    const nom = this.panier.offre()?.nom ?? '';
    const range = nom.match(/(\d+)\s*[àa]\s*(\d+)/i);
    if (range) return parseInt(range[2]);
    return Infinity;
  }

  get maxLogementsAttr(): number | null {
    return isFinite(this.maxLogements) ? this.maxLogements : null;
  }

  get limiteTexte(): string {
    const min = this.minLogements;
    const max = this.maxLogements;
    return isFinite(max) ? `${min} à ${max} logements` : `${min} logements minimum`;
  }

  get prixUnitaire(): number { return this.panier.offre()?.prix ?? 0; }

  // TVA incluse dans le prix TTC : tva = total × 20/120
  get tva()   { return Math.round(this.total * 20 / 120); }
  get total() { return this.estParLogement ? this.prixUnitaire * (this.nombreLogements || this.minLogements) : this.prixUnitaire; }

  incLogements(): void {
    if (this.nombreLogements < this.maxLogements) this.nombreLogements++;
  }
  decLogements(): void {
    if (this.nombreLogements > this.minLogements) this.nombreLogements--;
  }
  filtreChiffres(e: KeyboardEvent): void {
    const autorise = ['Backspace','Delete','Tab','ArrowLeft','ArrowRight','Home','End'];
    if (autorise.includes(e.key)) return;
    if (!/^\d$/.test(e.key)) e.preventDefault();
  }

  clampLogements(): void {
    const val = this.nombreLogements || this.minLogements;
    const max = isFinite(this.maxLogements) ? this.maxLogements : val;
    this.nombreLogements = Math.max(this.minLogements, Math.min(max, val));
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
      ? `${offre.nom} — ${this.nombreLogements} logement(s)`
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