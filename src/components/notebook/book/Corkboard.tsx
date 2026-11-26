'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { Eye, GripVertical } from 'lucide-react';
import type { ChapterStatus, NotebookItem } from '@/lib/notebook/types';
import type { NotebookApi } from '@/lib/notebook/useNotebook';
import type { NotebookEntry } from '@/lib/notebook/entries';
import { CHAPTER_STATUS } from '../WriterMode';
import { EntryAvatar } from '../entries/MentionViews';
import { useNotebookLinks } from '../editor/linkContext';

export interface ChapterMeta {
  status: ChapterStatus;
  synopsis: string;
  pov: string | null;
}

/**
 * Quadro de cenas (como o corkboard do Scrivener): cada capítulo é uma ficha
 * com sinopse, status, ponto de vista e quem aparece. Arraste para reordenar;
 * na visão por status, arraste entre colunas para mudar o status.
 */
export function Corkboard({
  chapters,
  meta,
  api,
  onMeta,
  onOpen,
}: {
  chapters: NotebookItem[];
  meta: (c: NotebookItem) => ChapterMeta;
  api: NotebookApi;
  onMeta: (id: string, patch: Partial<ChapterMeta>) => void;
  onOpen: (id: string) => void;
}) {
  const [group, setGroup] = useState<'ordem' | 'status'>(() => {
    try {
      return (localStorage.getItem('insight-notebook-cork-group') as 'ordem' | 'status') || 'ordem';
    } catch {
      return 'ordem';
    }
  });
  const [drag, setDrag] = useState<string | null>(null);
  const [over, setOver] = useState<{ id: string | null; col?: ChapterStatus; after: boolean } | null>(null);
  const { entries } = useNotebookLinks();
  const people = useMemo(
    () => Object.values(entries).filter((e) => e.kind === 'elemento' && (e.category === 'personagem' || !e.category)).sort((a, b) => a.title.localeCompare(b.title, 'pt-BR')),
    [entries]
  );

  useEffect(() => {
    try {
      localStorage.setItem('insight-notebook-cork-group', group);
    } catch {
      /* ignora */
    }
  }, [group]);

  /** grava a nova ordem: posições sequenciais */
  function reorder(dragId: string, targetId: string | null, after: boolean) {
    const ids = chapters.map((c) => c.id).filter((id) => id !== dragId);
    let at = targetId ? ids.indexOf(targetId) : ids.length;
    if (targetId && after) at++;
    ids.splice(Math.max(0, at), 0, dragId);
    ids.forEach((id, i) => {
      const c = api.items[id];
      if (c && c.position !== i) api.update(id, { position: i });
    });
  }

  function drop(targetId: string | null, col?: ChapterStatus) {
    const id = drag;
    setDrag(null);
    setOver(null);
    if (!id) return;
    if (col && meta(api.items[id]).status !== col) onMeta(id, { status: col });
    if (targetId !== id) reorder(id, targetId, !!over?.after);
  }

  const card = (c: NotebookItem, i: number) => (
    <ChapterCard
      key={c.id}
      chapter={c}
      index={chapters.indexOf(c) + 1 || i + 1}
      meta={meta(c)}
      entries={entries}
      people={people}
      dragging={drag === c.id}
      dropMark={over?.id === c.id ? (over.after ? 'after' : 'before') : null}
      onMeta={(p) => onMeta(c.id, p)}
      onOpen={() => onOpen(c.id)}
      onDragStart={() => setDrag(c.id)}
      onDragEnd={() => (setDrag(null), setOver(null))}
      onDragOver={(after, col) => setOver({ id: c.id, after, col })}
      onDrop={(col) => drop(c.id, col)}
    />
  );

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-1">
        {(
          [
            ['ordem', 'Em ordem'],
            ['status', 'Por status'],
          ] as const
        ).map(([id, label]) => (
          <button
            key={id}
            type="button"
            aria-pressed={group === id}
            onClick={() => setGroup(id)}
            className={`h-7 px-3 rounded-full text-[11px] font-bold ${group === id ? 'bg-[var(--nb-hl-soft)] text-[var(--nb-hl)]' : 'text-[var(--nb-ink-3)] hover:text-[var(--nb-ink)]'}`}
          >
            {label}
          </button>
        ))}
        <span className="ml-auto text-[11px] text-[var(--nb-ink-3)] hidden sm:inline">Arraste as fichas para reorganizar</span>
      </div>

      {group === 'ordem' ? (
        <div
          className="nb-cork-grid"
          onDragOver={(e) => drag && e.preventDefault()}
          onDrop={(e) => {
            if ((e.target as HTMLElement).closest('.nb-cork-card')) return;
            e.preventDefault();
            drop(null);
          }}
        >
          {chapters.map(card)}
        </div>
      ) : (
        <div className="nb-cork-cols">
          {CHAPTER_STATUS.map((s) => {
            const list = chapters.filter((c) => meta(c).status === s.id);
            return (
              <section
                key={s.id}
                className="nb-cork-col"
                data-over={drag && over?.col === s.id && !over.id ? true : undefined}
                onDragOver={(e) => {
                  if (!drag) return;
                  e.preventDefault();
                  if (!(e.target as HTMLElement).closest('.nb-cork-card')) setOver({ id: null, col: s.id, after: true });
                }}
                onDrop={(e) => {
                  if ((e.target as HTMLElement).closest('.nb-cork-card')) return;
                  e.preventDefault();
                  // solta no fim da coluna
                  const last = list.filter((c) => c.id !== drag).pop();
                  setOver({ id: last?.id ?? null, col: s.id, after: true });
                  const id = drag;
                  setDrag(null);
                  setOver(null);
                  if (!id) return;
                  if (meta(api.items[id]).status !== s.id) onMeta(id, { status: s.id });
                  if (last) reorder(id, last.id, true);
                }}
              >
                <p className="nb-cork-col-head">
                  <span className="w-2 h-2 rounded-full" style={{ background: s.color }} />
                  {s.label}
                  <span className="ml-auto text-[var(--nb-ink-3)]">{list.length}</span>
                </p>
                <div className="space-y-2 min-h-[60px]">{list.map((c, i) => card(c, i))}</div>
              </section>
            );
          })}
        </div>
      )}
    </div>
  );
}

function ChapterCard({
  chapter,
  index,
  meta,
  entries,
  people,
  dragging,
  dropMark,
  onMeta,
  onOpen,
  onDragStart,
  onDragEnd,
  onDragOver,
  onDrop,
}: {
  chapter: NotebookItem;
  index: number;
  meta: ChapterMeta;
  entries: Record<string, NotebookEntry>;
  people: NotebookEntry[];
  dragging: boolean;
  dropMark: 'before' | 'after' | null;
  onMeta: (p: Partial<ChapterMeta>) => void;
  onOpen: () => void;
  onDragStart: () => void;
  onDragEnd: () => void;
  onDragOver: (after: boolean, col?: ChapterStatus) => void;
  onDrop: (col?: ChapterStatus) => void;
}) {
  const [syn, setSyn] = useState(meta.synopsis);
  const [editing, setEditing] = useState(false);
  const focused = useRef(false);
  useEffect(() => {
    if (!focused.current) setSyn(meta.synopsis);
  }, [meta.synopsis]);
  const st = CHAPTER_STATUS.find((s) => s.id === meta.status) || CHAPTER_STATUS[1];
  const pov = meta.pov ? entries[meta.pov] : null;
  const cast = (chapter.entry_refs || [])
    .map((id) => entries[id])
    .filter((e): e is NotebookEntry => !!e && e.kind === 'elemento' && e.id !== meta.pov)
    .slice(0, 6);

  return (
    <article
      className="nb-cork-card"
      data-item-id={chapter.id}
      data-dragging={dragging || undefined}
      data-drop={dropMark || undefined}
      draggable={!editing}
      onDragStart={(e) => {
        e.dataTransfer.effectAllowed = 'move';
        e.dataTransfer.setData('text/plain', chapter.title);
        onDragStart();
      }}
      onDragEnd={onDragEnd}
      onDragOver={(e) => {
        e.preventDefault();
        const r = e.currentTarget.getBoundingClientRect();
        const grid = !!e.currentTarget.closest('.nb-cork-grid');
        onDragOver(grid ? e.clientX > r.left + r.width / 2 : e.clientY > r.top + r.height / 2, meta.status);
      }}
      onDrop={(e) => {
        e.preventDefault();
        e.stopPropagation();
        const col = e.currentTarget.closest('.nb-cork-col') ? meta.status : undefined;
        onDrop(col);
      }}
      style={{ ['--st' as string]: st.color }}
    >
      <header className="flex items-start gap-2">
        <GripVertical className="w-3.5 h-3.5 mt-0.5 shrink-0 text-[var(--nb-ink-3)] cursor-grab" aria-hidden="true" />
        <button type="button" onClick={onOpen} className="flex-1 min-w-0 text-left">
          <span className="block text-[10px] font-black tracking-[0.18em] text-[var(--nb-ink-3)]">CAPÍTULO {index}</span>
          <span className="block font-serif font-semibold text-[15px] leading-snug truncate hover:text-[var(--nb-hl)]">{chapter.title}</span>
        </button>
      </header>

      <textarea
        value={syn}
        onFocus={() => ((focused.current = true), setEditing(true))}
        onBlur={() => ((focused.current = false), setEditing(false))}
        onChange={(e) => {
          const v = e.target.value.slice(0, 600);
          setSyn(v);
          onMeta({ synopsis: v });
        }}
        placeholder="Sinopse: o que acontece aqui?"
        aria-label={`Sinopse de ${chapter.title}`}
        rows={3}
        className="nb-cork-syn"
      />

      <footer className="flex items-center gap-1.5 flex-wrap">
        <select
          value={meta.status}
          onChange={(e) => onMeta({ status: e.target.value as ChapterStatus })}
          aria-label="Status"
          className="nb-cork-status"
          style={{ color: st.color }}
        >
          {CHAPTER_STATUS.map((s) => (
            <option key={s.id} value={s.id}>
              {s.label}
            </option>
          ))}
        </select>
        <label className="nb-cork-pov" title="Ponto de vista">
          <Eye className="w-3 h-3 shrink-0" />
          {pov && <EntryAvatar entry={pov} size={16} ring={false} />}
          <select value={meta.pov || ''} onChange={(e) => onMeta({ pov: e.target.value || null })} aria-label="Ponto de vista">
            <option value="">ponto de vista</option>
            {people.map((p) => (
              <option key={p.id} value={p.id}>
                {p.title}
              </option>
            ))}
          </select>
        </label>
        <span className="ml-auto flex items-center -space-x-1.5">
          {cast.map((e) => (
            <span key={e.id} data-ref={e.id} title={e.title} className="rounded-full ring-2 ring-[var(--nb-pane)]">
              <EntryAvatar entry={e} size={20} ring={false} />
            </span>
          ))}
        </span>
        <span className="w-full text-[10px] text-[var(--nb-ink-3)] font-mono">{chapter.word_count.toLocaleString('pt-BR')} palavras</span>
      </footer>
    </article>
  );
}
