/**
 * Geometria do Canvas: caixas, guias magnéticas (bordas, centros e espaços
 * iguais), alinhar, distribuir, organizar em grade e ordem de empilhamento.
 * Funções puras: recebem nós e devolvem nós novos.
 */
import { cuid, type CanvasData, type CanvasEdge, type CanvasNode } from './canvas';

export interface Box {
  x: number;
  y: number;
  width: number;
  height: number;
}

export const right = (b: Box) => b.x + b.width;
export const bottom = (b: Box) => b.y + b.height;

/** Caixa que abraça todas as caixas. */
export function bboxOf(list: Box[]): Box | null {
  if (!list.length) return null;
  let x1 = Infinity;
  let y1 = Infinity;
  let x2 = -Infinity;
  let y2 = -Infinity;
  for (const b of list) {
    x1 = Math.min(x1, b.x);
    y1 = Math.min(y1, b.y);
    x2 = Math.max(x2, b.x + b.width);
    y2 = Math.max(y2, b.y + b.height);
  }
  return { x: x1, y: y1, width: x2 - x1, height: y2 - y1 };
}

export const intersects = (a: Box, b: Box) => a.x < b.x + b.width && b.x < a.x + a.width && a.y < b.y + b.height && b.y < a.y + a.height;
export const contains = (outer: Box, inner: Box) => inner.x >= outer.x && inner.y >= outer.y && right(inner) <= right(outer) && bottom(inner) <= bottom(outer);

/**
 * Índice espacial simples (grade uniforme): acha rápido os nós perto de uma
 * área, para as guias e a seleção não varrerem o canvas inteiro.
 */
export class SpatialGrid {
  private cells = new Map<string, CanvasNode[]>();
  constructor(nodes: CanvasNode[], private size = 600) {
    for (const n of nodes) {
      const [cx1, cy1, cx2, cy2] = this.range(n);
      for (let cx = cx1; cx <= cx2; cx++)
        for (let cy = cy1; cy <= cy2; cy++) {
          const k = `${cx}:${cy}`;
          const cell = this.cells.get(k);
          if (cell) cell.push(n);
          else this.cells.set(k, [n]);
        }
    }
  }
  private range(b: Box) {
    const s = this.size;
    return [Math.floor(b.x / s), Math.floor(b.y / s), Math.floor((b.x + b.width) / s), Math.floor((b.y + b.height) / s)];
  }
  query(area: Box): CanvasNode[] {
    const [cx1, cy1, cx2, cy2] = this.range(area);
    // área enorme (zoom muito afastado): devolve tudo
    if ((cx2 - cx1 + 1) * (cy2 - cy1 + 1) > 4000) return Array.from(new Set(Array.from(this.cells.values()).flat()));
    const out = new Set<CanvasNode>();
    for (let cx = cx1; cx <= cx2; cx++)
      for (let cy = cy1; cy <= cy2; cy++) for (const n of this.cells.get(`${cx}:${cy}`) || []) if (intersects(n, area)) out.add(n);
    return Array.from(out);
  }
}

// ---------------------------------------------------------------- guias
export type Guide =
  | { kind: 'line'; axis: 'x' | 'y'; at: number; from: number; to: number }
  | { kind: 'gap'; axis: 'x' | 'y'; segs: [number, number][]; at: number };

export interface SnapResult {
  dx: number;
  dy: number;
  guides: Guide[];
}

const xs = (b: Box) => [b.x, b.x + b.width / 2, b.x + b.width];
const ys = (b: Box) => [b.y, b.y + b.height / 2, b.y + b.height];

/**
 * Ímã ao mover: encosta bordas e centros nas dos vizinhos e iguala espaços
 * entre caixas vizinhas. `tol` já vem em unidades do mundo (px / zoom).
 */
export function snapMove(moving: Box, others: Box[], tol: number): SnapResult {
  let bestX: { d: number; at: number } | null = null;
  let bestY: { d: number; at: number } | null = null;
  for (const o of others) {
    for (const a of xs(moving))
      for (const b of xs(o)) {
        const d = b - a;
        if (Math.abs(d) <= tol && (!bestX || Math.abs(d) < Math.abs(bestX.d))) bestX = { d, at: b };
      }
    for (const a of ys(moving))
      for (const b of ys(o)) {
        const d = b - a;
        if (Math.abs(d) <= tol && (!bestY || Math.abs(d) < Math.abs(bestY.d))) bestY = { d, at: b };
      }
  }
  // espaços iguais (só se não houver um encaixe de borda mais perto)
  const gx = gapSnap(moving, others, tol, 'x');
  const gy = gapSnap(moving, others, tol, 'y');
  let dx = bestX?.d ?? 0;
  let dy = bestY?.d ?? 0;
  let useGapX = false;
  let useGapY = false;
  if (gx && (!bestX || Math.abs(gx.d) < Math.abs(bestX.d))) (dx = gx.d), (useGapX = true);
  if (gy && (!bestY || Math.abs(gy.d) < Math.abs(bestY.d))) (dy = gy.d), (useGapY = true);

  const m: Box = { ...moving, x: moving.x + dx, y: moving.y + dy };
  const guides: Guide[] = [];
  const eps = 0.5;
  if (bestX && !useGapX) {
    // todas as linhas verticais que coincidem depois do ímã
    for (const a of xs(m)) {
      const hits = others.filter((o) => xs(o).some((b) => Math.abs(b - a) < eps));
      if (!hits.length) continue;
      const all = [m, ...hits];
      guides.push({ kind: 'line', axis: 'x', at: a, from: Math.min(...all.map((b) => b.y)), to: Math.max(...all.map(bottom)) });
    }
  }
  if (bestY && !useGapY) {
    for (const a of ys(m)) {
      const hits = others.filter((o) => ys(o).some((b) => Math.abs(b - a) < eps));
      if (!hits.length) continue;
      const all = [m, ...hits];
      guides.push({ kind: 'line', axis: 'y', at: a, from: Math.min(...all.map((b) => b.x)), to: Math.max(...all.map(right)) });
    }
  }
  if (useGapX && gx) guides.push({ kind: 'gap', axis: 'x', segs: gx.segs.map(([a, b]) => [a + 0, b + 0]), at: m.y + m.height / 2 });
  if (useGapY && gy) guides.push({ kind: 'gap', axis: 'y', segs: gy.segs, at: m.x + m.width / 2 });
  return { dx, dy, guides };
}

/** Espaço igual no eixo: entre dois vizinhos, ou repetindo o espaço de um par. */
function gapSnap(m: Box, others: Box[], tol: number, axis: 'x' | 'y'): { d: number; segs: [number, number][] } | null {
  const lo = (b: Box) => (axis === 'x' ? b.x : b.y);
  const hi = (b: Box) => (axis === 'x' ? b.x + b.width : b.y + b.height);
  const size = (b: Box) => (axis === 'x' ? b.width : b.height);
  // vizinhos na mesma faixa (sobrepõem no outro eixo)
  const band = others.filter((o) => (axis === 'x' ? o.y < m.y + m.height && m.y < o.y + o.height : o.x < m.x + m.width && m.x < o.x + o.width));
  const before = band.filter((o) => hi(o) <= lo(m) + tol).sort((a, b) => hi(b) - hi(a));
  const after = band.filter((o) => lo(o) >= hi(m) - tol).sort((a, b) => lo(a) - lo(b));
  let best: { d: number; segs: [number, number][] } | null = null;
  const consider = (d: number, segs: [number, number][]) => {
    if (Math.abs(d) <= tol && (!best || Math.abs(d) < Math.abs(best.d))) best = { d, segs };
  };
  const A = before[0];
  const B = after[0];
  // no meio de dois vizinhos
  if (A && B) {
    const target = (hi(A) + lo(B) - size(m)) / 2;
    const g = target - hi(A);
    if (g > 0) consider(target - lo(m), [[hi(A), hi(A) + g], [target + size(m), lo(B)]]);
  }
  // repete o espaço de um par à esquerda/acima
  if (A && before[1] && lo(A) - hi(before[1]) > 0) {
    const g = lo(A) - hi(before[1]);
    const target = hi(A) + g;
    consider(target - lo(m), [[hi(before[1]), lo(A)], [hi(A), target]]);
  }
  // repete o espaço de um par à direita/abaixo
  if (B && after[1] && lo(after[1]) - hi(B) > 0) {
    const g = lo(after[1]) - hi(B);
    const target = lo(B) - g - size(m);
    consider(target - lo(m), [[target + size(m), lo(B)], [hi(B), lo(after[1])]]);
  }
  return best;
}

/** Ímã ao redimensionar: só as bordas que estão se mexendo. */
export function snapResize(box: Box, dir: string, others: Box[], tol: number): { box: Box; guides: Guide[] } {
  const b = { ...box };
  const guides: Guide[] = [];
  const pick = (v: number, cands: number[]) => {
    let best: number | null = null;
    for (const c of cands) if (Math.abs(c - v) <= tol && (best === null || Math.abs(c - v) < Math.abs(best - v))) best = c;
    return best;
  };
  const vx = others.flatMap((o) => [o.x, o.x + o.width / 2, o.x + o.width]);
  const vy = others.flatMap((o) => [o.y, o.y + o.height / 2, o.y + o.height]);
  if (dir.includes('e')) {
    const s = pick(b.x + b.width, vx);
    if (s !== null) b.width = s - b.x;
  }
  if (dir.includes('w')) {
    const s = pick(b.x, vx);
    if (s !== null) (b.width += b.x - s), (b.x = s);
  }
  if (dir.includes('s')) {
    const s = pick(b.y + b.height, vy);
    if (s !== null) b.height = s - b.y;
  }
  if (dir.includes('n')) {
    const s = pick(b.y, vy);
    if (s !== null) (b.height += b.y - s), (b.y = s);
  }
  const eps = 0.5;
  for (const a of [dir.includes('e') ? b.x + b.width : null, dir.includes('w') ? b.x : null]) {
    if (a === null) continue;
    const hits = others.filter((o) => xs(o).some((v) => Math.abs(v - a) < eps));
    if (hits.length) guides.push({ kind: 'line', axis: 'x', at: a, from: Math.min(b.y, ...hits.map((o) => o.y)), to: Math.max(bottom(b), ...hits.map(bottom)) });
  }
  for (const a of [dir.includes('s') ? b.y + b.height : null, dir.includes('n') ? b.y : null]) {
    if (a === null) continue;
    const hits = others.filter((o) => ys(o).some((v) => Math.abs(v - a) < eps));
    if (hits.length) guides.push({ kind: 'line', axis: 'y', at: a, from: Math.min(b.x, ...hits.map((o) => o.x)), to: Math.max(right(b), ...hits.map(right)) });
  }
  return { box: b, guides };
}

/** Redimensiona uma caixa pela alça `dir` (n, s, e, w, ne, nw, se, sw). */
export function resizeBox(start: Box, dir: string, dx: number, dy: number, o: { minW: number; minH: number; ratio?: number | null }): Box {
  let { x, y, width: w, height: h } = start;
  if (dir.includes('e')) w = start.width + dx;
  if (dir.includes('s')) h = start.height + dy;
  if (dir.includes('w')) w = start.width - dx;
  if (dir.includes('n')) h = start.height - dy;
  w = Math.max(o.minW, w);
  h = Math.max(o.minH, h);
  if (o.ratio) {
    // mantém a proporção pelo lado que mais mudou
    if (dir === 'n' || dir === 's') w = h * o.ratio;
    else if (dir === 'e' || dir === 'w') h = w / o.ratio;
    else if (Math.abs(w - start.width) / start.width > Math.abs(h - start.height) / start.height) h = w / o.ratio;
    else w = h * o.ratio;
  }
  if (dir.includes('w')) x = start.x + start.width - w;
  if (dir.includes('n')) y = start.y + start.height - h;
  return { x, y, width: w, height: h };
}

export const snapToGrid = (v: number, g: number) => Math.round(v / g) * g;

// ---------------------------------------------------------------- arrumar
export type AlignKind = 'left' | 'hcenter' | 'right' | 'top' | 'vcenter' | 'bottom';

export function alignNodes(nodes: CanvasNode[], ids: Set<string>, kind: AlignKind): CanvasNode[] {
  const chosen = nodes.filter((n) => ids.has(n.id) && !n.locked);
  const bb = bboxOf(chosen);
  if (!bb || chosen.length < 2) return nodes;
  return nodes.map((n) => {
    if (!ids.has(n.id) || n.locked) return n;
    if (kind === 'left') return { ...n, x: bb.x };
    if (kind === 'right') return { ...n, x: right(bb) - n.width };
    if (kind === 'hcenter') return { ...n, x: Math.round(bb.x + bb.width / 2 - n.width / 2) };
    if (kind === 'top') return { ...n, y: bb.y };
    if (kind === 'bottom') return { ...n, y: bottom(bb) - n.height };
    return { ...n, y: Math.round(bb.y + bb.height / 2 - n.height / 2) };
  });
}

/** Distribui com espaços iguais entre o primeiro e o último. */
export function distributeNodes(nodes: CanvasNode[], ids: Set<string>, axis: 'x' | 'y'): CanvasNode[] {
  const chosen = nodes.filter((n) => ids.has(n.id) && !n.locked).sort((a, b) => (axis === 'x' ? a.x - b.x : a.y - b.y));
  if (chosen.length < 3) return nodes;
  const first = chosen[0];
  const last = chosen[chosen.length - 1];
  const span = axis === 'x' ? right(last) - first.x : bottom(last) - first.y;
  const total = chosen.reduce((s, n) => s + (axis === 'x' ? n.width : n.height), 0);
  const gap = (span - total) / (chosen.length - 1);
  const pos = new Map<string, number>();
  let at = axis === 'x' ? first.x : first.y;
  for (const n of chosen) {
    pos.set(n.id, Math.round(at));
    at += (axis === 'x' ? n.width : n.height) + gap;
  }
  return nodes.map((n) => (pos.has(n.id) ? (axis === 'x' ? { ...n, x: pos.get(n.id)! } : { ...n, y: pos.get(n.id)! }) : n));
}

/** Organiza em grade (linhas e colunas), na ordem de leitura atual. */
export function arrangeGrid(nodes: CanvasNode[], ids: Set<string>, gap = 40): CanvasNode[] {
  const chosen = nodes.filter((n) => ids.has(n.id) && !n.locked).sort((a, b) => a.y - b.y || a.x - b.x);
  if (chosen.length < 2) return nodes;
  const bb = bboxOf(chosen)!;
  const cols = Math.ceil(Math.sqrt(chosen.length));
  const colW = Math.max(...chosen.map((n) => n.width));
  const rows: CanvasNode[][] = [];
  chosen.forEach((n, i) => (rows[Math.floor(i / cols)] ||= []).push(n));
  const pos = new Map<string, [number, number]>();
  let y = bb.y;
  for (const row of rows) {
    row.forEach((n, c) => pos.set(n.id, [Math.round(bb.x + c * (colW + gap)), Math.round(y)]));
    y += Math.max(...row.map((n) => n.height)) + gap;
  }
  return nodes.map((n) => (pos.has(n.id) ? { ...n, x: pos.get(n.id)![0], y: pos.get(n.id)![1] } : n));
}

/** Ordem de empilhamento: a ordem do vetor é a ordem de desenho. */
export function reorder(nodes: CanvasNode[], ids: Set<string>, how: 'front' | 'back' | 'forward' | 'backward'): CanvasNode[] {
  if (how === 'front') return [...nodes.filter((n) => !ids.has(n.id)), ...nodes.filter((n) => ids.has(n.id))];
  if (how === 'back') return [...nodes.filter((n) => ids.has(n.id)), ...nodes.filter((n) => !ids.has(n.id))];
  const arr = [...nodes];
  if (how === 'forward') {
    for (let i = arr.length - 2; i >= 0; i--) if (ids.has(arr[i].id) && !ids.has(arr[i + 1].id)) [arr[i], arr[i + 1]] = [arr[i + 1], arr[i]];
  } else {
    for (let i = 1; i < arr.length; i++) if (ids.has(arr[i].id) && !ids.has(arr[i - 1].id)) [arr[i], arr[i - 1]] = [arr[i - 1], arr[i]];
  }
  return arr;
}

/** Itens que estão dentro de um grupo (movem junto com ele). */
export function groupChildren(nodes: CanvasNode[], g: CanvasNode): CanvasNode[] {
  return nodes.filter((c) => c.id !== g.id && contains(g, c));
}

/** Copia nós (e as ligações entre eles) com ids novos e deslocamento. */
export function cloneNodes(src: CanvasData, ids: Set<string>, dx: number, dy: number): CanvasData {
  const map = new Map<string, string>();
  const nodes = src.nodes
    .filter((n) => ids.has(n.id))
    .map((n) => {
      const id = cuid();
      map.set(n.id, id);
      return { ...n, id, x: Math.round(n.x + dx), y: Math.round(n.y + dy), locked: false };
    });
  const edges: CanvasEdge[] = src.edges.filter((e) => map.has(e.fromNode) && map.has(e.toNode)).map((e) => ({ ...e, id: cuid(), fromNode: map.get(e.fromNode)!, toNode: map.get(e.toNode)! }));
  return { nodes, edges };
}
