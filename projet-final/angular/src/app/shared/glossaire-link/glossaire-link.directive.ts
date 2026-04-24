import { Directive, ElementRef, HostListener, OnInit } from '@angular/core';
import { Router } from '@angular/router';
import { GlossaireService } from '../../services/glossaire.service';

const SKIP_TAGS = new Set(['A', 'BUTTON', 'INPUT', 'TEXTAREA', 'SELECT', 'SCRIPT', 'STYLE', 'CODE', 'PRE']);

@Directive({
  selector: '[appGlossaireLink]',
  standalone: true,
})
export class GlossaireLinkDirective implements OnInit {
  constructor(
    private el: ElementRef<HTMLElement>,
    private router: Router,
    private glossaireService: GlossaireService,
  ) {}

  async ngOnInit() {
    const termes = await this.glossaireService.charger();
    if (termes.length) this.highlight(termes);
  }

  @HostListener('click', ['$event'])
  onClick(e: MouseEvent) {
    const target = e.target as HTMLElement;
    if (target.classList.contains('gl-term-link')) {
      e.preventDefault();
      this.router.navigate(['/saviez-vous/glossaire']);
    }
  }

  private highlight(termes: string[]) {
    const sorted = [...termes]
      .map(t => t.trim())
      .filter(Boolean)
      .sort((a, b) => b.length - a.length);

    if (!sorted.length) return;

    const escaped = sorted.map(t => t.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'));

    // Match only full terms to avoid breaking words (e.g. "choisir" containing "oi").
    const regex = new RegExp(`(?<![\\p{L}\\p{N}])(${escaped.join('|')})(?![\\p{L}\\p{N}])`, 'giu');
    this.processNode(this.el.nativeElement, regex);
  }

  private processNode(node: Node, regex: RegExp): void {
    if (node.nodeType === Node.TEXT_NODE) {
      const text = node.textContent ?? '';
      if (!regex.test(text)) { regex.lastIndex = 0; return; }
      regex.lastIndex = 0;

      const frag = document.createDocumentFragment();
      let last = 0;
      let match: RegExpExecArray | null;
      while ((match = regex.exec(text)) !== null) {
        if (match.index > last) {
          frag.appendChild(document.createTextNode(text.slice(last, match.index)));
        }
        const a = document.createElement('a');
        a.href = '/saviez-vous/glossaire';
        a.className = 'gl-term-link';
        a.textContent = match[0];
        frag.appendChild(a);
        last = regex.lastIndex;
      }
      if (last < text.length) frag.appendChild(document.createTextNode(text.slice(last)));
      node.parentNode?.replaceChild(frag, node);
      return;
    }

    if (node.nodeType === Node.ELEMENT_NODE) {
      const el = node as HTMLElement;
      if (SKIP_TAGS.has(el.tagName)) return;
    }

    Array.from(node.childNodes).forEach(child => this.processNode(child, regex));
  }
}
