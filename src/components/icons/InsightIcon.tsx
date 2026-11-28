/**
 * Ícones autorais do Insight (no lugar dos emojis da interface).
 *
 * Estilo: grade 24×24, traço de 2 com pontas e junções arredondadas, cantos
 * generosos e curvas no lugar de quinas — redondinhos, mas mínimos. Herdam a
 * cor do texto (`currentColor`). As reações têm um preenchimento suave na
 * mesma cor do traço.
 *
 * Regra da casa: um desenho = um significado. Nada aqui repete o desenho de
 * outro ícone com outro propósito (ex.: o coração da interface é só curtida/
 * apoio, por isso Saúde usa a cápsula; o "play" é só do player de vídeo, por isso
 * Cinema é a película).
 */
type IconDef = { body: React.ReactNode; tinted?: boolean };

const soft = { fill: 'currentColor', fillOpacity: 0.16 } as const;

const ICONS = {
  // ------------------------------------------------------------ temas de notícias
  /** Tecnologia: notebook com prompt */
  tecnologia: {
    body: (
      <>
        <rect x="4" y="4.5" width="16" height="11.5" rx="2.5" />
        <path d="M2.75 19.5h18.5" />
        <path d="M8.25 8.75l2 1.5-2 1.5M12.5 12h3" />
      </>
    ),
  },
  /** Inteligência Artificial: chip com faísca suave */
  ia: {
    body: (
      <>
        <rect x="5" y="5" width="14" height="14" rx="4" />
        <path d="M12 8.25c.4 2 1.75 3.35 3.75 3.75-2 .4-3.35 1.75-3.75 3.75-.4-2-1.75-3.35-3.75-3.75 2-.4 3.35-1.75 3.75-3.75z" />
        <path d="M9.5 2.75v2M14.5 2.75v2M9.5 19.25v2M14.5 19.25v2M2.75 9.5h2M2.75 14.5h2M19.25 9.5h2M19.25 14.5h2" />
      </>
    ),
  },
  /** Programação: chaves { } */
  dev: {
    body: (
      <path d="M8.5 4.5c-1.75 0-2.5.75-2.5 2.5v2.25c0 1.25-.75 2.25-2.25 2.75 1.5.5 2.25 1.5 2.25 2.75V17c0 1.75.75 2.5 2.5 2.5M15.5 4.5c1.75 0 2.5.75 2.5 2.5v2.25c0 1.25.75 2.25 2.25 2.75-1.5.5-2.25 1.5-2.25 2.75V17c0 1.75-.75 2.5-2.5 2.5" />
    ),
  },
  /** Segurança digital: escudo com visto */
  seguranca: {
    body: (
      <>
        <path d="M12 3.25c2.3 1.4 4.65 2.15 7 2.3v5.7c0 4.2-2.8 7.45-7 9.5-4.2-2.05-7-5.3-7-9.5v-5.7c2.35-.15 4.7-.9 7-2.3z" />
        <path d="M9 12.25l2.1 2.1L15 10.5" />
      </>
    ),
  },
  /** Games: controle */
  games: {
    body: (
      <>
        <path d="M7.5 7.5h9a4.5 4.5 0 014.4 5.45l-.75 3.4a2.5 2.5 0 01-4.2 1.2L14 15.75h-4l-1.95 1.8a2.5 2.5 0 01-4.2-1.2l-.75-3.4A4.5 4.5 0 017.5 7.5z" />
        <path d="M8.25 10.5v3M6.75 12h3" />
        <path d="M15.25 11.25h.01M17.25 13h.01" strokeWidth="2.75" />
      </>
    ),
  },
  /** Ciência: átomo */
  ciencia: {
    body: (
      <>
        <path d="M12 12h.01" strokeWidth="3" />
        <ellipse cx="12" cy="12" rx="9" ry="3.75" />
        <ellipse cx="12" cy="12" rx="9" ry="3.75" transform="rotate(60 12 12)" />
        <ellipse cx="12" cy="12" rx="9" ry="3.75" transform="rotate(-60 12 12)" />
      </>
    ),
  },
  /** Espaço: planeta com anel */
  espaco: {
    body: (
      <>
        <circle cx="12" cy="12" r="5.5" />
        <path d="M7.2 9.4C4.1 9.1 2.3 9.75 2.6 11.2c.45 2.15 5.9 4.35 12.2 4.95 4.75.45 7.4-.3 6.6-1.85-.35-.7-1.4-1.4-2.95-2.05" />
        <path d="M19.5 4.5h.01" strokeWidth="2.75" />
      </>
    ),
  },
  /** Saúde: cápsula */
  saude: {
    body: (
      <>
        <rect x="3.75" y="8.25" width="16.5" height="7.5" rx="3.75" transform="rotate(-45 12 12)" />
        <path d="M9.35 9.35l5.3 5.3" />
      </>
    ),
  },
  /** Economia: linha subindo */
  economia: {
    body: (
      <>
        <path d="M3.5 19.5h17" />
        <path d="M4.5 15.5c2.25-.25 3.25-3.25 5.5-3.25s2.5 1.75 4.25.5c1.5-1.1 2.5-3.5 4.75-5.5" />
        <path d="M15.5 7h3.75v3.75" />
      </>
    ),
  },
  /** Cripto: moeda com B */
  cripto: {
    body: (
      <>
        <circle cx="12" cy="12" r="8.75" />
        <path d="M10 8v8M10 8.25h2.9a1.9 1.9 0 010 3.75H10h3.35a2 2 0 010 4H10M11.5 6.5v1.5M11.5 16v1.5" />
      </>
    ),
  },
  /** Política: prédio com colunas */
  politica: {
    body: (
      <>
        <path d="M4 9.25l7.1-4.45a1.7 1.7 0 011.8 0L20 9.25z" />
        <path d="M6.5 11.75v5M10.5 11.75v5M13.5 11.75v5M17.5 11.75v5" />
        <path d="M3.75 19.75h16.5" />
      </>
    ),
  },
  /** Brasil: losango, esfera e faixa */
  brasil: {
    body: (
      <>
        <path d="M10.7 4.95a2 2 0 012.6 0l6.95 5.85a1.6 1.6 0 010 2.4l-6.95 5.85a2 2 0 01-2.6 0L3.75 13.2a1.6 1.6 0 010-2.4z" />
        <circle cx="12" cy="12" r="3.4" />
        <path d="M8.75 11.3a6.6 6.6 0 016.5 1.4" />
      </>
    ),
  },
  /** Mundo: globo */
  mundo: {
    body: (
      <>
        <circle cx="12" cy="12" r="8.75" />
        <path d="M3.5 12h17" />
        <path d="M12 3.25c2.3 2.45 3.5 5.4 3.5 8.75s-1.2 6.3-3.5 8.75c-2.3-2.45-3.5-5.4-3.5-8.75s1.2-6.3 3.5-8.75z" />
      </>
    ),
  },
  /** Esportes: medalha com fita */
  esportes: {
    body: (
      <>
        <path d="M7.75 3.25l3.1 5.5M16.25 3.25l-3.1 5.5" />
        <circle cx="12" cy="14.5" r="6" />
        <circle cx="12" cy="14.5" r="2.4" />
      </>
    ),
  },
  /** Futebol: bola */
  futebol: {
    body: (
      <>
        <circle cx="12" cy="12" r="8.75" />
        <path fill="currentColor" d="M12 8.5l3.2 2.3-1.2 3.75h-4l-1.2-3.75z" />
        <path d="M12 8.5V5.25M15.2 10.8l3-1M14 14.55l1.9 2.6M10 14.55l-1.9 2.6M8.8 10.8l-3-1" />
      </>
    ),
  },
  /** Cinema & Séries: película */
  cinema: {
    body: (
      <>
        <rect x="4.5" y="3.5" width="15" height="17" rx="3" />
        <path d="M8.5 3.5v17M15.5 3.5v17M8.5 12h7" />
        <path d="M6.5 7.25h.01M6.5 12h.01M6.5 16.75h.01M17.5 7.25h.01M17.5 12h.01M17.5 16.75h.01" strokeWidth="2.5" />
      </>
    ),
  },
  /** Música: colcheias */
  musica: {
    body: (
      <>
        <path d="M9 17.25V6.5c0-.5.35-.9.85-1l8.5-1.75a1 1 0 011.15 1v10.5" />
        <path d="M9 9.75l10.5-2.25" />
        <circle cx="6.75" cy="17.5" r="2.25" />
        <circle cx="17.25" cy="15.25" r="2.25" />
      </>
    ),
  },
  /** Cultura pop: pipoca */
  'cultura-pop': {
    body: (
      <>
        <path d="M5 10.25h14l-1.55 9.6a1.3 1.3 0 01-1.3 1.15H7.85a1.3 1.3 0 01-1.3-1.15z" />
        <path d="M9.75 10.25l.6 10.75M14.25 10.25l-.6 10.75" />
        <path d="M5.5 10.25a2.4 2.4 0 012.1-3.5 2.7 2.7 0 015-1.35 2.55 2.55 0 014.35 1.5 2.35 2.35 0 011.55 3.35" />
      </>
    ),
  },

  // ------------------------------------------------------------ reações (traço + preenchimento suave)
  /** Reação "Boa ideia": lâmpada */
  'react-idea': {
    tinted: true,
    body: (
      <>
        <path {...soft} d="M12 3.25a6 6 0 00-3.55 10.85c.65.5 1.05 1.25 1.05 2.05v.35h5v-.35c0-.8.4-1.55 1.05-2.05A6 6 0 0012 3.25z" />
        <path d="M10 19.25h4M10.75 21.5h2.5" />
      </>
    ),
  },
  /** Reação "Incrível": chama */
  'react-fire': {
    tinted: true,
    body: (
      <path
        {...soft}
        d="M12 21.25c-3.6 0-6.25-2.55-6.25-6 0-2.6 1.35-4.3 2.6-5.85.35-.45 1.05-.3 1.2.25.3 1.05.9 1.85 1.7 2.3-.15-2.95 1.05-5.6 3.25-7.4.45-.35 1.1-.05 1.15.5.3 3.2 4.1 5.25 4.1 9.6v.6c0 3.45-2.6 6-6.25 6z"
      />
    ),
  },
  /** Reação "Engraçado": rosto rindo */
  'react-laugh': {
    tinted: true,
    body: (
      <>
        <circle {...soft} cx="12" cy="12" r="8.75" />
        <path d="M7.75 10.25c.5-.85 1.6-.85 2.1 0M14.15 10.25c.5-.85 1.6-.85 2.1 0" />
        <path {...soft} fillOpacity={0.5} d="M7.75 13.5h8.5c0 2.35-1.9 4-4.25 4s-4.25-1.65-4.25-4z" />
      </>
    ),
  },
  /** Reação "Me fez pensar": rosto pensativo */
  'react-think': {
    tinted: true,
    body: (
      <>
        <circle {...soft} cx="12" cy="12" r="8.75" />
        <path d="M8.5 8.75l1.75-.6M14.75 9.25h.01M9.25 10.5h.01" strokeWidth="2.25" />
        <path d="M9.5 15.25c1.25-.75 3-.9 4.75-.5" />
      </>
    ),
  },
  /** Reação "Uau": rosto surpreso */
  'react-wow': {
    tinted: true,
    body: (
      <>
        <circle {...soft} cx="12" cy="12" r="8.75" />
        <path d="M9.25 9.75h.01M14.75 9.75h.01" strokeWidth="2.75" />
        <ellipse cx="12" cy="15" rx="1.9" ry="2.25" />
      </>
    ),
  },

  // ------------------------------------------------------------ avulsos da interface
  /** Notícia sem imagem (capa): jornal */
  newspaper: {
    body: (
      <>
        <path d="M5 5.75A1.75 1.75 0 016.75 4h9.5A1.75 1.75 0 0118 5.75V18.5a1.75 1.75 0 001.75 1.75H7a2 2 0 01-2-2z" />
        <path d="M18 9h1.5A1.25 1.25 0 0120.75 10.25v8.25a1.75 1.75 0 01-1 1.6" />
        <rect x="8" y="7.25" width="7" height="4" rx="1" />
        <path d="M8 14.5h7M8 17h4.5" />
      </>
    ),
  },
  /** Água (planejador de dieta): gota */
  drop: {
    body: <path d="M12 3.5c-3.1 3.85-5.75 7.1-5.75 10.5a5.75 5.75 0 0011.5 0c0-3.4-2.65-6.65-5.75-10.5z" />,
  },
  /** Título Nitro "pétala": flor de cinco pétalas */
  blossom: {
    tinted: true,
    body: (
      <>
        <path {...soft} d="M12 4.5c2.1 0 3 1.9 2.4 3.9 2-.7 3.95.5 3.3 2.55-.4 1.25-1.6 1.75-2.8 1.75 1.25 1.6.9 3.6-.95 4.05-1.3.3-2.25-.5-2.95-1.6-.7 1.1-1.65 1.9-2.95 1.6-1.85-.45-2.2-2.45-.95-4.05-1.2 0-2.4-.5-2.8-1.75-.65-2.05 1.3-3.25 3.3-2.55-.6-2 .3-3.9 2.4-3.9z" />
        <circle cx="12" cy="11.25" r="1.25" />
      </>
    ),
  },
} satisfies Record<string, IconDef>;

export type InsightIconName = keyof typeof ICONS;

export function InsightIcon({
  name,
  className = 'w-4 h-4',
  title,
}: {
  name: InsightIconName | string;
  className?: string;
  /** texto acessível; sem ele o ícone é decorativo */
  title?: string;
}) {
  const def = (ICONS as Record<string, IconDef>)[name];
  if (!def) return null;
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      role={title ? 'img' : undefined}
      aria-label={title}
      aria-hidden={title ? undefined : true}
      className={`inline-block shrink-0 ${className}`}
    >
      {def.body}
    </svg>
  );
}
