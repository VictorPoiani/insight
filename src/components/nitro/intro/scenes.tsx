'use client';

import type { CSSProperties } from 'react';
import type { IntroSceneId } from '@/lib/nitro/catalog';
import './intro.css';

/**
 * Cenas cinematográficas das aberturas de perfil.
 * Roteiro em fases (sinal → impacto → revelação → acomodação), coordenado por
 * porcentagens da duração total (--nx-dur). Só transform/opacity/clip-path.
 */

type CSSVars = CSSProperties & Record<`--${string}`, string | number>;

function rand(seed: number) {
  const x = Math.sin(seed * 12.9898 + 78.233) * 43758.5453;
  return x - Math.floor(x);
}

function range(n: number) {
  return Array.from({ length: n }, (_, i) => i);
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
      return <AnimeCutScene />;
    case 'hyperspace':
      return <HyperspaceScene />;
  }
}

// ============================================================================
// MONSTRO À ESPREITA
// ============================================================================

const SHARD_POINTS: [number, number][] = [
  [0, 0], [50, 0], [100, 0], [100, 50], [100, 100], [50, 100], [0, 100], [0, 50],
];

function MonsterScene() {
  const cx = 50;
  const cy = 45;
  return (
    <div className="sc sc-monster">
      <div className="sc-shake">
        {SHARD_POINTS.map((p, i) => {
          const q = SHARD_POINTS[(i + 1) % SHARD_POINTS.length];
          const mx = (p[0] + q[0]) / 2 - cx;
          const my = (p[1] + q[1]) / 2 - cy;
          const len = Math.hypot(mx, my) || 1;
          const style: CSSVars = {
            clipPath: `polygon(${cx}% ${cy}%, ${p[0]}% ${p[1]}%, ${q[0]}% ${q[1]}%)`,
            '--tx': `${((mx / len) * 70).toFixed(1)}vw`,
            '--ty': `${((my / len) * 70).toFixed(1)}vh`,
            '--rot': `${(rand(i + 1) - 0.5) * 50}deg`,
          };
          return <div key={i} className="mo-shard" style={style} />;
        })}

        <div className="mo-fog mo-fog-a" />
        <div className="mo-fog mo-fog-b" />

        {[
          { l: 12, t: 18, d: 0.15, s: 0.8 },
          { l: 78, t: 14, d: 0.35, s: 0.6 },
          { l: 86, t: 62, d: 0.55, s: 0.9 },
          { l: 8, t: 70, d: 0.7, s: 0.7 },
          { l: 60, t: 82, d: 0.25, s: 0.5 },
        ].map((e, i) => (
          <div
            key={i}
            className="mo-eyes"
            style={{ left: `${e.l}%`, top: `${e.t}%`, animationDelay: `${e.d}s`, '--s': e.s } as CSSVars}
          >
            <i />
            <i />
          </div>
        ))}

        <div className="mo-big">
          <i />
          <i />
        </div>

        <svg className="mo-jaw mo-jaw-top" viewBox="0 0 100 50" preserveAspectRatio="none">
          <rect x="0" y="0" width="100" height="40" fill="#07070c" />
          <rect x="0" y="35" width="100" height="6" fill="#4c0519" />
          {range(12).map((i) => (
            <path key={i} d={`M${i * 8.33} 40 L ${i * 8.33 + 4.16} ${i % 2 ? 49 : 47} L ${i * 8.33 + 8.33} 40 Z`} fill="#f1f5f9" />
          ))}
        </svg>
        <svg className="mo-jaw mo-jaw-bot" viewBox="0 0 100 50" preserveAspectRatio="none">
          <rect x="0" y="10" width="100" height="40" fill="#07070c" />
          <rect x="0" y="9" width="100" height="6" fill="#4c0519" />
          {range(12).map((i) => (
            <path key={i} d={`M${i * 8.33 + 4} 10 L ${i * 8.33 + 8.16} ${i % 2 ? 2 : 4} L ${i * 8.33 + 12.33} 10 Z`} fill="#e2e8f0" />
          ))}
        </svg>
      </div>
    </div>
  );
}

// ============================================================================
// GARRA DE ONÇA
// ============================================================================

const SLASH_TOP = [44, 58, 72];
const SLASH_BOT = [24, 38, 52];

function JaguarScene() {
  const pieces = [
    `0% 0%, ${SLASH_TOP[0]}% 0%, ${SLASH_BOT[0]}% 100%, 0% 100%`,
    `${SLASH_TOP[0]}% 0%, ${SLASH_TOP[1]}% 0%, ${SLASH_BOT[1]}% 100%, ${SLASH_BOT[0]}% 100%`,
    `${SLASH_TOP[1]}% 0%, ${SLASH_TOP[2]}% 0%, ${SLASH_BOT[2]}% 100%, ${SLASH_BOT[1]}% 100%`,
    `${SLASH_TOP[2]}% 0%, 100% 0%, 100% 100%, ${SLASH_BOT[2]}% 100%`,
  ];
  const moves = [
    ['-45vw', '-10vh', '-6deg'],
    ['-14vw', '6vh', '4deg'],
    ['14vw', '-6vh', '-4deg'],
    ['45vw', '10vh', '6deg'],
  ];
  return (
    <div className="sc sc-jaguar">
      <div className="sc-shake">
        {pieces.map((poly, i) => (
          <div
            key={i}
            className="ja-piece"
            style={{ clipPath: `polygon(${poly})`, '--tx': moves[i][0], '--ty': moves[i][1], '--rot': moves[i][2] } as CSSVars}
          />
        ))}

        <div className="ja-eyes">
          <i />
          <i />
        </div>

        <svg className="ja-slashes" viewBox="0 0 100 100" preserveAspectRatio="none">
          {SLASH_TOP.map((t, i) => {
            const d = `M ${t + 3} -4 Q ${(t + SLASH_BOT[i]) / 2 + 4} 50 ${SLASH_BOT[i] - 3} 104`;
            return (
              <g key={i} style={{ '--i': i } as CSSVars}>
                <path className="ja-slash ja-slash-glow" d={d} pathLength={100} />
                <path className="ja-slash ja-slash-core" d={d} pathLength={100} />
              </g>
            );
          })}
        </svg>

        {range(16).map((i) => (
          <span
            key={i}
            className="ja-leaf"
            style={{
              left: `${Math.round(rand(i + 3) * 100)}%`,
              animationDelay: `calc(var(--nx-dur) * ${0.5 + rand(i + 9) * 0.2})`,
              '--dx': `${Math.round((rand(i + 5) - 0.5) * 30)}vw`,
              '--r': `${Math.round(rand(i + 7) * 540)}deg`,
              background: ['#15803d', '#65a30d', '#166534', '#a16207'][i % 4],
            } as CSSVars}
          />
        ))}
      </div>
    </div>
  );
}

// ============================================================================
// TEMPESTADE
// ============================================================================

function StormScene() {
  return (
    <div className="sc sc-storm">
      <div className="st-sky" />
      <div className="st-cloud st-cloud-a" />
      <div className="st-cloud st-cloud-b" />
      <div className="st-cloud st-cloud-c" />
      <div className="st-rain">
        {range(80).map((i) => (
          <span
            key={i}
            style={{
              left: `${(rand(i + 1) * 115 - 10).toFixed(1)}%`,
              animationDelay: `${(-rand(i + 4) * 0.8).toFixed(2)}s`,
              animationDuration: `${(0.45 + rand(i + 8) * 0.3).toFixed(2)}s`,
              opacity: 0.35 + rand(i + 2) * 0.5,
            }}
          />
        ))}
      </div>
      <svg className="st-bolt st-bolt-a" viewBox="0 0 100 100" preserveAspectRatio="none">
        <path d="M58 0 L 50 22 L 56 23 L 44 48 L 51 49 L 38 78" pathLength={100} />
      </svg>
      <svg className="st-bolt st-bolt-b" viewBox="0 0 100 100" preserveAspectRatio="none">
        <path d="M22 0 L 28 18 L 23 19 L 32 40 L 27 41 L 36 62" pathLength={100} />
      </svg>
      <div className="st-flash" />
    </div>
  );
}

// ============================================================================
// TSUNAMI UKIYO-E (xilogravura japonesa)
// ============================================================================

const FOAM_CLAWS = range(16).map((i) => {
  // ao longo da crista (aprox.) — viewBox 0 0 1000 700
  const t = i / 15;
  const x = 360 + t * 300;
  const y = 120 + Math.sin(t * Math.PI) * -60 + t * 40;
  const s = 10 + rand(i + 2) * 10;
  return `M${x} ${y} q ${-s * 0.4} ${-s} ${s * 0.6} ${-s * 1.1} q ${-s * 0.3} ${s * 0.45} ${s * 0.25} ${s * 0.75}`;
});

function TsunamiScene() {
  return (
    <div className="sc sc-tsunami">
      <div className="ts-paper" />
      <div className="ts-sun" />
      <svg className="ts-fuji" viewBox="0 0 200 100">
        <path d="M0 100 L 80 18 Q 100 6 120 18 L 200 100 Z" fill="#3b6e8f" stroke="#10213a" strokeWidth="2" />
        <path d="M80 18 Q 100 6 120 18 L 132 30 L 118 26 L 108 34 L 98 25 L 86 33 L 70 28 Z" fill="#f7f3e8" stroke="#10213a" strokeWidth="1.5" />
      </svg>
      <div className="ts-seigaiha" />

      <svg className="ts-wave ts-wave-back" viewBox="0 0 1000 700" preserveAspectRatio="none">
        <path d="M0 700 L 0 420 C 120 380, 220 330, 320 360 C 420 390, 520 430, 640 420 C 780 410, 900 470, 1000 520 L 1000 700 Z" fill="#3b6e8f" stroke="#10213a" strokeWidth="4" />
      </svg>

      <svg className="ts-wave ts-wave-main" viewBox="0 0 1000 700" preserveAspectRatio="none">
        <path
          d="M0 700 L 0 260 C 90 190, 220 110, 380 80 C 520 55, 640 80, 690 160 C 720 210, 700 260, 650 262 C 690 220, 650 165, 590 172 C 520 180, 500 250, 545 300 C 610 370, 760 360, 860 420 C 930 460, 980 560, 1000 700 Z"
          fill="#1e3a5f"
          stroke="#10213a"
          strokeWidth="6"
        />
        {[0, 1, 2, 3, 4].map((i) => (
          <path
            key={i}
            d={`M${40 + i * 30} 700 C ${30 + i * 25} ${520 - i * 40}, ${120 + i * 40} ${330 - i * 35}, ${300 + i * 40} ${230 - i * 25}`}
            fill="none"
            stroke={i % 2 ? '#9ec5d6' : '#3b6e8f'}
            strokeWidth={i % 2 ? 5 : 9}
            strokeLinecap="round"
          />
        ))}
        <path d="M380 80 C 520 55, 640 80, 690 160 C 720 210, 700 260, 650 262" fill="none" stroke="#f7f3e8" strokeWidth="14" strokeLinecap="round" />
        {FOAM_CLAWS.map((d, i) => (
          <path key={i} d={d} fill="#f7f3e8" stroke="#10213a" strokeWidth="2.5" strokeLinejoin="round" />
        ))}
      </svg>

      {range(26).map((i) => (
        <span
          key={i}
          className="ts-spray"
          style={{
            left: `${35 + rand(i + 1) * 40}%`,
            top: `${12 + rand(i + 6) * 30}%`,
            '--tx': `${Math.round((rand(i + 3) - 0.2) * 30)}vw`,
            '--ty': `${Math.round(-rand(i + 4) * 18)}vh`,
            '--sz': `${4 + Math.round(rand(i + 5) * 10)}px`,
            animationDelay: `calc(var(--nx-dur) * ${0.48 + rand(i + 9) * 0.12})`,
          } as CSSVars}
        />
      ))}
    </div>
  );
}

// ============================================================================
// PORTAL INFERNAL (refeito)
// ============================================================================

function PortalScene() {
  return (
    <div className="sc sc-portal">
      <div className="sc-shake">
        <div className="po-dark" />
        <svg className="po-cracks" viewBox="0 0 100 100" preserveAspectRatio="none">
          {range(9).map((i) => {
            const a = (i / 9) * Math.PI * 2 + rand(i) * 0.4;
            let d = 'M50 32';
            let x = 50;
            let y = 32;
            for (let k = 1; k <= 5; k++) {
              const r = k * 11;
              const jitter = (rand(i * 7 + k) - 0.5) * 0.5;
              x = 50 + Math.cos(a + jitter) * r * 1.2;
              y = 32 + Math.sin(a + jitter) * r;
              d += ` L ${x.toFixed(1)} ${y.toFixed(1)}`;
            }
            return <path key={i} d={d} pathLength={100} style={{ '--i': i } as CSSVars} />;
          })}
        </svg>
        <div className="po-core" />
        <div className="po-ring" />
      </div>
      {range(34).map((i) => (
        <span
          key={i}
          className="po-ember"
          style={{
            left: `${50 + (rand(i + 1) - 0.5) * 60}%`,
            animationDelay: `calc(var(--nx-dur) * ${0.3 + rand(i + 3) * 0.35})`,
            '--dx': `${Math.round((rand(i + 2) - 0.5) * 16)}vw`,
            '--sz': `${3 + Math.round(rand(i + 4) * 5)}px`,
          } as CSSVars}
        />
      ))}
    </div>
  );
}

// ============================================================================
// CORTE DE ANIME (refeito)
// ============================================================================

function AnimeCutScene() {
  return (
    <div className="sc sc-anime">
      <div className="an-speed" />
      <div className="an-impact" />
      <div className="an-stamp">
        <span>見参</span>
      </div>
    </div>
  );
}

// ============================================================================
// SALTO HIPERESPACIAL (refeito)
// ============================================================================

function HyperspaceScene() {
  return (
    <div className="sc sc-hyper">
      <div className="hy-bg" />
      {range(90).map((i) => (
        <span
          key={i}
          className="hy-star"
          style={{
            '--a': `${Math.round(rand(i + 1) * 360)}deg`,
            '--d0': `${(2 + rand(i + 2) * 28).toFixed(1)}vmax`,
            '--c': ['#ffffff', '#c4b5fd', '#93c5fd', '#f0abfc'][i % 4],
            animationDelay: `calc(var(--nx-dur) * ${(rand(i + 5) * 0.05).toFixed(3)})`,
          } as CSSVars}
        />
      ))}
      <div className="hy-tunnel" />
    </div>
  );
}
