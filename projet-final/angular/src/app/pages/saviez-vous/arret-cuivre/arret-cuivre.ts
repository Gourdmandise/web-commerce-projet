import { Component, ViewEncapsulation, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { CommunesService, Commune } from '../../../services/communes.service';

@Component({
  selector: 'app-arret-cuivre',
  standalone: true,
  imports: [RouterLink, FormsModule],
  templateUrl: './arret-cuivre.html',
  styleUrls: ['./arret-cuivre.css'],
  encapsulation: ViewEncapsulation.None,
})
export class ArretCuivre {
  private communesService = inject(CommunesService);

  communeQuery  = '';
  suggestions   = signal<Commune[]>([]);
  resultat      = signal<Commune | null>(null);
  chargement    = false;
  erreur        = '';

  rechercherCommune() {
    if (this.communeQuery.length < 2) {
      this.suggestions.set([]);
      this.resultat.set(null);
      return;
    }

    this.chargement = true;
    this.erreur = '';
    this.resultat.set(null);

    this.communesService.rechercher(this.communeQuery).subscribe({
      next: (communes) => {
        this.chargement = false;
        if (communes.length > 0) {
          this.suggestions.set(communes);
        } else {
          this.suggestions.set([]);
          this.erreur = 'Commune non trouvée. Consultez l\'ARCEP pour plus d\'infos.';
        }
      },
      error: () => {
        this.chargement = false;
        this.erreur = 'Erreur lors de la recherche.';
      }
    });
  }

  selectionnerCommune(commune: Commune) {
    this.communeQuery = `${commune.commune} (${commune.code_postal})`;
    this.suggestions.set([]);
    this.resultat.set(commune);
    this.erreur = '';
  }

  masquerSuggestions() {
    setTimeout(() => this.suggestions.set([]), 150);
  }

  formatDate(date: string | null): string {
    if (!date) return 'Non défini';
    const d = new Date(date);
    return d.toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' });
  }
}