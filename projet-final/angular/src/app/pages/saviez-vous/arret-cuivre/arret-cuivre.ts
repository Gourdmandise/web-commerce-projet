import { Component, ViewEncapsulation } from '@angular/core';
import { RouterLink } from '@angular/router';
import { FormsModule } from '@angular/forms';

@Component({
  selector: 'app-arret-cuivre',
  standalone: true,
  imports: [RouterLink, FormsModule],
  templateUrl: './arret-cuivre.html',
  styleUrls: ['./arret-cuivre.css'],
  encapsulation: ViewEncapsulation.None,
})
export class ArretCuivre {
  communeQuery  = '';
  communeResult = false;

  rechercherCommune() {
    // Après 3 caractères, on considère que l'utilisateur cherche une commune
    // et on affiche le lien ARCEP (données réelles disponibles sur leur site)
    this.communeResult = this.communeQuery.length >= 3;
  }
}