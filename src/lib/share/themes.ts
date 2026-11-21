/** Estilos das imagens de compartilhamento (usados no servidor e no modal). */
export type ShareFormat = 'story' | 'square' | 'og';

export interface ShareTheme {
  id: string;
  label: string;
  /** fundo (CSS gradient aceito pelo gerador de imagens) */
  bg: string;
  card: string;
  cardBorder: string;
  text: string;
  sub: string;
  accent: string;
  /** cor do asterisco decorativo */
  mark: string;
  swatch: [string, string];
}

export const SHARE_THEMES: ShareTheme[] = [
  {
    id: 'insight',
    label: 'Insight',
    bg: 'linear-gradient(160deg, #0b1220 0%, #0a0f1c 45%, #172554 100%)',
    card: 'rgba(15, 23, 42, 0.78)',
    cardBorder: 'rgba(96, 165, 250, 0.35)',
    text: '#f8fafc',
    sub: '#94a3b8',
    accent: '#60a5fa',
    mark: 'rgba(59, 130, 246, 0.22)',
    swatch: ['#2563eb', '#0b1220'],
  },
  {
    id: 'aurora',
    label: 'Aurora',
    bg: 'linear-gradient(160deg, #052e2b 0%, #0f172a 50%, #3b0764 100%)',
    card: 'rgba(8, 20, 30, 0.72)',
    cardBorder: 'rgba(45, 212, 191, 0.38)',
    text: '#ecfeff',
    sub: '#99f6e4',
    accent: '#2dd4bf',
    mark: 'rgba(167, 139, 250, 0.25)',
    swatch: ['#2dd4bf', '#7c3aed'],
  },
  {
    id: 'sunset',
    label: 'Pôr do sol',
    bg: 'linear-gradient(165deg, #f97316 0%, #db2777 55%, #6d28d9 100%)',
    card: 'rgba(30, 10, 30, 0.55)',
    cardBorder: 'rgba(255, 255, 255, 0.35)',
    text: '#ffffff',
    sub: '#fde68a',
    accent: '#fde68a',
    mark: 'rgba(255, 255, 255, 0.18)',
    swatch: ['#f97316', '#db2777'],
  },
  {
    id: 'papel',
    label: 'Papel',
    bg: 'linear-gradient(170deg, #fdfaf4 0%, #f3ecdf 100%)',
    card: 'rgba(255, 255, 255, 0.92)',
    cardBorder: 'rgba(120, 96, 64, 0.25)',
    text: '#1f1a14',
    sub: '#6b5d4c',
    accent: '#b45309',
    mark: 'rgba(180, 83, 9, 0.12)',
    swatch: ['#f3ecdf', '#b45309'],
  },
  {
    id: 'neon',
    label: 'Neon',
    bg: 'linear-gradient(160deg, #000000 0%, #0a0014 60%, #1a0033 100%)',
    card: 'rgba(10, 0, 20, 0.8)',
    cardBorder: 'rgba(244, 114, 182, 0.55)',
    text: '#ffffff',
    sub: '#f0abfc',
    accent: '#22d3ee',
    mark: 'rgba(244, 114, 182, 0.22)',
    swatch: ['#f472b6', '#22d3ee'],
  },
  {
    id: 'minimal',
    label: 'Minimal',
    bg: 'linear-gradient(180deg, #ffffff 0%, #f4f4f5 100%)',
    card: 'rgba(255, 255, 255, 1)',
    cardBorder: 'rgba(24, 24, 27, 0.12)',
    text: '#09090b',
    sub: '#52525b',
    accent: '#2563eb',
    mark: 'rgba(37, 99, 235, 0.08)',
    swatch: ['#ffffff', '#2563eb'],
  },
];

export function getShareTheme(id: string | null | undefined): ShareTheme {
  return SHARE_THEMES.find((t) => t.id === id) || SHARE_THEMES[0];
}

export const SHARE_SIZES: Record<ShareFormat, { width: number; height: number }> = {
  story: { width: 1080, height: 1920 },
  square: { width: 1080, height: 1080 },
  og: { width: 1200, height: 630 },
};
