/**
 * Menções em contexto:
 *  - trechos exatos em que uma menção aparece numa nota;
 *  - nomes (ou apelidos) de menções escritos no texto sem a marcação,
 *    para marcar com um clique (como as "menções não vinculadas" do Obsidian).
 * Funciona em notas de texto (markdown) e capítulos (HTML do modo escritor).
 */
import { blockMode, mdToText } from './diff';
import type { NotebookEntry } from './entries';
import type { NotebookItem } from './types';

export interface Snippet {
  before: string;
  match: string;
  after: string;
}

export interface UnlinkedHit {
  /** chave estável dentro da nota (posição) */
  key: string;
  entryId: string;
  text: string;
  snippet: Snippet;
}

const CTX = 70;
const clip = (before: string, match: string, after: string): Snippet => {
  const b = before.replace(/\s+/g, ' ');
  const a = after.replace(/\s+/g, ' ');
  return {
    before: (b.length > CTX ? '…' + b.slice(-CTX).replace(/^\S*\s/, '') : b).trimStart(),
    match,
    after: (a.length > CTX ? a.slice(0, CTX).replace(/\s\S*$/, '') + '…' : a).trimEnd(),
  };
};

/** texto puro de um pedaço de markdown, mantendo o espaço das pontas */
const mdPiece = (raw: string) => {
  const t = mdToText(raw);
  return (/^\s/.test(raw) && t ? ' ' : '') + t + (/\s$/.test(raw) && t ? ' ' : '');
};

const escRe = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/** Nomes buscados de cada menção, do mais longo ao mais curto. */
function namePatterns(entries: NotebookEntry[]) {
  const out: { entry: NotebookEntry; re: RegExp }[] = [];
  for (const e of entries) {
    if (e.kind !== 'elemento') continue;
    const names = Array.from(new Set([e.title, ...(e.aliases || [])].map((n) => n.trim()).filter((n) => n.length >= 3)));
    for (const n of names) {
      // nomes com maiúscula ("Rosa") só batem com maiúscula; termos em minúscula batem de qualquer jeito
      const flags = /\p{Lu}/u.test(n) ? 'gu' : 'giu';
      out.push({ entry: e, re: new RegExp(`(?<![\\p{L}\\p{N}_])${escRe(n).replace(/\s+/g, '\\s+')}(?![\\p{L}\\p{N}_])`, flags) });
    }
  }
  return out.sort((a, b) => b.re.source.length - a.re.source.length);
}

export function scanMode(item: Pick<NotebookItem, 'template'>) {
  return blockMode(item.template);
}

// ------------------------------------------------------------------ markdown

/** Trechos que não podem receber marcação (links, código, propriedades, tags HTML…). */
function protectedRanges(md: string): [number, number][] {
  const out: [number, number][] = [];
  const add = (re: RegExp) => {
    re.lastIndex = 0;
    let m: RegExpExecArray | null;
    while ((m = re.exec(md))) out.push([m.index, m.index + m[0].length]);
  };
  add(/^---\n[\s\S]*?\n---/g);
  add(/```[\s\S]*?```/g);
  add(/`[^`\n]+`/g);
  add(/!?\[[^\]\n]*\]\([^)\n]*\)/g);
  add(/!?\[\[[^\]\n]*\]\]/g);
  add(/<[^>\n]+>/g);
  add(/https?:\/\/\S+/g);
  add(/^#[\w-]+|(?<=\s)#[\p{L}\w-]+/gmu);
  return out;
}

function mdHits(md: string, entries: NotebookEntry[]) {
  const prot = protectedRanges(md);
  const taken: [number, number][] = [];
  const hits: { start: number; end: number; entry: NotebookEntry }[] = [];
  const overlaps = (s: number, e: number, list: [number, number][]) => list.some(([a, b]) => s < b && e > a);
  for (const { entry, re } of namePatterns(entries)) {
    re.lastIndex = 0;
    let m: RegExpExecArray | null;
    while ((m = re.exec(md))) {
      const s = m.index;
      const e = s + m[0].length;
      if (overlaps(s, e, prot) || overlaps(s, e, taken)) continue;
      taken.push([s, e]);
      hits.push({ start: s, end: e, entry });
    }
  }
  return hits.sort((a, b) => a.start - b.start);
}

function mdLineAround(md: string, s: number, e: number): Snippet {
  const ls = md.lastIndexOf('\n', s - 1) + 1;
  let le = md.indexOf('\n', e);
  if (le < 0) le = md.length;
  return clip(mdPiece(md.slice(ls, s)), md.slice(s, e), mdPiece(md.slice(e, le)));
}

// ------------------------------------------------------------------ HTML

const SKIP = '[data-ref], a, code, pre, h1';

function textNodes(root: HTMLElement) {
  const walker = root.ownerDocument.createTreeWalker(root, NodeFilter.SHOW_TEXT);
  const out: Text[] = [];
  let n: Node | null;
  while ((n = walker.nextNode())) {
    const parent = (n as Text).parentElement;
    if (parent && !parent.closest(SKIP)) out.push(n as Text);
  }
  return out;
}

function blockOf(node: Node): HTMLElement | null {
  const el = node.nodeType === 1 ? (node as HTMLElement) : node.parentElement;
  return (el?.closest('p, li, h2, h3, h4, blockquote, figcaption, td, th') as HTMLElement) || null;
}

function snippetInBlock(node: Node, start: number, len: number): Snippet {
  const block = blockOf(node);
  if (!block) {
    const t = node.textContent || '';
    return clip(t.slice(0, start), t.slice(start, start + len), t.slice(start + len));
  }
  const r = block.ownerDocument.createRange();
  r.setStart(block, 0);
  r.setEnd(node, start);
  const before = r.toString();
  const all = block.textContent || '';
  return clip(before, all.slice(before.length, before.length + len), all.slice(before.length + len));
}

function parseHtml(html: string) {
  const doc = new DOMParser().parseFromString(`<body>${html}</body>`, 'text/html');
  return doc.body;
}

function htmlHits(body: HTMLElement, entries: NotebookEntry[]) {
  const pats = namePatterns(entries);
  const hits: { node: Text; start: number; end: number; entry: NotebookEntry; idx: number }[] = [];
  textNodes(body).forEach((node, idx) => {
    const t = node.data;
    const taken: [number, number][] = [];
    for (const { entry, re } of pats) {
      re.lastIndex = 0;
      let m: RegExpExecArray | null;
      while ((m = re.exec(t))) {
        const s = m.index;
        const e = s + m[0].length;
        if (taken.some(([a, b]) => s < b && e > a)) continue;
        taken.push([s, e]);
        hits.push({ node, start: s, end: e, entry, idx });
      }
    }
  });
  return hits.sort((a, b) => a.idx - b.idx || a.start - b.start);
}

// ------------------------------------------------------------------ API

/** Menções escritas sem marcação nesta nota. */
export function findUnlinked(item: Pick<NotebookItem, 'template' | 'content' | 'data'>, entries: NotebookEntry[]): UnlinkedHit[] {
  const mode = scanMode(item);
  if (!mode || !entries.length || typeof DOMParser === 'undefined') return [];
  if (mode === 'markdown') {
    const md = item.content || '';
    return mdHits(md, entries).map((h) => ({ key: `m${h.start}`, entryId: h.entry.id, text: md.slice(h.start, h.end), snippet: mdLineAround(md, h.start, h.end) }));
  }
  const body = parseHtml(String(item.data?.html || ''));
  return htmlHits(body, entries).map((h) => ({
    key: `h${h.idx}:${h.start}`,
    entryId: h.entry.id,
    text: h.node.data.slice(h.start, h.end),
    snippet: snippetInBlock(h.node, h.start, h.end - h.start),
  }));
}

/**
 * Marca as ocorrências escolhidas (por chave) e devolve o novo texto
 * (`content` para markdown, `html` para capítulos). null = nada mudou.
 */
export function markUnlinked(
  item: Pick<NotebookItem, 'template' | 'content' | 'data'>,
  entries: NotebookEntry[],
  keys: Set<string>
): { content: string } | { html: string } | null {
  const mode = scanMode(item);
  if (!mode || !keys.size) return null;
  if (mode === 'markdown') {
    let md = item.content || '';
    const hits = mdHits(md, entries).filter((h) => keys.has(`m${h.start}`));
    if (!hits.length) return null;
    for (const h of hits.reverse()) {
      const text = md.slice(h.start, h.end).replace(/[[\]]/g, '');
      md = `${md.slice(0, h.start)}[${text}](ref:${h.entry.id} "${h.entry.kind}")${md.slice(h.end)}`;
    }
    return { content: md };
  }
  const body = parseHtml(String(item.data?.html || ''));
  const hits = htmlHits(body, entries).filter((h) => keys.has(`h${h.idx}:${h.start}`));
  if (!hits.length) return null;
  // do fim para o começo, para as posições continuarem válidas
  for (const h of hits.reverse()) {
    const after = h.node.splitText(h.start);
    after.splitText(h.end - h.start);
    const span = body.ownerDocument.createElement('span');
    span.setAttribute('data-ref', h.entry.id);
    span.setAttribute('data-kind', h.entry.kind);
    span.className = `nb-ref nb-ref--${h.entry.kind}`;
    after.parentNode!.replaceChild(span, after);
    span.appendChild(after);
  }
  return { html: body.innerHTML };
}

/** Trechos em que a menção aparece (já marcada) nesta nota. */
export function refSnippets(item: Pick<NotebookItem, 'template' | 'content' | 'data'>, entryId: string, max = 6): Snippet[] {
  const mode = scanMode(item);
  if (!mode || typeof DOMParser === 'undefined') return [];
  const out: Snippet[] = [];
  if (mode === 'markdown') {
    const md = item.content || '';
    const re = new RegExp(`\\[([^\\]\\n]+)\\]\\(ref:${escRe(entryId)}[^)]*\\)`, 'gi');
    let m: RegExpExecArray | null;
    while ((m = re.exec(md)) && out.length < max) {
      const ls = md.lastIndexOf('\n', m.index - 1) + 1;
      let le = md.indexOf('\n', m.index + m[0].length);
      if (le < 0) le = md.length;
      out.push(clip(mdPiece(md.slice(ls, m.index)), m[1], mdPiece(md.slice(m.index + m[0].length, le))));
    }
    return out;
  }
  const body = parseHtml(String(item.data?.html || ''));
  body.querySelectorAll(`[data-ref="${entryId}"]`).forEach((span) => {
    if (out.length >= max) return;
    const block = blockOf(span);
    if (!block) return out.push(clip('', span.textContent || '', ''));
    const r = body.ownerDocument.createRange();
    r.setStart(block, 0);
    r.setEndBefore(span);
    const before = r.toString();
    const all = block.textContent || '';
    const len = (span.textContent || '').length;
    out.push(clip(before, all.slice(before.length, before.length + len), all.slice(before.length + len)));
  });
  return out;
}
