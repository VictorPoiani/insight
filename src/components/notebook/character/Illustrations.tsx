/**
 * Ilustrações autorais da ficha de personagem: traço fino, cor do tema
 * (currentColor = tinta; var(--nb-hl) = destaque) e o asterisco do Insight.
 * Desenhadas em SVG para acompanhar tema claro/escuro e qualquer tamanho.
 */

type P = { className?: string };

const S = { fill: 'none', stroke: 'currentColor', strokeWidth: 1.4, strokeLinecap: 'round' as const, strokeLinejoin: 'round' as const };
const A = { ...S, stroke: 'var(--nb-hl)' };

/** asterisco do Insight */
function Star({ x, y, r = 6, w = 1.8 }: { x: number; y: number; r?: number; w?: number }) {
  return (
    <g stroke="var(--nb-hl)" strokeWidth={w} strokeLinecap="round">
      {[0, 60, 120].map((a) => {
        const rad = (a * Math.PI) / 180;
        return <line key={a} x1={x - r * Math.cos(rad)} y1={y - r * Math.sin(rad)} x2={x + r * Math.cos(rad)} y2={y + r * Math.sin(rad)} />;
      })}
    </g>
  );
}

function Frame({ children, className, label }: P & { children: React.ReactNode; label: string }) {
  return (
    <svg viewBox="0 0 160 96" role="img" aria-label={label} className={className}>
      {children}
    </svg>
  );
}

/** Essência: busto com aspas */
export function ArtEssence({ className }: P) {
  return (
    <Frame className={className} label="Ilustração: retrato do personagem">
      <circle cx="80" cy="38" r="15" {...S} />
      <path d="M52 86c2-17 13-27 28-27s26 10 28 27" {...S} />
      <circle cx="28" cy="40" r="4" fill="var(--nb-hl)" />
      <path d="M24.5 39c0-6 3-10 8-12" {...A} strokeWidth={1.8} />
      <circle cx="42" cy="40" r="4" fill="var(--nb-hl)" />
      <path d="M38.5 39c0-6 3-10 8-12" {...A} strokeWidth={1.8} />
      <path d="M116 62h24M120 70h20M124 78h16" {...S} opacity=".5" />
      <Star x={128} y={26} r={7} />
    </Frame>
  );
}

/** Cadernos: duas páginas e uma pena */
export function ArtNotebooks({ className }: P) {
  return (
    <Frame className={className} label="Ilustração: caderno aberto">
      <path d="M26 24c16-4 32-2 54 6v54c-22-8-38-10-54-6z" {...S} />
      <path d="M134 24c-16-4-32-2-54 6v54c22-8 38-10 54-6z" {...S} />
      <path d="M36 40c10-1 20 0 32 4M36 50c10-1 20 0 32 4M36 60c8-1 16 0 24 3" {...S} opacity=".5" />
      <path d="M92 44c10-4 20-5 32-4M92 54c8-3 16-4 26-4" {...A} />
      <path d="M120 82l18-46c2-5 8-3 6 2l-18 46-6 4z" {...S} />
      <Star x={30} y={14} r={5} />
    </Frame>
  );
}

/** Perfil físico: figura com régua de medida */
export function ArtPhysical({ className }: P) {
  return (
    <Frame className={className} label="Ilustração: corpo e medidas">
      <circle cx="80" cy="20" r="8" {...S} />
      <path d="M80 28v30M80 36l-14 14M80 36l14 14M80 58l-10 28M80 58l10 28" {...S} />
      <path d="M46 12v76" {...A} />
      {[12, 24, 36, 48, 60, 72, 84].map((y) => (
        <path key={y} d={`M46 ${y}h${y % 24 === 12 ? 7 : 4}`} {...A} />
      ))}
      <path d="M108 30h24M108 46h18M108 62h22" {...S} opacity=".45" />
      <Star x={124} y={80} r={5} />
    </Frame>
  );
}

/** Perfil psicológico: cabeça de perfil com espiral */
export function ArtPsych({ className }: P) {
  return (
    <Frame className={className} label="Ilustração: mente em espiral">
      <path d="M64 86V72c-8-2-12-8-12-14l-6-3 6-8c-1-18 12-33 30-33 17 0 30 13 30 30 0 12-6 20-14 25v17" {...S} />
      <path d="M84 40a3 3 0 1 1-3-3 6 6 0 1 1-6 6 9 9 0 1 1 9 9 12 12 0 1 1-12-12" {...A} />
      <Star x={124} y={22} r={6} />
      <circle cx="136" cy="44" r="2" fill="var(--nb-hl)" />
      <circle cx="30" cy="30" r="1.6" fill="currentColor" opacity=".5" />
    </Frame>
  );
}

/** Perfil físico-psicológico: rosto dividido, metade traço, metade espiral */
export function ArtMixed({ className }: P) {
  return (
    <Frame className={className} label="Ilustração: corpo e mente juntos">
      <path d="M80 12c-16 0-26 12-26 28 0 20 12 40 26 40" {...S} />
      <path d="M80 12c16 0 26 12 26 28 0 20-12 40-26 40" {...A} strokeDasharray="3 4" />
      <path d="M80 12v68" {...S} opacity=".35" />
      <path d="M66 38h6M68 54c3 2 6 2 9 0" {...S} />
      <path d="M93 40a2.5 2.5 0 1 1-2.5-2.5 5 5 0 1 1-5 5 7.5 7.5 0 1 1 7.5 7.5" {...A} />
      <Star x={128} y={76} r={6} />
      <path d="M22 70h20M26 78h16" {...S} opacity=".45" />
    </Frame>
  );
}

/** Backstory: ampulheta */
export function ArtBackstory({ className }: P) {
  return (
    <Frame className={className} label="Ilustração: ampulheta do passado">
      <path d="M62 12h36M62 84h36" {...S} />
      <path d="M66 12c0 20 28 22 28 36S66 64 66 84M94 12c0 20-28 22-28 36s28 16 28 36" {...S} />
      <path d="M72 78c4-6 12-6 16 0z" fill="var(--nb-hl)" opacity=".85" />
      <path d="M80 50v22" {...A} strokeDasharray="1 4" />
      <path d="M24 48h22M114 48h22" {...S} opacity=".4" />
      <Star x={128} y={22} r={5} />
    </Frame>
  );
}

/** Arco: curva com três marcos (início, virada, fim) */
export function ArtArc({ className }: P) {
  return (
    <Frame className={className} label="Ilustração: arco do personagem">
      <path d="M20 78C44 78 50 22 80 22s40 38 60 38" {...S} />
      <circle cx="20" cy="78" r="4" {...S} />
      <circle cx="80" cy="22" r="4" fill="var(--nb-hl)" stroke="var(--nb-hl)" />
      <Star x={140} y={60} r={7} w={2} />
      <path d="M20 88h120" {...S} opacity=".3" strokeDasharray="2 5" />
    </Frame>
  );
}

/** Entrevista: dois balões de fala */
export function ArtInterview({ className }: P) {
  return (
    <Frame className={className} label="Ilustração: entrevista">
      <path d="M22 18h66a8 8 0 0 1 8 8v22a8 8 0 0 1-8 8H48l-12 10v-10h-14a8 8 0 0 1-8-8V26a8 8 0 0 1 8-8z" {...S} />
      <path d="M50 30c0-5 9-5 9 0 0 4-4 4-4 8M55 44v.5" {...A} />
      <path d="M78 46h52a8 8 0 0 1 8 8v16a8 8 0 0 1-8 8h-8v9l-11-9H78a8 8 0 0 1-8-8V54a8 8 0 0 1 8-8z" {...S} />
      <path d="M84 60h36M84 68h24" {...S} opacity=".5" />
      <Star x={146} y={22} r={6} />
    </Frame>
  );
}
