import { Component, OnInit, ViewEncapsulation } from '@angular/core';
import { RouterLink } from '@angular/router';
import { FormsModule } from '@angular/forms';

interface TermeGlossaire {
  id: number;
  terme: string;
  definition: string;
  lettre: string;
}

// ── Supabase REST API ──────────────────────────────────────────────────────────
const SUPABASE_URL = 'https://saijwfaavvsvzrcczkpw.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InNhaWp3ZmFhdnZzdnpyY2N6a3B3Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQ0NTU2OTEsImV4cCI6MjA5MDAzMTY5MX0.tOU3dOkIdlNNuLEACUjamDwzUbo1WsiGjzcT3h6rngU';

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
        `${SUPABASE_URL}/rest/v1/glossaire?select=id,terme,definition,lettre&order=lettre.asc,terme.asc`,
        {
          headers: {
            'apikey':        SUPABASE_KEY,
            'Authorization': `Bearer ${SUPABASE_KEY}`,
            'Content-Type':  'application/json',
          },
        }
      );

      if (!response.ok) throw new Error(`HTTP ${response.status}`);

      this.tousLesTermes     = await response.json();
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