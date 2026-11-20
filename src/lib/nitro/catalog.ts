/**
 * Catálogo do Insight Nitro (beta fechada).
 * Fonte única dos itens: os efeitos são descritos por dados e renderizados por
 * um único motor CSS (src/components/nitro/nitro.css).
 * Especificação completa: docs/insight-nitro.md
 */

export type NitroKind = 'title' | 'tag' | 'frame' | 'intro';

export type NitroCollectionId =
  | 'natal'
  | 'infernal'
  | 'imperial'
  | 'celestial'
  | 'anime'
  | 'princess'
  | 'cyber'
  | 'cosmico'
  | 'selva'
  | 'sombras'
  | 'oceano'
  | 'patentes';

export type NitroRarity = 'comum' | 'rara' | 'épica' | 'lendária';

export type NitroRequirement =
  | { type: 'nitro' }
  | { type: 'level'; min: number }
  | { type: 'event'; label: string };

export interface NitroCollection {
  id: NitroCollectionId;
  name: string;
  description: string;
  colors: [string, string];
}

interface BaseItem {
  id: string;
  kind: NitroKind;
  name: string;
  collection: NitroCollectionId;
  rarity: NitroRarity;
  requirement: NitroRequirement;
  description: string;
}

export type FrameOrnament =
  | 'crown'
  | 'tiara'
  | 'horns'
  | 'laurel'
  | 'circuit'
  | 'saturn'
  | 'wreath'
  | 'snowflake'
  | 'grid'
  | 'santa-hat'
  | 'vines'
  | 'jaguar'
  | 'fox'
  | 'lurking'
  | 'wave'
  | 'storm'
  | 'halo';

/** Efeitos renderizados por scripts/nitro-render (shader → WebP animado). */
export type FrameFx =
  | 'fire' | 'aurora' | 'electric' | 'ocean' | 'shadow' | 'spirit' | 'nebula'
  | 'magma' | 'frost' | 'gold' | 'neon' | 'sakura' | 'forest';

/** Camada desenhada ATRÁS do avatar (profundidade). */
export type FrameBackLayer = 'flames' | 'fox-tails' | 'smoke' | 'foliage' | 'storm-cloud';

export type ParticleMode = 'fall' | 'orbit' | 'rise' | 'twinkle';

export interface FrameItem extends BaseItem {
  kind: 'frame';
  ring: {
    colors: string[];
    anim: 'spin' | 'pulse' | 'flicker' | 'shimmer' | 'none';
    /** Espessura relativa ao tamanho do avatar (0–1). */
    width?: number;
  };
  glow?: string;
  ornament?: FrameOrnament;
  back?: FrameBackLayer;
  /** Efeito procedural pré-renderizado (public/nitro/frames/<fx>-*.webp). Substitui anel e brilho CSS. */
  fx?: FrameFx;
  particles?: { glyph: string; mode: ParticleMode; count: number; color?: string };
  /** Molduras de patente 0–3 são sempre estáticas. */
  alwaysStatic?: boolean;
}

export interface TitleItem extends BaseItem {
  kind: 'title';
  colors: string[];
  anim: 'shine' | 'flow' | 'flicker' | 'pulse' | 'glitch';
  fallback: string;
  glow?: string;
  icon?: 'crown' | 'sparkle' | 'petal' | 'snow';
}

export type TagIcon =
  | 'zap'
  | 'gift'
  | 'snowflake'
  | 'flame'
  | 'crown'
  | 'star'
  | 'sparkles'
  | 'gem'
  | 'cpu'
  | 'orbit';

export interface TagItem extends BaseItem {
  kind: 'tag';
  label: string;
  icon: TagIcon;
  bg: string;
  fg: string;
  border: string;
  shimmer?: boolean;
  mono?: boolean;
}

export interface IntroItem extends BaseItem {
  kind: 'intro';
  reveal?: { kind: 'circle' | 'curtain' | 'split' | 'iris'; colors: string[] };
  particles?: {
    glyph: string;
    mode: 'fall' | 'burst' | 'streak' | 'cross';
    count: number;
    colors?: string[];
  };
  fx?: 'flash' | 'glitch' | 'speedlines';
  /** Cena dedicada (motor de cenas). Sem cena, usa o motor genérico em camadas. */
  scene?: IntroSceneId;
  durationMs: number;
}

export type IntroSceneId =
  | 'monster'
  | 'jaguar'
  | 'storm'
  | 'tsunami'
  | 'portal'
  | 'anime-cut'
  | 'hyperspace';

export type NitroItem = FrameItem | TitleItem | TagItem | IntroItem;

// ============================================================================
// COLEÇÕES
// ============================================================================

export const NITRO_COLLECTIONS: NitroCollection[] = [
  { id: 'natal', name: 'Natal', description: 'Neve, guirlandas e presentes.', colors: ['#c1121f', '#2d6a4f'] },
  { id: 'infernal', name: 'Infernal', description: 'Brasa, magma e pactos sombrios.', colors: ['#f97316', '#7f1d1d'] },
  { id: 'imperial', name: 'Imperial', description: 'Ouro, púrpura e coroas.', colors: ['#d4a72c', '#4c1d95'] },
  { id: 'celestial', name: 'Celestial', description: 'Auroras, estrelas e eclipses.', colors: ['#5eead4', '#a78bfa'] },
  { id: 'anime', name: 'Anime', description: 'Sakura, tinta e linhas de ação.', colors: ['#f9a8d4', '#111827'] },
  { id: 'princess', name: 'Princess', description: 'Pérolas, cristais e contos de fada.', colors: ['#fbcfe8', '#c4b5fd'] },
  { id: 'cyber', name: 'Cyber', description: 'Néon, cromo e circuitos.', colors: ['#22d3ee', '#e11d48'] },
  { id: 'cosmico', name: 'Cósmico', description: 'Nebulosas, órbitas e hiperespaço.', colors: ['#6d28d9', '#ec4899'] },
  { id: 'selva', name: 'Selva & Natureza', description: 'Onças, cipós, vaga-lumes e tempestades.', colors: ['#15803d', '#f59e0b'] },
  { id: 'sombras', name: 'Sombras & Monstros', description: 'O que espreita no escuro.', colors: ['#020617', '#a3e635'] },
  { id: 'oceano', name: 'Oceano', description: 'Ondas em xilogravura e marés.', colors: ['#1e3a5f', '#f7f3e8'] },
  { id: 'patentes', name: 'Patentes', description: 'Conquistadas pelos níveis de contribuinte.', colors: ['#4285F4', '#d4a72c'] },
];

const NITRO: NitroRequirement = { type: 'nitro' };

// ============================================================================
// ESTILOS DE TÍTULO (10)
// ============================================================================

const TITLES: TitleItem[] = [
  { id: 'title-gold-brushed', kind: 'title', name: 'Ouro Escovado', collection: 'imperial', rarity: 'rara', requirement: NITRO,
    description: 'Ouro em quatro tons com uma faixa de brilho atravessando o nome.',
    colors: ['#a16207', '#facc15', '#fef08a', '#ca8a04'], anim: 'shine', fallback: '#d4a72c' },
  { id: 'title-celestial-aurora', kind: 'title', name: 'Celestial Aurora', collection: 'celestial', rarity: 'épica', requirement: NITRO,
    description: 'Verde-água ao violeta, ondulando como uma aurora.',
    colors: ['#5eead4', '#38bdf8', '#a78bfa', '#5eead4'], anim: 'flow', fallback: '#5eead4', glow: 'rgba(94,234,212,0.45)' },
  { id: 'title-rainbow-prism', kind: 'title', name: 'Rainbow Prismático', collection: 'cosmico', rarity: 'lendária', requirement: NITRO,
    description: 'O espectro completo deslizando em loop.',
    colors: ['#ef4444', '#f59e0b', '#eab308', '#22c55e', '#3b82f6', '#8b5cf6', '#ec4899', '#ef4444'], anim: 'flow', fallback: '#a78bfa' },
  { id: 'title-infernal-embers', kind: 'title', name: 'Brasas Infernais', collection: 'infernal', rarity: 'épica', requirement: NITRO,
    description: 'Laranja e vermelho cintilando como brasa viva.',
    colors: ['#fde047', '#f97316', '#dc2626', '#f97316'], anim: 'flicker', fallback: '#f97316', glow: 'rgba(249,115,22,0.55)' },
  { id: 'title-christmas-frost', kind: 'title', name: 'Gelo Natalino', collection: 'natal', rarity: 'rara', requirement: NITRO,
    description: 'Azul-gelo com cristais brilhando.',
    colors: ['#e0f2fe', '#7dd3fc', '#38bdf8', '#e0f2fe'], anim: 'shine', fallback: '#7dd3fc', glow: 'rgba(186,230,253,0.6)', icon: 'snow' },
  { id: 'title-imperial-crown', kind: 'title', name: 'Coroa Imperial', collection: 'imperial', rarity: 'lendária', requirement: NITRO,
    description: 'Ouro sobre púrpura, coroado.',
    colors: ['#facc15', '#c084fc', '#facc15'], anim: 'shine', fallback: '#d4a72c', icon: 'crown' },
  { id: 'title-sakura', kind: 'title', name: 'Sakura Anime', collection: 'anime', rarity: 'rara', requirement: NITRO,
    description: 'Rosa e branco com uma pétala que cai sobre o nome.',
    colors: ['#f9a8d4', '#fdf2f8', '#f472b6', '#f9a8d4'], anim: 'flow', fallback: '#f9a8d4', icon: 'petal' },
  { id: 'title-royal-princess', kind: 'title', name: 'Real Princess', collection: 'princess', rarity: 'rara', requirement: NITRO,
    description: 'Rosé perolado com faíscas nas pontas.',
    colors: ['#f472b6', '#fbcfe8', '#c4b5fd', '#f472b6'], anim: 'shine', fallback: '#f472b6', icon: 'sparkle' },
  { id: 'title-cyber-chrome', kind: 'title', name: 'Cromo Cyberpunk', collection: 'cyber', rarity: 'épica', requirement: NITRO,
    description: 'Cromo metálico com glitch RGB ocasional.',
    colors: ['#e2e8f0', '#64748b', '#f8fafc', '#94a3b8'], anim: 'glitch', fallback: '#94a3b8' },
  { id: 'title-cosmic-neon', kind: 'title', name: 'Néon Cósmico', collection: 'cosmico', rarity: 'épica', requirement: NITRO,
    description: 'Magenta e ciano respirando em néon.',
    colors: ['#e879f9', '#22d3ee', '#e879f9'], anim: 'pulse', fallback: '#e879f9', glow: 'rgba(232,121,249,0.7)' },
];

// ============================================================================
// TAGS ESPECIAIS (10)
// ============================================================================

const TAGS: TagItem[] = [
  { id: 'tag-nitro-founder', kind: 'tag', name: 'Fundador Nitro', label: 'Fundador Nitro', collection: 'cosmico', rarity: 'lendária',
    requirement: { type: 'event', label: 'Beta fechada' }, description: 'Para quem testou o Nitro antes do lançamento.',
    icon: 'zap', bg: 'linear-gradient(90deg,#6d28d9,#db2777,#f59e0b)', fg: '#ffffff', border: 'rgba(255,255,255,0.25)', shimmer: true },
  { id: 'tag-honorary-santa', kind: 'tag', name: 'Noel Honorário', label: 'Noel Honorário', collection: 'natal', rarity: 'rara', requirement: NITRO,
    description: 'Espírito natalino oficial.', icon: 'gift', bg: '#991b1b', fg: '#fef2f2', border: '#16a34a' },
  { id: 'tag-frost-guardian', kind: 'tag', name: 'Guardião do Gelo', label: 'Guardião do Gelo', collection: 'natal', rarity: 'comum', requirement: NITRO,
    description: 'Azul-gelo translúcido.', icon: 'snowflake', bg: 'rgba(125,211,252,0.15)', fg: '#7dd3fc', border: 'rgba(125,211,252,0.5)' },
  { id: 'tag-infernal-pact', kind: 'tag', name: 'Pacto Infernal', label: 'Pacto Infernal', collection: 'infernal', rarity: 'épica', requirement: NITRO,
    description: 'Selado em brasa.', icon: 'flame', bg: '#1c1917', fg: '#fb923c', border: '#9a3412', shimmer: true },
  { id: 'tag-royal-blood', kind: 'tag', name: 'Sangue Real', label: 'Sangue Real', collection: 'imperial', rarity: 'rara', requirement: NITRO,
    description: 'Linhagem imperial.', icon: 'crown', bg: '#3b0764', fg: '#fde68a', border: '#d4a72c' },
  { id: 'tag-star-born', kind: 'tag', name: 'Filho das Estrelas', label: 'Filho das Estrelas', collection: 'celestial', rarity: 'rara', requirement: NITRO,
    description: 'Nascido sob uma estrela cadente.', icon: 'star', bg: '#0c1445', fg: '#fef9c3', border: 'rgba(254,249,195,0.4)', shimmer: true },
  { id: 'tag-senpai', kind: 'tag', name: 'Senpai', label: 'Senpai 先輩', collection: 'anime', rarity: 'comum', requirement: NITRO,
    description: 'Finalmente notado.', icon: 'sparkles', bg: '#ffffff', fg: '#111827', border: '#111827' },
  { id: 'tag-highness', kind: 'tag', name: 'Alteza', label: 'Alteza', collection: 'princess', rarity: 'rara', requirement: NITRO,
    description: 'Tratamento de realeza.', icon: 'gem', bg: 'linear-gradient(90deg,#fbcfe8,#e9d5ff)', fg: '#831843', border: '#f9a8d4' },
  { id: 'tag-netrunner', kind: 'tag', name: 'Netrunner', label: 'NETRUNNER', collection: 'cyber', rarity: 'épica', requirement: NITRO,
    description: 'Conectado à rede.', icon: 'cpu', bg: '#020617', fg: '#22d3ee', border: '#22d3ee', mono: true },
  { id: 'tag-cosmic-voyager', kind: 'tag', name: 'Viajante Cósmico', label: 'Viajante Cósmico', collection: 'cosmico', rarity: 'rara', requirement: NITRO,
    description: 'Já esteve além da heliopausa.', icon: 'orbit', bg: 'linear-gradient(90deg,#4c1d95,#be185d)', fg: '#fdf4ff', border: 'rgba(244,114,182,0.5)' },
];

// ============================================================================
// MOLDURAS (10 Nitro + 6 de patente)
// ============================================================================

const FRAMES: FrameItem[] = [
  { id: 'frame-xmas-wreath', kind: 'frame', name: 'Guirlanda Natalina', collection: 'natal', rarity: 'épica', requirement: NITRO,
    description: 'Guirlanda de azevinho com neve caindo.',
    ring: { colors: ['#166534', '#15803d', '#dc2626', '#166534', '#22c55e', '#166534'], anim: 'none', width: 0.11 },
    ornament: 'wreath', particles: { glyph: '❄', mode: 'fall', count: 7, color: '#e0f2fe' } },
  { id: 'frame-royal-snowflake', kind: 'frame', name: 'Floco de Neve Real', collection: 'natal', rarity: 'rara', requirement: NITRO, fx: 'frost',
    description: 'Cristais de gelo girando devagar.',
    ring: { colors: ['#e0f2fe', '#7dd3fc', '#bae6fd', '#e0f2fe'], anim: 'spin', width: 0.06 }, glow: 'rgba(125,211,252,0.55)' },
  { id: 'frame-flame-crown', kind: 'frame', name: 'Coroa de Chamas', collection: 'infernal', rarity: 'lendária', requirement: NITRO, fx: 'fire',
    description: 'Chamas subindo pela borda.',
    ring: { colors: ['#fde047', '#f97316', '#dc2626', '#7f1d1d', '#f97316', '#fde047'], anim: 'flicker', width: 0.09 },
    glow: 'rgba(249,115,22,0.7)' },
  { id: 'frame-abyss-horns', kind: 'frame', name: 'Chifres do Abismo', collection: 'infernal', rarity: 'épica', requirement: NITRO, fx: 'magma',
    description: 'Chifres no topo e um brilho vermelho respirando.',
    ring: { colors: ['#450a0a', '#991b1b', '#dc2626', '#450a0a'], anim: 'pulse', width: 0.07 }, glow: 'rgba(220,38,38,0.65)',
    ornament: 'horns' },
  { id: 'frame-imperial-laurel', kind: 'frame', name: 'Laurel Imperial', collection: 'imperial', rarity: 'lendária', requirement: NITRO, fx: 'gold',
    description: 'Ramos de louro dourados com reflexo.',
    ring: { colors: ['#a16207', '#facc15', '#fef08a', '#ca8a04', '#a16207'], anim: 'shimmer', width: 0.06 },
    glow: 'rgba(250,204,21,0.45)' },
  { id: 'frame-aurora-halo', kind: 'frame', name: 'Halo Aurora', collection: 'celestial', rarity: 'épica', requirement: NITRO, fx: 'aurora',
    description: 'Aurora boreal girando em volta do avatar.',
    ring: { colors: ['#5eead4', '#38bdf8', '#a78bfa', '#f0abfc', '#5eead4'], anim: 'spin', width: 0.09 },
    glow: 'rgba(94,234,212,0.55)', ornament: 'halo' },
  { id: 'frame-sakura-petals', kind: 'frame', name: 'Pétalas de Sakura', collection: 'anime', rarity: 'rara', requirement: NITRO, fx: 'sakura',
    description: 'Pétalas orbitando e caindo.',
    ring: { colors: ['#fbcfe8', '#f9a8d4', '#fdf2f8', '#f472b6', '#fbcfe8'], anim: 'none', width: 0.07 },
  },
  { id: 'frame-crystal-tiara', kind: 'frame', name: 'Tiara de Cristal', collection: 'princess', rarity: 'épica', requirement: NITRO,
    description: 'Tiara de cristal com faíscas.',
    ring: { colors: ['#fbcfe8', '#e9d5ff', '#fdf2f8', '#c4b5fd', '#fbcfe8'], anim: 'shimmer', width: 0.06 },
    glow: 'rgba(244,114,182,0.45)', ornament: 'tiara', particles: { glyph: '✧', mode: 'twinkle', count: 6, color: '#fdf2f8' } },
  { id: 'frame-neon-circuit', kind: 'frame', name: 'Circuito Néon', collection: 'cyber', rarity: 'épica', requirement: NITRO, fx: 'neon',
    description: 'Trilhas de circuito com pulsos de luz.',
    ring: { colors: ['#22d3ee', '#0e7490', '#e11d48', '#22d3ee'], anim: 'spin', width: 0.05 }, glow: 'rgba(34,211,238,0.6)' },
  { id: 'frame-saturn-ring', kind: 'frame', name: 'Anel de Saturno', collection: 'cosmico', rarity: 'lendária', requirement: NITRO, fx: 'nebula',
    description: 'Anel planetário com uma lua em órbita.',
    ring: { colors: ['#6d28d9', '#db2777', '#f59e0b', '#6d28d9'], anim: 'spin', width: 0.05 }, glow: 'rgba(219,39,119,0.5)',
    ornament: 'saturn' },

  // ---- Novas: chapéu, natureza, animais, monstros, oceano ----
  { id: 'frame-santa-hat', kind: 'frame', name: 'Gorro do Noel', collection: 'natal', rarity: 'épica', requirement: NITRO, fx: 'frost',
    description: 'Gorro inclinado com pompom balançando e pisca-pisca.',
    ring: { colors: ['#dc2626', '#facc15', '#16a34a', '#38bdf8', '#dc2626', '#facc15', '#16a34a', '#38bdf8', '#dc2626'], anim: 'pulse', width: 0.06 },
    glow: 'rgba(250,204,21,0.35)', ornament: 'santa-hat' },
  { id: 'frame-living-forest', kind: 'frame', name: 'Floresta Viva', collection: 'selva', rarity: 'lendária', requirement: NITRO, fx: 'forest',
    description: 'Cipós crescem pelo anel, folhas balançam e vaga-lumes piscam.',
    ring: { colors: ['#14532d', '#15803d', '#65a30d', '#14532d'], anim: 'none', width: 0.06 },
    glow: 'rgba(132,204,22,0.35)' },
  { id: 'frame-jaguar', kind: 'frame', name: 'Onça-Pintada', collection: 'selva', rarity: 'lendária', requirement: NITRO,
    description: 'Orelhas atentas, cauda que balança e anel de rosetas.',
    ring: { colors: ['#b45309', '#1c1917', '#f59e0b', '#1c1917', '#d97706', '#1c1917', '#fbbf24', '#1c1917', '#b45309'], anim: 'none', width: 0.08 },
    glow: 'rgba(245,158,11,0.45)', ornament: 'jaguar' },
  { id: 'frame-spirit-fox', kind: 'frame', name: 'Raposa Espiritual', collection: 'anime', rarity: 'lendária', requirement: NITRO, fx: 'spirit',
    description: 'Três caudas de luz atrás do avatar e chamas-fantasma em órbita.',
    ring: { colors: ['#fb923c', '#fde68a', '#f472b6', '#fb923c'], anim: 'spin', width: 0.06 },
    glow: 'rgba(251,146,60,0.5)', back: 'fox-tails', ornament: 'fox' },
  { id: 'frame-lurking-eyes', kind: 'frame', name: 'Olhos na Escuridão', collection: 'sombras', rarity: 'lendária', requirement: NITRO, fx: 'shadow',
    description: 'Fumaça escura, olhos que piscam e um tentáculo que espia.',
    ring: { colors: ['#020617', '#1e293b', '#3f6212', '#020617'], anim: 'spin', width: 0.08 },
    glow: 'rgba(163,230,53,0.35)' },
  { id: 'frame-great-wave', kind: 'frame', name: 'Onda de Kanagawa', collection: 'oceano', rarity: 'lendária', requirement: NITRO, fx: 'ocean',
    description: 'Onda em xilogravura com garras de espuma quebrando no avatar.',
    ring: { colors: ['#1e3a5f', '#3b6e8f', '#9ec5d6', '#f7f3e8', '#1e3a5f'], anim: 'none', width: 0.07 },
    ornament: 'wave' },
  { id: 'frame-storm-cloud', kind: 'frame', name: 'Nuvem de Tempestade', collection: 'selva', rarity: 'épica', requirement: NITRO, fx: 'electric',
    description: 'Nuvem carregada, chuva caindo e relâmpagos.',
    ring: { colors: ['#334155', '#64748b', '#93c5fd', '#334155'], anim: 'pulse', width: 0.06 },
    glow: 'rgba(147,197,253,0.4)', ornament: 'storm' },

  // ---- Patentes (todos os níveis; animadas só 4 e 5) ----
  { id: 'frame-tier-0', kind: 'frame', name: 'Observador', collection: 'patentes', rarity: 'comum', requirement: { type: 'level', min: 0 },
    description: 'Anel ardósia da patente inicial.', ring: { colors: ['#64748b', '#475569', '#64748b'], anim: 'none', width: 0.05 }, alwaysStatic: true },
  { id: 'frame-tier-1', kind: 'frame', name: 'Recruta', collection: 'patentes', rarity: 'comum', requirement: { type: 'level', min: 1 },
    description: 'Cobre com faíscas.', ring: { colors: ['#b86b35', '#dc8b52', '#b86b35'], anim: 'none', width: 0.06 },
    glow: 'rgba(217,119,6,0.3)', alwaysStatic: true },
  { id: 'frame-tier-2', kind: 'frame', name: 'Escudeiro', collection: 'patentes', rarity: 'rara', requirement: { type: 'level', min: 2 },
    description: 'Metal com reflexo prismático.', ring: { colors: ['#475569', '#cbd5e1', '#0284c7', '#e2e8f0', '#475569'], anim: 'none', width: 0.06 },
    glow: 'rgba(125,211,252,0.3)', alwaysStatic: true },
  { id: 'frame-tier-3', kind: 'frame', name: 'Cavaleiro', collection: 'patentes', rarity: 'rara', requirement: { type: 'level', min: 3 },
    description: 'Ouro escovado com rebites.', ring: { colors: ['#b48219', '#eab308', '#fef08a', '#b48219'], anim: 'none', width: 0.07 },
    glow: 'rgba(234,179,8,0.35)', ornament: 'laurel', alwaysStatic: true },
  { id: 'frame-tier-4', kind: 'frame', name: 'Imperador', collection: 'patentes', rarity: 'épica', requirement: { type: 'level', min: 4 },
    description: 'Safira com grade técnica e pulso luminoso.', ring: { colors: ['#0c4a6e', '#0284c7', '#38bdf8', '#0284c7', '#0c4a6e'], anim: 'pulse', width: 0.07 },
    glow: 'rgba(56,189,248,0.55)', ornament: 'grid' },
  { id: 'frame-tier-5', kind: 'frame', name: 'Grão-Mestre', collection: 'patentes', rarity: 'lendária', requirement: { type: 'level', min: 5 },
    description: 'Espectro prismático completo em rotação.', ring: { colors: ['#4285F4', '#34A853', '#FBBC05', '#EA4335', '#4285F4'], anim: 'spin', width: 0.08 },
    glow: 'rgba(66,133,244,0.55)', ornament: 'crown', particles: { glyph: '✦', mode: 'orbit', count: 4, color: '#ffffff' } },
];

// ============================================================================
// ANIMAÇÕES DE ABERTURA (10 Nitro + 2 de patente)
// ============================================================================

const INTROS: IntroItem[] = [
  { id: 'intro-blizzard', kind: 'intro', name: 'Nevasca', collection: 'natal', rarity: 'rara', requirement: NITRO,
    description: 'Uma rajada de neve atravessa a tela.', durationMs: 1200,
    reveal: { kind: 'curtain', colors: ['rgba(224,242,254,0.95)', 'rgba(125,211,252,0.85)'] },
    particles: { glyph: '❄', mode: 'fall', count: 28, colors: ['#ffffff', '#e0f2fe', '#bae6fd'] } },
  { id: 'intro-gift-unwrap', kind: 'intro', name: 'Presente Aberto', collection: 'natal', rarity: 'épica', requirement: NITRO,
    description: 'A fita se desfaz e revela o perfil.', durationMs: 1100,
    reveal: { kind: 'split', colors: ['#b91c1c', '#15803d'] }, particles: { glyph: '✦', mode: 'burst', count: 18, colors: ['#facc15', '#ffffff'] } },
  { id: 'intro-hell-portal', kind: 'intro', name: 'Portal Infernal', collection: 'infernal', rarity: 'lendária', requirement: NITRO,
    description: 'Rachaduras incandescentes, erupção e um portal de fogo que se abre.', durationMs: 2000, scene: 'portal',
    reveal: { kind: 'iris', colors: ['#1c0a00', '#7f1d1d', '#f97316'] }, particles: { glyph: '🔥', mode: 'burst', count: 14 } },
  { id: 'intro-imperial-decree', kind: 'intro', name: 'Decreto Imperial', collection: 'imperial', rarity: 'épica', requirement: NITRO,
    description: 'O estandarte se recolhe deixando poeira dourada.', durationMs: 1200,
    reveal: { kind: 'curtain', colors: ['#3b0764', '#581c87'] }, particles: { glyph: '✦', mode: 'fall', count: 22, colors: ['#facc15', '#fde68a'] } },
  { id: 'intro-star-shower', kind: 'intro', name: 'Chuva de Estrelas', collection: 'celestial', rarity: 'rara', requirement: NITRO,
    description: 'Estrelas cadentes cruzam a capa.', durationMs: 1200,
    particles: { glyph: '★', mode: 'cross', count: 12, colors: ['#fef9c3', '#ffffff', '#a5f3fc'] } },
  { id: 'intro-eclipse', kind: 'intro', name: 'Eclipse', collection: 'celestial', rarity: 'épica', requirement: NITRO,
    description: 'A escuridão se fecha numa coroa de luz.', durationMs: 1200,
    reveal: { kind: 'circle', colors: ['#020617', '#0f172a'] }, fx: 'flash' },
  { id: 'intro-speedlines', kind: 'intro', name: 'Corte de Anime', collection: 'anime', rarity: 'épica', requirement: NITRO,
    description: 'Linhas de ação, quadro de impacto e carimbo 見参.', durationMs: 1700, scene: 'anime-cut', fx: 'speedlines' },
  { id: 'intro-fairy-tale', kind: 'intro', name: 'Conto de Fadas', collection: 'princess', rarity: 'épica', requirement: NITRO,
    description: 'Um rastro de brilho em espiral.', durationMs: 1200,
    reveal: { kind: 'iris', colors: ['#fdf2f8', '#fbcfe8', '#e9d5ff'] }, particles: { glyph: '✧', mode: 'burst', count: 22, colors: ['#f472b6', '#c084fc', '#fde68a'] } },
  { id: 'intro-glitch-boot', kind: 'intro', name: 'Boot Glitch', collection: 'cyber', rarity: 'épica', requirement: NITRO,
    description: 'A tela inicializa com scanlines e glitch RGB.', durationMs: 1000,
    reveal: { kind: 'curtain', colors: ['#020617', '#0e7490'] }, fx: 'glitch' },
  { id: 'intro-hyperspace', kind: 'intro', name: 'Salto Hiperespacial', collection: 'cosmico', rarity: 'lendária', requirement: NITRO,
    description: 'Estrelas esticam em linhas, túnel de luz e chegada.', durationMs: 1900, scene: 'hyperspace',
    reveal: { kind: 'iris', colors: ['#000000', '#1e1b4b'] }, particles: { glyph: '', mode: 'streak', count: 40, colors: ['#ffffff', '#c4b5fd', '#93c5fd'] } },

  // ---- Novas cenas ----
  { id: 'intro-lurking-monster', kind: 'intro', name: 'Monstro à Espreita', collection: 'sombras', rarity: 'lendária', requirement: NITRO,
    description: 'Olhos no escuro, a criatura se aproxima e dá o bote.', durationMs: 2300, scene: 'monster' },
  { id: 'intro-jaguar-claw', kind: 'intro', name: 'Garra de Onça', collection: 'selva', rarity: 'lendária', requirement: NITRO,
    description: 'Olhos âmbar, três arranhões e a tela rasgada.', durationMs: 1900, scene: 'jaguar' },
  { id: 'intro-storm', kind: 'intro', name: 'Tempestade', collection: 'selva', rarity: 'épica', requirement: NITRO,
    description: 'Chuva pesada, relâmpagos e a tempestade se abre.', durationMs: 2200, scene: 'storm' },
  { id: 'intro-ukiyo-tsunami', kind: 'intro', name: 'Tsunami Ukiyo-e', collection: 'oceano', rarity: 'lendária', requirement: NITRO,
    description: 'Onda gigante em xilogravura japonesa varre a tela.', durationMs: 2400, scene: 'tsunami' },

  // ---- Patentes 4 e 5 ----
  { id: 'intro-tier-4', kind: 'intro', name: 'Ascensão Safira', collection: 'patentes', rarity: 'épica', requirement: { type: 'level', min: 4 },
    description: 'Grade técnica azul converge no selo Safira.', durationMs: 1200,
    reveal: { kind: 'iris', colors: ['#020617', '#0c4a6e', '#0284c7'] }, fx: 'glitch',
    particles: { glyph: '◆', mode: 'burst', count: 16, colors: ['#38bdf8', '#e0f2fe'] } },
  { id: 'intro-tier-5', kind: 'intro', name: 'Singularidade Prismática', collection: 'patentes', rarity: 'lendária', requirement: { type: 'level', min: 5 },
    description: 'Um ponto de luz explode no espectro do Grão-Mestre.', durationMs: 1200,
    reveal: { kind: 'circle', colors: ['#000000', '#111827'] }, fx: 'flash',
    particles: { glyph: '✦', mode: 'burst', count: 26, colors: ['#4285F4', '#34A853', '#FBBC05', '#EA4335'] } },
];

// ============================================================================
// ÍNDICES E HELPERS
// ============================================================================

export const NITRO_ITEMS: NitroItem[] = [...TITLES, ...TAGS, ...FRAMES, ...INTROS];

const BY_ID = new Map<string, NitroItem>(NITRO_ITEMS.map((i) => [i.id, i]));

export function getNitroItem<K extends NitroKind>(
  id: string | null | undefined,
  kind: K
): Extract<NitroItem, { kind: K }> | null {
  if (!id) return null;
  const item = BY_ID.get(id);
  return item && item.kind === kind ? (item as Extract<NitroItem, { kind: K }>) : null;
}

export function getCollection(id: NitroCollectionId): NitroCollection {
  return NITRO_COLLECTIONS.find((c) => c.id === id) || NITRO_COLLECTIONS[0];
}

export function describeRequirement(req: NitroRequirement): string {
  if (req.type === 'nitro') return 'Insight Nitro';
  if (req.type === 'level') return `Nível ${req.min}`;
  return req.label;
}

export const KIND_LABELS: Record<NitroKind, { singular: string; plural: string }> = {
  frame: { singular: 'Moldura', plural: 'Molduras' },
  title: { singular: 'Título', plural: 'Títulos' },
  tag: { singular: 'Tag', plural: 'Tags' },
  intro: { singular: 'Abertura', plural: 'Aberturas' },
};

/** Snapshot salvo em profiles.cosmetics. */
export interface NitroCosmetics {
  v?: 1;
  title?: string | null;
  tag?: string | null;
  frame?: string | null;
  intro?: string | null;
  frameEnabled?: boolean;
  frameAnimated?: boolean;
  introEnabled?: boolean;
  levelAnimation?: boolean;
  /** Rainbow na logo e nos asteriscos de carregamento (benefício Nitro). */
  rainbow?: boolean;
  updatedAt?: string;
}
