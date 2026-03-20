import { Component, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import { PanierService } from '../../services/panier.service';
import { OffreService } from '../../services/offre.service';
import { Offre } from '../../models/offre.model';

@Component({
  selector: 'app-tarifs',
  standalone: true,
  imports: [],
  templateUrl: './tarifs.html',
  styleUrls: ['./tarifs.css'],
})
export class Tarifs {
  private router       = inject(Router);
  private offreService = inject(OffreService);
  panier               = inject(PanierService);

  offres  = signal<Offre[]>([]);
  loading = signal(true);
  erreur  = signal(false);

  ngOnInit(): void {
    this.offreService.getAll().subscribe({
      next: (data) => {
        this.offres.set(data);
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