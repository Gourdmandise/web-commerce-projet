import { Component, OnInit, ViewEncapsulation } from '@angular/core';
import { RouterLink } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { environment } from '../../../../environments/environment'; 

interface TermeGlossaire {
  id: number;
  terme: string;
  definition: string;
  lettre: string;
}

@Component({
  selector: 'app-glossaire',
  standalone: true,
  imports: [RouterLink, FormsModule],
  templateUrl: './glossaire.html',
  styleUrls: ['./glossaire.css'],
  encapsulation: ViewEncapsulation.None,
})

export class Glossaire implements OnInit {

  // État
  chargement    = true;
  erreur        = false;
  searchQuery   = '';
  lettreActive  = 'A';

  // Données
  tousLesTermes: TermeGlossaire[]    = [];
  termesFiltres: TermeGlossaire[]    = [];
  lettresDisponibles: string[]       = [];

  ngOnInit(): void {
    this.chargerTermes();
  }
  
   async chargerTermes(): Promise<void> {
    this.chargement = true;
    this.erreur     = false;

    try {
      const response = await fetch(
        `${environment.backendUrl}/glossaire` // ← pointe vers Render
        // ✅ Aucun header, aucune clé nécessaire
      );

      if (!response.ok) throw new Error(`HTTP ${response.status}`);

      this.tousLesTermes      = await response.json();
      this.lettresDisponibles = [...new Set(this.tousLesTermes.map(t => t.lettre))].sort();
      this.lettreActive       = this.lettresDisponibles[0] ?? 'A';
      this.termesFiltres      = [];

    } catch (e) {
      console.error('Erreur chargement glossaire :', e);
      this.erreur = true;
    } finally {
      this.chargement = false;
    }
  }

  // ── Filtrage par recherche ──────────────────────────────────────────────────
  filtrerTermes(): void {
    if (!this.searchQuery.trim()) {
      this.termesFiltres = [];
      return;
    }
    const q = this.searchQuery.toLowerCase().trim();
    this.termesFiltres = this.tousLesTermes.filter(
      t => t.terme.toLowerCase().includes(q) || t.definition.toLowerCase().includes(q)
    );
  }

  // ── Groupement par lettre ───────────────────────────────────────────────────
  getTermesByLettre(lettre: string): TermeGlossaire[] {
    return this.tousLesTermes.filter(t => t.lettre === lettre);
  }

  // ── Scroll vers une lettre ──────────────────────────────────────────────────
  scrollVersLettre(lettre: string): void {
    this.lettreActive = lettre;
    const el = document.getElementById(`lettre-${lettre}`);
    if (el) {
      el.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  }
}