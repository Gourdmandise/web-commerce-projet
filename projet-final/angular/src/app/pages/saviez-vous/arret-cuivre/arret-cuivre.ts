import { Component, ViewEncapsulation, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { CommunesService, Commune } from '../../../services/communes.service';
import { GlossaireLinkDirective } from '../../../shared/glossaire-link/glossaire-link.directive';

@Component({
  selector: 'app-arret-cuivre',
  standalone: true,
  imports: [RouterLink, FormsModule, GlossaireLinkDirective],
  templateUrl: './arret-cuivre.html',
  styleUrls: ['./arret-cuivre.css'],
  encapsulation: ViewEncapsulation.None,
})
export class ArretCuivre {
  private communesService = inject(CommunesService);

  communeQuery  = '';
  resultat      = signal<Commune | null>(null);
  chargement    = false;
  erreur        = '';

  rechercherCommune() {
    if (this.communeQuery.length < 2) {
      this.resultat.set(null);
      return;
    }

    this.chargement = true;
    this.erreur = '';

    this.communesService.rechercher(this.communeQuery).subscribe({
      next: (communes) => {
        this.chargement = false;
        if (communes.length > 0) {
          this.resultat.set(communes[0]);
        } else {
          this.resultat.set(null);
          this.erreur = 'Commune non trouvée. Consultez l\'ARCEP pour plus d\'infos.';
        }
      },
      error: () => {
        this.chargement = false;
        this.erreur = 'Erreur lors de la recherche.';
      }
    });
  }

  formatDate(date: string | null): string {
    if (!date) return 'Non défini';
    const d = new Date(date);
    return d.toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' });
  }
}