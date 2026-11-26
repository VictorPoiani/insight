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
const WORKSPACES = new Set(['goals', 'habits', 'tasks', 'roadmap', 'mindmap', 'diet', 'agenda']);
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

export async function exportAll(api: NotebookApi, entries: Record<string, NotebookEntry>, onProgress?: (n: number, total: number) => void) {
  const { zipSync, strToU8 } = await import('fflate');
  const live = Object.values(api.items).filter((i) => !i.archived_at);
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
  let n = 0;
  for (const it of live) {
    onProgress?.(++n, live.length);
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
    } else {
      files[`${base}.md`] = strToU8(await itemMarkdown(f, api));
    }
  }
  const backup = { format: BACKUP_FORMAT, version: 1, exported_at: new Date().toISOString(), items: full, entries: Object.values(entries) };
  files['insight-notebook-backup.json'] = strToU8(JSON.stringify(backup, null, 2));
  files['LEIA-ME.txt'] = strToU8(
    'Exportação do Notebook do Insight.\n\n- Markdown/: suas notas, capítulos e fichas em Markdown (abre no Obsidian, Notion, Typora…).\n- insight-notebook-backup.json: cópia completa para importar de volta no Insight.\n'
  );
  const zip = zipSync(files, { level: 6 });
  const d = new Date();
  download(`notebook-insight-${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}.zip`, zip as Uint8Array<ArrayBuffer>, 'application/zip');
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
  json: { items: NotebookItem[]; entries?: NotebookEntry[] },
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
  }
  res.created.push({ id: root.id, title: `${items.length} itens restaurados`, kind: 'Backup' });
}
