import { Component, ViewEncapsulation } from '@angular/core';
import { RouterLink } from '@angular/router';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-collectivites',
  standalone: true,
  imports: [RouterLink, CommonModule],
  templateUrl: './collectivites.html',
  styleUrls: ['./collectivites.css'],
  encapsulation: ViewEncapsulation.None,
})
export class Collectivites {

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
    { titre: 'Pré-câblage fibre optique FttH', couleur: 'em', img: 'Generateur-de-frequences.png',
      texte: 'Adduction et pré-fibrage optique pour les nouvelles constructions et rénovations de logements. Préparation complète des infrastructures en conformité avec la loi Avenir, assurant un raccordement mutualisé de qualité à terme.' },
    { titre: 'Création de réseaux collectifs', couleur: 'cy', img: 'detection-securite.png',
      texte: 'Infrastructure dédiée aux collectivités : immeuble, zone d\'activités ou zone de regroupement. Pose de câbles, création de points de distribution, regards techniques et câblage adaptés aux demandes régaliennes.' },
    { titre: 'Etudes & maîtrise d\'ouvrage', couleur: 'te', img: 'fibre-optique.png',
      texte: 'Accompagnement complet de vos projets : diagnostic initial, consultation opérateurs, dimensionnement d\'infrastructure, suivi de travaux. Expertise garantissant la continuité de service et l\'accès du très haut débit pour tous.' },
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
