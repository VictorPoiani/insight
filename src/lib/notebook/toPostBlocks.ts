'use client';

import type { PostBlock, PostBlockType } from '@/types/database';
import { renderMarkdown } from './markdown';
import type { NotebookItem } from './types';

const uid = () => `nb-${Math.random().toString(36).slice(2, 10)}`;

/** Converte HTML (capítulo ou markdown renderizado) em blocos de post. */
export function htmlToPostBlocks(html: string, opts: { font?: 'serif' | 'sans' } = {}): PostBlock[] {
  const doc = new DOMParser().parseFromString(`<div>${html}</div>`, 'text/html');
  const root = doc.body.firstElementChild as HTMLElement;
  const out: PostBlock[] = [];
  const fontStyle = opts.font ?? 'sans';

  // links internos viram texto simples no post
  root.querySelectorAll('[data-wikilink]').forEach((a) => a.replaceWith(doc.createTextNode(a.textContent || '')));
  root.querySelectorAll('input').forEach((i) => i.replaceWith(doc.createTextNode((i as HTMLInputElement).checked ? '☑ ' : '☐ ')));

  const push = (type: PostBlockType, inner: string, extra: Partial<PostBlock> = {}) => {
    const clean = inner.trim();
    if (!clean && type !== 'divider') return;
    out.push({ id: uid(), type, html: clean, fontStyle, ...extra });
  };

  const walk = (el: Element) => {
    const tag = el.tagName.toLowerCase();
    if (tag === 'h1') return push('h1', el.innerHTML);
    if (tag === 'h2' || tag === 'h3' || tag === 'h4' || tag === 'h5' || tag === 'h6') return push('h2', el.innerHTML);
    if (tag === 'hr') return out.push({ id: uid(), type: 'divider' });
    if (tag === 'blockquote') return push('quote', el.innerHTML.replace(/<\/?p>/g, ''));
    if (tag === 'pre') return push('code', (el.textContent || '').replace(/&/g, '&amp;').replace(/</g, '&lt;'), { fontStyle: 'mono' });
    if (tag === 'ul' || tag === 'ol') {
      el.querySelectorAll(':scope > li').forEach((li) => push('bullet', li.innerHTML));
      return;
    }
    if (tag === 'img') {
      const src = (el as HTMLImageElement).getAttribute('src');
      if (src) out.push({ id: uid(), type: 'image', imageUrl: src, imageCaption: (el as HTMLImageElement).alt || '', imageWidth: '100%', imageAlign: 'center' });
      return;
    }
    if (el.classList.contains('nb-callout')) {
      return push('callout', el.textContent || '', { calloutIcon: '💡' });
    }
    if (tag === 'div' && (el.classList.contains('nb-table-wrap') || el.classList.contains('nb-props'))) {
      const table = el.querySelector('table');
      if (table) {
        const rows = Array.from(table.querySelectorAll('tr')).map((tr) => Array.from(tr.children).map((c) => c.textContent || ''));
        if (rows.length) out.push({ id: uid(), type: 'table', tableData: rows });
      }
      return;
    }
    // parágrafo: separa imagens embutidas
    const imgs = Array.from(el.querySelectorAll('img'));
    imgs.forEach((img) => img.remove());
    const align = (el as HTMLElement).style?.textAlign;
    push('paragraph', el.innerHTML, align === 'center' || align === 'right' ? { align: align as 'center' | 'right' } : {});
    imgs.forEach((img) => walk(img));
  };

  Array.from(root.children).forEach(walk);
  // texto solto (sem tags de bloco)
  if (!out.length && root.textContent?.trim()) push('paragraph', root.innerHTML);
  return out;
}

export function itemToPostBlocks(item: NotebookItem, book?: NotebookItem | null): PostBlock[] {
  if (item.template === 'blocks') return (item.blocks || []).map((b) => ({ ...b, id: uid() }));
  if (item.template === 'chapter') {
    const head: PostBlock[] = [];
    if (book) head.push({ id: uid(), type: 'callout', html: escapeHtml(book.title), calloutIcon: '📖', fontStyle: 'serif' });
    head.push({ id: uid(), type: 'h1', html: escapeHtml(item.title), fontStyle: 'serif', align: 'center' });
    const note = String(item.data?.authorNote || '').trim();
    const body = htmlToPostBlocks(String(item.data?.html || ''), { font: 'serif' });
    const tail: PostBlock[] = note
      ? [
          { id: uid(), type: 'divider' },
          { id: uid(), type: 'quote', html: `<strong>Nota do autor:</strong> ${escapeHtml(note)}`, fontStyle: 'sans' },
        ]
      : [];
    return [...head, ...body, ...tail];
  }
  return [
    { id: uid(), type: 'h1', html: escapeHtml(item.title), fontStyle: 'sans' },
    ...htmlToPostBlocks(renderMarkdown(item.content.replace(/^---\n[\s\S]*?\n---\n?/, ''))),
  ];
}

function escapeHtml(s: string) {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}
