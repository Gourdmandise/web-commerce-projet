import { Component, ViewEncapsulation } from '@angular/core';
import { RouterLink } from '@angular/router';

@Component({
  selector: 'app-entreprise',
  standalone: true,
  imports: [RouterLink],
  templateUrl: './entreprise.html',
  styleUrls: ['./entreprise.css'],
  encapsulation: ViewEncapsulation.None,
})
export class Entreprise {
  profils = [
    {
      icon: '🏠',
      color: '#2dd4bf',
      bg: 'linear-gradient(135deg,#2dd4bf,#0ea5e9)',
      titre: 'Particuliers',
      desc: 'Détection et raccordement fibre pour votre domicile. Accédez au très haut débit simplement.',
    },
    {
      icon: '🏛️',
      color: '#10b981',
      bg: 'linear-gradient(135deg,#10b981,#06b6d4)',
      titre: 'Collectivités',
      desc: 'Solutions adaptées aux communes et établissements publics. Accélérez le déploiement sur votre territoire.',
    },
    {
      icon: '🏢',
      color: '#f97316',
      bg: 'linear-gradient(135deg,#f97316,#fbbf24)',
      titre: 'Entreprises',
      desc: 'Diagnostic fibre et accompagnement professionnel. Boostez la connectivité de votre activité.',
    },
    {
      icon: '💡',
      color: '#a855f7',
      bg: 'linear-gradient(135deg,#a855f7,#ec4899)',
      titre: 'Le saviez-vous ?',
      desc: 'Découvrez la réglementation fibre optique, vos droits et les aides au raccordement.',
    },
  ];

  atouts = [
    { icon: '🛡️', titre: 'Expertise Garantie',   desc: 'Détection fibre avec précision' },
    { icon: '🕐', titre: 'Disponibilité',          desc: 'Intervention selon vos horaires' },
    { icon: '⚡', titre: 'Trois Offres',            desc: 'Adaptées à votre budget' },
  ];

  temoignages = [
    { nom: 'Thomas Dupont',   date: '05/05/2025', texte: 'Service rapide et professionnel. L\'équipe X3COM a détecté et résolu notre problème de raccordement en un temps record.' },
    { nom: 'Michelle Durand', date: '23/04/2025', texte: 'Excellente prise en charge. Nous avons enfin la fibre grâce à leur intervention précise et efficace.' },
    { nom: 'Jérôme Radot',    date: '04/01/2025', texte: 'Très satisfait du diagnostic réseau. Une équipe compétente qui connaît parfaitement le territoire.' },
  ];
}
