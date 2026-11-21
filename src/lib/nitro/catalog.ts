import type { CritterId } from '@/components/nitro/critters';

/**
 * Catálogo do Insight Nitro (beta fechada).
 * Fonte única dos itens: os efeitos são descritos por dados e renderizados por
 * um único motor CSS (src/components/nitro/nitro.css).
 * Especificação completa: docs/insight-nitro.md
 */

export type NitroKind = 'title' | 'tag' | 'frame' | 'intro' | 'font' | 'theme';

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
  | 'bichos'
  | 'memes'
  | 'kpop'
  | 'telas'
  | 'musica'
  | 'temas'
  | 'tipografia'
  | 'games'
  | 'animes'
  | 'datas'
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
  | 'magma' | 'frost' | 'gold' | 'neon' | 'sakura' | 'forest'
  | 'aura' | 'fireworks' | 'sapphire' | 'singularity';

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
  /** Ilustração de bichinho (components/nitro/critters.ts), camadas atrás e na frente da foto. */
  critter?: CritterId;
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
  /** Subcategoria exibida no card (ex.: "Memes BR"). */
  category?: string;
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
  | 'hyperspace'
  | 'blizzard'
  | 'gift'
  | 'decree'
  | 'star-shower'
  | 'eclipse'
  | 'fairy'
  | 'glitch-boot';

/** Estilo de exibição do nome (fonte + efeito). Combina com o Título. */
export interface FontItem extends BaseItem {
  kind: 'font';
  /** id curto: vira as classes nf-<font> e nfx-<effect> (nitro.css). */
  font: string;
  effect?: 'block' | 'neon' | 'outline' | 'chrome' | 'drip' | 'street' | 'glow';
}

/** Tema de aplicativo: muda as cores do Insight só para quem usa. */
export interface ThemeItem extends BaseItem {
  kind: 'theme';
  mode: 'dark' | 'light';
  /** 3 cores para a miniatura do card. */
  swatch: [string, string, string];
}

export type NitroItem = FrameItem | TitleItem | TagItem | IntroItem | FontItem | ThemeItem;

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
  { id: 'bichos', name: 'Bichinhos', description: 'Orelhas, patinhas e amigos ilustrados em volta da foto.', colors: ['#f9b8c6', '#f6a04d'] },
  { id: 'patentes', name: 'Patentes', description: 'Conquistadas pelos níveis de contribuinte.', colors: ['#4285F4', '#d4a72c'] },
  { id: 'memes', name: 'Memes BR & Internet', description: 'Clássicos da internet brasileira e mundial.', colors: ['#2563eb', '#facc15'] },
  { id: 'kpop', name: 'K-Pop & Cultura Pop', description: 'Lightsticks, comebacks e finais de MV.', colors: ['#c084fc', '#f472b6'] },
  { id: 'telas', name: 'Filmes, Séries & Sci-Fi', description: 'Multiversos, cometas e aventuras.', colors: ['#fb923c', '#6366f1'] },
  { id: 'musica', name: 'Música', description: 'Rock, pop, indie e clássicos.', colors: ['#ea580c', '#34d399'] },
  { id: 'temas', name: 'Temas de App', description: 'Seu Insight com outras cores — só você vê.', colors: ['#f472b6', '#38bdf8'] },
  { id: 'tipografia', name: 'Estilos de Nome', description: 'Fontes e efeitos para o seu nome.', colors: ['#facc15', '#22c55e'] },
  { id: 'games', name: 'Games, RPG & Geek', description: 'Barra de vida, crítico e chefão final.', colors: ['#ef4444', '#22c55e'] },
  { id: 'animes', name: 'Animes Clássicos', description: 'Auras, ninjas e garotas mágicas.', colors: ['#facc15', '#f472b6'] },
  { id: 'datas', name: 'Datas Comemorativas', description: 'Réveillon, Carnaval, Arraiá, Halloween e Namorados.', colors: ['#f97316', '#a855f7'] },
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
  // ---- tags ilustradas (arte em components/nitro/tagArt.tsx)
  { id: 'tag-tranquilao', kind: 'tag', name: 'Tô Tranquilão', label: 'Tô Tranquilão', collection: 'memes', category: 'Memes BR', rarity: 'comum', requirement: NITRO,
    description: 'Paz absoluta mesmo com tudo pegando fogo', icon: 'sparkles', bg: 'linear-gradient(110deg,#065f46,#0f766e,#b45309)', fg: '#ecfdf5', border: '#34d399' },
  { id: 'tag-nem-te-conto', kind: 'tag', name: 'Nem te Conto', label: 'Nem te Conto', collection: 'memes', category: 'Memes BR', rarity: 'rara', requirement: NITRO,
    description: 'A fofoca já veio com trilha sonora', icon: 'sparkles', bg: 'linear-gradient(110deg,#831843,#be185d,#7e22ce)', fg: '#fdf2f8', border: '#f472b6' },
  { id: 'tag-calabreso', kind: 'tag', name: 'Calma, Calabreso', label: 'Calma, Calabreso', collection: 'memes', category: 'Memes BR', rarity: 'rara', requirement: NITRO,
    description: 'Respirando fundo antes de responder', icon: 'sparkles', bg: 'linear-gradient(110deg,#7f1d1d,#b91c1c,#0369a1)', fg: '#fff1f2', border: '#fca5a5' },
  { id: 'tag-sextou', kind: 'tag', name: 'Sextou de Verdade', label: 'Sextou de Verdade', collection: 'memes', category: 'Memes BR', rarity: 'comum', requirement: NITRO,
    description: 'Encerrando o expediente mental', icon: 'sparkles', bg: 'linear-gradient(110deg,#4c1d95,#be185d,#ea580c)', fg: '#fff7ed', border: '#f9a8d4' },
  { id: 'tag-bigode', kind: 'tag', name: 'Bigode Grosso', label: 'Bigode Grosso', collection: 'memes', category: 'Internet', rarity: 'épica', requirement: NITRO,
    description: 'Respeito máximo na resenha', icon: 'sparkles', bg: 'linear-gradient(110deg,#1c1917,#44403c,#a16207)', fg: '#fde68a', border: '#ca8a04' },
  { id: 'tag-ping', kind: 'tag', name: 'Ping 999ms', label: 'Ping 999ms', collection: 'memes', category: 'Internet', rarity: 'rara', requirement: NITRO,
    description: 'Pensando em português, digitando no futuro', icon: 'sparkles', bg: 'linear-gradient(110deg,#0f172a,#1e293b,#7f1d1d)', fg: '#fecaca', border: '#f87171' },
  { id: 'tag-hp-baixo', kind: 'tag', name: 'HP Baixo', label: 'HP Baixo', collection: 'games', category: 'Games', rarity: 'comum', requirement: NITRO,
    description: 'Vivendo no limite da barra de vida', icon: 'sparkles', bg: 'linear-gradient(110deg,#1f2937,#450a0a,#1f2937)', fg: '#fecaca', border: '#ef4444' },
  { id: 'tag-critical', kind: 'tag', name: 'Critical Hit', label: 'Critical Hit', collection: 'games', category: 'Games', rarity: 'rara', requirement: NITRO,
    description: 'Acertou em cheio no argumento', icon: 'sparkles', bg: 'linear-gradient(110deg,#7c2d12,#c2410c,#a16207)', fg: '#fef9c3', border: '#facc15' },
  { id: 'tag-speedrunner', kind: 'tag', name: 'Speedrunner', label: 'Speedrunner', collection: 'games', category: 'Games', rarity: 'épica', requirement: NITRO,
    description: 'Pulando diálogo e indo direto ao ponto', icon: 'sparkles', bg: 'linear-gradient(110deg,#0c4a6e,#0369a1,#4338ca)', fg: '#e0f2fe', border: '#38bdf8' },
  { id: 'tag-boss-final', kind: 'tag', name: 'Boss Final', label: 'Boss Final', collection: 'games', category: 'Games', rarity: 'lendária', requirement: NITRO,
    description: 'Só aparece quando o assunto fica sério', icon: 'sparkles', bg: 'linear-gradient(110deg,#0a0a0a,#450a0a,#1c1917)', fg: '#fecaca', border: '#dc2626' },
  { id: 'tag-respawn', kind: 'tag', name: 'Respawnando', label: 'Respawnando', collection: 'games', category: 'Games', rarity: 'comum', requirement: NITRO,
    description: 'Voltei mais forte depois da queda', icon: 'sparkles', bg: 'linear-gradient(110deg,#052e16,#14532d,#065f46)', fg: '#dcfce7', border: '#4ade80' },
  { id: 'tag-main-vocal', kind: 'tag', name: 'Main Vocal', label: 'Main Vocal', collection: 'kpop', category: 'K-Pop', rarity: 'rara', requirement: NITRO,
    description: 'Entregando o refrão com emoção máxima', icon: 'sparkles', bg: 'linear-gradient(110deg,#3b0764,#6b21a8,#be185d)', fg: '#fae8ff', border: '#d8b4fe' },
  { id: 'tag-stan', kind: 'tag', name: 'Stan Account', label: 'Stan Account', collection: 'kpop', category: 'K-Pop', rarity: 'comum', requirement: NITRO,
    description: 'Defendendo a fave com unhas e dentes', icon: 'sparkles', bg: 'linear-gradient(110deg,#4c1d95,#7c3aed,#db2777)', fg: '#f5f3ff', border: '#c084fc' },
  { id: 'tag-pos-creditos', kind: 'tag', name: 'Cena Pós-Créditos', label: 'Cena Pós-Créditos', collection: 'telas', category: 'Cinema', rarity: 'rara', requirement: NITRO,
    description: 'O melhor ficou pro final', icon: 'sparkles', bg: 'linear-gradient(110deg,#09090b,#27272a,#3f3f46)', fg: '#fafafa', border: '#facc15' },
  { id: 'tag-trilha', kind: 'tag', name: 'Trilha Sonora', label: 'Trilha Sonora', collection: 'musica', category: 'Música', rarity: 'comum', requirement: NITRO,
    description: 'Cada momento pede uma música diferente', icon: 'sparkles', bg: 'linear-gradient(110deg,#022c22,#065f46,#155e75)', fg: '#d1fae5', border: '#34d399' },
  { id: 'tag-encore', kind: 'tag', name: 'Encore', label: 'Encore', collection: 'musica', category: 'Música', rarity: 'épica', requirement: NITRO,
    description: 'Ninguém vai embora sem mais uma', icon: 'sparkles', bg: 'linear-gradient(110deg,#1c1917,#78350f,#9a3412)', fg: '#fef3c7', border: '#fbbf24' },
  { id: 'tag-caneta-azul', kind: 'tag', name: 'Caneta Azul', label: 'Caneta Azul', collection: 'memes', category: 'Memes BR', rarity: 'rara', requirement: NITRO,
    description: 'Tá marcado com a minha caneta', icon: 'sparkles', bg: '#dbeafe', fg: '#1e3a8a', border: '#3b82f6' },
  { id: 'tag-bora-bill', kind: 'tag', name: 'Bora Bill', label: 'Bora Bill', collection: 'memes', category: 'Memes BR', rarity: 'comum', requirement: NITRO,
    description: 'Não pode faltar o encerramento', icon: 'sparkles', bg: '#450a0a', fg: '#fef3c7', border: '#facc15' },
  { id: 'tag-receba', kind: 'tag', name: 'Receba!', label: 'Receba!', collection: 'memes', category: 'Memes BR', rarity: 'rara', requirement: NITRO,
    description: 'Apenas o melhor do mundo', icon: 'sparkles', bg: 'linear-gradient(90deg,#facc15,#f59e0b)', fg: '#422006', border: '#a16207' },
  { id: 'tag-ai-dentu', kind: 'tag', name: 'Aí Dentu', label: 'Aí Dentu', collection: 'memes', category: 'Memes BR', rarity: 'comum', requirement: NITRO,
    description: 'Quando o plot twist vem forte', icon: 'sparkles', bg: '#7dd3fc', fg: '#082f49', border: '#0369a1' },
  { id: 'tag-pave-pacume', kind: 'tag', name: 'É Pavê ou Pacumê?', label: 'É Pavê ou Pacumê?', collection: 'memes', category: 'Memes BR', rarity: 'comum', requirement: NITRO,
    description: 'Piada clássica de respeito', icon: 'sparkles', bg: '#fef3c7', fg: '#78350f', border: '#d97706' },
  { id: 'tag-complicado', kind: 'tag', name: 'Complicado Isso Aí', label: 'Complicado Isso Aí', collection: 'memes', category: 'Internet', rarity: 'rara', requirement: NITRO,
    description: 'Situação crítica no servidor', icon: 'sparkles', bg: '#111827', fg: '#fecaca', border: '#ef4444' },
  { id: 'tag-this-is-fine', kind: 'tag', name: 'This Is Fine', label: 'This Is Fine', collection: 'memes', category: 'Internet', rarity: 'épica', requirement: NITRO,
    description: 'Tudo sob controle (não está)', icon: 'sparkles', bg: 'linear-gradient(90deg,#c2410c,#9a3412)', fg: '#fef3c7', border: '#fb923c' },
  { id: 'tag-404', kind: 'tag', name: '404 Noção Not Found', label: '404 Noção Not Found', collection: 'memes', category: 'Internet', rarity: 'rara', requirement: NITRO,
    description: 'Procurei mas não achei', icon: 'sparkles', bg: '#0f172a', fg: '#a5f3fc', border: '#22d3ee' },
  { id: 'tag-plot-twist', kind: 'tag', name: 'Plot Twist', label: 'Plot Twist', collection: 'memes', category: 'Internet', rarity: 'comum', requirement: NITRO,
    description: 'Ninguém viu chegando', icon: 'sparkles', bg: 'linear-gradient(90deg,#6d28d9,#a21caf)', fg: '#fdf4ff', border: '#c084fc' },
  { id: 'tag-bias-wrecked', kind: 'tag', name: 'Bias Wrecked', label: 'Bias Wrecked', collection: 'kpop', category: 'K-Pop', rarity: 'rara', requirement: NITRO,
    description: 'Mudou de ideia no meio do MV', icon: 'sparkles', bg: '#fce7f3', fg: '#9d174d', border: '#f472b6' },
  { id: 'tag-ending-fairy', kind: 'tag', name: 'Ending Fairy', label: 'Ending Fairy', collection: 'kpop', category: 'K-Pop', rarity: 'épica', requirement: NITRO,
    description: 'Foco total nos últimos segundos', icon: 'sparkles', bg: 'linear-gradient(90deg,#312e81,#6b21a8)', fg: '#fdf4ff', border: '#f0abfc' },
  { id: 'tag-lightstick', kind: 'tag', name: 'Lightstick Acesa', label: 'Lightstick Acesa', collection: 'kpop', category: 'K-Pop', rarity: 'comum', requirement: NITRO,
    description: 'Pronto pro show / comeback', icon: 'sparkles', bg: '#2e1065', fg: '#f5d0fe', border: '#a855f7' },
  { id: 'tag-all-kill', kind: 'tag', name: 'All-Kill', label: 'All-Kill', collection: 'kpop', category: 'K-Pop', rarity: 'lendária', requirement: NITRO,
    description: 'Dominando tudo de ponta a ponta', icon: 'sparkles', bg: 'linear-gradient(90deg,#0a0a0a,#292524)', fg: '#fde68a', border: '#facc15' },
  { id: 'tag-full-combo', kind: 'tag', name: 'Full Combo', label: 'Full Combo', collection: 'kpop', category: 'Cultura Pop', rarity: 'épica', requirement: NITRO,
    description: 'Sem errar uma nota sequer', icon: 'sparkles', bg: '#0c4a6e', fg: '#e0f2fe', border: '#38bdf8' },
  { id: 'tag-inevitavel', kind: 'tag', name: 'Eu Sou Inevitável', label: 'Eu Sou Inevitável', collection: 'telas', category: 'Filmes', rarity: 'épica', requirement: NITRO,
    description: 'Já era esperado', icon: 'sparkles', bg: 'linear-gradient(90deg,#3b0764,#581c87)', fg: '#fde68a', border: '#ca8a04' },
  { id: 'tag-multiverso', kind: 'tag', name: 'Multiverso da Loucura', label: 'Multiverso da Loucura', collection: 'telas', category: 'Filmes', rarity: 'rara', requirement: NITRO,
    description: 'Cada aba é uma realidade', icon: 'sparkles', bg: '#1e1b4b', fg: '#fdba74', border: '#fb923c' },
  { id: 'tag-nao-olhe', kind: 'tag', name: 'Não Olhe Para Cima', label: 'Não Olhe Para Cima', collection: 'telas', category: 'Filmes', rarity: 'comum', requirement: NITRO,
    description: 'Ignorando o aviso óbvio', icon: 'sparkles', bg: '#020617', fg: '#e2e8f0', border: '#475569' },
  { id: 'tag-hora-aventura', kind: 'tag', name: 'Hora da Aventura', label: 'Hora da Aventura', collection: 'telas', category: 'Animação', rarity: 'rara', requirement: NITRO,
    description: 'Bora resolver na marra', icon: 'sparkles', bg: '#7dd3fc', fg: '#052e16', border: '#16a34a' },
  { id: 'tag-modo-furtivo', kind: 'tag', name: 'Modo Furtivo', label: 'Modo Furtivo', collection: 'telas', category: 'Sci-Fi', rarity: 'comum', requirement: NITRO,
    description: 'Passando sem deixar rastro', icon: 'sparkles', bg: '#18181b', fg: '#d4d4d8', border: '#52525b' },
  { id: 'tag-stairway', kind: 'tag', name: 'Stairway to Heaven', label: 'Stairway to Heaven', collection: 'musica', category: 'Música', rarity: 'lendária', requirement: NITRO,
    description: 'Subindo degrau por degrau', icon: 'sparkles', bg: 'linear-gradient(90deg,#bae6fd,#fef3c7)', fg: '#1e3a8a', border: '#facc15' },
  { id: 'tag-bohemian', kind: 'tag', name: 'Bohemian Rhapsody', label: 'Bohemian Rhapsody', collection: 'musica', category: 'Música', rarity: 'épica', requirement: NITRO,
    description: 'Mistura de tudo num só lugar', icon: 'sparkles', bg: '#111111', fg: '#ffffff', border: '#a855f7' },
  { id: 'tag-solo-guitarra', kind: 'tag', name: 'Solo de Guitarra', label: 'Solo de Guitarra', collection: 'musica', category: 'Música', rarity: 'rara', requirement: NITRO,
    description: 'Momento de brilhar sem pressa', icon: 'sparkles', bg: '#7c2d12', fg: '#fed7aa', border: '#ea580c' },
  { id: 'tag-replay', kind: 'tag', name: 'Replay Infinito', label: 'Replay Infinito', collection: 'musica', category: 'Música', rarity: 'comum', requirement: NITRO,
    description: 'Não cansa de ouvir', icon: 'sparkles', bg: '#064e3b', fg: '#d1fae5', border: '#34d399' },
  { id: 'tag-backstage', kind: 'tag', name: 'Backstage Pass', label: 'Backstage Pass', collection: 'musica', category: 'Música', rarity: 'épica', requirement: NITRO,
    description: 'Acesso de bastidores', icon: 'sparkles', bg: '#18181b', fg: '#fef08a', border: '#facc15' },
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
  { id: 'frame-lurking-eyes', kind: 'frame', name: 'Olhos na Escuridão', collection: 'sombras', rarity: 'lendária', requirement: NITRO, fx: 'shadow',
    description: 'Fumaça escura, olhos que piscam e um tentáculo que espia.',
    ring: { colors: ['#020617', '#1e293b', '#3f6212', '#020617'], anim: 'spin', width: 0.08 },
    glow: 'rgba(163,230,53,0.35)' },
  { id: 'frame-great-wave', kind: 'frame', name: 'Onda de Kanagawa', collection: 'oceano', rarity: 'lendária', requirement: NITRO, fx: 'ocean',
    description: 'Onda em xilogravura com garras de espuma quebrando no avatar.',
    ring: { colors: ['#1e3a5f', '#3b6e8f', '#9ec5d6', '#f7f3e8', '#1e3a5f'], anim: 'none', width: 0.07 },
    ornament: 'wave' },
  { id: 'frame-storm-cloud', kind: 'frame', name: 'Nuvem de Tempestade', collection: 'selva', rarity: 'épica', requirement: NITRO, critter: 'storm-cloud',
    description: 'Nuvens fofinhas no topo, um raio que pisca e gotinhas caindo.',
    ring: { colors: ['#334155', '#64748b', '#93c5fd', '#334155'], anim: 'none', width: 0.06 } },

  // ---- Bichinhos ilustrados ----
  // ---- pacote 2: animes clássicos, datas comemorativas e bichos queridos
  { id: 'frame-aura-lendaria', kind: 'frame', name: 'Aura Lendária', collection: 'animes', rarity: 'lendária', requirement: NITRO, fx: 'aura',
    description: 'Energia dourada em espigões, faíscas e raios — o poder sobe a cada episódio.', ring: { colors: ['#facc15'], anim: 'none' } },
  { id: 'frame-pergaminho-ninja', kind: 'frame', name: 'Pergaminho Ninja', collection: 'animes', rarity: 'épica', requirement: NITRO, critter: 'ninja',
    description: 'Faixa com placa, kunais cruzadas, shuriken girando e fumaça.', ring: { colors: ['#334155'], anim: 'none' } },
  { id: 'frame-garota-magica', kind: 'frame', name: 'Garota Mágica', collection: 'animes', rarity: 'épica', requirement: NITRO, critter: 'magical-girl',
    description: 'Broche de coração alado, fitas e a varinha de estrela da transformação.', ring: { colors: ['#f472b6'], anim: 'none' } },
  { id: 'frame-reveillon', kind: 'frame', name: 'Fogos de Réveillon', collection: 'datas', rarity: 'lendária', requirement: NITRO, fx: 'fireworks',
    description: 'Rojões subindo e estourando em cores ao redor da foto.', ring: { colors: ['#fde68a'], anim: 'none' } },
  { id: 'frame-carnaval', kind: 'frame', name: 'Carnaval', collection: 'datas', rarity: 'épica', requirement: NITRO, critter: 'carnaval',
    description: 'Máscara de plumas, serpentinas e chuva de confete.', ring: { colors: ['#7c3aed'], anim: 'none' } },
  { id: 'frame-arraia', kind: 'frame', name: 'Arraiá', collection: 'datas', rarity: 'rara', requirement: NITRO, critter: 'junina',
    description: 'Bandeirinhas, chapéu de palha, fogueirinha e milho.', ring: { colors: ['#ca8a04'], anim: 'none' } },
  { id: 'frame-halloween', kind: 'frame', name: 'Noite das Bruxas', collection: 'datas', rarity: 'épica', requirement: NITRO, critter: 'halloween',
    description: 'Abóbora iluminada, morcegos, teia e uma aranha curiosa.', ring: { colors: ['#f97316'], anim: 'none' } },
  { id: 'frame-cupido', kind: 'frame', name: 'Cupido', collection: 'datas', rarity: 'rara', requirement: NITRO, critter: 'cupido',
    description: 'Asas, coração flechado batendo e corações subindo.', ring: { colors: ['#fb7185'], anim: 'none' } },
  { id: 'frame-capivara', kind: 'frame', name: 'Capivara Zen', collection: 'bichos', rarity: 'lendária', requirement: NITRO, critter: 'capivara',
    description: 'Deitada no topo, laranja na cabeça e um passarinho de companhia.', ring: { colors: ['#a16207'], anim: 'none' } },
  { id: 'frame-panda', kind: 'frame', name: 'Panda do Bambu', collection: 'bichos', rarity: 'épica', requirement: NITRO, critter: 'panda',
    description: 'Espiando por baixo, mastigando bambu entre folhas que balançam.', ring: { colors: ['#4d7c0f'], anim: 'none' } },
  { id: 'frame-cat-ribbon', kind: 'frame', name: 'Gatinho de Fita', collection: 'bichos', rarity: 'épica', requirement: NITRO, critter: 'cat-ribbon',
    description: 'Orelhas de gato tricolor, laço de cetim, patinhas e plaquinha de coração.',
    ring: { colors: ['#f9b8c6'], anim: 'none' } },
  { id: 'frame-bunny-daisy', kind: 'frame', name: 'Coelhinho Algodão', collection: 'bichos', rarity: 'épica', requirement: NITRO, critter: 'bunny-daisy',
    description: 'Orelhas caídas atrás da foto e coroa de margaridas.',
    ring: { colors: ['#ffd7e1'], anim: 'none' } },
  { id: 'frame-fox-shrine', kind: 'frame', name: 'Raposa do Santuário', collection: 'bichos', rarity: 'lendária', requirement: NITRO, critter: 'fox-shrine',
    description: 'Orelhas de raposa com corda trançada, papéis shide e sininhos.',
    ring: { colors: ['#f7a15a'], anim: 'none' } },
  { id: 'frame-shiba-nap', kind: 'frame', name: 'Soneca do Shiba', collection: 'bichos', rarity: 'lendária', requirement: NITRO, critter: 'shiba-nap',
    description: 'Um shiba dormindo em cima da foto, respirando devagar.',
    ring: { colors: ['#f3a352'], anim: 'none' } },
  { id: 'frame-ghost-hug', kind: 'frame', name: 'Abraço Fantasma', collection: 'bichos', rarity: 'épica', requirement: NITRO, critter: 'ghost-hug',
    description: 'Um fantasminha espiando e segurando a sua foto.',
    ring: { colors: ['#d9cbf5'], anim: 'none' } },
  { id: 'frame-bear-honey', kind: 'frame', name: 'Ursinho do Mel', collection: 'bichos', rarity: 'rara', requirement: NITRO, critter: 'bear-honey',
    description: 'Orelhas redondas, patinhas com pote de mel e uma abelha.',
    ring: { colors: ['#b07a4c'], anim: 'none' } },
  { id: 'frame-frog-king', kind: 'frame', name: 'Sapo Rei', collection: 'bichos', rarity: 'rara', requirement: NITRO, critter: 'frog-king',
    description: 'Um sapinho de coroa no topo, inflando o papo.',
    ring: { colors: ['#9be15d'], anim: 'none' } },

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
    description: 'Safira lapidada: facetas que refletem um brilho girando e pulso luminoso.', ring: { colors: ['#0c4a6e', '#0284c7', '#38bdf8', '#0284c7', '#0c4a6e'], anim: 'pulse', width: 0.07 },
    glow: 'rgba(56,189,248,0.55)', fx: 'sapphire' },
  { id: 'frame-tier-5', kind: 'frame', name: 'Grão-Mestre', collection: 'patentes', rarity: 'lendária', requirement: { type: 'level', min: 5 },
    description: 'Disco de acreção em espectro, lente gravitacional e estrelas sendo puxadas.', ring: { colors: ['#4285F4', '#34A853', '#FBBC05', '#EA4335', '#4285F4'], anim: 'spin', width: 0.08 },
    glow: 'rgba(66,133,244,0.55)', fx: 'singularity' },
];

// ============================================================================
// ANIMAÇÕES DE ABERTURA (10 Nitro + 2 de patente)
// ============================================================================

const INTROS: IntroItem[] = [
  { id: 'intro-blizzard', kind: 'intro', name: 'Nevasca', collection: 'natal', rarity: 'rara', requirement: NITRO,
    description: 'Rajadas de neve em três planos e um cristal de gelo que cresce e se estilhaça.', durationMs: 2200, scene: 'blizzard',
    reveal: { kind: 'curtain', colors: ['rgba(224,242,254,0.95)', 'rgba(125,211,252,0.85)'] },
    particles: { glyph: '❄', mode: 'fall', count: 28, colors: ['#ffffff', '#e0f2fe', '#bae6fd'] } },
  { id: 'intro-gift-unwrap', kind: 'intro', name: 'Presente Aberto', collection: 'natal', rarity: 'épica', requirement: NITRO,
    description: 'O presente cai, treme, a tampa voa e explode em confete.', durationMs: 2100, scene: 'gift',
    reveal: { kind: 'split', colors: ['#b91c1c', '#15803d'] }, particles: { glyph: '✦', mode: 'burst', count: 18, colors: ['#facc15', '#ffffff'] } },
  { id: 'intro-hell-portal', kind: 'intro', name: 'Portal Infernal', collection: 'infernal', rarity: 'lendária', requirement: NITRO,
    description: 'Brasas em espiral, núcleo incandescente e um anel de fogo que se abre.', durationMs: 2000, scene: 'portal',
    reveal: { kind: 'iris', colors: ['#1c0a00', '#7f1d1d', '#f97316'] }, particles: { glyph: '🔥', mode: 'burst', count: 14 } },
  { id: 'intro-imperial-decree', kind: 'intro', name: 'Decreto Imperial', collection: 'imperial', rarity: 'épica', requirement: NITRO,
    description: 'A coroa desce, o pergaminho se desenrola e o selo real bate.', durationMs: 2300, scene: 'decree',
    reveal: { kind: 'curtain', colors: ['#3b0764', '#581c87'] }, particles: { glyph: '✦', mode: 'fall', count: 22, colors: ['#facc15', '#fde68a'] } },
  { id: 'intro-star-shower', kind: 'intro', name: 'Chuva de Estrelas', collection: 'celestial', rarity: 'rara', requirement: NITRO,
    description: 'Cometas riscam o céu e uma estrela cadente floresce em luz.', durationMs: 2100, scene: 'star-shower',
    particles: { glyph: '★', mode: 'cross', count: 12, colors: ['#fef9c3', '#ffffff', '#a5f3fc'] } },
  { id: 'intro-eclipse', kind: 'intro', name: 'Eclipse', collection: 'celestial', rarity: 'épica', requirement: NITRO,
    description: 'A lua cobre o sol, a coroa acende e o anel de diamante revela o perfil.', durationMs: 2300, scene: 'eclipse',
    reveal: { kind: 'circle', colors: ['#020617', '#0f172a'] }, fx: 'flash' },
  { id: 'intro-speedlines', kind: 'intro', name: 'Corte de Anime', collection: 'anime', rarity: 'épica', requirement: NITRO,
    description: 'Painéis diagonais, estouro com retícula e carimbo 見参.', durationMs: 1700, scene: 'anime-cut', fx: 'speedlines' },
  { id: 'intro-fairy-tale', kind: 'intro', name: 'Conto de Fadas', collection: 'princess', rarity: 'épica', requirement: NITRO,
    description: 'Uma fada traça uma espiral de brilho, o castelo surge e tudo floresce.', durationMs: 2300, scene: 'fairy',
    reveal: { kind: 'iris', colors: ['#fdf2f8', '#fbcfe8', '#e9d5ff'] }, particles: { glyph: '✧', mode: 'burst', count: 22, colors: ['#f472b6', '#c084fc', '#fde68a'] } },
  { id: 'intro-glitch-boot', kind: 'intro', name: 'Boot Glitch', collection: 'cyber', rarity: 'épica', requirement: NITRO,
    description: 'O CRT liga, o boot roda e o sinal estabiliza com aberração RGB.', durationMs: 1900, scene: 'glitch-boot',
    reveal: { kind: 'curtain', colors: ['#020617', '#0e7490'] }, fx: 'glitch' },
  { id: 'intro-hyperspace', kind: 'intro', name: 'Vórtice Cósmico', collection: 'cosmico', rarity: 'lendária', requirement: NITRO,
    description: 'Uma nebulosa gira em espiral até explodir em luz.', durationMs: 1900, scene: 'hyperspace',
    reveal: { kind: 'iris', colors: ['#000000', '#1e1b4b'] }, particles: { glyph: '', mode: 'streak', count: 40, colors: ['#ffffff', '#c4b5fd', '#93c5fd'] } },

  // ---- Novas cenas ----
  { id: 'intro-lurking-monster', kind: 'intro', name: 'Monstro à Espreita', collection: 'sombras', rarity: 'lendária', requirement: NITRO,
    description: 'Fumaça viva, olhos no escuro e o bote que dispersa as sombras.', durationMs: 2300, scene: 'monster' },
  { id: 'intro-jaguar-claw', kind: 'intro', name: 'Garra de Onça', collection: 'selva', rarity: 'lendária', requirement: NITRO,
    description: 'Olhos na mata, três garras e uma explosão de folhas.', durationMs: 1900, scene: 'jaguar' },
  { id: 'intro-storm', kind: 'intro', name: 'Tempestade', collection: 'selva', rarity: 'épica', requirement: NITRO,
    description: 'Nuvens que rolam, relâmpagos que acendem o céu e a luz voltando.', durationMs: 2200, scene: 'storm' },
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


// ============================================================================
// ESTILOS DE NOME (12)
// ============================================================================

const FONTS: FontItem[] = [
  { id: 'font-blocos', kind: 'font', name: 'Bloco Pixel', collection: 'tipografia', rarity: 'épica', requirement: NITRO,
    description: 'Pixels quadrados com sombra dura, no clima dos jogos de blocos.', font: 'blocos', effect: 'block' },
  { id: 'font-arcade', kind: 'font', name: 'Arcade 8-bit', collection: 'tipografia', rarity: 'rara', requirement: NITRO,
    description: 'Letreiro de fliperama dos anos 80.', font: 'arcade', effect: 'block' },
  { id: 'font-orbital', kind: 'font', name: 'Orbital', collection: 'tipografia', rarity: 'rara', requirement: NITRO,
    description: 'Painel de nave com brilho neon.', font: 'orbit', effect: 'glow' },
  { id: 'font-cursiva', kind: 'font', name: 'Cursiva', collection: 'tipografia', rarity: 'comum', requirement: NITRO,
    description: 'Assinatura caprichada.', font: 'cursiva' },
  { id: 'font-imperial', kind: 'font', name: 'Imperial', collection: 'tipografia', rarity: 'lendária', requirement: NITRO,
    description: 'Letras romanas em ouro escovado.', font: 'imperial', effect: 'chrome' },
  { id: 'font-terror', kind: 'font', name: 'Terror', collection: 'tipografia', rarity: 'épica', requirement: NITRO,
    description: 'Escorrendo como pôster de filme B.', font: 'terror', effect: 'drip' },
  { id: 'font-rua', kind: 'font', name: 'Rua', collection: 'tipografia', rarity: 'rara', requirement: NITRO,
    description: 'Grafite em bloco com sombra 3D.', font: 'rua', effect: 'street' },
  { id: 'font-neon', kind: 'font', name: 'Neon Retrô', collection: 'tipografia', rarity: 'épica', requirement: NITRO,
    description: 'Tubos de neon de letreiro antigo.', font: 'neon', effect: 'neon' },
  { id: 'font-gibi', kind: 'font', name: 'Gibi', collection: 'tipografia', rarity: 'comum', requirement: NITRO,
    description: 'Balão de história em quadrinhos.', font: 'gibi', effect: 'outline' },
  { id: 'font-glitch', kind: 'font', name: 'Glitch', collection: 'tipografia', rarity: 'rara', requirement: NITRO,
    description: 'Sinal corrompido com aberração RGB.', font: 'glitch' },
  { id: 'font-gotica', kind: 'font', name: 'Gótica', collection: 'tipografia', rarity: 'épica', requirement: NITRO,
    description: 'Fraktur medieval de manuscrito.', font: 'gotica' },
  { id: 'font-manuscrito', kind: 'font', name: 'Manuscrito', collection: 'tipografia', rarity: 'comum', requirement: NITRO,
    description: 'Escrito à mão no caderno.', font: 'manuscrito' },
];

// ============================================================================
// TEMAS DE APP (16) — cores em components/nitro/themes.css
// ============================================================================

const THEMES: ThemeItem[] = [
  { id: 'theme-kwai', kind: 'theme', name: 'Laranja Elétrico', collection: 'temas', rarity: 'épica', requirement: NITRO,
    description: 'Laranja e rosa vibrantes, na vibe dos apps de vídeo curto.', mode: 'dark', swatch: ['#ff7a1a', '#ee0979', '#1a0b07'] },
  { id: 'theme-infernal', kind: 'theme', name: 'Infernal', collection: 'temas', rarity: 'lendária', requirement: NITRO,
    description: 'Brasas sobre preto vulcânico.', mode: 'dark', swatch: ['#ef4444', '#7f1d1d', '#140303'] },
  { id: 'theme-blocos', kind: 'theme', name: 'Mundo de Blocos', collection: 'temas', rarity: 'épica', requirement: NITRO,
    description: 'Grama, terra e pixels — clima de sandbox.', mode: 'dark', swatch: ['#5fbf3a', '#6b4423', '#2a1c0f'] },
  { id: 'theme-cafe', kind: 'theme', name: 'Café Expresso', collection: 'temas', rarity: 'rara', requirement: NITRO,
    description: 'Marrom torrado com creme.', mode: 'dark', swatch: ['#c8915b', '#4a2f1f', '#1c120c'] },
  { id: 'theme-latte', kind: 'theme', name: 'Café com Leite', collection: 'temas', rarity: 'rara', requirement: NITRO,
    description: 'Bege suave e aconchegante.', mode: 'light', swatch: ['#a0673d', '#e9d5c1', '#fbf6f0'] },
  { id: 'theme-espacial', kind: 'theme', name: 'Espacial', collection: 'temas', rarity: 'lendária', requirement: NITRO,
    description: 'Nebulosa roxa e campo de estrelas.', mode: 'dark', swatch: ['#8b5cf6', '#1e1b4b', '#050816'] },
  { id: 'theme-soft-blue', kind: 'theme', name: 'Soft Blue Clean', collection: 'temas', rarity: 'comum', requirement: NITRO,
    description: 'Branco limpo com azul suave.', mode: 'light', swatch: ['#3b82f6', '#dbeafe', '#f8fbff'] },
  { id: 'theme-algodao', kind: 'theme', name: 'Algodão Doce', collection: 'temas', rarity: 'rara', requirement: NITRO,
    description: 'Rosa e pêssego, doce e claro.', mode: 'light', swatch: ['#ec4899', '#fde2e4', '#fff1e6'] },
  { id: 'theme-menta', kind: 'theme', name: 'Menta Gelada', collection: 'temas', rarity: 'comum', requirement: NITRO,
    description: 'Verde-água e azul gelo.', mode: 'light', swatch: ['#14b8a6', '#ccfbf1', '#eef6ff'] },
  { id: 'theme-lavanda', kind: 'theme', name: 'Lavanda', collection: 'temas', rarity: 'comum', requirement: NITRO,
    description: 'Lilás claro e sereno.', mode: 'light', swatch: ['#8b5cf6', '#ede9fe', '#f8f7ff'] },
  { id: 'theme-aurora', kind: 'theme', name: 'Aurora Boreal', collection: 'temas', rarity: 'épica', requirement: NITRO,
    description: 'Faixas verdes e violetas no céu polar.', mode: 'dark', swatch: ['#2dd4bf', '#7c3aed', '#04111f'] },
  { id: 'theme-synthwave', kind: 'theme', name: 'Synthwave', collection: 'temas', rarity: 'épica', requirement: NITRO,
    description: 'Magenta, ciano e horizonte retrô.', mode: 'dark', swatch: ['#f472b6', '#22d3ee', '#12001f'] },
  { id: 'theme-crepusculo', kind: 'theme', name: 'Crepúsculo', collection: 'temas', rarity: 'rara', requirement: NITRO,
    description: 'Pôr do sol roxo e laranja.', mode: 'dark', swatch: ['#fb923c', '#9333ea', '#1a0b24'] },
  { id: 'theme-floresta', kind: 'theme', name: 'Floresta Noturna', collection: 'temas', rarity: 'rara', requirement: NITRO,
    description: 'Verde musgo sob a lua.', mode: 'dark', swatch: ['#4ade80', '#14532d', '#06140d'] },
  { id: 'theme-oceano', kind: 'theme', name: 'Mar Profundo', collection: 'temas', rarity: 'rara', requirement: NITRO,
    description: 'Azul abissal com brilho ciano.', mode: 'dark', swatch: ['#38bdf8', '#03346e', '#021526'] },
  { id: 'theme-terminal', kind: 'theme', name: 'Terminal', collection: 'temas', rarity: 'comum', requirement: NITRO,
    description: 'Preto e verde fósforo.', mode: 'dark', swatch: ['#22c55e', '#052e16', '#000000'] },
];

export const NITRO_ITEMS: NitroItem[] = [...TITLES, ...TAGS, ...FRAMES, ...INTROS, ...FONTS, ...THEMES];

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
  font: { singular: 'Estilo de nome', plural: 'Estilos de nome' },
  theme: { singular: 'Tema do app', plural: 'Temas' },
};

/** Snapshot salvo em profiles.cosmetics. */
export interface NitroCosmetics {
  v?: 1;
  title?: string | null;
  tag?: string | null;
  frame?: string | null;
  intro?: string | null;
  /** Estilo de nome (fonte). */
  font?: string | null;
  /** Tema de aplicativo (só quem usa vê). */
  theme?: string | null;
  frameEnabled?: boolean;
  frameAnimated?: boolean;
  introEnabled?: boolean;
  levelAnimation?: boolean;
  /** Rainbow na logo e nos asteriscos de carregamento (benefício Nitro). */
  rainbow?: boolean;
  updatedAt?: string;
}
