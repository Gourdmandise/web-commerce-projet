import { Component, ViewEncapsulation } from '@angular/core';
import { RouterLink } from '@angular/router';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-terrassement',
  standalone: true,
  imports: [RouterLink, CommonModule],
  templateUrl: './terrassement.html',
  styleUrls: ['./terrassement.css'],
  encapsulation: ViewEncapsulation.None,
})
export class Terrassement {

  methodes = [
    { img: 'Pré-câblage_fibre_optique_FttH.png',    titre: 'Pré-fibrage FttH',       desc: 'Adduction et pré-fibrage pour nouvelles constructions selon la législation. Infrastructure complète prête pour le raccordement mutualisé.', tag: 'Nouv. construction' },
    { img: 'Création_de_réseaux_collectifs.png',     titre: 'Diagnostic territorial', desc: 'Audit complet de votre infrastructure télécom. Cartographie, identification des blocages, plan d\'action pour la connectivité globale.', tag: 'Diagnostic' },
    { img: 'Etudes_&_maîtrise_d\'ouvrage.png', titre: 'Accompagnement projets', desc: 'Du diagnostic à la mise en conformité. Support technique dédié, liaison avec opérateurs et respect des normes de déploiement.', tag: 'Conseils' },
  ];

  normes = [
    { ic: '📏', txt: 'Profondeur min. 0,80 m en voirie' },
    { ic: '🛡️', txt: 'Grillage avertisseur orange obligatoire' },
    { ic: '📄', txt: 'DOE conforme DT/DICT' },
    { ic: '✅', txt: 'Certification Classe A' },
  ];

  travaux = [
    { titre: 'Création de regards télécom', couleur: 'em', img: 'Generateur-de-frequences.png',
      texte: 'Selon la nature du terrain et l\'étendue des travaux nécessaires, nous réalisons différents types d\'interventions pour débloquer votre situation. Nos équipes peuvent intervenir sur la réalisation de tranchées, la pose de regards France Télécom ainsi que le passage de gaines télécom, que ce soit au sein de votre propriété ou en domaine public.' },
    { titre: 'Réalisation de tranchées', couleur: 'cy', img: 'detection-securite.png',
      texte: 'Lorsque votre réseau ne peut être remis en état par débouchage, nous sommes en mesure de créer un réseau entièrement neuf. Issus du domaine des travaux publics, nous disposons d\'outillages spécifiquement adaptés : trancheuses de sol, pelles mécaniques, et intervention manuelle lorsque les fouilles sont sensibles.' },
    { titre: 'Pré-câblage fibre optique', couleur: 'te', img: 'fibre-optique.png',
      texte: 'Lorsque le réseau existant n\'est pas réparable mais permet le passage d\'un câble, nous assurons le pré-câblage de la fibre optique jusqu\'aux points de terminaison optique. Le pré-câblage fibre optique constitue une étape essentielle dans tout projet de construction ou de rénovation nécessitant une infrastructure télécom moderne.' },
  ];

}