/**
 * Comparação de versões (instantâneos) de uma nota.
 * O texto é quebrado em blocos (parágrafos do markdown ou blocos do HTML do
 * capítulo); a comparação acha os blocos iguais, e dentro de cada bloco
 * alterado mostra palavra por palavra o que entrou e o que saiu.
 * Cada trecho alterado pode ser restaurado sozinho.
 */
import type { NotebookItemData, NotebookTemplate } from './types';

export interface TextBlock {
  /** markdown ou HTML original do bloco */
  raw: string;
  /** texto puro, para comparar e mostrar */
  text: string;
}

export type BlockMode = 'markdown' | 'html';

export interface DiffSource {
  template: NotebookTemplate | string;
  content: string;
  data: NotebookItemData | null;
}

/** Modelos cujo texto é markdown simples (comparável parágrafo a parágrafo). */
const MARKDOWN_TEMPLATES = new Set([
  'markdown',
  'journal',
  'screenplay',
  'study',
  'idea',
  'world',
  'meeting',
  'poem',
  'article',
  'character',
]);

export function blockMode(template: string): BlockMode | null {
  if (template === 'chapter') return 'html';
  if (MARKDOWN_TEMPLATES.has(template)) return 'markdown';
  return null;
}

const norm = (s: string) => s.replace(/\s+/g, ' ').trim();

export function mdToText(md: string) {
  return md
    .replace(/!\[([^\]]*)\]\([^)]*\)/g, '[imagem $1]')
    .replace(/\[([^\]]+)\]\((?:ref:)?[^)]*\)/g, '$1')
    .replace(/\[\[([^\]|#]+)(?:[#|][^\]]*)?\]\]/g, '$1')
    .replace(/^#{1,6}\s+/gm, '')
    .replace(/^>\s?(\[![a-z]+\]\s*)?/gim, '')
    .replace(/^\s*[-*+]\s+(\[[ xX]\]\s+)?/gm, '• ')
    .replace(/(\*\*|__|~~|==|\*|_|`)/g, '')
    .trim();
}

export function splitBlocks(src: DiffSource): TextBlock[] | null {
  const mode = blockMode(src.template);
  if (!mode) return null;
  if (mode === 'html') {
    const html = String(src.data?.html || '');
    if (!html.trim()) return [];
    if (typeof DOMParser === 'undefined') return [{ raw: html, text: html.replace(/<[^>]+>/g, ' ') }];
    const doc = new DOMParser().parseFromString(`<body>${html}</body>`, 'text/html');
    const out: TextBlock[] = [];
    doc.body.childNodes.forEach((n) => {
      if (n.nodeType === 1) {
        const el = n as HTMLElement;
        const text = el.tagName === 'IMG' || el.tagName === 'FIGURE' ? `[imagem ${el.textContent || ''}]`.trim() : el.tagName === 'HR' ? '* * *' : el.textContent || '';
        out.push({ raw: el.outerHTML, text: norm(text) || (el.getAttribute('data-page-break') !== null ? '[nova página]' : '') });
      } else if (n.nodeType === 3 && (n.textContent || '').trim()) {
        out.push({ raw: n.textContent || '', text: norm(n.textContent || '') });
      }
    });
    return out;
  }
  const md = src.content || '';
  if (!md.trim()) return [];
  const out: TextBlock[] = [];
  let rest = md;
  // propriedades no topo ficam num bloco só
  const fm = /^---\n[\s\S]*?\n---\n?/.exec(rest);
  if (fm) {
    out.push({ raw: fm[0].replace(/\n+$/, ''), text: 'Propriedades: ' + norm(fm[0].replace(/---/g, '')) });
    rest = rest.slice(fm[0].length);
  }
  // blocos de código não são quebrados no meio
  const parts: string[] = [];
  let buf: string[] = [];
  let fence = false;
  for (const line of rest.split('\n')) {
    if (/^```/.test(line)) fence = !fence;
    if (!fence && !line.trim()) {
      if (buf.length) parts.push(buf.join('\n'));
      buf = [];
      continue;
    }
    buf.push(line);
  }
  if (buf.length) parts.push(buf.join('\n'));
  for (const raw of parts) out.push({ raw, text: norm(mdToText(raw)) });
  return out;
}

export function joinBlocks(blocks: string[], mode: BlockMode) {
  return mode === 'html' ? blocks.join('') : blocks.join('\n\n') + '\n';
}

// ------------------------------------------------------------------ LCS

type Op = { t: 'same'; a: number; b: number } | { t: 'del'; a: number } | { t: 'add'; b: number };

/** Sequência comum mais longa com corte das pontas iguais (rápido para textos longos). */
function lcsOps<T>(a: T[], b: T[], eq: (x: T, y: T) => boolean, limit = 4_000_000): Op[] {
  let start = 0;
  while (start < a.length && start < b.length && eq(a[start], b[start])) start++;
  let endA = a.length;
  let endB = b.length;
  while (endA > start && endB > start && eq(a[endA - 1], b[endB - 1])) {
    endA--;
    endB--;
  }
  const ops: Op[] = [];
  for (let i = 0; i < start; i++) ops.push({ t: 'same', a: i, b: i });
  const n = endA - start;
  const m = endB - start;
  if (n * m > limit) {
    // grande demais: trata o miolo como uma troca única
    for (let i = start; i < endA; i++) ops.push({ t: 'del', a: i });
    for (let j = start; j < endB; j++) ops.push({ t: 'add', b: j });
  } else if (n || m) {
    const w = m + 1;
    const dp = new Uint32Array((n + 1) * w);
    for (let i = n - 1; i >= 0; i--)
      for (let j = m - 1; j >= 0; j--)
        dp[i * w + j] = eq(a[start + i], b[start + j]) ? dp[(i + 1) * w + j + 1] + 1 : Math.max(dp[(i + 1) * w + j], dp[i * w + j + 1]);
    let i = 0;
    let j = 0;
    while (i < n || j < m) {
      if (i < n && j < m && eq(a[start + i], b[start + j])) {
        ops.push({ t: 'same', a: start + i, b: start + j });
        i++;
        j++;
      } else if (j < m && (i >= n || dp[i * w + j + 1] >= dp[(i + 1) * w + j])) {
        ops.push({ t: 'add', b: start + j });
        j++;
      } else {
        ops.push({ t: 'del', a: start + i });
        i++;
      }
    }
  }
  for (let k = 0; endA + k < a.length; k++) ops.push({ t: 'same', a: endA + k, b: endB + k });
  return ops;
}

// ------------------------------------------------------------------ palavras

export type WordSeg = { t: 'same' | 'del' | 'add'; s: string };

export function wordDiff(x: string, y: string): WordSeg[] {
  const ta = x.split(/(\s+)/).filter(Boolean);
  const tb = y.split(/(\s+)/).filter(Boolean);
  const ops = lcsOps(ta, tb, (p, q) => p === q, 2_500_000);
  const out: WordSeg[] = [];
  const push = (t: WordSeg['t'], s: string) => {
    const last = out[out.length - 1];
    if (last && last.t === t) last.s += s;
    else out.push({ t, s });
  };
  // em cada trecho alterado, mostra primeiro o que saiu e depois o que entrou
  let dels = '';
  let adds = '';
  const flushRun = () => {
    if (dels) push('del', dels);
    if (adds) push('add', adds);
    dels = '';
    adds = '';
  };
  for (const op of ops) {
    if (op.t === 'same') {
      // espaço entre duas trocas fica dentro da troca
      if ((dels || adds) && /^\s+$/.test(ta[op.a])) {
        if (adds) adds += ta[op.a];
        else dels += ta[op.a];
        continue;
      }
      flushRun();
      push('same', ta[op.a]);
    } else if (op.t === 'del') dels += ta[op.a];
    else adds += tb[op.b];
  }
  flushRun();
  // espaços nas pontas das trocas voltam a ser texto comum
  return out.flatMap((sg) => {
    if (sg.t === 'same') return [sg];
    const m = /^([\s\S]*?)(\s*)$/.exec(sg.s)!;
    return m[2] ? [{ t: sg.t, s: m[1] }, { t: 'same' as const, s: m[2] }] : [sg];
  }).filter((sg) => sg.s);
}

const countW = (s: string) => (s.match(/[\p{L}\p{N}]+/gu) || []).length;

// ------------------------------------------------------------------ trechos

/** Intervalo de blocos: antigos [aFrom, aTo) e atuais [bFrom, bTo). */
export interface BlockRange {
  aFrom: number;
  aTo: number;
  bFrom: number;
  bTo: number;
}

export interface HunkRow extends BlockRange {
  kind: 'changed' | 'removed' | 'added';
  segs: WordSeg[];
}

export interface Hunk extends BlockRange {
  rows: HunkRow[];
  added: number;
  removed: number;
}

const wordsOf = (s: string) => (s.toLowerCase().match(/[\p{L}\p{N}]+/gu) || []) as string[];
/** Semelhança entre dois parágrafos (palavras em comum). */
function similarity(a: string, b: string) {
  const wa = wordsOf(a);
  const wb = wordsOf(b);
  if (!wa.length || !wb.length) return 0;
  const set = new Map<string, number>();
  wa.forEach((w) => set.set(w, (set.get(w) || 0) + 1));
  let common = 0;
  wb.forEach((w) => {
    const n = set.get(w) || 0;
    if (n > 0) {
      common++;
      set.set(w, n - 1);
    }
  });
  return common / Math.max(wa.length, wb.length);
}

export type DiffPiece = { t: 'same'; count: number; text: string[] } | { t: 'hunk'; hunk: Hunk };

export interface DiffResult {
  pieces: DiffPiece[];
  hunks: Hunk[];
  added: number;
  removed: number;
}

export function diffBlocks(oldB: TextBlock[], curB: TextBlock[]): DiffResult {
  const ops = lcsOps(oldB, curB, (p, q) => p.text === q.text && (p.text !== '' || p.raw === q.raw));
  const pieces: DiffPiece[] = [];
  const hunks: Hunk[] = [];
  let added = 0;
  let removed = 0;
  let k = 0;
  let ai = 0;
  let bi = 0;
  while (k < ops.length) {
    const op = ops[k];
    if (op.t === 'same') {
      const last = pieces[pieces.length - 1];
      if (last && last.t === 'same') {
        last.count++;
        last.text.push(curB[op.b].text);
      } else pieces.push({ t: 'same', count: 1, text: [curB[op.b].text] });
      ai = op.a + 1;
      bi = op.b + 1;
      k++;
      continue;
    }
    const dels: number[] = [];
    const adds: number[] = [];
    while (k < ops.length && ops[k].t !== 'same') {
      const o = ops[k] as Exclude<Op, { t: 'same' }>;
      if (o.t === 'del') dels.push(o.a);
      else adds.push(o.b);
      k++;
    }
    const hunk: Hunk = {
      aFrom: dels.length ? dels[0] : ai,
      aTo: dels.length ? dels[dels.length - 1] + 1 : ai,
      bFrom: adds.length ? adds[0] : bi,
      bTo: adds.length ? adds[adds.length - 1] + 1 : bi,
      rows: [],
      added: 0,
      removed: 0,
    };
    // pareia cada parágrafo antigo com o atual mais parecido (na ordem)
    let curA = hunk.aFrom;
    let posB = hunk.bFrom;
    let j = 0;
    const pushAdded = (b: number) => {
      hunk.rows.push({ kind: 'added', segs: [{ t: 'add', s: curB[b].text }], aFrom: curA, aTo: curA, bFrom: b, bTo: b + 1 });
      posB = b + 1;
    };
    for (const a of dels) {
      let best = -1;
      let bestSim = 0.34;
      for (let q = j; q < adds.length; q++) {
        const sim = similarity(oldB[a].text, curB[adds[q]].text);
        if (sim > bestSim) {
          bestSim = sim;
          best = q;
        }
      }
      if (best >= 0) {
        for (let q = j; q < best; q++) pushAdded(adds[q]);
        const b = adds[best];
        hunk.rows.push({ kind: 'changed', segs: wordDiff(oldB[a].text, curB[b].text), aFrom: a, aTo: a + 1, bFrom: b, bTo: b + 1 });
        curA = a + 1;
        posB = b + 1;
        j = best + 1;
      } else {
        hunk.rows.push({ kind: 'removed', segs: [{ t: 'del', s: oldB[a].text }], aFrom: a, aTo: a + 1, bFrom: posB, bTo: posB });
        curA = a + 1;
      }
    }
    for (let q = j; q < adds.length; q++) pushAdded(adds[q]);
    for (const r of hunk.rows)
      for (const s of r.segs) {
        if (s.t === 'add') hunk.added += countW(s.s);
        if (s.t === 'del') hunk.removed += countW(s.s);
      }
    added += hunk.added;
    removed += hunk.removed;
    ai = hunk.aTo;
    bi = hunk.bTo;
    hunks.push(hunk);
    pieces.push({ t: 'hunk', hunk });
  }
  return { pieces, hunks, added, removed };
}

/** Volta só um trecho para a versão antiga; devolve os blocos atuais novos. */
export function restoreHunk(oldB: TextBlock[], curB: TextBlock[], h: BlockRange): string[] {
  return [...curB.slice(0, h.bFrom).map((b) => b.raw), ...oldB.slice(h.aFrom, h.aTo).map((b) => b.raw), ...curB.slice(h.bTo).map((b) => b.raw)];
}
