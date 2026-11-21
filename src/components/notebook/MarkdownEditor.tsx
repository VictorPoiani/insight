'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Bold,
  Italic,
  Strikethrough,
  Highlighter,
  Code2,
  Link2,
  Brackets,
  ListChecks,
  List,
  ListOrdered,
  Quote,
  MessageSquareWarning,
  Table2,
  Minus,
  ImagePlus,
  Heading1,
  Heading2,
  Heading3,
  Eye,
  PencilLine,
  Columns2,
  Loader2,
} from 'lucide-react';
import { renderMarkdown, toggleTaskLine } from '@/lib/notebook/markdown';
import { uploadMediaToInsight } from '@/lib/mediaCompressor';
import { getUserUploadLimitBytes } from '@/lib/contributorLevels';
import type { NotebookItem } from '@/lib/notebook/types';

export type MdMode = 'edit' | 'preview' | 'split';
const MODE_KEY = 'insight-notebook-md-mode';

interface Props {
  item: NotebookItem;
  titles: string[];
  titleExists: (t: string) => boolean;
  onChange: (content: string) => void;
  onOpenLink: (title: string) => void;
  onTag: (tag: string) => void;
  onAsset: (r2Key: string | null, url: string) => void;
  role?: string | null;
  level?: number | null;
  /** pedido externo para rolar até uma linha (outline) */
  jumpTo?: { line: number; at: number } | null;
}

/** Posição (px) do cursor dentro do textarea — técnica do "espelho". */
function caretCoords(el: HTMLTextAreaElement, pos: number) {
  const div = document.createElement('div');
  const cs = getComputedStyle(el);
  for (const p of ['font', 'letterSpacing', 'lineHeight', 'padding', 'border', 'boxSizing', 'whiteSpace', 'wordWrap', 'tabSize'] as const) {
    (div.style as any)[p] = (cs as any)[p];
  }
  div.style.position = 'absolute';
  div.style.visibility = 'hidden';
  div.style.whiteSpace = 'pre-wrap';
  div.style.overflowWrap = 'anywhere';
  div.style.width = `${el.clientWidth}px`;
  div.textContent = el.value.slice(0, pos);
  const span = document.createElement('span');
  span.textContent = el.value.slice(pos) || '.';
  div.appendChild(span);
  document.body.appendChild(div);
  const top = span.offsetTop - el.scrollTop;
  const left = span.offsetLeft;
  document.body.removeChild(div);
  return { top, left };
}

export function MarkdownEditor({ item, titles, titleExists, onChange, onOpenLink, onTag, onAsset, role, level, jumpTo }: Props) {
  const [mode, setMode] = useState<MdMode>('edit');
  const [value, setValue] = useState(item.content);
  const [suggest, setSuggest] = useState<{ query: string; start: number; top: number; left: number; index: number } | null>(null);
  const [uploading, setUploading] = useState<string | null>(null);
  const taRef = useRef<HTMLTextAreaElement>(null);
  const previewRef = useRef<HTMLDivElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const itemId = item.id;

  useEffect(() => {
    try {
      const m = localStorage.getItem(MODE_KEY) as MdMode | null;
      if (m === 'edit' || m === 'preview' || m === 'split') setMode(m);
    } catch {
      /* ignora */
    }
  }, []);
  const changeMode = (m: MdMode) => {
    setMode(m);
    try {
      localStorage.setItem(MODE_KEY, m);
    } catch {
      /* ignora */
    }
  };

  // troca de nota: recarrega o texto
  useEffect(() => {
    setValue(item.content);
    setSuggest(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [itemId, item._full]);

  // atalho Ctrl+E alterna leitura/edição
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'e') {
        e.preventDefault();
        changeMode(mode === 'preview' ? 'edit' : 'preview');
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [mode]);

  // autoaltura do textarea
  useEffect(() => {
    const ta = taRef.current;
    if (!ta) return;
    ta.style.height = 'auto';
    ta.style.height = `${Math.max(ta.scrollHeight, 420)}px`;
  }, [value, mode]);

  // pular para uma linha (outline)
  useEffect(() => {
    if (!jumpTo) return;
    if (mode !== 'edit' && previewRef.current) {
      const el = previewRef.current.querySelector(`[data-line="${jumpTo.line}"]`);
      el?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
    if (mode !== 'preview' && taRef.current) {
      const ta = taRef.current;
      const lines = ta.value.split('\n');
      const pos = lines.slice(0, jumpTo.line).reduce((n, l) => n + l.length + 1, 0);
      ta.focus();
      ta.setSelectionRange(pos, pos);
      const { top } = caretCoords(ta, pos);
      ta.closest('.nb-scroll')?.scrollTo({ top: ta.offsetTop + top - 80, behavior: 'smooth' });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [jumpTo?.at]);

  const commit = useCallback(
    (next: string) => {
      setValue(next);
      onChange(next);
    },
    [onChange]
  );

  const html = useMemo(() => renderMarkdown(value, { titleExists }), [value, titleExists]);

  // ------------------------------------------------------------ edição
  /**
   * Troca o trecho [start, end) por `text` direto no textarea (insertText):
   * o cursor fica certo na hora (sem esperar o React) e o Ctrl+Z funciona.
   */
  function editRange(start: number, end: number, text: string, selStart?: number, selEnd?: number) {
    const ta = taRef.current;
    if (!ta) return;
    ta.focus();
    ta.setSelectionRange(start, end);
    let ok = false;
    try {
      ok = document.execCommand('insertText', false, text);
    } catch {
      ok = false;
    }
    if (!ok || ta.value.slice(start, start + text.length) !== text) {
      // navegador sem insertText: aplica pelo estado
      const next = ta.value.slice(0, start) + text + ta.value.slice(start + (ok ? text.length : end - start));
      ta.value = next;
      commit(next);
    }
    const s0 = start + (selStart ?? text.length);
    const s1 = start + (selEnd ?? selStart ?? text.length);
    ta.setSelectionRange(s0, s1);
  }

  function replaceSel(fn: (sel: string) => { text: string; selStart?: number; selEnd?: number }) {
    const ta = taRef.current;
    if (!ta) return;
    // sempre o texto atual do DOM: o estado pode estar um render atrás
    const value = ta.value;
    const { selectionStart: a, selectionEnd: b } = ta;
    const sel = value.slice(a, b);
    const r = fn(sel);
    editRange(a, b, r.text, r.selStart, r.selEnd);
  }

  const wrap = (l: string, r = l, ph = 'texto') =>
    replaceSel((sel) => {
      const inner = sel || ph;
      return { text: `${l}${inner}${r}`, selStart: l.length, selEnd: l.length + inner.length };
    });

  function prefixLines(prefix: string | ((i: number) => string)) {
    const ta = taRef.current;
    if (!ta) return;
    const value = ta.value;
    const a = value.lastIndexOf('\n', ta.selectionStart - 1) + 1;
    let b = value.indexOf('\n', ta.selectionEnd);
    if (b < 0) b = value.length;
    const block = value
      .slice(a, b)
      .split('\n')
      .map((l, i) => {
        const p = typeof prefix === 'string' ? prefix : prefix(i);
        return l.startsWith(p) ? l.slice(p.length) : p + l.replace(/^(#{1,6}\s|[-*]\s(\[[ x]\]\s)?|\d+\.\s|>\s)/, '');
      })
      .join('\n');
    editRange(a, b, block);
  }

  function insertBlock(text: string) {
    replaceSel(() => {
      const ta = taRef.current!;
      const before = ta.value.slice(0, ta.selectionStart);
      const lead = before && !before.endsWith('\n\n') ? (before.endsWith('\n') ? '\n' : '\n\n') : '';
      return { text: `${lead}${text}\n` };
    });
  }

  async function uploadImages(files: File[]) {
    const imgs = files.filter((f) => f.type.startsWith('image/') || f.type.startsWith('video/'));
    if (!imgs.length) return;
    const ta = taRef.current;
    let insertAt = ta ? ta.selectionStart : value.length;
    let cur = ta ? ta.value : value;
    for (const f of imgs) {
      const ph = `![Enviando ${f.name}…]()`;
      cur = cur.slice(0, insertAt) + ph + cur.slice(insertAt);
      commit(cur);
      setUploading(f.name);
      try {
        const res = await uploadMediaToInsight(f, {
          budgetBytes: getUserUploadLimitBytes(level ?? 0, role ?? undefined),
          asImage: f.type.startsWith('image/') && f.type !== 'image/gif',
          scope: 'notebook',
        });
        onAsset(res.r2Key, res.publicUrl);
        const md = `![${f.name.replace(/\.[^.]+$/, '').replace(/[[\]]/g, '')}](${res.publicUrl})`;
        cur = cur.replace(ph, md);
        insertAt = cur.indexOf(md) + md.length;
      } catch (err) {
        cur = cur.replace(ph, '');
        alert(err instanceof Error ? err.message : 'Falha no envio da imagem.');
      }
      commit(cur);
    }
    setUploading(null);
  }

  function onKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    const ta = e.currentTarget;
    const value = ta.value;

    // autocomplete de [[links]]
    if (suggest) {
      const list = filteredSuggest;
      if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
        e.preventDefault();
        const d = e.key === 'ArrowDown' ? 1 : -1;
        setSuggest({ ...suggest, index: (suggest.index + d + list.length + 1) % (list.length + 1) });
        return;
      }
      if (e.key === 'Enter' || e.key === 'Tab') {
        e.preventDefault();
        pickSuggest(list[suggest.index] ?? suggest.query);
        return;
      }
      if (e.key === 'Escape') {
        setSuggest(null);
        return;
      }
    }

    const mod = e.ctrlKey || e.metaKey;
    if (mod && e.key.toLowerCase() === 'b') return e.preventDefault(), wrap('**');
    if (mod && e.key.toLowerCase() === 'i') return e.preventDefault(), wrap('*');
    if (mod && e.key.toLowerCase() === 'k') {
      if (ta.selectionStart !== ta.selectionEnd) return e.preventDefault(), wrap('[', '](https://)');
    }
    if (mod && e.shiftKey && e.key.toLowerCase() === 'h') return e.preventDefault(), wrap('==');
    if (mod && e.key === 'Enter') {
      // alterna tarefa da linha
      e.preventDefault();
      const line = value.slice(0, ta.selectionStart).split('\n').length - 1;
      const l = value.split('\n')[line] || '';
      if (/\[( |x|X)\]/.test(l)) {
        const ls = value.split('\n').slice(0, line).reduce((n, x) => n + x.length + 1, 0);
        const cur = ta.selectionStart;
        editRange(ls, ls + l.length, l.replace(/\[( |x|X)\]/, (_, c) => (c === ' ' ? '[x]' : '[ ]')));
        ta.setSelectionRange(cur, cur);
      }
      else prefixLines('- [ ] ');
      return;
    }

    if (e.key === 'Tab') {
      e.preventDefault();
      const a = value.lastIndexOf('\n', ta.selectionStart - 1) + 1;
      const line = value.slice(a, value.indexOf('\n', ta.selectionStart) < 0 ? value.length : value.indexOf('\n', ta.selectionStart));
      if (/^\s*([-*+]|\d+[.)])\s/.test(line)) {
        const cur = ta.selectionStart;
        const nextLine = e.shiftKey ? line.replace(/^ {1,2}/, '') : '  ' + line;
        editRange(a, a + line.length, nextLine);
        const pos = Math.max(a, cur + (nextLine.length - line.length));
        ta.setSelectionRange(pos, pos);
      } else if (!e.shiftKey) {
        replaceSel(() => ({ text: '  ' }));
      }
      return;
    }

    // Enter continua listas/tarefas/citações
    if (e.key === 'Enter' && !e.shiftKey) {
      const a = value.lastIndexOf('\n', ta.selectionStart - 1) + 1;
      const line = value.slice(a, ta.selectionStart);
      const m = line.match(/^(\s*)([-*+] \[[ xX]\] |[-*+] |(\d+)([.)]) |> )/);
      if (m) {
        e.preventDefault();
        const empty = line.trim() === m[2].trim();
        if (empty) {
          // segunda tecla Enter numa lista vazia encerra a lista
          editRange(a, ta.selectionStart, '');
          return;
        }
        let marker = m[2].replace(/\[[xX]\]/, '[ ]');
        if (m[3]) marker = `${Number(m[3]) + 1}${m[4]} `;
        replaceSel(() => ({ text: `\n${m[1]}${marker}` }));
      }
    }
  }

  function onInput(e: React.ChangeEvent<HTMLTextAreaElement>) {
    const ta = e.target;
    commit(ta.value);
    // detecta [[ aberto antes do cursor
    const before = ta.value.slice(0, ta.selectionStart);
    const open = before.lastIndexOf('[[');
    const close = before.lastIndexOf(']]');
    if (open >= 0 && open > close && !/\n/.test(before.slice(open))) {
      const query = before.slice(open + 2);
      if (query.length <= 60) {
        const { top, left } = caretCoords(ta, open);
        setSuggest((s) => ({ query, start: open + 2, top: top + 26, left: Math.min(left, ta.clientWidth - 260), index: s?.index ?? 0 }));
        return;
      }
    }
    setSuggest(null);
  }

  const filteredSuggest = useMemo(() => {
    if (!suggest) return [];
    const q = suggest.query.toLowerCase().split('|')[0];
    return Array.from(new Set(titles))
      .filter((t) => t.toLowerCase() !== item.title.toLowerCase() && t.toLowerCase().includes(q))
      .sort((a, b) => Number(!a.toLowerCase().startsWith(q)) - Number(!b.toLowerCase().startsWith(q)) || a.length - b.length)
      .slice(0, 8);
  }, [suggest, titles, item.title]);

  function pickSuggest(title: string) {
    const ta = taRef.current;
    if (!ta || !suggest) return;
    const value = ta.value;
    const after = value.slice(ta.selectionStart);
    const hasClose = after.startsWith(']]');
    const text = title + (hasClose ? '' : ']]');
    setSuggest(null);
    editRange(suggest.start, ta.selectionStart, text, title.length + 2);
  }

  // cliques no preview: links internos, tags, tarefas
  function onPreviewClick(e: React.MouseEvent) {
    const t = e.target as HTMLElement;
    const wl = t.closest('[data-wikilink]') as HTMLElement | null;
    if (wl) {
      e.preventDefault();
      onOpenLink(wl.dataset.wikilink || '');
      return;
    }
    const tag = t.closest('[data-tag]') as HTMLElement | null;
    if (tag) return onTag(tag.dataset.tag || '');
    if (t instanceof HTMLInputElement && t.dataset.taskLine) {
      commit(toggleTaskLine(value, Number(t.dataset.taskLine)));
    }
  }

  const tools: { icon: React.ReactElement; label: string; run: () => void; sep?: boolean }[] = [
    { icon: <Heading1 />, label: 'Título 1', run: () => prefixLines('# ') },
    { icon: <Heading2 />, label: 'Título 2', run: () => prefixLines('## ') },
    { icon: <Heading3 />, label: 'Título 3', run: () => prefixLines('### ') },
    { icon: <Bold />, label: 'Negrito (Ctrl+B)', run: () => wrap('**'), sep: true },
    { icon: <Italic />, label: 'Itálico (Ctrl+I)', run: () => wrap('*') },
    { icon: <Strikethrough />, label: 'Tachado', run: () => wrap('~~') },
    { icon: <Highlighter />, label: 'Marca-texto (Ctrl+Shift+H)', run: () => wrap('==') },
    { icon: <Code2 />, label: 'Código', run: () => wrap('`') },
    { icon: <Brackets />, label: 'Link interno [[ ]]', run: () => wrap('[[', ']]', 'Nome da nota'), sep: true },
    { icon: <Link2 />, label: 'Link (Ctrl+K)', run: () => wrap('[', '](https://)', 'texto') },
    { icon: <List />, label: 'Lista', run: () => prefixLines('- '), sep: true },
    { icon: <ListOrdered />, label: 'Lista numerada', run: () => prefixLines((i) => `${i + 1}. `) },
    { icon: <ListChecks />, label: 'Tarefa (Ctrl+Enter)', run: () => prefixLines('- [ ] ') },
    { icon: <Quote />, label: 'Citação', run: () => prefixLines('> ') },
    { icon: <MessageSquareWarning />, label: 'Callout', run: () => insertBlock('> [!nota] Título\n> Conteúdo'), sep: true },
    { icon: <Table2 />, label: 'Tabela', run: () => insertBlock('| Coluna | Coluna |\n| --- | --- |\n|  |  |') },
    { icon: <Minus />, label: 'Linha', run: () => insertBlock('---') },
    { icon: <ImagePlus />, label: 'Imagem (ou cole / arraste)', run: () => fileRef.current?.click() },
  ];

  return (
    <div className="flex flex-col gap-3">
      {/* barra */}
      <div className="sticky top-0 z-20 -mx-1 flex items-center gap-1 py-1.5 px-1 bg-[var(--nb-bg)]/95 backdrop-blur">
        {mode !== 'preview' && (
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
          </div>
        )}
        {mode === 'preview' && <div className="flex-1" />}
        {uploading && (
          <span className="flex items-center gap-1.5 text-[11px] text-[var(--nb-ink-3)] shrink-0">
            <Loader2 className="w-3.5 h-3.5 animate-spin" /> enviando…
          </span>
        )}
        <div className="flex items-center p-0.5 rounded-lg bg-[var(--nb-pane)] border border-[var(--nb-line)] shrink-0">
          {(
            [
              ['edit', <PencilLine key="e" />, 'Editar'],
              ['split', <Columns2 key="s" />, 'Lado a lado'],
              ['preview', <Eye key="p" />, 'Leitura (Ctrl+E)'],
            ] as const
          ).map(([m, icon, label]) => (
            <button
              key={m}
              type="button"
              title={label}
              aria-label={label}
              aria-pressed={mode === m}
              onClick={() => changeMode(m)}
              className={`p-1.5 rounded-md [&>svg]:w-3.5 [&>svg]:h-3.5 ${
                mode === m ? 'bg-[var(--nb-hl)] text-white' : 'text-[var(--nb-ink-3)] hover:text-[var(--nb-ink)]'
              } ${m === 'split' ? 'hidden lg:block' : ''}`}
            >
              {icon}
            </button>
          ))}
        </div>
      </div>

      <div className={mode === 'split' ? 'grid lg:grid-cols-2 gap-8' : ''}>
        {mode !== 'preview' && (
          <div
            className="relative"
            onDragOver={(e) => {
              if (e.dataTransfer.types.includes('Files')) e.preventDefault();
            }}
            onDrop={(e) => {
              if (e.dataTransfer.files.length) {
                e.preventDefault();
                void uploadImages(Array.from(e.dataTransfer.files));
              }
            }}
          >
            <textarea
              ref={taRef}
              value={value}
              onChange={onInput}
              onKeyDown={onKeyDown}
              onBlur={() => setTimeout(() => setSuggest(null), 150)}
              onPaste={(e) => {
                const files = Array.from(e.clipboardData.files);
                if (files.length) {
                  e.preventDefault();
                  void uploadImages(files);
                }
              }}
              spellCheck
              placeholder={'Escreva livremente…\n\n# Títulos com #   **negrito**   [[link para outra nota]]   #tag   - [ ] tarefa'}
              className="nb-source w-full resize-none bg-transparent outline-none placeholder:text-[var(--nb-ink-3)] placeholder:opacity-70"
              aria-label="Conteúdo da nota em markdown"
            />
            {suggest && (
              <div
                className="absolute z-30 w-64 py-1 rounded-xl bg-[var(--nb-pane)] border border-[var(--nb-line)] shadow-2xl text-[13px]"
                style={{ top: suggest.top, left: Math.max(0, suggest.left) }}
              >
                <p className="px-3 py-1 nb-pane-title">Link para nota</p>
                {filteredSuggest.map((t, i) => (
                  <button
                    key={`${t}-${i}`}
                    type="button"
                    onMouseDown={(e) => {
                      e.preventDefault();
                      pickSuggest(t);
                    }}
                    className={`w-full text-left px-3 py-1.5 truncate ${i === suggest.index ? 'bg-[var(--nb-hl-soft)] text-[var(--nb-ink)]' : 'text-[var(--nb-ink-2)]'}`}
                  >
                    {t}
                  </button>
                ))}
                {suggest.query.trim() && (
                  <button
                    type="button"
                    onMouseDown={(e) => {
                      e.preventDefault();
                      pickSuggest(suggest.query.trim());
                    }}
                    className={`w-full text-left px-3 py-1.5 truncate ${
                      suggest.index === filteredSuggest.length ? 'bg-[var(--nb-hl-soft)]' : ''
                    } text-[var(--nb-hl)]`}
                  >
                    + Criar link “{suggest.query.trim()}”
                  </button>
                )}
                {!filteredSuggest.length && !suggest.query.trim() && (
                  <p className="px-3 py-1.5 text-[var(--nb-ink-3)]">Digite o nome da nota…</p>
                )}
              </div>
            )}
          </div>
        )}
        {mode !== 'edit' && (
          <div
            ref={previewRef}
            className={`nb-md ${mode === 'split' ? 'lg:border-l lg:border-[var(--nb-line)] lg:pl-8' : ''}`}
            onClick={onPreviewClick}
            // HTML gerado por renderMarkdown: todo texto do usuário é escapado
            dangerouslySetInnerHTML={{
              __html: html || '<p style="opacity:.5">Nada escrito ainda. Toque em editar para começar.</p>',
            }}
          />
        )}
      </div>

      <input
        ref={fileRef}
        type="file"
        accept="image/*,video/*"
        multiple
        hidden
        onChange={(e) => {
          const files = Array.from(e.target.files || []);
          e.target.value = '';
          void uploadImages(files);
        }}
      />
    </div>
  );
}
