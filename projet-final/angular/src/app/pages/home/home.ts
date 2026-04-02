import { Component } from '@angular/core';
import { RouterLink } from '@angular/router';

@Component({
  selector: 'app-home',
  standalone: true,
  imports: [RouterLink],
  templateUrl: './home.html',
  styleUrls: ['./home.css'],
})
export class Home {
  services = [
    { img: 'fibre-optique.png',        titre: 'Fibre Optique',             desc: 'Déploiement réseaux FTTH/FTTO, raccordements, maintenance haute performance.' },
    { img: 'detection-securite.png',   titre: 'Détection & Sécurité',      desc: 'Vidéoprotection intelligente, alarmes intrusion, contrôle d\'accès et détection incendie.' },
    { img: 'energie-renouvelable.png', titre: 'Énergie Renouvelable',       desc: 'Installations photovoltaïques, solutions d\'autoconsommation, stockage d\'énergie.' },
    { img: 'irve.png',                 titre: 'IRVE (Recharge Électrique)', desc: 'Infrastructure de recharge pour VE, installation de bornes pour entreprises et copropriétés.' },
  ];

  temoignages = [
    { initiales:'JD', nom:'Jean Dupont',      role:'Particulier — Toulouse',  note:5, texte:'Intervention rapide et efficace. L\'équipe a localisé le blocage en moins d\'une heure, diagnostic complet fourni par email le soir même.' },
    { initiales:'SM', nom:'Sophie Martin',    role:'Syndic de copropriété',   note:5, texte:'Excellente prestation pour notre syndic. X3COM a géoréférencé l\'ensemble du réseau de notre résidence. Travail sérieux, documentation parfaite.' },
    { initiales:'PL', nom:'Pierre Laurent',   role:'Professionnel — Blagnac', note:4, texte:'Professionnel, ponctuel et pédagogue. La fibre était enfin raccordable après l\'intervention. Très satisfait du résultat.' },
  ];
}
