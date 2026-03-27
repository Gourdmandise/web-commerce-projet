import { Component } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { Topbar }        from './shared/topbar/topbart';
import { Nav }           from './shared/nav/nav';
import { FooterComp }    from './shared/footer/footer';
import { Notification }  from './shared/notification/notification';
import { CookieBanner }  from './shared/cookie-banner/cookie-banner';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [RouterOutlet, Topbar, Nav, FooterComp, Notification, CookieBanner],
  templateUrl: './app.html',
  styleUrls: ['./app.css'],
})
export class App {}