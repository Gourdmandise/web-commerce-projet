import { Component, ViewEncapsulation } from '@angular/core';
import { RouterLink } from '@angular/router';

@Component({
  selector: 'app-resilience',
  standalone: true,
  imports: [RouterLink],
  templateUrl: './resilience.html',
  styleUrls: ['./resilience.css'],
  encapsulation: ViewEncapsulation.None,
})
export class Resilience {}