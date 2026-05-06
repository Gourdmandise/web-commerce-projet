import { Component, signal, HostListener, inject, OnInit } from '@angular/core';
import { RouterOutlet, Router, NavigationEnd } from '@angular/router';
import { Title, Meta } from '@angular/platform-browser';
import { filter } from 'rxjs/operators';
import { Topbar }       from './shared/topbar/topbart';
import { Nav }          from './shared/nav/nav';
import { FooterComp }   from './shared/footer/footer';
import { Notification } from './shared/notification/notification';

const META: Record<string, { title: string; description: string }> = {
  '':                           { title: 'X3COM — Solutions Connectées & Durables', description: 'X3COM intervient sur vos réseaux télécom, fibre optique, détection et géoréférencement en Occitanie. Devis rapide, techniciens certifiés.' },
  'nos-services':               { title: 'Nos tarifs & offres — X3COM', description: 'Découvrez les formules X3COM pour particuliers, collectivités et entreprises : diagnostic, travaux, précâblage fibre. Tarifs transparents.' },
  'tarifs':                     { title: 'Nos tarifs & offres — X3COM', description: 'Découvrez les formules X3COM pour particuliers, collectivités et entreprises : diagnostic, travaux, précâblage fibre. Tarifs transparents.' },
  'nos-prestations':            { title: 'Nos prestations terrassement & VRD — X3COM', description: 'Terrassement, pose de fourreaux, raccordement fibre. X3COM prend en charge vos travaux et votre dossier d\'aide État ASP en Occitanie.' },
  'terrassement':               { title: 'Nos prestations terrassement & VRD — X3COM', description: 'Terrassement, pose de fourreaux, raccordement fibre. X3COM prend en charge vos travaux et votre dossier d\'aide État ASP en Occitanie.' },
  'nos-collectivites':          { title: 'Solutions pour collectivités — X3COM', description: 'X3COM accompagne les collectivités dans leurs projets de pré-fibrage, diagnostic territorial et déploiement numérique.' },
  'nos-entreprises-promoteurs': { title: 'Solutions pour entreprises & promoteurs — X3COM', description: 'Précâblage fibre pour promoteurs immobiliers. X3COM réalise vos projets de précâblage collectif conformes NF C 15-100.' },
  'contact':                    { title: 'Contact — X3COM', description: 'Contactez X3COM à Toulouse pour un devis, une question technique ou prendre rendez-vous. Réponse sous 24h.' },
  'saviez-vous':                { title: 'Le saviez-vous ? — X3COM', description: 'Tout savoir sur la fibre optique, l\'arrêt du cuivre, les aides État et la résilience des réseaux télécom en France.' },
  'saviez-vous/aide-travaux':   { title: 'Aides aux travaux fibre — X3COM', description: 'Découvrez les aides financières de l\'État (ASP) pour vos travaux de raccordement fibre. X3COM gère votre dossier.' },
  'saviez-vous/arret-cuivre':   { title: 'Arrêt du cuivre — X3COM', description: 'Orange arrête progressivement le réseau cuivre. X3COM vous accompagne dans votre migration vers la fibre optique.' },
  'saviez-vous/glossaire':      { title: 'Glossaire télécom — X3COM', description: 'Lexique des termes techniques télécom : fibre, FTTH, fourreau, PBO, NRO… Comprendre les réseaux simplement.' },
  'saviez-vous/resilience':     { title: 'Résilience des réseaux — X3COM', description: 'Comment garantir la continuité de service de vos réseaux télécom ? X3COM vous explique les enjeux de résilience.' },
  'mentions-legales':           { title: 'Mentions légales — X3COM', description: 'Mentions légales du site X3COM : éditeur, hébergeur, propriété intellectuelle.' },
  'cgv':                        { title: 'Conditions générales de vente — X3COM', description: 'CGV X3COM : tarifs, modalités de paiement, délais d\'intervention et garanties.' },
  'cgu':                        { title: 'Conditions générales d\'utilisation — X3COM', description: 'CGU du site x3com.com : accès, création de compte, obligations des utilisateurs.' },
  'confidentialite':            { title: 'Politique de confidentialité — X3COM', description: 'Protection de vos données personnelles chez X3COM. Conformité RGPD, droits d\'accès et de suppression.' },
};

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [RouterOutlet, Topbar, Nav, FooterComp, Notification],
  templateUrl: './app.html',
  styleUrls: ['./app.css'],
})
export class App implements OnInit {
  private titleSvc = inject(Title);
  private metaSvc  = inject(Meta);
  private router   = inject(Router);

  showScrollTop = signal(false);

  ngOnInit(): void {
    this.router.events.pipe(
      filter(e => e instanceof NavigationEnd)
    ).subscribe((e: any) => {
      const path = e.urlAfterRedirects.replace(/^\//, '').split('?')[0];
      const m = META[path] ?? META[''];
      this.titleSvc.setTitle(m.title);
      this.metaSvc.updateTag({ name: 'description',       content: m.description });
      this.metaSvc.updateTag({ property: 'og:title',       content: m.title });
      this.metaSvc.updateTag({ property: 'og:description', content: m.description });
      this.metaSvc.updateTag({ property: 'og:url',         content: `https://www.x3com.com/${path}` });
      this.metaSvc.updateTag({ name: 'twitter:title',       content: m.title });
      this.metaSvc.updateTag({ name: 'twitter:description', content: m.description });
    });
  }

  @HostListener('window:scroll')
  onScroll(): void {
    this.showScrollTop.set(window.scrollY > 400);
  }

  scrollTop(): void {
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }
}
