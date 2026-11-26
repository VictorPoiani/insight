/**
 * Extensões de diagramação (Fase 4): ilustração com layout e legenda,
 * quebra de página do modo livro e o modo poesia.
 */
import { Extension, Node, mergeAttributes, type JSONContent } from '@tiptap/core';
import Image from '@tiptap/extension-image';
import { TextSelection } from '@tiptap/pm/state';

export type FigureLayout = 'center' | 'full' | 'wide' | 'left' | 'right';
export const FIGURE_LAYOUTS: { id: FigureLayout; label: string }[] = [
  { id: 'center', label: 'Centralizada' },
  { id: 'full', label: 'Largura do texto' },
  { id: 'wide', label: 'Sangria (página toda)' },
  { id: 'left', label: 'À esquerda, com texto ao lado' },
  { id: 'right', label: 'À direita, com texto ao lado' },
];
export const FIGURE_WIDTHS = [30, 40, 50, 60, 70, 80, 90, 100];

const layoutOf = (v: unknown): FigureLayout => (['center', 'full', 'wide', 'left', 'right'].includes(String(v)) ? (v as FigureLayout) : 'center');
const widthOf = (v: unknown) => {
  const n = Number(v);
  return FIGURE_WIDTHS.includes(n) ? n : 100;
};

/** Título do markdown da imagem: "Legenda|layout|largura". */
function parseTitle(title: string | null | undefined) {
  const [caption = '', layout, width] = String(title || '').split('|');
  return { caption: caption.trim(), layout: layoutOf(layout), width: widthOf(width) };
}

/** Imagem com legenda, alinhamento e largura (livro, poesia e notas). */
export const Illustration = Image.extend({
  name: 'image',
  addAttributes() {
    return {
      ...this.parent?.(),
      caption: { default: '' },
      layout: { default: 'center' },
      width: { default: 100 },
    };
  },
  parseHTML() {
    return [
      {
        tag: 'figure[data-figure]',
        priority: 60,
        getAttrs: (el) => {
          const f = el as HTMLElement;
          const img = f.querySelector('img');
          if (!img?.getAttribute('src')) return false;
          return {
            src: img.getAttribute('src'),
            alt: img.getAttribute('alt') || '',
            caption: f.querySelector('figcaption')?.textContent || '',
            layout: layoutOf(f.getAttribute('data-layout')),
            width: widthOf(f.getAttribute('data-width')),
          };
        },
      },
      { tag: 'img[src]' },
    ];
  },
  renderHTML({ node, HTMLAttributes }) {
    const { caption, layout, width, src, alt } = node.attrs;
    const img = ['img', mergeAttributes({ src, alt: alt || '' }, HTMLAttributes.title ? { title: HTMLAttributes.title } : {})];
    return [
      'figure',
      { 'data-figure': '', 'data-layout': layoutOf(layout), 'data-width': String(widthOf(width)), class: 'nb-fig' },
      img,
      ...(caption ? [['figcaption', {}, caption]] : []),
    ] as unknown as ReturnType<NonNullable<ReturnType<typeof Image.extend>['config']['renderHTML']>>;
  },
  parseMarkdown(token, h) {
    const t = parseTitle(token.title);
    return h.createNode('image', { src: token.href, alt: token.text || '', ...t });
  },
  renderMarkdown(node: JSONContent) {
    const a = node.attrs || {};
    const extra = a.layout && a.layout !== 'center' ? `|${a.layout}|${a.width || 100}` : a.width && a.width !== 100 ? `|center|${a.width}` : '';
    const title = a.caption || extra ? ` "${String(a.caption || '').replace(/"/g, '”')}${extra}"` : '';
    return `![${a.alt || ''}](${a.src}${title})`;
  },
});

/** Quebra de página do modo livro. */
export const PageBreak = Node.create({
  name: 'pageBreak',
  group: 'block',
  atom: true,
  selectable: true,
  parseHTML() {
    return [{ tag: 'hr[data-page-break]', priority: 60 }];
  },
  renderHTML({ HTMLAttributes }) {
    return ['hr', mergeAttributes(HTMLAttributes, { 'data-page-break': 'true', class: 'nb-pagebreak' })];
  },
  addCommands() {
    return {
      insertPageBreak:
        () =>
        ({ state, chain }) => {
          // depois do bloco onde está o cursor
          const { $from } = state.selection;
          const at = $from.depth >= 1 ? $from.after(1) : state.selection.to;
          return chain()
            .insertContentAt(at, [{ type: 'pageBreak' }, { type: 'paragraph' }])
            .command(({ tr }) => {
              const pos = Math.min(at + 2, tr.doc.content.size);
              tr.setSelection(TextSelection.near(tr.doc.resolve(pos)));
              return true;
            })
            .scrollIntoView()
            .run();
        },
    };
  },
  addKeyboardShortcuts() {
    return { 'Mod-Shift-Enter': () => this.editor.commands.insertPageBreak() };
  },
});

declare module '@tiptap/core' {
  interface Commands<ReturnType> {
    pageBreak: { insertPageBreak: () => ReturnType };
  }
}

/**
 * Modo poesia: Enter quebra o verso (mesma estrofe); Enter numa linha vazia
 * (ou Shift+Enter) começa uma nova estrofe.
 */
export const PoemKeys = Extension.create({
  name: 'poemKeys',
  priority: 900,
  addKeyboardShortcuts() {
    return {
      Enter: ({ editor }) => {
        const { state } = editor;
        const { $from, empty } = state.selection;
        if (!empty || $from.parent.type.name !== 'paragraph') return false;
        const before = $from.nodeBefore;
        if (before?.type.name === 'hardBreak') {
          // linha vazia: tira a quebra e abre nova estrofe
          return editor
            .chain()
            .command(({ tr }) => {
              tr.delete($from.pos - before.nodeSize, $from.pos);
              return true;
            })
            .splitBlock()
            .run();
        }
        if ($from.parent.content.size === 0) return false;
        return editor.commands.setHardBreak();
      },
      'Shift-Enter': ({ editor }) => editor.commands.splitBlock(),
    };
  },
});
