import { Component, inject } from '@angular/core';
import { PanierService } from '../../services/panier.service';

@Component({
  selector: 'app-notification',
  standalone: true,
  imports: [],
  templateUrl: './notification.html',
  styleUrls: ['./notification.css'],
})
export class Notification {
  panier = inject(PanierService);
}