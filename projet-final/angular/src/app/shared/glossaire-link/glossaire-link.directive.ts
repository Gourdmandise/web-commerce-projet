import { Directive, ElementRef, HostListener, OnInit } from '@angular/core';
import { Router } from '@angular/router';
import { GlossaireService } from '../../services/glossaire.service';

const SKIP_TAGS = new Set(['A', 'BUTTON', 'INPUT', 'TEXTAREA', 'SELECT', 'SCRIPT', 'STYLE', 'CODE', 'PRE']);
const EXCLUDED_TERMS = new Set(['GTR', 'FTTH', 'NRO', 'ARCEP', 'THD']);

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
    const targetNode = e.target as Node | null;
    const targetEl = targetNode instanceof Element ? targetNode : targetNode?.parentElement;
    const link = targetEl?.closest('a.gl-term-link');
    if (link) {
      e.preventDefault();
      this.router.navigate(['/saviez-vous/glossaire']);
    }
  }

  private highlight(termes: string[]) {
    const sorted = [...termes]
      .map(t => t.trim())
      .filter(Boolean)
      .filter(t => !EXCLUDED_TERMS.has(this.normalizeTerm(t)))
      .sort((a, b) => b.length - a.length);

    if (!sorted.length) return;

    const escaped = sorted.map(t => t.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'));

    // Match only full terms (browser-compatible, without lookbehind).
    const regex = new RegExp(`(^|[^\\p{L}\\p{N}])(${escaped.join('|')})(?=$|[^\\p{L}\\p{N}])`, 'giu');
    this.processNode(this.el.nativeElement, regex);
  }

  private normalizeTerm(term: string): string {
    return term.trim().toUpperCase();
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
        const prefix = match[1] ?? '';
        const term = match[2] ?? '';
        const termStart = match.index + prefix.length;

        if (termStart > last) {
          frag.appendChild(document.createTextNode(text.slice(last, termStart)));
        }
        if (EXCLUDED_TERMS.has(this.normalizeTerm(term))) {
          frag.appendChild(document.createTextNode(term));
          last = termStart + term.length;
          continue;
        }
        const a = document.createElement('a');
        a.href = '/saviez-vous/glossaire';
        a.className = 'gl-term-link';
        a.textContent = term;
        frag.appendChild(a);
        last = termStart + term.length;
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
