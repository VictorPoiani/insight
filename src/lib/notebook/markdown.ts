import { glyphSvg } from './glyphs';
/**
 * Markdown do My Notebook (estilo Obsidian), sem dependências.
 *
 * Suporta: títulos, negrito/itálico/tachado/==marca-texto==, `código`, blocos
 * de código, citações e callouts (> [!nota] Título), listas (com tarefas
 * - [ ] / - [x]), tabelas, linhas, links, imagens, [[links internos|apelido]],
 * ![[embed]] e #tags. Todo texto é escapado ANTES de virar HTML — nada do
 * usuário entra cru no DOM.
 */

export interface MdHeading {
  level: number;
  text: string;
  line: number;
  slug: string;
}

const esc = (s: string) =>
  s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');

export function slugify(s: string) {
  return s
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 80);
}

const SAFE_URL = /^(https?:\/\/|mailto:|\/(?!\/)|#)/i;

const CALLOUTS: Record<string, { icon: string; cls: string; label: string }> = {
  note: { icon: glyphSvg('pen'), cls: 'note', label: 'Nota' },
  nota: { icon: glyphSvg('pen'), cls: 'note', label: 'Nota' },
  info: { icon: glyphSvg('info'), cls: 'info', label: 'Info' },
  tip: { icon: glyphSvg('sparkle'), cls: 'tip', label: 'Dica' },
  dica: { icon: glyphSvg('sparkle'), cls: 'tip', label: 'Dica' },
  warning: { icon: glyphSvg('alert'), cls: 'warn', label: 'Atenção' },
  atencao: { icon: glyphSvg('alert'), cls: 'warn', label: 'Atenção' },
  danger: { icon: glyphSvg('cross'), cls: 'danger', label: 'Perigo' },
  perigo: { icon: glyphSvg('cross'), cls: 'danger', label: 'Perigo' },
  quote: { icon: glyphSvg('quote'), cls: 'quote', label: 'Citação' },
  citacao: { icon: glyphSvg('quote'), cls: 'quote', label: 'Citação' },
  todo: { icon: glyphSvg('todo'), cls: 'todo', label: 'A fazer' },
  ideia: { icon: glyphSvg('idea'), cls: 'tip', label: 'Ideia' },
  idea: { icon: glyphSvg('idea'), cls: 'tip', label: 'Ideia' },
  segredo: { icon: glyphSvg('lock'), cls: 'secret', label: 'Segredo do autor' },
};

/** Inline: recebe texto CRU, devolve HTML seguro. */
function inline(raw: string, ctx: RenderCtx): string {
  const tokens: string[] = [];
  const keep = (html: string) => {
    tokens.push(html);
    return `\u0000${tokens.length - 1}\u0000`;
  };

  let s = raw;
  // código inline primeiro (nada é interpretado dentro)
  s = s.replace(/`([^`\n]+)`/g, (_, c) => keep(`<code class="nb-code">${esc(c)}</code>`));
  // embeds e links internos
  s = s.replace(/!\[\[([^\]\n|]+)(?:\|([^\]\n]+))?\]\]/g, (_, target, alias) =>
    keep(
      `<a class="nb-wikilink nb-embed" data-wikilink="${esc(target.trim())}">↳ ${esc((alias || target).trim())}</a>`
    )
  );
  s = s.replace(/\[\[([^\]\n|]+)(?:\|([^\]\n]+))?\]\]/g, (_, target, alias) => {
    const t = target.trim();
    const exists = ctx.titleExists ? ctx.titleExists(t) : true;
    return keep(
      `<a class="nb-wikilink${exists ? '' : ' nb-wikilink--new'}" data-wikilink="${esc(t)}">${esc((alias || t).trim())}</a>`
    );
  });
  // imagens (título "Legenda|layout|largura" vira figura com legenda) e links markdown
  s = s.replace(/!\[([^\]\n]*)\]\(([^)\s]+)(?:\s+"([^"]*)")?\)/g, (_, alt, url, title) => {
    if (!SAFE_URL.test(url)) return esc(alt);
    const [cap = '', layout = 'center', width = '100'] = String(title || '').split('|');
    const lay = /^(center|full|wide|left|right)$/.test(layout) ? layout : 'center';
    const w = /^(30|40|50|60|70|80|90|100)$/.test(width) ? width : '100';
    return keep(
      `<figure class="nb-fig" data-figure data-layout="${lay}" data-width="${w}"><img class="nb-img" src="${esc(url)}" alt="${esc(alt)}" loading="lazy" />${
        cap.trim() ? `<figcaption>${esc(cap.trim())}</figcaption>` : ''
      }</figure>`
    );
  });
  // menção: [trecho](ref:<uuid> "tipo")
  s = s.replace(/\[([^\]\n]+)\]\(ref:([0-9a-f-]{36})(?:\s+"(elemento|nota_autor|aviso)")?\)/gi, (_, text, id, kind) =>
    keep(`<span class="nb-ref nb-ref--${kind || 'elemento'}" data-ref="${esc(id.toLowerCase())}" data-kind="${kind || 'elemento'}">${esc(text)}</span>`)
  );
  s = s.replace(/\[([^\]\n]+)\]\(([^)\s]+)\)/g, (_, text, url) =>
    SAFE_URL.test(url)
      ? keep(`<a class="nb-link" href="${esc(url)}" target="_blank" rel="noopener noreferrer nofollow">${esc(text)}</a>`)
      : esc(text)
  );
  // URLs soltas
  s = s.replace(/(^|[\s(])(https?:\/\/[^\s<)]+)/g, (_, pre, url) =>
    pre + keep(`<a class="nb-link" href="${esc(url)}" target="_blank" rel="noopener noreferrer nofollow">${esc(url)}</a>`)
  );
  // tags
  s = s.replace(/(^|\s)#([\p{L}\p{N}_/-]{1,60})/gu, (_, pre, tag) =>
    /^\d+$/.test(tag) ? `${pre}#${tag}` : pre + keep(`<span class="nb-tag" data-tag="${esc(tag.toLowerCase())}">#${esc(tag)}</span>`)
  );

  s = esc(s);
  s = s
    .replace(/\*\*\*([^*\n]+)\*\*\*/g, '<strong><em>$1</em></strong>')
    .replace(/\*\*([^*\n]+)\*\*/g, '<strong>$1</strong>')
    .replace(/__([^_\n]+)__/g, '<strong>$1</strong>')
    .replace(/(^|[^*])\*([^*\n]+)\*/g, '$1<em>$2</em>')
    .replace(/(^|[\s(])_([^_\n]+)_(?=[\s).,!?:;]|$)/g, '$1<em>$2</em>')
    .replace(/~~([^~\n]+)~~/g, '<del>$1</del>')
    .replace(/==([^=\n]+)==/g, '<mark class="nb-mark">$1</mark>');

  return s.replace(/\u0000(\d+)\u0000/g, (_, i) => tokens[Number(i)]);
}

interface RenderCtx {
  titleExists?: (title: string) => boolean;
}

/** Markdown → HTML seguro. `taskLines` permite marcar tarefas no preview. */
export function renderMarkdown(md: string, ctx: RenderCtx = {}): string {
  const lines = md.replace(/\r\n?/g, '\n').split('\n');
  const out: string[] = [];
  let i = 0;
  const usedSlugs = new Map<string, number>();
  const headingId = (text: string) => {
    const base = slugify(text) || 'secao';
    const n = usedSlugs.get(base) || 0;
    usedSlugs.set(base, n + 1);
    return n ? `${base}-${n}` : base;
  };

  // frontmatter (--- ... ---) vira um quadro de propriedades
  if (lines[0]?.trim() === '---') {
    const end = lines.findIndex((l, k) => k > 0 && l.trim() === '---');
    if (end > 0) {
      const rows = lines
        .slice(1, end)
        .map((l) => l.match(/^([\w\p{L} -]{1,40}):\s*(.*)$/u))
        .filter(Boolean) as RegExpMatchArray[];
      if (rows.length) {
        out.push(
          `<div class="nb-props">${rows
            .map((m) => `<div class="nb-prop"><span>${esc(m[1].trim())}</span><span>${inline(m[2], ctx)}</span></div>`)
            .join('')}</div>`
        );
      }
      i = end + 1;
    }
  }

  while (i < lines.length) {
    const line = lines[i];

    // bloco de código
    const fence = line.match(/^```\s*([\w+-]*)\s*$/);
    if (fence) {
      const buf: string[] = [];
      i++;
      while (i < lines.length && !/^```\s*$/.test(lines[i])) buf.push(lines[i++]);
      i++;
      out.push(
        `<pre class="nb-pre"${fence[1] ? ` data-lang="${esc(fence[1])}"` : ''}><code>${esc(buf.join('\n'))}</code></pre>`
      );
      continue;
    }

    if (!line.trim()) {
      i++;
      continue;
    }

    // título
    const h = line.match(/^(#{1,6})\s+(.+?)\s*#*\s*$/);
    if (h) {
      const lvl = h[1].length;
      out.push(`<h${lvl} id="${headingId(h[2])}" data-line="${i}">${inline(h[2], ctx)}</h${lvl}>`);
      i++;
      continue;
    }

    // linha horizontal / quebra de cena
    if (/^\s*([-*_])(\s*\1){2,}\s*$/.test(line)) {
      out.push('<hr class="nb-hr" />');
      i++;
      continue;
    }

    // citação / callout
    if (/^\s*>/.test(line)) {
      const buf: string[] = [];
      while (i < lines.length && /^\s*>/.test(lines[i])) buf.push(lines[i++].replace(/^\s*>\s?/, ''));
      const c = buf[0]?.match(/^\[!([\w\p{L}]+)\]([+-]?)\s*(.*)$/u);
      if (c) {
        const key = c[1].toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
        const meta = CALLOUTS[key] || CALLOUTS.note;
        const title = c[3] || meta.label;
        out.push(
          `<div class="nb-callout nb-callout--${meta.cls}"><div class="nb-callout__title"><span aria-hidden="true">${meta.icon}</span>${inline(title, ctx)}</div>${
            buf.length > 1 ? `<div class="nb-callout__body">${renderMarkdown(buf.slice(1).join('\n'), ctx)}</div>` : ''
          }</div>`
        );
      } else {
        out.push(`<blockquote class="nb-quote">${renderMarkdown(buf.join('\n'), ctx)}</blockquote>`);
      }
      continue;
    }

    // tabela
    if (/^\s*\|.*\|\s*$/.test(line) && /^\s*\|?\s*:?-{2,}/.test(lines[i + 1] || '')) {
      const cells = (l: string) => l.trim().replace(/^\||\|$/g, '').split('|').map((c) => c.trim());
      const head = cells(line);
      i += 2;
      const rows: string[][] = [];
      while (i < lines.length && /^\s*\|.*\|\s*$/.test(lines[i])) rows.push(cells(lines[i++]));
      out.push(
        `<div class="nb-table-wrap"><table class="nb-table"><thead><tr>${head
          .map((c) => `<th>${inline(c, ctx)}</th>`)
          .join('')}</tr></thead><tbody>${rows
          .map((r) => `<tr>${head.map((_, k) => `<td>${inline(r[k] || '', ctx)}</td>`).join('')}</tr>`)
          .join('')}</tbody></table></div>`
      );
      continue;
    }

    // listas
    if (/^\s*([-*+]|\d+[.)])\s+/.test(line)) {
      const ordered = /^\s*\d+[.)]/.test(line);
      const items: string[] = [];
      while (i < lines.length && /^\s*([-*+]|\d+[.)])\s+/.test(lines[i])) {
        const raw = lines[i].replace(/^\s*([-*+]|\d+[.)])\s+/, '');
        const indent = (lines[i].match(/^\s*/)?.[0].length || 0) >= 2;
        const task = raw.match(/^\[( |x|X)\]\s*(.*)$/);
        if (task) {
          const done = task[1].toLowerCase() === 'x';
          items.push(
            `<li class="nb-task${done ? ' nb-task--done' : ''}${indent ? ' nb-li--sub' : ''}"><input type="checkbox" data-task-line="${i}" ${
              done ? 'checked' : ''
            } aria-label="Marcar tarefa" /><span>${inline(task[2], ctx)}</span></li>`
          );
        } else {
          items.push(`<li${indent ? ' class="nb-li--sub"' : ''}>${inline(raw, ctx)}</li>`);
        }
        i++;
      }
      out.push(ordered ? `<ol class="nb-ol">${items.join('')}</ol>` : `<ul class="nb-ul">${items.join('')}</ul>`);
      continue;
    }

    // parágrafo (linhas seguidas)
    const buf: string[] = [];
    while (
      i < lines.length &&
      lines[i].trim() &&
      !/^(```|#{1,6}\s|\s*>|\s*([-*+]|\d+[.)])\s+)/.test(lines[i]) &&
      !/^\s*([-*_])(\s*\1){2,}\s*$/.test(lines[i])
    ) {
      buf.push(lines[i++]);
    }
    if (!buf.length) {
      out.push(`<p>${inline(lines[i++], ctx)}</p>`);
      continue;
    }
    out.push(`<p>${buf.map((l) => inline(l, ctx)).join('<br />')}</p>`);
  }

  return out.join('\n');
}

/** Alvos de [[links]] (títulos), sem duplicar. */
export function extractLinks(md: string): string[] {
  const set = new Set<string>();
  const re = /!?\[\[([^\]\n|#]+)(?:#[^\]\n|]*)?(?:\|[^\]\n]+)?\]\]/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(md))) set.add(m[1].trim().slice(0, 200));
  return Array.from(set).slice(0, 500);
}

/** #tags (sem as que estão em blocos de código). */
export function extractTags(md: string): string[] {
  const clean = md.replace(/```[\s\S]*?```/g, '').replace(/`[^`\n]*`/g, '');
  const set = new Set<string>();
  const re = /(^|\s)#([\p{L}\p{N}_/-]{1,60})/gu;
  let m: RegExpExecArray | null;
  while ((m = re.exec(clean))) if (!/^\d+$/.test(m[2])) set.add(m[2].toLowerCase());
  // tags do frontmatter: "tags: a, b"
  const fm = md.match(/^---\n[\s\S]*?\ntags:\s*(.+)\n[\s\S]*?---/);
  fm?.[1].split(/[,\s]+/).forEach((t) => t && set.add(t.replace(/^#/, '').toLowerCase()));
  return Array.from(set).slice(0, 100);
}

export function extractHeadings(md: string): MdHeading[] {
  const out: MdHeading[] = [];
  let inCode = false;
  const used = new Map<string, number>();
  md.split('\n').forEach((l, line) => {
    if (/^```/.test(l)) inCode = !inCode;
    if (inCode) return;
    const h = l.match(/^(#{1,6})\s+(.+?)\s*#*\s*$/);
    if (h) {
      const base = slugify(h[2]) || 'secao';
      const n = used.get(base) || 0;
      used.set(base, n + 1);
      out.push({ level: h[1].length, text: h[2].replace(/[*_=`~[\]]/g, ''), line, slug: n ? `${base}-${n}` : base });
    }
  });
  return out;
}

export function countWords(text: string): number {
  const t = text
    .replace(/<[^>]*>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/[#>*_`~=[\]|-]/g, ' ')
    .trim();
  if (!t) return 0;
  return t.split(/\s+/).filter((w) => /[\p{L}\p{N}]/u.test(w)).length;
}

/** Marca/desmarca a tarefa da linha `line` no markdown. */
export function toggleTaskLine(md: string, line: number): string {
  const lines = md.split('\n');
  const l = lines[line];
  if (l == null) return md;
  lines[line] = l.replace(/\[( |x|X)\]/, (_, c) => (c === ' ' ? '[x]' : '[ ]'));
  return lines.join('\n');
}

/** HTML (modo escritor) → texto puro, para contagem e busca. */
export function htmlToText(html: string): string {
  return html
    .replace(/<\s*(br|\/p|\/h[1-6]|\/div|\/li|hr)[^>]*>/gi, '\n')
    .replace(/<[^>]*>/g, '')
    .replace(/&nbsp;/g, ' ')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&amp;/g, '&')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}
