/**
 * Extensões do editor universal do Notebook (Tiptap).
 * O documento continua salvo em MARKDOWN (busca, [[ligações]], #tags, grafo e
 * publicação seguem funcionando); estas extensões ensinam o editor a ler e
 * escrever a sintaxe própria do Notebook:
 *   [[Nota]] / [[Nota|apelido]]   ligação entre notas
 *   ![[Nota]]                     incorporação
 *   > [!ideia] Título             callout (destaque)
 *   #tag                          marcação visual (texto simples)
 */
import { Extension, Mark, Node, mergeAttributes, type JSONContent } from '@tiptap/core';
import { Plugin, PluginKey } from '@tiptap/pm/state';
import { Decoration, DecorationSet } from '@tiptap/pm/view';
import type { Node as PMNode } from '@tiptap/pm/model';

// ------------------------------------------------------------------ [[ligação]]
export interface WikiLinkOptions {
  /** a nota existe? (ligações para notas que não existem ficam tracejadas) */
  exists: (title: string) => boolean;
}

export const WikiLink = Node.create<WikiLinkOptions>({
  name: 'wikiLink',
  group: 'inline',
  inline: true,
  atom: true,
  selectable: true,

  addOptions() {
    return { exists: () => true };
  },

  addAttributes() {
    return {
      target: { default: '' },
      alias: { default: null },
      embed: { default: false },
    };
  },

  parseHTML() {
    return [
      {
        tag: 'span[data-wikilink]',
        getAttrs: (el) => ({
          target: (el as HTMLElement).getAttribute('data-target') || '',
          alias: (el as HTMLElement).getAttribute('data-alias'),
          embed: (el as HTMLElement).getAttribute('data-embed') === 'true',
        }),
      },
    ];
  },

  renderHTML({ node, HTMLAttributes }) {
    const label = node.attrs.alias || node.attrs.target;
    return [
      'span',
      mergeAttributes(HTMLAttributes, {
        'data-wikilink': '',
        'data-target': node.attrs.target,
        'data-alias': node.attrs.alias ?? undefined,
        'data-embed': node.attrs.embed ? 'true' : undefined,
        class: node.attrs.embed ? 'nb-wl nb-wl--embed' : 'nb-wl',
        title: node.attrs.embed ? `Incorpora: ${node.attrs.target}` : `Abrir: ${node.attrs.target}`,
      }),
      node.attrs.embed ? `↳ ${label}` : label,
    ];
  },

  renderText({ node }) {
    return node.attrs.alias || node.attrs.target;
  },

  markdownTokenName: 'wikiLink',
  markdownTokenizer: {
    name: 'wikiLink',
    level: 'inline',
    start: (src: string) => {
      const i = src.indexOf('[[');
      if (i < 0) return -1;
      return i > 0 && src[i - 1] === '!' ? i - 1 : i;
    },
    tokenize(src: string) {
      const m = /^(!?)\[\[([^\]\n|]+?)(?:\|([^\]\n]+?))?\]\]/.exec(src);
      if (!m) return undefined;
      return { type: 'wikiLink', raw: m[0], embed: m[1] === '!', target: m[2].trim(), alias: m[3]?.trim() || null };
    },
  },
  parseMarkdown(token, h) {
    return h.createNode('wikiLink', { target: token.target, alias: token.alias, embed: !!token.embed });
  },
  renderMarkdown(node: JSONContent) {
    const a = node.attrs || {};
    return `${a.embed ? '!' : ''}[[${a.target}${a.alias ? `|${a.alias}` : ''}]]`;
  },

  addProseMirrorPlugins() {
    const exists = this.options.exists;
    const key = new PluginKey('wikiLinkMissing');
    const build = (doc: PMNode) => {
      const decos: Decoration[] = [];
      doc.descendants((n, pos) => {
        if (n.type.name === 'wikiLink' && !exists(n.attrs.target)) {
          decos.push(Decoration.node(pos, pos + n.nodeSize, { class: 'is-missing' }));
        }
      });
      return DecorationSet.create(doc, decos);
    };
    return [
      new Plugin({
        key,
        state: {
          init: (_, { doc }) => build(doc),
          apply: (tr, old) => (tr.docChanged || tr.getMeta(key) ? build(tr.doc) : old),
        },
        props: { decorations: (state) => key.getState(state) },
      }),
    ];
  },
});

// ------------------------------------------------------------------ callout
export const CALLOUT_TYPES: { id: string; label: string }[] = [
  { id: 'nota', label: 'Nota' },
  { id: 'ideia', label: 'Ideia' },
  { id: 'dica', label: 'Dica' },
  { id: 'info', label: 'Info' },
  { id: 'atencao', label: 'Atenção' },
  { id: 'perigo', label: 'Perigo' },
  { id: 'citacao', label: 'Citação' },
  { id: 'todo', label: 'A fazer' },
];

const CALLOUT_RE = /^ {0,3}> ?\[!([\w-]+)\][+-]?[ \t]*([^\n]*)(?:\n|$)((?: {0,3}>[^\n]*(?:\n|$))*)/;

export const Callout = Node.create({
  name: 'callout',
  group: 'block',
  content: 'block+',
  defining: true,

  addAttributes() {
    return {
      kind: { default: 'nota' },
      title: { default: '' },
    };
  },

  parseHTML() {
    return [
      {
        tag: 'div[data-callout]',
        getAttrs: (el) => ({
          kind: (el as HTMLElement).getAttribute('data-callout') || 'nota',
          title: (el as HTMLElement).getAttribute('data-title') || '',
        }),
      },
    ];
  },

  renderHTML({ node, HTMLAttributes }) {
    return [
      'div',
      mergeAttributes(HTMLAttributes, {
        'data-callout': node.attrs.kind,
        'data-title': node.attrs.title,
        class: `nb-rc nb-rc--${node.attrs.kind}`,
      }),
      0,
    ];
  },

  markdownTokenName: 'callout',
  markdownTokenizer: {
    name: 'callout',
    level: 'block',
    start: (src: string) => {
      const m = /(^|\n) {0,3}> ?\[!/.exec(src);
      return m ? m.index + (m[1] ? 1 : 0) : -1;
    },
    tokenize(src: string, _tokens, lexer) {
      const m = CALLOUT_RE.exec(src);
      if (!m) return undefined;
      const body = m[3]
        .split('\n')
        .map((l) => l.replace(/^ {0,3}> ?/, ''))
        .join('\n')
        .trim();
      return {
        type: 'callout',
        raw: m[0],
        kind: m[1].toLowerCase(),
        title: m[2].trim(),
        tokens: body ? lexer.blockTokens(body) : [],
      };
    },
  },
  parseMarkdown(token, h) {
    const children = h.parseChildren(token.tokens || []);
    return h.createNode('callout', { kind: token.kind, title: token.title }, children.length ? children : [h.createNode('paragraph', {}, [])]);
  },
  renderMarkdown(node: JSONContent, h) {
    const a = node.attrs || {};
    const head = `> [!${a.kind || 'nota'}]${a.title ? ` ${a.title}` : ''}`;
    const body = h.renderChildren(node.content || [], '\n\n').trim();
    const lines = body ? body.split('\n').map((l) => (l ? `> ${l}` : '>')) : [];
    return [head, ...lines].join('\n');
  },
});

// ------------------------------------------------------------------ #tags
export const TagHighlight = Extension.create({
  name: 'tagHighlight',
  addProseMirrorPlugins() {
    const key = new PluginKey('tagHighlight');
    const RE = /(^|[\s(])#([\p{L}\p{N}_/-]*\p{L}[\p{L}\p{N}_/-]*)/gu;
    const build = (doc: PMNode) => {
      const decos: Decoration[] = [];
      doc.descendants((n, pos, parent) => {
        if (!n.isText || !n.text) return;
        if (parent?.type.name === 'codeBlock' || n.marks.some((m) => m.type.name === 'code')) return;
        RE.lastIndex = 0;
        let m: RegExpExecArray | null;
        while ((m = RE.exec(n.text))) {
          const from = pos + m.index + m[1].length;
          decos.push(Decoration.inline(from, from + m[2].length + 1, { class: 'nb-rtag', 'data-tag': m[2] }));
        }
      });
      return DecorationSet.create(doc, decos);
    };
    return [
      new Plugin({
        key,
        state: {
          init: (_, { doc }) => build(doc),
          apply: (tr, old) => (tr.docChanged ? build(tr.doc) : old),
        },
        props: { decorations: (state) => key.getState(state) },
      }),
    ];
  },
});

// ------------------------------------------------------------------ frontmatter
/** Separa o bloco de propriedades (--- ... ---) do corpo em markdown. */
export function splitFrontmatter(md: string): { props: [string, string][]; body: string; raw: string } {
  const m = /^---\n([\s\S]*?)\n---\n?/.exec(md || '');
  if (!m) return { props: [], body: md || '', raw: '' };
  const props: [string, string][] = [];
  for (const line of m[1].split('\n')) {
    const p = /^\s*([^:]+?)\s*:\s*(.*)$/.exec(line);
    if (p) props.push([p[1], p[2]]);
  }
  return { props, body: md.slice(m[0].length).replace(/^\n+/, ''), raw: m[0] };
}

export function joinFrontmatter(props: [string, string][], body: string): string {
  const kept = props.filter(([k]) => k.trim());
  if (!kept.length) return body;
  return `---\n${kept.map(([k, v]) => `${k.trim()}: ${v}`).join('\n')}\n---\n\n${body}`;
}

// ------------------------------------------------------------------ menções
/**
 * Trecho ligado a uma entrada do Sumário. Em markdown vira um link com
 * esquema próprio: [texto](ref:<uuid> "tipo").
 */
export const EntryRef = Mark.create({
  name: 'entryRef',
  inclusive: false,

  addAttributes() {
    return {
      id: { default: null },
      kind: { default: 'elemento' },
    };
  },

  parseHTML() {
    return [
      {
        tag: 'span[data-ref]',
        getAttrs: (el) => {
          const id = (el as HTMLElement).getAttribute('data-ref') || '';
          if (!/^[0-9a-f-]{36}$/i.test(id)) return false;
          const kind = (el as HTMLElement).getAttribute('data-kind') || 'elemento';
          return { id, kind: ['elemento', 'nota_autor', 'aviso'].includes(kind) ? kind : 'elemento' };
        },
      },
    ];
  },

  renderHTML({ mark, HTMLAttributes }) {
    return [
      'span',
      mergeAttributes(HTMLAttributes, {
        'data-ref': mark.attrs.id,
        'data-kind': mark.attrs.kind,
        class: `nb-ref nb-ref--${mark.attrs.kind}`,
      }),
      0,
    ];
  },

  markdownTokenName: 'entryRef',
  markdownTokenizer: {
    name: 'entryRef',
    level: 'inline',
    start: (src: string) => {
      const m = /\[[^\]\n]+\]\(ref:/.exec(src);
      return m ? m.index : -1;
    },
    tokenize(src: string, _tokens, lexer) {
      const m = /^\[([^\]\n]+)\]\(ref:([0-9a-f-]{36})(?:\s+"(elemento|nota_autor|aviso)")?\)/i.exec(src);
      if (!m) return undefined;
      return { type: 'entryRef', raw: m[0], text: m[1], id: m[2].toLowerCase(), kind: m[3] || 'elemento', tokens: lexer.inlineTokens(m[1]) };
    },
  },
  parseMarkdown(token, h) {
    return h.applyMark('entryRef', h.parseInline(token.tokens || []), { id: token.id, kind: token.kind });
  },
  renderMarkdown(node: JSONContent, h) {
    const a = node.attrs || {};
    return `[${h.renderChildren(node)}](ref:${a.id}${a.kind && a.kind !== 'elemento' ? ` "${a.kind}"` : ''})`;
  },
});
