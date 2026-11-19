export type TierEffectKey =
  | 'none'
  | 'ember'
  | 'prism'
  | 'gold'
  | 'sapphire'
  | 'singularity';

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
  perks: string[];
}

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
    perks: ['Acesso padrão à comunidade Insight*'],
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
    perks: [
      'Presença permanente no Mural de Agradecimentos',
      'Selo Centelha com brilho cobre vivo',
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
    perks: [
      'Todos os reconhecimentos anteriores',
      'Selo Prisma com refração metálica contínua',
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
    perks: [
      'Acabamento ouro escovado no nome, borda e selo',
      'Prioridade em testes fechados da versão 2.0',
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
    perks: [
      'Selo Safira com grade técnica e pulso luminoso',
      'Personalizações exclusivas de perfil (em breve)',
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
    perks: [
      'Acabamento prismático rainbow em borda, selo e destaque',
      'Agradecimento perpétuo e todos os recursos futuros',
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

export function formatBRL(value: number): string {
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  }).format(value);
}