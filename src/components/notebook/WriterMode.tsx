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
} from 'lucide-react';
import { countWords, htmlToText } from '@/lib/notebook/markdown';
import { uploadMediaToInsight } from '@/lib/mediaCompressor';
import { getUserUploadLimitBytes } from '@/lib/contributorLevels';
import type { ChapterStatus, NotebookItem, WriterPrefs } from '@/lib/notebook/types';
import type { NotebookApi } from '@/lib/notebook/useNotebook';


/** Lista branca de tags/atributos do texto do capítulo (DOM, não regex). */
const ALLOWED = new Set(['P', 'BR', 'B', 'STRONG', 'I', 'EM', 'U', 'S', 'STRIKE', 'DEL', 'H2', 'H3', 'BLOCKQUOTE', 'HR', 'IMG', 'SPAN']);
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
        if (node.tagName === 'IMG' && a.name === 'src' && /^https?:\/\//i.test(a.value)) continue;
        if (node.tagName === 'IMG' && a.name === 'alt') continue;
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
  const paperRef = useRef<HTMLDivElement>(null);
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

  // carrega o HTML do capítulo quando troca de capítulo
  useEffect(() => {
    const el = paperRef.current;
    if (!el || !item._full) return;
    const html = sanitizeWriterHtml(String(item.data?.html || ''));
    el.innerHTML = html || '<p><br></p>';
    const w = countWords(htmlToText(html));
    setWords(w);
    lastWords.current = w;
    sessionStart.current = w;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [item.id, item._full]);

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

  const save = useCallback(() => {
    const el = paperRef.current;
    if (!el) return;
    const html = sanitizeWriterHtml(el.innerHTML);
    const w = countWords(htmlToText(html));
    if (w > lastWords.current) pendingHistory.current += w - lastWords.current;
    lastWords.current = w;
    setWords(w);
    apiRef.current.update(item.id, { data: { ...dataRef.current, html } }, { debounce: 1200 });
  }, [item.id]);

  // foco e máquina de escrever
  const onSelection = useCallback(() => {
    const el = paperRef.current;
    const sel = document.getSelection();
    if (!el || !sel || !sel.rangeCount || !el.contains(sel.anchorNode)) return;
    let node: Node | null = sel.anchorNode;
    while (node && node.parentNode !== el) node = node.parentNode;
    el.querySelectorAll('.nb-current').forEach((n) => n !== node && n.classList.remove('nb-current'));
    if (node instanceof HTMLElement) node.classList.add('nb-current');
    if (prefs.typewriter && scrollRef.current) {
      const r = sel.getRangeAt(0).getBoundingClientRect();
      const box = scrollRef.current.getBoundingClientRect();
      if (r.height) {
        const target = box.top + box.height * 0.45;
        scrollRef.current.scrollBy({ top: r.top - target, behavior: 'smooth' });
      }
    }
  }, [prefs.typewriter]);

  useEffect(() => {
    document.addEventListener('selectionchange', onSelection);
    return () => document.removeEventListener('selectionchange', onSelection);
  }, [onSelection]);

  // Esc sai do modo imersivo
  useEffect(() => {
    if (!immersive) return;
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onImmersive(false);
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [immersive, onImmersive]);

  const exec = (cmd: string, arg?: string) => {
    paperRef.current?.focus();
    document.execCommand(cmd, false, arg);
    save();
  };

  function onKeyDown(e: React.KeyboardEvent) {
    const mod = e.ctrlKey || e.metaKey;
    if (mod && e.key.toLowerCase() === 'b') return e.preventDefault(), exec('bold');
    if (mod && e.key.toLowerCase() === 'i') return e.preventDefault(), exec('italic');
    if (mod && e.key.toLowerCase() === 'u') return e.preventDefault(), exec('underline');
    // tipografia: -- vira travessão, "..." vira reticências
    if (e.key === '-' || e.key === '.') {
      const sel = document.getSelection();
      const n = sel?.anchorNode;
      if (sel?.isCollapsed && n?.nodeType === Node.TEXT_NODE) {
        const before = (n.textContent || '').slice(0, sel.anchorOffset);
        if (e.key === '-' && before.endsWith('-')) {
          e.preventDefault();
          document.execCommand('delete');
          document.execCommand('insertText', false, '—');
          return save();
        }
        if (e.key === '.' && before.endsWith('..')) {
          e.preventDefault();
          document.execCommand('delete');
          document.execCommand('delete');
          document.execCommand('insertText', false, '…');
          return save();
        }
      }
    }
    // aspas curvas
    if (e.key === '"') {
      const sel = document.getSelection();
      const n = sel?.anchorNode;
      const before = n?.nodeType === Node.TEXT_NODE ? (n.textContent || '').slice(0, sel!.anchorOffset) : '';
      e.preventDefault();
      document.execCommand('insertText', false, !before || /[\s(—[]$/.test(before) ? '“' : '”');
      return save();
    }
  }

  function onPaste(e: React.ClipboardEvent) {
    const files = Array.from(e.clipboardData.files);
    if (files.length) {
      e.preventDefault();
      void insertImages(files);
      return;
    }
    // cola texto puro, cada linha vira um parágrafo (sem estilos de fora)
    e.preventDefault();
    const text = e.clipboardData.getData('text/plain');
    const html = text
      .replace(/\r\n?/g, '\n')
      .split(/\n+/)
      .map((p) => `<p>${p.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;') || '<br>'}</p>`)
      .join('');
    document.execCommand('insertHTML', false, html);
    save();
  }

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
        paperRef.current?.focus();
        document.execCommand('insertHTML', false, `<img src="${res.publicUrl.replace(/"/g, '&quot;')}" alt="" />`);
        save();
      } catch (err) {
        alert(err instanceof Error ? err.message : 'Falha no envio da imagem.');
      }
    }
    setUploading(false);
  }

  const idx = chapters.findIndex((c) => c.id === item.id);
  const prev = idx > 0 ? chapters[idx - 1] : null;
  const next = idx >= 0 && idx < chapters.length - 1 ? chapters[idx + 1] : null;
  const goal = Number(item.data?.wordGoal) || Number(book?.data?.dailyGoal) || 1000;
  const session = Math.max(0, words - (sessionStart.current ?? words));
  const pct = Math.min(1, words / goal);
  const status = (item.data?.status as ChapterStatus) || 'rascunho';
  const statusMeta = CHAPTER_STATUS.find((s) => s.id === status)!;
  const readMin = Math.max(1, Math.round(words / 220));
  const pages = Math.max(1, Math.round(words / 250));

  const tools = useMemo(
    () => [
      { icon: <Bold />, label: 'Negrito (Ctrl+B)', run: () => exec('bold') },
      { icon: <Italic />, label: 'Itálico (Ctrl+I)', run: () => exec('italic') },
      { icon: <Underline />, label: 'Sublinhado (Ctrl+U)', run: () => exec('underline') },
      { icon: <Strikethrough />, label: 'Tachado', run: () => exec('strikeThrough') },
      { icon: <Heading2 />, label: 'Título de cena', run: () => exec('formatBlock', 'h2'), sep: true },
      { icon: <Quote />, label: 'Citação / carta', run: () => exec('formatBlock', 'blockquote') },
      { icon: <Type />, label: 'Parágrafo', run: () => exec('formatBlock', 'p') },
      { icon: <AlignLeft />, label: 'Alinhar à esquerda', run: () => exec('justifyLeft'), sep: true },
      { icon: <AlignCenter />, label: 'Centralizar', run: () => exec('justifyCenter') },
      { icon: <Sparkles />, label: 'Quebra de cena ✦ ✦ ✦', run: () => exec('insertHorizontalRule'), sep: true },
      { icon: <ImagePlus />, label: 'Imagem', run: () => fileRef.current?.click() },
      { icon: <Eraser />, label: 'Limpar formatação', run: () => exec('removeFormat') },
      { icon: <Undo2 />, label: 'Desfazer', run: () => exec('undo'), sep: true },
      { icon: <Redo2 />, label: 'Refazer', run: () => exec('redo') },
    ],
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [save]
  );

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
                className="p-1.5 rounded-md text-[var(--nb-ink-3)] hover:text-[var(--nb-ink)] hover:bg-[var(--nb-pane-2)] [&>svg]:w-4 [&>svg]:h-4"
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
          <div
            ref={paperRef}
            className="nb-paper"
            contentEditable
            suppressContentEditableWarning
            spellCheck
            lang="pt-BR"
            data-focus={prefs.focus}
            data-empty={words === 0}
            data-placeholder="Era uma vez…"
            role="textbox"
            aria-multiline="true"
            aria-label="Texto do capítulo"
            onFocus={() => {
              document.execCommand('defaultParagraphSeparator', false, 'p');
            }}
            onInput={save}
            onKeyDown={onKeyDown}
            onPaste={onPaste}
            onDrop={(e) => {
              if (e.dataTransfer.files.length) {
                e.preventDefault();
                void insertImages(Array.from(e.dataTransfer.files));
              }
            }}
          />
        </div>

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
        <span className="hidden md:inline">~{pages} pág. · {readMin} min de leitura</span>
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
            save();
            onPublish({ ...item, data: { ...item.data, html: sanitizeWriterHtml(paperRef.current?.innerHTML || '') } });
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
