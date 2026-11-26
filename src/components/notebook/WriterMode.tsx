'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Bold,
  Italic,
  Underline,
  Strikethrough,
  Heading2,
  Quote,
  AlignCenter,
  AlignLeft,
  AlignRight,
  AlignJustify,
  Sparkles,
  ImagePlus,
  Eraser,
  Undo2,
  Redo2,
  Maximize2,
  Minimize2,
  Focus,
  Type,
  ChevronLeft,
  ChevronRight,
  Send,
  Settings2,
  Loader2,
  ExternalLink,
  FilePlus2,
  X,
} from 'lucide-react';
import { useEditor, EditorContent, type Editor } from '@tiptap/react';
import { Extension } from '@tiptap/core';
import { Plugin, PluginKey } from '@tiptap/pm/state';
import { Decoration, DecorationSet } from '@tiptap/pm/view';
import StarterKit from '@tiptap/starter-kit';
import TextAlign from '@tiptap/extension-text-align';
import Typography from '@tiptap/extension-typography';
import { BubbleMenu } from '@tiptap/react/menus';
import { EntryRef } from './editor/extensions';
import { Illustration, PageBreak } from './editor/bookExtensions';
import { ImageBar } from './editor/ImageBar';
import { EntryLinkButtons } from './editor/RichNoteEditor';
import { Placeholder } from '@tiptap/extensions';
import { countWords, htmlToText } from '@/lib/notebook/markdown';
import { uploadMediaToInsight } from '@/lib/mediaCompressor';
import { getUserUploadLimitBytes } from '@/lib/contributorLevels';
import type { ChapterStatus, NotebookItem, WriterPrefs } from '@/lib/notebook/types';
import type { NotebookApi } from '@/lib/notebook/useNotebook';


/** Lista branca de tags/atributos do texto do capítulo (DOM, não regex). */
const ALLOWED = new Set(['P', 'BR', 'B', 'STRONG', 'I', 'EM', 'U', 'S', 'STRIKE', 'DEL', 'H2', 'H3', 'BLOCKQUOTE', 'HR', 'IMG', 'SPAN', 'FIGURE', 'FIGCAPTION']);
/** Atributos permitidos por tag, com o formato exato que cada um pode ter. */
const ATTR_OK: Record<string, Record<string, RegExp>> = {
  IMG: { src: /^https?:\/\//i, alt: /^[^<>]{0,300}$/ },
  SPAN: { 'data-ref': /^[0-9a-f-]{36}$/i, 'data-kind': /^(elemento|nota_autor|aviso)$/ },
  HR: { 'data-page-break': /^true$/ },
  FIGURE: { 'data-figure': /^$/, 'data-layout': /^(center|full|wide|left|right)$/, 'data-width': /^(30|40|50|60|70|80|90|100)$/ },
};
export function sanitizeWriterHtml(html: string): string {
  if (typeof window === 'undefined' || !html) return '';
  const doc = new DOMParser().parseFromString(`<div>${html}</div>`, 'text/html');
  const root = doc.body.firstElementChild as HTMLElement;
  const clean = (el: Element) => {
    for (const child of Array.from(el.children)) {
      let node: Element = child;
      if (node.tagName === 'DIV') {
        // Chrome cria <div> ao quebrar linha: vira parágrafo
        const p = doc.createElement('p');
        while (node.firstChild) p.appendChild(node.firstChild);
        node.replaceWith(p);
        node = p;
      } else if (!ALLOWED.has(node.tagName)) {
        const frag = doc.createDocumentFragment();
        while (node.firstChild) frag.appendChild(node.firstChild);
        node.replaceWith(frag);
        continue;
      }
      const align = (node as HTMLElement).style?.textAlign;
      for (const a of Array.from(node.attributes)) {
        const rule = ATTR_OK[node.tagName]?.[a.name];
        if (rule && rule.test(a.value)) continue;
        node.removeAttribute(a.name);
      }
      if (align === 'center' || align === 'right' || align === 'justify') (node as HTMLElement).style.textAlign = align;
      if (node.tagName === 'IMG' && !node.getAttribute('src')) {
        node.remove();
        continue;
      }
      clean(node);
    }
  };
  // repete até não sobrar nada fora da lista (tags desembrulhadas sobem de nível)
  for (let pass = 0; pass < 6; pass++) {
    const before = root.innerHTML;
    clean(root);
    if (root.innerHTML === before) break;
  }
  return root.innerHTML;
}

/** Marca o bloco onde está o cursor (o "modo foco" do papel apaga o resto). */
const CurrentBlock = Extension.create({
  name: 'currentBlock',
  addProseMirrorPlugins() {
    return [
      new Plugin({
        key: new PluginKey('currentBlock'),
        props: {
          decorations(state) {
            const { $from } = state.selection;
            if ($from.depth < 1) return null;
            const start = $from.before(1);
            const node = state.doc.nodeAt(start);
            if (!node) return null;
            return DecorationSet.create(state.doc, [Decoration.node(start, start + node.nodeSize, { class: 'nb-current' })]);
          },
        },
      }),
    ];
  },
});

const PREFS_KEY = 'insight-notebook-writer';
const DEFAULT_PREFS: WriterPrefs = { paper: 'claro', font: 'literata', size: 19, width: 'normal', typewriter: false, focus: false };

export const CHAPTER_STATUS: { id: ChapterStatus; label: string; color: string }[] = [
  { id: 'ideia', label: 'Ideia', color: '#a1a1aa' },
  { id: 'rascunho', label: 'Rascunho', color: '#f59e0b' },
  { id: 'revisao', label: 'Em revisão', color: '#38bdf8' },
  { id: 'pronto', label: 'Pronto', color: '#22c55e' },
  { id: 'publicado', label: 'Publicado', color: '#a855f7' },
];

const FONTS: Record<WriterPrefs['font'], { label: string; css: string }> = {
  literata: { label: 'Literata', css: "var(--nb-literata), Georgia, 'Times New Roman', serif" },
  serif: { label: 'Clássica', css: "Georgia, 'Times New Roman', serif" },
  sans: { label: 'Moderna', css: "var(--font-sans, ui-sans-serif), system-ui, sans-serif" },
  mono: { label: 'Máquina', css: "'Courier Prime', 'Courier New', ui-monospace, monospace" },
};
const WIDTHS = { estreita: 600, normal: 720, larga: 860 };

const todayKey = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};

interface Props {
  item: NotebookItem;
  api: NotebookApi;
  book: NotebookItem | null;
  chapters: NotebookItem[];
  onOpen: (id: string) => void;
  onPublish: (item: NotebookItem) => void;
  immersive: boolean;
  onImmersive: (v: boolean) => void;
  role?: string | null;
  level?: number | null;
}

export function WriterMode({ item, api, book, chapters, onOpen, onPublish, immersive, onImmersive, role, level }: Props) {
  const [prefs, setPrefs] = useState<WriterPrefs>(DEFAULT_PREFS);
  const [showPrefs, setShowPrefs] = useState(false);
  const [words, setWords] = useState(item.word_count);
  const [uploading, setUploading] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const dataRef = useRef(item.data);
  dataRef.current = item.data;
  const sessionStart = useRef<number | null>(null);
  const pendingHistory = useRef(0);
  const lastWords = useRef(item.word_count);

  useEffect(() => {
    try {
      const p = JSON.parse(localStorage.getItem(PREFS_KEY) || 'null');
      if (p) setPrefs({ ...DEFAULT_PREFS, ...p });
    } catch {
      /* ignora */
    }
  }, []);
  const setPref = <K extends keyof WriterPrefs>(k: K, v: WriterPrefs[K]) =>
    setPrefs((p) => {
      const n = { ...p, [k]: v };
      try {
        localStorage.setItem(PREFS_KEY, JSON.stringify(n));
      } catch {
        /* ignora */
      }
      return n;
    });

  // soma palavras do dia no livro (histórico/heatmap).
  // Usa refs: o objeto `api` muda a cada render e não pode ser dependência
  // do intervalo (senão a limpeza roda a cada tecla e dispara novos saves).
  const apiRef = useRef(api);
  apiRef.current = api;
  const bookId = book?.id ?? null;
  const flushHistory = useCallback(async () => {
    const delta = pendingHistory.current;
    if (!bookId || delta <= 0) return;
    pendingHistory.current = 0;
    const full = await apiRef.current.loadFull(bookId);
    if (!full) return;
    const history = { ...(full.data.history || {}) };
    const k = todayKey();
    history[k] = (history[k] || 0) + delta;
    // mantém ~1 ano
    const keys = Object.keys(history).sort();
    while (keys.length > 370) delete history[keys.shift()!];
    apiRef.current.update(bookId, { data: { ...full.data, history } }, { debounce: 400 });
  }, [bookId]);

  useEffect(() => {
    const t = setInterval(() => void flushHistory(), 20000);
    return () => {
      clearInterval(t);
      void flushHistory();
    };
  }, [flushHistory]);

  const insertImagesRef = useRef<(files: File[]) => void>(() => {});

  const save = useCallback((ed: Editor) => {
    const html = sanitizeWriterHtml(ed.getHTML());
    const w = countWords(htmlToText(html));
    if (w > lastWords.current) pendingHistory.current += w - lastWords.current;
    lastWords.current = w;
    setWords(w);
    apiRef.current.update(item.id, { data: { ...dataRef.current, html } }, { debounce: 1200 });
  }, [item.id]);

  const prefsRef = useRef(prefs);
  prefsRef.current = prefs;

  // ------------------------------------------------ paginação real
  // A altura útil da página acompanha a largura do papel (proporção de livro).
  const [paging, setPaging] = useState<{ pages: number; current: number; fill: number; full: boolean }>({ pages: 1, current: 1, fill: 0, full: false });
  const [dismissed, setDismissed] = useState<Set<number>>(new Set());
  const pagingTimer = useRef<number | null>(null);
  const editorRefW = useRef<Editor | null>(null);
  const measure = useCallback(() => {
    const ed = editorRefW.current;
    if (!ed) return;
    const dom = ed.view.dom as HTMLElement;
    const pageH = Math.round(dom.clientWidth * 1.42);
    const kids = Array.from(dom.children) as HTMLElement[];
    const heights: number[] = [0];
    let segStart = dom.getBoundingClientRect().top;
    for (const k of kids) {
      if (k.matches('hr.nb-pagebreak')) {
        heights[heights.length - 1] = k.getBoundingClientRect().top - segStart;
        heights.push(0);
        segStart = k.getBoundingClientRect().bottom;
      }
    }
    heights[heights.length - 1] = dom.getBoundingClientRect().bottom - segStart;
    // página do cursor
    const { $from } = ed.state.selection;
    let current = 1;
    ed.state.doc.forEach((n, offset) => {
      if (n.type.name === 'pageBreak' && offset < $from.pos) current++;
    });
    const h = heights[current - 1] || 0;
    setPaging({ pages: heights.length, current, fill: Math.min(1.5, h / pageH), full: h > pageH });
  }, []);
  const schedulePaging = () => {
    if (pagingTimer.current) window.clearTimeout(pagingTimer.current);
    pagingTimer.current = window.setTimeout(measure, 250);
  };

  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        heading: { levels: [2, 3] },
        code: false,
        codeBlock: false,
        bulletList: false,
        orderedList: false,
        listItem: false,
        listKeymap: false,
        link: false,
      }),
      TextAlign.configure({ types: ['heading', 'paragraph'], alignments: ['left', 'center', 'right', 'justify'] }),
      // tipografia de livro: -- vira travessão, ... vira reticências, aspas curvas
      Typography.configure({ emDash: '—', ellipsis: '…', openDoubleQuote: '“', closeDoubleQuote: '”', openSingleQuote: '‘', closeSingleQuote: '’' }),
      Illustration.configure({ inline: false }),
      PageBreak,
      EntryRef,
      Placeholder.configure({ placeholder: 'Era uma vez…' }),
      CurrentBlock,
    ],
    content: item._full ? sanitizeWriterHtml(String(item.data?.html || '')) : '',
    immediatelyRender: false,
    shouldRerenderOnTransaction: true,
    editorProps: {
      attributes: { class: 'nb-paper', spellcheck: 'true', lang: 'pt-BR', role: 'textbox', 'aria-multiline': 'true', 'aria-label': 'Texto do capítulo' },
      handlePaste: (_v, e) => {
        const files = Array.from(e.clipboardData?.files || []).filter((f) => f.type.startsWith('image/'));
        if (!files.length) return false;
        insertImagesRef.current(files);
        return true;
      },
      handleDrop: (_v, e) => {
        const files = Array.from((e as DragEvent).dataTransfer?.files || []).filter((f) => f.type.startsWith('image/'));
        if (!files.length) return false;
        e.preventDefault();
        insertImagesRef.current(files);
        return true;
      },
    },
    onCreate: ({ editor: ed }) => {
      const w = countWords(ed.getText());
      setWords(w);
      lastWords.current = w;
      sessionStart.current = w;
    },
    onUpdate: ({ editor: ed }) => {
      save(ed);
      schedulePaging();
    },
    onSelectionUpdate: ({ editor: ed }) => {
      schedulePaging();
      // máquina de escrever: a linha atual fica no meio da tela
      if (!prefsRef.current.typewriter || !scrollRef.current) return;
      try {
        const c = ed.view.coordsAtPos(ed.state.selection.from);
        const box = scrollRef.current.getBoundingClientRect();
        scrollRef.current.scrollBy({ top: c.top - (box.top + box.height * 0.45), behavior: 'smooth' });
      } catch {
        /* posição fora da tela */
      }
    },
  });

  editorRefW.current = editor;
  // callbacks estáveis: o BubbleMenu re-registra o plugin quando a função muda
  const showTextMenu = useCallback(
    ({ editor: e, from, to }: { editor: Editor; from: number; to: number }) => from !== to && !e.isActive('image') && !e.isActive('pageBreak'),
    []
  );
  const showImageMenu = useCallback(({ editor: e }: { editor: Editor }) => e.isActive('image'), []);
  useEffect(() => {
    if (!editor) return;
    measure();
    const ro = new ResizeObserver(() => measure());
    ro.observe(editor.view.dom);
    return () => ro.disconnect();
  }, [editor, measure, prefs.width, prefs.size, prefs.font]);

  // modo foco do papel
  useEffect(() => {
    if (!editor) return;
    editor.view.dom.setAttribute('data-focus', String(prefs.focus));
  }, [editor, prefs.focus]);

  // Esc sai do modo imersivo
  useEffect(() => {
    if (!immersive) return;
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onImmersive(false);
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [immersive, onImmersive]);

  async function insertImages(files: File[]) {
    setUploading(true);
    for (const f of files.filter((x) => x.type.startsWith('image/'))) {
      try {
        const res = await uploadMediaToInsight(f, {
          budgetBytes: getUserUploadLimitBytes(level ?? 0, role ?? undefined),
          asImage: f.type !== 'image/gif',
          scope: 'notebook',
        });
        await api.registerAsset(item.id, res.r2Key, res.publicUrl);
        editor?.chain().focus().setImage({ src: res.publicUrl, alt: '' }).run();
      } catch (err) {
        alert(err instanceof Error ? err.message : 'Falha no envio da imagem.');
      }
    }
    setUploading(false);
  }
  insertImagesRef.current = (files) => void insertImages(files);

  const idx = chapters.findIndex((c) => c.id === item.id);
  const prev = idx > 0 ? chapters[idx - 1] : null;
  const next = idx >= 0 && idx < chapters.length - 1 ? chapters[idx + 1] : null;
  const goal = Number(item.data?.wordGoal) || Number(book?.data?.dailyGoal) || 1000;
  const session = Math.max(0, words - (sessionStart.current ?? words));
  const pct = Math.min(1, words / goal);
  const status = (item.data?.status as ChapterStatus) || 'rascunho';
  const statusMeta = CHAPTER_STATUS.find((s) => s.id === status)!;
  const readMin = Math.max(1, Math.round(words / 220));
  const pages = paging.pages;

  const c = () => editor!.chain().focus();
  const tools: { icon: React.ReactElement; label: string; run: () => void; sep?: boolean; active?: boolean }[] = editor
    ? [
        { icon: <Bold />, label: 'Negrito (Ctrl+B)', run: () => c().toggleBold().run(), active: editor.isActive('bold') },
        { icon: <Italic />, label: 'Itálico (Ctrl+I)', run: () => c().toggleItalic().run(), active: editor.isActive('italic') },
        { icon: <Underline />, label: 'Sublinhado (Ctrl+U)', run: () => c().toggleUnderline().run(), active: editor.isActive('underline') },
        { icon: <Strikethrough />, label: 'Tachado', run: () => c().toggleStrike().run(), active: editor.isActive('strike') },
        { icon: <Heading2 />, label: 'Título de cena', run: () => c().toggleHeading({ level: 2 }).run(), sep: true, active: editor.isActive('heading', { level: 2 }) },
        { icon: <Quote />, label: 'Citação / carta', run: () => c().toggleBlockquote().run(), active: editor.isActive('blockquote') },
        { icon: <Type />, label: 'Parágrafo', run: () => c().setParagraph().run() },
        { icon: <AlignLeft />, label: 'Alinhar à esquerda', run: () => c().setTextAlign('left').run(), sep: true, active: editor.isActive({ textAlign: 'left' }) },
        { icon: <AlignCenter />, label: 'Centralizar', run: () => c().setTextAlign('center').run(), active: editor.isActive({ textAlign: 'center' }) },
        { icon: <AlignRight />, label: 'Alinhar à direita', run: () => c().setTextAlign('right').run(), active: editor.isActive({ textAlign: 'right' }) },
        { icon: <AlignJustify />, label: 'Justificar', run: () => c().setTextAlign('justify').run(), active: editor.isActive({ textAlign: 'justify' }) },
        { icon: <Sparkles />, label: 'Quebra de cena', run: () => c().setHorizontalRule().run(), sep: true },
        { icon: <FilePlus2 />, label: 'Nova página (Ctrl+Shift+Enter)', run: () => c().insertPageBreak().run() },
        { icon: <ImagePlus />, label: 'Imagem', run: () => fileRef.current?.click() },
        { icon: <Eraser />, label: 'Limpar formatação', run: () => c().unsetAllMarks().clearNodes().unsetTextAlign().run() },
        { icon: <Undo2 />, label: 'Desfazer (Ctrl+Z)', run: () => c().undo().run(), sep: true },
        { icon: <Redo2 />, label: 'Refazer (Ctrl+Shift+Z)', run: () => c().redo().run() },
      ]
    : [];

  return (
    <div
      className="nb-writer relative flex flex-col h-full min-h-0"
      data-paper={prefs.paper}
      data-immersive={immersive}
      style={{ ['--paper-font' as string]: FONTS[prefs.font].css, ['--paper-size' as string]: `${prefs.size}px` }}
    >
      {/* barra do escritor */}
      <div className="nb-writer-chrome sticky top-0 z-20 flex items-center gap-1 px-3 py-2 border-b border-[var(--nb-line)] bg-[var(--nb-bg)]/90 backdrop-blur">
        <div className="flex items-center gap-0.5 overflow-x-auto flex-1 min-w-0" style={{ scrollbarWidth: 'none' }}>
          {tools.map((t) => (
            <span key={t.label} className="flex items-center">
              {t.sep && <span className="w-px h-4 mx-1 bg-[var(--nb-line)]" />}
              <button
                type="button"
                title={t.label}
                aria-label={t.label}
                onMouseDown={(e) => e.preventDefault()}
                onClick={t.run}
                aria-pressed={t.active}
                className={`p-1.5 rounded-md [&>svg]:w-4 [&>svg]:h-4 ${
                  t.active ? 'bg-[var(--nb-hl-soft)] text-[var(--nb-hl)]' : 'text-[var(--nb-ink-3)] hover:text-[var(--nb-ink)] hover:bg-[var(--nb-pane-2)]'
                }`}
              >
                {t.icon}
              </button>
            </span>
          ))}
          {uploading && <Loader2 className="w-4 h-4 ml-2 animate-spin text-[var(--nb-ink-3)]" />}
        </div>
        <button
          type="button"
          title="Modo foco: destaca só o parágrafo atual"
          aria-pressed={prefs.focus}
          onClick={() => setPref('focus', !prefs.focus)}
          className={`p-1.5 rounded-md [&>svg]:w-4 [&>svg]:h-4 ${prefs.focus ? 'text-amber-400 bg-amber-400/10' : 'text-[var(--nb-ink-3)] hover:text-[var(--nb-ink)]'}`}
        >
          <Focus />
        </button>
        <div className="relative">
          <button
            type="button"
            title="Aparência da página"
            onClick={() => setShowPrefs((v) => !v)}
            className="p-1.5 rounded-md text-[var(--nb-ink-3)] hover:text-[var(--nb-ink)] [&>svg]:w-4 [&>svg]:h-4"
          >
            <Settings2 />
          </button>
          {showPrefs && (
            <div className="absolute right-0 top-full mt-2 z-40 w-72 p-4 space-y-4 rounded-2xl bg-[var(--nb-pane)] border border-[var(--nb-line)] shadow-2xl text-[12px]">
              <PrefRow label="Papel">
                {(['claro', 'sepia', 'noite'] as const).map((p) => (
                  <Chip key={p} on={prefs.paper === p} onClick={() => setPref('paper', p)}>
                    <span
                      className="w-3 h-3 rounded-full border border-black/20"
                      style={{ background: p === 'claro' ? '#fbf8f1' : p === 'sepia' ? '#f3e7cf' : '#17171c' }}
                    />
                    {p === 'sepia' ? 'Sépia' : p === 'claro' ? 'Claro' : 'Noite'}
                  </Chip>
                ))}
              </PrefRow>
              <PrefRow label="Fonte">
                {(Object.keys(FONTS) as WriterPrefs['font'][]).map((f) => (
                  <Chip key={f} on={prefs.font === f} onClick={() => setPref('font', f)}>
                    <span style={{ fontFamily: FONTS[f].css }}>{FONTS[f].label}</span>
                  </Chip>
                ))}
              </PrefRow>
              <PrefRow label={`Tamanho · ${prefs.size}px`}>
                <input
                  type="range"
                  min={15}
                  max={26}
                  value={prefs.size}
                  onChange={(e) => setPref('size', Number(e.target.value))}
                  className="w-full accent-[var(--nb-hl)]"
                />
              </PrefRow>
              <PrefRow label="Largura">
                {(['estreita', 'normal', 'larga'] as const).map((w) => (
                  <Chip key={w} on={prefs.width === w} onClick={() => setPref('width', w)}>
                    {w[0].toUpperCase() + w.slice(1)}
                  </Chip>
                ))}
              </PrefRow>
              <label className="flex items-center justify-between gap-3 cursor-pointer">
                <span>
                  <b className="block text-[var(--nb-ink)]">Máquina de escrever</b>
                  <span className="text-[var(--nb-ink-3)]">a linha atual fica sempre no meio da tela</span>
                </span>
                <input type="checkbox" checked={prefs.typewriter} onChange={(e) => setPref('typewriter', e.target.checked)} className="accent-[var(--nb-hl)] w-4 h-4" />
              </label>
            </div>
          )}
        </div>
        <button
          type="button"
          title={immersive ? 'Sair do modo imersivo (Esc)' : 'Modo imersivo: só você e a página'}
          onClick={() => onImmersive(!immersive)}
          className="p-1.5 rounded-md text-[var(--nb-ink-3)] hover:text-[var(--nb-ink)] [&>svg]:w-4 [&>svg]:h-4"
        >
          {immersive ? <Minimize2 /> : <Maximize2 />}
        </button>
      </div>

      {/* mesa + papel */}
      <div ref={scrollRef} className="nb-scroll flex-1 min-h-0 overflow-y-auto px-3 sm:px-6 py-8 sm:py-12" onClick={() => setShowPrefs(false)}>
        <div className="nb-paper-sheet px-6 sm:px-14 pt-12 sm:pt-16 pb-16" style={{ maxWidth: WIDTHS[prefs.width] }}>
          {book && (
            <button type="button" onClick={() => onOpen(book.id)} className="nb-ornament mb-3 w-full hover:opacity-100 opacity-80">
              {book.title.toUpperCase()} · CAPÍTULO {idx + 1 || ''}
            </button>
          )}
          <input
            className="nb-chapter-title"
            value={item.title}
            placeholder="Título do capítulo"
            onChange={(e) => api.update(item.id, { title: e.target.value.slice(0, 200) || 'Sem título' }, { debounce: 700 })}
            aria-label="Título do capítulo"
          />
          <span className="nb-ornament mt-3 mb-10" aria-hidden="true">
            ❦
          </span>
          {editor ? (
            <>
              <BubbleMenu editor={editor} shouldShow={showTextMenu}>
                <div className="nb-rich-bubble" style={{ fontFamily: 'var(--font-sans, ui-sans-serif), system-ui, sans-serif' }}>
                  <EntryLinkButtons editor={editor} />
                </div>
              </BubbleMenu>
              <BubbleMenu pluginKey="imageBar" editor={editor} shouldShow={showImageMenu}>
                <div style={{ fontFamily: 'var(--font-sans, ui-sans-serif), system-ui, sans-serif' }}>
                  <ImageBar editor={editor} />
                </div>
              </BubbleMenu>
              <EditorContent editor={editor} />
            </>
          ) : (
            <div className="py-10 grid place-items-center text-[var(--paper-ink-2)]">
              <Loader2 className="w-5 h-5 animate-spin" />
            </div>
          )}
        </div>

        {/* página cheia: recomenda começar outra */}
        {editor && paging.full && !dismissed.has(paging.current) && (
          <div className="nb-page-full" role="status">
            <span className="w-8 h-8 shrink-0 grid place-items-center rounded-lg bg-amber-500/15 text-amber-500">
              <FilePlus2 className="w-4 h-4" />
            </span>
            <span className="min-w-0 flex-1">
              <span className="block text-[13px] font-bold">A página {paging.current} chegou ao fim</span>
              <span className="block text-[12px] text-[var(--nb-ink-3)]">Comece uma nova página para manter a diagramação do livro.</span>
            </span>
            <button
              type="button"
              onClick={() => editor.chain().focus().insertPageBreak().run()}
              className="shrink-0 h-8 px-3 rounded-lg bg-[var(--nb-hl)] text-white text-[12px] font-bold hover:opacity-90"
            >
              Nova página
            </button>
            <button
              type="button"
              aria-label="Dispensar"
              onClick={() => setDismissed((d) => new Set(d).add(paging.current))}
              className="shrink-0 p-1.5 rounded-md text-[var(--nb-ink-3)] hover:text-[var(--nb-ink)]"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        )}

        {/* nota do autor + navegação */}
        <div className="nb-writer-chrome mx-auto mt-8 space-y-4" style={{ maxWidth: WIDTHS[prefs.width] }}>
          <div className="rounded-2xl border border-[var(--nb-line)] bg-[var(--nb-pane)] p-4">
            <label className="nb-pane-title block mb-2">Nota do autor (aparece no fim do capítulo publicado)</label>
            <textarea
              defaultValue={String(item.data?.authorNote || '')}
              key={`note-${item.id}`}
              onChange={(e) => api.update(item.id, { data: { ...dataRef.current, authorNote: e.target.value.slice(0, 2000) } }, { debounce: 900 })}
              rows={2}
              placeholder="Obrigado por ler! Deixe seu comentário…"
              className="w-full resize-y bg-transparent text-sm outline-none placeholder:text-[var(--nb-ink-3)]"
            />
          </div>
          <div className="flex items-center justify-between gap-3">
            {prev ? (
              <button type="button" onClick={() => onOpen(prev.id)} className="flex items-center gap-1.5 text-sm text-[var(--nb-ink-2)] hover:text-[var(--nb-ink)] min-w-0">
                <ChevronLeft className="w-4 h-4 shrink-0" />
                <span className="truncate">{prev.title}</span>
              </button>
            ) : (
              <span />
            )}
            {next ? (
              <button type="button" onClick={() => onOpen(next.id)} className="flex items-center gap-1.5 text-sm text-[var(--nb-ink-2)] hover:text-[var(--nb-ink)] min-w-0">
                <span className="truncate">{next.title}</span>
                <ChevronRight className="w-4 h-4 shrink-0" />
              </button>
            ) : (
              <span />
            )}
          </div>
        </div>
      </div>

      {/* rodapé de estatísticas */}
      <div className="nb-writer-chrome flex flex-wrap items-center gap-x-4 gap-y-2 px-4 py-2 border-t border-[var(--nb-line)] bg-[var(--nb-pane)] text-[11px] text-[var(--nb-ink-3)]">
        <div className="flex items-center gap-2" title={`Meta do capítulo: ${goal.toLocaleString('pt-BR')} palavras`}>
          <svg width="22" height="22" viewBox="0 0 22 22" className="nb-ring">
            <circle cx="11" cy="11" r="9" fill="none" stroke="var(--nb-line)" strokeWidth="3" />
            <circle
              cx="11"
              cy="11"
              r="9"
              fill="none"
              stroke={pct >= 1 ? '#22c55e' : 'var(--nb-hl)'}
              strokeWidth="3"
              strokeLinecap="round"
              strokeDasharray={2 * Math.PI * 9}
              strokeDashoffset={2 * Math.PI * 9 * (1 - pct)}
            />
          </svg>
          <span className="font-mono text-[var(--nb-ink)]">{words.toLocaleString('pt-BR')}</span>
          <span>/ {goal.toLocaleString('pt-BR')} palavras</span>
        </div>
        <span className="hidden sm:inline font-mono">+{session.toLocaleString('pt-BR')} nesta sessão</span>
        <span className="hidden md:inline">{pages} {pages === 1 ? 'página' : 'páginas'} · pág. {paging.current} {Math.round(Math.min(1, paging.fill) * 100)}% · {readMin} min de leitura</span>
        <div className="flex-1" />
        <select
          value={status}
          onChange={(e) => api.update(item.id, { data: { ...dataRef.current, status: e.target.value as ChapterStatus } })}
          className="h-7 px-2 rounded-lg bg-[var(--nb-bg)] border border-[var(--nb-line)] text-[11px] font-semibold outline-none"
          style={{ color: statusMeta.color }}
          aria-label="Status do capítulo"
        >
          {CHAPTER_STATUS.map((s) => (
            <option key={s.id} value={s.id}>
              {s.label}
            </option>
          ))}
        </select>
        {item.published_post_id && (
          <a href={`/post/${item.published_post_id}`} target="_blank" className="flex items-center gap-1 text-purple-400 hover:underline">
            <ExternalLink className="w-3.5 h-3.5" /> ver post
          </a>
        )}
        <button
          type="button"
          onClick={() => {
            if (editor) save(editor);
            onPublish({ ...item, data: { ...item.data, html: sanitizeWriterHtml(editor?.getHTML() || '') } });
          }}
          className="flex items-center gap-1.5 h-7 px-3 rounded-lg bg-[var(--nb-hl)] text-white font-bold hover:opacity-90"
        >
          <Send className="w-3.5 h-3.5" />
          <span className="sm:hidden">Publicar</span>
          <span className="hidden sm:inline">{item.published_post_id ? 'Publicar de novo' : 'Publicar no Insight'}</span>
        </button>
      </div>

      <input
        ref={fileRef}
        type="file"
        accept="image/*"
        hidden
        multiple
        onChange={(e) => {
          const files = Array.from(e.target.files || []);
          e.target.value = '';
          void insertImages(files);
        }}
      />
    </div>
  );
}

function PrefRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <p className="nb-pane-title">{label}</p>
      <div className="flex flex-wrap gap-1.5">{children}</div>
    </div>
  );
}

function Chip({ on, onClick, children }: { on: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg border text-[12px] ${
        on ? 'border-[var(--nb-hl)] bg-[var(--nb-hl-soft)] text-[var(--nb-ink)]' : 'border-[var(--nb-line)] text-[var(--nb-ink-2)] hover:text-[var(--nb-ink)]'
      }`}
    >
      {children}
    </button>
  );
}
