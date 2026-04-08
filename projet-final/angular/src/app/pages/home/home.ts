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
  services = [
    { img: 'fibre-optique.png',        titre: 'Fibre Optique FTTH/FTTO',   desc: 'Déploiement et raccordement fibre optique pour particuliers, entreprises et collectivités. Accès au très haut débit garanti.' },
    { img: 'detection-securite.png',   titre: 'Diagnostic Réseau',         desc: 'Détection et localisation des blocages fibre, diagnostic complet avec rapport technique détaillé fourni après intervention.' },
    { img: 'energie-renouvelable.png', titre: 'Accompagnement Collectivités', desc: 'Solutions adaptées aux communes et établissements publics pour accélérer le déploiement fibre sur votre territoire.' },
    { img: 'irve.png',                 titre: 'Expertise Professionnelle',  desc: 'Diagnostic fibre pour entreprises, boostez la connectivité de votre activité avec un accompagnement sur mesure.' },
  ];

  temoignages = [
    { initiales:'TD', nom:'Thomas Dupont',    role:'Particulier',             note:5, texte:'Service rapide et professionnel. L\'équipe X3COM a détecté et résolu notre problème de raccordement en un temps record.' },
    { initiales:'MD', nom:'Michelle Durand',  role:'Collectivité',            note:5, texte:'Excellente prise en charge. Nous avons enfin la fibre grâce à leur intervention précise et efficace.' },
    { initiales:'JR', nom:'Jérôme Radot',     role:'Professionnel — Blagnac', note:5, texte:'Très satisfait du diagnostic réseau. Une équipe compétente qui connaît parfaitement le territoire.' },
  ];
}
