'use client';

/**
 * Importar e exportar do Notebook (Fase 7).
 *  Exporta: Markdown, Word (.docx), HTML, CSV, Excel (.xlsx), agenda (.ics),
 *           JSON e o Notebook inteiro (.zip com Markdown + backup JSON).
 *  Importa: .md/.txt, .html, .docx, .csv, .xlsx, .ics e o backup .json.
 * As bibliotecas pesadas são carregadas só quando usadas.
 */
import type { AgendaEventItem, TaskItem, TopicWorkspaceData } from '@/types/database';
import type { NotebookItem, NotebookTemplate } from './types';
import type { NotebookApi } from './useNotebook';
import type { EntriesApi } from './useEntries';
import type { NotebookEntry } from './entries';
import { renderMarkdown } from './markdown';
import { getTemplate } from './templates';

// ============================================================ utilidades
export function download(name: string, data: BlobPart, type: string) {
  const blob = new Blob([data], { type });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = name;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 2000);
}

export function safeName(s: string) {
  return (
    s
      .normalize('NFC')
      .replace(/[\\/:*?"<>|\u0000-\u001f]+/g, ' ')
      .replace(/\s+/g, ' ')
      .trim()
      .slice(0, 90) || 'sem-titulo'
  );
}

const stripFrontmatter = (md: string) => md.replace(/^---\n[\s\S]*?\n---\n?/, '');

async function turndown() {
  const { default: TurndownService } = await import('turndown');
  const td = new TurndownService({ headingStyle: 'atx', bulletListMarker: '-', codeBlockStyle: 'fenced', emDelimiter: '*', hr: '***' });
  td.addRule('entryRef', {
    filter: (n) => n.nodeName === 'SPAN' && !!(n as HTMLElement).dataset?.ref,
    replacement: (content, n) => {
      const el = n as HTMLElement;
      const kind = el.dataset.kind && el.dataset.kind !== 'elemento' ? ` "${el.dataset.kind}"` : '';
      return `[${content}](ref:${el.dataset.ref}${kind})`;
    },
  });
  td.addRule('figure', {
    filter: 'figure',
    replacement: (_c, n) => {
      const el = n as HTMLElement;
      const img = el.querySelector('img');
      if (!img) return '';
      const cap = el.querySelector('figcaption')?.textContent?.trim() || '';
      const lay = el.getAttribute('data-layout') || 'center';
      const w = el.getAttribute('data-width') || '100';
      const extra = lay !== 'center' || w !== '100' ? `|${lay}|${w}` : '';
      const title = cap || extra ? ` "${cap.replace(/"/g, '”')}${extra}"` : '';
      return `\n\n![${img.getAttribute('alt') || ''}](${img.getAttribute('src')}${title})\n\n`;
    },
  });
  td.addRule('pageBreak', {
    filter: (n) => n.nodeName === 'HR' && (n as HTMLElement).dataset?.pageBreak === 'true',
    replacement: () => '\n\n<!-- nova página -->\n\n',
  });
  // imagens embutidas (ex.: vindas do Word) ficariam enormes no markdown
  td.addRule('dataImages', {
    filter: (n) => n.nodeName === 'IMG' && /^data:/i.test((n as HTMLElement).getAttribute('src') || ''),
    replacement: (_c, n) => `*[imagem: ${(n as HTMLElement).getAttribute('alt') || 'sem descrição'}]*`,
  });
  return td;
}

// ============================================================ conteúdo de um item
/** HTML do item (para Word e HTML). */
async function itemHtml(item: NotebookItem, api: NotebookApi): Promise<{ title: string; html: string; serif: boolean }> {
  const full = (await api.loadFull(item.id)) || item;
  if (full.template === 'chapter') return { title: full.title, html: String(full.data?.html || ''), serif: true };
  if (full.template === 'book') {
    const chapters = Object.values(api.items)
      .filter((c) => c.parent_id === full.id && c.template === 'chapter' && !c.archived_at)
      .sort((a, b) => a.position - b.position);
    const parts: string[] = [];
    for (const c of chapters) {
      const fc = (await api.loadFull(c.id)) || c;
      parts.push(`<h1 data-chapter="true">${esc(fc.title)}</h1>${String(fc.data?.html || '')}`);
    }
    return { title: full.title, html: parts.join(''), serif: true };
  }
  return { title: full.title, html: renderMarkdown(stripFrontmatter(full.content || '')), serif: full.template === 'poem' };
}

/** Markdown do item. */
async function itemMarkdown(item: NotebookItem, api: NotebookApi): Promise<string> {
  const full = (await api.loadFull(item.id)) || item;
  if (full.template === 'chapter' || full.template === 'book') {
    const { title, html } = await itemHtml(full, api);
    const td = await turndown();
    return `# ${title}\n\n${td.turndown(html)}\n`;
  }
  if (full.kind === 'note' && full.template !== 'blocks' && !isWorkspace(full.template)) return full.content || '';
  return '```json\n' + JSON.stringify(full.data || {}, null, 2) + '\n```\n';
}

const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
const WORKSPACES = new Set(['goals', 'habits', 'tasks', 'roadmap', 'mindmap', 'diet', 'agenda', 'map', 'calendar', 'timeline']);
export const isWorkspace = (t: string) => WORKSPACES.has(t);

// ============================================================ tabelas (CSV / Excel)
type Table = { name: string; rows: (string | number)[][] };

function itemTables(item: NotebookItem): Table[] {
  const d = (item.data || {}) as TopicWorkspaceData;
  const out: Table[] = [];
  if (d.tasks?.length) {
    out.push({
      name: 'Tarefas',
      rows: [
        ['Título', 'Status', 'Responsável', 'Prazo', 'Prioridade'],
        ...d.tasks.map((t) => [t.title, STATUS_PT[t.status] || t.status, t.assignee || '', t.dueDate || '', PRIO_PT[t.priority || ''] || '']),
      ],
    });
  }
  if (d.agendaEvents?.length) {
    out.push({
      name: 'Agenda',
      rows: [['Data', 'Hora', 'Título', 'Local', 'Categoria'], ...d.agendaEvents.map((e) => [e.date, e.time, e.title, e.location || '', e.category || ''])],
    });
  }
  if (d.roadmapSteps?.length) {
    out.push({
      name: 'Roadmap',
      rows: [['Fase', 'Título', 'Descrição', 'Status', 'Quando'], ...d.roadmapSteps.map((s) => [s.phase, s.title, s.description, s.status, s.dateLabel || ''])],
    });
  }
  const raw = (item.data || {}) as Record<string, unknown>;
  const chronos = raw.chronos as { era?: string; events?: { year: number; title: string; summary?: string; major?: boolean }[]; eras?: { name: string; start: number; end: number }[] } | undefined;
  if (chronos?.events?.length) {
    out.push({
      name: 'Cronos',
      rows: [
        ['Ano', 'Acontecimento', 'Resumo', 'Era', 'Marco'],
        ...[...chronos.events]
          .sort((a, b) => a.year - b.year)
          .map((e) => [e.year, e.title, e.summary || '', chronos.eras?.find((r) => e.year >= r.start && e.year <= r.end)?.name || '', e.major ? 'sim' : '']),
      ],
    });
  }
  const worldcal = raw.worldcal as { era?: string; months?: { name: string }[]; events?: { year: number; month: number; day: number; title: string }[] } | undefined;
  if (worldcal?.events?.length) {
    out.push({
      name: 'Calendário',
      rows: [['Ano', 'Mês', 'Dia', 'Evento'], ...worldcal.events.map((e) => [e.year, worldcal.months?.[e.month]?.name || String(e.month + 1), e.day, e.title])],
    });
  }
  // tabelas dentro do markdown
  if (item.content) {
    const tables = mdTables(item.content);
    tables.forEach((rows, i) => out.push({ name: tables.length > 1 ? `Tabela ${i + 1}` : 'Tabela', rows }));
  }
  return out;
}

const STATUS_PT: Record<string, string> = { not_started: 'A fazer', in_progress: 'Em andamento', done: 'Concluída' };
const PRIO_PT: Record<string, string> = { high: 'Alta', medium: 'Média', low: 'Baixa' };

function mdTables(md: string): string[][][] {
  const out: string[][][] = [];
  const lines = md.split('\n');
  for (let i = 0; i < lines.length; i++) {
    if (/^\s*\|.*\|\s*$/.test(lines[i]) && /^\s*\|[\s:|-]+\|\s*$/.test(lines[i + 1] || '')) {
      const rows: string[][] = [];
      const cells = (l: string) => l.trim().replace(/^\||\|$/g, '').split('|').map((c) => c.trim());
      rows.push(cells(lines[i]));
      i += 2;
      while (i < lines.length && /^\s*\|.*\|\s*$/.test(lines[i])) rows.push(cells(lines[i++]));
      out.push(rows);
    }
  }
  return out;
}

function toCsv(rows: (string | number)[][]) {
  return '\ufeff' + rows.map((r) => r.map((c) => `"${String(c ?? '').replace(/"/g, '""')}"`).join(';')).join('\r\n');
}

// ============================================================ agenda (.ics)
function toIcs(item: NotebookItem): string {
  const d = (item.data || {}) as TopicWorkspaceData;
  const stamp = new Date().toISOString().replace(/[-:]/g, '').replace(/\.\d+Z$/, 'Z');
  const icsEsc = (s: string) => s.replace(/\\/g, '\\\\').replace(/;/g, '\\;').replace(/,/g, '\\,').replace(/\n/g, '\\n');
  const ev = (d.agendaEvents || []).map((e) => {
    const date = (e.date || '').replace(/-/g, '');
    const time = /^\d{2}:\d{2}$/.test(e.time || '') ? e.time.replace(':', '') + '00' : '';
    const start = time ? `DTSTART:${date}T${time}` : `DTSTART;VALUE=DATE:${date}`;
    return ['BEGIN:VEVENT', `UID:${e.id}@insight.app.br`, `DTSTAMP:${stamp}`, start, `SUMMARY:${icsEsc(e.title)}`, e.location ? `LOCATION:${icsEsc(e.location)}` : '', e.category ? `CATEGORIES:${icsEsc(e.category)}` : '', 'END:VEVENT']
      .filter(Boolean)
      .join('\r\n');
  });
  return ['BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//Insight//Notebook//PT', `X-WR-CALNAME:${icsEsc(item.title)}`, ...ev, 'END:VCALENDAR'].join('\r\n');
}

function parseIcs(text: string): AgendaEventItem[] {
  const unfolded = text.replace(/\r?\n[ \t]/g, '');
  const out: AgendaEventItem[] = [];
  for (const block of unfolded.split('BEGIN:VEVENT').slice(1)) {
    const get = (k: string) => new RegExp(`^${k}(?:;[^:\\n]*)?:(.*)$`, 'm').exec(block)?.[1]?.trim() || '';
    const raw = get('DTSTART');
    const m = /^(\d{4})(\d{2})(\d{2})(?:T(\d{2})(\d{2}))?/.exec(raw);
    if (!m) continue;
    const unesc = (s: string) => s.replace(/\\n/g, '\n').replace(/\\([,;\\])/g, '$1');
    out.push({
      id: `ics-${Math.random().toString(36).slice(2, 10)}`,
      date: `${m[1]}-${m[2]}-${m[3]}`,
      time: m[4] ? `${m[4]}:${m[5]}` : '',
      title: unesc(get('SUMMARY')) || 'Evento',
      location: unesc(get('LOCATION')) || undefined,
      category: unesc(get('CATEGORIES')).split(',')[0] || 'Importado',
      color: '#E63946',
    });
  }
  return out.slice(0, 2000);
}

// ============================================================ Word (.docx)
async function htmlToDocx(title: string, html: string, serif: boolean): Promise<Blob> {
  const docx = await import('docx');
  const { Document, Packer, Paragraph, TextRun, HeadingLevel, AlignmentType, PageBreak, ImageRun } = docx;
  const font = serif ? 'Georgia' : 'Calibri';
  const dom = new DOMParser().parseFromString(`<div>${html}</div>`, 'text/html').body.firstElementChild as HTMLElement;
  const children: InstanceType<typeof Paragraph>[] = [];

  const runs = (el: Node, style: { b?: boolean; i?: boolean; u?: boolean; s?: boolean } = {}): InstanceType<typeof TextRun>[] => {
    const out: InstanceType<typeof TextRun>[] = [];
    el.childNodes.forEach((n) => {
      if (n.nodeType === 3) {
        const t = n.textContent || '';
        if (t) out.push(new TextRun({ text: t, bold: style.b, italics: style.i, underline: style.u ? {} : undefined, strike: style.s, font }));
        return;
      }
      if (n.nodeType !== 1) return;
      const tag = (n as HTMLElement).tagName;
      if (tag === 'BR') return void out.push(new TextRun({ break: 1 }));
      out.push(
        ...runs(n, {
          b: style.b || tag === 'STRONG' || tag === 'B',
          i: style.i || tag === 'EM' || tag === 'I',
          u: style.u || tag === 'U',
          s: style.s || tag === 'S' || tag === 'DEL' || tag === 'STRIKE',
        })
      );
    });
    return out;
  };

  const align = (el: HTMLElement) => {
    const a = el.style?.textAlign;
    return a === 'center' ? AlignmentType.CENTER : a === 'right' ? AlignmentType.RIGHT : a === 'justify' ? AlignmentType.JUSTIFIED : undefined;
  };

  const image = async (img: HTMLImageElement | null, caption: string) => {
    const src = img?.getAttribute('src') || '';
    try {
      if (!/^https?:/i.test(src)) throw new Error('sem imagem');
      const buf = await (await fetch(src)).arrayBuffer();
      const bmp = await createImageBitmap(new Blob([buf]));
      const w = Math.min(450, bmp.width);
      const h = Math.round((bmp.height / bmp.width) * w);
      const type = /\.png(\?|$)/i.test(src) ? 'png' : /\.gif(\?|$)/i.test(src) ? 'gif' : 'jpg';
      children.push(new Paragraph({ alignment: AlignmentType.CENTER, children: [new ImageRun({ data: buf, transformation: { width: w, height: h }, type })] }));
    } catch {
      children.push(new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: `[imagem${caption ? `: ${caption}` : ''}]`, italics: true, font })] }));
      caption = '';
    }
    if (caption) children.push(new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: caption, italics: true, size: 18, font })] }));
  };

  children.push(new Paragraph({ heading: HeadingLevel.TITLE, alignment: AlignmentType.CENTER, children: [new TextRun({ text: title, font })] }));
  let firstChapter = true;
  for (const el of Array.from(dom.children) as HTMLElement[]) {
    const tag = el.tagName;
    if (tag === 'H1') {
      const chapter = el.dataset.chapter === 'true';
      if (chapter && !firstChapter) children.push(new Paragraph({ children: [new PageBreak()] }));
      if (chapter) firstChapter = false;
      children.push(new Paragraph({ heading: HeadingLevel.HEADING_1, alignment: chapter ? AlignmentType.CENTER : undefined, children: runs(el) }));
    } else if (tag === 'H2') children.push(new Paragraph({ heading: HeadingLevel.HEADING_2, alignment: align(el), children: runs(el) }));
    else if (/^H[3-6]$/.test(tag)) children.push(new Paragraph({ heading: HeadingLevel.HEADING_3, children: runs(el) }));
    else if (tag === 'HR') {
      if (el.dataset.pageBreak === 'true') children.push(new Paragraph({ children: [new PageBreak()] }));
      else children.push(new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: '✦  ✦  ✦', font })] }));
    } else if (tag === 'BLOCKQUOTE') children.push(new Paragraph({ indent: { left: 720 }, children: runs(el, { i: true }) }));
    else if (tag === 'UL' || tag === 'OL') {
      Array.from(el.children).forEach((li, i) =>
        children.push(new Paragraph({ children: [new TextRun({ text: tag === 'OL' ? `${i + 1}. ` : '• ', font }), ...runs(li)] }))
      );
    } else if (tag === 'FIGURE') await image(el.querySelector('img'), el.querySelector('figcaption')?.textContent?.trim() || '');
    else if (tag === 'IMG') await image(el as HTMLImageElement, el.getAttribute('alt') || '');
    else if (tag === 'DIV' && el.classList.contains('nb-callout')) {
      // destaque: título em negrito e o texto recuado
      const t = el.querySelector('.nb-callout__title')?.textContent?.trim();
      if (t) children.push(new Paragraph({ indent: { left: 360 }, spacing: { before: 120 }, children: [new TextRun({ text: t, bold: true, font })] }));
      Array.from(el.children)
        .filter((c) => !c.classList.contains('nb-callout__title'))
        .forEach((c) => {
          const blocks = c.querySelectorAll(':scope > p, :scope > li');
          (blocks.length ? Array.from(blocks) : [c]).forEach((bl) =>
            children.push(new Paragraph({ indent: { left: 360 }, spacing: { after: 120 }, children: runs(bl) }))
          );
        });
    } else if (tag === 'PRE') children.push(new Paragraph({ children: [new TextRun({ text: el.textContent || '', font: 'Consolas', size: 18 })] }));
    else if (tag === 'TABLE' || el.querySelector?.('table')) {
      const table = tag === 'TABLE' ? el : el.querySelector('table')!;
      Array.from(table.querySelectorAll('tr')).forEach((tr) =>
        children.push(new Paragraph({ children: [new TextRun({ text: Array.from(tr.children).map((c) => c.textContent?.trim()).join('  |  '), font })] }))
      );
    } else {
      const text = el.textContent || '';
      if (!text.trim() && !el.querySelector('img')) continue;
      children.push(
        new Paragraph({
          alignment: align(el),
          indent: serif && tag === 'P' && !align(el) ? { firstLine: 400 } : undefined,
          spacing: { after: serif ? 60 : 160, line: serif ? 360 : 300 },
          children: runs(el),
        })
      );
    }
  }
  const doc = new Document({
    creator: 'Insight Notebook',
    title,
    styles: { default: { document: { run: { font, size: 24 } } } },
    sections: [{ properties: {}, children }],
  });
  return Packer.toBlob(doc);
}

// ============================================================ exportar um item
export type ExportFormat = 'md' | 'docx' | 'html' | 'csv' | 'xlsx' | 'ics' | 'json';

export function exportFormats(item: NotebookItem): { id: ExportFormat; label: string; hint: string }[] {
  const out: { id: ExportFormat; label: string; hint: string }[] = [];
  const textual = item.kind === 'note' && !isWorkspace(item.template) && item.template !== 'blocks';
  if (textual || item.template === 'book') {
    out.push({ id: 'docx', label: 'Word (.docx)', hint: item.template === 'book' ? 'o livro inteiro, um capítulo por página' : 'para editar ou imprimir' });
    out.push({ id: 'md', label: 'Markdown (.md)', hint: 'Obsidian, Notion e outros editores' });
    out.push({ id: 'html', label: 'Página HTML', hint: 'abre em qualquer navegador' });
  }
  const tables = itemTables(item);
  if (tables.length) {
    out.push({ id: 'xlsx', label: 'Excel (.xlsx)', hint: tables.map((t) => t.name).join(', ') });
    out.push({ id: 'csv', label: 'CSV', hint: 'planilhas e outros sistemas' });
  }
  if (((item.data || {}) as TopicWorkspaceData).agendaEvents?.length) out.push({ id: 'ics', label: 'Calendário (.ics)', hint: 'Google Agenda, Outlook, Apple' });
  out.push({ id: 'json', label: 'JSON', hint: 'dados completos do item' });
  return out;
}

export async function exportItem(item: NotebookItem, format: ExportFormat, api: NotebookApi) {
  const full = (await api.loadFull(item.id)) || item;
  const name = safeName(full.title);
  if (format === 'md') return download(`${name}.md`, await itemMarkdown(full, api), 'text/markdown;charset=utf-8');
  if (format === 'html') {
    const { title, html, serif } = await itemHtml(full, api);
    const page = `<!doctype html><html lang="pt-BR"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${esc(title)}</title><style>body{max-width:42rem;margin:3rem auto;padding:0 1rem;font:18px/1.7 ${serif ? 'Georgia,serif' : 'system-ui,sans-serif'};color:#1f1d1a}h1{text-align:center}figure{margin:2rem auto;text-align:center}figure img,img{max-width:100%}figcaption{font-style:italic;font-size:.85em;color:#6b6358}blockquote{border-left:3px solid #ddd;margin:1em 0;padding-left:1em;color:#555}hr[data-page-break]{border:0;border-top:1px dashed #ccc;margin:3rem 0}</style></head><body><h1>${esc(title)}</h1>${html}</body></html>`;
    return download(`${name}.html`, page, 'text/html;charset=utf-8');
  }
  if (format === 'docx') {
    const { title, html, serif } = await itemHtml(full, api);
    return download(`${name}.docx`, await htmlToDocx(title, html, serif), 'application/vnd.openxmlformats-officedocument.wordprocessingml.document');
  }
  if (format === 'csv') {
    const t = itemTables(full)[0];
    return download(`${name}.csv`, toCsv(t?.rows || []), 'text/csv;charset=utf-8');
  }
  if (format === 'xlsx') {
    const { default: writeXlsxFile } = await import('write-excel-file/browser');
    const tables = itemTables(full);
    const sheets = tables.map((t) => ({
      sheet: t.name.slice(0, 31),
      data: t.rows.map((r, i) => r.map((c) => ({ value: typeof c === 'number' ? c : String(c ?? ''), fontWeight: i === 0 ? ('bold' as const) : undefined }))),
    }));
    const blob = await writeXlsxFile(sheets as never).toBlob();
    return download(`${name}.xlsx`, blob, 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
  }
  if (format === 'ics') return download(`${name}.ics`, toIcs(full), 'text/calendar;charset=utf-8');
  return download(`${name}.json`, JSON.stringify(full, null, 2), 'application/json');
}

// ============================================================ exportar tudo (.zip)
export const BACKUP_FORMAT = 'insight-notebook-backup';

/** Baixa o original de um anexo (endereço público; se o CORS barrar, link temporário assinado). */
async function fetchAsset(a: { id: string; url: string }, signed: Record<string, string>): Promise<Uint8Array | null> {
  for (const url of [a.url, signed[a.id]].filter(Boolean)) {
    try {
      const r = await fetch(url, { mode: 'cors' });
      if (r.ok) return new Uint8Array(await r.arrayBuffer());
    } catch {
      /* tenta o próximo */
    }
  }
  return null;
}

export interface ExportOptions {
  /** só um projeto (pasta de topo); vazio = o Notebook inteiro */
  projectId?: string | null;
  /** inclui a pasta midias/ com os originais */
  media?: boolean;
}

/**
 * Backup portátil (.zip):
 *   Markdown/  notas, capítulos e fichas (com as imagens apontando para midias/)
 *   dados/     verbetes, relações, Codex, fontes, canvases (JSON Canvas) e a lista de mídias
 *   midias/    os arquivos originais, sem perda
 *   insight-notebook-backup.json  tudo junto, para importar de volta
 */
export async function exportAll(api: NotebookApi, entries: Record<string, NotebookEntry>, onProgress?: (n: number, total: number) => void, opts: ExportOptions = {}) {
  const { zipSync, strToU8 } = await import('fflate');
  const { createClient } = await import('@/lib/supabase/client');
  const supabase = createClient();
  const projectId = opts.projectId || null;
  const rootOf = (id: string) => {
    let cur: NotebookItem | undefined = api.items[id];
    for (let g = 0; cur && cur.parent_id && g < 64; g++) cur = api.items[cur.parent_id];
    return cur?.id || null;
  };
  const live = Object.values(api.items).filter((i) => !i.archived_at && (!projectId || rootOf(i.id) === projectId));
  const liveIds = new Set(live.map((i) => i.id));
  const files: Record<string, Uint8Array> = {};
  const full: NotebookItem[] = [];
  const pathOf = (it: NotebookItem): string => {
    const parts: string[] = [];
    let cur: NotebookItem | undefined = it.parent_id ? api.items[it.parent_id] : undefined;
    while (cur) {
      parts.unshift(safeName(cur.title));
      cur = cur.parent_id ? api.items[cur.parent_id] : undefined;
    }
    return parts.join('/');
  };

  // ---------- dados estruturados (do servidor)
  const ents = Object.values(entries).filter((e) => !projectId || e.project_id === projectId || (e.target_id && liveIds.has(e.target_id)));
  const entIds = new Set(ents.map((e) => e.id));
  const pid = live[0]?.profile_id;
  const q = <T,>(p: PromiseLike<{ data: T[] | null }>) => Promise.resolve(p).then((r) => r.data || []);
  const [links, cats, srcs, quotes, assets] = await Promise.all([
    q<Record<string, unknown>>(supabase.from('notebook_entry_links').select('*').limit(20000)),
    q<Record<string, unknown>>(supabase.from('notebook_codex_categories').select('*').is('deleted_at', null).limit(5000)),
    q<Record<string, unknown>>(supabase.from('notebook_sources').select('*').is('deleted_at', null).limit(10000)),
    q<Record<string, unknown>>(supabase.from('notebook_source_quotes').select('*').is('deleted_at', null).limit(20000)),
    q<{ id: string; url: string; r2_key: string; original_name: string | null; content_type: string | null; size_bytes: number; project_id: string | null; item_id: string | null }>(
      supabase.from('notebook_assets').select('id, url, r2_key, original_name, content_type, size_bytes, width, height, project_id, item_id, sha256').is('deleted_at', null).limit(5000)
    ),
  ]);
  const citedSources = new Set(live.flatMap((i) => i.source_refs || []));
  const scopedSources = srcs.filter((s) => !projectId || s.project_id === projectId || citedSources.has(String(s.id)));
  const srcIds = new Set(scopedSources.map((s) => String(s.id)));
  const scopedAssets = assets.filter((a) => !projectId || a.project_id === projectId || (a.item_id && liveIds.has(a.item_id)) || live.some((i) => (i.media_refs || []).includes(a.url)));
  const canvases = live.filter((i) => i.template === 'canvas');
  const canvasRows: Record<string, { nodes: Record<string, unknown>[]; edges: Record<string, unknown>[] }> = {};
  for (const c of canvases) {
    const [nodes, edges] = await Promise.all([
      q<Record<string, unknown>>(supabase.from('notebook_canvas_nodes').select('*').eq('canvas_id', c.id).order('z').limit(20000)),
      q<Record<string, unknown>>(supabase.from('notebook_canvas_edges').select('*').eq('canvas_id', c.id).limit(40000)),
    ]);
    canvasRows[c.id] = { nodes, edges };
  }

  // ---------- mídias originais
  const mediaPath = new Map<string, string>();
  const failed: string[] = [];
  const total = live.length + (opts.media ? scopedAssets.length : 0);
  let n = 0;
  if (opts.media && scopedAssets.length) {
    let signed: Record<string, string> = {};
    try {
      const r = await fetch('/api/notebook/asset-url', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ids: scopedAssets.map((a) => a.id).slice(0, 200) }) });
      if (r.ok) signed = (await r.json()).urls || {};
    } catch {
      /* segue só com o endereço público */
    }
    const used = new Set<string>();
    for (const a of scopedAssets) {
      onProgress?.(++n, total);
      const bytes = await fetchAsset(a, signed);
      if (!bytes) {
        failed.push(a.original_name || a.url);
        continue;
      }
      let name = `midias/${safeName((a.original_name || a.r2_key.split('/').pop() || 'arquivo').replace(/\.[^.]+$/, ''))}`;
      const ext = (/\.([a-z0-9]{2,5})$/i.exec(a.original_name || a.r2_key)?.[1] || (a.content_type || '').split('/')[1] || 'bin').toLowerCase();
      let k = 2;
      while (used.has(`${name}.${ext}`)) name = `${name.replace(/ \(\d+\)$/, '')} (${k++})`;
      used.add(`${name}.${ext}`);
      files[`${name}.${ext}`] = bytes;
      mediaPath.set(a.url, `${name}.${ext}`);
    }
  }
  /** troca os endereços do R2 pelo caminho relativo dentro do .zip */
  const relink = (text: string, fromDir: string) => {
    if (!mediaPath.size) return text;
    const up = '../'.repeat(fromDir.split('/').filter(Boolean).length);
    let out = text;
    mediaPath.forEach((path, url) => (out = out.split(url).join(encodeURI(up + path))));
    return out;
  };

  for (const it of live) {
    onProgress?.(++n, total);
    const f = (await api.loadFull(it.id)) || it;
    const clean = { ...f } as Partial<NotebookItem>;
    delete clean._full;
    full.push(clean as NotebookItem);
    if (f.kind === 'folder' && f.template !== 'book') continue;
    const dir = pathOf(f);
    const base = `Markdown/${dir ? `${dir}/` : ''}${safeName(f.title)}`;
    if (f.template === 'book') continue; // capítulos já vão um a um
    if (isWorkspace(f.template)) {
      files[`${base}.json`] = strToU8(JSON.stringify(f.data || {}, null, 2));
      const t = itemTables(f)[0];
      if (t) files[`${base}.csv`] = strToU8(toCsv(t.rows));
      if (((f.data || {}) as TopicWorkspaceData).agendaEvents?.length) files[`${base}.ics`] = strToU8(toIcs(f));
    } else if (f.template === 'canvas') {
      const rows = canvasRows[f.id] || { nodes: [], edges: [] };
      const jc = {
        nodes: rows.nodes.map((r) => {
          const b = { id: r.id, x: Math.round(Number(r.x)), y: Math.round(Number(r.y)), width: Math.round(Number(r.width)), height: Math.round(Number(r.height)), ...(r.color ? { color: r.color } : {}) };
          if (r.type === 'group') return { ...b, type: 'group', label: r.label || '' };
          if (r.type === 'text') return { ...b, type: 'text', text: relink(String(r.text || ''), `Markdown/${dir}`) };
          if ((r.type === 'image' || r.type === 'file') && r.url && mediaPath.has(String(r.url))) return { ...b, type: 'file', file: mediaPath.get(String(r.url)) };
          if (r.type === 'note' && r.item_id && api.items[String(r.item_id)]) return { ...b, type: 'file', file: `Markdown/${pathOf(api.items[String(r.item_id)]) ? `${pathOf(api.items[String(r.item_id)])}/` : ''}${safeName(api.items[String(r.item_id)].title)}.md` };
          return { ...b, type: 'link', url: r.url || '' };
        }),
        edges: rows.edges.map((e) => ({ id: e.id, fromNode: e.from_node, toNode: e.to_node, ...(e.from_side ? { fromSide: e.from_side } : {}), ...(e.to_side ? { toSide: e.to_side } : {}), ...(e.label ? { label: e.label } : {}), toEnd: 'arrow' })),
      };
      files[`${base}.canvas`] = strToU8(JSON.stringify(jc, null, 2));
    } else {
      files[`${base}.md`] = strToU8(relink(await itemMarkdown(f, api), `Markdown/${dir}`));
    }
  }

  // ---------- dados/
  const scopedLinks = links.filter((l) => entIds.has(String(l.from_id)) && entIds.has(String(l.to_id)));
  const scopedCats = cats.filter((c) => !projectId || c.project_id === projectId);
  const scopedQuotes = quotes.filter((x) => srcIds.has(String(x.source_id)));
  const json = (o: unknown) => strToU8(JSON.stringify(o, null, 2));
  files['dados/verbetes.json'] = json(ents);
  files['dados/relacoes.json'] = json(scopedLinks);
  files['dados/codex-categorias.json'] = json(scopedCats);
  files['dados/fontes.json'] = json(scopedSources);
  files['dados/trechos-de-fontes.json'] = json(scopedQuotes);
  files['dados/midias.json'] = json(scopedAssets.map((a) => ({ ...a, arquivo: mediaPath.get(a.url) || null })));
  for (const c of canvases) files[`dados/canvas/${safeName(c.title)}-${c.id.slice(0, 8)}.json`] = json(canvasRows[c.id]);

  const backup = {
    format: BACKUP_FORMAT,
    version: 2,
    exported_at: new Date().toISOString(),
    scope: projectId ? { project: projectId, title: api.items[projectId]?.title || '' } : 'tudo',
    items: full,
    entries: ents,
    entry_links: scopedLinks,
    codex_categories: scopedCats,
    sources: scopedSources,
    source_quotes: scopedQuotes,
    canvas: canvasRows,
    assets: scopedAssets,
  };
  files['insight-notebook-backup.json'] = strToU8(JSON.stringify(backup, null, 2));
  files['LEIA-ME.txt'] = strToU8(
    [
      `Backup do Notebook do Insight${projectId ? ` — projeto “${api.items[projectId]?.title || ''}”` : ''}`,
      `Gerado em ${new Date().toLocaleString('pt-BR')}.`,
      '',
      '- Markdown/: notas, capítulos e fichas em Markdown (abre no Obsidian, Typora…). Canvases em .canvas (JSON Canvas).',
      '- dados/: verbetes do Sumário, relações, categorias do Codex, fontes, trechos, canvases e a lista de mídias, em JSON.',
      opts.media ? '- midias/: os arquivos originais, sem perda de qualidade.' : '- (mídias não incluídas nesta exportação)',
      '- insight-notebook-backup.json: tudo junto, para importar de volta no Insight (Importar → este arquivo).',
      ...(failed.length ? ['', `Não foi possível baixar ${failed.length} ${failed.length === 1 ? 'arquivo' : 'arquivos'}: ${failed.slice(0, 20).join(', ')}`] : []),
    ].join('\n') + '\n'
  );
  void pid;
  const zip = zipSync(files, { level: 6 });
  const d = new Date();
  const stamp = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  download(`${projectId ? safeName(api.items[projectId]?.title || 'projeto') : 'notebook-insight'}-${stamp}.zip`, zip as Uint8Array<ArrayBuffer>, 'application/zip');
  return { files: Object.keys(files).length, media: mediaPath.size, failed };
}

// ============================================================ importar
export interface ImportResult {
  created: { id: string; title: string; kind: string }[];
  skipped: { name: string; reason: string }[];
}

const titleFromMd = (md: string, fallback: string) => {
  const fm = /^---\n([\s\S]*?)\n---/.exec(md)?.[1];
  const t = fm && /^title:\s*(.+)$/m.exec(fm)?.[1];
  if (t) return t.replace(/^["']|["']$/g, '').trim();
  const h = /^#\s+(.+)$/m.exec(stripFrontmatter(md))?.[1];
  return (h || fallback).trim().slice(0, 200);
};

const norm = (s: string) =>
  String(s ?? '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim();

/** Linhas de planilha → tarefas, agenda ou tabela em markdown. */
function rowsToItem(rows: string[][], name: string): { template: NotebookTemplate; title: string; content?: string; data?: TopicWorkspaceData } {
  const clean = rows.filter((r) => r.some((c) => String(c ?? '').trim()));
  const head = (clean[0] || []).map(norm);
  const col = (...names: string[]) => head.findIndex((h) => names.includes(h));
  const iTitle = col('titulo', 'title', 'tarefa', 'task', 'nome', 'name', 'evento', 'event', 'assunto', 'summary');
  const iStatus = col('status', 'situacao', 'estado');
  const iDate = col('data', 'date', 'dia', 'prazo', 'due', 'due date', 'vencimento');
  const iTime = col('hora', 'horario', 'time', 'inicio', 'start');
  const body = clean.slice(1);
  if (iTitle >= 0 && iStatus >= 0) {
    const st = (v: string): TaskItem['status'] => {
      const s = norm(v);
      return /conclu|feit|done|pront/.test(s) ? 'done' : /andamento|progress|fazendo|doing/.test(s) ? 'in_progress' : 'not_started';
    };
    const iWho = col('responsavel', 'assignee', 'dono', 'owner');
    const iPrio = col('prioridade', 'priority');
    const tasks: TaskItem[] = body.slice(0, 2000).map((r, i) => ({
      id: `imp-${i}-${Math.random().toString(36).slice(2, 7)}`,
      title: String(r[iTitle] ?? '').slice(0, 300) || 'Tarefa',
      status: st(String(r[iStatus] ?? '')),
      assignee: iWho >= 0 ? String(r[iWho] ?? '') : '',
      dueDate: iDate >= 0 ? toIsoDate(r[iDate]) : undefined,
      priority: iPrio >= 0 ? (/alt|high/.test(norm(String(r[iPrio]))) ? 'high' : /baix|low/.test(norm(String(r[iPrio]))) ? 'low' : 'medium') : undefined,
    }));
    return { template: 'tasks', title: name, data: { tasks } as TopicWorkspaceData };
  }
  if (iTitle >= 0 && iDate >= 0) {
    const iLoc = col('local', 'location', 'lugar');
    const agendaEvents: AgendaEventItem[] = body.slice(0, 2000).map((r, i) => ({
      id: `imp-${i}-${Math.random().toString(36).slice(2, 7)}`,
      date: toIsoDate(r[iDate]) || '',
      time: iTime >= 0 ? String(r[iTime] ?? '').slice(0, 5) : '',
      title: String(r[iTitle] ?? '').slice(0, 300) || 'Evento',
      location: iLoc >= 0 ? String(r[iLoc] ?? '') : undefined,
      category: 'Importado',
      color: '#E63946',
    }));
    return { template: 'agenda', title: name, data: { agendaEvents } as TopicWorkspaceData };
  }
  const width = Math.max(...clean.map((r) => r.length), 1);
  const cell = (v: unknown) => String(v ?? '').replace(/\|/g, '\\|').replace(/\n/g, ' ');
  const lines = clean.slice(0, 1000).map((r) => `| ${Array.from({ length: width }, (_, j) => cell(r[j])).join(' | ')} |`);
  if (lines.length) lines.splice(1, 0, `| ${Array.from({ length: width }, () => '---').join(' | ')} |`);
  return { template: 'markdown', title: name, content: lines.join('\n') + '\n' };
}

function toIsoDate(v: unknown): string | undefined {
  if (v instanceof Date && !Number.isNaN(v.getTime())) return v.toISOString().slice(0, 10);
  const s = String(v ?? '').trim();
  let m = /^(\d{4})-(\d{2})-(\d{2})/.exec(s);
  if (m) return `${m[1]}-${m[2]}-${m[3]}`;
  m = /^(\d{1,2})\/(\d{1,2})\/(\d{2,4})/.exec(s);
  if (m) return `${m[3].length === 2 ? `20${m[3]}` : m[3]}-${m[2].padStart(2, '0')}-${m[1].padStart(2, '0')}`;
  return undefined;
}

export const IMPORT_ACCEPT = '.md,.markdown,.txt,.html,.htm,.docx,.csv,.xlsx,.ics,.json';
const MAX_FILE = 15 * 1024 * 1024;

export async function importFiles(files: File[], parentId: string | null, api: NotebookApi, entriesApi: EntriesApi): Promise<ImportResult> {
  const res: ImportResult = { created: [], skipped: [] };
  const make = async (o: { template: NotebookTemplate; title: string; content?: string; data?: TopicWorkspaceData }) => {
    const it = await api.create({ template: o.template, parentId, title: o.title, content: o.content });
    if (!it) throw new Error('não foi possível criar');
    if (o.data) api.update(it.id, { data: { ...(it.data || {}), ...o.data } as NotebookItem['data'] });
    res.created.push({ id: it.id, title: it.title, kind: getTemplate(o.template).name });
  };
  for (const f of files) {
    const base = f.name.replace(/\.[^.]+$/, '');
    const ext = (/\.([^.]+)$/.exec(f.name)?.[1] || '').toLowerCase();
    try {
      if (f.size > MAX_FILE) throw new Error('arquivo maior que 15 MB');
      if (ext === 'md' || ext === 'markdown' || ext === 'txt') {
        const md = (await f.text()).replace(/\r\n?/g, '\n');
        await make({ template: 'markdown', title: titleFromMd(md, base), content: md });
      } else if (ext === 'html' || ext === 'htm') {
        const td = await turndown();
        const doc = new DOMParser().parseFromString(await f.text(), 'text/html');
        doc.querySelectorAll('script,style,iframe,object,embed').forEach((n) => n.remove());
        await make({ template: 'markdown', title: doc.title?.trim() || base, content: td.turndown(doc.body.innerHTML) });
      } else if (ext === 'docx') {
        const mammoth = await import('mammoth');
        const { value } = await mammoth.convertToHtml({ arrayBuffer: await f.arrayBuffer() });
        const td = await turndown();
        await make({ template: 'markdown', title: base, content: td.turndown(value) });
      } else if (ext === 'csv') {
        const Papa = (await import('papaparse')).default;
        const parsed = Papa.parse<string[]>(await f.text(), { skipEmptyLines: true });
        await make(rowsToItem(parsed.data as string[][], base));
      } else if (ext === 'xlsx') {
        const { default: readXlsxFile } = await import('read-excel-file/browser');
        const sheets = await readXlsxFile(f);
        for (const sh of sheets.slice(0, 10)) {
          const rows = sh.data.map((r) => r.map((c) => (c instanceof Date ? c.toISOString().slice(0, 10) : String(c ?? ''))));
          await make(rowsToItem(rows, sheets.length > 1 ? `${base} · ${sh.sheet}` : base));
        }
      } else if (ext === 'ics') {
        const events = parseIcs(await f.text());
        if (!events.length) throw new Error('nenhum evento encontrado');
        await make({ template: 'agenda', title: base, data: { agendaEvents: events } as TopicWorkspaceData });
      } else if (ext === 'json') {
        const json = JSON.parse(await f.text());
        if (json?.format !== BACKUP_FORMAT) throw new Error('não é um backup do Notebook');
        await restoreBackup(json, parentId, api, entriesApi, res);
      } else {
        throw new Error('formato não suportado');
      }
    } catch (err) {
      res.skipped.push({ name: f.name, reason: err instanceof Error ? err.message : 'erro' });
    }
  }
  return res;
}

/** Restaura um backup como cópia, dentro de um projeto novo (nada é sobrescrito). */
async function restoreBackup(
  json: {
    items: NotebookItem[];
    entries?: NotebookEntry[];
    version?: number;
    entry_links?: Record<string, unknown>[];
    codex_categories?: Record<string, unknown>[];
    sources?: Record<string, unknown>[];
    source_quotes?: Record<string, unknown>[];
    canvas?: Record<string, { nodes: Record<string, unknown>[]; edges: Record<string, unknown>[] }>;
  },
  parentId: string | null,
  api: NotebookApi,
  entriesApi: EntriesApi,
  res: ImportResult
) {
  const items = (json.items || []).filter((i) => i && i.id && i.title).slice(0, 5000);
  const d = new Date();
  const root = await api.create({ template: 'folder', parentId, title: `Backup importado ${d.toLocaleDateString('pt-BR')}` });
  if (!root) throw new Error('não foi possível criar o projeto');
  res.created.push({ id: root.id, title: root.title, kind: 'Projeto' });
  const idMap = new Map<string, string>();
  // entradas do Sumário ganham ids novos; o texto é corrigido depois
  for (const e of json.entries || []) {
    const ne = await entriesApi.create({ kind: e.kind, title: e.title, summary: e.summary || '', target_id: null, project_id: null, aliases: e.aliases || [] });
    if (ne) idMap.set(e.id, ne.id);
  }
  // v2: fontes ganham ids novos antes das notas (as citações do texto apontam para elas)
  const { createClient } = await import('@/lib/supabase/client');
  const supabase = createClient();
  const profileId = root.profile_id;
  for (const src of json.sources || []) {
    const nid = crypto.randomUUID();
    const row = { ...src, id: nid, profile_id: profileId, project_id: null } as Record<string, unknown>;
    delete row.created_at;
    delete row.updated_at;
    delete row.deleted_at;
    const { error } = await supabase.from('notebook_sources').insert(row);
    if (!error) idMap.set(String(src.id), nid);
  }
  for (const qt of json.source_quotes || []) {
    const sid = idMap.get(String(qt.source_id));
    if (!sid) continue;
    await supabase.from('notebook_source_quotes').insert({ profile_id: profileId, source_id: sid, text: qt.text, page: qt.page ?? null, comment: qt.comment || '' });
  }
  const swap = (s: string) => {
    let out = s;
    idMap.forEach((to, from) => (out = out.split(from).join(to)));
    return out;
  };
  // pais antes dos filhos
  const ids = new Set(items.map((i) => i.id));
  const pending = [...items];
  let guard = 0;
  while (pending.length && guard++ < 50) {
    for (let k = 0; k < pending.length; k++) {
      const it = pending[k];
      const parentOk = !it.parent_id || !ids.has(it.parent_id) || idMap.has(it.parent_id);
      if (!parentOk) continue;
      pending.splice(k--, 1);
      const parent = it.parent_id && idMap.has(it.parent_id) ? idMap.get(it.parent_id)! : root.id;
      const created = await api.create({ template: it.template, parentId: parent, title: it.title, content: swap(it.content || '') });
      if (!created) continue;
      idMap.set(it.id, created.id);
      api.update(created.id, {
        data: JSON.parse(swap(JSON.stringify(it.data || {}))),
        ...(it.blocks ? { blocks: it.blocks } : {}),
        icon: it.icon,
        color: it.color,
      });
    }
  }
  // destinos de "Ler mais" apontam para as notas novas
  for (const e of json.entries || []) {
    const ne = idMap.get(e.id);
    if (ne && e.target_id && idMap.has(e.target_id)) void entriesApi.update(ne, { target_id: idMap.get(e.target_id)! });
    if (ne && e.project_id && idMap.has(e.project_id)) void entriesApi.update(ne, { project_id: idMap.get(e.project_id)! });
  }
  // v2: categorias do Codex (pais antes dos filhos), relações e canvases
  const cats = [...(json.codex_categories || [])];
  for (let pass = 0; pass < 4 && cats.length; pass++) {
    for (let k = 0; k < cats.length; k++) {
      const c = cats[k];
      if (c.parent_id && !idMap.has(String(c.parent_id)) && cats.some((x) => x.id === c.parent_id)) continue;
      cats.splice(k--, 1);
      const nid = crypto.randomUUID();
      const project = idMap.get(String(c.project_id)) || root.id;
      const { error } = await supabase.from('notebook_codex_categories').insert({ id: nid, profile_id: profileId, project_id: project, parent_id: c.parent_id ? idMap.get(String(c.parent_id)) || null : null, name: c.name, glyph: c.glyph, kind: c.kind, fields: c.fields, position: c.position ?? 0 });
      if (!error) idMap.set(String(c.id), nid);
    }
  }
  for (const e of json.entries || []) {
    const ne = idMap.get(e.id);
    if (ne && e.codex_category_id && idMap.has(e.codex_category_id)) void entriesApi.update(ne, { codex_category_id: idMap.get(e.codex_category_id)! });
  }
  for (const l of json.entry_links || []) {
    const a = idMap.get(String(l.from_id));
    const b = idMap.get(String(l.to_id));
    if (a && b) await entriesApi.addLink(a, b, l.rel as never, String(l.label || ''));
  }
  for (const [oldId, rows] of Object.entries(json.canvas || {})) {
    const cid = idMap.get(oldId);
    if (!cid) continue;
    const nodes = rows.nodes.map((r) => {
      const n = { ...r, canvas_id: cid, profile_id: profileId, asset_id: null } as Record<string, unknown>;
      delete n.updated_at;
      if (n.item_id) n.item_id = idMap.get(String(n.item_id)) || null;
      if (n.entry_id) n.entry_id = idMap.get(String(n.entry_id)) || null;
      if (typeof n.text === 'string') n.text = swap(n.text);
      return n;
    });
    for (let i = 0; i < nodes.length; i += 300) await supabase.from('notebook_canvas_nodes').insert(nodes.slice(i, i + 300));
    const edges = rows.edges.map((r) => {
      const e = { ...r, canvas_id: cid, profile_id: profileId } as Record<string, unknown>;
      delete e.updated_at;
      return e;
    });
    for (let i = 0; i < edges.length; i += 300) await supabase.from('notebook_canvas_edges').insert(edges.slice(i, i + 300));
  }
  res.created.push({ id: root.id, title: `${items.length} itens restaurados`, kind: 'Backup' });
}
