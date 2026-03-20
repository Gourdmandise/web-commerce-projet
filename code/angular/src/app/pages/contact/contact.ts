import { Component, inject } from '@angular/core';
import { FormsModule, NgForm } from '@angular/forms';
import { RouterLink } from '@angular/router';
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

  form: ContactForm = this.vide();

  besoinsDisponibles = [
    'Détection tout réseaux et/ou géoréférencement',
    'Recherche et détection d\'un point de blocage dans une gaine',
    'Détecter un regard télécom caché ou enterré en domaine privatif',
    'Effectuer une tranchée avec ou sans pose de fourreau',
    'Réparation d\'un câble adsl, réseaux ou fibre optique',
    'Création d\'une adduction au domaine public',
  ];

  private vide(): ContactForm {
    return { type: 'Professionnel', nom: '', email: '', tel: '', ville: '', adresse: '', besoins: [], operateur: '', message: '' };
  }

  toggleBesoin(b: string): void {
    const idx = this.form.besoins.indexOf(b);
    if (idx >= 0) this.form.besoins.splice(idx, 1);
    else this.form.besoins.push(b);
  }

  hasBesoin(b: string): boolean {
    return this.form.besoins.includes(b);
  }

  onSubmit(f: NgForm): void {
    if (!f.valid) return;
    this.panier.notify('✓', 'Message envoyé !', 'Nous vous répondrons sous 24h');
    this.form = this.vide();
    f.resetForm();
  }
}