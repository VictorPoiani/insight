'use client';

import { useEffect, useRef, useState } from 'react';
import { Loader2, Printer } from 'lucide-react';
import { PAGE_SPECS, buildArticle, numberHeadings, referenceHtml, type ArticleOutput } from '@/lib/notebook/articleRender';
import type { ArticleData } from '@/lib/notebook/article';
import type { Source } from '@/lib/notebook/sources';

const CM = 37.7953; // px por cm (96 dpi)
const PAGE_W = 21 * CM;
const PAGE_H = 29.7 * CM;

type Page = { body: string; notes: string };

/** Carrega o KaTeX e troca o código das fórmulas pela fórmula desenhada. */
async function renderMath(root: HTMLElement) {
  const nodes = Array.from(root.querySelectorAll('code.nb-math-src, pre.nb-math-src')) as HTMLElement[];
  if (!nodes.length) return;
  const k = (await import('katex')).default;
  for (const el of nodes) {
    const block = el.tagName === 'PRE';
    const span = document.createElement(block ? 'div' : 'span');
    span.className = block ? 'ar-math ar-math--block' : 'ar-math';
    try {
      k.render(el.textContent || '', span, { throwOnError: false, displayMode: block, output: 'html', strict: 'ignore', trust: false, maxSize: 20, maxExpand: 200 });
    } catch {
      span.textContent = el.textContent || '';
    }
    el.replaceWith(span);
  }
}

/** Blocos do documento, prontos para paginar. */
export async function articleBlocks(out: ArticleOutput, a: ArticleData) {
  const root = document.createElement('div');
  root.innerHTML = `${out.pre}<div class="ar-body">${out.body}</div>`;
  numberHeadings(root, a.numbered);
  await renderMath(root);
  // seções secundárias sem quebrar a página do título
  const blocks: HTMLElement[] = [];
  root.childNodes.forEach((n) => {
    if (n.nodeType !== 1) return;
    const el = n as HTMLElement;
    if (el.classList.contains('ar-body')) Array.from(el.children).forEach((c) => blocks.push(c as HTMLElement));
    else if (el.classList.contains('ar-authors')) blocks.push(el);
    else blocks.push(el);
  });
  if (out.references.length) {
    const h = document.createElement('h2');
    h.className = 'ar-refs-title';
    h.textContent = out.refTitle;
    blocks.push(h);
    out.references.forEach((s) => {
      const p = document.createElement('p');
      p.className = 'ar-ref';
      p.innerHTML = referenceHtml(s, a.norm);
      blocks.push(p);
    });
  }
  return blocks;
}

/** Distribui os blocos em páginas A4, com as notas no pé de cada página. */
async function paginate(blocks: HTMLElement[], notes: string[], a: ArticleData, host: HTMLElement): Promise<Page[]> {
  const spec = PAGE_SPECS[a.norm];
  const [mt, mr, mb, ml] = spec.margins.map((c) => c * CM);
  const width = PAGE_W - ml - mr;
  const height = PAGE_H - mt - mb;

  host.innerHTML = '';
  const page = document.createElement('div');
  page.className = 'ar-sheet';
  page.dataset.norm = a.norm;
  page.style.cssText = `position:absolute;left:-20000px;top:0;visibility:hidden;width:${width}px;`;
  const body = document.createElement('div');
  body.className = 'ar-page-body';
  const foot = document.createElement('div');
  foot.className = 'ar-page-notes';
  page.append(body, foot);
  host.appendChild(page);
  if ('fonts' in document) await document.fonts.ready;

  const pages: Page[] = [];
  const pageNotes: number[] = [];
  const noteIds = (el: Element) => Array.from(el.querySelectorAll('sup.nb-fn-ref')).map((s) => Number(s.textContent) || 0).filter(Boolean);
  const renderNotes = () => {
    foot.innerHTML = pageNotes.map((n) => `<p><sup>${n}</sup> ${notes[n - 1] || ''}</p>`).join('');
  };
  const used = () => body.scrollHeight + (pageNotes.length ? foot.scrollHeight + 14 : 0);
  const finish = () => {
    if (!body.childNodes.length && !pageNotes.length) return;
    pages.push({ body: body.innerHTML, notes: foot.innerHTML });
    body.innerHTML = '';
    pageNotes.length = 0;
    renderNotes();
  };
  const lineH = spec.size * 1.333 * spec.line;

  /** divide um parágrafo pelas palavras: a primeira parte cabe na página */
  const split = (el: HTMLElement): [HTMLElement, HTMLElement] | null => {
    const walker = document.createTreeWalker(el, NodeFilter.SHOW_TEXT);
    const cuts: { node: Text; off: number }[] = [];
    let t: Node | null;
    while ((t = walker.nextNode())) {
      const txt = (t as Text).data;
      for (let i = 0; i < txt.length; i++) if (txt[i] === ' ') cuts.push({ node: t as Text, off: i + 1 });
    }
    if (cuts.length < 4) return null;
    const make = (k: number): [HTMLElement, HTMLElement] => {
      const r1 = document.createRange();
      r1.setStart(el, 0);
      r1.setEnd(cuts[k].node, cuts[k].off);
      const r2 = document.createRange();
      r2.setStart(cuts[k].node, cuts[k].off);
      r2.setEndAfter(el.lastChild!);
      const a1 = el.cloneNode(false) as HTMLElement;
      a1.appendChild(r1.cloneContents());
      const a2 = el.cloneNode(false) as HTMLElement;
      a2.appendChild(r2.cloneContents());
      a2.classList.add('ar-cont');
      return [a1, a2];
    };
    let lo = 0;
    let hi = cuts.length - 1;
    let best = -1;
    while (lo <= hi) {
      const mid = (lo + hi) >> 1;
      const [first] = make(mid);
      body.appendChild(first);
      const added = noteIds(first).filter((n) => !pageNotes.includes(n));
      pageNotes.push(...added);
      renderNotes();
      const ok = used() <= height;
      first.remove();
      pageNotes.splice(pageNotes.length - added.length, added.length);
      renderNotes();
      if (ok) {
        best = mid;
        lo = mid + 1;
      } else hi = mid - 1;
    }
    // pelo menos duas linhas de cada lado
    if (best < 0) return null;
    const parts = make(best);
    return parts[1].textContent!.trim() ? parts : null;
  };

  const place = (el: HTMLElement, depth = 0): void => {
    body.appendChild(el);
    const added = noteIds(el).filter((n) => !pageNotes.includes(n));
    pageNotes.push(...added);
    renderNotes();
    const isHead = /^H[1-4]$/.test(el.tagName) && !el.classList.contains('ar-title');
    const room = height - used();
    if (used() <= height && (!isHead || room >= lineH * 3)) return;
    // não coube: desfaz
    el.remove();
    pageNotes.splice(pageNotes.length - added.length, added.length);
    renderNotes();
    if (el.tagName === 'P' && depth < 40) {
      const parts = split(el);
      if (parts) {
        body.appendChild(parts[0]);
        noteIds(parts[0]).forEach((n) => !pageNotes.includes(n) && pageNotes.push(n));
        renderNotes();
        finish();
        return place(parts[1], depth + 1);
      }
    }
    if (!body.childNodes.length) {
      // maior que a página inteira (tabela, imagem): fica sozinho
      body.appendChild(el);
      added.forEach((n) => pageNotes.push(n));
      renderNotes();
      finish();
      return;
    }
    finish();
    place(el, depth + 1);
  };

  for (const b of blocks) place(b);
  finish();
  host.innerHTML = '';
  return pages;
}

/**
 * Folha: o artigo diagramado em páginas A4 pela norma (margens, fonte,
 * entrelinha, notas no pé da página e numeração). É o que vai para o PDF.
 */
export function ArticleSheet({ title, md, sources, a, cited }: { title: string; md: string; sources: Record<string, Source>; a: ArticleData; cited: string[] }) {
  const [pages, setPages] = useState<Page[] | null>(null);
  const hostRef = useRef<HTMLDivElement>(null);
  const wrapRef = useRef<HTMLDivElement>(null);
  const [zoom, setZoom] = useState(1);
  const key = JSON.stringify([title, md, a, cited, Object.keys(sources).length]);

  useEffect(() => {
    let alive = true;
    const t = window.setTimeout(async () => {
      const out = buildArticle(title, md, sources, a, cited);
      const blocks = await articleBlocks(out, a);
      if (!hostRef.current || !alive) return;
      const p = await paginate(blocks, out.notes, a, hostRef.current);
      if (alive) setPages(p);
    }, 150);
    return () => {
      alive = false;
      window.clearTimeout(t);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);

  useEffect(() => {
    const el = wrapRef.current;
    if (!el) return;
    const ro = new ResizeObserver(() => setZoom(Math.min(1, (el.clientWidth - 8) / PAGE_W)));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const spec = PAGE_SPECS[a.norm];
  const [mt, mr, mb, ml] = spec.margins.map((c) => c * CM);

  return (
    <div ref={wrapRef} className="ar-sheets">
      <div ref={hostRef} aria-hidden="true" />
      <div className="ar-sheets-bar">
        <span>{pages ? `${pages.length} ${pages.length === 1 ? 'página' : 'páginas'} · A4` : 'Diagramando…'}</span>
        <button type="button" disabled={!pages} onClick={() => pages && printPages(pages, a, title)} className="nb-world-btn">
          <Printer className="w-3.5 h-3.5" /> PDF / Imprimir
        </button>
      </div>
      {!pages ? (
        <div className="py-16 grid place-items-center">
          <Loader2 className="w-5 h-5 animate-spin text-[var(--nb-ink-3)]" />
        </div>
      ) : (
        <div className="ar-pages" style={{ zoom }}>
          {pages.map((p, i) => (
            <Sheet key={i} page={p} index={i} a={a} margins={[mt, mr, mb, ml]} />
          ))}
        </div>
      )}
    </div>
  );
}

function Sheet({ page, index, a, margins }: { page: Page; index: number; a: ArticleData; margins: number[] }) {
  const [mt, mr, mb, ml] = margins;
  // ABNT: número no canto superior direito, a partir da segunda folha
  const showNum = a.norm === 'apa' || index > 0;
  return (
    <section className="ar-sheet ar-page" data-norm={a.norm} style={{ width: PAGE_W, height: PAGE_H, padding: `${mt}px ${mr}px ${mb}px ${ml}px` }}>
      {showNum && (
        <span className="ar-page-num" style={{ top: Math.min(2 * CM, mt / 2), right: a.norm === 'abnt' ? 2 * CM : mr }}>
          {index + 1}
        </span>
      )}
      <div className="ar-page-inner" style={{ height: PAGE_H - mt - mb }}>
        <div className="ar-page-body" dangerouslySetInnerHTML={{ __html: page.body }} />
        {page.notes && <div className="ar-page-notes" dangerouslySetInnerHTML={{ __html: page.notes }} />}
      </div>
    </section>
  );
}

/** Abre a impressão só com as páginas (o navegador salva em PDF). */
export function printPages(pages: Page[], a: ArticleData, title: string) {
  const host = document.querySelector('.ar-pages');
  if (!host) return;
  const iframe = document.createElement('iframe');
  iframe.style.cssText = 'position:fixed;right:0;bottom:0;width:0;height:0;border:0;';
  document.body.appendChild(iframe);
  const doc = iframe.contentDocument!;
  const styles = Array.from(document.querySelectorAll('link[rel="stylesheet"], style'))
    .map((n) => n.outerHTML)
    .join('');
  doc.open();
  doc.write(
    `<!doctype html><html lang="pt-BR"><head><meta charset="utf-8"><title>${title.replace(/</g, '&lt;')}</title>${styles}<style>@page{size:A4;margin:0}html,body{margin:0;padding:0;background:#fff}.ar-pages{zoom:1!important;gap:0!important;padding:0!important}.ar-page{box-shadow:none!important;margin:0!important;break-after:page;page-break-after:always}.ar-page:last-child{break-after:auto;page-break-after:auto}</style></head><body><div class="ar-pages">${host.innerHTML}</div></body></html>`
  );
  doc.close();
  const go = () => {
    iframe.contentWindow?.focus();
    iframe.contentWindow?.print();
    setTimeout(() => iframe.remove(), 1500);
  };
  // espera estilos e imagens
  if (doc.readyState === 'complete') setTimeout(go, 400);
  else iframe.onload = () => setTimeout(go, 400);
  void pages;
  void a;
}
