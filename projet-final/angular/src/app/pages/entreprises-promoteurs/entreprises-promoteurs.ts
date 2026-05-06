import { Component, ViewEncapsulation } from '@angular/core';
import { RouterLink } from '@angular/router';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-entreprises-promoteurs',
  standalone: true,
  imports: [RouterLink, CommonModule],
  templateUrl: './entreprises-promoteurs.html',
  styleUrls: ['./entreprises-promoteurs.css'],
  encapsulation: ViewEncapsulation.None,
})
export class EntreprisesPromoteurs {

  methodes = [
    { img: 'Generateur-de-frequences.png', titre: 'Pré-fibrage FttH',  desc: 'Adduction et pré-fibrage pour nouvelles constructions selon la législation. Infrastructure complète prête pour le raccordement mutualisé.', tag: 'Nouv. construction' },
    { img: 'fibre-optique.png',       titre: 'Diagnostic territorial',  desc: 'Audit complet de votre infrastructure télécom. Cartographie, identification des blocages, plan d\'action pour la connectivité globale.', tag: 'Diagnostic' },
    { img: 'detection-securite.png',  titre: 'Accompagnement projets',  desc: 'Du diagnostic à la mise en conformité. Support technique dédié, liaison avec opérateurs et respect des normes de déploiement.', tag: 'Conseils' },
  ];

  normes = [
    { ic: '📋', txt: 'Conformité loi Avenir 2023' },
    { ic: '🌐', txt: 'Couverture très haut débit' },
    { ic: '🤝', txt: 'Coordination multi-opérateurs' },
    { ic: '✅', txt: 'Cahier des charges complet' },
  ];

  travaux = [
    { titre: 'Création de regards télécom', couleur: 'em', img: 'Pré-câblage_fibre_optique_FttH.png',
      texte: 'Selon la nature du terrain et l\'étendue des travaux nécessaires, nous réalisons différents types d\'interventions pour débloquer votre situation. Nos équipes peuvent intervenir sur la réalisation de tranchées, la pose de regards France Télécom ainsi que le passage de gaines télécom, que ce soit au sein de votre propriété ou en domaine public.' },
    { titre: 'Réalisation de tranchées', couleur: 'cy', img: 'Création_de_réseaux_collectifs.png',
      texte: 'Lorsque votre réseau ne peut être remis en état par débouchage, nous sommes en mesure de créer un réseau entièrement neuf. Issus du domaine des travaux publics, nous disposons d\'outillages spécifiquement adaptés : trancheuses de sol, pelles mécaniques, et intervention manuelle lorsque les fouilles sont sensibles.' },
    { titre: 'Pré-câblage fibre optique', couleur: 'te', img: 'Etudes_&_maîtrise_d-ouvrage.png',
      texte: 'Lorsque le réseau existant n\'est pas réparable mais permet le passage d\'un câble, nous assurons le pré-câblage de la fibre optique jusqu\'aux points de terminaison optique. Le pré-câblage fibre optique constitue une étape essentielle dans tout projet de construction ou de rénovation nécessitant une infrastructure télécom moderne.' },
  ];

  deroulement = [
    { numero: '01', titre: 'Cadrage du besoin', desc: 'Recueil des contraintes du site, des objectifs de couverture et du contexte réglementaire.' },
    { numero: '02', titre: 'Visite technique', desc: 'Repérage des accès, validation des cheminements et identification des points critiques.' },
    { numero: '03', titre: 'Conception & devis', desc: 'Dimensionnement pré-fibrage, schéma de câblage et chiffrage détaillé de la prestation.' },
    { numero: '04', titre: 'Travaux & câblage', desc: 'Réalisation des infrastructures, pose des équipements et préparation au raccordement.' },
    { numero: '05', titre: 'Contrôle final', desc: 'Vérification de conformité, livrables techniques et accompagnement à la mise en service.' },
  ];

  schemaRaccordement = [
    { ic: '🌐', titre: 'Arrivée opérateur', desc: 'Point de branchement et adduction en entrée de site.' },
    { ic: '🧱', titre: 'Colonne / gaine', desc: 'Cheminement vertical ou horizontal des câbles fibre.' },
    { ic: '📦', titre: 'Boîtier de distribution', desc: 'Répartition des fibres par zone, étage ou bâtiment.' },
    { ic: '🏠', titre: 'PTO finale', desc: 'Point de terminaison optique dans le logement ou local.' },
  ];

  avantages = [
    { titre: 'Expertise terrain', desc: 'Équipes formées aux normes publiques, copropriétés et aux coordinations multi-opérateurs.' },
    { titre: 'Réactivité', desc: 'Intervention rapide adaptée aux calendriers publics et délais de projet.' },
    { titre: 'Conformité garantie', desc: 'Respect intégral des cahiers des charges et normes de déploiement.' },
    { titre: 'Support dédié', desc: 'Interlocuteur unique pour l\'accompagnement de bout en bout.' },
  ];

  regions = [
    { dept: '31', nom: 'Haute-Garonne', desc: 'Toulouse & agglomération', actif: true },
    { dept: '32', nom: 'Gers', desc: 'Auch & communes environnantes', actif: true },
    { dept: '81', nom: 'Tarn', desc: 'Albi & alentours', actif: true },
    { dept: '82', nom: 'Tarn-et-Garonne', desc: 'Montauban & communes voisines', actif: true },
  ];

}