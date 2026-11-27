/**
 * Modelos do Canvas: estruturas prontas para escrita (atos, jornada,
 * personagem, quadro de tarefas, linha do tempo, mural de referências).
 * Cada modelo monta cartões, grupos e ligações em volta de um ponto.
 */
import { cuid, type CanvasData, type CanvasEdge, type CanvasNode } from './canvas';

export interface CanvasTemplate {
  id: string;
  label: string;
  description: string;
  build: (x: number, y: number) => CanvasData;
}

const text = (x: number, y: number, t: string, w = 260, h = 140, color?: string): CanvasNode => ({ id: cuid(), type: 'text', x: Math.round(x), y: Math.round(y), width: w, height: h, text: t, color: color || null });
const group = (x: number, y: number, w: number, h: number, label: string, color?: string): CanvasNode => ({ id: cuid(), type: 'group', x: Math.round(x), y: Math.round(y), width: w, height: h, label, color: color || null });
const edge = (a: CanvasNode, b: CanvasNode, label?: string): CanvasEdge => ({ id: cuid(), fromNode: a.id, toNode: b.id, label });

/** Cartões em fila, ligados em sequência. */
function chain(x: number, y: number, items: string[], w = 240, h = 150, gap = 70) {
  const total = items.length * w + (items.length - 1) * gap;
  const nodes = items.map((t, i) => text(x - total / 2 + i * (w + gap), y - h / 2, t, w, h));
  const edges = nodes.slice(1).map((n, i) => ({ ...edge(nodes[i], n), fromSide: 'right' as const, toSide: 'left' as const }));
  return { nodes, edges };
}

export const CANVAS_TEMPLATES: CanvasTemplate[] = [
  {
    id: 'tres-atos',
    label: 'Três atos',
    description: 'Apresentação, confronto e resolução, com os pontos de virada.',
    build: (x, y) => {
      const w = 420;
      const gap = 60;
      const acts = [
        ['Ato I — Apresentação', '## Mundo comum\nQuem é o protagonista antes de tudo mudar?', '## Incidente incitante\nO que tira a história do lugar?', '1'],
        ['Ato II — Confronto', '## Ponto médio\nA virada que muda o objetivo.', '## Tudo parece perdido\nO momento mais baixo.', '3'],
        ['Ato III — Resolução', '## Clímax\nO confronto final.', '## Novo equilíbrio\nComo o mundo fica depois?', '4'],
      ];
      const nodes: CanvasNode[] = [];
      const edges: CanvasEdge[] = [];
      let prev: CanvasNode | null = null;
      acts.forEach(([label, a, b, color], i) => {
        const gx = x - (3 * w + 2 * gap) / 2 + i * (w + gap);
        const g = group(gx, y - 230, w, 460, label, color);
        const c1 = text(gx + 30, y - 190, a, w - 60, 170);
        const c2 = text(gx + 30, y + 10, b, w - 60, 170);
        nodes.push(g, c1, c2);
        edges.push(edge(c1, c2));
        if (prev) edges.push({ ...edge(prev, c1), fromSide: 'right', toSide: 'left' });
        prev = c2;
      });
      return { nodes, edges };
    },
  },
  {
    id: 'jornada',
    label: 'Jornada do herói',
    description: 'As doze etapas, em dois arcos ligados.',
    build: (x, y) => {
      const steps = ['Mundo comum', 'Chamado à aventura', 'Recusa do chamado', 'Encontro com o mentor', 'Travessia do limiar', 'Testes, aliados e inimigos', 'Aproximação da caverna', 'Provação', 'Recompensa', 'Caminho de volta', 'Ressurreição', 'Retorno com o elixir'];
      const w = 220;
      const h = 110;
      const gap = 50;
      const nodes = steps.map((s, i) => {
        const row = i < 6 ? 0 : 1;
        const col = row ? 11 - i : i;
        return text(x - (6 * w + 5 * gap) / 2 + col * (w + gap), y - 160 + row * 260, `### ${i + 1}. ${s}\n`, w, h, row ? '5' : '6');
      });
      const edges = nodes.slice(1).map((n, i) => {
        const turn = i === 5;
        return { ...edge(nodes[i], n), fromSide: turn ? ('bottom' as const) : i < 5 ? ('right' as const) : ('left' as const), toSide: turn ? ('top' as const) : i < 5 ? ('left' as const) : ('right' as const) };
      });
      return { nodes, edges };
    },
  },
  {
    id: 'personagem',
    label: 'Mapa de personagem',
    description: 'O personagem no centro, com desejo, medo, segredo e relações.',
    build: (x, y) => {
      const c = text(x - 150, y - 90, '# Nome do personagem\nUma frase que o resume.', 300, 180, '6');
      const around = [
        ['## Desejo\nO que ele quer?', -470, -260],
        ['## Necessidade\nO que ele precisa de verdade?', 170, -260],
        ['## Medo\nDo que ele foge?', -470, 120],
        ['## Segredo\nO que ninguém sabe?', 170, 120],
        ['## Relações\n- \n- ', -150, 260],
      ] as const;
      const nodes = [c];
      const edges: CanvasEdge[] = [];
      for (const [t, dx, dy] of around) {
        const n = text(x + dx, y + dy, t, 300, 140);
        nodes.push(n);
        edges.push(edge(c, n));
      }
      return { nodes, edges };
    },
  },
  {
    id: 'linha-tempo',
    label: 'Linha do tempo',
    description: 'Acontecimentos em ordem, da esquerda para a direita.',
    build: (x, y) => chain(x, y, ['### Antes\nO que veio antes da história.', '### Começo\n', '### Virada\n', '### Crise\n', '### Fim\n']),
  },
  {
    id: 'kanban',
    label: 'Quadro de tarefas',
    description: 'A fazer, fazendo e feito, para acompanhar a revisão.',
    build: (x, y) => {
      const cols = [
        ['A fazer', '1'],
        ['Fazendo', '3'],
        ['Feito', '4'],
      ];
      const w = 320;
      const gap = 40;
      const nodes: CanvasNode[] = [];
      cols.forEach(([label, color], i) => {
        const gx = x - (3 * w + 2 * gap) / 2 + i * (w + gap);
        nodes.push(group(gx, y - 260, w, 520, label, color));
        if (i === 0) nodes.push(text(gx + 20, y - 220, 'Revisar o capítulo 1', w - 40, 80), text(gx + 20, y - 125, 'Checar nomes no Codex', w - 40, 80));
      });
      return { nodes, edges: [] };
    },
  },
  {
    id: 'mural',
    label: 'Mural de referências',
    description: 'Espaços para imagens, cores, sons e citações que dão o tom.',
    build: (x, y) => {
      const nodes = [
        group(x - 520, y - 300, 640, 600, 'Imagens'),
        group(x + 160, y - 300, 360, 280, 'Paleta e clima', '5'),
        group(x + 160, y + 20, 360, 280, 'Citações', '2'),
        text(x - 480, y - 250, 'Cole ou arraste imagens aqui.', 260, 80),
        text(x + 190, y - 250, 'Como esse lugar cheira? Que horas são? Que cor domina?', 300, 120),
        text(x + 190, y + 70, '> Uma frase que dá o tom.', 300, 100),
      ];
      return { nodes, edges: [] };
    },
  },
];
