'use client';

import { useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { ACADEMIC_EXTENSIONS, CitationContext, academicSlashItems, citeItems } from './academic';
import { createPortal } from 'react-dom';
import { Extension, type Editor, type Range } from '@tiptap/core';
import { PluginKey } from '@tiptap/pm/state';
import { useEditor, EditorContent } from '@tiptap/react';
import { BubbleMenu } from '@tiptap/react/menus';
import StarterKit from '@tiptap/starter-kit';
import { Markdown } from '@tiptap/markdown';
import Highlight from '@tiptap/extension-highlight';
import { TaskList, TaskItem } from '@tiptap/extension-list';
import { TableKit } from '@tiptap/extension-table';
import { Placeholder } from '@tiptap/extensions';
import Suggestion, { type SuggestionKeyDownProps, type SuggestionProps } from '@tiptap/suggestion';
import {
  Bold,
  Code,
  Code2,
  Columns3,
  Heading1,
  Heading2,
  Heading3,
  Highlighter,
  ImagePlus,
  Italic,
  Link2,
  List,
  ListChecks,
  ListOrdered,
  Loader2,
  Minus,
  MessageSquareQuote,
  Pilcrow,
  Plus,
  Quote,
  Redo2,
  Rows3,
  SquareSplitHorizontal,
  Strikethrough,
  Table2,
  Trash2,
  Undo2,
  X,
} from 'lucide-react';
import { uploadMediaToInsight } from '@/lib/mediaCompressor';
import { getUserUploadLimitBytes } from '@/lib/contributorLevels';
import type { NotebookItem } from '@/lib/notebook/types';
import { Glyph } from '../icons/Glyph';
import type { GlyphName } from '@/lib/notebook/glyphs';
import { CALLOUT_TYPES, Callout, EntryRef, TagHighlight, WikiLink, joinFrontmatter, splitFrontmatter } from './extensions';
import { Illustration, PoemKeys } from './bookExtensions';
import { ImageBar } from './ImageBar';
import { useEditorTick } from './useEditorTick';
import { useNotebookLinks, type NotebookLinks } from './linkContext';
import { MENTION_TRIGGER } from '@/lib/notebook/copy';
import { entryLook } from '@/lib/notebook/entries';

export interface RichNoteEditorProps {
  item: NotebookItem;
  titles: string[];
  titleExists: (t: string) => boolean;
  onChange: (content: string) => void;
  onOpenLink: (title: string) => void;
  onTag: (tag: string) => void;
  onAsset: (r2Key: string | null, url: string) => void;
  role?: string | null;
  level?: number | null;
  jumpTo?: { line: number; at: number } | null;
  /** modo poesia: Enter quebra o verso, linha vazia abre estrofe */
  variant?: 'poem' | 'article';
}

// ------------------------------------------------------------------ menus de sugestão
export type MenuItem = { id: string; label: string; hint?: string; icon: React.ReactNode; run: (editor: Editor, range: Range) => void };
export type MenuState = {
  kind: 'slash' | 'link' | 'mention' | 'cite';
  items: MenuItem[];
  index: number;
  rect: DOMRect | null;
  run: (item: MenuItem) => void;
} | null;

const CALLOUT_GLYPH: Record<string, GlyphName> = {
  nota: 'pen',
  segredo: 'lock',
  checagem: 'alert',
  ideia: 'idea',
  dica: 'sparkle',
  info: 'info',
  atencao: 'alert',
  perigo: 'cross',
  citacao: 'quote',
  todo: 'todo',
};

function slashItems(upload: () => void): MenuItem[] {
  const ic = (C: React.ElementType) => <C className="w-4 h-4" />;
  const base: MenuItem[] = [
    { id: 'p', label: 'Texto', hint: 'parágrafo comum', icon: ic(Pilcrow), run: (e, r) => e.chain().focus().deleteRange(r).setParagraph().run() },
    { id: 'h1', label: 'Título 1', hint: '#', icon: ic(Heading1), run: (e, r) => e.chain().focus().deleteRange(r).setHeading({ level: 1 }).run() },
    { id: 'h2', label: 'Título 2', hint: '##', icon: ic(Heading2), run: (e, r) => e.chain().focus().deleteRange(r).setHeading({ level: 2 }).run() },
    { id: 'h3', label: 'Título 3', hint: '###', icon: ic(Heading3), run: (e, r) => e.chain().focus().deleteRange(r).setHeading({ level: 3 }).run() },
    { id: 'ul', label: 'Lista', hint: '-', icon: ic(List), run: (e, r) => e.chain().focus().deleteRange(r).toggleBulletList().run() },
    { id: 'ol', label: 'Lista numerada', hint: '1.', icon: ic(ListOrdered), run: (e, r) => e.chain().focus().deleteRange(r).toggleOrderedList().run() },
    { id: 'todo', label: 'Tarefas', hint: '[ ]', icon: ic(ListChecks), run: (e, r) => e.chain().focus().deleteRange(r).toggleTaskList().run() },
    { id: 'quote', label: 'Citação', hint: '>', icon: ic(Quote), run: (e, r) => e.chain().focus().deleteRange(r).toggleBlockquote().run() },
    {
      id: 'table',
      label: 'Tabela',
      hint: '3 × 3',
      icon: ic(Table2),
      run: (e, r) => e.chain().focus().deleteRange(r).insertTable({ rows: 3, cols: 3, withHeaderRow: true }).run(),
    },
    { id: 'code', label: 'Bloco de código', hint: '```', icon: ic(Code2), run: (e, r) => e.chain().focus().deleteRange(r).toggleCodeBlock().run() },
    { id: 'hr', label: 'Divisor', hint: '---', icon: ic(Minus), run: (e, r) => e.chain().focus().deleteRange(r).setHorizontalRule().run() },
    { id: 'img', label: 'Imagem', hint: 'enviar arquivo', icon: ic(ImagePlus), run: (e, r) => (e.chain().focus().deleteRange(r).run(), upload()) },
    {
      id: 'link',
      label: 'Ligação para nota',
      hint: '[[ ]]',
      icon: <Glyph name="mindmap" className="text-[16px]" />,
      run: (e, r) => e.chain().focus().deleteRange(r).insertContent('[[').run(),
    },
  ];
  const callouts: MenuItem[] = CALLOUT_TYPES.map((c) => ({
    id: `c-${c.id}`,
    label: `Destaque: ${c.label}`,
    hint: `> [!${c.id}]`,
    icon: <Glyph name={CALLOUT_GLYPH[c.id] || 'note'} className="text-[16px]" />,
    run: (e, r) =>
      e
        .chain()
        .focus()
        .deleteRange(r)
        .insertContent({ type: 'callout', attrs: { kind: c.id, title: c.label }, content: [{ type: 'paragraph' }] })
        .run(),
  }));
  return [...base, ...callouts];
}

const norm = (s: string) =>
  s
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '');

/** Itens do menu de menções (digitar + no texto). */
export function mentionItems(query: string, links: NotebookLinks): MenuItem[] {
  const q = norm(query.trim());
  if (q.length > 40) return [];
  const all = Object.values(links.entries).filter((e) => e.kind === 'elemento');
  const found = all
    .filter((e) => !q || norm(e.title).includes(q) || e.aliases.some((a) => norm(a).includes(q)))
    .sort((a, b) => Number(norm(b.title).startsWith(q)) - Number(norm(a.title).startsWith(q)) || a.title.localeCompare(b.title, 'pt-BR'))
    .slice(0, 8);
  const items: MenuItem[] = found.map((e) => {
    const look = entryLook(e);
    return {
      id: `m-${e.id}`,
      label: e.title,
      hint: look.label,
      icon: e.image_url ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={e.image_url} alt="" className="w-full h-full rounded-md object-cover" />
      ) : (
        <span style={{ color: look.color }} className="text-[15px] leading-none">
          <Glyph name={look.glyph} />
        </span>
      ),
      run: (ed, r) =>
        ed
          .chain()
          .focus()
          .deleteRange(r)
          .insertContent([
            { type: 'text', text: e.title, marks: [{ type: 'entryRef', attrs: { id: e.id, kind: e.kind } }] },
            { type: 'text', text: ' ' },
          ])
          .run(),
    };
  });
  const typed = query.trim();
  if (typed && !all.some((e) => norm(e.title) === q)) {
    items.push({
      id: 'm-new',
      label: `Criar menção “${typed}”`,
      hint: 'nova',
      icon: <Plus className="w-4 h-4" />,
      run: (ed, r) => {
        ed.chain().focus().deleteRange(r).run();
        void links.requestEntry(typed).then((res) => {
          if (!res) return;
          ed.chain()
            .focus()
            .insertContent([
              { type: 'text', text: links.entries[res.id]?.title || typed, marks: [{ type: 'entryRef', attrs: res }] },
              { type: 'text', text: ' ' },
            ])
            .run();
        });
      },
    });
  }
  return items;
}

/** Extensão genérica: liga um menu de sugestão (/ ou [[) ao estado React. */
export function makeSuggest(
  name: string,
  char: string,
  getItems: (query: string) => MenuItem[],
  kind: 'slash' | 'link' | 'mention' | 'cite',
  setMenu: React.MutableRefObject<(m: MenuState | ((p: MenuState) => MenuState)) => void>,
  menuRef: React.MutableRefObject<MenuState>
) {
  return Extension.create({
    name,
    // antes dos atalhos padrão (Enter, setas) para o menu poder capturá-los
    priority: 1000,
    addProseMirrorPlugins() {
      return [
        Suggestion<MenuItem, MenuItem>({
          editor: this.editor,
          pluginKey: new PluginKey(name),
          char,
          allowSpaces: kind !== 'slash',
          startOfLine: false,
          items: ({ query }) => getItems(query),
          command: ({ editor, range, props }) => props.run(editor, range),
          render: () => {
            let last: SuggestionProps<MenuItem, MenuItem> | null = null;
            const open = (p: SuggestionProps<MenuItem, MenuItem>) => {
              last = p;
              setMenu.current({
                kind,
                items: p.items,
                index: 0,
                rect: p.clientRect?.() || null,
                run: (it) => p.command(it),
              });
            };
            return {
              onStart: open,
              onUpdate: (p) => {
                last = p;
                setMenu.current((prev) => ({
                  kind,
                  items: p.items,
                  index: prev && prev.kind === kind ? Math.min(prev.index, Math.max(0, p.items.length - 1)) : 0,
                  rect: p.clientRect?.() || null,
                  run: (it) => p.command(it),
                }));
              },
              onKeyDown: ({ event }: SuggestionKeyDownProps) => {
                const m = menuRef.current;
                if (!m || !m.items.length) return false;
                if (event.key === 'ArrowDown') {
                  setMenu.current({ ...m, index: (m.index + 1) % m.items.length });
                  return true;
                }
                if (event.key === 'ArrowUp') {
                  setMenu.current({ ...m, index: (m.index - 1 + m.items.length) % m.items.length });
                  return true;
                }
                if (event.key === 'Enter' || event.key === 'Tab') {
                  const it = m.items[m.index];
                  if (it && last) last.command(it);
                  return true;
                }
                if (event.key === 'Escape') {
                  setMenu.current(null);
                  return true;
                }
                return false;
              },
              onExit: () => {
                last = null;
                setMenu.current(null);
              },
            };
          },
        }),
      ];
    },
  });
}

/** Ctrl+Enter marca/desmarca a tarefa da linha (ou transforma a linha em tarefa). */
const TaskToggle = Extension.create({
  name: 'taskToggle',
  addKeyboardShortcuts() {
    return {
      'Mod-Enter': ({ editor }) => {
        if (editor.isActive('taskItem')) {
          const { $from } = editor.state.selection;
          for (let d = $from.depth; d > 0; d--) {
            const n = $from.node(d);
            if (n.type.name === 'taskItem') {
              const pos = $from.before(d);
              editor.view.dispatch(editor.state.tr.setNodeMarkup(pos, undefined, { ...n.attrs, checked: !n.attrs.checked }));
              return true;
            }
          }
        }
        return editor.chain().focus().toggleTaskList().run();
      },
    };
  },
});

// ------------------------------------------------------------------ componente
export function RichNoteEditor({ item, titles, titleExists, onChange, onOpenLink, onTag, onAsset, role, level, jumpTo, variant }: RichNoteEditorProps) {
  const citeTools = useContext(CitationContext);
  const citeRef = useRef(citeTools);
  citeRef.current = citeTools;
  const initial = useMemo(() => splitFrontmatter(item.content || ''), [item.id]); // eslint-disable-line react-hooks/exhaustive-deps
  const [props, setProps] = useState<[string, string][]>(initial.props);
  const propsRef = useRef(props);
  propsRef.current = props;

  const [menu, setMenuState] = useState<MenuState>(null);
  const menuRef = useRef<MenuState>(null);
  const setMenu = useRef<(m: MenuState | ((p: MenuState) => MenuState)) => void>(() => {});
  setMenu.current = (m) => {
    const next = typeof m === 'function' ? m(menuRef.current) : m;
    menuRef.current = next;
    setMenuState(next);
  };

  const [uploading, setUploading] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const titlesRef = useRef(titles);
  const links = useNotebookLinks();
  const linksRef = useRef(links);
  linksRef.current = links;
  titlesRef.current = titles;
  const existsRef = useRef(titleExists);
  existsRef.current = titleExists;
  const onChangeRef = useRef(onChange);
  onChangeRef.current = onChange;

  const saveTimer = useRef<number | null>(null);
  const editorRef = useRef<Editor | null>(null);
  const lastSaved = useRef(item.content || '');

  const flush = useCallback(() => {
    const ed = editorRef.current;
    if (!ed) return;
    if (saveTimer.current) window.clearTimeout(saveTimer.current);
    saveTimer.current = null;
    const md = joinFrontmatter(propsRef.current, ed.getMarkdown().replace(/\n{3,}/g, '\n\n').trimEnd() + '\n');
    if (md !== lastSaved.current) {
      lastSaved.current = md;
      onChangeRef.current(md);
    }
  }, []);
  const schedule = useCallback(() => {
    if (saveTimer.current) window.clearTimeout(saveTimer.current);
    saveTimer.current = window.setTimeout(flush, 350);
  }, [flush]);

  const upload = useCallback(
    async (files: File[]) => {
      const ed = editorRef.current;
      if (!ed || !files.length) return;
      setUploading(true);
      try {
        for (const f of files) {
          const res = await uploadMediaToInsight(f, {
            budgetBytes: getUserUploadLimitBytes(level ?? 0, role ?? undefined),
            asImage: f.type.startsWith('image/') && f.type !== 'image/gif',
            scope: 'notebook',
          });
          onAsset(res.r2Key, res.publicUrl);
          ed.chain().focus().setImage({ src: res.publicUrl, alt: f.name.replace(/\.[^.]+$/, '') }).run();
        }
      } catch (err) {
        alert(err instanceof Error ? err.message : 'Falha no envio da imagem.');
      }
      setUploading(false);
    },
    [level, role, onAsset]
  );
  const pickImage = useCallback(() => fileRef.current?.click(), []);

  const extensions = useMemo(() => {
    const linkItems = (query: string): MenuItem[] => {
      const q = norm(query.trim());
      const found = titlesRef.current.filter((t) => !q || norm(t).includes(q)).slice(0, 8);
      const items: MenuItem[] = found.map((t) => ({
        id: `t-${t}`,
        label: t,
        icon: <Glyph name="note" className="text-[15px]" />,
        run: (e, r) => e.chain().focus().deleteRange(r).insertContent([{ type: 'wikiLink', attrs: { target: t } }, { type: 'text', text: ' ' }]).run(),
      }));
      const typed = query.replace(/\]+$/, '').trim();
      if (typed && !titlesRef.current.some((t) => norm(t) === norm(typed))) {
        items.push({
          id: 'new',
          label: `Criar “${typed}”`,
          hint: 'nova nota',
          icon: <Plus className="w-4 h-4" />,
          run: (e, r) => e.chain().focus().deleteRange(r).insertContent([{ type: 'wikiLink', attrs: { target: typed } }, { type: 'text', text: ' ' }]).run(),
        });
      }
      return items;
    };
    const slash = variant === 'article' ? [...slashItems(pickImage), ...academicSlashItems()] : slashItems(pickImage);
    const slashFilter = (query: string) => {
      const q = norm(query);
      return slash.filter((s) => !q || norm(s.label).includes(q) || s.id.includes(q)).slice(0, 14);
    };
    return [
      StarterKit.configure({
        underline: false,
        link: { openOnClick: false, autolink: true, defaultProtocol: 'https' },
        heading: { levels: [1, 2, 3, 4] },
      }),
      Highlight,
      TaskList,
      TaskItem.configure({ nested: true }),
      TableKit.configure({ table: { resizable: false } }),
      Illustration.configure({ inline: false }),
      EntryRef,
      ...(variant === 'poem' ? [PoemKeys] : []),
      ...(variant === 'article' ? [...ACADEMIC_EXTENSIONS, makeSuggest('citeMenu', '^', (q) => citeItems(q, citeRef.current), 'cite', setMenu, menuRef)] : []),
      Placeholder.configure({
        placeholder: ({ node }) => (node.type.name === 'heading' ? 'Título' : 'Escreva, ou digite / para comandos e [[ para ligar notas'),
      }),
      Markdown,
      WikiLink.configure({ exists: (t: string) => existsRef.current(t) }),
      Callout,
      TagHighlight,
      TaskToggle,
      makeSuggest('slashMenu', '/', slashFilter, 'slash', setMenu, menuRef),
      makeSuggest('linkMenu', '[[', linkItems, 'link', setMenu, menuRef),
      makeSuggest('mentionMenu', MENTION_TRIGGER, (q) => mentionItems(q, linksRef.current), 'mention', setMenu, menuRef),
    ];
  }, [pickImage, variant]);

  const editor = useEditor({
    extensions,
    content: initial.body,
    contentType: 'markdown',
    immediatelyRender: false,
    editorProps: {
      attributes: { class: variant === 'poem' ? 'nb-rich-doc nb-poem' : 'nb-rich-doc', spellcheck: 'true' },
      handleClickOn: (_view, _pos, node, _nodePos, event) => {
        if (node.type.name === 'wikiLink') {
          event.preventDefault();
          onOpenLink(node.attrs.target);
          return true;
        }
        return false;
      },
      handleDOMEvents: {
        click: (_view, event) => {
          const el = (event.target as HTMLElement)?.closest?.('.nb-rtag') as HTMLElement | null;
          if (el && (event.ctrlKey || event.metaKey)) {
            onTag(el.dataset.tag || '');
            return true;
          }
          const a = (event.target as HTMLElement)?.closest?.('a[href]') as HTMLAnchorElement | null;
          if (a && (event.ctrlKey || event.metaKey)) {
            window.open(a.href, '_blank', 'noopener,noreferrer');
            return true;
          }
          return false;
        },
      },
      handlePaste: (_view, event) => {
        const files = Array.from(event.clipboardData?.files || []).filter((f) => f.type.startsWith('image/'));
        if (!files.length) return false;
        void upload(files);
        return true;
      },
      handleDrop: (_view, event) => {
        const files = Array.from((event as DragEvent).dataTransfer?.files || []).filter((f) => f.type.startsWith('image/'));
        if (!files.length) return false;
        event.preventDefault();
        void upload(files);
        return true;
      },
    },
    onUpdate: () => schedule(),
  });
  editorRef.current = editor;
  const showTextMenu = useCallback(
    ({ editor: e, from, to }: { editor: Editor; from: number; to: number }) => from !== to && !e.isActive('codeBlock') && !e.isActive('image'),
    []
  );
  const showImageMenu = useCallback(({ editor: e }: { editor: Editor }) => e.isActive('image'), []);

  // salva ao sair (só se houver edição pendente: recarregar o editor depois de
  // uma restauração/marcação não pode regravar o texto antigo)
  useEffect(
    () => () => {
      if (saveTimer.current) flush();
    },
    [flush]
  );

  // títulos mudaram: recalcula ligações tracejadas
  useEffect(() => {
    if (!editor) return;
    editor.view.dispatch(editor.state.tr.setMeta(new PluginKey('wikiLinkMissing'), true));
  }, [editor, titles]);

  // pular para uma linha (busca / sumário): acha o texto daquela linha no documento
  useEffect(() => {
    if (!editor || !jumpTo) return;
    const lines = (item.content || '').split('\n');
    const raw = (lines[jumpTo.line] || '').replace(/^[#>\-*\d.\s[\]x!]+/i, '').replace(/[*_=`~]/g, '').trim();
    if (!raw) return;
    let target = -1;
    editor.state.doc.descendants((n, pos) => {
      if (target >= 0) return false;
      if (n.isTextblock && n.textContent.includes(raw.slice(0, 60))) target = pos + 1;
      return true;
    });
    if (target >= 0) {
      editor.chain().focus().setTextSelection(target).scrollIntoView().run();
    }
  }, [editor, jumpTo]); // eslint-disable-line react-hooks/exhaustive-deps

  const updateProps = (next: [string, string][]) => {
    propsRef.current = next;
    setProps(next);
    schedule();
  };

  if (!editor) {
    return (
      <div className="py-10 grid place-items-center text-[var(--nb-ink-3)]">
        <Loader2 className="w-5 h-5 animate-spin" />
      </div>
    );
  }

  const inTable = editor.isActive('table');

  return (
    <div className="nb-rich">
      <input
        ref={fileRef}
        type="file"
        accept="image/*"
        multiple
        hidden
        onChange={(e) => {
          void upload(Array.from(e.target.files || []));
          e.target.value = '';
        }}
      />

      {props.length > 0 && <Properties props={props} onChange={updateProps} />}

      <Toolbar editor={editor} uploading={uploading} onImage={pickImage} onAddProp={() => updateProps([...props, ['', '']])} />

      {inTable && <TableBar editor={editor} />}

      <BubbleMenu editor={editor} shouldShow={showTextMenu}>
        <SelectionMenu editor={editor} />
      </BubbleMenu>
      <BubbleMenu pluginKey="imageBar" editor={editor} shouldShow={showImageMenu}>
        <ImageBar editor={editor} />
      </BubbleMenu>

      <EditorContent editor={editor} />

      {menu && menu.items.length > 0 && <SuggestMenu menu={menu} onHover={(i) => setMenu.current({ ...menu, index: i })} />}
    </div>
  );
}

// ------------------------------------------------------------------ peças
function Btn({
  label,
  active,
  disabled,
  onClick,
  children,
}: {
  label: string;
  active?: boolean;
  disabled?: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      title={label}
      aria-label={label}
      aria-pressed={active}
      disabled={disabled}
      onMouseDown={(e) => e.preventDefault()}
      onClick={onClick}
      className={`h-8 min-w-8 px-1.5 grid place-items-center rounded-md transition-colors disabled:opacity-30 [&>svg]:w-4 [&>svg]:h-4 ${
        active ? 'bg-[var(--nb-hl-soft)] text-[var(--nb-hl)]' : 'text-[var(--nb-ink-3)] hover:text-[var(--nb-ink)] hover:bg-[var(--nb-pane-2)]'
      }`}
    >
      {children}
    </button>
  );
}

const Sep = () => <span className="w-px h-5 mx-1 bg-[var(--nb-line)] shrink-0" aria-hidden />;

function Toolbar({ editor, uploading, onImage, onAddProp }: { editor: Editor; uploading: boolean; onImage: () => void; onAddProp: () => void }) {
  const [, force] = useState(0);
  useEffect(() => {
    const f = () => force((n) => n + 1);
    editor.on('transaction', f);
    return () => {
      editor.off('transaction', f);
    };
  }, [editor]);
  const c = () => editor.chain().focus();
  const level = [1, 2, 3].find((l) => editor.isActive('heading', { level: l }));
  return (
    <div className="nb-rich-toolbar" role="toolbar" aria-label="Formatação">
      <select
        aria-label="Estilo do texto"
        value={level ? `h${level}` : 'p'}
        onChange={(e) => {
          const v = e.target.value;
          if (v === 'p') c().setParagraph().run();
          else c().setHeading({ level: Number(v.slice(1)) as 1 | 2 | 3 }).run();
        }}
        className="h-8 pl-2 pr-1 rounded-md bg-transparent text-[12px] font-semibold text-[var(--nb-ink-2)] hover:bg-[var(--nb-pane-2)] outline-none"
      >
        <option value="p">Texto</option>
        <option value="h1">Título 1</option>
        <option value="h2">Título 2</option>
        <option value="h3">Título 3</option>
      </select>
      <Sep />
      <Btn label="Negrito (Ctrl+B)" active={editor.isActive('bold')} onClick={() => c().toggleBold().run()}>
        <Bold />
      </Btn>
      <Btn label="Itálico (Ctrl+I)" active={editor.isActive('italic')} onClick={() => c().toggleItalic().run()}>
        <Italic />
      </Btn>
      <Btn label="Tachado (Ctrl+Shift+S)" active={editor.isActive('strike')} onClick={() => c().toggleStrike().run()}>
        <Strikethrough />
      </Btn>
      <Btn label="Marca-texto (Ctrl+Shift+H)" active={editor.isActive('highlight')} onClick={() => c().toggleHighlight().run()}>
        <Highlighter />
      </Btn>
      <Btn label="Código (Ctrl+E)" active={editor.isActive('code')} onClick={() => c().toggleCode().run()}>
        <Code />
      </Btn>
      <Sep />
      <Btn label="Lista (Ctrl+Shift+8)" active={editor.isActive('bulletList')} onClick={() => c().toggleBulletList().run()}>
        <List />
      </Btn>
      <Btn label="Lista numerada (Ctrl+Shift+7)" active={editor.isActive('orderedList')} onClick={() => c().toggleOrderedList().run()}>
        <ListOrdered />
      </Btn>
      <Btn label="Tarefas (Ctrl+Enter)" active={editor.isActive('taskList')} onClick={() => c().toggleTaskList().run()}>
        <ListChecks />
      </Btn>
      <Btn label="Citação (Ctrl+Shift+B)" active={editor.isActive('blockquote')} onClick={() => c().toggleBlockquote().run()}>
        <Quote />
      </Btn>
      <Btn
        label="Destaque (callout)"
        active={editor.isActive('callout')}
        onClick={() =>
          editor.isActive('callout')
            ? c().lift('callout').run()
            : c().wrapIn('callout', { kind: 'ideia', title: 'Ideia' }).run()
        }
      >
        <MessageSquareQuote />
      </Btn>
      <Sep />
      <Btn label="Tabela" active={editor.isActive('table')} onClick={() => c().insertTable({ rows: 3, cols: 3, withHeaderRow: true }).run()}>
        <Table2 />
      </Btn>
      <Btn label="Bloco de código" active={editor.isActive('codeBlock')} onClick={() => c().toggleCodeBlock().run()}>
        <Code2 />
      </Btn>
      <Btn label="Divisor" onClick={() => c().setHorizontalRule().run()}>
        <Minus />
      </Btn>
      <Btn label="Imagem" disabled={uploading} onClick={onImage}>
        {uploading ? <Loader2 className="animate-spin" /> : <ImagePlus />}
      </Btn>
      <Btn label="Ligar a outra nota ([[)" onClick={() => c().insertContent('[[').run()}>
        <Glyph name="mindmap" className="text-[16px]" />
      </Btn>
      <span className="flex-1" />
      <Btn label="Adicionar propriedade" onClick={onAddProp}>
        <Plus />
      </Btn>
      <Btn label="Desfazer (Ctrl+Z)" disabled={!editor.can().undo()} onClick={() => c().undo().run()}>
        <Undo2 />
      </Btn>
      <Btn label="Refazer (Ctrl+Shift+Z)" disabled={!editor.can().redo()} onClick={() => c().redo().run()}>
        <Redo2 />
      </Btn>
    </div>
  );
}

function TableBar({ editor }: { editor: Editor }) {
  const c = () => editor.chain().focus();
  const item = (label: string, icon: React.ReactNode, run: () => void, danger = false) => (
    <button
      type="button"
      onMouseDown={(e) => e.preventDefault()}
      onClick={run}
      className={`flex items-center gap-1 h-7 px-2 rounded-md text-[11px] font-semibold ${
        danger ? 'text-red-400 hover:bg-red-500/10' : 'text-[var(--nb-ink-2)] hover:bg-[var(--nb-pane-2)] hover:text-[var(--nb-ink)]'
      } [&>svg]:w-3.5 [&>svg]:h-3.5`}
    >
      {icon}
      {label}
    </button>
  );
  return (
    <div className="nb-rich-tablebar" role="toolbar" aria-label="Tabela">
      <span className="text-[10px] font-black uppercase tracking-wider text-[var(--nb-ink-3)] mr-1">Tabela</span>
      {item('Linha acima', <Rows3 />, () => c().addRowBefore().run())}
      {item('Linha abaixo', <Rows3 />, () => c().addRowAfter().run())}
      {item('Coluna à esquerda', <Columns3 />, () => c().addColumnBefore().run())}
      {item('Coluna à direita', <Columns3 />, () => c().addColumnAfter().run())}
      {item('Cabeçalho', <SquareSplitHorizontal />, () => c().toggleHeaderRow().run())}
      {item('Tirar linha', <Minus />, () => c().deleteRow().run())}
      {item('Tirar coluna', <Minus />, () => c().deleteColumn().run())}
      {item('Apagar tabela', <Trash2 />, () => c().deleteTable().run(), true)}
    </div>
  );
}

export function EntryLinkButtons({ editor, size = 'md' }: { editor: Editor; size?: 'sm' | 'md' }) {
  useEditorTick(editor);
  const links = useNotebookLinks();
  const cls = size === 'sm' ? 'h-7 px-2 text-[11px]' : 'h-8 px-2.5 text-[12px]';
  if (editor.isActive('entryRef')) {
    return (
      <button
        type="button"
        onMouseDown={(e) => e.preventDefault()}
        onClick={() => editor.chain().focus().extendMarkRange('entryRef').unsetMark('entryRef').run()}
        className={`${cls} flex items-center gap-1 rounded-md font-bold text-[var(--nb-ink-2)] hover:bg-[var(--nb-pane-2)]`}
      >
        <Glyph name="cross" className="text-[13px]" /> Tirar menção
      </button>
    );
  }
  return (
    <button
      type="button"
      title="Mencionar um conceito (prévia ao passar o mouse)"
      onMouseDown={(e) => e.preventDefault()}
      onClick={async () => {
        const { from, to } = editor.state.selection;
        const text = editor.state.doc.textBetween(from, to, ' ').trim();
        if (!text) return;
        const r = await links.requestEntry(text);
        if (r) editor.chain().focus().setTextSelection({ from, to }).setMark('entryRef', r).run();
      }}
      className={`${cls} flex items-center gap-1 rounded-md font-bold text-[var(--nb-hl)] hover:bg-[var(--nb-hl-soft)]`}
    >
      <Glyph name="sparkle" className="text-[13px]" /> Mencionar
    </button>
  );
}

function SelectionMenu({ editor }: { editor: Editor }) {
  useEditorTick(editor);
  const [linking, setLinking] = useState(false);
  const [url, setUrl] = useState('');
  const c = () => editor.chain().focus();

  if (linking) {
    return (
      <form
        className="nb-rich-bubble"
        onSubmit={(e) => {
          e.preventDefault();
          const v = url.trim();
          if (v) c().extendMarkRange('link').setLink({ href: /^(https?:|mailto:|\/)/i.test(v) ? v : `https://${v}` }).run();
          else c().unsetLink().run();
          setLinking(false);
        }}
      >
        <input
          autoFocus
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          placeholder="Cole o endereço e tecle Enter"
          className="w-56 h-7 px-2 rounded-md bg-[var(--nb-pane-2)] text-[12px] outline-none"
          onKeyDown={(e) => e.key === 'Escape' && setLinking(false)}
        />
        <Btn label="Cancelar" onClick={() => setLinking(false)}>
          <X />
        </Btn>
      </form>
    );
  }

  return (
    <div className="nb-rich-bubble">
      <Btn label="Negrito" active={editor.isActive('bold')} onClick={() => c().toggleBold().run()}>
        <Bold />
      </Btn>
      <Btn label="Itálico" active={editor.isActive('italic')} onClick={() => c().toggleItalic().run()}>
        <Italic />
      </Btn>
      <Btn label="Tachado" active={editor.isActive('strike')} onClick={() => c().toggleStrike().run()}>
        <Strikethrough />
      </Btn>
      <Btn label="Marca-texto" active={editor.isActive('highlight')} onClick={() => c().toggleHighlight().run()}>
        <Highlighter />
      </Btn>
      <Btn label="Código" active={editor.isActive('code')} onClick={() => c().toggleCode().run()}>
        <Code />
      </Btn>
      <Sep />
      <Btn
        label="Link (endereço)"
        active={editor.isActive('link')}
        onClick={() => {
          setUrl(editor.getAttributes('link').href || '');
          setLinking(true);
        }}
      >
        <Link2 />
      </Btn>
      <Btn
        label="Transformar em ligação para nota"
        onClick={() => {
          const { from, to } = editor.state.selection;
          const text = editor.state.doc.textBetween(from, to, ' ').trim().slice(0, 120);
          if (!text) return;
          c().insertContentAt({ from, to }, { type: 'wikiLink', attrs: { target: text } }).run();
        }}
      >
        <Glyph name="mindmap" className="text-[16px]" />
      </Btn>
      <Sep />
      <EntryLinkButtons editor={editor} />
    </div>
  );
}

export function SuggestMenu({ menu, onHover }: { menu: NonNullable<MenuState>; onHover: (i: number) => void }) {
  const listRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    listRef.current?.querySelector<HTMLElement>(`[data-i="${menu.index}"]`)?.scrollIntoView({ block: 'nearest' });
  }, [menu.index]);
  if (typeof document === 'undefined' || !menu.rect) return null;
  const top = Math.min(menu.rect.bottom + 6, window.innerHeight - 320);
  const left = Math.min(menu.rect.left, window.innerWidth - 300);
  return createPortal(
    <div ref={listRef} className="nb-rich-suggest nb-scroll" style={{ top, left }} role="listbox" aria-label={menu.kind === 'slash' ? 'Comandos' : menu.kind === 'mention' ? 'Menções' : 'Notas'}>
      <p className="px-2.5 pt-1.5 pb-1 text-[10px] font-black uppercase tracking-wider text-[var(--nb-ink-3)]">
        {menu.kind === 'slash' ? 'Inserir' : menu.kind === 'mention' ? 'Mencionar' : menu.kind === 'cite' ? 'Citar fonte' : 'Ligar a uma nota'}
      </p>
      {menu.items.map((it, i) => (
        <button
          key={it.id}
          type="button"
          data-i={i}
          role="option"
          aria-selected={i === menu.index}
          onMouseEnter={() => onHover(i)}
          onMouseDown={(e) => {
            e.preventDefault();
            menu.run(it);
          }}
          className={`w-full flex items-center gap-2.5 px-2.5 py-1.5 rounded-lg text-left ${i === menu.index ? 'bg-[var(--nb-hl-soft)] text-[var(--nb-ink)]' : 'text-[var(--nb-ink-2)]'}`}
        >
          <span className="w-7 h-7 shrink-0 grid place-items-center rounded-md border border-[var(--nb-line)] bg-[var(--nb-pane)]">{it.icon}</span>
          <span className="flex-1 min-w-0 truncate text-[13px] font-semibold">{it.label}</span>
          {it.hint && <span className="shrink-0 text-[11px] text-[var(--nb-ink-3)] font-mono">{it.hint}</span>}
        </button>
      ))}
    </div>,
    // dentro do Notebook para herdar as cores do tema
    (document.querySelector('.nb-app') as HTMLElement | null) || document.body
  );
}

function Properties({ props, onChange }: { props: [string, string][]; onChange: (p: [string, string][]) => void }) {
  return (
    <div className="nb-rich-props">
      <p className="text-[10px] font-black uppercase tracking-wider text-[var(--nb-ink-3)] mb-1">Propriedades</p>
      {props.map(([k, v], i) => (
        <div key={i} className="group flex items-center gap-2">
          <input
            value={k}
            placeholder="nome"
            aria-label="Nome da propriedade"
            onChange={(e) => onChange(props.map((p, j) => (j === i ? [e.target.value.replace(/:/g, ''), p[1]] : p)))}
            className="w-32 shrink-0 h-7 px-2 rounded-md bg-transparent text-[12px] text-[var(--nb-ink-3)] hover:bg-[var(--nb-pane-2)] focus:bg-[var(--nb-pane-2)] outline-none"
          />
          <input
            value={v}
            placeholder="vazio"
            aria-label={`Valor de ${k}`}
            onChange={(e) => onChange(props.map((p, j) => (j === i ? [p[0], e.target.value.replace(/\n/g, ' ')] : p)))}
            className="flex-1 min-w-0 h-7 px-2 rounded-md bg-transparent text-[13px] hover:bg-[var(--nb-pane-2)] focus:bg-[var(--nb-pane-2)] outline-none"
          />
          <button
            type="button"
            aria-label="Remover propriedade"
            onClick={() => onChange(props.filter((_, j) => j !== i))}
            className="opacity-0 group-hover:opacity-100 focus:opacity-100 p-1 rounded text-[var(--nb-ink-3)] hover:text-red-400"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      ))}
    </div>
  );
}
