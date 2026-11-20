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
