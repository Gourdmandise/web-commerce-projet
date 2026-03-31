import { Component, inject } from '@angular/core';
import { FormsModule, NgForm } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { HttpClient } from '@angular/common/http';
import { environment } from '../../../environments/environment';
import { PanierService } from '../../services/panier.service';

interface ContactForm {
  type:      string;
  nom:       string;
  email:     string;
  tel:       string;
  ville:     string;
  adresse:   string;
  besoins:   string[];
  operateur: string;
  message:   string;
}

@Component({
  selector: 'app-contact',
  standalone: true,
  imports: [FormsModule, RouterLink],
  templateUrl: './contact.html',
  styleUrls: ['./contact.css'],
})
export class Contact {
  panier  = inject(PanierService);
  http    = inject(HttpClient);
  private backend = environment.backendUrl;

  form: ContactForm = this.vide();
  envoi = false;
  fichierSelectionne: File | null = null;

  readonly TAILLE_MAX = 8 * 1024 * 1024; // 8 Mo
  readonly EXTENSIONS_OK = new Set([
    'jpg','jpeg','png','gif','webp',
    'pdf',
    'doc','docx',
    'xls','xlsx',
    'txt',
  ]);

  besoinsDisponibles = [
    'Electricité (domestique)',
    'Fourreau bouché',
    'Regard enterré',
    'Préfibrage',
    'Passage dans les combles / vide sanitaire',
    'Tranchée (Préciser le type de sol)',
    'Electricité (Détails dans Message)',
    'Dépannage (Réparation installation ADSL/FIBRE)',
    'Création Réseau RJ45',
    'Déplacement de prise optique',
    'Expertise Installation',
    'Elagage / Etêtage',
  ];

  private vide(): ContactForm {
    return {
      type: 'Professionnel', nom: '', email: '',
      tel: '', ville: '', adresse: '',
      besoins: [], operateur: '', message: '',
    };
  }

  toggleBesoin(b: string): void {
    const idx = this.form.besoins.indexOf(b);
    if (idx >= 0) this.form.besoins.splice(idx, 1);
    else this.form.besoins.push(b);
  }

  hasBesoin(b: string): boolean {
    return this.form.besoins.includes(b);
  }

  // ── Icône selon extension ────────────────────────────────
  getFileIcon(nom: string): string {
    const ext = nom.split('.').pop()?.toLowerCase() ?? '';
    if (['jpg','jpeg','png','gif','webp'].includes(ext)) return '🖼️';
    if (ext === 'pdf')                                   return '📄';
    if (['doc','docx'].includes(ext))                    return '📝';
    if (['xls','xlsx'].includes(ext))                    return '📊';
    return '📎';
  }

  // ── Sélection de fichier ─────────────────────────────────
  onFichierChange(event: Event): void {
    const input  = event.target as HTMLInputElement;
    const file   = input.files?.[0] ?? null;
    if (!file) return;

    const ext = file.name.split('.').pop()?.toLowerCase() ?? '';

    if (!this.EXTENSIONS_OK.has(ext)) {
      this.panier.notify('⚠', 'Format non autorisé', 'JPG, PNG, PDF, Word, Excel, texte seulement.');
      input.value = '';
      return;
    }
    if (file.size > this.TAILLE_MAX) {
      this.panier.notify('⚠', 'Fichier trop lourd', `Limite : 8 Mo. Votre fichier : ${(file.size / 1024 / 1024).toFixed(1)} Mo.`);
      input.value = '';
      return;
    }

    this.fichierSelectionne = file;
  }

  // ── Suppression du fichier ───────────────────────────────
  supprimerFichier(event: Event): void {
    event.preventDefault();
    event.stopPropagation();
    this.fichierSelectionne = null;
    // Réinitialise l'input natif pour permettre de re-sélectionner le même fichier
    const input = document.querySelector('.upload-input') as HTMLInputElement;
    if (input) input.value = '';
  }

  // ── Envoi ────────────────────────────────────────────────
  onSubmit(f: NgForm): void {
    if (!f.valid || this.envoi) return;
    this.envoi = true;

    const formData = new FormData();
    Object.entries(this.form).forEach(([k, v]) => {
      formData.append(k, Array.isArray(v) ? JSON.stringify(v) : String(v ?? ''));
    });
    if (this.fichierSelectionne) {
      formData.append('fichier', this.fichierSelectionne);
    }

    this.http.post(`${this.backend}/contact`, formData).subscribe({
      next: () => {
        this.panier.notify('✓', 'Message envoyé !', 'Nous vous répondrons sous 24h');
        this.form = this.vide();
        this.fichierSelectionne = null;
        f.resetForm();
        this.envoi = false;
      },
      error: (err) => {
        console.error('Erreur envoi contact :', err);
        const detail = err?.error?.error || 'Veuillez réessayer.';
        this.panier.notify('✗', 'Erreur', detail);
        this.envoi = false;
      },
    });
  }
}