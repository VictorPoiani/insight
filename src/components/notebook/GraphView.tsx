'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { Crosshair, FolderTree, Tags } from '@/components/icons';
import type { NotebookItem } from '@/lib/notebook/types';
import { getTemplate } from '@/lib/notebook/templates';

interface Props {
  items: NotebookItem[];
  activeId: string | null;
  onOpen: (id: string) => void;
  /** grafo local: só a nota ativa e vizinhas */
  local?: boolean;
  compact?: boolean;
}

interface GNode {
  id: string;
  label: string;
  color: string;
  x: number;
  y: number;
  vx: number;
  vy: number;
  r: number;
  ghost?: boolean;
  tag?: boolean;
}

export function GraphView({ items, activeId, onOpen, local = false, compact = false }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const wrapRef = useRef<HTMLDivElement>(null);
  const [showFolders, setShowFolders] = useState(false);
  const [showTags, setShowTags] = useState(false);
  const [hover, setHover] = useState<string | null>(null);
  const view = useRef({ x: 0, y: 0, k: 1 });
  const dragging = useRef<{ node: GNode | null; sx: number; sy: number; moved: boolean; panX: number; panY: number } | null>(null);

  const graph = useMemo(() => {
    const live = items.filter((i) => !i.archived_at);
    const byTitle = new Map(live.map((i) => [i.title.toLowerCase(), i]));
    const nodes = new Map<string, GNode>();
    const edges: [string, string][] = [];
    const add = (n: Omit<GNode, 'x' | 'y' | 'vx' | 'vy'>) => {
      if (!nodes.has(n.id)) {
        const a = Math.random() * Math.PI * 2;
        const d = 60 + Math.random() * 220;
        nodes.set(n.id, { ...n, x: Math.cos(a) * d, y: Math.sin(a) * d, vx: 0, vy: 0 });
      }
    };
    for (const i of live) {
      if (i.kind === 'folder' && i.template === 'folder' && !showFolders) continue;
      add({ id: i.id, label: i.title, color: i.color || getTemplate(i.template).color, r: 4 + Math.min(10, Math.sqrt(i.word_count) / 8) });
    }
    for (const i of live) {
      if (!nodes.has(i.id)) continue;
      for (const l of i.links) {
        const t = byTitle.get(l.toLowerCase());
        if (t && nodes.has(t.id)) edges.push([i.id, t.id]);
        else if (!t) {
          const gid = `ghost:${l.toLowerCase()}`;
          add({ id: gid, label: l, color: '#71717a', r: 3, ghost: true });
          edges.push([i.id, gid]);
        }
      }
      if (i.parent_id && nodes.has(i.parent_id)) edges.push([i.parent_id, i.id]);
      if (showTags) {
        for (const t of i.tags) {
          const tid = `tag:${t}`;
          add({ id: tid, label: `#${t}`, color: '#22c55e', r: 3.5, tag: true });
          edges.push([i.id, tid]);
        }
      }
    }
    let ns = Array.from(nodes.values());
    let es = edges;
    if (local && activeId) {
      const keep = new Set([activeId]);
      for (let depth = 0; depth < 2; depth++) {
        for (const [a, b] of edges) {
          if (keep.has(a)) keep.add(b);
          else if (keep.has(b)) keep.add(a);
        }
      }
      ns = ns.filter((n) => keep.has(n.id));
      es = edges.filter(([a, b]) => keep.has(a) && keep.has(b));
    }
    return { nodes: ns, edges: es };
  }, [items, showFolders, showTags, local, activeId]);

  const neighbors = useMemo(() => {
    const m = new Map<string, Set<string>>();
    for (const [a, b] of graph.edges) {
      if (!m.has(a)) m.set(a, new Set());
      if (!m.has(b)) m.set(b, new Set());
      m.get(a)!.add(b);
      m.get(b)!.add(a);
    }
    return m;
  }, [graph]);

  useEffect(() => {
    const canvas = canvasRef.current;
    const wrap = wrapRef.current;
    if (!canvas || !wrap) return;
    const ctx = canvas.getContext('2d')!;
    const nodes = graph.nodes;
    const idx = new Map(nodes.map((n) => [n.id, n]));
    const edges = graph.edges.map(([a, b]) => [idx.get(a)!, idx.get(b)!] as const).filter(([a, b]) => a && b);
    let alpha = 1;
    let raf = 0;
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    const styles = getComputedStyle(wrap);
    const ink = styles.getPropertyValue('--nb-ink').trim() || '#eee';
    const line = styles.getPropertyValue('--nb-line').trim() || '#333';
    const hl = styles.getPropertyValue('--nb-hl').trim() || '#2563eb';

    const resize = () => {
      const r = wrap.getBoundingClientRect();
      canvas.width = r.width * dpr;
      canvas.height = r.height * dpr;
      canvas.style.width = `${r.width}px`;
      canvas.style.height = `${r.height}px`;
    };
    resize();
    const ro = new ResizeObserver(resize);
    ro.observe(wrap);

    const step = () => {
      if (alpha > 0.005) {
        // repulsão
        for (let i = 0; i < nodes.length; i++) {
          const a = nodes[i];
          for (let j = i + 1; j < nodes.length; j++) {
            const b = nodes[j];
            let dx = a.x - b.x;
            let dy = a.y - b.y;
            let d2 = dx * dx + dy * dy;
            if (d2 < 0.01) {
              dx = Math.random();
              dy = Math.random();
              d2 = 1;
            }
            if (d2 > 160000) continue;
            const f = (1400 / d2) * alpha;
            a.vx += dx * f;
            a.vy += dy * f;
            b.vx -= dx * f;
            b.vy -= dy * f;
          }
        }
        // molas
        for (const [a, b] of edges) {
          const dx = b.x - a.x;
          const dy = b.y - a.y;
          const d = Math.sqrt(dx * dx + dy * dy) || 1;
          const f = ((d - 70) / d) * 0.05 * alpha;
          a.vx += dx * f;
          a.vy += dy * f;
          b.vx -= dx * f;
          b.vy -= dy * f;
        }
        for (const n of nodes) {
          n.vx -= n.x * 0.004 * alpha;
          n.vy -= n.y * 0.004 * alpha;
          if (dragging.current?.node === n) continue;
          n.x += n.vx;
          n.y += n.vy;
          n.vx *= 0.6;
          n.vy *= 0.6;
        }
        alpha *= 0.985;
      }
      draw();
      raf = requestAnimationFrame(step);
    };

    const draw = () => {
      const { x, y, k } = view.current;
      const w = canvas.width;
      const h = canvas.height;
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.clearRect(0, 0, w, h);
      ctx.setTransform(dpr * k, 0, 0, dpr * k, w / 2 + x * dpr, h / 2 + y * dpr);
      const focus = hoverRef.current || activeId;
      const near = focus ? neighbors.get(focus) : null;
      ctx.lineWidth = 1 / k;
      for (const [a, b] of edges) {
        const lit = focus && (a.id === focus || b.id === focus);
        ctx.strokeStyle = lit ? hl : line;
        ctx.globalAlpha = focus && !lit ? 0.35 : 0.9;
        ctx.beginPath();
        ctx.moveTo(a.x, a.y);
        ctx.lineTo(b.x, b.y);
        ctx.stroke();
      }
      for (const n of nodes) {
        const dim = focus && n.id !== focus && !near?.has(n.id);
        ctx.globalAlpha = dim ? 0.25 : 1;
        ctx.fillStyle = n.id === activeId ? hl : n.color;
        ctx.beginPath();
        ctx.arc(n.x, n.y, n.r, 0, Math.PI * 2);
        if (n.ghost) {
          ctx.strokeStyle = n.color;
          ctx.stroke();
        } else ctx.fill();
        if (n.id === activeId) {
          ctx.strokeStyle = hl;
          ctx.lineWidth = 2 / k;
          ctx.beginPath();
          ctx.arc(n.x, n.y, n.r + 4, 0, Math.PI * 2);
          ctx.stroke();
          ctx.lineWidth = 1 / k;
        }
        if (k > 0.7 || n.id === focus || near?.has(n.id)) {
          ctx.globalAlpha = dim ? 0.2 : n.id === focus ? 1 : 0.8;
          ctx.fillStyle = ink;
          ctx.font = `${n.id === focus ? 700 : 500} ${11 / Math.max(0.8, k)}px ui-sans-serif, system-ui`;
          ctx.textAlign = 'center';
          const label = n.label.length > 28 ? `${n.label.slice(0, 27)}…` : n.label;
          ctx.fillText(label, n.x, n.y + n.r + 12 / Math.max(0.8, k));
        }
      }
      ctx.globalAlpha = 1;
    };

    raf = requestAnimationFrame(step);

    const toWorld = (cx: number, cy: number) => {
      const r = canvas.getBoundingClientRect();
      const { x, y, k } = view.current;
      return { wx: (cx - r.left - r.width / 2 - x) / k, wy: (cy - r.top - r.height / 2 - y) / k };
    };
    const pick = (cx: number, cy: number) => {
      const { wx, wy } = toWorld(cx, cy);
      let best: GNode | null = null;
      let bd = Infinity;
      for (const n of nodes) {
        const d = (n.x - wx) ** 2 + (n.y - wy) ** 2;
        if (d < (n.r + 6) ** 2 && d < bd) {
          best = n;
          bd = d;
        }
      }
      return best;
    };

    const down = (e: PointerEvent) => {
      canvas.setPointerCapture(e.pointerId);
      const node = pick(e.clientX, e.clientY);
      dragging.current = { node, sx: e.clientX, sy: e.clientY, moved: false, panX: view.current.x, panY: view.current.y };
      alpha = Math.max(alpha, 0.3);
    };
    const move = (e: PointerEvent) => {
      const d = dragging.current;
      if (!d) {
        const n = pick(e.clientX, e.clientY);
        const id = n?.id ?? null;
        if (id !== hoverRef.current) {
          hoverRef.current = id;
          setHover(id);
        }
        return;
      }
      if (Math.abs(e.clientX - d.sx) + Math.abs(e.clientY - d.sy) > 3) d.moved = true;
      if (d.node) {
        const { wx, wy } = toWorld(e.clientX, e.clientY);
        d.node.x = wx;
        d.node.y = wy;
        alpha = Math.max(alpha, 0.3);
      } else {
        view.current.x = d.panX + (e.clientX - d.sx);
        view.current.y = d.panY + (e.clientY - d.sy);
      }
    };
    const up = () => {
      const d = dragging.current;
      dragging.current = null;
      if (d && !d.moved && d.node && !d.node.ghost && !d.node.tag) onOpenRef.current(d.node.id);
    };
    const wheel = (e: WheelEvent) => {
      e.preventDefault();
      const r = canvas.getBoundingClientRect();
      const v = view.current;
      const nk = Math.min(4, Math.max(0.2, v.k * Math.exp(-e.deltaY * 0.0015)));
      const mx = e.clientX - r.left - r.width / 2;
      const my = e.clientY - r.top - r.height / 2;
      v.x = mx - ((mx - v.x) * nk) / v.k;
      v.y = my - ((my - v.y) * nk) / v.k;
      v.k = nk;
    };
    canvas.addEventListener('pointerdown', down);
    canvas.addEventListener('pointermove', move);
    canvas.addEventListener('pointerup', up);
    canvas.addEventListener('pointercancel', up);
    canvas.addEventListener('wheel', wheel, { passive: false });
    return () => {
      cancelAnimationFrame(raf);
      ro.disconnect();
      canvas.removeEventListener('pointerdown', down);
      canvas.removeEventListener('pointermove', move);
      canvas.removeEventListener('pointerup', up);
      canvas.removeEventListener('pointercancel', up);
      canvas.removeEventListener('wheel', wheel);
    };
  }, [graph, neighbors, activeId]);

  const hoverRef = useRef<string | null>(null);
  const onOpenRef = useRef(onOpen);
  onOpenRef.current = onOpen;

  const hoverNode = hover ? graph.nodes.find((n) => n.id === hover) : null;

  return (
    <div ref={wrapRef} className="nb-graph relative w-full h-full min-h-[240px] overflow-hidden">
      <canvas ref={canvasRef} aria-label="Grafo de conexões entre as notas" role="img" />
      {!compact && (
        <div className="absolute top-3 right-3 flex gap-1.5">
          <Toggle on={showFolders} onClick={() => setShowFolders((v) => !v)} label="Pastas">
            <FolderTree className="w-3.5 h-3.5" />
          </Toggle>
          <Toggle on={showTags} onClick={() => setShowTags((v) => !v)} label="Tags">
            <Tags className="w-3.5 h-3.5" />
          </Toggle>
          <Toggle on={false} onClick={() => (view.current = { x: 0, y: 0, k: 1 })} label="Centralizar">
            <Crosshair className="w-3.5 h-3.5" />
          </Toggle>
        </div>
      )}
      {!compact && (
        <div className="absolute bottom-3 left-3 text-[11px] text-[var(--nb-ink-3)] pointer-events-none">
          {graph.nodes.length} notas · {graph.edges.length} conexões · arraste para mover, role para zoom
        </div>
      )}
      {hoverNode && !compact && (
        <div className="absolute top-3 left-3 px-3 py-1.5 rounded-lg bg-[var(--nb-pane)] border border-[var(--nb-line)] text-xs font-semibold pointer-events-none">
          {hoverNode.label}
          {hoverNode.ghost && <span className="ml-2 text-[var(--nb-ink-3)]">(ainda não existe)</span>}
        </div>
      )}
      {graph.nodes.length === 0 && (
        <p className="absolute inset-0 grid place-items-center text-xs text-[var(--nb-ink-3)] text-center px-6">
          {local ? 'Sem conexões. Use [[Nome da nota]] para ligar ideias.' : 'Crie notas e ligue-as com [[links]] para ver o grafo.'}
        </p>
      )}
    </div>
  );
}

function Toggle({ on, onClick, label, children }: { on: boolean; onClick: () => void; label: string; children: React.ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={on}
      className={`flex items-center gap-1.5 h-7 px-2.5 rounded-lg border text-[11px] font-semibold ${
        on ? 'border-[var(--nb-hl)] text-[var(--nb-hl)] bg-[var(--nb-hl-soft)]' : 'border-[var(--nb-line)] text-[var(--nb-ink-3)] bg-[var(--nb-pane)] hover:text-[var(--nb-ink)]'
      }`}
    >
      {children}
      {label}
    </button>
  );
}
