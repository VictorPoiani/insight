'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { ArrowUpRight, Maximize, Minus, Plus, X } from 'lucide-react';
import { ENTRY_RELS, entryLook, entryRel, type EntryLink, type EntryRel, type NotebookEntry } from '@/lib/notebook/entries';
import type { EntriesApi } from '@/lib/notebook/useEntries';
import { Glyph } from '../icons/Glyph';
import { useNotebookMenu } from '../menu/ContextMenu';
import { useNotebookLinks } from '../editor/linkContext';
import { GitFork, PanelRight } from 'lucide-react';

// ============================================================ peças comuns
export function EntryAvatar({ entry, size = 32, ring = true }: { entry: NotebookEntry; size?: number; ring?: boolean }) {
  const look = entryLook(entry);
  const style: React.CSSProperties = { width: size, height: size, borderColor: ring ? look.color : 'transparent' };
  if (entry.image_url) {
    // eslint-disable-next-line @next/next/no-img-element
    return <img src={entry.image_url} alt="" style={style} className="shrink-0 rounded-full object-cover border-2 bg-[var(--nb-pane-2)]" />;
  }
  return (
    <span
      style={{ ...style, color: look.color, background: `color-mix(in srgb, ${look.color} 16%, var(--nb-pane))`, fontSize: size * 0.46 }}
      className="shrink-0 rounded-full grid place-items-center border-2"
    >
      <Glyph name={look.glyph} />
    </span>
  );
}

/** Como mostrar a relação do ponto de vista de `me`. */
function relText(l: EntryLink, me: string) {
  const r = entryRel(l.rel);
  const out = l.from_id === me;
  if (l.rel === 'outro') return l.label || 'relacionado a';
  if (out) return r.phrase;
  const inverse: Partial<Record<EntryRel, string>> = { pai: 'filho(a) de', mentor: 'aprendiz de', membro: 'tem como membro', mora: 'lar de', governa: 'governado por', vassalo: 'suserano de', parte: 'inclui', fundou: 'fundado por', venera: 'venerado por', criou: 'criado por' };
  return inverse[l.rel] || r.phrase;
}

/** Relações de uma menção: lista e formulário para adicionar. */
export function RelationsEditor({ entry, entriesApi }: { entry: NotebookEntry; entriesApi: EntriesApi }) {
  const [rel, setRel] = useState<EntryRel>('conhece');
  const [target, setTarget] = useState('');
  const [label, setLabel] = useState('');
  const mine = entriesApi.links.filter((l) => l.from_id === entry.id || l.to_id === entry.id);
  const others = Object.values(entriesApi.entries)
    .filter((e) => e.id !== entry.id && e.kind === 'elemento')
    .sort((a, b) => a.title.localeCompare(b.title, 'pt-BR'));

  return (
    <div className="space-y-2">
      {mine.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {mine.map((l) => {
            const otherId = l.from_id === entry.id ? l.to_id : l.from_id;
            const o = entriesApi.entries[otherId];
            if (!o) return null;
            const r = entryRel(l.rel);
            return (
              <span key={l.id} className="group flex items-center gap-1.5 h-7 pl-1 pr-1.5 rounded-full border text-[11px]" style={{ borderColor: `color-mix(in srgb, ${r.color} 45%, transparent)` }}>
                <EntryAvatar entry={o} size={20} ring={false} />
                <span className="text-[var(--nb-ink-3)]">{relText(l, entry.id)}</span>
                <span className="font-bold">{o.title}</span>
                <button
                  type="button"
                  aria-label="Remover relação"
                  onClick={() => void entriesApi.removeLink(l.id)}
                  className="opacity-40 group-hover:opacity-100 text-[var(--nb-ink-3)] hover:text-red-400"
                >
                  <X className="w-3 h-3" />
                </button>
              </span>
            );
          })}
        </div>
      )}
      <form
        className="flex flex-wrap items-center gap-1.5"
        onSubmit={(e) => {
          e.preventDefault();
          if (!target) return;
          void entriesApi.addLink(entry.id, target, rel, rel === 'outro' ? label : '');
          setTarget('');
          setLabel('');
        }}
      >
        <span className="text-[11px] text-[var(--nb-ink-3)] max-w-[120px] truncate">{entry.title} é</span>
        <select value={rel} onChange={(e) => setRel(e.target.value as EntryRel)} aria-label="Tipo de relação" className="h-7 px-1.5 rounded-lg bg-[var(--nb-bg)] border border-[var(--nb-line)] text-[11px] outline-none">
          {ENTRY_RELS.map((r) => (
            <option key={r.id} value={r.id}>
              {r.label.toLowerCase()}
            </option>
          ))}
        </select>
        {rel === 'outro' && (
          <input value={label} onChange={(e) => setLabel(e.target.value.slice(0, 80))} placeholder="ex.: rival de infância de" className="h-7 w-40 px-2 rounded-lg bg-[var(--nb-bg)] border border-[var(--nb-line)] text-[11px] outline-none" />
        )}
        <select value={target} onChange={(e) => setTarget(e.target.value)} aria-label="Com quem" className="h-7 max-w-[180px] px-1.5 rounded-lg bg-[var(--nb-bg)] border border-[var(--nb-line)] text-[11px] outline-none">
          <option value="">escolha a menção…</option>
          {others.map((o) => (
            <option key={o.id} value={o.id}>
              {o.title}
            </option>
          ))}
        </select>
        <button type="submit" disabled={!target} className="h-7 px-2.5 rounded-lg bg-[var(--nb-pane-2)] text-[11px] font-bold disabled:opacity-40 hover:text-[var(--nb-hl)]">
          Relacionar
        </button>
      </form>
    </div>
  );
}

/** Painel lateral com a menção selecionada (grafo e genealogia). */
export function EntrySidePanel({
  entry,
  entriesApi,
  onClose,
  onReadMore,
}: {
  entry: NotebookEntry;
  entriesApi: EntriesApi;
  onClose: () => void;
  onReadMore: (e: NotebookEntry) => void;
}) {
  const look = entryLook(entry);
  return (
    <div className="nb-mention-panel" data-pz-stop>
      <div className="flex items-start gap-3">
        <EntryAvatar entry={entry} size={48} />
        <div className="min-w-0 flex-1">
          <p className="text-[10px] font-black uppercase tracking-wider" style={{ color: look.color }}>
            {look.label}
          </p>
          <p className="text-[16px] font-extrabold leading-tight">{entry.title}</p>
        </div>
        <button type="button" aria-label="Fechar" onClick={onClose} className="p-1 rounded-md text-[var(--nb-ink-3)] hover:text-[var(--nb-ink)]">
          <X className="w-4 h-4" />
        </button>
      </div>
      <p className="mt-2 text-[13px] leading-relaxed text-[var(--nb-ink-2)] whitespace-pre-line max-h-40 overflow-y-auto nb-scroll">{entry.summary || 'Sem resumo ainda.'}</p>
      <button type="button" onClick={() => onReadMore(entry)} className="mt-2 flex items-center gap-1 h-7 px-2.5 rounded-lg bg-[var(--nb-hl)] text-white text-[11px] font-bold">
        Ler mais <ArrowUpRight className="w-3 h-3" />
      </button>
      <p className="mt-4 mb-1.5 text-[10px] font-black uppercase tracking-wider text-[var(--nb-ink-3)]">Relações</p>
      <RelationsEditor entry={entry} entriesApi={entriesApi} />
    </div>
  );
}

// ============================================================ zoom simples (svg/html)
export function useZoom() {
  const [view, setView] = useState({ x: 0, y: 0, k: 1 });
  const drag = useRef<{ x: number; y: number; vx: number; vy: number } | null>(null);
  const props = {
    onWheel: (e: React.WheelEvent) => {
      const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
      const mx = e.clientX - rect.left;
      const my = e.clientY - rect.top;
      setView((v) => {
        const k = Math.min(2.5, Math.max(0.25, v.k * (e.deltaY < 0 ? 1.12 : 1 / 1.12)));
        return { k, x: mx - ((mx - v.x) / v.k) * k, y: my - ((my - v.y) / v.k) * k };
      });
    },
    onPointerDown: (e: React.PointerEvent) => {
      if ((e.target as HTMLElement).closest('[data-node],[data-pz-stop],button,select,input')) return;
      drag.current = { x: e.clientX, y: e.clientY, vx: view.x, vy: view.y };
      (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    },
    onPointerMove: (e: React.PointerEvent) => {
      const d = drag.current;
      if (d) setView((v) => ({ ...v, x: d.vx + e.clientX - d.x, y: d.vy + e.clientY - d.y }));
    },
    onPointerUp: () => (drag.current = null),
  };
  return { view, setView, props };
}

function ZoomBar({ onIn, onOut, onFit, k }: { onIn: () => void; onOut: () => void; onFit: () => void; k: number }) {
  const btn = 'p-1.5 rounded-lg text-[var(--nb-ink-3)] hover:text-[var(--nb-ink)] hover:bg-[var(--nb-pane-2)]';
  return (
    <div data-pz-stop className="absolute bottom-3 right-3 z-20 flex items-center gap-0.5 p-1 rounded-xl bg-[var(--nb-pane)] border border-[var(--nb-line)] shadow-xl">
      <button type="button" aria-label="Afastar" onClick={onOut} className={btn}>
        <Minus className="w-3.5 h-3.5" />
      </button>
      <span className="w-10 text-center text-[10px] font-bold tabular-nums text-[var(--nb-ink-2)]">{Math.round(k * 100)}%</span>
      <button type="button" aria-label="Aproximar" onClick={onIn} className={btn}>
        <Plus className="w-3.5 h-3.5" />
      </button>
      <button type="button" aria-label="Enquadrar" onClick={onFit} className={btn}>
        <Maximize className="w-3.5 h-3.5" />
      </button>
    </div>
  );
}

// ============================================================ grafo de conexões
type Pt = { x: number; y: number };

/** Layout de forças simples e determinístico (sem bibliotecas). */
function forceLayout(ids: string[], edges: [string, string][], prev: Record<string, Pt>): Record<string, Pt> {
  const pos: Record<string, Pt & { vx: number; vy: number }> = {};
  ids.forEach((id, i) => {
    const a = (i / Math.max(1, ids.length)) * Math.PI * 2;
    const p = prev[id] || { x: Math.cos(a) * 220 + (i % 3) * 9, y: Math.sin(a) * 220 + (i % 5) * 7 };
    pos[id] = { ...p, vx: 0, vy: 0 };
  });
  const E = edges.filter(([a, b]) => pos[a] && pos[b]);
  for (let it = 0; it < 260; it++) {
    const t = 1 - it / 260;
    for (let i = 0; i < ids.length; i++) {
      for (let j = i + 1; j < ids.length; j++) {
        const a = pos[ids[i]];
        const b = pos[ids[j]];
        let dx = a.x - b.x;
        let dy = a.y - b.y;
        let d2 = dx * dx + dy * dy;
        if (d2 < 0.01) {
          dx = 0.1 * (i - j);
          dy = 0.1;
          d2 = 0.02;
        }
        const f = 26000 / d2;
        const d = Math.sqrt(d2);
        a.vx += (dx / d) * f;
        a.vy += (dy / d) * f;
        b.vx -= (dx / d) * f;
        b.vy -= (dy / d) * f;
      }
    }
    for (const [s, e] of E) {
      const a = pos[s];
      const b = pos[e];
      const dx = b.x - a.x;
      const dy = b.y - a.y;
      const d = Math.sqrt(dx * dx + dy * dy) || 1;
      const f = (d - 170) * 0.06;
      a.vx += (dx / d) * f;
      a.vy += (dy / d) * f;
      b.vx -= (dx / d) * f;
      b.vy -= (dy / d) * f;
    }
    for (const id of ids) {
      const p = pos[id];
      if (prev[id]) {
        p.vx *= 0.2;
        p.vy *= 0.2;
      }
      p.vx -= p.x * 0.004;
      p.vy -= p.y * 0.004;
      const sp = Math.min(30 * t + 1, Math.sqrt(p.vx * p.vx + p.vy * p.vy));
      const n = Math.sqrt(p.vx * p.vx + p.vy * p.vy) || 1;
      p.x += (p.vx / n) * sp;
      p.y += (p.vy / n) * sp;
      p.vx *= 0.5;
      p.vy *= 0.5;
    }
  }
  const out: Record<string, Pt> = {};
  for (const id of ids) out[id] = { x: Math.round(pos[id].x), y: Math.round(pos[id].y) };
  return out;
}

export function MentionGraph({
  entries,
  links,
  storageKey,
  selectedId,
  onSelect,
}: {
  entries: NotebookEntry[];
  links: EntryLink[];
  storageKey: string;
  selectedId: string | null;
  onSelect: (id: string | null) => void;
}) {
  const ids = useMemo(() => entries.map((e) => e.id), [entries]);
  const edges = useMemo(() => links.filter((l) => ids.includes(l.from_id) && ids.includes(l.to_id)), [links, ids]);
  const [pos, setPos] = useState<Record<string, Pt>>({});
  const boxRef = useRef<HTMLDivElement>(null);
  const { view, setView, props } = useZoom();
  const dragNode = useRef<{ id: string; sx: number; sy: number; px: number; py: number; moved: boolean } | null>(null);
  const menu = useNotebookMenu();
  const nbLinks = useNotebookLinks();

  // posições salvas no aparelho; o layout de forças completa as que faltam
  useEffect(() => {
    let saved: Record<string, Pt> = {};
    try {
      saved = JSON.parse(localStorage.getItem(storageKey) || '{}');
    } catch {
      /* ignora */
    }
    setPos(forceLayout(ids, edges.map((l) => [l.from_id, l.to_id]), saved));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ids.join(','), edges.length, storageKey]);

  const save = (p: Record<string, Pt>) => {
    try {
      localStorage.setItem(storageKey, JSON.stringify(p));
    } catch {
      /* ignora */
    }
  };

  const fit = () => {
    const box = boxRef.current?.getBoundingClientRect();
    const pts = Object.values(pos);
    if (!box || !pts.length) return;
    const xs = pts.map((p) => p.x);
    const ys = pts.map((p) => p.y);
    const w = Math.max(...xs) - Math.min(...xs) + 220;
    const h = Math.max(...ys) - Math.min(...ys) + 220;
    const k = Math.min(1.4, Math.max(0.3, Math.min(box.width / w, box.height / h)));
    const cx = (Math.max(...xs) + Math.min(...xs)) / 2;
    const cy = (Math.max(...ys) + Math.min(...ys)) / 2;
    setView({ k, x: box.width / 2 - cx * k, y: box.height / 2 - cy * k });
  };
  const fitted = useRef(false);
  useEffect(() => {
    if (!fitted.current && Object.keys(pos).length) {
      fitted.current = true;
      fit();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pos]);

  const neighbors = useMemo(() => {
    if (!selectedId) return null;
    const s = new Set([selectedId]);
    edges.forEach((l) => (l.from_id === selectedId ? s.add(l.to_id) : l.to_id === selectedId ? s.add(l.from_id) : null));
    return s;
  }, [edges, selectedId]);

  if (!entries.length) {
    return <EmptyCanvas text="Crie menções (digite + no texto) para ver o grafo de quem conhece quem." />;
  }

  return (
    <div ref={boxRef} className="nb-mention-canvas" {...props} onClick={(e) => !(e.target as HTMLElement).closest('[data-node]') && onSelect(null)}>
      <div style={{ transform: `translate(${view.x}px, ${view.y}px) scale(${view.k})`, transformOrigin: '0 0' }} className="absolute left-0 top-0">
        <svg className="absolute overflow-visible" style={{ left: 0, top: 0, width: 1, height: 1 }}>
          {edges.map((l) => {
            const a = pos[l.from_id];
            const b = pos[l.to_id];
            if (!a || !b) return null;
            const r = entryRel(l.rel);
            const dim = neighbors && !(neighbors.has(l.from_id) && neighbors.has(l.to_id));
            return (
              <g key={l.id} opacity={dim ? 0.12 : 0.85}>
                <line x1={a.x} y1={a.y} x2={b.x} y2={b.y} stroke={r.color} strokeWidth={1.6} strokeDasharray={l.rel === 'inimigo' ? '5 5' : undefined} />
                {!dim && selectedId && (
                  <text x={(a.x + b.x) / 2} y={(a.y + b.y) / 2 - 6} textAnchor="middle" fontSize="10" fill={r.color} style={{ fontWeight: 700 }}>
                    {l.rel === 'outro' ? l.label : r.label.toLowerCase()}
                  </text>
                )}
              </g>
            );
          })}
        </svg>
        {entries.map((e) => {
          const p = pos[e.id];
          if (!p) return null;
          const dim = neighbors && !neighbors.has(e.id);
          return (
            <div
              key={e.id}
              data-node
              className={`nb-gnode ${selectedId === e.id ? 'is-selected' : ''}`}
              style={{ left: p.x, top: p.y, opacity: dim ? 0.25 : 1 }}
              onContextMenu={(ev) =>
                menu.open(
                  ev,
                  [
                    { label: 'Ver detalhes e relações', icon: <PanelRight className="w-3.5 h-3.5" />, run: () => onSelect(e.id) },
                    { label: 'Abrir (Ler mais)', icon: <ArrowUpRight className="w-3.5 h-3.5" />, run: () => nbLinks.readMore?.(e.id) },
                  ],
                  e.title
                )
              }
              onPointerDown={(ev) => {
                if (ev.button !== 0) return;
                ev.stopPropagation();
                (ev.currentTarget as HTMLElement).setPointerCapture(ev.pointerId);
                dragNode.current = { id: e.id, sx: ev.clientX, sy: ev.clientY, px: p.x, py: p.y, moved: false };
              }}
              onPointerMove={(ev) => {
                const d = dragNode.current;
                if (!d || d.id !== e.id) return;
                const dx = (ev.clientX - d.sx) / view.k;
                const dy = (ev.clientY - d.sy) / view.k;
                if (Math.abs(dx) + Math.abs(dy) > 3) d.moved = true;
                if (d.moved) setPos((prev) => ({ ...prev, [e.id]: { x: Math.round(d.px + dx), y: Math.round(d.py + dy) } }));
              }}
              onPointerUp={() => {
                const d = dragNode.current;
                dragNode.current = null;
                if (d?.moved) setPos((prev) => (save(prev), prev));
                else onSelect(e.id);
              }}
            >
              <EntryAvatar entry={e} size={selectedId === e.id ? 54 : 46} />
              <span className="nb-gnode-label">{e.title}</span>
            </div>
          );
        })}
      </div>
      <ZoomBar k={view.k} onIn={() => setView((v) => ({ ...v, k: Math.min(2.5, v.k * 1.2) }))} onOut={() => setView((v) => ({ ...v, k: Math.max(0.25, v.k / 1.2) }))} onFit={fit} />
      <button
        type="button"
        data-pz-stop
        onClick={() => {
          const fresh = forceLayout(ids, edges.map((l) => [l.from_id, l.to_id]), {});
          setPos(fresh);
          save(fresh);
          setTimeout(fit, 0);
        }}
        className="absolute bottom-3 left-3 z-20 h-8 px-3 rounded-xl bg-[var(--nb-pane)] border border-[var(--nb-line)] text-[11px] font-bold text-[var(--nb-ink-2)] hover:text-[var(--nb-ink)]"
      >
        Reorganizar
      </button>
    </div>
  );
}

function EmptyCanvas({ text }: { text: string }) {
  return (
    <div className="nb-mention-canvas grid place-items-center">
      <p className="max-w-sm text-center text-[13px] text-[var(--nb-ink-3)]">{text}</p>
    </div>
  );
}

// ============================================================ genealogia
type FamNode = { id: string; gen: number; x: number };

/**
 * Árvore genealógica a partir de uma pessoa: sobe pelos pais, desce pelos
 * filhos, e põe cônjuges e irmãos na mesma geração.
 */
function familyLayout(rootId: string, links: EntryLink[]) {
  const parentsOf = new Map<string, Set<string>>();
  const childrenOf = new Map<string, Set<string>>();
  const spouses = new Map<string, Set<string>>();
  const siblings = new Map<string, Set<string>>();
  const add = (m: Map<string, Set<string>>, a: string, b: string) => (m.get(a) || m.set(a, new Set()).get(a)!).add(b);
  for (const l of links) {
    if (l.rel === 'pai') {
      add(parentsOf, l.to_id, l.from_id);
      add(childrenOf, l.from_id, l.to_id);
    } else if (l.rel === 'conjuge') {
      add(spouses, l.from_id, l.to_id);
      add(spouses, l.to_id, l.from_id);
    } else if (l.rel === 'irmao') {
      add(siblings, l.from_id, l.to_id);
      add(siblings, l.to_id, l.from_id);
    }
  }
  // geração de cada um (busca em largura)
  const gen = new Map<string, number>([[rootId, 0]]);
  const queue = [rootId];
  while (queue.length && gen.size < 300) {
    const id = queue.shift()!;
    const g = gen.get(id)!;
    const visit = (o: string, ng: number) => {
      if (!gen.has(o)) {
        gen.set(o, ng);
        queue.push(o);
      }
    };
    parentsOf.get(id)?.forEach((p) => visit(p, g - 1));
    childrenOf.get(id)?.forEach((c) => visit(c, g + 1));
    spouses.get(id)?.forEach((s) => visit(s, g));
    siblings.get(id)?.forEach((s) => visit(s, g));
  }
  const gens = Array.from(new Set(gen.values())).sort((a, b) => a - b);
  const rows: string[][] = gens.map((g) => Array.from(gen.entries()).filter(([, v]) => v === g).map(([k]) => k));
  const x = new Map<string, number>();
  const GAP = 170;
  rows.forEach((row, ri) => {
    // ordem: pela média das posições dos pais (baricentro); cônjuges juntos
    const score = (id: string) => {
      const ps = Array.from(parentsOf.get(id) || []).filter((p) => x.has(p));
      if (ps.length) return ps.reduce((s, p) => s + x.get(p)!, 0) / ps.length;
      const sp = Array.from(spouses.get(id) || []).find((s) => x.has(s));
      return sp ? x.get(sp)! + 1 : ri === 0 ? 0 : 1e6;
    };
    const ordered: string[] = [];
    const used = new Set<string>();
    [...row]
      .sort((a, b) => score(a) - score(b))
      .forEach((id) => {
        if (used.has(id)) return;
        used.add(id);
        ordered.push(id);
        spouses.get(id)?.forEach((s) => {
          if (row.includes(s) && !used.has(s)) {
            used.add(s);
            ordered.push(s);
          }
        });
      });
    const width = (ordered.length - 1) * GAP;
    const parentsCenter = (() => {
      const xs = ordered.flatMap((id) => Array.from(parentsOf.get(id) || []).filter((p) => x.has(p)).map((p) => x.get(p)!));
      return xs.length ? xs.reduce((s, v) => s + v, 0) / xs.length : 0;
    })();
    ordered.forEach((id, i) => x.set(id, Math.round(parentsCenter - width / 2 + i * GAP)));
    rows[ri] = ordered;
  });
  const nodes: FamNode[] = Array.from(gen.entries()).map(([id, g]) => ({ id, gen: g, x: x.get(id) || 0 }));
  // casais e famílias (pais → filhos)
  const couples: [string, string][] = [];
  spouses.forEach((set, a) => set.forEach((b) => a < b && gen.has(a) && gen.has(b) && couples.push([a, b])));
  const families = new Map<string, { parents: string[]; children: string[] }>();
  childrenOf.forEach((kids, p) =>
    kids.forEach((c) => {
      if (!gen.has(p) || !gen.has(c)) return;
      const ps = Array.from(parentsOf.get(c) || []).filter((q) => gen.has(q)).sort();
      const key = ps.join('+');
      const f = families.get(key) || { parents: ps, children: [] };
      if (!f.children.includes(c)) f.children.push(c);
      families.set(key, f);
    })
  );
  return { nodes, couples, families: Array.from(families.values()), minGen: gens[0] ?? 0 };
}

export function FamilyTree({
  entries,
  links,
  rootId,
  selectedId,
  onSelect,
  onRoot,
}: {
  onRoot?: (id: string) => void;
  entries: Record<string, NotebookEntry>;
  links: EntryLink[];
  rootId: string | null;
  selectedId: string | null;
  onSelect: (id: string | null) => void;
}) {
  const boxRef = useRef<HTMLDivElement>(null);
  const { view, setView, props } = useZoom();
  const menu = useNotebookMenu();
  const nbLinks = useNotebookLinks();
  const layout = useMemo(() => (rootId ? familyLayout(rootId, links) : null), [rootId, links]);
  const ROW = 150;
  const posOf = (id: string) => {
    const n = layout?.nodes.find((m) => m.id === id);
    return n ? { x: n.x, y: (n.gen - (layout?.minGen || 0)) * ROW } : null;
  };

  const fit = () => {
    const box = boxRef.current?.getBoundingClientRect();
    if (!box || !layout?.nodes.length) return;
    const xs = layout.nodes.map((n) => n.x);
    const ys = layout.nodes.map((n) => (n.gen - layout.minGen) * ROW);
    const w = Math.max(...xs) - Math.min(...xs) + 260;
    const h = Math.max(...ys) - Math.min(...ys) + 200;
    const k = Math.min(1.3, Math.max(0.3, Math.min(box.width / w, box.height / h)));
    setView({ k, x: box.width / 2 - ((Math.max(...xs) + Math.min(...xs)) / 2) * k, y: box.height / 2 - ((Math.max(...ys) + Math.min(...ys)) / 2) * k });
  };
  useEffect(() => {
    fit();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rootId, layout?.nodes.length]);

  if (!rootId || !layout) return <EmptyCanvas text="Escolha uma pessoa para ver a árvore. Crie relações de família (pai/mãe, cônjuge, irmão) nas menções." />;
  if (layout.nodes.length < 2) return <EmptyCanvas text="Esta pessoa ainda não tem família registrada. Adicione relações de pai/mãe, cônjuge ou irmão." />;

  const CARD_H = 44;
  return (
    <div ref={boxRef} className="nb-mention-canvas" {...props} onClick={(e) => !(e.target as HTMLElement).closest('[data-node]') && onSelect(null)}>
      <div style={{ transform: `translate(${view.x}px, ${view.y}px) scale(${view.k})`, transformOrigin: '0 0' }} className="absolute left-0 top-0">
        <svg className="absolute overflow-visible" style={{ left: 0, top: 0, width: 1, height: 1 }}>
          {layout.couples.map(([a, b]) => {
            const pa = posOf(a);
            const pb = posOf(b);
            if (!pa || !pb) return null;
            return <line key={`${a}-${b}`} x1={pa.x} y1={pa.y} x2={pb.x} y2={pb.y} stroke="#f472b6" strokeWidth={2} strokeDasharray="1 5" strokeLinecap="round" />;
          })}
          {layout.families.map((f, i) => {
            const ps = f.parents.map(posOf).filter(Boolean) as Pt[];
            const cs = f.children.map(posOf).filter(Boolean) as Pt[];
            if (!ps.length || !cs.length) return null;
            const top = { x: ps.reduce((s, p) => s + p.x, 0) / ps.length, y: ps[0].y + CARD_H / 2 };
            const busY = Math.min(...cs.map((c) => c.y)) - ROW / 2 + 6;
            const minX = Math.min(top.x, ...cs.map((c) => c.x));
            const maxX = Math.max(top.x, ...cs.map((c) => c.x));
            return (
              <g key={i} stroke="var(--nb-ink-3)" strokeWidth={1.4} fill="none" opacity={0.7}>
                <path d={`M${top.x} ${top.y} V${busY}`} />
                <path d={`M${minX} ${busY} H${maxX}`} />
                {cs.map((c, j) => (
                  <path key={j} d={`M${c.x} ${busY} V${c.y - CARD_H / 2}`} />
                ))}
              </g>
            );
          })}
        </svg>
        {layout.nodes.map((n) => {
          const e = entries[n.id];
          const p = posOf(n.id)!;
          if (!e) return null;
          return (
            <div
              key={n.id}
              data-node
              onClick={() => onSelect(e.id)}
              onContextMenu={(ev) =>
                menu.open(
                  ev,
                  [
                    { label: 'Ver detalhes e relações', icon: <PanelRight className="w-3.5 h-3.5" />, run: () => onSelect(e.id) },
                    ...(onRoot && n.id !== rootId ? [{ label: 'Árvore a partir desta pessoa', icon: <GitFork className="w-3.5 h-3.5" />, run: () => onRoot(e.id) }] : []),
                    { label: 'Abrir (Ler mais)', icon: <ArrowUpRight className="w-3.5 h-3.5" />, run: () => nbLinks.readMore?.(e.id) },
                  ],
                  e.title
                )
              }
              className={`nb-fnode ${selectedId === e.id ? 'is-selected' : ''} ${n.id === rootId ? 'is-root' : ''}`}
              style={{ left: p.x, top: p.y }}
            >
              <EntryAvatar entry={e} size={30} />
              <span className="truncate">{e.title}</span>
            </div>
          );
        })}
      </div>
      <ZoomBar k={view.k} onIn={() => setView((v) => ({ ...v, k: Math.min(2.5, v.k * 1.2) }))} onOut={() => setView((v) => ({ ...v, k: Math.max(0.25, v.k / 1.2) }))} onFit={fit} />
    </div>
  );
}

