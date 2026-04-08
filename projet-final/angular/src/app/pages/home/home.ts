import { Component, ViewEncapsulation } from '@angular/core';
import { RouterLink } from '@angular/router';

@Component({
  selector: 'app-home',
  standalone: true,
  imports: [RouterLink],
  templateUrl: './home.html',
  styleUrls: ['./home.css'],
  encapsulation: ViewEncapsulation.None,
})
export class Home {

  // FIX P0 : tableau profils manquant (utilisé dans @for du HTML)
  profils = [
    {
      emoji: '🏠',
      bg: 'rgba(0,212,170,0.1)',
      titre: 'Particuliers',
      desc: 'Vous souhaitez raccorder votre logement à la fibre optique ? Nous diagnostiquons votre réseau et vous accompagnons de A à Z.',
    },
    {
      emoji: '🏢',
      bg: 'rgba(0,180,216,0.1)',
      titre: 'Entreprises',
      desc: 'Connexion très haut débit pour vos locaux professionnels, avec des solutions adaptées à votre activité et vos contraintes.',
    },
    {
      emoji: '🏛️',
      bg: 'rgba(0,119,182,0.1)',
      titre: 'Collectivités',
      desc: 'Déploiement et maintenance réseau pour communes, syndicats et établissements publics en Haute-Garonne et Tarn.',
    },
  ];

  // FIX P0 : tableau atouts manquant (utilisé dans @for du HTML)
  atouts = [
    { icon: '⚡', titre: 'Réactivité',    desc: 'Intervention sous 48 h sur l\'ensemble de notre zone.' },
    { icon: '🎯', titre: 'Précision',      desc: 'Diagnostic millimétrique grâce à nos outils de pointe.' },
    { icon: '📋', titre: 'Transparence',   desc: 'Rapport complet remis après chaque intervention.' },
    { icon: '🤝', titre: 'Accompagnement', desc: 'Suivi personnalisé jusqu\'à la réception des travaux.' },
  ];

  // Services (déjà présent dans l'original — maintenant rendu dans le HTML)
  services = [
    { img: 'fibre-optique.png',        titre: 'Fibre Optique',             desc: 'Déploiement réseaux FTTH/FTTO, raccordements, maintenance haute performance.' },
    { img: 'detection-securite.png',   titre: 'Détection & Sécurité',      desc: 'Vidéoprotection intelligente, alarmes intrusion, contrôle d\'accès et détection incendie.' },
    { img: 'energie-renouvelable.png', titre: 'Énergie Renouvelable',       desc: 'Installations photovoltaïques, solutions d\'autoconsommation, stockage d\'énergie.' },
    { img: 'irve.png',                 titre: 'IRVE (Recharge Électrique)', desc: 'Infrastructure de recharge pour VE, installation de bornes pour entreprises et copropriétés.' },
  ];

  // FIX P1 : champ `date` supprimé (inexistant), `role` conservé et utilisé dans le HTML
  temoignages = [
    {
      initiales: 'JD',
      nom:  'Jean Dupont',
      role: 'Particulier — Toulouse',
      note: 5,
      texte: 'Intervention rapide et efficace. L\'équipe a localisé le blocage en moins d\'une heure, diagnostic complet fourni par email le soir même.',
    },
    {
      initiales: 'SM',
      nom:  'Sophie Martin',
      role: 'Syndic de copropriété',
      note: 5,
      texte: 'Excellente prestation pour notre syndic. X3COM a géoréférencé l\'ensemble du réseau de notre résidence. Travail sérieux, documentation parfaite.',
    },
    {
      initiales: 'PL',
      nom:  'Pierre Laurent',
      role: 'Professionnel — Blagnac',
      note: 4,
      texte: 'Professionnel, ponctuel et pédagogue. La fibre était enfin raccordable après l\'intervention. Très satisfait du résultat.',
    },
  ];
}