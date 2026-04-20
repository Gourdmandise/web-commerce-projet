import { Component, ViewEncapsulation } from '@angular/core';
import { RouterLink } from '@angular/router';
import { GlossaireLinkDirective } from '../../../shared/glossaire-link/glossaire-link.directive';

@Component({
  selector: 'app-resilience',
  standalone: true,
  imports: [RouterLink, GlossaireLinkDirective],
  templateUrl: './resilience.html',
  styleUrls: ['./resilience.css'],
  encapsulation: ViewEncapsulation.None,
})
export class Resilience {}