'use client';

/**
 * Extensões acadêmicas do editor (modo Artigo):
 *   [(SILVA, 2025, p. 42)](cite:<id>[,<id>] "p. 42|paren|apud:<id>")   citação
 *   ^[texto da nota]                                                    nota de rodapé
 *   $x^2$  e  $$ … $$                                                   fórmula (KaTeX)
 *   {{tabela}} Título  /  {{fonte}} Elaborado pelo autor (2025).         legenda padronizada
 * O texto da citação é recalculado a partir da fonte e da norma do artigo.
 */
import { createContext, useContext, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Extension, Node, mergeAttributes, type JSONContent, type Editor, type Range } from '@tiptap/core';
import { NodeViewWrapper, ReactNodeViewRenderer, type NodeViewProps } from '@tiptap/react';
import { BookOpen, Plus, Sigma, Superscript, Table2, Trash2, X } from 'lucide-react';
import { formatCitationGroup, shortLabel, sourceType, type CitationNorm, type CiteMode, type Source } from '@/lib/notebook/sources';
import type { MenuItem } from './RichNoteEditor';

// ------------------------------------------------------------------ contexto

export interface CitationTools {
  sources: Record<string, Source>;
  /** fontes ligadas ao artigo (aparecem primeiro) */
  linked: string[];
  norm: CitationNorm;
  upperCase: boolean;
  /** abre o cadastro de fonte e devolve a criada */
  requestSource: (title: string) => Promise<Source | null>;
}

export const CitationContext = createContext<CitationTools | null>(null);

const UUID = '[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}';
const norm = (s: string) =>
  s
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '');

/** Popover fixo, no tema do Notebook, perto do elemento. */
function Pop({ anchor, onClose, children, width = 300 }: { anchor: HTMLElement | null; onClose: () => void; children: React.ReactNode; width?: number }) {
  const ref = useRef<HTMLDivElement>(null);
  const [pos, setPos] = useState<{ left: number; top: number } | null>(null);
  useLayoutEffect(() => {
    if (!anchor) return;
    const r = anchor.getBoundingClientRect();
    const left = Math.max(8, Math.min(window.innerWidth - width - 8, r.left));
    const below = r.bottom + 6;
    setPos({ left, top: below + 240 > window.innerHeight ? Math.max(8, r.top - 246) : below });
  }, [anchor, width]);
  useEffect(() => {
    const close = (e: MouseEvent) => {
      const t = e.target as globalThis.Node;
      if (ref.current?.contains(t) || anchor?.contains(t)) return;
      onClose();
    };
    const key = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('mousedown', close);
    window.addEventListener('keydown', key);
    return () => {
      window.removeEventListener('mousedown', close);
      window.removeEventListener('keydown', key);
    };
  }, [anchor, onClose]);
  const host = typeof document !== 'undefined' ? document.querySelector('.nb-app') || document.body : null;
  if (!host || !pos) return null;
  return createPortal(
    <div ref={ref} className="nb-acad-pop" style={{ left: pos.left, top: pos.top, width }} onMouseDown={(e) => e.stopPropagation()}>
      {children}
    </div>,
    host
  );
}

// ------------------------------------------------------------------ citação

function parseMeta(meta: string | undefined) {
  const out: { page: string; mode: CiteMode; apud: string | null } = { page: '', mode: 'paren', apud: null };
  for (const part of (meta || '').split('|')) {
    const p = part.trim();
    if (!p) continue;
    if (p === 'paren' || p === 'narrative' || p === 'year') out.mode = p;
    else if (p.startsWith('apud:')) out.apud = p.slice(5);
    else out.page = p.replace(/^p\.?\s*/i, '');
  }
  return out;
}

function CitationView({ node, updateAttributes, deleteNode, selected }: NodeViewProps) {
  const ctx = useContext(CitationContext);
  const [anchor, setAnchor] = useState<HTMLSpanElement | null>(null);
  const [open, setOpen] = useState(false);
  const ids = String(node.attrs.ids || '')
    .split(',')
    .filter(Boolean);
  const list = ids.map((id) => ctx?.sources[id]).filter((s): s is Source => !!s);
  const apud = node.attrs.apud ? ctx?.sources[node.attrs.apud] || null : null;
  const label = ctx ? formatCitationGroup(list, ctx.norm, { page: node.attrs.page, mode: node.attrs.mode, upperCase: ctx.upperCase, apud }) : node.attrs.label || '(citação)';

  // mantém o texto salvo no markdown igual ao que aparece
  useEffect(() => {
    if (ctx && list.length === ids.length && label !== node.attrs.label) updateAttributes({ label });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [label]);

  const missing = ctx && list.length < ids.length;
  return (
    <NodeViewWrapper as="span" className="nb-cite-wrap">
      <span
        ref={setAnchor}
        className="nb-cite"
        data-selected={selected || undefined}
        data-missing={missing || undefined}
        title={list.map((s) => `${shortLabel(s)} · ${s.title}`).join('\n') || 'Fonte removida'}
        onClick={() => setOpen(true)}
      >
        {label}
      </span>
      {open && ctx && (
        <Pop anchor={anchor} onClose={() => setOpen(false)}>
          <p className="nb-acad-pop-title">Citação</p>
          <ul className="nb-acad-pop-list">
            {ids.map((id) => {
              const s = ctx.sources[id];
              return (
                <li key={id}>
                  <span className="min-w-0 flex-1 truncate">{s ? `${shortLabel(s)} · ${s.title}` : 'Fonte removida da biblioteca'}</span>
                  {ids.length > 1 && (
                    <button type="button" aria-label="Tirar esta fonte" onClick={() => updateAttributes({ ids: ids.filter((x) => x !== id).join(',') })}>
                      <X className="w-3 h-3" />
                    </button>
                  )}
                </li>
              );
            })}
          </ul>
          <label className="nb-acad-row">
            <span>Página</span>
            <input autoFocus value={node.attrs.page || ''} onChange={(e) => updateAttributes({ page: e.target.value.slice(0, 20) })} placeholder="ex.: 42 ou 12-15" />
          </label>
          {ids.length === 1 && (
            <label className="nb-acad-row">
              <span>Forma</span>
              <select value={node.attrs.mode || 'paren'} onChange={(e) => updateAttributes({ mode: e.target.value })}>
                <option value="paren">Entre parênteses: (SILVA, 2025)</option>
                <option value="narrative">No texto: Silva (2025)</option>
                <option value="year">Só o ano: (2025)</option>
              </select>
            </label>
          )}
          {ids.length === 1 && (
            <label className="nb-acad-row">
              <span>apud</span>
              <select value={node.attrs.apud || ''} onChange={(e) => updateAttributes({ apud: e.target.value || null })}>
                <option value="">— (citação direta da obra)</option>
                {Object.values(ctx.sources)
                  .filter((s) => s.id !== ids[0])
                  .sort((a, b) => shortLabel(a).localeCompare(shortLabel(b), 'pt-BR'))
                  .map((s) => (
                    <option key={s.id} value={s.id}>
                      citado em {shortLabel(s)}
                    </option>
                  ))}
              </select>
            </label>
          )}
          <label className="nb-acad-row">
            <span>Somar</span>
            <select
              value=""
              onChange={(e) => e.target.value && updateAttributes({ ids: [...ids, e.target.value].join(','), mode: 'paren', apud: null })}
            >
              <option value="">outra fonte na mesma chamada…</option>
              {Object.values(ctx.sources)
                .filter((s) => !ids.includes(s.id))
                .sort((a, b) => shortLabel(a).localeCompare(shortLabel(b), 'pt-BR'))
                .map((s) => (
                  <option key={s.id} value={s.id}>
                    {shortLabel(s)}
                  </option>
                ))}
            </select>
          </label>
          <div className="flex items-center justify-between pt-1">
            <span className="text-[11px] text-[var(--nb-ink-3)]">{label}</span>
            <button type="button" onClick={() => deleteNode()} className="flex items-center gap-1 text-[11px] text-[var(--nb-ink-3)] hover:text-red-400">
              <Trash2 className="w-3 h-3" /> Tirar
            </button>
          </div>
        </Pop>
      )}
    </NodeViewWrapper>
  );
}

export const Citation = Node.create({
  name: 'citation',
  group: 'inline',
  inline: true,
  atom: true,
  selectable: true,
  addAttributes() {
    return { ids: { default: '' }, page: { default: '' }, mode: { default: 'paren' }, apud: { default: null }, label: { default: '' } };
  },
  parseHTML() {
    return [
      {
        tag: 'span[data-cite]',
        getAttrs: (el) => {
          const e = el as HTMLElement;
          const ids = (e.getAttribute('data-cite') || '').toLowerCase();
          if (!new RegExp(`^${UUID}(,${UUID})*$`, 'i').test(ids)) return false;
          return { ids, page: e.getAttribute('data-page') || '', mode: e.getAttribute('data-mode') || 'paren', apud: e.getAttribute('data-apud') || null, label: e.textContent || '' };
        },
      },
    ];
  },
  renderHTML({ node, HTMLAttributes }) {
    return [
      'span',
      mergeAttributes(HTMLAttributes, {
        'data-cite': node.attrs.ids,
        'data-page': node.attrs.page || undefined,
        'data-mode': node.attrs.mode !== 'paren' ? node.attrs.mode : undefined,
        'data-apud': node.attrs.apud || undefined,
        class: 'nb-cite',
      }),
      node.attrs.label || '(citação)',
    ];
  },
  renderText: ({ node }) => node.attrs.label || '',
  addNodeView() {
    return ReactNodeViewRenderer(CitationView);
  },
  markdownTokenName: 'citation',
  markdownTokenizer: {
    name: 'citation',
    level: 'inline',
    start: (src: string) => {
      const m = /\[[^\]\n]*\]\(cite:/.exec(src);
      return m ? m.index : -1;
    },
    tokenize(src: string) {
      const m = new RegExp(`^\\[([^\\]\\n]*)\\]\\(cite:(${UUID}(?:,${UUID})*)(?:\\s+"([^"\\n]*)")?\\)`, 'i').exec(src);
      if (!m) return undefined;
      const meta = parseMeta(m[3]);
      return { type: 'citation', raw: m[0], label: m[1], ids: m[2].toLowerCase(), ...meta };
    },
  },
  parseMarkdown(token, h) {
    return h.createNode('citation', { ids: token.ids, page: token.page, mode: token.mode, apud: token.apud, label: token.label });
  },
  renderMarkdown(node: JSONContent) {
    const a = node.attrs || {};
    const meta = [a.page ? `p. ${a.page}` : '', a.mode && a.mode !== 'paren' ? a.mode : '', a.apud ? `apud:${a.apud}` : ''].filter(Boolean).join('|');
    return `[${String(a.label || '(citação)').replace(/[[\]]/g, '')}](cite:${a.ids}${meta ? ` "${meta}"` : ''})`;
  },
});

/** Insere a citação no ponto do cursor (painel de fontes, trechos). */
export function insertCitation(ed: Editor, id: string, page = '', range?: Range) {
  const c = ed.chain().focus();
  if (range) c.deleteRange(range);
  c.insertContent([{ type: 'citation', attrs: { ids: id, page, mode: 'paren' } }, { type: 'text', text: ' ' }]).run();
}

/** Itens do menu de citação (digitar ^). "^silva 42" já põe a página. */
export function citeItems(query: string, ctx: CitationTools | null): MenuItem[] {
  if (!ctx) return [];
  const m = /^(.*?)(?:\s+(?:p\.?\s*)?(\d+(?:[-–]\d+)?))?\s*$/.exec(query);
  const q = norm((m?.[1] || '').trim());
  const page = m?.[2] || '';
  if (q.length > 60) return [];
  const all = Object.values(ctx.sources);
  const found = all
    .filter((s) => !q || norm(`${s.title} ${s.authors.map((a) => a.family).join(' ')} ${s.year || ''}`).includes(q))
    .sort((a, b) => Number(ctx.linked.includes(b.id)) - Number(ctx.linked.includes(a.id)) || shortLabel(a).localeCompare(shortLabel(b), 'pt-BR'))
    .slice(0, 8);
  const items: MenuItem[] = found.map((s) => ({
    id: `s-${s.id}`,
    label: `${shortLabel(s)}${page ? `, p. ${page}` : ''}`,
    hint: s.title.length > 34 ? `${s.title.slice(0, 32)}…` : s.title,
    icon: <BookOpen className="w-4 h-4" />,
    run: (ed, r) => insertCitation(ed, s.id, page, r),
  }));
  const typed = (m?.[1] || '').trim();
  items.push({
    id: 's-new',
    label: typed ? `Nova fonte “${typed.slice(0, 30)}”` : 'Nova fonte…',
    hint: sourceType('livro').label,
    icon: <Plus className="w-4 h-4" />,
    run: (ed, r) => {
      ed.chain().focus().deleteRange(r).run();
      void ctx.requestSource(typed).then((s) => s && insertCitation(ed, s.id, page));
    },
  });
  return items;
}

// ------------------------------------------------------------------ nota de rodapé

function FootnoteView({ node, updateAttributes, deleteNode }: NodeViewProps) {
  const [anchor, setAnchor] = useState<HTMLElement | null>(null);
  const [open, setOpen] = useState(!node.attrs.text);
  return (
    <NodeViewWrapper as="span" className="nb-fn-wrap">
      <sup ref={setAnchor} className="nb-fn" data-fn={node.attrs.text || ''} title={node.attrs.text || 'Nota de rodapé'} onClick={() => setOpen(true)} />
      {open && (
        <Pop
          anchor={anchor}
          onClose={() => {
            setOpen(false);
            if (!String(node.attrs.text || '').trim()) deleteNode();
          }}
        >
          <p className="nb-acad-pop-title">Nota de rodapé</p>
          <textarea
            autoFocus
            rows={4}
            value={node.attrs.text || ''}
            onChange={(e) => updateAttributes({ text: e.target.value.replace(/\n+/g, ' ').slice(0, 2000) })}
            placeholder="Explicação, comentário ou fonte complementar."
            className="nb-acad-area"
          />
          <div className="flex justify-end pt-1">
            <button type="button" onClick={() => deleteNode()} className="flex items-center gap-1 text-[11px] text-[var(--nb-ink-3)] hover:text-red-400">
              <Trash2 className="w-3 h-3" /> Apagar nota
            </button>
          </div>
        </Pop>
      )}
    </NodeViewWrapper>
  );
}

export const Footnote = Node.create({
  name: 'footnote',
  group: 'inline',
  inline: true,
  atom: true,
  selectable: true,
  addAttributes() {
    return { text: { default: '' } };
  },
  parseHTML() {
    return [{ tag: 'sup[data-fn]', getAttrs: (el) => ({ text: (el as HTMLElement).getAttribute('data-fn') || '' }) }];
  },
  renderHTML({ node, HTMLAttributes }) {
    return ['sup', mergeAttributes(HTMLAttributes, { 'data-fn': node.attrs.text, class: 'nb-fn' })];
  },
  addNodeView() {
    return ReactNodeViewRenderer(FootnoteView);
  },
  markdownTokenName: 'footnote',
  markdownTokenizer: {
    name: 'footnote',
    level: 'inline',
    start: (src: string) => src.indexOf('^['),
    tokenize(src: string) {
      const m = /^\^\[((?:\\\]|[^\]\n])*)\]/.exec(src);
      if (!m) return undefined;
      return { type: 'footnote', raw: m[0], text: m[1].replace(/\\\]/g, ']') };
    },
  },
  parseMarkdown(token, h) {
    return h.createNode('footnote', { text: token.text });
  },
  renderMarkdown(node: JSONContent) {
    return `^[${String(node.attrs?.text || '').replace(/\]/g, '\\]')}]`;
  },
});

// ------------------------------------------------------------------ fórmulas

function useKatex(el: HTMLElement | null, latex: string, display: boolean) {
  useEffect(() => {
    if (!el) return;
    let alive = true;
    if (!latex.trim()) {
      el.textContent = display ? 'Fórmula em bloco' : 'fórmula';
      return;
    }
    void import('katex').then((k) => {
      if (!alive) return;
      try {
        k.default.render(latex, el, { throwOnError: false, displayMode: display, output: 'html', strict: 'ignore', trust: false, maxSize: 20, maxExpand: 200 });
      } catch {
        el.textContent = latex;
      }
    });
    return () => {
      alive = false;
    };
  }, [el, latex, display]);
}

function MathView({ node, updateAttributes, deleteNode, selected }: NodeViewProps) {
  const display = node.type.name === 'mathBlock';
  const [out, setOut] = useState<HTMLElement | null>(null);
  const [prev, setPrev] = useState<HTMLElement | null>(null);
  const [anchor, setAnchor] = useState<HTMLElement | null>(null);
  const [open, setOpen] = useState(!node.attrs.latex);
  useKatex(out, node.attrs.latex || '', display);
  useKatex(open ? prev : null, node.attrs.latex || '', display);
  return (
    <NodeViewWrapper as={display ? 'div' : 'span'} className={display ? 'nb-math nb-math--block' : 'nb-math'} data-selected={selected || undefined}>
      <span ref={setAnchor} onClick={() => setOpen(true)} className="nb-math-out">
        <span ref={setOut} />
      </span>
      {open && (
        <Pop
          anchor={anchor}
          width={360}
          onClose={() => {
            setOpen(false);
            if (!String(node.attrs.latex || '').trim()) deleteNode();
          }}
        >
          <p className="nb-acad-pop-title">{display ? 'Fórmula em bloco' : 'Fórmula'} (LaTeX)</p>
          <textarea
            autoFocus
            rows={display ? 4 : 2}
            value={node.attrs.latex || ''}
            onChange={(e) => updateAttributes({ latex: e.target.value.slice(0, 4000) })}
            placeholder={display ? 'E = mc^2' : 'x^2 + y^2'}
            className="nb-acad-area font-mono"
            spellCheck={false}
          />
          <div className="nb-math-preview">
            <span ref={setPrev} />
          </div>
        </Pop>
      )}
    </NodeViewWrapper>
  );
}

export const MathInline = Node.create({
  name: 'mathInline',
  group: 'inline',
  inline: true,
  atom: true,
  selectable: true,
  addAttributes() {
    return { latex: { default: '' } };
  },
  parseHTML() {
    return [{ tag: 'span[data-math]', getAttrs: (el) => ({ latex: (el as HTMLElement).getAttribute('data-math') || '' }) }];
  },
  renderHTML({ node, HTMLAttributes }) {
    return ['span', mergeAttributes(HTMLAttributes, { 'data-math': node.attrs.latex, class: 'nb-math' }), node.attrs.latex];
  },
  addNodeView() {
    return ReactNodeViewRenderer(MathView);
  },
  markdownTokenName: 'mathInline',
  markdownTokenizer: {
    name: 'mathInline',
    level: 'inline',
    // "$" que não vem logo depois de letra ou número (evita R$ 10)
    start: (src: string) => {
      const m = /(^|[^\p{L}\p{N}$\\])\$(?=[^\s$])/u.exec(src);
      return m ? m.index + m[1].length : -1;
    },
    tokenize(src: string) {
      const m = /^\$(?=[^\s$])([^$\n]*?[^\s\\])\$(?![\p{N}])/u.exec(src);
      if (!m) return undefined;
      return { type: 'mathInline', raw: m[0], latex: m[1] };
    },
  },
  parseMarkdown(token, h) {
    return h.createNode('mathInline', { latex: token.latex });
  },
  renderMarkdown(node: JSONContent) {
    return `$${node.attrs?.latex || ''}$`;
  },
});

export const MathBlock = Node.create({
  name: 'mathBlock',
  group: 'block',
  atom: true,
  selectable: true,
  addAttributes() {
    return { latex: { default: '' } };
  },
  parseHTML() {
    return [{ tag: 'div[data-math-block]', getAttrs: (el) => ({ latex: (el as HTMLElement).getAttribute('data-math-block') || '' }) }];
  },
  renderHTML({ node, HTMLAttributes }) {
    return ['div', mergeAttributes(HTMLAttributes, { 'data-math-block': node.attrs.latex, class: 'nb-math nb-math--block' }), node.attrs.latex];
  },
  addNodeView() {
    return ReactNodeViewRenderer(MathView);
  },
  markdownTokenName: 'mathBlock',
  markdownTokenizer: {
    name: 'mathBlock',
    level: 'block',
    start: (src: string) => {
      const m = /(^|\n)\$\$/.exec(src);
      return m ? m.index + m[1].length : -1;
    },
    tokenize(src: string) {
      const m = /^\$\$\s*\n?([\s\S]+?)\n?\s*\$\$[ \t]*(?:\n|$)/.exec(src);
      if (!m) return undefined;
      return { type: 'mathBlock', raw: m[0], latex: m[1].trim() };
    },
  },
  parseMarkdown(token, h) {
    return h.createNode('mathBlock', { latex: token.latex });
  },
  renderMarkdown(node: JSONContent) {
    return `$$\n${node.attrs?.latex || ''}\n$$`;
  },
});

// ------------------------------------------------------------------ legendas

export type CaptionKind = 'figura' | 'tabela' | 'quadro' | 'grafico' | 'fonte';
const CAPTION_KINDS: CaptionKind[] = ['figura', 'tabela', 'quadro', 'grafico', 'fonte'];

export const CaptionLine = Node.create({
  name: 'captionLine',
  group: 'block',
  content: 'inline*',
  defining: true,
  addAttributes() {
    return { kind: { default: 'tabela' } };
  },
  parseHTML() {
    return [
      {
        tag: 'p[data-caption]',
        getAttrs: (el) => {
          const k = (el as HTMLElement).getAttribute('data-caption') as CaptionKind;
          return CAPTION_KINDS.includes(k) ? { kind: k } : false;
        },
      },
    ];
  },
  renderHTML({ node, HTMLAttributes }) {
    return ['p', mergeAttributes(HTMLAttributes, { 'data-caption': node.attrs.kind, class: `nb-cap nb-cap--${node.attrs.kind}` }), 0];
  },
  markdownTokenName: 'captionLine',
  markdownTokenizer: {
    name: 'captionLine',
    level: 'block',
    start: (src: string) => {
      const m = /(^|\n)\{\{(figura|tabela|quadro|grafico|fonte)\}\}/.exec(src);
      return m ? m.index + m[1].length : -1;
    },
    tokenize(src: string, _tokens, lexer) {
      const m = /^\{\{(figura|tabela|quadro|grafico|fonte)\}\}[ \t]*([^\n]*)(?:\n|$)/.exec(src);
      if (!m) return undefined;
      return { type: 'captionLine', raw: m[0], kind: m[1], tokens: lexer.inlineTokens(m[2]) };
    },
  },
  parseMarkdown(token, h) {
    return h.createNode('captionLine', { kind: token.kind }, h.parseInline(token.tokens || []));
  },
  renderMarkdown(node: JSONContent, h) {
    return `{{${node.attrs?.kind || 'tabela'}}} ${h.renderChildren(node.content || [])}`;
  },
  addKeyboardShortcuts() {
    return {
      // Enter numa legenda volta para o parágrafo comum
      Enter: ({ editor }) => {
        if (!editor.isActive('captionLine')) return false;
        return editor.chain().insertContentAt(editor.state.selection.$from.after(), { type: 'paragraph' }).focus(editor.state.selection.$from.after() + 1).run();
      },
    };
  },
});

// ------------------------------------------------------------------ atalhos

/** Ctrl+Shift+C abre o menu de citação; Ctrl+Alt+F cria nota de rodapé. */
export const AcademicKeys = Extension.create({
  name: 'academicKeys',
  addKeyboardShortcuts() {
    return {
      'Mod-Shift-c': ({ editor }) => editor.chain().focus().insertContent('^').run(),
      'Mod-Alt-f': ({ editor }) => editor.chain().focus().insertContent({ type: 'footnote', attrs: { text: '' } }).run(),
    };
  },
});

export const ACADEMIC_EXTENSIONS = [Citation, Footnote, MathInline, MathBlock, CaptionLine, AcademicKeys];

/** Itens extras do menu / no modo Artigo. */
export function academicSlashItems(): MenuItem[] {
  const ic = (C: React.ElementType) => <C className="w-4 h-4" />;
  const caption = (kind: CaptionKind, text = '') => ({ type: 'captionLine', attrs: { kind }, content: text ? [{ type: 'text', text }] : [] });
  return [
    { id: 'cite', label: 'Citar fonte', hint: '^  ou Ctrl+Shift+C', icon: ic(BookOpen), run: (e, r) => e.chain().focus().deleteRange(r).insertContent('^').run() },
    {
      id: 'longa',
      label: 'Citação longa (ABNT)',
      hint: 'mais de 3 linhas, recuo de 4 cm',
      icon: ic(BookOpen),
      run: (e, r) => e.chain().focus().deleteRange(r).insertContent({ type: 'callout', attrs: { kind: 'longa', title: '' }, content: [{ type: 'paragraph' }] }).run(),
    },
    { id: 'nota-rodape', label: 'Nota de rodapé', hint: 'Ctrl+Alt+F', icon: ic(Superscript), run: (e, r) => e.chain().focus().deleteRange(r).insertContent({ type: 'footnote', attrs: { text: '' } }).run() },
    { id: 'formula', label: 'Fórmula', hint: '$x^2$', icon: ic(Sigma), run: (e, r) => e.chain().focus().deleteRange(r).insertContent({ type: 'mathInline', attrs: { latex: '' } }).run() },
    { id: 'formula-bloco', label: 'Fórmula em bloco', hint: '$$ … $$', icon: ic(Sigma), run: (e, r) => e.chain().focus().deleteRange(r).insertContent({ type: 'mathBlock', attrs: { latex: '' } }).run() },
    {
      id: 'tabela-abnt',
      label: 'Tabela com título e fonte',
      hint: 'Tabela 1 – … / Fonte: …',
      icon: ic(Table2),
      run: (e, r) =>
        e
          .chain()
          .focus()
          .deleteRange(r)
          .insertContent(caption('tabela', 'Título da tabela'))
          .insertTable({ rows: 3, cols: 3, withHeaderRow: true })
          .run() &&
        e
          .chain()
          .insertContentAt(findAfterTable(e), [caption('fonte', 'Fonte: Elaborado pelo autor (2025).'), { type: 'paragraph' }])
          .run(),
    },
    { id: 'leg-figura', label: 'Legenda: Figura', hint: 'Figura 1 – …', icon: ic(Table2), run: (e, r) => e.chain().focus().deleteRange(r).setNode('captionLine', { kind: 'figura' }).run() },
    { id: 'leg-quadro', label: 'Legenda: Quadro', hint: 'Quadro 1 – …', icon: ic(Table2), run: (e, r) => e.chain().focus().deleteRange(r).setNode('captionLine', { kind: 'quadro' }).run() },
    { id: 'leg-grafico', label: 'Legenda: Gráfico', hint: 'Gráfico 1 – …', icon: ic(Table2), run: (e, r) => e.chain().focus().deleteRange(r).setNode('captionLine', { kind: 'grafico' }).run() },
    { id: 'leg-fonte', label: 'Fonte da ilustração', hint: 'Fonte: …', icon: ic(Table2), run: (e, r) => e.chain().focus().deleteRange(r).setNode('captionLine', { kind: 'fonte' }).insertContent('Fonte: ').run() },
  ];
}

/** posição logo depois da tabela onde está o cursor */
function findAfterTable(e: Editor) {
  const { $from } = e.state.selection;
  for (let d = $from.depth; d > 0; d--) if ($from.node(d).type.name === 'table') return $from.after(d);
  return $from.after(1);
}
