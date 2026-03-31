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
  fichier?:  File | null;
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
  fichierSelectionne: File | null = null;

  private vide(): ContactForm {
    this.fichierSelectionne = null;
    return { type: 'Professionnel', nom: '', email: '', tel: '', ville: '', adresse: '', besoins: [], operateur: '', message: '', fichier: null };
  }

  toggleBesoin(b: string): void {
    const idx = this.form.besoins.indexOf(b);
    if (idx >= 0) this.form.besoins.splice(idx, 1);
    else this.form.besoins.push(b);
  }

  hasBesoin(b: string): boolean {
    return this.form.besoins.includes(b);
  }

  onFichierChange(event: Event): void {
    const input = event.target as HTMLInputElement;
    this.fichierSelectionne = input.files?.[0] ?? null;
  }

  onSubmit(f: NgForm): void {
    if (!f.valid || this.envoi) return;
    this.envoi = true;

    const formData = new FormData();
    Object.entries(this.form).forEach(([k, v]) => {
      if (k === 'fichier') return;
      formData.append(k, Array.isArray(v) ? JSON.stringify(v) : String(v ?? ''));
    });
    if (this.fichierSelectionne) formData.append('fichier', this.fichierSelectionne);

    this.http.post(`${this.backend}/contact`, formData).subscribe({
      next: () => {
        this.panier.notify('✓', 'Message envoyé !', 'Nous vous répondrons sous 24h');
        this.form = this.vide();
        f.resetForm();
        this.envoi = false;
      },
      error: (err) => {
        console.error('Erreur envoi contact :', err);
        this.panier.notify('✗', 'Erreur', 'Impossible d\'envoyer le message, veuillez réessayer.');
        this.envoi = false;
      },
    });
  }
}