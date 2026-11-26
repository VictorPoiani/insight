/**
 * Artigo pronto para sair: Folha (A4), PDF, Word, Markdown e publicação.
 * Recalcula as citações com as fontes atuais, numera as seções, separa as
 * notas de rodapé e monta as referências pela norma escolhida.
 */
import { renderMarkdown } from './markdown';
import { formatCitationGroup, formatReference, segsHtml, segsText, sortReferences, type CitationNorm, type CiteMode, type Source } from './sources';
import { splitKeywords, type ArticleData } from './article';

const UUID = '[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}';
const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

/** Medidas da página de cada norma (cm) e tipografia. */
export const PAGE_SPECS: Record<CitationNorm, { margins: [number, number, number, number]; font: string; size: number; line: number; indent: number }> = {
  // NBR 14724: 3 cm em cima e à esquerda, 2 cm embaixo e à direita; 12 pt; 1,5
  abnt: { margins: [3, 2, 2, 3], font: "'Times New Roman', Times, serif", size: 12, line: 1.5, indent: 1.25 },
  // APA 7: 2,54 cm em volta; 12 pt; espaço duplo; recuo de 1,27 cm
  apa: { margins: [2.54, 2.54, 2.54, 2.54], font: "'Times New Roman', Times, serif", size: 12, line: 2, indent: 1.27 },
  editorial: { margins: [2.5, 2.5, 2.5, 2.5], font: "Georgia, 'Times New Roman', serif", size: 11.5, line: 1.5, indent: 0 },
};

/** Troca o texto guardado de cada citação pelo cálculo atual (fonte + norma). */
export function refreshCitations(md: string, sources: Record<string, Source>, a: ArticleData): string {
  const re = new RegExp(`\\[([^\\]\\n]*)\\]\\(cite:(${UUID}(?:,${UUID})*)(?:\\s+"([^"\\n]*)")?\\)`, 'gi');
  return md.replace(re, (all, _label, ids: string, meta: string | undefined) => {
    const o: { page: string; mode: CiteMode; apud: string | null } = { page: '', mode: 'paren', apud: null };
    for (const part of (meta || '').split('|')) {
      const p = part.trim();
      if (p === 'paren' || p === 'narrative' || p === 'year') o.mode = p;
      else if (p.startsWith('apud:')) o.apud = p.slice(5);
      else if (p) o.page = p.replace(/^p\.?\s*/i, '');
    }
    const list = ids
      .toLowerCase()
      .split(',')
      .map((id) => sources[id])
      .filter(Boolean);
    if (!list.length) return all;
    const label = formatCitationGroup(list, a.norm, { page: o.page, mode: o.mode, upperCase: a.upperCase, apud: o.apud ? sources[o.apud] : null });
    return `[${label.replace(/[[\]]/g, '')}](cite:${ids}${meta ? ` "${meta}"` : ''})`;
  });
}

export interface ArticleOutput {
  /** elementos pré-textuais em HTML */
  pre: string;
  /** corpo em HTML (sem a lista de notas) */
  body: string;
  /** texto de cada nota de rodapé, na ordem */
  notes: string[];
  references: Source[];
  refTitle: string;
}

/** Monta o artigo inteiro em HTML seguro (a partir do markdown). */
export function buildArticle(title: string, md: string, sources: Record<string, Source>, a: ArticleData, cited: string[]): ArticleOutput {
  const fresh = refreshCitations(md.replace(/^---\n[\s\S]*?\n---\n?/, ''), sources, a);
  const html = renderMarkdown(fresh);
  // a lista de notas vem no fim do HTML: separa
  const m = /<ol class="nb-footnotes">([\s\S]*)<\/ol>$/.exec(html);
  const notes = m ? Array.from(m[1].matchAll(/<li>([\s\S]*?)<\/li>/g)).map((x) => x[1]) : [];
  const body = m ? html.slice(0, m.index) : html;

  const linked = Array.from(new Set([...a.sources, ...cited])).map((id) => sources[id]).filter(Boolean);
  const references = sortReferences(a.onlyCited ? linked.filter((s) => cited.includes(s.id)) : linked, a.norm);

  const p = a.pre;
  const parts: string[] = [`<h1 class="ar-title">${esc(title)}</h1>`];
  if (a.showPre) {
    if (p.subtitle.trim()) parts.push(`<p class="ar-subtitle">${esc(p.subtitle.trim())}</p>`);
    const authors = p.authors
      .split('\n')
      .map((x) => x.trim())
      .filter(Boolean);
    if (authors.length) parts.push(`<div class="ar-authors">${authors.map((x) => `<p>${esc(x)}</p>`).join('')}</div>`);
    const abs = (label: string, text: string, kwLabel: string, kw: string) => {
      if (!text.trim() && !kw.trim()) return;
      if (text.trim()) parts.push(`<p class="ar-abstract"><strong>${label}:</strong> ${esc(text.trim())}</p>`);
      const k = splitKeywords(kw);
      if (k.length) parts.push(`<p class="ar-keywords"><strong>${kwLabel}:</strong> ${esc(k.join('; '))}.</p>`);
    };
    abs(a.norm === 'abnt' ? 'Resumo' : 'Resumo', p.abstract, 'Palavras-chave', p.keywords);
    if (p.showForeign) abs('Abstract', p.abstractForeign, 'Keywords', p.keywordsForeign);
  }
  return {
    pre: parts.join(''),
    body,
    notes,
    references,
    refTitle: a.norm === 'editorial' ? 'Leituras e fontes' : a.norm === 'apa' ? 'Referências' : 'REFERÊNCIAS',
  };
}

export const referenceHtml = (s: Source, norm: CitationNorm) => segsHtml(formatReference(s, norm));
export const referenceText = (s: Source, norm: CitationNorm) => segsText(formatReference(s, norm));

/** Numera as seções (1, 1.1, 1.1.1) num trecho de DOM; devolve a raiz. */
export function numberHeadings(root: HTMLElement, numbered: boolean) {
  const hs = Array.from(root.querySelectorAll('h1:not(.ar-title), h2, h3, h4')) as HTMLElement[];
  const top = hs.some((h) => h.tagName === 'H1') ? 1 : 2;
  const count = [0, 0, 0];
  for (const h of hs) {
    const lv = Math.min(3, Math.max(1, Number(h.tagName[1]) - top + 1));
    h.dataset.level = String(lv);
    count[lv - 1]++;
    for (let k = lv; k < 3; k++) count[k] = 0;
    if (numbered) h.dataset.num = count.slice(0, lv).join('.');
  }
  return root;
}

/** Markdown para levar a outro editor (Pandoc entende as notas ^[...]). */
export function articleMarkdown(title: string, md: string, sources: Record<string, Source>, a: ArticleData, cited: string[]) {
  const out = buildArticle(title, md, sources, a, cited);
  const yaml: string[] = ['---', `title: "${title.replace(/"/g, '\\"')}"`];
  if (a.showPre) {
    if (a.pre.subtitle.trim()) yaml.push(`subtitle: "${a.pre.subtitle.trim().replace(/"/g, '\\"')}"`);
    const authors = a.pre.authors.split('\n').map((x) => x.trim()).filter(Boolean);
    if (authors.length) yaml.push('author:', ...authors.map((x) => `  - "${x.replace(/"/g, '\\"')}"`));
    if (a.pre.abstract.trim()) yaml.push(`abstract: "${a.pre.abstract.trim().replace(/"/g, '\\"')}"`);
    const k = splitKeywords(a.pre.keywords);
    if (k.length) yaml.push(`keywords: [${k.map((x) => `"${x.replace(/"/g, '\\"')}"`).join(', ')}]`);
  }
  yaml.push('---', '');
  // citações viram texto puro; o resto do markdown segue igual
  const body = refreshCitations(md.replace(/^---\n[\s\S]*?\n---\n?/, ''), sources, a)
    .replace(new RegExp(`\\[([^\\]\\n]*)\\]\\(cite:${UUID}(?:,${UUID})*(?:\\s+"[^"\\n]*")?\\)`, 'gi'), '$1')
    .replace(/^\{\{(figura|tabela|quadro|grafico)\}\}\s*/gm, (_, k) => `**${({ figura: 'Figura', tabela: 'Tabela', quadro: 'Quadro', grafico: 'Gráfico' } as Record<string, string>)[k]}:** `)
    .replace(/^\{\{fonte\}\}\s*/gm, '')
    .replace(/^> \[!longa\][^\n]*\n/gm, '');
  const refs = out.references.length ? `\n\n## ${out.refTitle}\n\n${out.references.map((s) => formatReference(s, a.norm).map((g) => { const t = g.t.replace(/\*/g, '\\*'); return g.b ? `**${t}**` : g.i ? `*${t}*` : t; }).join('')).join('\n\n')}\n` : '';
  return `${yaml.join('\n')}${body.trim()}\n${refs}`;
}
