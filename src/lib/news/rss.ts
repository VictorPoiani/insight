/**
 * Leitor de RSS 2.0 / Atom sem dependências (só no servidor).
 * Extrai título, link, resumo (texto puro), imagem e data.
 */

export interface ParsedItem {
  title: string;
  url: string;
  summary: string;
  image: string | null;
  publishedAt: Date | null;
  /** fonte original (Google News: "Título - Portal") */
  publisher?: string | null;
}

const ENTITIES: Record<string, string> = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ', hellip: '…', mdash: '—', ndash: '–', laquo: '«', raquo: '»', rsquo: '’', lsquo: '‘', rdquo: '”', ldquo: '“' };

// letras acentuadas (&eacute;, &Atilde;, &ccedil;...): vários feeds brasileiros mandam assim
for (const [mark, combining] of [['acute', '\u0301'], ['grave', '\u0300'], ['circ', '\u0302'], ['tilde', '\u0303'], ['uml', '\u0308']] as const) {
  for (const base of 'aeiouyAEIOUYnN') {
    const ch = (base + combining).normalize('NFC');
    if (ch.length === 1) ENTITIES[base + mark] = ch;
  }
}
Object.assign(ENTITIES, { ccedil: 'ç', Ccedil: 'Ç', ordm: 'º', ordf: 'ª', deg: '°', euro: '€', copy: '©', reg: '®', trade: '™', bull: '•', middot: '·' });

export function decodeEntities(s: string): string {
  return s.replace(/&(#x[0-9a-f]+|#\d+|[a-z]+);/gi, (m, e: string) => {
    if (e[0] === '#') {
      const code = e[1] === 'x' || e[1] === 'X' ? parseInt(e.slice(2), 16) : parseInt(e.slice(1), 10);
      return Number.isFinite(code) && code > 0 && code < 0x110000 ? String.fromCodePoint(code) : '';
    }
    return ENTITIES[e] ?? ENTITIES[e.toLowerCase()] ?? m;
  });
}

const unCdata = (s: string) => s.replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, '$1');

export function stripHtml(html: string): string {
  // decodifica antes: muitos feeds mandam o HTML escapado (&lt;p&gt;)
  return decodeEntities(
    decodeEntities(unCdata(html))
      .replace(/<(script|style)[\s\S]*?<\/\1>/gi, ' ')
      .replace(/<br\s*\/?>|<\/p>/gi, ' ')
      .replace(/<[^>]+>/g, ' ')
  )
    .replace(/\s+/g, ' ')
    .trim();
}

function tag(block: string, name: string): string | null {
  const re = new RegExp(`<${name}(?:\\s[^>]*)?>([\\s\\S]*?)<\\/${name}>`, 'i');
  const m = block.match(re);
  return m ? unCdata(m[1]).trim() : null;
}

function attr(block: string, name: string, attribute: string): string | null {
  const re = new RegExp(`<${name}\\b[^>]*\\b${attribute}=["']([^"']+)["'][^>]*>`, 'i');
  const m = block.match(re);
  return m ? decodeEntities(m[1]) : null;
}

const SAFE = /^https?:\/\//i;

function pickImage(block: string, html: string): string | null {
  const candidates = [
    attr(block, 'media:content', 'url'),
    attr(block, 'media:thumbnail', 'url'),
    /<enclosure[^>]*type=["']image/i.test(block) ? attr(block, 'enclosure', 'url') : null,
    html.match(/<img[^>]+src=["']([^"']+)["']/i)?.[1] ?? null,
  ];
  for (const c of candidates) if (c && SAFE.test(c)) return decodeEntities(c);
  return null;
}

export function parseFeed(xml: string, max = 25): ParsedItem[] {
  const out: ParsedItem[] = [];
  const isAtom = /<feed\b[^>]*xmlns=["']http:\/\/www\.w3\.org\/2005\/Atom/i.test(xml) && !/<rss\b/i.test(xml);
  const blocks = xml.match(isAtom ? /<entry\b[\s\S]*?<\/entry>/gi : /<item\b[\s\S]*?<\/item>/gi) || [];

  for (const block of blocks.slice(0, max * 2)) {
    const rawTitle = tag(block, 'title') || '';
    let title = stripHtml(rawTitle);
    let url = isAtom
      ? attr(block, 'link', 'href') || ''
      : stripHtml(tag(block, 'link') || '') || attr(block, 'link', 'href') || tag(block, 'guid') || '';
    url = url.trim();
    if (!title || !SAFE.test(url)) continue;

    const html = tag(block, 'content:encoded') || tag(block, 'description') || tag(block, 'summary') || tag(block, 'content') || '';
    let summary = stripHtml(html);
    const dateStr = tag(block, 'pubDate') || tag(block, 'published') || tag(block, 'updated') || tag(block, 'dc:date');
    const date = dateStr ? new Date(dateStr) : null;

    // Google News: "Título - Portal" e <source>Portal</source>
    let publisher = stripHtml(tag(block, 'source') || '') || null;
    if (publisher && title.endsWith(` - ${publisher}`)) title = title.slice(0, -(publisher.length + 3)).trim();
    if (summary.startsWith(title)) summary = summary.slice(title.length).replace(/^[\s\-–—:]+/, '');
    if (publisher && summary.endsWith(publisher)) summary = summary.slice(0, -publisher.length).trim();
    if (summary && title.toLowerCase().startsWith(summary.toLowerCase())) summary = '';
    // chamadas de "leia mais" que os portais colam no fim
    summary = summary.replace(/\s*(\[\s*(…|\.\.\.)\s*\]|leia mais\W*|continue lendo\W*|leia a matéria completa\W*|the post .+ appeared first on .+)$/i, '').trim();

    out.push({
      title: title.slice(0, 300),
      url: url.slice(0, 2000),
      summary: summary.slice(0, 400),
      image: pickImage(block, decodeEntities(html)),
      publishedAt: date && !Number.isNaN(date.getTime()) ? date : null,
      publisher,
    });
    if (out.length >= max) break;
  }
  return out;
}
