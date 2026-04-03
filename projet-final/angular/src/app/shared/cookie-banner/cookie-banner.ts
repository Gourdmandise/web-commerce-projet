import { Component, ViewEncapsulation, signal } from '@angular/core';
import { RouterLink } from '@angular/router';

@Component({
  selector: 'app-cookie-banner',
  standalone: true,
  imports: [RouterLink],
  templateUrl: './cookie-banner.html',
  styleUrls: ['./cookie-banner.css'],
  encapsulation: ViewEncapsulation.None,
})
export class CookieBanner {
  // sessionStorage : réinitialisé à chaque fermeture du navigateur
  // (contrairement à localStorage qui persiste indéfiniment)
  visible = signal(localStorage.getItem('x3com_cookies') === null);

  accepter(): void {
    localStorage.setItem('x3com_cookies', 'accepte');
    this.visible.set(false);
  }

  refuser(): void {
    localStorage.setItem('x3com_cookies', 'refuse');
    this.visible.set(false);
  }
}
