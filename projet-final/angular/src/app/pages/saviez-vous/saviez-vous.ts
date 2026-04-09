import { Component, ViewEncapsulation } from '@angular/core';
import { RouterLink } from '@angular/router';

@Component({
  selector: 'app-saviez-vous',
  standalone: true,
  imports: [RouterLink],
  templateUrl: './saviez-vous.html',
  styleUrls: ['./saviez-vous.css'],
  encapsulation: ViewEncapsulation.None,
})
export class SaviezVous {}