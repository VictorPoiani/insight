'use client';

import { useEffect, useMemo, useState } from 'react';
import { Search, X } from 'lucide-react';
import type { NotebookItem } from '@/lib/notebook/types';
import type { NotebookApi } from '@/lib/notebook/useNotebook';
import type { EntriesApi } from '@/lib/notebook/useEntries';
import { entryLook, entryRel, type NotebookEntry } from '@/lib/notebook/entries';
import type { MindMapEdgeItem, MindMapNodeItem, TopicWorkspaceData } from '@/types/database';
import { NbPortal } from '../history/VersionHistory';

const norm = (s: string) =>
  s
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '');

/**
 * Estúdio 2D ligado ao mundo: todo nó cujo nome é um verbete (ou apelido)
 * ganha a prévia ao passar o mouse, o menu da menção e o Alt+clique.
 */
export function useStudioTagger(root: React.RefObject<HTMLElement | null>, entries: Record<string, NotebookEntry>) {
  useEffect(() => {
    const el = root.current;
    if (!el) return;
    const byName = new Map<string, string>();
    Object.values(entries).forEach((e) => {
      if (e.kind !== 'elemento') return;
      byName.set(norm(e.title), e.id);
      e.aliases.forEach((a) => a.trim().length >= 3 && !byName.has(norm(a)) && byName.set(norm(a), e.id));
    });
    const tag = () => {
      el.querySelectorAll<HTMLInputElement>('div[data-pz-stop] > input[type="text"]').forEach((input) => {
        const node = input.parentElement as HTMLElement;
        const id = byName.get(norm(input.value));
        if (id) {
          if (node.dataset.ref !== id) node.dataset.ref = id;
          node.classList.add('nb-studio-ref');
        } else if (node.dataset.ref) {
          delete node.dataset.ref;
          node.classList.remove('nb-studio-ref');
        }
      });
    };
    tag();
    const mo = new MutationObserver(() => tag());
    mo.observe(el, { childList: true, subtree: true, attributes: true, attributeFilter: ['value'] });
    el.addEventListener('input', tag, true);
    return () => {
      mo.disconnect();
      el.removeEventListener('input', tag, true);
    };
  }, [root, entries]);
}

/** Traz verbetes (e as relações entre eles) para o diagrama. */
export function StudioVerbetesDialog({
  item,
  api,
  entriesApi,
  projectId,
  onClose,
}: {
  item: NotebookItem;
  api: NotebookApi;
  entriesApi: EntriesApi;
  projectId: string | null;
  onClose: () => void;
}) {
  const [q, setQ] = useState('');
  const [picked, setPicked] = useState<Set<string>>(new Set());
  const [withRels, setWithRels] = useState(true);
  const data = (item.data || {}) as TopicWorkspaceData;
  const existing = new Set((data.mindMapNodes || []).map((n) => norm(n.label)));

  const list = useMemo(() => {
    const t = norm(q);
    return Object.values(entriesApi.entries)
      .filter((e) => e.kind === 'elemento')
      .filter((e) => !projectId || !e.project_id || e.project_id === projectId)
      .filter((e) => !t || norm(e.title).includes(t) || e.aliases.some((a) => norm(a).includes(t)))
      .sort((a, b) => a.title.localeCompare(b.title, 'pt-BR'));
  }, [entriesApi.entries, q, projectId]);

  useEffect(() => {
    const k = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', k);
    return () => window.removeEventListener('keydown', k);
  }, [onClose]);

  function add() {
    const nodes: MindMapNodeItem[] = [...(data.mindMapNodes || [])];
    const edges: MindMapEdgeItem[] = [...(data.mindMapEdges || [])];
    const idByName = new Map(nodes.map((n) => [norm(n.label), n.id]));
    const chosen = Array.from(picked)
      .map((id) => entriesApi.entries[id])
      .filter(Boolean);
    // novos nós num círculo em volta do centro
    const fresh = chosen.filter((e) => !idByName.has(norm(e.title)));
    fresh.forEach((e, i) => {
      const a = (2 * Math.PI * i) / Math.max(1, fresh.length) - Math.PI / 2;
      const r = fresh.length > 1 ? 30 : 0;
      const id = `e-${e.id}`;
      nodes.push({ id, label: e.title, note: e.summary || '', x: Math.round(50 + r * Math.cos(a)), y: Math.round(48 + r * 0.8 * Math.sin(a)), color: entryLook(e).color });
      idByName.set(norm(e.title), id);
    });
    if (withRels) {
      const nodeOf = (entryId: string) => {
        const e = entriesApi.entries[entryId];
        return e ? idByName.get(norm(e.title)) : undefined;
      };
      const has = new Set(edges.map((ed) => `${ed.fromId}>${ed.toId}`));
      for (const l of entriesApi.links) {
        const a = nodeOf(l.from_id);
        const b = nodeOf(l.to_id);
        if (!a || !b || has.has(`${a}>${b}`) || has.has(`${b}>${a}`)) continue;
        if (!picked.has(l.from_id) && !picked.has(l.to_id)) continue;
        edges.push({ id: `l-${l.id}`, fromId: a, toId: b, label: l.rel === 'outro' ? l.label : entryRel(l.rel).phrase });
        has.add(`${a}>${b}`);
      }
    }
    api.update(item.id, { data: { ...(item.data || {}), mindMapNodes: nodes, mindMapEdges: edges } as NotebookItem['data'] });
    window.dispatchEvent(new CustomEvent('insight-notebook-reload', { detail: item.id }));
    onClose();
  }

  return (
    <NbPortal>
      <div className="nb-modal-back" onClick={onClose}>
        <div className="nb-modal !max-w-md" role="dialog" aria-label="Trazer verbetes" onClick={(e) => e.stopPropagation()}>
          <div className="flex items-center gap-2 px-4 h-14 border-b border-[var(--nb-line)]">
            <Search className="w-4 h-4 text-[var(--nb-ink-3)]" />
            <input autoFocus value={q} onChange={(e) => setQ(e.target.value)} placeholder="Trazer verbetes para o diagrama…" aria-label="Buscar verbetes" className="flex-1 bg-transparent outline-none text-[14px]" />
            <button type="button" aria-label="Fechar" onClick={onClose} className="p-1 text-[var(--nb-ink-3)] hover:text-[var(--nb-ink)]">
              <X className="w-4 h-4" />
            </button>
          </div>
          <ul className="nb-scroll overflow-y-auto py-1 flex-1 min-h-0">
            {list.map((e) => {
              const on = picked.has(e.id);
              const already = existing.has(norm(e.title));
              return (
                <li key={e.id}>
                  <label className="flex items-center gap-3 px-4 py-2 cursor-pointer hover:bg-white/[0.03]">
                    <input
                      type="checkbox"
                      checked={on}
                      onChange={() =>
                        setPicked((p) => {
                          const n = new Set(p);
                          if (n.has(e.id)) n.delete(e.id);
                          else n.add(e.id);
                          return n;
                        })
                      }
                      className="accent-[var(--nb-ink-2)]"
                    />
                    <span className="flex-1 min-w-0 truncate text-[14px]">{e.title}</span>
                    <span className="text-[11px]" style={{ color: entryLook(e).color }}>
                      {already ? 'já no diagrama' : entryLook(e).label}
                    </span>
                  </label>
                </li>
              );
            })}
            {!list.length && <li className="px-4 py-8 text-center text-[13px] text-[var(--nb-ink-3)]">Nenhum verbete encontrado.</li>}
          </ul>
          <div className="flex items-center gap-3 px-4 py-3 border-t border-[var(--nb-line)]">
            <label className="flex items-center gap-2 text-[12px] text-[var(--nb-ink-2)] cursor-pointer">
              <input type="checkbox" checked={withRels} onChange={(e) => setWithRels(e.target.checked)} className="accent-[var(--nb-ink-2)]" />
              Ligar pelas relações
            </label>
            <div className="flex-1" />
            <button type="button" disabled={!picked.size} onClick={add} className="h-8 px-4 rounded-md bg-[var(--nb-ink)] text-[var(--nb-bg)] text-[12px] font-bold disabled:opacity-40">
              Trazer {picked.size || ''}
            </button>
          </div>
        </div>
      </div>
    </NbPortal>
  );
}
