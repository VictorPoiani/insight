'use client';

import { useMemo, useState } from 'react';
import { entryLook, entryRel, hierarchyEdge, type EntryLink, type NotebookEntry } from '@/lib/notebook/entries';
import type { MindMapEdgeItem, MindMapNodeItem } from '@/types/database';

export interface Tree {
  children: Map<string, { id: string; rel: string }[]>;
  parents: Map<string, string>;
  roots: string[];
}

/** Monta a hierarquia (governa, vassalo de, parte de, membro de…) das menções dadas. */
export function buildTree(entries: NotebookEntry[], links: EntryLink[]): Tree {
  const ids = new Set(entries.map((e) => e.id));
  const children = new Map<string, { id: string; rel: string }[]>();
  const parents = new Map<string, string>();
  for (const l of links) {
    const h = hierarchyEdge(l);
    if (!h || !ids.has(h.parent) || !ids.has(h.child) || parents.has(h.child)) continue;
    // evita ciclos: o pai não pode descender do filho
    let up: string | undefined = h.parent;
    let loop = false;
    while (up) {
      if (up === h.child) {
        loop = true;
        break;
      }
      up = parents.get(up);
    }
    if (loop) continue;
    parents.set(h.child, h.parent);
    children.set(h.parent, [...(children.get(h.parent) || []), { id: h.child, rel: l.rel }]);
  }
  const size = (id: string): number => (children.get(id) || []).reduce((n, c) => n + 1 + size(c.id), 0);
  const roots = Array.from(children.keys())
    .filter((id) => !parents.has(id))
    .sort((a, b) => size(b) - size(a));
  return { children, parents, roots };
}

/** Converte uma árvore em nós e ligações do Estúdio 2D (posições em %). */
export function treeToMindmap(rootId: string, tree: Tree, entries: Record<string, NotebookEntry>): { nodes: MindMapNodeItem[]; edges: MindMapEdgeItem[] } {
  const nodes: MindMapNodeItem[] = [];
  const edges: MindMapEdgeItem[] = [];
  let leaf = 0;
  const depthOf = new Map<string, number>();
  const xOf = new Map<string, number>();
  let maxDepth = 0;
  const walk = (id: string, d: number, seen: Set<string>) => {
    if (seen.has(id)) return;
    seen.add(id);
    depthOf.set(id, d);
    maxDepth = Math.max(maxDepth, d);
    const kids = tree.children.get(id) || [];
    if (!kids.length) xOf.set(id, leaf++);
    else {
      kids.forEach((k) => walk(k.id, d + 1, seen));
      const xs = kids.map((k) => xOf.get(k.id) ?? 0);
      xOf.set(id, (Math.min(...xs) + Math.max(...xs)) / 2);
    }
  };
  walk(rootId, 0, new Set());
  const leaves = Math.max(1, leaf - 1);
  for (const [id, d] of depthOf) {
    const e = entries[id];
    if (!e) continue;
    nodes.push({
      id: `e-${id}`,
      label: e.title,
      note: e.summary || '',
      x: leaf <= 1 ? 50 : 6 + (88 * (xOf.get(id) || 0)) / leaves,
      y: maxDepth ? 10 + (78 * d) / maxDepth : 45,
      color: entryLook(e).color,
    });
  }
  for (const [pid, kids] of tree.children)
    for (const k of kids) if (depthOf.has(pid) && depthOf.has(k.id)) edges.push({ id: `l-${pid}-${k.id}`, fromId: `e-${pid}`, toId: `e-${k.id}`, label: entryRel(k.rel).phrase });
  return { nodes, edges };
}

/**
 * Hierarquia em organograma: reinos e vassalos, ordens e membros, regiões e
 * cidades. Vem das relações de cada verbete.
 */
export function Hierarchy({
  entries,
  links,
  onOpen,
  onStudio,
}: {
  entries: NotebookEntry[];
  links: EntryLink[];
  onOpen: (e: NotebookEntry) => void;
  onStudio: (rootId: string, tree: Tree) => void;
}) {
  const tree = useMemo(() => buildTree(entries, links), [entries, links]);
  const byId = useMemo(() => new Map(entries.map((e) => [e.id, e])), [entries]);
  const [root, setRoot] = useState<string | null>(null);
  const current = root && tree.children.has(root) ? root : tree.roots[0] || null;

  if (!current)
    return (
      <p className="py-6 text-[14px] leading-relaxed text-[var(--nb-ink-3)] border-t border-white/[0.07]">
        Nenhuma hierarquia ainda. Nas relações de um verbete, use <span className="text-[var(--nb-ink-2)]">Governa</span>,{' '}
        <span className="text-[var(--nb-ink-2)]">Vassalo de</span>, <span className="text-[var(--nb-ink-2)]">Parte de</span> ou{' '}
        <span className="text-[var(--nb-ink-2)]">Membro de</span> e o organograma aparece aqui.
      </p>
    );

  const node = (id: string, rel: string | null, seen: Set<string>): React.ReactNode => {
    const e = byId.get(id);
    if (!e || seen.has(id)) return null;
    seen.add(id);
    const kids = tree.children.get(id) || [];
    return (
      <li key={id}>
        <button type="button" className="nb-org-node" data-ref={id} onClick={() => onOpen(e)}>
          {rel && <span className="nb-org-rel">{entryRel(rel).phrase}</span>}
          <span className="nb-org-name">{e.title}</span>
          <span className="nb-org-kind" style={{ color: entryLook(e).color }}>
            {entryLook(e).label}
          </span>
        </button>
        {kids.length > 0 && <ul>{kids.map((k) => node(k.id, k.rel, seen))}</ul>}
      </li>
    );
  };

  return (
    <div>
      <div className="flex flex-wrap items-center gap-3 mb-5">
        {tree.roots.length > 1 && (
          <label className="flex items-center gap-2 text-[12px] text-[var(--nb-ink-3)]">
            A partir de
            <select value={current} onChange={(e) => setRoot(e.target.value)} className="nb-world-select">
              {tree.roots.map((id) => (
                <option key={id} value={id}>
                  {byId.get(id)?.title}
                </option>
              ))}
            </select>
          </label>
        )}
        <button type="button" onClick={() => onStudio(current, tree)} className="text-[12px] font-semibold text-[var(--nb-ink-2)] hover:text-[var(--nb-ink)] underline underline-offset-2">
          Levar para o Estúdio 2D
        </button>
      </div>
      <div className="nb-org nb-scroll">
        <ul>{node(current, null, new Set())}</ul>
      </div>
    </div>
  );
}
