'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { ChevronRight, Columns2, CornerDownLeft, Hash, Plus, Search, TerminalSquare } from 'lucide-react';
import type { NotebookItem } from '@/lib/notebook/types';
import type { NotebookApi } from '@/lib/notebook/useNotebook';
import { entryLook, type NotebookEntry } from '@/lib/notebook/entries';
import { fuzzyScore } from '../Pickers';
import { itemIcon } from '../FileExplorer';
import { EntryAvatar } from '../entries/MentionViews';

/** Uma ação disponível na paleta (Ctrl+K, depois ">"). */
export interface PaletteCommand {
  id: string;
  label: string;
  group: string;
  icon?: React.ReactNode;
  shortcut?: string;
  keywords?: string;
  run: () => void;
}

export interface PaletteHeading {
  text: string;
  level: number;
  go: () => void;
}

export type PaletteMode = '' | '>' | '+' | '#';

type Row =
  | { kind: 'note'; item: NotebookItem; group: string }
  | { kind: 'entry'; entry: NotebookEntry; group: string }
  | { kind: 'cmd'; cmd: PaletteCommand; group: string }
  | { kind: 'heading'; h: PaletteHeading; group: string }
  | { kind: 'create'; title: string; group: string };

const PREFIX: Record<string, PaletteMode> = { '>': '>', '+': '+', '#': '#' };

const norm = (s: string) =>
  s
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '');

function pathOf(items: Record<string, NotebookItem>, item: NotebookItem) {
  const parts: string[] = [];
  let cur = item.parent_id ? items[item.parent_id] : null;
  let guard = 0;
  while (cur && guard++ < 20) {
    parts.unshift(cur.title);
    cur = cur.parent_id ? items[cur.parent_id] : null;
  }
  return parts.join(' / ');
}

/**
 * Paleta de comandos: uma busca só para notas, menções, títulos da nota
 * aberta e ações. Prefixos: ">" ações · "+" menções · "#" títulos.
 * Shift+Enter abre a nota ou menção na tela dividida.
 */
export function CommandPalette({
  api,
  entries,
  recent,
  commands,
  headings,
  initialMode = '',
  asideDefault = false,
  onOpen,
  onEntry,
  onCreate,
  onClose,
}: {
  api: NotebookApi;
  entries: Record<string, NotebookEntry>;
  recent: string[];
  commands: PaletteCommand[];
  headings: () => PaletteHeading[];
  initialMode?: PaletteMode;
  /** abre o escolhido ao lado (comando "Abrir ao lado…") */
  asideDefault?: boolean;
  onOpen: (id: string, aside: boolean) => void;
  onEntry: (entry: NotebookEntry, aside: boolean) => void;
  onCreate: (title: string) => void;
  onClose: () => void;
}) {
  const [q, setQ] = useState(initialMode ? `${initialMode} ` : '');
  const [sel, setSel] = useState(0);
  const listRef = useRef<HTMLDivElement>(null);
  const heads = useMemo(() => headings(), [headings]);

  const mode: PaletteMode = PREFIX[q[0]] ?? '';
  const term = (mode ? q.slice(1) : q).trim();

  const rows = useMemo<Row[]>(() => {
    const live = Object.values(api.items).filter((i) => !i.archived_at);
    const ents = Object.values(entries);
    const t = norm(term);
    const scoreEntry = (e: NotebookEntry) => Math.max(fuzzyScore(norm(e.title), t), ...(e.aliases || []).map((a) => fuzzyScore(norm(a), t) - 5));
    const scoreCmd = (c: PaletteCommand) => Math.max(fuzzyScore(norm(c.label), t), c.keywords ? fuzzyScore(norm(c.keywords), t) - 10 : 0);
    const out: Row[] = [];

    if (mode === '>') {
      const list = t ? commands.map((c) => ({ c, s: scoreCmd(c) })).filter((r) => r.s > 10).sort((a, b) => b.s - a.s).map((r) => r.c) : commands;
      list.forEach((cmd) => out.push({ kind: 'cmd', cmd, group: t ? 'Ações' : cmd.group }));
      return out;
    }
    if (mode === '+') {
      const list = t
        ? ents.map((e) => ({ e, s: scoreEntry(e) })).filter((r) => r.s > 0).sort((a, b) => b.s - a.s).map((r) => r.e)
        : [...ents].sort((a, b) => a.title.localeCompare(b.title, 'pt-BR'));
      list.slice(0, 40).forEach((entry) => out.push({ kind: 'entry', entry, group: 'Menções' }));
      return out;
    }
    if (mode === '#') {
      heads
        .filter((h) => !t || fuzzyScore(norm(h.text), t) > 0)
        .forEach((h) => out.push({ kind: 'heading', h, group: 'Títulos desta nota' }));
      return out;
    }

    if (!t) {
      const rec = recent.map((id) => api.items[id]).filter((i): i is NotebookItem => !!i && !i.archived_at);
      const rest = live.filter((i) => !recent.includes(i.id)).sort((a, b) => b.updated_at.localeCompare(a.updated_at));
      [...rec, ...rest].slice(0, 8).forEach((item) => out.push({ kind: 'note', item, group: 'Recentes' }));
      commands.slice(0, 6).forEach((cmd) => out.push({ kind: 'cmd', cmd, group: 'Ações' }));
      return out;
    }
    live
      .map((i) => ({ i, s: Math.max(fuzzyScore(norm(i.title), t), i.tags.some((g) => g.includes(t.replace(/^#/, ''))) ? 30 : 0) }))
      .filter((r) => r.s > 0)
      .sort((a, b) => b.s - a.s)
      .slice(0, 8)
      .forEach((r) => out.push({ kind: 'note', item: r.i, group: 'Notas' }));
    ents
      .map((e) => ({ e, s: scoreEntry(e) }))
      .filter((r) => r.s > 0)
      .sort((a, b) => b.s - a.s)
      .slice(0, 5)
      .forEach((r) => out.push({ kind: 'entry', entry: r.e, group: 'Menções' }));
    commands
      .map((c) => ({ c, s: scoreCmd(c) }))
      .filter((r) => r.s > 20)
      .sort((a, b) => b.s - a.s)
      .slice(0, 5)
      .forEach((r) => out.push({ kind: 'cmd', cmd: r.c, group: 'Ações' }));
    if (!live.some((i) => norm(i.title) === t)) out.push({ kind: 'create', title: term, group: 'Criar' });
    return out;
  }, [api.items, entries, commands, heads, recent, mode, term]);

  useEffect(() => setSel(0), [q]);
  useEffect(() => {
    listRef.current?.querySelector(`[data-i="${sel}"]`)?.scrollIntoView({ block: 'nearest' });
  }, [sel]);

  function choose(i: number, asideKey = false) {
    const r = rows[i];
    if (!r) return;
    const aside = asideKey || asideDefault;
    onClose();
    if (r.kind === 'note') onOpen(r.item.id, aside);
    else if (r.kind === 'entry') onEntry(r.entry, aside);
    else if (r.kind === 'cmd') r.cmd.run();
    else if (r.kind === 'heading') r.h.go();
    else onCreate(r.title);
  }

  const placeholder =
    mode === '>'
      ? 'Digite uma ação…'
      : mode === '+'
        ? 'Buscar menção…'
        : mode === '#'
          ? heads.length
            ? 'Ir para um título desta nota…'
            : 'Esta nota ainda não tem títulos'
          : asideDefault
            ? 'Escolha a nota ou menção para abrir ao lado…'
            : 'Buscar notas, menções e ações…';

  let lastGroup = '';
  return (
    <div className="nb-modal-back" onClick={onClose}>
      <div className="nb-modal nb-palette" onClick={(e) => e.stopPropagation()} role="dialog" aria-label="Paleta de comandos">
        <label className="flex items-center gap-3 px-4 h-14 border-b border-[var(--nb-line)]">
          {mode === '>' ? (
            <TerminalSquare className="w-4 h-4 text-[var(--nb-hl)]" />
          ) : mode === '#' ? (
            <Hash className="w-4 h-4 text-[var(--nb-hl)]" />
          ) : asideDefault ? (
            <Columns2 className="w-4 h-4 text-[var(--nb-hl)]" />
          ) : (
            <Search className="w-4 h-4 text-[var(--nb-ink-3)]" />
          )}
          <input
            autoFocus
            value={q}
            onChange={(e) => setQ(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'ArrowDown') (e.preventDefault(), setSel((s) => Math.min(rows.length - 1, s + 1)));
              else if (e.key === 'ArrowUp') (e.preventDefault(), setSel((s) => Math.max(0, s - 1)));
              else if (e.key === 'Enter') (e.preventDefault(), choose(sel, e.shiftKey || e.ctrlKey || e.metaKey));
              else if (e.key === 'Escape') (e.preventDefault(), e.stopPropagation(), onClose());
              else if (e.key === 'Backspace' && mode && q.length <= 2 && !term) (e.preventDefault(), setQ(''));
            }}
            placeholder={placeholder}
            aria-label="Buscar"
            className="flex-1 bg-transparent text-[15px] outline-none placeholder:text-[var(--nb-ink-3)]"
          />
          <span className="nb-kbd">Esc</span>
        </label>
        <div ref={listRef} className="nb-scroll overflow-y-auto py-1.5" role="listbox">
          {rows.map((r, i) => {
            const header = r.group !== lastGroup ? r.group : null;
            lastGroup = r.group;
            return (
              <div key={`${r.kind}-${i}`}>
                {header && <p className="nb-palette-group">{header}</p>}
                <button
                  data-i={i}
                  type="button"
                  role="option"
                  aria-selected={i === sel}
                  onMouseMove={() => sel !== i && setSel(i)}
                  onClick={(e) => choose(i, e.shiftKey)}
                  className={`w-full flex items-center gap-3 px-4 py-2 text-left ${i === sel ? 'bg-[var(--nb-hl-soft)]' : ''}`}
                >
                  <RowView r={r} items={api.items} />
                  {i === sel &&
                    (r.kind === 'note' || r.kind === 'entry' ? (
                      <span className="flex items-center gap-1 text-[10px] text-[var(--nb-ink-3)] shrink-0">
                        <CornerDownLeft className="w-3 h-3" />
                        {asideDefault ? 'ao lado' : 'abrir'}
                      </span>
                    ) : (
                      <CornerDownLeft className="w-3.5 h-3.5 shrink-0 text-[var(--nb-ink-3)]" />
                    ))}
                </button>
              </div>
            );
          })}
          {!rows.length && (
            <p className="px-4 py-8 text-center text-sm text-[var(--nb-ink-3)]">
              {mode === '#' ? 'Use títulos no texto para navegar por aqui.' : mode === '+' ? 'Nenhuma menção encontrada.' : 'Nada encontrado.'}
            </p>
          )}
        </div>
        <div className="flex flex-wrap gap-x-4 gap-y-1 px-4 py-2 border-t border-[var(--nb-line)] text-[11px] text-[var(--nb-ink-3)]">
          <span>
            <span className="nb-kbd">↑↓</span> navegar
          </span>
          <span>
            <span className="nb-kbd">Shift</span> <span className="nb-kbd">Enter</span> abrir ao lado
          </span>
          <span className="ml-auto flex gap-3">
            <button type="button" onClick={() => setQ('> ')} className="hover:text-[var(--nb-ink)]">
              <span className="nb-kbd">&gt;</span> ações
            </button>
            <button type="button" onClick={() => setQ('+ ')} className="hover:text-[var(--nb-ink)]">
              <span className="nb-kbd">+</span> menções
            </button>
            <button type="button" onClick={() => setQ('# ')} className="hover:text-[var(--nb-ink)]">
              <span className="nb-kbd">#</span> títulos
            </button>
          </span>
        </div>
      </div>
    </div>
  );
}

function RowView({ r, items }: { r: Row; items: Record<string, NotebookItem> }) {
  if (r.kind === 'note')
    return (
      <>
        <span className="w-5 text-center">{itemIcon(r.item)}</span>
        <span className="flex-1 min-w-0">
          <span className="block truncate text-sm font-medium">{r.item.title}</span>
          {r.item.parent_id && <span className="block truncate text-[11px] text-[var(--nb-ink-3)]">{pathOf(items, r.item)}</span>}
        </span>
      </>
    );
  if (r.kind === 'entry') {
    const look = entryLook(r.entry);
    return (
      <>
        <EntryAvatar entry={r.entry} size={20} ring={false} />
        <span className="flex-1 min-w-0">
          <span className="block truncate text-sm font-medium">{r.entry.title}</span>
          <span className="block truncate text-[11px] text-[var(--nb-ink-3)]">
            <span style={{ color: look.color }}>{look.label}</span>
            {r.entry.summary ? ` · ${r.entry.summary}` : ''}
          </span>
        </span>
      </>
    );
  }
  if (r.kind === 'cmd')
    return (
      <>
        <span className="w-5 grid place-items-center text-[var(--nb-ink-3)] [&>svg]:w-4 [&>svg]:h-4">{r.cmd.icon || <ChevronRight />}</span>
        <span className="flex-1 min-w-0 truncate text-sm">{r.cmd.label}</span>
        {r.cmd.shortcut && <span className="nb-kbd shrink-0">{r.cmd.shortcut}</span>}
      </>
    );
  if (r.kind === 'heading')
    return (
      <>
        <Hash className="w-4 h-4 text-[var(--nb-ink-3)]" style={{ marginLeft: (r.h.level - 1) * 10 }} />
        <span className="flex-1 min-w-0 truncate text-sm">{r.h.text}</span>
      </>
    );
  return (
    <>
      <Plus className="w-4 h-4 text-[var(--nb-hl)]" />
      <span className="flex-1 min-w-0 text-sm font-semibold truncate text-[var(--nb-hl)]">Criar nota “{r.title}”</span>
    </>
  );
}
