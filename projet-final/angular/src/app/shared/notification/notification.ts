import { Component, ViewEncapsulation, inject } from '@angular/core';
import { PanierService } from '../../services/panier.service';

@Component({
  selector: 'app-notification',
  standalone: true,
  imports: [],
  templateUrl: './notification.html',
  styleUrls: ['./notification.css'],
  encapsulation: ViewEncapsulation.None,
})
export class Notification {
  panier = inject(PanierService);
}