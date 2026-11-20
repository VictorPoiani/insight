/**
 * Níveis de Contribuinte — progressão por apoio acumulado (1 R$ = 1 ponto).
 *
 * Cuida de CAPACIDADE (limite de anexos por post, comunidades, tópicos, suporte,
 * IA) e dos cosméticos de PATENTE. Não tem relação com a assinatura Insight Nitro
 * (src/lib/nitro/entitlement.ts), exceto por uma regra: o Nível 5 ganha Nitro
 * vitalício.
 *
 * Os limites valem para o tamanho FINAL enviado ao Cloudflare R2 (após a
 * compressão no navegador), somado entre todos os anexos de um mesmo post.
 * O banco aplica as mesmas regras (migração 20261121000000_contributor_perks_nitro.sql):
 * mantenha os dois em sincronia.
 */

export type TierEffectKey =
  | 'none'
  | 'ember'
  | 'prism'
  | 'gold'
  | 'sapphire'
  | 'singularity';

export type ContributorFeature =
  | 'ranking'
  | 'early-access'
  | 'create-communities'
  | 'create-topics'
  | 'ai-features'
  | 'priority-support'
  | 'ai-extra-credits'
  | 'animated-level-frame'
  | 'level-intro'
  | 'lifetime-nitro'
  | 'nitro-vip-group';

export interface ContributorPerk {
  label: string;
  /** Recurso ainda não lançado (mostra o selo "Em breve"). */
  soon?: boolean;
}

export interface ContributorTier {
  level: number;
  name: string;
  tagline: string;
  minPoints: number;
  color: string;
  secondaryColor: string;
  badgeBg: string;
  badgeBorder: string;
  glowRgba: string;
  effect: TierEffectKey;
  /** Teto da soma dos anexos de UM post (bytes, pós-compressão, no R2). */
  postUploadLimitBytes: number;
  /** Recursos que este nível adiciona (os anteriores são herdados). */
  unlocks: ContributorFeature[];
  /** Texto exibido na página de apoio (só o que este nível adiciona). */
  perks: ContributorPerk[];
}

export const MB = 1024 * 1024;
export const GB = 1024 * MB;

export const CONTRIBUTOR_TIERS: ContributorTier[] = [
  {
    level: 0,
    name: 'Observador',
    tagline: 'Ponto de partida na comunidade',
    minPoints: 0,
    color: '#64748b',
    secondaryColor: '#475569',
    badgeBg: 'rgba(100, 116, 139, 0.12)',
    badgeBorder: 'rgba(100, 116, 139, 0.30)',
    glowRgba: 'rgba(100, 116, 139, 0)',
    effect: 'none',
    postUploadLimitBytes: 50 * MB,
    unlocks: [],
    perks: [
      { label: 'Acesso padrão à comunidade Insight*' },
      { label: 'Até 50 MB de anexos por post (após compressão)' },
    ],
  },
  {
    level: 1,
    name: 'Recruta',
    tagline: 'A primeira faísca que mantém o projeto aceso',
    minPoints: 1,
    color: '#b86b35',
    secondaryColor: '#dc8b52',
    badgeBg: 'rgba(184, 107, 53, 0.14)',
    badgeBorder: 'rgba(184, 107, 53, 0.45)',
    glowRgba: 'rgba(217, 119, 6, 0.24)',
    effect: 'ember',
    postUploadLimitBytes: 400 * MB,
    unlocks: ['ranking'],
    perks: [
      { label: 'Entrada no Ranking de Contribuições e agradecimento perpétuo no mural' },
      { label: 'Até 400 MB de anexos por post (após compressão)' },
      { label: 'Moldura de patente cobre e tag Recruta' },
    ],
  },
  {
    level: 2,
    name: 'Escudeiro',
    tagline: 'Reflete e amplia o alcance da comunidade',
    minPoints: 10,
    color: '#475569',
    secondaryColor: '#0284c7',
    badgeBg: 'rgba(148, 163, 184, 0.18)',
    badgeBorder: 'rgba(100, 116, 139, 0.50)',
    glowRgba: 'rgba(125, 211, 252, 0.32)',
    effect: 'prism',
    postUploadLimitBytes: 800 * MB,
    unlocks: ['early-access', 'create-communities'],
    perks: [
      { label: 'Até 800 MB de anexos por post (após compressão)' },
      { label: 'Acesso antecipado a novos recursos' },
      { label: 'Criação de comunidades', soon: true },
      { label: 'Moldura de patente prisma e tag Escudeiro' },
    ],
  },
  {
    level: 3,
    name: 'Cavaleiro',
    tagline: 'Sustentação ativa e destaque no mural',
    minPoints: 50,
    color: '#b48219',
    secondaryColor: '#eab308',
    badgeBg: 'rgba(212, 167, 44, 0.16)',
    badgeBorder: 'rgba(202, 138, 4, 0.55)',
    glowRgba: 'rgba(234, 179, 8, 0.34)',
    effect: 'gold',
    postUploadLimitBytes: 2 * GB,
    unlocks: ['ai-features', 'create-topics'],
    perks: [
      { label: 'Até 2 GB de anexos por post (após compressão)' },
      { label: 'Criação de tópicos personalizados' },
      { label: 'Recursos de IA', soon: true },
      { label: 'Moldura de patente ouro escovado e tag Cavaleiro' },
    ],
  },
  {
    level: 4,
    name: 'Imperador',
    tagline: 'Ajuda a moldar a engenharia e o futuro da plataforma',
    minPoints: 100,
    color: '#0284c7',
    secondaryColor: '#38bdf8',
    badgeBg: 'rgba(2, 132, 199, 0.14)',
    badgeBorder: 'rgba(14, 165, 233, 0.55)',
    glowRgba: 'rgba(56, 189, 248, 0.38)',
    effect: 'sapphire',
    postUploadLimitBytes: 2 * GB,
    unlocks: ['priority-support', 'ai-extra-credits', 'animated-level-frame', 'level-intro'],
    perks: [
      { label: 'Suporte prioritário' },
      { label: 'Créditos extras de IA', soon: true },
      { label: 'Moldura safira animada e abertura de perfil de patente' },
    ],
  },
  {
    level: 5,
    name: 'Grão-Mestre',
    tagline: 'Espectro prismático completo e patente Prime do Insight*',
    minPoints: 250,
    color: '#4285F4',
    secondaryColor: '#EA4335',
    badgeBg: 'rgba(66, 133, 244, 0.12)',
    badgeBorder: 'rgba(66, 133, 244, 0.45)',
    glowRgba: 'rgba(66, 133, 244, 0.35)',
    effect: 'singularity',
    postUploadLimitBytes: 2 * GB,
    unlocks: ['lifetime-nitro', 'nitro-vip-group'],
    perks: [
      { label: 'Insight Nitro vitalício e gratuito' },
      { label: 'Grupo VIP Nitro no WhatsApp' },
      { label: 'Moldura singularity animada e abertura de perfil de patente' },
    ],
  },
];

export function amountToPoints(amountBRL: number): number {
  const safe = Number(amountBRL) || 0;
  return Math.max(0, Math.floor(safe));
}

export function getContributorTier(pointsOrAmount: number): ContributorTier {
  const pts = amountToPoints(pointsOrAmount);
  let current = CONTRIBUTOR_TIERS[0];
  for (const tier of CONTRIBUTOR_TIERS) {
    if (pts >= tier.minPoints) {
      current = tier;
    }
  }
  return current;
}

export function getNextContributorTier(pointsOrAmount: number): ContributorTier | null {
  const current = getContributorTier(pointsOrAmount);
  return CONTRIBUTOR_TIERS.find((t) => t.level === current.level + 1) || null;
}

/** Patente pelo número do nível (0–5); valores fora da faixa são limitados. */
export function getTierByLevel(level: number | null | undefined): ContributorTier {
  const lv = Math.max(0, Math.min(5, Math.floor(Number(level) || 0)));
  return CONTRIBUTOR_TIERS[lv];
}

/** Recursos acumulados até o nível (cada nível herda os anteriores). */
export function getContributorFeatures(level: number | null | undefined): Set<ContributorFeature> {
  const lv = getTierByLevel(level).level;
  const out = new Set<ContributorFeature>();
  for (const tier of CONTRIBUTOR_TIERS) {
    if (tier.level > lv) break;
    tier.unlocks.forEach((f) => out.add(f));
  }
  return out;
}

export function hasContributorFeature(
  level: number | null | undefined,
  feature: ContributorFeature
): boolean {
  return getContributorFeatures(level).has(feature);
}

/** Admin não tem teto de patente: recebe o maior limite. */
export function getUserUploadLimitBytes(
  level: number | null | undefined,
  role?: string | null
): number {
  if (role === 'admin') return CONTRIBUTOR_TIERS[CONTRIBUTOR_TIERS.length - 1].postUploadLimitBytes;
  return getTierByLevel(level).postUploadLimitBytes;
}

export function formatBytes(bytes?: number | null): string {
  if (!bytes || bytes <= 0) return '0 KB';
  if (bytes >= GB) return `${(bytes / GB).toFixed(bytes % GB === 0 ? 0 : 2).replace('.', ',')} GB`;
  if (bytes >= 10 * MB) return `${Math.round(bytes / MB)} MB`;
  if (bytes >= MB) return `${(bytes / MB).toFixed(1).replace('.', ',')} MB`;
  return `${Math.max(1, Math.round(bytes / 1024))} KB`;
}

export function formatBRL(value: number): string {
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  }).format(value);
}