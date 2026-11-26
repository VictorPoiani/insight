/**
 * Fontes e referências (artigos profissionais).
 * Formata referências pela ABNT NBR 6023:2018 e pela APA 7, e as chamadas
 * de citação no texto (ABNT NBR 10520 e APA). As funções devolvem partes
 * de texto com ênfase (negrito/itálico) para a tela, o DOCX e o PDF.
 */

export type SourceType = 'livro' | 'capitulo' | 'artigo' | 'tese' | 'site' | 'video' | 'documento' | 'lei' | 'evento' | 'entrevista' | 'outro';
export type CitationNorm = 'abnt' | 'apa' | 'editorial';

export interface SourceAuthor {
  /** sobrenome (pessoa) ou nome completo (entidade) */
  family: string;
  given?: string;
  kind?: 'pessoa' | 'entidade';
}

export interface Source {
  id: string;
  profile_id: string;
  project_id: string | null;
  type: SourceType;
  authors: SourceAuthor[];
  title: string;
  subtitle: string | null;
  container: string | null;
  edition: string | null;
  place: string | null;
  publisher: string | null;
  year: string | null;
  month: string | null;
  volume: string | null;
  issue: string | null;
  pages: string | null;
  doi: string | null;
  isbn: string | null;
  url: string | null;
  accessed_on: string | null;
  extra: SourceExtra;
  notes: string;
  created_at: string;
  updated_at: string;
}

export interface SourceExtra {
  /** organizadores do livro (capítulo) */
  editors?: string;
  /** tese: "Tese (Doutorado em Letras)", instituição */
  degree?: string;
  institution?: string;
  /** lei: ementa e data por extenso */
  summary?: string;
  /** vídeo: duração; evento: nome do evento */
  duration?: string;
  event?: string;
  /** entrevista: entrevistador */
  interviewer?: string;
}

export interface SourceQuote {
  id: string;
  profile_id: string;
  source_id: string;
  text: string;
  page: string | null;
  comment: string;
  created_at: string;
}

export type SourceField = keyof Pick<Source, 'subtitle' | 'container' | 'edition' | 'place' | 'publisher' | 'year' | 'month' | 'volume' | 'issue' | 'pages' | 'doi' | 'isbn' | 'url' | 'accessed_on'> | `extra.${keyof SourceExtra}`;

/** Campos de cada tipo, com o rótulo usado no formulário. */
export const SOURCE_TYPES: { id: SourceType; label: string; fields: { key: SourceField; label: string; hint?: string }[] }[] = [
  {
    id: 'livro',
    label: 'Livro',
    fields: [
      { key: 'subtitle', label: 'Subtítulo' },
      { key: 'edition', label: 'Edição', hint: 'ex.: 2' },
      { key: 'place', label: 'Local', hint: 'cidade' },
      { key: 'publisher', label: 'Editora' },
      { key: 'year', label: 'Ano' },
      { key: 'pages', label: 'Total de páginas' },
      { key: 'isbn', label: 'ISBN' },
      { key: 'url', label: 'Endereço (e-book)' },
      { key: 'accessed_on', label: 'Acesso em' },
    ],
  },
  {
    id: 'capitulo',
    label: 'Capítulo de livro',
    fields: [
      { key: 'extra.editors', label: 'Organizadores do livro', hint: 'SOUZA, Maria; LIMA, João' },
      { key: 'container', label: 'Título do livro' },
      { key: 'edition', label: 'Edição' },
      { key: 'place', label: 'Local' },
      { key: 'publisher', label: 'Editora' },
      { key: 'year', label: 'Ano' },
      { key: 'pages', label: 'Páginas do capítulo', hint: '45-67' },
    ],
  },
  {
    id: 'artigo',
    label: 'Artigo de periódico',
    fields: [
      { key: 'subtitle', label: 'Subtítulo' },
      { key: 'container', label: 'Revista / periódico' },
      { key: 'place', label: 'Local' },
      { key: 'volume', label: 'Volume' },
      { key: 'issue', label: 'Número' },
      { key: 'pages', label: 'Páginas', hint: '12-34' },
      { key: 'month', label: 'Mês' },
      { key: 'year', label: 'Ano' },
      { key: 'doi', label: 'DOI' },
      { key: 'url', label: 'Endereço' },
      { key: 'accessed_on', label: 'Acesso em' },
    ],
  },
  {
    id: 'tese',
    label: 'Tese, dissertação ou TCC',
    fields: [
      { key: 'subtitle', label: 'Subtítulo' },
      { key: 'year', label: 'Ano' },
      { key: 'extra.degree', label: 'Tipo e área', hint: 'Dissertação (Mestrado em História)' },
      { key: 'extra.institution', label: 'Instituição' },
      { key: 'place', label: 'Local' },
      { key: 'url', label: 'Endereço' },
      { key: 'accessed_on', label: 'Acesso em' },
    ],
  },
  {
    id: 'site',
    label: 'Página da internet',
    fields: [
      { key: 'container', label: 'Nome do site' },
      { key: 'place', label: 'Local' },
      { key: 'year', label: 'Ano' },
      { key: 'month', label: 'Dia e mês', hint: '5 mar.' },
      { key: 'url', label: 'Endereço' },
      { key: 'accessed_on', label: 'Acesso em' },
    ],
  },
  {
    id: 'video',
    label: 'Vídeo',
    fields: [
      { key: 'container', label: 'Canal / plataforma' },
      { key: 'place', label: 'Local' },
      { key: 'year', label: 'Ano' },
      { key: 'extra.duration', label: 'Duração', hint: '12 min' },
      { key: 'url', label: 'Endereço' },
      { key: 'accessed_on', label: 'Acesso em' },
    ],
  },
  {
    id: 'documento',
    label: 'Documento ou relatório',
    fields: [
      { key: 'subtitle', label: 'Subtítulo' },
      { key: 'place', label: 'Local' },
      { key: 'publisher', label: 'Responsável / editora' },
      { key: 'year', label: 'Ano' },
      { key: 'url', label: 'Endereço' },
      { key: 'accessed_on', label: 'Acesso em' },
    ],
  },
  {
    id: 'lei',
    label: 'Lei ou norma',
    fields: [
      { key: 'extra.summary', label: 'Ementa' },
      { key: 'container', label: 'Publicação', hint: 'Diário Oficial da União' },
      { key: 'place', label: 'Local', hint: 'Brasília, DF' },
      { key: 'year', label: 'Ano' },
      { key: 'url', label: 'Endereço' },
      { key: 'accessed_on', label: 'Acesso em' },
    ],
  },
  {
    id: 'evento',
    label: 'Trabalho em evento',
    fields: [
      { key: 'extra.event', label: 'Evento', hint: 'CONGRESSO BRASILEIRO DE…, 10., 2024, Recife' },
      { key: 'container', label: 'Título dos anais', hint: 'Anais' },
      { key: 'place', label: 'Local da publicação' },
      { key: 'publisher', label: 'Editora' },
      { key: 'year', label: 'Ano' },
      { key: 'pages', label: 'Páginas' },
      { key: 'url', label: 'Endereço' },
      { key: 'accessed_on', label: 'Acesso em' },
    ],
  },
  {
    id: 'entrevista',
    label: 'Entrevista',
    fields: [
      { key: 'extra.interviewer', label: 'Entrevistador' },
      { key: 'container', label: 'Veículo' },
      { key: 'place', label: 'Local' },
      { key: 'year', label: 'Ano' },
      { key: 'url', label: 'Endereço' },
      { key: 'accessed_on', label: 'Acesso em' },
    ],
  },
  {
    id: 'outro',
    label: 'Outro',
    fields: [
      { key: 'subtitle', label: 'Subtítulo' },
      { key: 'container', label: 'Onde foi publicado' },
      { key: 'place', label: 'Local' },
      { key: 'publisher', label: 'Responsável' },
      { key: 'year', label: 'Ano' },
      { key: 'url', label: 'Endereço' },
      { key: 'accessed_on', label: 'Acesso em' },
    ],
  },
];
export const sourceType = (t: string) => SOURCE_TYPES.find((x) => x.id === t) || SOURCE_TYPES[SOURCE_TYPES.length - 1];

// ------------------------------------------------------------------ partes de texto

/** Pedaço de referência: texto com negrito (ABNT) ou itálico (APA). */
export interface Seg {
  t: string;
  b?: boolean;
  i?: boolean;
}

const clean = (s: string | null | undefined) => (s || '').replace(/\s+/g, ' ').trim();
const endDot = (s: string) => (/[.!?]$/.test(s) ? s : `${s}.`);

function joinSegs(parts: (Seg | string | null | undefined | false)[]): Seg[] {
  const out: Seg[] = [];
  for (const p of parts) {
    if (!p) continue;
    const s = typeof p === 'string' ? { t: p } : p;
    if (!s.t) continue;
    const last = out[out.length - 1];
    if (last && !!last.b === !!s.b && !!last.i === !!s.i) last.t += s.t;
    else out.push({ ...s });
  }
  if (out.length) out[out.length - 1].t = out[out.length - 1].t.replace(/\s+$/, '');
  return out;
}

export const segsText = (s: Seg[]) => s.map((x) => x.t).join('');
export const segsHtml = (s: Seg[]) =>
  s
    .map((x) => {
      const t = x.t.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
      return x.b ? `<strong>${t}</strong>` : x.i ? `<em>${t}</em>` : t;
    })
    .join('');

const MONTHS = ['jan.', 'fev.', 'mar.', 'abr.', 'maio', 'jun.', 'jul.', 'ago.', 'set.', 'out.', 'nov.', 'dez.'];
const MONTHS_EN = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

/** "2025-03-05" → "5 mar. 2025" (ABNT) */
export function abntDate(iso: string | null | undefined) {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso || '');
  return m ? `${Number(m[3])} ${MONTHS[Number(m[2]) - 1]} ${m[1]}` : '';
}
function apaDate(iso: string | null | undefined) {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso || '');
  return m ? `${MONTHS_EN[Number(m[2]) - 1]} ${Number(m[3])}, ${m[1]}` : '';
}

// ------------------------------------------------------------------ autores

const upper = (s: string) => s.toLocaleUpperCase('pt-BR');

/** SOBRENOME, Nome. (ABNT) */
function abntAuthor(a: SourceAuthor) {
  if (a.kind === 'entidade' || !clean(a.given)) return upper(clean(a.family));
  return `${upper(clean(a.family))}, ${clean(a.given)}`;
}
function abntAuthors(list: SourceAuthor[]) {
  const a = list.filter((x) => clean(x.family));
  if (!a.length) return '';
  // até três autores, todos; mais de três, o primeiro seguido de et al.
  if (a.length > 3) return `${abntAuthor(a[0])} et al.`;
  return a.map(abntAuthor).join('; ');
}

const initials = (given: string) =>
  clean(given)
    .split(/[\s-]+/)
    .filter(Boolean)
    .map((p) => (/^(d[aeo]s?|e)$/i.test(p) ? '' : `${p[0].toLocaleUpperCase('pt-BR')}.`))
    .filter(Boolean)
    .join(' ');

/** Sobrenome, I. N. (APA) */
function apaAuthor(a: SourceAuthor) {
  if (a.kind === 'entidade' || !clean(a.given)) return clean(a.family);
  return `${clean(a.family)}, ${initials(a.given || '')}`;
}
function apaAuthors(list: SourceAuthor[]) {
  const a = list.filter((x) => clean(x.family)).map(apaAuthor);
  if (!a.length) return '';
  if (a.length === 1) return a[0];
  if (a.length <= 20) return `${a.slice(0, -1).join(', ')}, & ${a[a.length - 1]}`;
  return `${a.slice(0, 19).join(', ')}, . . . ${a[a.length - 1]}`;
}

// ------------------------------------------------------------------ ABNT NBR 6023

function abntAccess(s: Source): (Seg | string)[] {
  const out: string[] = [];
  if (clean(s.doi)) out.push(` DOI: ${clean(s.doi).replace(/^https?:\/\/(dx\.)?doi\.org\//i, '')}.`);
  if (clean(s.url)) {
    out.push(` Disponível em: ${clean(s.url)}.`);
    if (s.accessed_on) out.push(` Acesso em: ${abntDate(s.accessed_on)}.`);
  }
  return out;
}
const sl = (s: Source) => clean(s.place) || '[S. l.]';
const sn = (s: Source) => clean(s.publisher) || '[s. n.]';
const sd = (s: Source) => clean(s.year) || '[s. d.]';
const ed = (s: Source) => {
  const e = clean(s.edition).replace(/\s*ed\.?$/i, '');
  return e ? ` ${endDot(/^\d+$/.test(e) ? `${e}. ed` : e)}` : '';
};
const titleSub = (s: Source, bold: boolean): Seg[] => {
  const t = clean(s.title);
  const sub = clean(s.subtitle);
  return sub ? [{ t, b: bold }, { t: `: ${sub}` }] : [{ t, b: bold }];
};

export function abntReference(s: Source): Seg[] {
  const au = abntAuthors(s.authors);
  const lead = au ? `${endDot(au)} ` : '';
  const x = s.extra || {};
  switch (s.type) {
    case 'capitulo': {
      const eds = clean(x.editors);
      return joinSegs([
        lead,
        endDot(clean(s.title)),
        ' In: ',
        eds ? `${eds} (org.). ` : '',
        { t: clean(s.container) || '[Título do livro]', b: true },
        '.',
        ed(s),
        ` ${sl(s)}: ${sn(s)}, ${sd(s)}.`,
        clean(s.pages) ? ` p. ${clean(s.pages)}.` : '',
        ...abntAccess(s),
      ]);
    }
    case 'artigo': {
      const vol = clean(s.volume) ? `, v. ${clean(s.volume)}` : '';
      const num = clean(s.issue) ? `, n. ${clean(s.issue)}` : '';
      const pg = clean(s.pages) ? `, p. ${clean(s.pages)}` : '';
      const when = [clean(s.month), sd(s)].filter(Boolean).join(' ');
      return joinSegs([
        lead,
        clean(s.title) + (clean(s.subtitle) ? `: ${clean(s.subtitle)}` : ''),
        '. ',
        { t: clean(s.container) || '[Periódico]', b: true },
        clean(s.place) ? `, ${clean(s.place)}` : '',
        `${vol}${num}${pg}, ${when}.`,
        ...abntAccess(s),
      ]);
    }
    case 'tese':
      return joinSegs([
        lead,
        ...titleSub(s, true),
        `. ${sd(s)}.`,
        clean(x.degree) ? ` ${clean(x.degree)}` : ' Trabalho acadêmico',
        clean(x.institution) ? ` – ${clean(x.institution)}` : '',
        `, ${sl(s)}, ${sd(s)}.`,
        ...abntAccess(s),
      ]);
    case 'site': {
      const has = !!clean(s.container);
      const when = [clean(s.month), sd(s)].filter(Boolean).join(' ');
      return joinSegs([
        lead,
        has ? endDot(clean(s.title)) + ' ' : '',
        has ? { t: clean(s.container), b: true } : { t: clean(s.title), b: true },
        clean(s.place) ? `, ${clean(s.place)}` : '',
        `, ${when}.`,
        ...abntAccess(s),
      ]);
    }
    case 'video':
      return joinSegs([
        lead,
        { t: clean(s.title), b: true },
        '. ',
        `${sl(s)}: ${clean(s.container) || sn(s)}, ${sd(s)}.`,
        ` 1 vídeo${clean(x.duration) ? ` (${clean(x.duration)})` : ''}.`,
        ...abntAccess(s),
      ]);
    case 'lei':
      return joinSegs([
        lead || `${upper('Brasil')}. `,
        endDot(clean(s.title)),
        clean(x.summary) ? ` ${endDot(clean(x.summary))}` : '',
        ' ',
        { t: clean(s.container) || 'Diário Oficial da União', b: true },
        `, ${sl(s)}, ${sd(s)}.`,
        ...abntAccess(s),
      ]);
    case 'evento':
      return joinSegs([
        lead,
        endDot(clean(s.title)),
        ' In: ',
        clean(x.event) ? `${upper(clean(x.event))}. ` : '',
        { t: clean(s.container) || 'Anais', b: true },
        ' [...].',
        ` ${sl(s)}: ${sn(s)}, ${sd(s)}.`,
        clean(s.pages) ? ` p. ${clean(s.pages)}.` : '',
        ...abntAccess(s),
      ]);
    case 'entrevista':
      return joinSegs([
        lead,
        { t: clean(s.title), b: true },
        '.',
        clean(x.interviewer) ? ` Entrevistador: ${endDot(clean(x.interviewer))}` : '',
        clean(s.container) ? ` ${clean(s.container)},` : '',
        ` ${sl(s)}, ${sd(s)}.`,
        ...abntAccess(s),
      ]);
    case 'livro':
    case 'documento':
    case 'outro':
    default:
      return joinSegs([
        lead,
        ...titleSub(s, true),
        '.',
        ed(s),
        ` ${sl(s)}: ${sn(s)}, ${sd(s)}.`,
        s.type === 'livro' && /^\d+$/.test(clean(s.pages)) ? ` ${clean(s.pages)} p.` : '',
        clean(s.isbn) ? ` ISBN ${clean(s.isbn)}.` : '',
        ...abntAccess(s),
      ]);
  }
}

// ------------------------------------------------------------------ APA 7

export function apaReference(s: Source): Seg[] {
  const au = apaAuthors(s.authors);
  const year = clean(s.year) || 's.d.';
  const when = s.type === 'site' && clean(s.month) ? `${year}, ${clean(s.month)}` : year;
  const head = au ? `${endDot(au)} (${when}). ` : '';
  const doi = clean(s.doi) ? ` https://doi.org/${clean(s.doi).replace(/^https?:\/\/(dx\.)?doi\.org\//i, '')}` : clean(s.url) ? ` ${clean(s.url)}` : '';
  const title = clean(s.title) + (clean(s.subtitle) ? `: ${clean(s.subtitle)}` : '');
  const edn = clean(s.edition).replace(/\s*ed\.?$/i, '');
  const x = s.extra || {};
  switch (s.type) {
    case 'artigo':
      return joinSegs([
        head,
        endDot(title),
        ' ',
        { t: clean(s.container) || 'Periódico', i: true },
        clean(s.volume) ? ', ' : '',
        clean(s.volume) ? { t: clean(s.volume), i: true } : '',
        clean(s.issue) ? `(${clean(s.issue)})` : '',
        clean(s.pages) ? `, ${clean(s.pages).replace('-', '–')}` : '',
        '.',
        doi,
      ]);
    case 'capitulo':
      return joinSegs([
        head,
        endDot(title),
        ' In ',
        clean(x.editors) ? `${clean(x.editors)} (Org.), ` : '',
        { t: clean(s.container) || 'Livro', i: true },
        clean(s.pages) ? ` (pp. ${clean(s.pages).replace('-', '–')})` : '',
        '. ',
        clean(s.publisher) ? endDot(clean(s.publisher)) : '',
        doi,
      ]);
    case 'site':
      return joinSegs([head, { t: title, i: true }, '. ', clean(s.container) ? endDot(clean(s.container)) : '', s.accessed_on && !clean(s.doi) ? ` Retrieved ${apaDate(s.accessed_on)}, from` : '', doi]);
    case 'tese':
      return joinSegs([head, { t: title, i: true }, ` [${clean(x.degree) || 'Trabalho acadêmico'}, ${clean(x.institution) || 'Instituição'}].`, doi]);
    case 'video':
      return joinSegs([head, { t: title, i: true }, ' [Vídeo]. ', clean(s.container) ? endDot(clean(s.container)) : '', doi]);
    default: {
      const edPart = edn ? ` (${/^\d+$/.test(edn) ? `${edn}. ed.` : edn})` : '';
      // sem autor, o título ocupa o lugar do autor
      if (!head) return joinSegs([{ t: title, i: true }, edPart, `. (${when}). `, clean(s.publisher) ? endDot(clean(s.publisher)) : '', doi]);
      return joinSegs([head, { t: title, i: true }, edPart, '. ', clean(s.publisher) ? endDot(clean(s.publisher)) : '', doi]);
    }
  }
}

/** Referência editorial simples: Autor — Título, Veículo (ano). */
export function editorialReference(s: Source): Seg[] {
  const names = s.authors
    .filter((a) => clean(a.family))
    .map((a) => (a.kind === 'entidade' || !clean(a.given) ? clean(a.family) : `${clean(a.given)} ${clean(a.family)}`))
    .join(', ');
  return joinSegs([names ? `${names}. ` : '', { t: clean(s.title), i: true }, clean(s.container) ? `, ${clean(s.container)}` : '', clean(s.year) ? ` (${clean(s.year)})` : '', '.', clean(s.url) ? ` ${clean(s.url)}` : '']);
}

export function formatReference(s: Source, norm: CitationNorm): Seg[] {
  return norm === 'apa' ? apaReference(s) : norm === 'editorial' ? editorialReference(s) : abntReference(s);
}

/** Chave de ordenação (alfabética pela entrada da referência). */
export const referenceSortKey = (s: Source, norm: CitationNorm) =>
  segsText(formatReference(s, norm))
    .toLocaleLowerCase('pt-BR')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '');

export function sortReferences(list: Source[], norm: CitationNorm) {
  return [...list].sort((a, b) => referenceSortKey(a, norm).localeCompare(referenceSortKey(b, norm), 'pt-BR'));
}

// ------------------------------------------------------------------ citação no texto

export interface CiteOpts {
  page?: string;
  /** "Silva (2025) afirma…" em vez de "(SILVA, 2025)" */
  narrative?: boolean;
  /** ABNT: sobrenome em maiúsculas dentro dos parênteses (tradicional) */
  upperCase?: boolean;
}

function citeName(s: Source, norm: CitationNorm, inParens: boolean, upperCase: boolean) {
  const a = s.authors.filter((x) => clean(x.family));
  const one = (x: SourceAuthor) => (norm === 'abnt' && inParens && upperCase ? upper(clean(x.family)) : clean(x.family));
  if (!a.length) {
    // sem autor: primeira palavra do título (ABNT) ou título curto (APA)
    const first = clean(s.title).split(/\s+/).slice(0, norm === 'abnt' ? 1 : 3).join(' ');
    return norm === 'abnt' && inParens && upperCase ? `${upper(first)} [...]` : first;
  }
  if (a.length >= 3) return `${one(a[0])} et al.`;
  if (a.length === 2) return norm === 'apa' ? `${one(a[0])} ${inParens ? '&' : 'e'} ${one(a[1])}` : `${one(a[0])}${inParens ? ';' : ' e'} ${one(a[1])}`;
  return one(a[0]);
}

/** Chamada no texto: (SILVA, 2025, p. 42) ou Silva (2025, p. 42). */
export function formatCitation(s: Source, norm: CitationNorm, o: CiteOpts = {}) {
  const year = clean(s.year) || (norm === 'apa' ? 's.d.' : '[s. d.]');
  const page = clean(o.page) ? `, p. ${clean(o.page).replace(/^p\.?\s*/i, '')}` : '';
  const upperCase = o.upperCase ?? true;
  if (norm === 'editorial') return `${citeName(s, 'apa', false, false)} (${year})`;
  if (o.narrative) return `${citeName(s, norm, false, upperCase)} (${year}${page})`;
  return `(${citeName(s, norm, true, upperCase)}, ${year}${page})`;
}

/** Rótulo curto para listas: SILVA, 2025. */
export const shortLabel = (s: Source) => formatCitation(s, 'abnt').replace(/^\(|\)$/g, '');

// ------------------------------------------------------------------ índice no texto

const UUID = '[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}';
const CITE_RE = new RegExp(`(?:\\]\\(cite:|data-cite=\\\\?"|data-apud=\\\\?"|apud:)((?:${UUID},?)+)`, 'gi');
const ONE_ID = new RegExp(UUID, 'gi');

/** Ids das fontes citadas num texto (markdown ou HTML), inclusive as de apud. */
export function extractSourceRefs(...texts: (string | null | undefined)[]): string[] {
  const out = new Set<string>();
  for (const t of texts) {
    if (!t) continue;
    CITE_RE.lastIndex = 0;
    let m: RegExpExecArray | null;
    while ((m = CITE_RE.exec(t))) (m[1].match(ONE_ID) || []).forEach((id) => out.add(id.toLowerCase()));
  }
  return Array.from(out).slice(0, 500);
}

export type CiteMode = 'paren' | 'narrative' | 'year';

/**
 * Chamada de uma citação com uma ou mais fontes:
 *   (SILVA, 2020; SOUZA, 2021)        várias fontes
 *   Silva (2020, p. 12)               narrativa (só uma fonte)
 *   (2020, p. 12)                     só o ano (autor já escrito no texto)
 *   (FREIRE, 2011 apud KLEIMAN, 2005) citação de citação
 */
export function formatCitationGroup(list: Source[], norm: CitationNorm, o: { page?: string; mode?: CiteMode; upperCase?: boolean; apud?: Source | null } = {}): string {
  if (!list.length) return '(fonte removida)';
  const year = (s: Source) => clean(s.year) || (norm === 'apa' ? 's.d.' : '[s. d.]');
  const page = clean(o.page) ? `, p. ${clean(o.page).replace(/^p\.?\s*/i, '')}` : '';
  const upperCase = o.upperCase ?? true;
  const n = norm === 'editorial' ? 'apa' : norm;
  if (o.mode === 'year' && list.length === 1) return `(${year(list[0])}${page})`;
  if (o.mode === 'narrative' && list.length === 1) {
    const base = `${citeName(list[0], n, false, upperCase)} (${year(list[0])}`;
    if (o.apud) return `${base} apud ${citeName(o.apud, n, false, upperCase)}, ${year(o.apud)}${page})`;
    return `${base}${page})`;
  }
  const parts = list.map((s) => `${citeName(s, n, true, upperCase)}, ${year(s)}`);
  if (o.apud && list.length === 1) return `(${parts[0]} apud ${citeName(o.apud, n, true, upperCase)}, ${year(o.apud)}${page})`;
  return `(${parts.join('; ')}${list.length === 1 ? page : ''})`;
}

// ------------------------------------------------------------------ legibilidade

/** Sílabas aproximadas em português (grupos de vogais). */
function syllables(word: string) {
  const w = word.toLowerCase().replace(/[^a-záàâãéêíóôõúüç]/g, '');
  if (!w) return 0;
  const groups = w.match(/[aeiouáàâãéêíóôõúü]+/g) || [];
  // ditongos decrescentes contam uma vez; hiatos comuns (ia, io, ua…) contam duas
  let n = 0;
  for (const g of groups) n += g.length > 2 ? 2 : g.length === 2 && /^(i[aeoáéó]|u[aeo]|[aeo][aeo])$/.test(g) ? 2 : 1;
  return Math.max(1, n);
}

/**
 * Índice de Flesch adaptado ao português (Martins et al., 1996):
 * 248,835 − 1,015 × (palavras/frases) − 84,6 × (sílabas/palavras).
 */
export function readability(text: string): { score: number; label: string } | null {
  const words = text.match(/[\p{L}\p{N}]+(?:[-'][\p{L}]+)*/gu) || [];
  if (words.length < 30) return null;
  const sentences = Math.max(1, (text.match(/[.!?…]+(\s|$)/g) || []).length);
  const syl = words.reduce((n, w) => n + syllables(w), 0);
  const score = Math.round(Math.max(0, Math.min(100, 248.835 - 1.015 * (words.length / sentences) - 84.6 * (syl / words.length))));
  const label = score >= 75 ? 'muito fácil' : score >= 50 ? 'fácil' : score >= 25 ? 'difícil' : 'muito difícil';
  return { score, label };
}
