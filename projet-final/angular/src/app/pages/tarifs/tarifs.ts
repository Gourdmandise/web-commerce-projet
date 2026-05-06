import { Component, ViewEncapsulation, inject, signal, OnInit, computed } from '@angular/core';
import { Router } from '@angular/router';
import { CommonModule } from '@angular/common';
import { PanierService } from '../../services/panier.service';
import { OffreService } from '../../services/offre.service';
import { Offre } from '../../models/offre.model';

type ProfilType = 'particulier' | 'collectivite' | 'entreprise';

@Component({
  selector: 'app-tarifs',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './tarifs.html',
  styleUrls: ['./tarifs.css'],
  encapsulation: ViewEncapsulation.None,
})
export class Tarifs implements OnInit {
  private router       = inject(Router);
  private offreService = inject(OffreService);
  panier               = inject(PanierService);

  profilSelectionne = signal<ProfilType>('particulier');
  offres            = signal<Offre[]>([]);
  loading           = signal(true);
  erreur            = signal(false);

  // Offres par profil
  private offresParProfil: Record<ProfilType, Offre[]> = {
    particulier: [
      {
        id: 1,
        nom: 'Détection Standard',
        prix: 290,
        description: 'Détection des anomalies pour petits réseaux',
        populaire: false,
        features: ['Analyse réseau local', 'Rapport détaillé PDF', 'Support email'],
        options: ['Export données brutes', 'Consultation technique']
      },
      {
        id: 2,
        nom: 'Détection Plus',
        prix: 590,
        description: 'Formule complète avec analyse approfondie',
        populaire: true,
        features: ['Analyse complète réseau', 'Rapport détaillé + graphiques', 'Support prioritaire', 'Recommandations d\'optimisation'],
        options: ['Audit sécurité réseau', 'Consultation technique horaire']
      },
      {
        id: 3,
        nom: 'Détection Premium',
        prix: 990,
        description: 'Solution d\'audit télécom complète',
        populaire: false,
        features: ['Audit complet 360°', 'Rapports mensuels', 'Support 24/7', 'Formation utilisateurs', 'Monitoring continu'],
        options: ['Support SLA 4h', 'Interventions sur site', 'API d\'intégration']
      }
    ],
    collectivite: [
      {
        id: 4,
        nom: 'Diagnostic Territorial',
        prix: 1490,
        description: 'Étude préalable d\'aménagement numérique',
        populaire: false,
        features: ['Audit complet du territoire', 'Cartographie thébrage infrarouge', 'Rapport stratégique', 'Ateliers de concertation'],
        options: ['Étude faisabilité FttH', 'Consultation des exploitants']
      },
      {
        id: 5,
        nom: 'Pré-Fibrage + Accompagnement',
        prix: 2990,
        description: 'Accompagnement intégral du projet pré-fibrage',
        populaire: true,
        features: ['Étude technique approfondie', 'Gouvernance de projet', 'Suivi de travaux', 'Conformité normes', 'Dossier de subvention'],
        options: ['Formation des équipes', 'Support post-déploiement 12 mois', 'Optimisation du mix technologique']
      },
      {
        id: 6,
        nom: 'Accompagnement Complet',
        prix: 4990,
        description: 'Suivi clés-en-main du projet territorial',
        populaire: false,
        features: ['Conception technique complète', 'Gouvernance + pilotage', 'Suivi des travaux détaillé', 'Conformité réglementaire', 'Dossier subvention complet', 'Communication usagers'],
        options: ['Formation extensive', 'Support exploitant 24 mois', 'Maintenance réseau', 'Optimisation permanente']
      }
    ],
    entreprise: [
      {
        id: 7,
        nom: 'Diagnostic Professionnel',
        prix: 890,
        description: 'Audit réseau pour entreprises',
        populaire: false,
        features: ['Analyse infrastructure ITT', 'Cartographie réseau', 'Rapport d\'optimisation', 'Recommandations'],
        options: ['Audit sécurité', 'Plan de migration']
      },
      {
        id: 8,
        nom: 'Déploiement Modulé',
        prix: 1890,
        description: 'Solution adaptée aux projets d\'envergure',
        populaire: true,
        features: ['Étude technique complète', 'Suivi déploiement', 'Formation personnel', 'Support 6 mois', 'Documentation'],
        options: ['Support SLA 8h', 'Formation avancée', 'Maintenance incluse 6 mois']
      },
      {
        id: 9,
        nom: 'Solution Clés-en-Main',
        prix: 3490,
        description: 'Accompagnement complet du projet',
        populaire: false,
        features: ['Conception + déploiement', 'Gouvernance projet', 'Formation équipes', 'Support 12 mois', 'Maintenance', 'Monitoring'],
        options: ['Support SLA 4h', 'Formation extensive', 'Maintenance 24 mois', 'Évolutions gratuites']
      }
    ]
  };

  offresAffichees = computed(() => {
    return this.offresParProfil[this.profilSelectionne()];
  });

  ngOnInit(): void {
    // Charger les offres du profil sélectionné
    this.loading.set(false);
  }

  changerProfil(profil: ProfilType): void {
    this.profilSelectionne.set(profil);
  }

  choisir(offre: Offre): void {
    this.panier.choisir(offre);
    this.panier.notify('✓', 'Offre sélectionnée !', offre.nom);
    this.router.navigateByUrl('/paiement');
  }
}