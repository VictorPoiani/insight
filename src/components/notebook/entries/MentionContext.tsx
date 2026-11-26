'use client';

import { useEffect, useMemo, useState } from 'react';
import { Check, ChevronDown, ChevronRight, Loader2, Search, Sparkles } from 'lucide-react';
import type { NotebookEntry } from '@/lib/notebook/entries';
import type { NotebookItem } from '@/lib/notebook/types';
import type { NotebookApi } from '@/lib/notebook/useNotebook';
import { findUnlinked, markUnlinked, refSnippets, scanMode, type Snippet, type UnlinkedHit } from '@/lib/notebook/mentionScan';
import { isProject } from '@/lib/notebook/projects';
import { EntryAvatar } from './MentionViews';
import { itemIcon } from '../FileExplorer';

const reloadEditor = (id: string) => window.dispatchEvent(new CustomEvent('insight-notebook-reload', { detail: id }));

export function SnippetText({ s }: { s: Snippet }) {
  return (
    <span className="nb-snip">
      {s.before}
      <mark>{s.match}</mark>
      {s.after}
    </span>
  );
}

/** Projeto (pasta raiz) de uma nota. */
export function projectOf(items: Record<string, NotebookItem>, item: NotebookItem | null | undefined): string | null {
  let cur = item;
  let guard = 0;
  while (cur?.parent_id && guard++ < 50) cur = items[cur.parent_id];
  return cur && isProject(cur) ? cur.id : null;
}

/** Aplica as marcações numa nota (texto ou capítulo). */
export function applyMarks(api: NotebookApi, item: NotebookItem, entries: NotebookEntry[], keys: Set<string>): NotebookItem | null {
  const res = markUnlinked(item, entries, keys);
  if (!res) return null;
  const next: NotebookItem = 'content' in res ? { ...item, content: res.content } : { ...item, data: { ...item.data, html: res.html } };
  if ('content' in res) api.update(item.id, { content: res.content });
  else api.update(item.id, { data: next.data });
  reloadEditor(item.id);
  return next;
}

// ============================================================================
// Painel da nota: menções marcadas e sem marcação
// ============================================================================

export function NoteMentions({
  item,
  api,
  entries,
  onReadMore,
}: {
  item: NotebookItem;
  api: NotebookApi;
  entries: Record<string, NotebookEntry>;
  onReadMore?: (id: string) => void;
}) {
  const [open, setOpen] = useState<string | null>(null);
  const supported = !!scanMode(item);
  const project = projectOf(api.items, item);
  const candidates = useMemo(
    () => Object.values(entries).filter((e) => e.kind === 'elemento' && (!e.project_id || e.project_id === project)),
    [entries, project]
  );

  const linked = useMemo(
    () => (item.entry_refs || []).map((id) => entries[id]).filter((e): e is NotebookEntry => !!e),
    [item.entry_refs, entries]
  );

  // recalcula com calma enquanto a pessoa escreve
  const [hits, setHits] = useState<UnlinkedHit[]>([]);
  useEffect(() => {
    if (!supported) return;
    const t = setTimeout(() => setHits(findUnlinked(item, candidates)), 350);
    return () => clearTimeout(t);
  }, [item, candidates, supported]);

  const groups = useMemo(() => {
    const m = new Map<string, UnlinkedHit[]>();
    hits.forEach((h) => m.set(h.entryId, [...(m.get(h.entryId) || []), h]));
    return Array.from(m.entries())
      .map(([id, list]) => ({ entry: entries[id], list }))
      .filter((g) => g.entry)
      .sort((a, b) => b.list.length - a.list.length);
  }, [hits, entries]);

  const mark = (keys: string[]) => {
    const next = applyMarks(api, api.items[item.id] || item, candidates, new Set(keys));
    if (next) setHits(findUnlinked(next, candidates));
  };

  return (
    <div className="space-y-4">
      <div>
        <p className="px-2 pb-1 text-[11px] font-semibold text-[var(--nb-ink-3)]">Menções nesta nota ({linked.length})</p>
        {linked.length ? (
          <div className="flex flex-wrap gap-1 px-2">
            {linked.map((e) => (
              <button
                key={e.id}
                type="button"
                data-ref={e.id}
                onClick={() => onReadMore?.(e.id)}
                className="nb-ref-chip"
                title={e.summary || e.title}
              >
                <EntryAvatar entry={e} size={16} ring={false} />
                <span className="truncate">{e.title}</span>
              </button>
            ))}
          </div>
        ) : (
          <p className="px-2 text-[11px] text-[var(--nb-ink-3)]">Selecione um trecho e use “Mencionar”, ou digite + no texto.</p>
        )}
      </div>

      {supported && (
        <div>
          <div className="flex items-center gap-2 px-2 pb-1">
            <p className="flex-1 text-[11px] font-semibold text-[var(--nb-ink-3)]">Sem marcação ({hits.length})</p>
            {hits.length > 1 && (
              <button type="button" onClick={() => mark(hits.map((h) => h.key))} className="text-[11px] font-bold text-[var(--nb-hl)] hover:underline">
                Marcar todas
              </button>
            )}
          </div>
          {!groups.length ? (
            <p className="px-2 text-[11px] text-[var(--nb-ink-3)]">
              {candidates.length ? 'Nenhum nome de menção escrito sem marcação.' : 'Crie menções no Sumário para encontrá-las no texto.'}
            </p>
          ) : (
            groups.map(({ entry, list }) => (
              <div key={entry.id} className="rounded-lg">
                <div className="flex items-center gap-1.5 px-2 py-1 rounded-md hover:bg-[var(--nb-pane-2)]">
                  <button type="button" onClick={() => setOpen(open === entry.id ? null : entry.id)} className="flex items-center gap-1.5 flex-1 min-w-0 text-left">
                    {open === entry.id ? <ChevronDown className="w-3 h-3 shrink-0" /> : <ChevronRight className="w-3 h-3 shrink-0" />}
                    <EntryAvatar entry={entry} size={16} ring={false} />
                    <span className="truncate text-[13px]">{entry.title}</span>
                    <span className="text-[11px] text-[var(--nb-ink-3)]">{list.length}</span>
                  </button>
                  <button
                    type="button"
                    title={`Marcar ${list.length === 1 ? 'a ocorrência' : `as ${list.length} ocorrências`}`}
                    onClick={() => mark(list.map((h) => h.key))}
                    className="h-6 px-2 rounded-md text-[11px] font-bold text-[var(--nb-hl)] hover:bg-[var(--nb-hl-soft)]"
                  >
                    Marcar
                  </button>
                </div>
                {open === entry.id && (
                  <ul className="pl-7 pr-1 pb-1 space-y-1">
                    {list.map((h) => (
                      <li key={h.key} className="flex items-start gap-1 text-[12px] leading-snug text-[var(--nb-ink-2)]">
                        <SnippetText s={h.snippet} />
                        <button type="button" aria-label="Marcar esta ocorrência" title="Marcar esta" onClick={() => mark([h.key])} className="shrink-0 p-0.5 rounded text-[var(--nb-ink-3)] hover:text-[var(--nb-hl)]">
                          <Check className="w-3.5 h-3.5" />
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            ))
          )}
        </div>
      )}
    </div>
  );
}

// ============================================================================
// Ficha da menção: onde aparece (trechos) + nomes sem marcação no Notebook
// ============================================================================

export function EntryAppearances({
  entry,
  usedIn,
  api,
  onOpen,
  compact = false,
}: {
  entry: NotebookEntry;
  usedIn: NotebookItem[];
  api: NotebookApi;
  onOpen: (id: string) => void;
  compact?: boolean;
}) {
  const [loaded, setLoaded] = useState(false);
  const [busy, setBusy] = useState(false);
  const [scan, setScan] = useState<{ item: NotebookItem; hits: UnlinkedHit[] }[] | null>(null);
  const [scanning, setScanning] = useState(false);
  const shown = usedIn.slice(0, compact ? 8 : 12);
  const usedKey = shown.map((i) => i.id).join(',');

  // carrega os textos para mostrar os trechos
  useEffect(() => {
    let alive = true;
    setLoaded(false);
    setBusy(true);
    void Promise.all(shown.map((i) => (i._full ? i : api.loadFull(i.id)))).then(() => {
      if (!alive) return;
      setLoaded(true);
      setBusy(false);
    });
    return () => {
      alive = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [usedKey]);

  async function findMissing() {
    setScanning(true);
    const names = Array.from(new Set([entry.title, ...(entry.aliases || [])].map((n) => n.trim()).filter((n) => n.length >= 3))).slice(0, 6);
    const ids = new Set<string>();
    for (const n of names) (await api.searchContent(n)).forEach((r) => ids.add(r.id));
    const out: { item: NotebookItem; hits: UnlinkedHit[] }[] = [];
    for (const id of Array.from(ids).slice(0, 30)) {
      const it = await api.loadFull(id);
      if (!it || it.archived_at) continue;
      const hits = findUnlinked(it, [entry]);
      if (hits.length) out.push({ item: it, hits });
    }
    setScan(out);
    setScanning(false);
  }

  const markIn = (itemId: string, keys: string[]) => {
    const it = api.items[itemId];
    const next = it && applyMarks(api, it, [entry], new Set(keys));
    if (!next) return;
    // as posições mudam depois de marcar: recalcula a nota
    const rest = findUnlinked(next, [entry]);
    setScan((s) => (s || []).map((g) => (g.item.id === itemId ? { item: next, hits: rest } : g)).filter((g) => g.hits.length));
  };

  const totalMissing = (scan || []).reduce((n, g) => n + g.hits.length, 0);

  return (
    <div className="space-y-2">
      {shown.length > 0 && (
        <ul className="space-y-1.5">
          {shown.map((it) => {
            const live = api.items[it.id] || it;
            const snips = loaded && live._full ? refSnippets(live, entry.id, compact ? 2 : 3) : [];
            return (
              <li key={it.id}>
                <button
                  type="button"
                  onClick={() => onOpen(it.id)}
                  data-item-id={it.id}
                  className="w-full text-left rounded-lg px-2.5 py-1.5 bg-[var(--nb-pane-2)]/60 hover:bg-[var(--nb-pane-2)]"
                >
                  <span className="flex items-center gap-1.5 text-[12px] font-bold text-[var(--nb-ink)]">
                    <span className="text-[12px]">{itemIcon(it)}</span>
                    <span className="truncate">{it.title}</span>
                  </span>
                  {busy && !loaded && <Loader2 className="w-3 h-3 mt-1 animate-spin text-[var(--nb-ink-3)]" />}
                  {snips.map((s, i) => (
                    <span key={i} className="block mt-0.5 text-[12px] leading-snug text-[var(--nb-ink-2)]">
                      <SnippetText s={s} />
                    </span>
                  ))}
                </button>
              </li>
            );
          })}
          {usedIn.length > shown.length && <li className="px-2 text-[11px] text-[var(--nb-ink-3)]">e mais {usedIn.length - shown.length}.</li>}
        </ul>
      )}

      {entry.kind === 'elemento' &&
        (scan === null ? (
          <button
            type="button"
            disabled={scanning}
            onClick={() => void findMissing()}
            className="flex items-center gap-1.5 h-7 px-2.5 rounded-lg border border-[var(--nb-line)] text-[11px] font-bold text-[var(--nb-ink-2)] hover:text-[var(--nb-hl)] hover:border-[var(--nb-hl)]"
          >
            {scanning ? <Loader2 className="w-3 h-3 animate-spin" /> : <Search className="w-3 h-3" />} Procurar “{entry.title}” escrito sem marcação
          </button>
        ) : !scan.length ? (
          <p className="flex items-center gap-1.5 text-[11px] text-[var(--nb-ink-3)]">
            <Sparkles className="w-3 h-3" /> Nenhum texto cita “{entry.title}” sem marcação.
          </p>
        ) : (
          <div className="rounded-xl border border-[var(--nb-line)] p-2 space-y-2">
            <div className="flex items-center gap-2">
              <p className="flex-1 text-[11px] font-bold text-[var(--nb-ink-2)]">
                {totalMissing} {totalMissing === 1 ? 'ocorrência' : 'ocorrências'} sem marcação
              </p>
              <button
                type="button"
                onClick={() => scan.forEach((g) => markIn(g.item.id, g.hits.map((h) => h.key)))}
                className="text-[11px] font-bold text-[var(--nb-hl)] hover:underline"
              >
                Marcar todas
              </button>
            </div>
            {scan.map((g) => (
              <div key={g.item.id}>
                <div className="flex items-center gap-1.5">
                  <button type="button" onClick={() => onOpen(g.item.id)} className="flex items-center gap-1.5 flex-1 min-w-0 text-left text-[12px] font-bold hover:text-[var(--nb-hl)]">
                    <span>{itemIcon(g.item)}</span>
                    <span className="truncate">{g.item.title}</span>
                  </button>
                  <button type="button" onClick={() => markIn(g.item.id, g.hits.map((h) => h.key))} className="h-6 px-2 rounded-md text-[11px] font-bold text-[var(--nb-hl)] hover:bg-[var(--nb-hl-soft)]">
                    Marcar {g.hits.length > 1 ? `(${g.hits.length})` : ''}
                  </button>
                </div>
                <ul className="pl-5 space-y-0.5">
                  {g.hits.slice(0, 4).map((h) => (
                    <li key={h.key} className="text-[12px] leading-snug text-[var(--nb-ink-2)]">
                      <SnippetText s={h.snippet} />
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        ))}
    </div>
  );
}
