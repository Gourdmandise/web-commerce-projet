import { Component, ViewEncapsulation, inject, signal, OnInit } from '@angular/core';
import { RouterLink, ActivatedRoute } from '@angular/router';
import { PanierService }   from '../../services/panier.service';
import { StripeService }   from '../../services/stripe.service';
import { Offre }           from '../../models/offre.model';

@Component({
  selector: 'app-commande',
  standalone: true,
  imports: [RouterLink],
  templateUrl: './commande.html',
  styleUrls: ['./commande.css'],
  encapsulation: ViewEncapsulation.None,
})
export class Commande implements OnInit {
  panier        = inject(PanierService);
  stripeService = inject(StripeService);
  route         = inject(ActivatedRoute);

  offre      = signal<Offre | null>(null);
  chargement = signal(true);

  etapes = [
    { label: 'Commande reçue',    desc: 'Votre commande a bien été enregistrée.',    statut: 'done'    },
    { label: 'Paiement confirmé', desc: 'Paiement sécurisé validé.',                 statut: 'done'    },
    { label: 'Planification',     desc: 'Un technicien vous contacte sous 24h.',     statut: 'active'  },
    { label: 'Intervention',      desc: 'Le technicien se déplace à votre adresse.', statut: 'pending' },
    { label: 'Rapport transmis',  desc: 'Compte-rendu complet envoyé par e-mail.',   statut: 'pending' },
  ];

  ngOnInit(): void {
    // 1. Signal panier (navigation normale tarifs → paiement → commande)
    const offreSignal = this.panier.offre();
    if (offreSignal) {
      this.offre.set(offreSignal);
      // Persister pour les rechargements
      sessionStorage.setItem('x3com_offre', JSON.stringify(offreSignal));
      this.chargement.set(false);
      return;
    }

    // 2. SessionStorage (rechargement de page F5)
    const stored = sessionStorage.getItem('x3com_offre');
    if (stored) {
      try {
        this.offre.set(JSON.parse(stored));
        this.chargement.set(false);
        return;
      } catch { /* continuer */ }
    }

    // 3. Retour depuis Stripe — session_id dans l'URL (?session_id=xxx)
    this.route.queryParams.subscribe(params => {
      const sessionId = params['session_id'];
      if (sessionId) {
        this.stripeService.getSessionStatus(sessionId).subscribe({
          next: (session) => {
            const meta = session.metadata;
            // Reconstruire l'offre depuis les métadonnées Stripe
            const offreReconstruite: Offre = {
              id:          parseInt(meta['offreId']),
              nom:         meta['nomOffre'],
              prix:        parseFloat(meta['prix']),
              description: '',
              surface:     '',
              populaire:   false,
              features:    [],
              options:     [],
            };
            this.offre.set(offreReconstruite);
            sessionStorage.setItem('x3com_offre', JSON.stringify(offreReconstruite));
            this.chargement.set(false);
          },
          error: () => this.chargement.set(false)
        });
      } else {
        this.chargement.set(false);
      }
    });
  }
}
