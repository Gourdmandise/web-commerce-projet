import { Component, inject } from '@angular/core';
import { RouterLink } from '@angular/router';
import { PanierService } from '../../services/panier.service';

@Component({
  selector: 'app-commande',
  standalone: true,
  imports: [RouterLink],
  templateUrl: './commande.html',
  styleUrls: ['./commande.css'],
})
export class Commande {
  panier = inject(PanierService);

  etapes = [
    { label: 'Commande reçue',    desc: 'Votre commande a bien été enregistrée.', statut: 'done'   },
    { label: 'Paiement confirmé', desc: 'Paiement sécurisé validé.',              statut: 'done'   },
    { label: 'Planification',     desc: 'Un technicien vous contacte sous 24h.',  statut: 'active' },
    { label: 'Intervention',      desc: 'Le technicien se déplace à votre adresse.', statut: 'pending' },
    { label: 'Rapport transmis',  desc: 'Compte-rendu complet envoyé par e-mail.', statut: 'pending' },
  ];
}