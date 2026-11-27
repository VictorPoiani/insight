/**
 * Publicação seletiva do Notebook: monta, NO SERVIDOR, o HTML que sai para o
 * público — o mesmo usado na Prova Final (um renderizador só).
 *
 * O que nunca sai:
 *   - destaques "Segredo do autor" (> [!segredo] …)
 *   - verbetes secretos ou não marcados como públicos (a menção vira texto)
 *   - campos secretos do Infobox do Codex
 *   - marcas de pendência (o texto fica, a marca some)
 * Depois de montar, uma checagem final recusa qualquer resto de segredo; o
 * banco repete a checagem ao gravar a publicação.
 */
import DOMPurify from 'isomorphic-dompurify';
import { renderMarkdown } from './markdown';
import { buildArticle, referenceHtml } from './articleRender';
import { articleData } from './article';
import { codexData, isEmptyValue, valueText, type CodexCategory } from './codex';
import type { Source } from './sources';
import type { NotebookEntry } from './entries';

export interface PublicEntry {
  id: string;
  title: string;
  summary: string;
  kind: string;
  category: string | null;
  image_url: string | null;
  aliases: string[];
}

export interface PublicationInput {
  item: { id: string; title: string; template: string; content: string; data: Record<string, unknown> | null; source_refs?: string[] };
  entries: Record<string, Pick<NotebookEntry, 'id' | 'title' | 'summary' | 'kind' | 'category' | 'image_url' | 'aliases' | 'is_secret' | 'codex_category_id'> & { is_public?: boolean }>;
  sources?: Record<string, Source>;
  categories?: Record<string, CodexCategory>;
}

export interface PublicationOutput {
  title: string;
  html: string;
  entries: Record<string, PublicEntry>;
}

const UUID = '[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}';
const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const isSecretCallout = (line: string) => /^\s*>\s*\[!\s*segredo\s*\]/i.test(line);

/** Tira os destaques "Segredo do autor" (o bloco inteiro de linhas com >). */
export function stripSecretCallouts(md: string): string {
  const lines = md.split('\n');
  const out: string[] = [];
  for (let i = 0; i < lines.length; i++) {
    if (isSecretCallout(lines[i])) {
      while (i + 1 < lines.length && /^\s*>/.test(lines[i + 1])) i++;
      continue;
    }
    out.push(lines[i]);
  }
  return out.join('\n');
}

const canShow = (e: PublicationInput['entries'][string] | undefined) => !!e && !e.is_secret && e.is_public !== false;

/** Markdown pronto para publicar (sem segredos, sem pendências, menções só públicas). */
export function publicMarkdown(md: string, entries: PublicationInput['entries']): string {
  let s = (md || '').replace(/^---\n[\s\S]*?\n---\n?/, '');
  s = stripSecretCallouts(s);
  s = s.replace(/\[([^\]\n]+)\]\(todo:(revisar|checar|lore|geral)\)/gi, '$1');
  s = s.replace(new RegExp(`\\[([^\\]\\n]+)\\]\\(ref:(${UUID})(?:\\s+"[^"\\n]*")?\\)`, 'gi'), (all, text, id) => (canShow(entries[id.toLowerCase()]) ? all : text));
  return s;
}

/** Mesmas regras no HTML do capítulo. */
function publicChapterHtml(html: string, entries: PublicationInput['entries']): string {
  let s = html || '';
  s = s.replace(/<span[^>]*data-todo="[a-z]+"[^>]*>([\s\S]*?)<\/span>/gi, '$1');
  s = s.replace(new RegExp(`<span([^>]*)data-ref="(${UUID})"([^>]*)>([\\s\\S]*?)<\\/span>`, 'gi'), (all, _a, id, _b, inner) => (canShow(entries[id.toLowerCase()]) ? all : inner));
  return s;
}

const ALLOWED_TAGS = ['p', 'br', 'hr', 'h1', 'h2', 'h3', 'h4', 'strong', 'b', 'em', 'i', 'u', 's', 'del', 'mark', 'sub', 'sup', 'small', 'code', 'pre', 'blockquote', 'ul', 'ol', 'li', 'a', 'span', 'div', 'img', 'figure', 'figcaption', 'table', 'thead', 'tbody', 'tr', 'th', 'td', 'section', 'header'];
const ALLOWED_ATTR = ['href', 'src', 'alt', 'title', 'class', 'data-ref', 'data-kind', 'data-layout', 'data-width', 'colspan', 'rowspan', 'start', 'id', 'loading'];

function sanitize(html: string): string {
  const clean = DOMPurify.sanitize(html.replace(/<svg[\s\S]*?<\/svg>/gi, ''), { ALLOWED_TAGS, ALLOWED_ATTR, ALLOW_DATA_ATTR: false });
  // ligações internas ([[nota]]) viram texto: as notas não são públicas
  return clean.replace(/<a[^>]*class="nb-wikilink[^"]*"[^>]*>([\s\S]*?)<\/a>/gi, '$1');
}

export function buildPublication(input: PublicationInput): PublicationOutput {
  const { item, entries } = input;
  const data = (item.data || {}) as Record<string, unknown>;
  let html = '';

  if (item.template === 'chapter') {
    html = publicChapterHtml(String(data.html || ''), entries);
  } else if (item.template === 'article') {
    const a = articleData(data);
    const out = buildArticle(item.title, publicMarkdown(item.content, entries), input.sources || {}, a, item.source_refs || []);
    html = [
      out.pre.replace(/<h1 class="ar-title">[\s\S]*?<\/h1>/, ''),
      out.body,
      out.notes.length ? `<section class="pub-notes"><h2>Notas</h2><ol>${out.notes.map((n) => `<li>${n}</li>`).join('')}</ol></section>` : '',
      out.references.length ? `<section class="pub-refs"><h2>${esc(out.refTitle)}</h2>${out.references.map((s) => `<p class="pub-ref">${referenceHtml(s, a.norm)}</p>`).join('')}</section>` : '',
    ].join('');
  } else {
    let lead = '';
    const cx = item.template === 'codex' ? codexData(data) : null;
    if (cx) {
      const entry = entries[cx.entry];
      if (entry?.is_secret) throw new PublicationError('Este verbete está marcado como segredo do autor e não pode ser publicado.');
      const cat = entry?.codex_category_id ? input.categories?.[entry.codex_category_id] : null;
      const parent = cat?.parent_id ? input.categories?.[cat.parent_id] : null;
      const fields = cat?.fields?.length ? cat.fields : parent?.fields || [];
      const titleOf = (id: string) => (canShow(entries[id]) ? entries[id].title : null);
      const rows = fields
        .filter((f) => !isEmptyValue(cx.infobox[f.key]) && !cx.infobox[f.key]?.secret)
        .map((f) => [f.label, valueText(cx.infobox[f.key], titleOf)])
        .filter(([, v]) => v);
      if (entry?.summary) lead += `<p class="pub-lead">${esc(entry.summary)}</p>`;
      if (rows.length) lead += `<table class="pub-infobox"><tbody>${rows.map(([k, v]) => `<tr><th>${esc(k)}</th><td>${esc(v)}</td></tr>`).join('')}</tbody></table>`;
    }
    html = lead + renderMarkdown(publicMarkdown(item.content, entries));
  }

  html = sanitize(html);
  // checagem final: nenhum resto de segredo
  if (/nb-callout--secret|\[!\s*segredo\s*\]/i.test(html)) throw new PublicationError('Sobrou um trecho secreto no texto. A publicação foi bloqueada.');

  const pub: Record<string, PublicEntry> = {};
  for (const m of html.matchAll(new RegExp(`data-ref="(${UUID})"`, 'gi'))) {
    const e = entries[m[1].toLowerCase()];
    if (!canShow(e)) continue;
    pub[e.id] = { id: e.id, title: e.title, summary: (e.summary || '').slice(0, 1200), kind: e.kind, category: e.category || null, image_url: e.image_url || null, aliases: e.aliases || [] };
  }
  return { title: item.title, html, entries: pub };
}

export class PublicationError extends Error {}
