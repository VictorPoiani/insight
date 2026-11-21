'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { Search, CornerDownLeft, Plus, Loader2, Hash } from 'lucide-react';
import type { NotebookItem } from '@/lib/notebook/types';
import { NOTEBOOK_TEMPLATES, SECTION_LABELS, type NotebookTemplateDef, type TemplateSection } from '@/lib/notebook/templates';
import type { NotebookApi } from '@/lib/notebook/useNotebook';
import { itemIcon } from './FileExplorer';

/** Busca difusa simples: todas as letras em ordem; pontua sequências e começo. */
export function fuzzyScore(text: string, q: string): number {
  if (!q) return 1;
  const t = text.toLowerCase();
  const s = q.toLowerCase();
  if (t.includes(s)) return 100 - t.indexOf(s) + (t.startsWith(s) ? 50 : 0);
  let ti = 0;
  let score = 0;
  let run = 0;
  for (const ch of s) {
    const found = t.indexOf(ch, ti);
    if (found < 0) return 0;
    run = found === ti ? run + 1 : 0;
    score += 1 + run * 2;
    ti = found + 1;
  }
  return score;
}

function pathOf(items: Record<string, NotebookItem>, item: NotebookItem) {
  const parts: string[] = [];
  let cur = item.parent_id ? items[item.parent_id] : null;
  while (cur) {
    parts.unshift(cur.title);
    cur = cur.parent_id ? items[cur.parent_id] : null;
  }
  return parts.join(' / ');
}

// ============================================================================
// Abrir rápido (Ctrl+O / Ctrl+K)
// ============================================================================

export function QuickSwitcher({
  api,
  onOpen,
  onCreate,
  onClose,
  recent,
}: {
  api: NotebookApi;
  onOpen: (id: string) => void;
  onCreate: (title: string) => void;
  onClose: () => void;
  recent: string[];
}) {
  const [q, setQ] = useState('');
  const [sel, setSel] = useState(0);
  const listRef = useRef<HTMLDivElement>(null);

  const results = useMemo(() => {
    const live = Object.values(api.items).filter((i) => !i.archived_at);
    if (!q.trim()) {
      const rec = recent.map((id) => api.items[id]).filter((i): i is NotebookItem => !!i && !i.archived_at);
      const rest = live.filter((i) => !recent.includes(i.id)).sort((a, b) => b.updated_at.localeCompare(a.updated_at));
      return [...rec, ...rest].slice(0, 30);
    }
    return live
      .map((i) => ({ i, s: Math.max(fuzzyScore(i.title, q.trim()), i.tags.some((t) => t.includes(q.trim().replace(/^#/, '').toLowerCase())) ? 30 : 0) }))
      .filter((r) => r.s > 0)
      .sort((a, b) => b.s - a.s)
      .slice(0, 30)
      .map((r) => r.i);
  }, [api.items, q, recent]);

  const exact = results.some((r) => r.title.toLowerCase() === q.trim().toLowerCase());
  const total = results.length + (q.trim() && !exact ? 1 : 0);

  useEffect(() => setSel(0), [q]);
  useEffect(() => {
    listRef.current?.querySelector(`[data-i="${sel}"]`)?.scrollIntoView({ block: 'nearest' });
  }, [sel]);

  function choose(i: number) {
    if (i < results.length) onOpen(results[i].id);
    else if (q.trim()) onCreate(q.trim());
    onClose();
  }

  return (
    <div className="nb-modal-back" onClick={onClose}>
      <div className="nb-modal" onClick={(e) => e.stopPropagation()} role="dialog" aria-label="Abrir nota">
        <label className="flex items-center gap-3 px-4 h-14 border-b border-[var(--nb-line)]">
          <Search className="w-4 h-4 text-[var(--nb-ink-3)]" />
          <input
            autoFocus
            value={q}
            onChange={(e) => setQ(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'ArrowDown') (e.preventDefault(), setSel((s) => Math.min(total - 1, s + 1)));
              if (e.key === 'ArrowUp') (e.preventDefault(), setSel((s) => Math.max(0, s - 1)));
              if (e.key === 'Enter') (e.preventDefault(), choose(sel));
              if (e.key === 'Escape') onClose();
            }}
            placeholder="Buscar nota pelo nome… ou digite um nome novo para criar"
            className="flex-1 bg-transparent text-[15px] outline-none placeholder:text-[var(--nb-ink-3)]"
          />
          <span className="nb-kbd">Esc</span>
        </label>
        <div ref={listRef} className="nb-scroll overflow-y-auto py-1.5">
          {results.map((r, i) => (
            <button
              key={r.id}
              data-i={i}
              type="button"
              onMouseEnter={() => setSel(i)}
              onClick={() => choose(i)}
              className={`w-full flex items-center gap-3 px-4 py-2 text-left ${i === sel ? 'bg-[var(--nb-hl-soft)]' : ''}`}
            >
              <span className="w-5 text-center">{itemIcon(r)}</span>
              <span className="flex-1 min-w-0">
                <span className="block truncate text-sm font-medium">{r.title}</span>
                {r.parent_id && <span className="block truncate text-[11px] text-[var(--nb-ink-3)]">{pathOf(api.items, r)}</span>}
              </span>
              {i === sel && <CornerDownLeft className="w-3.5 h-3.5 text-[var(--nb-ink-3)]" />}
            </button>
          ))}
          {q.trim() && !exact && (
            <button
              type="button"
              data-i={results.length}
              onMouseEnter={() => setSel(results.length)}
              onClick={() => choose(results.length)}
              className={`w-full flex items-center gap-3 px-4 py-2 text-left text-[var(--nb-hl)] ${sel === results.length ? 'bg-[var(--nb-hl-soft)]' : ''}`}
            >
              <Plus className="w-4 h-4" />
              <span className="text-sm font-semibold truncate">Criar nota “{q.trim()}”</span>
            </button>
          )}
          {!total && <p className="px-4 py-8 text-center text-sm text-[var(--nb-ink-3)]">Nenhuma nota ainda.</p>}
        </div>
        <div className="flex gap-4 px-4 py-2 border-t border-[var(--nb-line)] text-[11px] text-[var(--nb-ink-3)]">
          <span>
            <span className="nb-kbd">↑↓</span> navegar
          </span>
          <span>
            <span className="nb-kbd">Enter</span> abrir
          </span>
          <span className="ml-auto">
            <span className="nb-kbd">Ctrl</span> <span className="nb-kbd">O</span>
          </span>
        </div>
      </div>
    </div>
  );
}

// ============================================================================
// Modelos
// ============================================================================

export function TemplatePicker({
  api,
  onPick,
  onClose,
  parentTitle,
}: {
  api: NotebookApi;
  onPick: (t: NotebookTemplateDef | null, from?: NotebookItem) => void;
  onClose: () => void;
  parentTitle?: string | null;
}) {
  const [q, setQ] = useState('');
  const mine = Object.values(api.items).filter((i) => i.is_template && !i.archived_at);
  const qq = q.trim().toLowerCase();
  const list = NOTEBOOK_TEMPLATES.filter((t) => !qq || t.name.toLowerCase().includes(qq) || t.description.toLowerCase().includes(qq));
  const sections = (Object.keys(SECTION_LABELS) as TemplateSection[]).map((s) => ({ s, items: list.filter((t) => t.section === s) }));

  return (
    <div className="nb-modal-back" onClick={onClose}>
      <div className="nb-modal !max-w-3xl" onClick={(e) => e.stopPropagation()} role="dialog" aria-label="Escolher modelo">
        <div className="px-5 pt-5 pb-3 border-b border-[var(--nb-line)] space-y-3">
          <div>
            <h2 className="text-lg font-black">Criar a partir de um modelo</h2>
            <p className="text-xs text-[var(--nb-ink-3)]">{parentTitle ? `Dentro de “${parentTitle}”` : 'Na raiz do notebook'}</p>
          </div>
          <label className="flex items-center gap-2 h-9 px-3 rounded-xl bg-[var(--nb-bg)] border border-[var(--nb-line)] focus-within:border-[var(--nb-hl)]">
            <Search className="w-4 h-4 text-[var(--nb-ink-3)]" />
            <input
              autoFocus
              value={q}
              onChange={(e) => setQ(e.target.value)}
              onKeyDown={(e) => e.key === 'Escape' && onClose()}
              placeholder="Buscar modelo…"
              className="flex-1 bg-transparent text-sm outline-none"
            />
          </label>
        </div>
        <div className="nb-scroll overflow-y-auto p-5 space-y-6">
          {mine.length > 0 && (
            <section>
              <p className="nb-pane-title mb-2">Meus modelos</p>
              <div className="grid sm:grid-cols-2 gap-2">
                {mine
                  .filter((m) => !qq || m.title.toLowerCase().includes(qq))
                  .map((m) => (
                    <Card key={m.id} icon={itemIcon(m)} name={m.title} desc="Modelo salvo por você" color={m.color || '#a855f7'} onClick={() => onPick(null, m)} />
                  ))}
              </div>
            </section>
          )}
          {sections.map(({ s, items }) =>
            items.length ? (
              <section key={s}>
                <p className="nb-pane-title mb-2">{SECTION_LABELS[s]}</p>
                <div className="grid sm:grid-cols-2 gap-2">
                  {items.map((t) => (
                    <Card key={t.id} icon={t.icon} name={t.name} desc={t.description} color={t.color} onClick={() => onPick(t)} />
                  ))}
                </div>
              </section>
            ) : null
          )}
          <p className="text-[11px] text-[var(--nb-ink-3)]">
            Dica: clique com o botão direito numa nota e escolha “Usar como modelo” para criar seus próprios modelos.
          </p>
        </div>
      </div>
    </div>
  );
}

function Card({ icon, name, desc, color, onClick }: { icon: string; name: string; desc: string; color: string; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="group flex items-start gap-3 p-3 rounded-xl border border-[var(--nb-line)] bg-[var(--nb-bg)] hover:border-[var(--nb-hl)] text-left transition-colors"
    >
      <span
        className="w-10 h-10 shrink-0 grid place-items-center rounded-xl text-xl"
        style={{ background: `color-mix(in srgb, ${color} 18%, transparent)` }}
      >
        {icon}
      </span>
      <span className="min-w-0">
        <span className="block text-sm font-bold group-hover:text-[var(--nb-hl)]">{name}</span>
        <span className="block text-[12px] leading-snug text-[var(--nb-ink-3)]">{desc}</span>
      </span>
    </button>
  );
}

// ============================================================================
// Busca no conteúdo
// ============================================================================

export function SearchPanel({ api, onOpen, initial }: { api: NotebookApi; onOpen: (id: string) => void; initial?: string }) {
  const [q, setQ] = useState(initial || '');
  const [hits, setHits] = useState<{ id: string; snippet: string }[]>([]);
  const [busy, setBusy] = useState(false);
  const searchContent = api.searchContent;

  useEffect(() => {
    if (initial != null) setQ(initial);
  }, [initial]);

  const tagMode = q.trim().startsWith('#');
  const tagHits = useMemo(() => {
    if (!tagMode) return [];
    const t = q.trim().slice(1).toLowerCase();
    return Object.values(api.items).filter((i) => !i.archived_at && i.tags.some((x) => (t ? x.startsWith(t) : true)));
  }, [api.items, q, tagMode]);

  const allTags = useMemo(() => {
    const m = new Map<string, number>();
    Object.values(api.items).forEach((i) => !i.archived_at && i.tags.forEach((t) => m.set(t, (m.get(t) || 0) + 1)));
    return Array.from(m.entries()).sort((a, b) => b[1] - a[1]);
  }, [api.items]);

  useEffect(() => {
    if (tagMode || q.trim().length < 2) {
      setHits([]);
      return;
    }
    setBusy(true);
    const t = setTimeout(async () => {
      setHits(await searchContent(q));
      setBusy(false);
    }, 300);
    return () => clearTimeout(t);
  }, [q, tagMode, searchContent]);

  const mark = (text: string) => {
    const term = q.trim();
    if (!term) return text;
    const i = text.toLowerCase().indexOf(term.toLowerCase());
    if (i < 0) return text;
    return (
      <>
        {text.slice(0, i)}
        <mark className="nb-mark">{text.slice(i, i + term.length)}</mark>
        {text.slice(i + term.length)}
      </>
    );
  };

  return (
    <div className="flex flex-col h-full min-h-0">
      <div className="px-3 pt-3 pb-2 space-y-2">
        <span className="nb-pane-title">Buscar</span>
        <label className="flex items-center gap-2 h-9 px-2.5 rounded-lg bg-[var(--nb-bg)] border border-[var(--nb-line)] focus-within:border-[var(--nb-hl)]">
          {busy ? <Loader2 className="w-3.5 h-3.5 animate-spin text-[var(--nb-ink-3)]" /> : <Search className="w-3.5 h-3.5 text-[var(--nb-ink-3)]" />}
          <input
            autoFocus
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Texto ou #tag"
            className="flex-1 min-w-0 bg-transparent text-[13px] outline-none"
          />
        </label>
      </div>
      <div className="nb-scroll flex-1 min-h-0 overflow-y-auto px-1.5 pb-4">
        {!q.trim() && (
          <div className="px-2 pt-2">
            <p className="nb-pane-title mb-2">Tags</p>
            <div className="flex flex-wrap gap-1.5">
              {allTags.length ? (
                allTags.map(([t, n]) => (
                  <button key={t} type="button" onClick={() => setQ(`#${t}`)} className="nb-tag !text-[11px]">
                    #{t} <span className="opacity-60">{n}</span>
                  </button>
                ))
              ) : (
                <p className="text-[11px] text-[var(--nb-ink-3)]">Escreva #algo numa nota para criar tags.</p>
              )}
            </div>
          </div>
        )}
        {tagMode &&
          tagHits.map((i) => (
            <button key={i.id} type="button" onClick={() => onOpen(i.id)} className="w-full text-left px-2.5 py-2 rounded-lg hover:bg-[var(--nb-pane-2)]">
              <span className="flex items-center gap-2 text-[13px] font-semibold">
                <span>{itemIcon(i)}</span>
                <span className="truncate">{i.title}</span>
              </span>
              <span className="flex flex-wrap gap-1 mt-1">
                {i.tags.slice(0, 5).map((t) => (
                  <span key={t} className="text-[10px] text-[var(--nb-hl)] flex items-center">
                    <Hash className="w-2.5 h-2.5" />
                    {t}
                  </span>
                ))}
              </span>
            </button>
          ))}
        {!tagMode &&
          hits.map((h) => {
            const it = api.items[h.id];
            if (!it) return null;
            return (
              <button key={h.id} type="button" onClick={() => onOpen(h.id)} className="w-full text-left px-2.5 py-2 rounded-lg hover:bg-[var(--nb-pane-2)]">
                <span className="flex items-center gap-2 text-[13px] font-semibold">
                  <span>{itemIcon(it)}</span>
                  <span className="truncate">{mark(it.title)}</span>
                </span>
                {h.snippet && <span className="block mt-0.5 text-[12px] leading-snug text-[var(--nb-ink-3)] line-clamp-2">…{mark(h.snippet)}…</span>}
              </button>
            );
          })}
        {q.trim().length >= 2 && !busy && !tagMode && hits.length === 0 && <p className="px-3 py-6 text-center text-xs text-[var(--nb-ink-3)]">Nada encontrado.</p>}
      </div>
    </div>
  );
}
