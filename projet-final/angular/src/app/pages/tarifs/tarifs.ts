import { Component, ViewEncapsulation, inject, signal, OnInit, effect } from '@angular/core';
import { Router } from '@angular/router';
import { CommonModule } from '@angular/common';
import { PanierService } from '../../services/panier.service';
import { OffreService } from '../../services/offre.service';
import { Offre, ProfilOffre } from '../../models/offre.model';

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

  profilSelectionne = signal<ProfilOffre>('particulier');
  offresAffichees   = signal<Offre[]>([]);
  loading           = signal(true);
  erreur            = signal(false);

  constructor() {
    effect(() => {
      this.chargerOffres(this.profilSelectionne());
    });
  }

  ngOnInit(): void {}

  changerProfil(profil: ProfilOffre): void {
    this.profilSelectionne.set(profil);
  }

  private chargerOffres(profil: ProfilOffre): void {
    this.loading.set(true);
    this.erreur.set(false);
    this.offreService.getByProfil(profil).subscribe({
      next: (data) => {
        this.offresAffichees.set(data);
        this.loading.set(false);
      },
      error: () => {
        this.erreur.set(true);
        this.loading.set(false);
      }
    });
  }

  choisir(offre: Offre): void {
    this.panier.choisir(offre);
    this.panier.notify('✓', 'Offre sélectionnée !', offre.nom);
    this.router.navigateByUrl('/paiement');
  }
}
