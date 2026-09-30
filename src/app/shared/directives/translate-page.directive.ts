import { Directive, ElementRef, OnDestroy, OnInit, effect, inject } from '@angular/core';
import { LanguageService } from '../../core/services/language.service';

@Directive({ selector: '[resqTranslatePage]', standalone: true })
export class TranslatePageDirective implements OnInit, OnDestroy {
  private readonly host = inject(ElementRef<HTMLElement>).nativeElement;
  private readonly language = inject(LanguageService);
  private readonly originalText = new WeakMap<Node, string>();
  private readonly appliedText = new WeakMap<Node, string>();
  private readonly originalAttributes = new WeakMap<Element, Map<string, string>>();
  private readonly observer = new MutationObserver(records => {
    for (const record of records) {
      if (record.type === 'characterData') this.translateTextNode(record.target);
      else record.addedNodes.forEach(node => this.translateTree(node));
    }
  });

  constructor() {
    effect(() => {
      this.language.language();
      queueMicrotask(() => this.translateTree(this.host));
    });
  }

  ngOnInit(): void {
    this.translateTree(this.host);
    this.observer.observe(this.host, { childList: true, characterData: true, subtree: true });
  }

  ngOnDestroy(): void { this.observer.disconnect(); }

  private translateTree(node: Node): void {
    if (node.nodeType === Node.TEXT_NODE) {
      this.translateTextNode(node);
      return;
    }
    if (!(node instanceof Element) || this.shouldSkip(node)) return;
    this.translateAttributes(node);
    node.childNodes.forEach(child => this.translateTree(child));
  }

  private translateTextNode(node: Node): void {
    const parent = node.parentElement;
    if (!parent || this.shouldSkip(parent)) return;
    const current = node.nodeValue ?? '';
    if (current !== this.appliedText.get(node)) this.originalText.set(node, current);
    const original = this.originalText.get(node) ?? current;
    const translated = this.language.translateText(original);
    this.appliedText.set(node, translated);
    if (current !== translated) node.nodeValue = translated;
  }

  private translateAttributes(element: Element): void {
    const attributes = ['placeholder', 'title', 'aria-label'];
    let originals = this.originalAttributes.get(element);
    if (!originals) { originals = new Map(); this.originalAttributes.set(element, originals); }
    for (const name of attributes) {
      const current = element.getAttribute(name);
      if (current === null) continue;
      if (!originals.has(name)) originals.set(name, current);
      const translated = this.language.translateText(originals.get(name)!);
      if (current !== translated) element.setAttribute(name, translated);
    }
  }

  private shouldSkip(element: Element): boolean {
    return !!element.closest('mat-icon, script, style, code, svg');
  }
}
