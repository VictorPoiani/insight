'use client';

import type { CSSProperties } from 'react';
import type { IntroSceneId } from '@/lib/nitro/catalog';
import './intro.css';

/**
 * Cenas das aberturas de perfil — motion design 2D.
 *
 * Regras de desempenho: só transform/opacity (compositor da GPU), texturas
 * estáticas pré-renderizadas (public/nitro/intro), nenhum filtro ou máscara
 * animados, nenhum shader em tela cheia, poucas dezenas de elementos.
 * Tempo em porcentagens de --nx-dur.
 */

type CSSVars = CSSProperties & Record<`--${string}`, string | number>;

const TEX = '/nitro/intro';

function rand(seed: number) {
  const x = Math.sin(seed * 12.9898 + 78.233) * 43758.5453;
  return x - Math.floor(x);
}

function range(n: number) {
  return Array.from({ length: n }, (_, i) => i);
}

/** Partículas de bokeh em 3 planos (perto/meio/longe). */
function Bokeh({
  count,
  colors,
  seed,
  mode,
}: {
  count: number;
  colors: string[];
  seed: number;
  mode: 'drift' | 'burst' | 'swirl-in' | 'toward';
}) {
  return (
    <>
      {range(count).map((i) => {
        const plane = i % 3; // 0 perto, 1 meio, 2 longe
        const ang = rand(seed + i * 3.1) * Math.PI * 2;
        const dist = 18 + rand(seed + i * 5.7) * 40;
        const style: CSSVars = {
          '--x': `${(50 + Math.cos(ang) * dist * 1.1).toFixed(1)}%`,
          '--y': `${(40 + Math.sin(ang) * dist * 0.9).toFixed(1)}%`,
          '--tx': `${(Math.cos(ang) * (30 + plane * 10)).toFixed(1)}vmax`,
          '--ty': `${(Math.sin(ang) * (30 + plane * 10)).toFixed(1)}vmax`,
          '--sz': `${[14, 8, 4][plane] + rand(seed + i) * 6}px`,
          '--o': [0.95, 0.7, 0.45][plane],
          '--c': colors[i % colors.length],
          '--dl': `calc(var(--nx-dur) * ${(rand(seed + i * 9.3) * 0.25).toFixed(3)})`,
        };
        return <span key={i} className={`bk bk--${mode}`} style={style} />;
      })}
    </>
  );
}

export function IntroScene({ id }: { id: IntroSceneId }) {
  switch (id) {
    case 'monster':
      return <MonsterScene />;
    case 'jaguar':
      return <JaguarScene />;
    case 'storm':
      return <StormScene />;
    case 'tsunami':
      return <TsunamiScene />;
    case 'portal':
      return <PortalScene />;
    case 'anime-cut':
      return <AnimeScene />;
    case 'hyperspace':
      return <VortexScene />;
    case 'blizzard':
      return <BlizzardScene />;
    case 'gift':
      return <GiftScene />;
    case 'decree':
      return <DecreeScene />;
    case 'star-shower':
      return <StarShowerScene />;
    case 'eclipse':
      return <EclipseScene />;
    case 'fairy':
      return <FairyScene />;
    case 'glitch-boot':
      return <GlitchScene />;
    case 'sapphire':
      return <SapphireScene />;
    case 'singularity':
      return <SingularityScene />;
    case 'power-up':
      return <PowerUpScene />;
    case 'reveillon':
      return <ReveillonScene />;
    case 'halloween':
      return <HalloweenScene />;
  }
}

// ============================================================================
// MONSTRO À ESPREITA — fumaça viva, olhos no escuro, bote e dispersão
// ============================================================================

function Eyes({ className, style }: { className: string; style?: CSSVars }) {
  return (
    <div className={className} style={style}>
      <span className="eye">
        <i />
      </span>
      <span className="eye">
        <i />
      </span>
    </div>
  );
}

function MonsterScene() {
  const puffs = range(9).map((i) => {
    const ang = (i / 9) * Math.PI * 2 + rand(i) * 0.5;
    return {
      tex: i % 2 ? 'smoke-a' : 'smoke-b',
      x: 50 + Math.cos(ang) * 38,
      y: 42 + Math.sin(ang) * 34,
      ox: Math.cos(ang) * 70,
      oy: Math.sin(ang) * 70,
      rot: Math.round((rand(i + 3) - 0.5) * 80),
      s: 0.9 + rand(i + 7) * 0.5,
    };
  });
  return (
    <div className="sc sc-mon">
      <div className="mon-bg" />
      <div className="mon-cam">
        {puffs.map((p, i) => (
          <img
            key={i}
            src={`${TEX}/${p.tex}.webp`}
            alt=""
            className="mon-puff"
            style={{
              left: `${p.x}%`,
              top: `${p.y}%`,
              '--ox': `${p.ox}vmax`,
              '--oy': `${p.oy}vmax`,
              '--rot': `${p.rot}deg`,
              '--s': p.s,
            } as CSSVars}
          />
        ))}
        {[
          { l: 18, t: 22, d: 0.08, s: 0.55 },
          { l: 80, t: 18, d: 0.2, s: 0.45 },
          { l: 84, t: 64, d: 0.3, s: 0.6 },
          { l: 14, t: 68, d: 0.4, s: 0.5 },
        ].map((e, i) => (
          <Eyes
            key={i}
            className="mon-small"
            style={{ left: `${e.l}%`, top: `${e.t}%`, '--s': e.s, '--dl': `calc(var(--nx-dur) * ${e.d})` } as CSSVars}
          />
        ))}
        <div className="mon-aura" />
        <Eyes className="mon-big" />
      </div>
      <div className="mon-flash" />
    </div>
  );
}

// ============================================================================
// GARRA DE ONÇA — olhos na mata, três garras curtas e explosão de folhas
// ============================================================================

const CLAW = 'M22 0 C 44 28, 42 72, 10 100 C 30 72, 30 30, 22 0 Z';

function Leaf({ style, tone }: { style: CSSVars; tone: number }) {
  const fills = [
    ['#14532d', '#4ade80'],
    ['#166534', '#86efac'],
    ['#365314', '#a3e635'],
    ['#713f12', '#fbbf24'],
  ][tone % 4];
  return (
    <svg className="ja-leaf" viewBox="0 0 40 20" style={style}>
      <defs>
        <linearGradient id={`jl${tone % 4}`} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor={fills[1]} />
          <stop offset="100%" stopColor={fills[0]} />
        </linearGradient>
      </defs>
      <path d="M1 10 C 10 0, 28 0, 39 10 C 28 20, 10 20, 1 10 Z" fill={`url(#jl${tone % 4})`} />
      <path d="M3 10 L 36 10" stroke="rgba(255,255,255,0.35)" strokeWidth="0.8" />
    </svg>
  );
}

function JaguarScene() {
  return (
    <div className="sc sc-ja">
      <div className="ja-bg" />
      <div className="ja-cam">
        {range(6).map((i) => (
          <Leaf
            key={`f${i}`}
            tone={i}
            style={{
              left: `${[-6, 82, -10, 78, 30, 60][i]}%`,
              top: `${[-4, -6, 70, 74, -12, 86][i]}%`,
              width: `${34 + rand(i) * 18}vmin`,
              '--rot': `${[35, -150, -20, 160, 80, -80][i]}deg`,
              '--dx': `${[-1, 1, -1, 1, 0, 0][i] * 6}vmin`,
            } as CSSVars}
          />
        ))}
        <Eyes className="ja-eyes" />
        <svg className="ja-claws" viewBox="0 0 120 100">
          <defs>
            <linearGradient id="jaClaw" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#ffffff" />
              <stop offset="40%" stopColor="#fef3c7" />
              <stop offset="80%" stopColor="#fbbf24" />
              <stop offset="100%" stopColor="#f59e0b" stopOpacity="0.5" />
            </linearGradient>
            <linearGradient id="jaClawHalo" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#fbbf24" stopOpacity="0.5" />
              <stop offset="100%" stopColor="#ea580c" stopOpacity="0" />
            </linearGradient>
            <radialGradient id="jaClawGlow">
              <stop offset="0%" stopColor="#f59e0b" stopOpacity="0.55" />
              <stop offset="100%" stopColor="#f59e0b" stopOpacity="0" />
            </radialGradient>
          </defs>
          <ellipse cx="60" cy="50" rx="58" ry="46" fill="url(#jaClawGlow)" className="ja-claw-glow" />
          {[0, 1, 2].map((i) => (
            <g key={i} transform={`translate(${28 + i * 24} ${i === 1 ? -4 : 2})`}>
              <g transform="translate(-11 -6) scale(1.7 1.12)">
                <path className="ja-claw" style={{ '--i': i } as CSSVars} d={CLAW} fill="url(#jaClawHalo)" />
              </g>
              <path className="ja-claw" style={{ '--i': i } as CSSVars} d={CLAW} fill="url(#jaClaw)" />
            </g>
          ))}
        </svg>
      </div>
      {range(18).map((i) => {
        const ang = rand(i + 2) * Math.PI * 2;
        return (
          <div
            key={`b${i}`}
            className="ja-burst"
            style={{
              '--tx': `${(Math.cos(ang) * (35 + rand(i) * 25)).toFixed(1)}vmax`,
              '--ty': `${(Math.sin(ang) * (30 + rand(i + 1) * 25)).toFixed(1)}vmax`,
              '--r0': `${Math.round(rand(i + 9) * 360)}deg`,
              '--r1': `${Math.round(rand(i + 9) * 360 + (rand(i) - 0.5) * 720)}deg`,
            } as CSSVars}
          >
            <Leaf tone={i} style={{ width: `${4 + rand(i + 5) * 5}vmin` } as CSSVars} />
          </div>
        );
      })}
    </div>
  );
}

// ============================================================================
// TEMPESTADE — nuvens rolando, relâmpagos que acendem as nuvens, céu abrindo
// ============================================================================

function StormScene() {
  const clouds = [
    { x: 4, y: 10, w: 78, side: -1, tex: 'a', lit: 0.3 },
    { x: 58, y: 4, w: 72, side: 1, tex: 'b', lit: 0.52 },
    { x: 28, y: 28, w: 84, side: -1, tex: 'b', lit: 0.3 },
    { x: 70, y: 40, w: 70, side: 1, tex: 'a', lit: 0.52 },
    { x: 0, y: 52, w: 76, side: -1, tex: 'a', lit: 0.72 },
    { x: 46, y: 64, w: 80, side: 1, tex: 'b', lit: 0.72 },
  ];
  return (
    <div className="sc sc-st">
      <div className="st-sky" />
      <div className="st-cam">
        {clouds.map((c, i) => (
          <div
            key={i}
            className="st-cloud"
            style={{
              left: `${c.x - c.w / 2}%`,
              top: `${c.y - 20}%`,
              width: `${c.w}vmax`,
              '--side': c.side,
              '--dl': `calc(var(--nx-dur) * ${(i * 0.03).toFixed(2)})`,
            } as CSSVars}
          >
            <img src={`${TEX}/cloud-${c.tex}.webp`} alt="" />
            <img
              className="st-lit"
              src={`${TEX}/cloud-lit-${c.tex}.webp`}
              alt=""
              style={{ '--flash': `calc(var(--nx-dur) * ${c.lit})` } as CSSVars}
            />
          </div>
        ))}
      </div>
      <div className="st-glow" />
      <div className="st-clear" />
    </div>
  );
}

// ============================================================================
// TSUNAMI UKIYO-E — gradientes, espuma suave e parallax
// ============================================================================

const FOAM = range(14).map((i) => {
  const t = i / 13;
  const x = 380 + t * 300;
  const y = 105 - Math.sin(t * Math.PI) * 55 + t * 45;
  const s = 12 + rand(i + 2) * 10;
  return { x, y, s };
});

function TsunamiScene() {
  return (
    <div className="sc sc-ts">
      <div className="ts-paper" />
      <div className="ts-sun" />
      <svg className="ts-fuji" viewBox="0 0 200 100">
        <defs>
          <linearGradient id="tsFuji" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#4b7fa3" />
            <stop offset="100%" stopColor="#1e3a5f" />
          </linearGradient>
        </defs>
        <path d="M0 100 L 80 18 Q 100 6 120 18 L 200 100 Z" fill="url(#tsFuji)" />
        <path d="M80 18 Q 100 6 120 18 L 132 30 L 118 26 L 108 34 L 98 25 L 86 33 L 70 28 Z" fill="#f7f3e8" />
      </svg>
      <div className="ts-sea" />
      <svg className="ts-wave ts-wave-back" viewBox="0 0 1000 700" preserveAspectRatio="none">
        <defs>
          <linearGradient id="tsBack" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#5b8db3" />
            <stop offset="100%" stopColor="#1e3a5f" />
          </linearGradient>
        </defs>
        <path d="M0 700 L 0 420 C 120 380, 220 330, 320 360 C 420 390, 520 430, 640 420 C 780 410, 900 470, 1000 520 L 1000 700 Z" fill="url(#tsBack)" />
      </svg>
      <svg className="ts-wave ts-wave-main" viewBox="0 0 1000 700" preserveAspectRatio="none">
        <defs>
          <linearGradient id="tsBody" x1="0" y1="0" x2="0.4" y2="1">
            <stop offset="0%" stopColor="#3b6e8f" />
            <stop offset="35%" stopColor="#1e3a5f" />
            <stop offset="100%" stopColor="#0b1e36" />
          </linearGradient>
          <linearGradient id="tsBand" x1="0" y1="0" x2="1" y2="0">
            <stop offset="0%" stopColor="#9ec5d6" stopOpacity="0" />
            <stop offset="50%" stopColor="#9ec5d6" stopOpacity="0.55" />
            <stop offset="100%" stopColor="#9ec5d6" stopOpacity="0" />
          </linearGradient>
          <radialGradient id="tsFoam">
            <stop offset="0%" stopColor="#ffffff" />
            <stop offset="70%" stopColor="#f7f3e8" />
            <stop offset="100%" stopColor="#f7f3e8" stopOpacity="0" />
          </radialGradient>
        </defs>
        <path
          d="M0 700 L 0 260 C 90 190, 220 110, 380 80 C 520 55, 640 80, 690 160 C 720 210, 700 260, 650 262 C 690 220, 650 165, 590 172 C 520 180, 500 250, 545 300 C 610 370, 760 360, 860 420 C 930 460, 980 560, 1000 700 Z"
          fill="url(#tsBody)"
        />
        {[0, 1, 2].map((i) => (
          <path
            key={i}
            d={`M${50 + i * 45} 700 C ${40 + i * 35} ${520 - i * 45}, ${130 + i * 45} ${330 - i * 40}, ${310 + i * 45} ${230 - i * 28}`}
            fill="none"
            stroke="url(#tsBand)"
            strokeWidth={22 - i * 5}
            strokeLinecap="round"
          />
        ))}
        <path d="M380 80 C 520 55, 640 80, 690 160 C 720 210, 700 260, 650 262" fill="none" stroke="#f7f3e8" strokeWidth="16" strokeLinecap="round" />
        {FOAM.map((f, i) => (
          <circle key={i} cx={f.x} cy={f.y} r={f.s} fill="url(#tsFoam)" />
        ))}
      </svg>
      <Bokeh count={24} colors={['#ffffff', '#e0f2fe', '#f7f3e8']} seed={40} mode="burst" />
    </div>
  );
}

// ============================================================================
// PORTAL INFERNAL — brasas em espiral, núcleo e anel de fogo que se abre
// ============================================================================

function PortalScene() {
  return (
    <div className="sc sc-po">
      <div className="po-bg" />
      <div className="po-swirl">
        <Bokeh count={30} colors={['#fdba74', '#fb923c', '#fde68a', '#ef4444']} seed={11} mode="swirl-in" />
      </div>
      <div className="po-core" />
      <img className="po-ring po-ring-back" src={`${TEX}/portal-fire.webp`} alt="" />
      <img className="po-ring" src={`${TEX}/portal-fire.webp`} alt="" />
      <div className="po-flash" />
    </div>
  );
}

// ============================================================================
// CORTE DE ANIME — painéis diagonais, estouro com retícula e carimbo 見参
// ============================================================================

function AnimeScene() {
  return (
    <div className="sc sc-an">
      <div className="an-panel an-panel-a" />
      <div className="an-panel an-panel-b" />
      <div className="an-panel an-panel-c" />
      <svg className="an-burst" viewBox="-50 -50 100 100">
        <polygon
          points={range(24)
            .map((i) => {
              const a = (i / 24) * Math.PI * 2;
              const r = i % 2 ? 22 : 48;
              return `${(Math.cos(a) * r).toFixed(1)},${(Math.sin(a) * r).toFixed(1)}`;
            })
            .join(' ')}
          fill="#fff7ed"
        />
      </svg>
      <div className="an-dots" />
      <div className="an-sun" />
      <div className="an-stamp">
        <span>見参</span>
      </div>
    </div>
  );
}

// ============================================================================
// VÓRTICE CÓSMICO — nebulosa em espiral, estrelas vindo em direção à câmera
// ============================================================================

function VortexScene() {
  return (
    <div className="sc sc-vx">
      <div className="vx-bg" />
      <img className="vx-neb vx-neb-a" src={`${TEX}/vortex.webp`} alt="" />
      <img className="vx-neb vx-neb-b" src={`${TEX}/vortex.webp`} alt="" />
      <Bokeh count={42} colors={['#ffffff', '#c4b5fd', '#93c5fd', '#f0abfc']} seed={77} mode="toward" />
      <div className="vx-bloom" />
    </div>
  );
}

/** Céu estrelado estático com posições aleatórias (sem padrão de grade). */
function StarField({ seed, count, className, colors }: { seed: number; count: number; className: string; colors: string[] }) {
  return (
    <svg className={className} viewBox="0 0 160 100" preserveAspectRatio="xMidYMid slice" aria-hidden>
      {range(count).map((i) => {
        const big = rand(seed + i * 7.3) > 0.88;
        return (
          <circle
            key={i}
            cx={(rand(seed + i * 1.3) * 160).toFixed(2)}
            cy={(rand(seed + i * 2.9) * 100).toFixed(2)}
            r={big ? 0.32 + rand(seed + i) * 0.2 : 0.12 + rand(seed + i * 4.1) * 0.14}
            fill={colors[i % colors.length]}
            opacity={big ? 1 : 0.5 + rand(seed + i * 5.5) * 0.5}
          />
        );
      })}
    </svg>
  );
}

// ============================================================================
// NEVASCA — rajadas de neve em 3 planos, cristal que cresce e se estilhaça
// ============================================================================

function Snowflake() {
  const arm = (
    <g>
      <path d="M0 0 V-40" />
      <path d="M0 -14 L-9 -22 M0 -14 L9 -22" />
      <path d="M0 -26 L-7 -33 M0 -26 L7 -33" />
      <path d="M0 -36 L-3 -40 M0 -36 L3 -40" />
    </g>
  );
  return (
    <svg className="bz-flake" viewBox="-46 -46 92 92" aria-hidden>
      <defs>
        <linearGradient id="bzIce" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#ffffff" />
          <stop offset="0.5" stopColor="#bae6fd" />
          <stop offset="1" stopColor="#7dd3fc" />
        </linearGradient>
      </defs>
      <g fill="none" stroke="url(#bzIce)" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
        {range(6).map((i) => (
          <g key={i} transform={`rotate(${i * 60})`}>
            {arm}
          </g>
        ))}
      </g>
      <polygon
        points={range(6)
          .map((i) => `${(Math.cos((i * Math.PI) / 3) * 7).toFixed(2)},${(Math.sin((i * Math.PI) / 3) * 7).toFixed(2)}`)
          .join(' ')}
        fill="#e0f2fe"
        stroke="#ffffff"
        strokeWidth="1.5"
      />
    </svg>
  );
}

function BlizzardScene() {
  return (
    <div className="sc sc-bz">
      <div className="bz-bg" />
      <div className="bz-snow bz-snow-far" />
      <img className="bz-gust bz-gust-a" src={`${TEX}/cloud-lit-a.webp`} alt="" />
      <div className="bz-snow bz-snow-mid" />
      <img className="bz-gust bz-gust-b" src={`${TEX}/cloud-lit-b.webp`} alt="" />
      <div className="bz-glow" />
      <div className="bz-flake-wrap">
        <Snowflake />
      </div>
      <div className="bz-shards">
        <Bokeh count={26} colors={['#ffffff', '#e0f2fe', '#7dd3fc']} seed={31} mode="burst" />
      </div>
      <div className="bz-snow bz-snow-near" />
      <div className="bz-frost" />
      <div className="bz-flash" />
    </div>
  );
}

// ============================================================================
// PRESENTE ABERTO — caixa que cai, treme, a tampa voa e explode em confete
// ============================================================================

const CONFETTI = range(46).map((i) => {
  const a = -Math.PI / 2 + (rand(i * 2.3 + 1) - 0.5) * Math.PI * 1.25;
  const d = 22 + rand(i * 4.1 + 2) * 30;
  return {
    '--tx': `${(Math.cos(a) * d).toFixed(1)}vmin`,
    '--ty': `${(Math.sin(a) * d).toFixed(1)}vmin`,
    '--r': `${Math.round((rand(i * 7.7) - 0.5) * 1440)}deg`,
    '--c': ['#facc15', '#ef4444', '#22c55e', '#ffffff', '#f472b6', '#38bdf8'][i % 6],
    '--w': `${6 + Math.round(rand(i * 1.9) * 7)}px`,
    '--h': `${10 + Math.round(rand(i * 3.3) * 10)}px`,
    '--dl': `calc(var(--nx-dur) * ${(rand(i * 5.1) * 0.06).toFixed(3)})`,
    '--br': i % 3 === 0 ? '50%' : '2px',
  } as CSSVars;
});

function GiftScene() {
  return (
    <div className="sc sc-gf">
      <div className="gf-bg" />
      <div className="gf-rays" />
      <div className="gf-drop">
        <div className="gf-shake">
          <svg className="gf-box" viewBox="0 0 120 120" aria-hidden>
            <defs>
              <linearGradient id="gfRed" x1="0" y1="0" x2="1" y2="1">
                <stop offset="0" stopColor="#f87171" />
                <stop offset="1" stopColor="#991b1b" />
              </linearGradient>
              <linearGradient id="gfGold" x1="0" y1="0" x2="1" y2="0">
                <stop offset="0" stopColor="#fde68a" />
                <stop offset="0.5" stopColor="#facc15" />
                <stop offset="1" stopColor="#ca8a04" />
              </linearGradient>
            </defs>
            <rect x="16" y="52" width="88" height="62" rx="6" fill="url(#gfRed)" stroke="#450a0a" strokeWidth="2.5" />
            <rect x="16" y="52" width="88" height="10" fill="#7f1d1d" opacity="0.45" />
            <rect x="52" y="52" width="16" height="62" fill="url(#gfGold)" stroke="#713f12" strokeWidth="2" />
            <path d="M24 60 Q 30 80 24 104" stroke="#fecaca" strokeOpacity="0.5" strokeWidth="3" fill="none" strokeLinecap="round" />
          </svg>
          <svg className="gf-lid" viewBox="0 0 120 120" aria-hidden>
            <path d="M58 40 C 40 18, 22 26, 34 38 C 40 44, 52 42, 58 40 Z" fill="url(#gfGold)" stroke="#713f12" strokeWidth="2" />
            <path d="M62 40 C 80 18, 98 26, 86 38 C 80 44, 68 42, 62 40 Z" fill="url(#gfGold)" stroke="#713f12" strokeWidth="2" />
            <rect x="10" y="38" width="100" height="18" rx="5" fill="url(#gfRed)" stroke="#450a0a" strokeWidth="2.5" />
            <rect x="52" y="38" width="16" height="18" fill="url(#gfGold)" stroke="#713f12" strokeWidth="2" />
            <circle cx="60" cy="39" r="6" fill="#facc15" stroke="#713f12" strokeWidth="2" />
          </svg>
        </div>
      </div>
      <div className="gf-burst" />
      <div className="gf-confetti">
        {CONFETTI.map((style, i) => (
          <span key={i} style={style} />
        ))}
      </div>
    </div>
  );
}

// ============================================================================
// DECRETO IMPERIAL — coroa desce, pergaminho se desenrola, selo de cera bate
// ============================================================================

function DecreeScene() {
  return (
    <div className="sc sc-dc">
      <div className="dc-bg" />
      <div className="dc-halo" />
      <svg className="dc-crown" viewBox="0 0 100 70" aria-hidden>
        <defs>
          <linearGradient id="dcGold" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor="#fef3c7" />
            <stop offset="0.45" stopColor="#facc15" />
            <stop offset="1" stopColor="#a16207" />
          </linearGradient>
        </defs>
        <path d="M10 58 L6 18 L28 36 L50 6 L72 36 L94 18 L90 58 Z" fill="url(#dcGold)" stroke="#713f12" strokeWidth="2.4" strokeLinejoin="round" />
        <rect x="9" y="54" width="82" height="11" rx="3" fill="url(#dcGold)" stroke="#713f12" strokeWidth="2.4" />
        <circle cx="50" cy="40" r="5.5" fill="#a855f7" stroke="#3b0764" strokeWidth="1.6" />
        <circle cx="30" cy="46" r="3.6" fill="#ef4444" stroke="#450a0a" strokeWidth="1.4" />
        <circle cx="70" cy="46" r="3.6" fill="#22c55e" stroke="#052e16" strokeWidth="1.4" />
        {[6, 50, 94].map((x, i) => (
          <circle key={i} cx={x} cy={[18, 6, 18][i]} r="3.6" fill="#fef9c3" stroke="#713f12" strokeWidth="1.4" />
        ))}
        <path d="M18 24 L24 50" stroke="#fffbeb" strokeOpacity="0.6" strokeWidth="2" strokeLinecap="round" />
      </svg>
      <div className="dc-scroll">
        <div className="dc-paper">
          <svg viewBox="0 0 200 60" preserveAspectRatio="none" aria-hidden>
            {range(4).map((i) => (
              <rect key={i} x={40} y={14 + i * 9} width={i === 3 ? 70 : 120} height="3" rx="1.5" fill="#92400e" opacity="0.35" />
            ))}
          </svg>
        </div>
        <div className="dc-roll dc-roll-l" />
        <div className="dc-roll dc-roll-r" />
      </div>
      <div className="dc-seal">
        <svg viewBox="-30 -30 60 60" aria-hidden>
          <path
            d={
              range(16)
                .map((i) => {
                  const a = (i / 16) * Math.PI * 2;
                  const r = i % 2 ? 23 : 26;
                  return `${i ? 'L' : 'M'}${(Math.cos(a) * r).toFixed(2)} ${(Math.sin(a) * r).toFixed(2)}`;
                })
                .join(' ') + ' Z'
            }
            fill="#b91c1c"
            stroke="#450a0a"
            strokeWidth="1.6"
          />
          <circle r="16" fill="none" stroke="#7f1d1d" strokeWidth="2" />
          <path d="M-9 5 L-10 -7 L-4 -2 L0 -10 L4 -2 L10 -7 L9 5 Z" fill="#fca5a5" stroke="#7f1d1d" strokeWidth="1.2" strokeLinejoin="round" />
          <ellipse cx="-9" cy="-12" rx="6" ry="3" fill="#ffffff" opacity="0.25" transform="rotate(-30)" />
        </svg>
      </div>
      <div className="dc-ring" />
      <div className="dc-dust">
        <Bokeh count={30} colors={['#fde68a', '#facc15', '#fffbeb']} seed={53} mode="burst" />
      </div>
    </div>
  );
}

// ============================================================================
// CHUVA DE ESTRELAS — céu estrelado, cometas na diagonal e a estrela cadente
// que cai no centro e floresce em luz
// ============================================================================

const METEORS = range(9).map((i) => ({
  '--x': `${(10 + rand(i * 3.7) * 90).toFixed(1)}%`,
  '--y': `${(-5 + rand(i * 6.1) * 35).toFixed(1)}%`,
  '--dl': `calc(var(--nx-dur) * ${(0.04 + rand(i * 2.9) * 0.36).toFixed(3)})`,
  '--sc': (0.55 + rand(i * 8.3) * 0.65).toFixed(2),
}) as CSSVars);

function StarShowerScene() {
  return (
    <div className="sc sc-ss">
      <div className="ss-bg" />
      <StarField className="ss-field ss-field-a" seed={5} count={160} colors={['#ffffff', '#c7d2fe', '#e0e7ff']} />
      <StarField className="ss-field ss-field-b" seed={41} count={40} colors={['#fef9c3', '#ffffff', '#a5f3fc']} />
      {METEORS.map((style, i) => (
        <span key={i} className="ss-meteor" style={style}>
          <i />
        </span>
      ))}
      <div className="ss-hero">
        <span className="ss-meteor ss-meteor-hero">
          <i />
        </span>
      </div>
      <svg className="ss-star" viewBox="-50 -50 100 100" aria-hidden>
        <defs>
          <radialGradient id="ssStar">
            <stop offset="0" stopColor="#ffffff" />
            <stop offset="0.6" stopColor="#fef08a" />
            <stop offset="1" stopColor="#facc15" />
          </radialGradient>
        </defs>
        <path
          d={
            range(10)
              .map((i) => {
                const a = -Math.PI / 2 + (i / 10) * Math.PI * 2;
                const r = i % 2 ? 17 : 40;
                return `${i ? 'L' : 'M'}${(Math.cos(a) * r).toFixed(2)} ${(Math.sin(a) * r).toFixed(2)}`;
              })
              .join(' ') + ' Z'
          }
          fill="url(#ssStar)"
          stroke="#fff"
          strokeWidth="2"
          strokeLinejoin="round"
        />
      </svg>
      <div className="ss-bloom" />
      <div className="ss-sparks">
        <Bokeh count={28} colors={['#fef9c3', '#ffffff', '#a5f3fc', '#c4b5fd']} seed={91} mode="burst" />
      </div>
    </div>
  );
}

// ============================================================================
// ECLIPSE — a lua cobre o sol, a coroa acende, anel de diamante e a luz volta
// ============================================================================

function EclipseScene() {
  return (
    <div className="sc sc-ec">
      <div className="ec-bg" />
      <StarField className="ec-stars" seed={23} count={110} colors={['#ffffff', '#fde68a', '#e5e7eb']} />
      <div className="ec-stage">
        <div className="ec-corona ec-corona-a" />
        <div className="ec-corona ec-corona-b" />
        <div className="ec-sun" />
        <div className="ec-moon" />
        <div className="ec-diamond">
          <span />
        </div>
      </div>
      <div className="ec-wave" />
      <div className="ec-flash" />
    </div>
  );
}

// ============================================================================
// CONTO DE FADAS — uma fada traça uma espiral de brilho, o castelo surge e
// tudo floresce em pétalas e luz
// ============================================================================

const FAIRY_TRAIL = range(16);

function FairyScene() {
  return (
    <div className="sc sc-ft">
      <div className="ft-bg" />
      <StarField className="ft-mist" seed={71} count={90} colors={['#ffffff', '#fbcfe8', '#fde68a']} />
      <svg className="ft-castle" viewBox="0 0 300 120" preserveAspectRatio="xMidYMax meet" aria-hidden>
        <defs>
          <linearGradient id="ftCastle" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor="#f5d0fe" />
            <stop offset="1" stopColor="#a78bfa" />
          </linearGradient>
        </defs>
        <g fill="url(#ftCastle)" stroke="#6d28d9" strokeOpacity="0.35" strokeWidth="1.2">
          <path d="M60 120 V70 H80 V120 Z M220 120 V70 H240 V120 Z" />
          <path d="M55 72 L70 42 L85 72 Z M215 72 L230 42 L245 72 Z" />
          <path d="M95 120 V58 H125 V120 Z M175 120 V58 H205 V120 Z" />
          <path d="M90 60 L110 22 L130 60 Z M170 60 L190 22 L210 60 Z" />
          <path d="M125 120 V46 H175 V120 Z" />
          <path d="M120 48 L150 0 L180 48 Z" />
          <path d="M40 120 H260 V100 H40 Z" />
        </g>
        <g fill="#fef9c3">
          <path d="M143 120 V96 A7 7 0 0 1 157 96 V120 Z" opacity="0.9" />
          <circle cx="150" cy="64" r="4" />
          <rect x="106" y="74" width="8" height="12" rx="4" />
          <rect x="186" y="74" width="8" height="12" rx="4" />
        </g>
        <path d="M150 0 V-12 L160 -8 L150 -4" fill="#f472b6" stroke="#be185d" strokeWidth="1" />
      </svg>
      <div className="ft-orbit">
        {FAIRY_TRAIL.map((i) => (
          <span key={i} className="ft-dust" style={{ '--i': i } as CSSVars} />
        ))}
        <span className="ft-fairy" />
      </div>
      <div className="ft-bloom" />
      <div className="ft-petals">
        <Bokeh count={30} colors={['#f9a8d4', '#f0abfc', '#fde68a', '#ffffff']} seed={67} mode="burst" />
      </div>
    </div>
  );
}

// ============================================================================
// BOOT GLITCH — CRT liga, linhas de boot, fatias com aberração RGB e o
// sinal que estabiliza
// ============================================================================

const BOOT_LINES = [
  'INSIGHT//OS v5.0 ── iniciando núcleo',
  'montando /perfil ............ ok',
  'carregando cosméticos ....... ok',
  'sincronizando sinal ......... 98%',
  'acesso concedido ▌',
];

const SLICES = range(7).map((i) => ({
  '--top': `${(8 + rand(i * 4.4) * 80).toFixed(1)}%`,
  '--hh': `${(2 + rand(i * 2.2) * 9).toFixed(1)}%`,
  '--sx': `${((rand(i * 6.6) - 0.5) * 18).toFixed(1)}%`,
  '--dl': `calc(var(--nx-dur) * ${(0.3 + rand(i * 9.9) * 0.3).toFixed(3)})`,
}) as CSSVars);

function GlitchScene() {
  return (
    <div className="sc sc-gl">
      <div className="gl-bg" />
      <div className="gl-crt">
        <div className="gl-boot">
          {BOOT_LINES.map((l, i) => (
            <p key={i} style={{ '--i': i } as CSSVars}>
              {l}
            </p>
          ))}
        </div>
        <div className="gl-logo">
          <span className="gl-logo-r">INSIGHT</span>
          <span className="gl-logo-c">INSIGHT</span>
          <span className="gl-logo-w">INSIGHT</span>
        </div>
        {SLICES.map((style, i) => (
          <span key={i} className="gl-slice" style={style} />
        ))}
        <div className="gl-scan" />
      </div>
      <div className="gl-off" />
    </div>
  );
}

// ============================================================================
// ASCENSÃO SAFIRA (Nível 4) — estilhaços convergem e lapidam uma safira,
// brilho percorre as facetas, raios e onda de choque com grade técnica
// ============================================================================

const SHARDS = range(14).map((i) => {
  const a = (i / 14) * Math.PI * 2 + rand(i) * 0.4;
  const d = 55 + rand(i * 3.3) * 25;
  return {
    '--sx': `${(Math.cos(a) * d).toFixed(1)}vmin`,
    '--sy': `${(Math.sin(a) * d).toFixed(1)}vmin`,
    '--sr': `${Math.round((rand(i * 7.7) - 0.5) * 540)}deg`,
    '--dl': `calc(var(--nx-dur) * ${(rand(i * 5.1) * 0.12).toFixed(3)})`,
  } as CSSVars;
});

function SapphireGem() {
  // facetas de uma lapidação brilhante vista de cima
  const facets = range(8).map((i) => {
    const a0 = (i / 8) * Math.PI * 2 - Math.PI / 2;
    const a1 = ((i + 1) / 8) * Math.PI * 2 - Math.PI / 2;
    const P = (a: number, r: number) => `${(Math.cos(a) * r).toFixed(2)},${(Math.sin(a) * r).toFixed(2)}`;
    return { outer: `${P(a0, 46)} ${P(a1, 46)} ${P((a0 + a1) / 2, 28)}`, inner: `0,0 ${P(a0, 22)} ${P((a0 + a1) / 2, 28)} ${P(a1, 22)}`, i };
  });
  return (
    <svg viewBox="-50 -50 100 100" className="sa-gem-svg" aria-hidden>
      <defs>
        <linearGradient id="saG1" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#bae6fd" />
          <stop offset="0.5" stopColor="#2563eb" />
          <stop offset="1" stopColor="#1e1b4b" />
        </linearGradient>
        <linearGradient id="saG2" x1="1" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#e0f2fe" />
          <stop offset="1" stopColor="#1d4ed8" />
        </linearGradient>
        <clipPath id="saClip">
          <polygon points={range(8).map((i) => { const a = (i / 8) * Math.PI * 2 - Math.PI / 2; return `${(Math.cos(a) * 46).toFixed(2)},${(Math.sin(a) * 46).toFixed(2)}`; }).join(' ')} />
        </clipPath>
      </defs>
      <g stroke="#e0f2fe" strokeOpacity="0.55" strokeWidth="0.6" strokeLinejoin="round">
        {facets.map((f) => (
          <g key={f.i}>
            <polygon points={f.outer} fill={f.i % 2 ? 'url(#saG1)' : 'url(#saG2)'} />
            <polygon points={f.inner} fill={f.i % 2 ? '#1e40af' : '#3b82f6'} fillOpacity="0.9" />
          </g>
        ))}
        <polygon points={range(8).map((i) => { const a = (i / 8) * Math.PI * 2 - Math.PI / 2 + Math.PI / 8; return `${(Math.cos(a) * 14).toFixed(2)},${(Math.sin(a) * 14).toFixed(2)}`; }).join(' ')} fill="#60a5fa" />
      </g>
      {/* faixa de brilho percorrendo as facetas */}
      <g clipPath="url(#saClip)">
        <rect className="sa-glint" x="-70" y="-60" width="18" height="120" fill="#ffffff" opacity="0.75" transform="rotate(25)" />
      </g>
      <path d="M-30 -30 L -18 -36" stroke="#fff" strokeWidth="2" strokeLinecap="round" opacity="0.8" />
    </svg>
  );
}

function SapphireScene() {
  return (
    <div className="sc sc-sa">
      <div className="sa-bg" />
      <svg className="sa-grid" viewBox="0 0 200 200" preserveAspectRatio="xMidYMid slice" aria-hidden>
        <defs>
          <pattern id="saHex" width="12" height="10.4" patternUnits="userSpaceOnUse" patternTransform="scale(1.4)">
            <path d="M3 0 H9 L12 5.2 L9 10.4 H3 L0 5.2 Z" fill="none" stroke="#38bdf8" strokeWidth="0.35" />
          </pattern>
          <radialGradient id="saFade">
            <stop offset="0" stopColor="#fff" stopOpacity="1" />
            <stop offset="1" stopColor="#fff" stopOpacity="0" />
          </radialGradient>
          <mask id="saMask">
            <rect width="200" height="200" fill="url(#saFade)" />
          </mask>
        </defs>
        <rect width="200" height="200" fill="url(#saHex)" mask="url(#saMask)" />
      </svg>
      <div className="sa-shards">
        {SHARDS.map((st, i) => (
          <span key={i} style={st}>
            <svg viewBox="0 0 20 30" aria-hidden>
              <polygon points="10,0 20,12 12,30 0,14" fill={i % 2 ? '#60a5fa' : '#bae6fd'} stroke="#e0f2fe" strokeWidth="0.8" />
            </svg>
          </span>
        ))}
      </div>
      <div className="sa-gem">
        <SapphireGem />
      </div>
      <svg className="sa-arcs" viewBox="-100 -100 200 200" aria-hidden>
        {range(5).map((i) => {
          const a = (i / 5) * Math.PI * 2 + 0.4;
          let d = `M${(Math.cos(a) * 26).toFixed(1)} ${(Math.sin(a) * 26).toFixed(1)}`;
          for (let k = 1; k <= 6; k++) {
            const r = 26 + k * 10;
            const j = (rand(i * 11 + k) - 0.5) * 0.35;
            d += ` L${(Math.cos(a + j) * r).toFixed(1)} ${(Math.sin(a + j) * r).toFixed(1)}`;
          }
          return <path key={i} d={d} className="sa-arc" style={{ animationDelay: `calc(var(--nx-dur) * ${(0.42 + i * 0.03).toFixed(2)})` }} />;
        })}
      </svg>
      <div className="sa-wave" />
      <div className="sa-sparks">
        <Bokeh count={30} colors={['#e0f2fe', '#7dd3fc', '#ffffff', '#93c5fd']} seed={404} mode="burst" />
      </div>
      <div className="sa-flash" />
    </div>
  );
}

// ============================================================================
// SINGULARIDADE PRISMÁTICA (Nível 5) — estrelas sugadas, disco de acreção em
// espectro, lente gravitacional, colapso e explosão prismática
// ============================================================================

function SingularityScene() {
  return (
    <div className="sc sc-sg">
      <div className="sg-bg" />
      <StarField className="sg-stars" seed={505} count={160} colors={['#ffffff', '#c7d2fe', '#fde68a']} />
      <div className="sg-swirl">
        <Bokeh count={44} colors={['#ffffff', '#a5b4fc', '#f0abfc', '#67e8f9']} seed={77} mode="swirl-in" />
      </div>
      <div className="sg-core-wrap">
        <div className="sg-disk sg-disk-back" />
        <div className="sg-lens" />
        <div className="sg-hole" />
        <div className="sg-front-clip">
          <div className="sg-disk sg-disk-front" />
        </div>
      </div>
      <div className="sg-rays" />
      <div className="sg-ring" />
      <div className="sg-flash" />
    </div>
  );
}

// ============================================================================
// TRANSFORMAÇÃO (anime) — aura dourada sobe, raios estalam, pedras flutuam,
// a tela treme e explode em luz
// ============================================================================

const ROCKS = range(12).map((i) => ({
  '--x': `${(8 + rand(i * 2.7) * 84).toFixed(1)}%`,
  '--s': `${(1.2 + rand(i * 4.4) * 2.6).toFixed(2)}vmin`,
  '--dl': `calc(var(--nx-dur) * ${(0.1 + rand(i * 6.1) * 0.25).toFixed(3)})`,
  '--rr': `${Math.round((rand(i * 3.1) - 0.5) * 300)}deg`,
}) as CSSVars);

const AURA_FLAMES = range(22).map((i) => ({
  '--a': `${Math.round((i / 22) * 360)}deg`,
  '--h': `${(0.75 + rand(i * 5.5) * 0.6).toFixed(2)}`,
  '--dl': `calc(var(--nx-dur) * ${(rand(i * 2.2) * 0.12).toFixed(3)})`,
}) as CSSVars);

function PowerUpScene() {
  return (
    <div className="sc sc-pu">
      <div className="pu-bg" />
      <div className="pu-shake">
        <div className="pu-ground" />
        <div className="pu-rocks">
          {ROCKS.map((st, i) => (
            <span key={i} style={st} />
          ))}
        </div>
        <div className="pu-aura">
          {AURA_FLAMES.map((st, i) => (
            <span key={i} style={st} />
          ))}
          <div className="pu-core" />
        </div>
        <svg className="pu-bolts" viewBox="-100 -100 200 200" aria-hidden>
          {range(6).map((i) => {
            const a = (i / 6) * Math.PI * 2 + 0.3;
            let d = `M${(Math.cos(a) * 20).toFixed(1)} ${(Math.sin(a) * 20).toFixed(1)}`;
            for (let k = 1; k <= 5; k++) {
              const r = 20 + k * 11;
              const j = (rand(i * 13 + k) - 0.5) * 0.5;
              d += ` L${(Math.cos(a + j) * r).toFixed(1)} ${(Math.sin(a + j) * r).toFixed(1)}`;
            }
            return <path key={i} d={d} className="pu-bolt" style={{ animationDelay: `calc(var(--nx-dur) * ${(0.2 + i * 0.07).toFixed(2)})` }} />;
          })}
        </svg>
      </div>
      <div className="pu-sparks">
        <Bokeh count={34} colors={['#fef08a', '#fde047', '#ffffff', '#fb923c']} seed={9001} mode="burst" />
      </div>
      <div className="pu-flash" />
    </div>
  );
}

// ============================================================================
// RÉVEILLON — horizonte da cidade, contagem 3·2·1, rojões e estouros
// ============================================================================

const BURSTS = range(7).map((i) => ({
  '--x': `${(12 + rand(i * 3.9) * 76).toFixed(1)}%`,
  '--y': `${(14 + rand(i * 5.3) * 34).toFixed(1)}%`,
  '--c': ['#facc15', '#f472b6', '#22d3ee', '#a78bfa', '#4ade80', '#fb923c', '#ffffff'][i],
  '--dl': `calc(var(--nx-dur) * ${(0.42 + (i % 4) * 0.08 + rand(i) * 0.04).toFixed(3)})`,
  '--sz': `${(22 + rand(i * 2.1) * 16).toFixed(1)}vmin`,
}) as CSSVars);

function ReveillonScene() {
  return (
    <div className="sc sc-rv">
      <div className="rv-bg" />
      <StarField className="rv-stars" seed={2027} count={90} colors={['#ffffff', '#fde68a']} />
      <div className="rv-count">
        {['3', '2', '1'].map((n, i) => (
          <span key={n} style={{ '--i': i } as CSSVars}>
            {n}
          </span>
        ))}
      </div>
      {BURSTS.map((st, i) => (
        <div key={i} className="rv-burst" style={st}>
          <svg viewBox="-50 -50 100 100" aria-hidden>
            {range(24).map((k) => {
              const a = (k / 24) * Math.PI * 2;
              return (
                <g key={k} transform={`rotate(${(a * 180) / Math.PI})`}>
                  <line x1="10" y1="0" x2="40" y2="0" stroke="var(--c)" strokeWidth="1.2" strokeLinecap="round" opacity="0.55" />
                  <circle cx="44" cy="0" r="2.2" fill="var(--c)" />
                </g>
              );
            })}
            <circle r="7" fill="#fff" opacity="0.8" />
          </svg>
        </div>
      ))}
      <svg className="rv-city" viewBox="0 0 400 100" preserveAspectRatio="xMidYMax slice" aria-hidden>
        <defs>
          <linearGradient id="rvCity" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor="#1e1b4b" />
            <stop offset="1" stopColor="#020617" />
          </linearGradient>
        </defs>
        <path
          d="M0 100 V70 H18 V52 H34 V64 H46 V40 H58 V30 H62 V40 H74 V60 H92 V48 H112 V66 H128 V36 H144 V58 H160 V44 H176 V62 H196 V28 H204 V18 H208 V28 H216 V56 H236 V46 H254 V64 H270 V38 H288 V60 H306 V50 H324 V68 H340 V42 H356 V62 H372 V54 H400 V100 Z"
          fill="url(#rvCity)"
        />
        {range(40).map((i) => (
          <rect key={i} x={10 + rand(i * 3.3) * 380} y={45 + rand(i * 7.1) * 45} width="2.4" height="3" fill="#fde68a" opacity={0.35 + rand(i) * 0.5} />
        ))}
      </svg>
      <div className="rv-hello">Feliz Ano Novo!</div>
      <div className="rv-flash" />
    </div>
  );
}

// ============================================================================
// HALLOWEEN — lua cheia, névoa, revoada de morcegos, abóbora que acende
// ============================================================================

const BATS = range(9).map((i) => ({
  '--y': `${(10 + rand(i * 4.1) * 45).toFixed(1)}%`,
  '--s': `${(0.6 + rand(i * 2.3) * 0.9).toFixed(2)}`,
  '--dl': `calc(var(--nx-dur) * ${(rand(i * 6.6) * 0.3).toFixed(3)})`,
}) as CSSVars);

function HalloweenScene() {
  return (
    <div className="sc sc-hw">
      <div className="hw-bg" />
      <StarField className="hw-stars" seed={1031} count={70} colors={['#e9d5ff', '#ffffff']} />
      <div className="hw-moon" />
      <img className="hw-fog hw-fog-a" src={`${TEX}/smoke-a.webp`} alt="" />
      <img className="hw-fog hw-fog-b" src={`${TEX}/smoke-b.webp`} alt="" />
      {BATS.map((st, i) => (
        <div key={i} className="hw-bat" style={st}>
          <svg viewBox="-12 -6 24 12" aria-hidden>
            <g className="hw-wings">
              <path d="M0 0 C -2 -2, -6 -4, -11 -1 C -9 0, -8 1.6, -8.4 3 C -6 2, -4 2.4, -2.6 3.8 C -1.4 2.6, 1.4 2.6, 2.6 3.8 C 4 2.4, 6 2, 8.4 3 C 8 1.6, 9 0, 11 -1 C 6 -4, 2 -2, 0 0 Z" fill="#12091f" />
            </g>
            <circle cx="-0.9" cy="0.4" r="0.45" fill="#fde047" />
            <circle cx="0.9" cy="0.4" r="0.45" fill="#fde047" />
          </svg>
        </div>
      ))}
      <div className="hw-pumpkin">
        <svg viewBox="-30 -30 60 60" aria-hidden>
          <defs>
            <radialGradient id="hwP" cx="0.4" cy="0.35" r="0.8">
              <stop offset="0" stopColor="#fdba74" />
              <stop offset="0.6" stopColor="#ea580c" />
              <stop offset="1" stopColor="#7c2d12" />
            </radialGradient>
            <radialGradient id="hwL" cx="0.5" cy="0.6" r="0.6">
              <stop offset="0" stopColor="#fffbeb" />
              <stop offset="0.5" stopColor="#fde047" />
              <stop offset="1" stopColor="#f59e0b" />
            </radialGradient>
          </defs>
          <path d="M-2 -20 C -2 -25, 3 -27, 6 -25" fill="none" stroke="#365314" strokeWidth="3" strokeLinecap="round" />
          <ellipse cx="-11" cy="0" rx="13" ry="18" fill="url(#hwP)" />
          <ellipse cx="11" cy="0" rx="13" ry="18" fill="url(#hwP)" />
          <ellipse cx="0" cy="0" rx="14" ry="19" fill="url(#hwP)" />
          <g className="hw-face">
            <path d="M-13 -5 L -5 -11 L -3 -2 Z M13 -5 L 5 -11 L 3 -2 Z" fill="url(#hwL)" />
            <path d="M-15 5 C -8 16, 8 16, 15 5 L 10 8 L 7 5 L 3.5 9 L 0 5.5 L -3.5 9 L -7 5 L -10 8 Z" fill="url(#hwL)" />
          </g>
        </svg>
      </div>
      <div className="hw-glow" />
      <div className="hw-flash" />
    </div>
  );
}
