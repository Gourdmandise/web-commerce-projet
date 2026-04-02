import { Component, inject, OnInit } from '@angular/core';
import { RouterLink } from '@angular/router';
import { HttpClient } from '@angular/common/http';
import { CommonModule } from '@angular/common';
import { environment } from '../../../environments/environment';

@Component({
  selector: 'app-terrassement',
  standalone: true,
  imports: [RouterLink, CommonModule],
  templateUrl: './terrassement.html',
  styleUrls: ['./terrassement.css'],
})
export class Terrassement implements OnInit {
  http = inject(HttpClient);
  private backend = environment.backendUrl;

  offres: any[] = [];

  methodes = [
    { img: 'Generateur-de-frequences.png', titre: 'Générateur de fréquences',  desc: 'Induction électromagnétique haute puissance pour cartographier le tracé exact de votre réseau et en mesurer la profondeur.', tag: 'Méthode 1' },
    { img: 'fibre-optique.png',       titre: 'Aiguille traçable & sonde',  desc: 'Sonde émettrice introduite dans la gaine TPC pour identifier précisément chaque point de blocage avec marquage au sol.', tag: 'Méthode 2' },
    { img: 'detection-securite.png',  titre: 'Endoscopie vidéo de gaine',  desc: 'Caméra HD orientable 360° avec 9 LED blanches, compteur odomètre et enregistrement photo/vidéo pour inspection complète.', tag: 'Méthode 3' },
  ];

  normes = [
    { ic: '📏', txt: 'Profondeur min. 0,80 m en voirie' },
    { ic: '🛡️', txt: 'Grillage avertisseur orange obligatoire' },
    { ic: '📄', txt: 'DOE conforme DT/DICT' },
    { ic: '✅', txt: 'Certification Classe A' },
  ];

  travaux = [
    { titre: 'Création de regards télécom', couleur: 'em', img: '...',
      texte: 'Selon la nature du terrain et l\'étendue des travaux nécessaires, nous réalisons différents types d\'interventions pour débloquer votre situation. Nos équipes peuvent intervenir sur la réalisation de tranchées, la pose de regards France Télécom ainsi que le passage de gaines télécom, que ce soit au sein de votre propriété ou en domaine public.' },
    { titre: 'Réalisation de tranchées', couleur: 'cy', img: '...',
      texte: 'Lorsque votre réseau ne peut être remis en état par débouchage, nous sommes en mesure de créer un réseau entièrement neuf. Issus du domaine des travaux publics, nous disposons d\'outillages spécifiquement adaptés : trancheuses de sol, pelles mécaniques, et intervention manuelle lorsque les fouilles sont sensibles.' },
    { titre: 'Pré-câblage fibre optique', couleur: 'te', img: '...',
      texte: 'Lorsque le réseau existant n\'est pas réparable mais permet le passage d\'un câble, nous assurons le pré-câblage de la fibre optique jusqu\'aux points de terminaison optique. Le pré-câblage fibre optique constitue une étape essentielle dans tout projet de construction ou de rénovation nécessitant une infrastructure télécom moderne.' },
  ];

  ngOnInit(): void {
    this.http.get<any[]>(`${this.backend}/offres`).subscribe({
      next: (data) => this.offres = data.slice(0, 3),
      error: (err)  => console.error('Erreur chargement offres :', err),
    });
  }
}