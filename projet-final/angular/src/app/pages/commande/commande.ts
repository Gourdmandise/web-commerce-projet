import { Component, ViewEncapsulation, inject, signal, OnInit } from '@angular/core';
import { RouterLink, ActivatedRoute } from '@angular/router';
import { DatePipe } from '@angular/common';
import { HttpErrorResponse } from '@angular/common/http';
import { PanierService }   from '../../services/panier.service';
import { StripeService }   from '../../services/stripe.service';
import { CommandeService } from '../../services/commande.service';
import { Offre }           from '../../models/offre.model';
import { Commande as CommandeModel } from '../../models/commande.model';

type EtapeCommande = {
  label: string;
  desc: string;
};

const ETAPES_COMMANDE: EtapeCommande[] = [
  { label: 'Commande reçue', desc: 'Votre commande a bien été enregistrée.' },
  { label: 'Paiement confirmé', desc: 'Paiement sécurisé validé.' },
  { label: 'Planification', desc: 'Un technicien vous contacte sous 24h.' },
  { label: 'Intervention', desc: 'Le technicien se déplace à votre adresse.' },
  { label: 'Rapport transmis', desc: 'Compte-rendu complet envoyé par e-mail.' },
];

const ORDRE_STATUTS = ['en_attente', 'paiement_confirme', 'planification', 'intervention', 'termine'];

@Component({
  selector: 'app-commande',
  standalone: true,
  imports: [RouterLink, DatePipe],
  templateUrl: './commande.html',
  styleUrls: ['./commande.css'],
  encapsulation: ViewEncapsulation.None,
})
export class Commande implements OnInit {
  panier        = inject(PanierService);
  stripeService = inject(StripeService);
  commandeService = inject(CommandeService);
  route         = inject(ActivatedRoute);

  offre      = signal<Offre | null>(null);
  commande   = signal<CommandeModel | null>(null);
  chargement = signal(true);
  telechargementPdf = signal(false);
  vue = signal<'confirmation' | 'detail'>('confirmation');
  erreur = signal('');

  etapes = ETAPES_COMMANDE.map((etape, index) => ({
    ...etape,
    statut: index < 2 ? 'done' : index === 2 ? 'active' : 'pending'
  }));

  ngOnInit(): void {
    const commandeId = this.route.snapshot.paramMap.get('id');
    if (commandeId) {
      this.vue.set('detail');
      this.chargerCommande(parseInt(commandeId, 10));
      return;
    }

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

  private chargerCommande(id: number): void {
    this.chargement.set(true);
    this.commandeService.getById(id).subscribe({
      next: (data) => {
        this.commande.set(data);
        this.chargement.set(false);
      },
      error: () => {
        this.erreur.set('Commande introuvable ou accès refusé.');
        this.chargement.set(false);
      }
    });
  }

  numeroCommande(): string {
    const commande = this.commande();
    if (!commande) return 'Commande';
    return commande.numeroCommande || `Commande #${commande.id}`;
  }

  statutLabel(statut: string): string {
    const labels: Record<string, string> = {
      en_attente: 'En attente',
      paiement_confirme: 'Payée',
      planification: 'Planification',
      intervention: 'Intervention',
      termine: 'Terminée',
      annulee: 'Annulée',
    };
    return labels[statut] ?? statut;
  }

  etapesCommande(statut: string) {
    const idx = ORDRE_STATUTS.indexOf(statut);
    return ETAPES_COMMANDE.map((etape, index) => ({
      ...etape,
      etat: index < idx ? 'done' : index === idx ? 'active' : 'pending'
    }));
  }

  telechargerPdf(): void {
    const commande = this.commande();
    if (!commande?.id) return;

    this.telechargementPdf.set(true);
    this.commandeService.telechargerPdf(commande.id).subscribe({
      next: (blob) => {
        this.telechargementPdf.set(false);
        const url = window.URL.createObjectURL(blob);
        const anchor = document.createElement('a');
        anchor.href = url;
        anchor.download = `facture-${commande.numeroCommande || commande.id}.pdf`;
        anchor.click();
        window.URL.revokeObjectURL(url);
      },
      error: async (err: HttpErrorResponse) => {
        this.telechargementPdf.set(false);
        let detail = 'La facture PDF est indisponible.';
        if (err?.error instanceof Blob) {
          try {
            const texte = await err.error.text();
            const json = JSON.parse(texte);
            if (json?.error) detail = json.error;
          } catch {
            // Ignore les erreurs de parsing et conserve le message par défaut.
          }
        } else if (typeof err?.error?.error === 'string') {
          detail = err.error.error;
        }
        this.panier.notify('⚠', 'Téléchargement impossible', detail);
      }
    });
  }
}
