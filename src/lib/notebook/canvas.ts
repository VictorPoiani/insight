/**
 * Canvas: quadro infinito da escrita livre (como o Canvas do Obsidian).
 * O formato segue de perto o JSON Canvas (jsoncanvas.org): nós com posição e
 * tamanho, ligações entre lados de nós. Fica em item.data.canvas.
 */

export type CanvasSide = 'top' | 'right' | 'bottom' | 'left';
export type CanvasNodeType = 'text' | 'note' | 'image' | 'link' | 'group';

export interface CanvasNode {
  id: string;
  type: CanvasNodeType;
  x: number;
  y: number;
  width: number;
  height: number;
  /** cor (índice da paleta, como no JSON Canvas: "1".."6") */
  color?: string | null;
  /** texto em markdown (cartão de texto) */
  text?: string;
  /** nota do Notebook incorporada */
  itemId?: string;
  /** imagem ou endereço externo */
  url?: string;
  /** nome do arquivo (imagem) ou título do grupo */
  label?: string;
}

export interface CanvasEdge {
  id: string;
  fromNode: string;
  toNode: string;
  fromSide?: CanvasSide;
  toSide?: CanvasSide;
  label?: string;
  color?: string | null;
}

export interface CanvasData {
  nodes: CanvasNode[];
  edges: CanvasEdge[];
}

export const CANVAS_COLORS: { id: string; label: string; css: string }[] = [
  { id: '1', label: 'Vermelho', css: '#f87171' },
  { id: '2', label: 'Laranja', css: '#fb923c' },
  { id: '3', label: 'Amarelo', css: '#facc15' },
  { id: '4', label: 'Verde', css: '#4ade80' },
  { id: '5', label: 'Ciano', css: '#22d3ee' },
  { id: '6', label: 'Roxo', css: '#a78bfa' },
];
export const canvasColor = (c?: string | null) => CANVAS_COLORS.find((x) => x.id === c)?.css || null;

export const cuid = () => Math.random().toString(36).slice(2, 12);

const num = (v: unknown, d: number) => (Number.isFinite(Number(v)) ? Number(v) : d);

export function normalizeCanvas(raw: unknown): CanvasData {
  const d = (raw || {}) as Partial<CanvasData>;
  const nodes = (Array.isArray(d.nodes) ? d.nodes : [])
    .filter((n) => n && typeof n.id === 'string')
    .map((n) => ({
      ...n,
      type: (['text', 'note', 'image', 'link', 'group'] as const).includes(n.type) ? n.type : 'text',
      x: num(n.x, 0),
      y: num(n.y, 0),
      width: Math.max(80, num(n.width, 260)),
      height: Math.max(40, num(n.height, 140)),
    }));
  const ids = new Set(nodes.map((n) => n.id));
  const edges = (Array.isArray(d.edges) ? d.edges : []).filter((e) => e && ids.has(e.fromNode) && ids.has(e.toNode));
  return { nodes, edges };
}

/** Ponto do meio de um lado do nó. */
export function sidePoint(n: CanvasNode, side: CanvasSide): [number, number] {
  if (side === 'top') return [n.x + n.width / 2, n.y];
  if (side === 'bottom') return [n.x + n.width / 2, n.y + n.height];
  if (side === 'left') return [n.x, n.y + n.height / 2];
  return [n.x + n.width, n.y + n.height / 2];
}

/** Lados mais naturais para ligar dois nós. */
export function autoSides(a: CanvasNode, b: CanvasNode): [CanvasSide, CanvasSide] {
  const ax = a.x + a.width / 2;
  const ay = a.y + a.height / 2;
  const bx = b.x + b.width / 2;
  const by = b.y + b.height / 2;
  const dx = bx - ax;
  const dy = by - ay;
  if (Math.abs(dx) * (a.height + b.height) > Math.abs(dy) * (a.width + b.width)) return dx > 0 ? ['right', 'left'] : ['left', 'right'];
  return dy > 0 ? ['bottom', 'top'] : ['top', 'bottom'];
}

const OUT: Record<CanvasSide, [number, number]> = { top: [0, -1], bottom: [0, 1], left: [-1, 0], right: [1, 0] };

/** Curva entre dois lados (como no Obsidian). */
export function edgePath(p1: [number, number], s1: CanvasSide, p2: [number, number], s2: CanvasSide) {
  const d = Math.max(40, Math.min(220, Math.hypot(p2[0] - p1[0], p2[1] - p1[1]) / 2.2));
  const c1 = [p1[0] + OUT[s1][0] * d, p1[1] + OUT[s1][1] * d];
  const c2 = [p2[0] + OUT[s2][0] * d, p2[1] + OUT[s2][1] * d];
  return { d: `M${p1[0]} ${p1[1]} C${c1[0]} ${c1[1]} ${c2[0]} ${c2[1]} ${p2[0]} ${p2[1]}`, mid: [(p1[0] + 3 * c1[0] + 3 * c2[0] + p2[0]) / 8, (p1[1] + 3 * c1[1] + 3 * c2[1] + p2[1]) / 8] as [number, number] };
}

/**
 * Texto do canvas para busca, [[links]] e #tags (vira o `content` da nota):
 * o texto dos cartões e os títulos das notas incorporadas como [[links]].
 */
export function canvasToContent(c: CanvasData, titleOf: (id: string) => string | null): string {
  const parts: string[] = [];
  for (const n of c.nodes) {
    if (n.type === 'text' && n.text?.trim()) parts.push(n.text.trim());
    if (n.type === 'group' && n.label?.trim()) parts.push(`## ${n.label.trim()}`);
    if (n.type === 'note' && n.itemId) {
      const t = titleOf(n.itemId);
      if (t) parts.push(`[[${t}]]`);
    }
    if (n.type === 'link' && n.url) parts.push(n.url);
  }
  for (const e of c.edges) if (e.label?.trim()) parts.push(e.label.trim());
  return parts.join('\n\n');
}

/** Exporta no formato JSON Canvas (abre no Obsidian). */
export function toJsonCanvas(c: CanvasData, titleOf: (id: string) => string | null) {
  return {
    nodes: c.nodes.map((n) => {
      const base = { id: n.id, x: Math.round(n.x), y: Math.round(n.y), width: Math.round(n.width), height: Math.round(n.height), ...(n.color ? { color: n.color } : {}) };
      if (n.type === 'group') return { ...base, type: 'group', label: n.label || '' };
      if (n.type === 'link') return { ...base, type: 'link', url: n.url || '' };
      if (n.type === 'image') return { ...base, type: 'link', url: n.url || '' };
      if (n.type === 'note') return { ...base, type: 'file', file: `${titleOf(n.itemId || '') || 'Nota'}.md` };
      return { ...base, type: 'text', text: n.text || '' };
    }),
    edges: c.edges.map((e) => ({ id: e.id, fromNode: e.fromNode, toNode: e.toNode, ...(e.fromSide ? { fromSide: e.fromSide } : {}), ...(e.toSide ? { toSide: e.toSide } : {}), ...(e.label ? { label: e.label } : {}), toEnd: 'arrow' })),
  };
}
