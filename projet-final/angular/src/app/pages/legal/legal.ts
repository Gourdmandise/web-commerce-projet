import { Component, signal } from '@angular/core';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { inject } from '@angular/core';

type PageLegale = 'mentions' | 'cgu' | 'confidentialite' | 'cgv';

@Component({
  selector: 'app-legal',
  standalone: true,
  imports: [RouterLink],
  templateUrl: './legal.html',
  styleUrls: ['./legal.css'],
})
export class Legal {
  route = inject(ActivatedRoute);
  page  = signal<PageLegale>('mentions');

  ngOnInit(): void {
    this.route.data.subscribe(data => {
      if (data['page']) this.page.set(data['page']);
    });
  }
}
