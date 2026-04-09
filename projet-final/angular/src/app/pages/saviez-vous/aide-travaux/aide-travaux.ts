import { Component, ViewEncapsulation } from '@angular/core';
import { RouterLink } from '@angular/router';

@Component({
  selector: 'app-aide-travaux',
  standalone: true,
  imports: [RouterLink],
  templateUrl: './aide-travaux.html',
  styleUrls: ['./aide-travaux.css'],
  encapsulation: ViewEncapsulation.None,
})
export class AideTravaux {
  simulChoix: string = '';
  choisir(type: string) { this.simulChoix = type; }
}