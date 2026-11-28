'use client';

import { notify } from '@/lib/ui/feedback';
import { useEffect, useRef } from 'react';
import type { Editor } from '@tiptap/core';
import {
  BookMarked,
  Bold,
  ClipboardPaste,
  Code2,
  Columns3,
  Copy,
  Download,
  FilePlus2,
  FolderPlus,
  Heading1,
  Heading2,
  Heading3,
  Highlighter,
  Italic,
  LayoutTemplate,
  List,
  ListChecks,
  ListOrdered,
  Maximize2,
  Minus,
  Network,
  PanelLeft,
  PanelRight,
  Pilcrow,
  Pin,
  Quote,
  Redo2,
  Rows3,
  Scissors,
  Search,
  SquareSplitHorizontal,
  Strikethrough,
  Table2,
  TextSelect,
  Trash2,
  Undo2,
  Upload,
  X,
  ArrowUpRight,
  FilePlus,
  Command,
  Home,
  Columns2,
  Timer,
  Camera,
} from 'lucide-react';
import type { NotebookEntry } from '@/lib/notebook/entries';
import { Glyph } from '../icons/Glyph';
import { useNotebookMenu, type MenuEntry } from './ContextMenu';

export interface GlobalMenuActions {
  entries: Record<string, NotebookEntry>;
  requestEntry: (text: string) => Promise<{ id: string; kind: NotebookEntry['kind'] } | null>;
  readMore: (e: NotebookEntry) => void;
  openSummary: (entryId: string | null) => void;
  search: (q: string) => void;
  newNote: () => void;
  newProject: () => void;
  picker: () => void;
  importFiles: () => void;
  exportAll: () => void;
  exportActive: (() => void) | null;
  quickOpen: () => void;
  graph: () => void;
  home: () => void;
  toggleFocus: () => void;
  toggleSide: () => void;
  toggleRight: () => void;
  sideHidden: boolean;
  openItem: (id: string) => void;
  /** tela dividida */
  openAside: (id: string) => void;
  entryAside: (id: string) => void;
  /** sessão de escrita */
  session: { active: boolean; start: () => void; end: () => void };
  snapshot: (() => void) | null;
  tab: {
    close: (id: string) => void;
    closeOthers: (id: string) => void;
    closeAll: () => void;
    pin: (id: string) => void;
    isPinned: (id: string) => boolean;
    trash: (id: string) => void;
    exportItem: (id: string) => void;
  };
}

const ic = (C: React.ElementType) => <C className="w-3.5 h-3.5" />;
const has = (ed: Editor, name: string) => ed.extensionManager.extensions.some((x) => x.name === name);
const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

function blocked() {
  notify('O navegador bloqueou o acesso à área de transferência. Use Ctrl+V (ou Cmd+V) para colar.');
}

async function pasteInto(ed: Editor, plain: boolean) {
  try {
    if (!plain && navigator.clipboard && 'read' in navigator.clipboard) {
      const items = await navigator.clipboard.read();
      for (const it of items) {
        if (it.types.includes('text/html')) {
          const html = await (await it.getType('text/html')).text();
          ed.chain().focus().insertContent(html).run();
          return;
        }
      }
    }
    const text = await navigator.clipboard.readText();
    const html = text
      .replace(/\r\n?/g, '\n')
      .split(/\n{2,}/)
      .map((p) => `<p>${esc(p).replace(/\n/g, '<br>')}</p>`)
      .join('');
    ed.chain().focus().insertContent(html).run();
  } catch {
    blocked();
  }
}

/** Ações do texto (qualquer editor do Notebook). */
function editorItems(ed: Editor, target: HTMLElement, a: GlobalMenuActions): MenuEntry[] {
  const { from, to, empty } = ed.state.selection;
  const text = empty ? '' : ed.state.doc.textBetween(from, to, ' ').trim();
  const c = () => ed.chain().focus();
  const refEl = target.closest('[data-ref]') as HTMLElement | null;
  const entry = refEl ? a.entries[refEl.dataset.ref || ''] : null;
  const items: MenuEntry[] = [];

  if (entry) {
    items.push(
      { label: `Abrir “${entry.title.slice(0, 28)}”`, icon: ic(ArrowUpRight), run: () => a.readMore(entry) },
      { label: 'Ver no Sumário', icon: ic(BookMarked), run: () => a.openSummary(entry.id) },
      'sep'
    );
  }
  items.push(
    { label: 'Recortar', icon: ic(Scissors), shortcut: 'Ctrl+X', disabled: empty || !ed.isEditable, run: () => (ed.commands.focus(), document.execCommand('cut')) },
    { label: 'Copiar', icon: ic(Copy), shortcut: 'Ctrl+C', disabled: empty, run: () => (ed.commands.focus(), document.execCommand('copy')) },
    { label: 'Colar', icon: ic(ClipboardPaste), shortcut: 'Ctrl+V', disabled: !ed.isEditable, run: () => void pasteInto(ed, false) },
    { label: 'Colar sem formatação', icon: ic(ClipboardPaste), shortcut: 'Ctrl+Shift+V', disabled: !ed.isEditable, run: () => void pasteInto(ed, true) },
    { label: 'Selecionar tudo', icon: ic(TextSelect), shortcut: 'Ctrl+A', run: () => c().selectAll().run() },
    'sep'
  );
  if (!empty && ed.isEditable) {
    items.push(
      ...(has(ed, 'bold') ? [{ label: 'Negrito', icon: ic(Bold), shortcut: 'Ctrl+B', run: () => c().toggleBold().run() }] : []),
      ...(has(ed, 'italic') ? [{ label: 'Itálico', icon: ic(Italic), shortcut: 'Ctrl+I', run: () => c().toggleItalic().run() }] : []),
      ...(has(ed, 'strike') ? [{ label: 'Tachado', icon: ic(Strikethrough), run: () => c().toggleStrike().run() }] : []),
      ...(has(ed, 'highlight') ? [{ label: 'Marca-texto', icon: ic(Highlighter), run: () => c().toggleHighlight().run() }] : []),
      'sep'
    );
  }
  if (has(ed, 'entryRef') && ed.isEditable) {
    if (ed.isActive('entryRef')) {
      items.push({ label: 'Tirar menção', icon: <Glyph name="cross" />, run: () => c().extendMarkRange('entryRef').unsetMark('entryRef').run() });
    } else if (text) {
      items.push({
        label: `Mencionar “${text.slice(0, 24)}${text.length > 24 ? '…' : ''}”`,
        icon: <Glyph name="sparkle" />,
        shortcut: '+',
        run: async () => {
          const r = await a.requestEntry(text);
          if (r) ed.chain().focus().setTextSelection({ from, to }).setMark('entryRef', r).run();
        },
      });
    }
  }
  if (has(ed, 'wikiLink') && text && ed.isEditable) {
    items.push({
      label: 'Ligar a uma nota',
      icon: <Glyph name="mindmap" />,
      shortcut: '[[',
      run: () => c().insertContentAt({ from, to }, { type: 'wikiLink', attrs: { target: text.slice(0, 120) } }).run(),
    });
  }
  if (text) items.push({ label: `Buscar “${text.slice(0, 20)}” no Notebook`, icon: ic(Search), run: () => a.search(text) }, 'sep');

  if (ed.isEditable) {
    const transform: MenuEntry[] = [
      { label: 'Texto', icon: ic(Pilcrow), run: () => c().setParagraph().run() },
      ...(has(ed, 'heading')
        ? [
            { label: 'Título 1', icon: ic(Heading1), run: () => c().toggleHeading({ level: 1 }).run() },
            { label: 'Título 2', icon: ic(Heading2), run: () => c().toggleHeading({ level: 2 }).run() },
            { label: 'Título 3', icon: ic(Heading3), run: () => c().toggleHeading({ level: 3 }).run() },
          ]
        : []),
      ...(has(ed, 'bulletList') ? [{ label: 'Lista', icon: ic(List), run: () => c().toggleBulletList().run() }] : []),
      ...(has(ed, 'orderedList') ? [{ label: 'Lista numerada', icon: ic(ListOrdered), run: () => c().toggleOrderedList().run() }] : []),
      ...(has(ed, 'taskList') ? [{ label: 'Tarefas', icon: ic(ListChecks), run: () => c().toggleTaskList().run() }] : []),
      ...(has(ed, 'blockquote') ? [{ label: 'Citação', icon: ic(Quote), run: () => c().toggleBlockquote().run() }] : []),
      ...(has(ed, 'codeBlock') ? [{ label: 'Bloco de código', icon: ic(Code2), run: () => c().toggleCodeBlock().run() }] : []),
    ];
    const insert: MenuEntry[] = [
      ...(has(ed, 'table') ? [{ label: 'Tabela', icon: ic(Table2), run: () => c().insertTable({ rows: 3, cols: 3, withHeaderRow: true }).run() }] : []),
      ...(has(ed, 'horizontalRule') ? [{ label: 'Divisor', icon: ic(Minus), run: () => c().setHorizontalRule().run() }] : []),
      ...(has(ed, 'pageBreak') ? [{ label: 'Nova página', icon: ic(FilePlus), shortcut: 'Ctrl+Shift+Enter', run: () => c().insertPageBreak().run() }] : []),
      ...(has(ed, 'callout')
        ? [{ label: 'Destaque (ideia)', icon: <Glyph name="idea" />, run: () => c().wrapIn('callout', { kind: 'ideia', title: 'Ideia' }).run() }]
        : []),
      ...(has(ed, 'entryRef') ? [{ label: 'Menção (digite +)', icon: <Glyph name="sparkle" />, run: () => c().insertContent('+').run() }] : []),
      ...(has(ed, 'wikiLink') ? [{ label: 'Ligação a nota (digite [[)', icon: <Glyph name="mindmap" />, run: () => c().insertContent('[[').run() }] : []),
    ];
    items.push({ label: 'Transformar em', icon: ic(Pilcrow), submenu: transform }, { label: 'Inserir', icon: ic(FilePlus2), submenu: insert });
    if (ed.isActive('table')) {
      items.push({
        label: 'Tabela',
        icon: ic(Table2),
        submenu: [
          { label: 'Linha acima', icon: ic(Rows3), run: () => c().addRowBefore().run() },
          { label: 'Linha abaixo', icon: ic(Rows3), run: () => c().addRowAfter().run() },
          { label: 'Coluna à esquerda', icon: ic(Columns3), run: () => c().addColumnBefore().run() },
          { label: 'Coluna à direita', icon: ic(Columns3), run: () => c().addColumnAfter().run() },
          { label: 'Cabeçalho', icon: ic(SquareSplitHorizontal), run: () => c().toggleHeaderRow().run() },
          'sep',
          { label: 'Apagar linha', icon: ic(Minus), run: () => c().deleteRow().run() },
          { label: 'Apagar coluna', icon: ic(Minus), run: () => c().deleteColumn().run() },
          { label: 'Apagar tabela', icon: ic(Trash2), danger: true, run: () => c().deleteTable().run() },
        ],
      });
    }
    items.push(
      'sep',
      { label: 'Desfazer', icon: ic(Undo2), shortcut: 'Ctrl+Z', disabled: !ed.can().undo(), run: () => c().undo().run() },
      { label: 'Refazer', icon: ic(Redo2), shortcut: 'Ctrl+Shift+Z', disabled: !ed.can().redo(), run: () => c().redo().run() }
    );
  }
  return items;
}

/** Ações de campos de texto simples (títulos, resumos, buscas…). */
function fieldItems(el: HTMLInputElement | HTMLTextAreaElement, a: GlobalMenuActions): MenuEntry[] {
  const sel = el.value.slice(el.selectionStart ?? 0, el.selectionEnd ?? 0);
  const ro = el.readOnly || el.disabled;
  return [
    { label: 'Recortar', icon: ic(Scissors), shortcut: 'Ctrl+X', disabled: !sel || ro, run: () => (el.focus(), document.execCommand('cut')) },
    { label: 'Copiar', icon: ic(Copy), shortcut: 'Ctrl+C', disabled: !sel, run: () => (el.focus(), document.execCommand('copy')) },
    {
      label: 'Colar',
      icon: ic(ClipboardPaste),
      shortcut: 'Ctrl+V',
      disabled: ro,
      run: async () => {
        try {
          const t = await navigator.clipboard.readText();
          el.focus();
          el.setRangeText(t, el.selectionStart ?? el.value.length, el.selectionEnd ?? el.value.length, 'end');
          el.dispatchEvent(new Event('input', { bubbles: true }));
        } catch {
          blocked();
        }
      },
    },
    { label: 'Selecionar tudo', icon: ic(TextSelect), shortcut: 'Ctrl+A', run: () => (el.focus(), el.select()) },
    ...(sel.trim() ? (['sep', { label: `Buscar “${sel.trim().slice(0, 20)}” no Notebook`, icon: ic(Search), run: () => a.search(sel.trim()) }] as MenuEntry[]) : []),
  ];
}

function generalItems(a: GlobalMenuActions): MenuEntry[] {
  return [
    { label: 'Nova nota', icon: ic(FilePlus2), shortcut: 'Ctrl+N', run: a.newNote },
    { label: 'Novo projeto', icon: ic(FolderPlus), run: a.newProject },
    { label: 'Novo a partir de modelo', icon: ic(LayoutTemplate), run: a.picker },
    { label: 'Importar arquivos', icon: ic(Upload), run: a.importFiles },
    'sep',
    { label: 'Paleta de comandos', icon: ic(Command), shortcut: 'Ctrl+K', run: a.quickOpen },
    { label: 'Buscar no Notebook', icon: ic(Search), shortcut: 'Ctrl+Shift+F', run: () => a.search('') },
    { label: 'Sumário (menções)', icon: ic(BookMarked), run: () => a.openSummary(null) },
    { label: 'Grafo de notas', icon: ic(Network), shortcut: 'Ctrl+G', run: a.graph },
    { label: 'Início', icon: ic(Home), run: a.home },
    'sep',
    a.session.active
      ? { label: 'Encerrar sessão de escrita', icon: ic(Timer), run: a.session.end }
      : { label: 'Iniciar sessão de escrita', icon: ic(Timer), run: a.session.start },
    ...(a.snapshot ? [{ label: 'Salvar instantâneo…', icon: ic(Camera), run: a.snapshot }] : []),
    { label: 'Modo foco', icon: ic(Maximize2), shortcut: 'Ctrl+.', run: a.toggleFocus },
    { label: a.sideHidden ? 'Mostrar barra lateral' : 'Ocultar barra lateral', icon: ic(PanelLeft), shortcut: 'Ctrl+Shift+\\', run: a.toggleSide },
    { label: 'Painel de detalhes', icon: ic(PanelRight), run: a.toggleRight },
    'sep',
    ...(a.exportActive ? [{ label: 'Exportar esta nota…', icon: ic(Download), run: a.exportActive }] : []),
    { label: 'Exportar tudo (.zip)', icon: ic(Download), run: a.exportAll },
  ];
}

function tabItems(id: string, a: GlobalMenuActions): MenuEntry[] {
  return [
    { label: 'Fechar', icon: ic(X), shortcut: 'Ctrl+W', run: () => a.tab.close(id) },
    { label: 'Fechar as outras', icon: ic(X), run: () => a.tab.closeOthers(id) },
    { label: 'Fechar todas', icon: ic(X), run: a.tab.closeAll },
    'sep',
    { label: 'Abrir ao lado', icon: ic(Columns2), shortcut: 'Alt+clique', run: () => a.openAside(id) },
    { label: a.tab.isPinned(id) ? 'Desafixar' : 'Fixar no topo', icon: ic(Pin), run: () => a.tab.pin(id) },
    { label: 'Exportar…', icon: ic(Download), run: () => a.tab.exportItem(id) },
    'sep',
    { label: 'Mover para a lixeira', icon: ic(Trash2), danger: true, run: () => a.tab.trash(id) },
  ];
}

function cardItems(id: string, a: GlobalMenuActions): MenuEntry[] {
  return [
    { label: 'Abrir', icon: ic(ArrowUpRight), run: () => a.openItem(id) },
    { label: 'Abrir ao lado', icon: ic(Columns2), shortcut: 'Alt+clique', run: () => a.openAside(id) },
    { label: a.tab.isPinned(id) ? 'Desafixar' : 'Fixar no topo', icon: ic(Pin), run: () => a.tab.pin(id) },
    { label: 'Exportar…', icon: ic(Download), run: () => a.tab.exportItem(id) },
    'sep',
    { label: 'Mover para a lixeira', icon: ic(Trash2), danger: true, run: () => a.tab.trash(id) },
  ];
}

function mentionItems(entry: NotebookEntry, a: GlobalMenuActions): MenuEntry[] {
  return [
    { label: 'Abrir (Ler mais)', icon: ic(ArrowUpRight), run: () => a.readMore(entry) },
    { label: 'Abrir ao lado', icon: ic(Columns2), shortcut: 'Alt+clique', run: () => a.entryAside(entry.id) },
    ...(entry.target_id ? [{ label: 'Abrir a ficha ao lado', icon: ic(Columns2), run: () => a.openAside(entry.target_id!) }] : []),
    { label: 'Ver no Sumário', icon: ic(BookMarked), run: () => a.openSummary(entry.id) },
    { label: 'Copiar nome', icon: ic(Copy), run: () => void navigator.clipboard?.writeText(entry.title).catch(blocked) },
  ];
}

/**
 * Ouve o botão direito em todo o Notebook. Quem tem menu próprio (mapa, grafo,
 * Cronos, árvore de arquivos…) cancela o evento antes e o ouvinte não age.
 */
export function GlobalContextMenus({ actions }: { actions: GlobalMenuActions }) {
  const { open } = useNotebookMenu();
  const ref = useRef(actions);
  ref.current = actions;

  useEffect(() => {
    const onCtx = (e: MouseEvent) => {
      const t = e.target as HTMLElement | null;
      if (!t || e.defaultPrevented || e.shiftKey) return; // Shift+botão direito: menu do navegador
      const app = t.closest('.nb-app');
      if (!app || t.closest('.nb-ctx, [data-native-menu]')) return;
      const a = ref.current;

      const pm = t.closest('.ProseMirror') as (HTMLElement & { editor?: Editor }) | null;
      if (pm?.editor) {
        const ed = pm.editor;
        // sem seleção: o cursor vai para onde clicou
        if (ed.state.selection.empty || !ed.view.hasFocus()) {
          const pos = ed.view.posAtCoords({ left: e.clientX, top: e.clientY });
          const { from, to } = ed.state.selection;
          if (pos && (ed.state.selection.empty || pos.pos < from || pos.pos > to)) ed.chain().focus().setTextSelection(pos.pos).run();
        }
        return open(e, editorItems(ed, t, a));
      }
      const field = t.closest('input:not([type=checkbox]):not([type=radio]):not([type=range]):not([type=color]):not([type=file]), textarea') as HTMLInputElement | HTMLTextAreaElement | null;
      if (field) return open(e, fieldItems(field, a));
      const refEl = t.closest('[data-ref]') as HTMLElement | null;
      const entry = refEl ? a.entries[refEl.dataset.ref || ''] : null;
      if (entry) return open(e, mentionItems(entry, a), entry.title);
      const card = t.closest('[data-item-id]') as HTMLElement | null;
      if (card?.dataset.itemId) return open(e, cardItems(card.dataset.itemId, a));
      const tab = t.closest('[data-tab-id]') as HTMLElement | null;
      if (tab?.dataset.tabId) return open(e, tabItems(tab.dataset.tabId, a));
      open(e, generalItems(a));
    };
    document.addEventListener('contextmenu', onCtx);
    return () => document.removeEventListener('contextmenu', onCtx);
  }, [open]);

  return null;
}
