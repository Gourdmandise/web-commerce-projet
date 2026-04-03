import { Component, ViewEncapsulation } from '@angular/core';
import { RouterLink } from '@angular/router';

@Component({
  selector: 'app-footer',
  standalone: true,
  imports: [RouterLink],
  templateUrl: './footer.html',
  styleUrls: ['./footer.css'],
  encapsulation: ViewEncapsulation.None,
})
export class FooterComp {
  annee = new Date().getFullYear();
}