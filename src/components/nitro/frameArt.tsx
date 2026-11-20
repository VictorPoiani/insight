'use client';

import type { CSSProperties, ReactNode } from 'react';
import type { FrameBackLayer, FrameOrnament } from '@/lib/nitro/catalog';

/**
 * Arte em camadas das molduras v2.
 * Sistema de coordenadas: viewBox 0–100; o avatar é o círculo central (r ≈ 36.8)
 * e o anel fica por volta de r 38–41. Tudo que anima usa a classe `nx-a`
 * (obedece live / na tela / hover / estático / movimento reduzido) e só
 * transform/opacity.
 */

const R = 36.8;

function polar(deg: number, r: number) {
  const rad = ((deg - 90) * Math.PI) / 180;
  return { x: 50 + r * Math.cos(rad), y: 50 + r * Math.sin(rad) };
}

function delay(seconds: number): CSSProperties {
  return { animationDelay: `${seconds}s` };
}

function Svg({ children, className = '' }: { children: ReactNode; className?: string }) {
  return (
    <svg aria-hidden className={`nx-deco nx-orn ${className}`} viewBox="0 0 100 100" overflow="visible">
      {children}
    </svg>
  );
}

// ============================================================================
// CAMADA DE TRÁS
// ============================================================================

export function BackArt({ kind }: { kind: FrameBackLayer }) {
  switch (kind) {
    case 'flames': {
      const angles = [-78, -52, -26, 0, 26, 52, 78];
      return (
        <Svg className="nx-back">
          <defs>
            <linearGradient id="nxFlame" x1="0" y1="1" x2="0" y2="0">
              <stop offset="0%" stopColor="#dc2626" />
              <stop offset="55%" stopColor="#f97316" />
              <stop offset="100%" stopColor="#fde047" />
            </linearGradient>
          </defs>
          {angles.map((a, i) => (
            <g key={a} transform={`rotate(${a} 50 50)`}>
              <path
                className="nx-a nx-flame"
                style={delay(i * 0.17)}
                d={`M43 ${50 - R + 6} C 42 ${50 - R - 4}, 48 ${50 - R - 10}, 50 ${50 - R - (i % 2 ? 20 : 16)} C 52 ${50 - R - 10}, 58 ${50 - R - 4}, 57 ${50 - R + 6} Z`}
                fill="url(#nxFlame)"
                opacity="0.95"
              />
            </g>
          ))}
        </Svg>
      );
    }
    case 'fox-tails':
      return (
        <Svg className="nx-back">
          <defs>
            <linearGradient id="nxFoxTail" x1="0" y1="0" x2="1" y2="0">
              <stop offset="0%" stopColor="#ea580c" />
              <stop offset="70%" stopColor="#fdba74" />
              <stop offset="100%" stopColor="#fff7ed" />
            </linearGradient>
          </defs>
          {[200, 230, 260].map((a, i) => (
            <g key={a} transform={`rotate(${a - 270} 50 50)`}>
              <path
                className="nx-a nx-fan"
                style={delay(i * 0.45)}
                d="M50 58 C 30 70, 6 66, -4 50 C 10 54, 22 50, 30 44 C 38 40, 46 46, 50 58 Z"
                fill="url(#nxFoxTail)"
                opacity={0.9 - i * 0.12}
              />
            </g>
          ))}
        </Svg>
      );
    case 'smoke':
      return (
        <Svg className="nx-back">
          <defs>
            <radialGradient id="nxSmoke">
              <stop offset="0%" stopColor="#020617" stopOpacity="0.95" />
              <stop offset="60%" stopColor="#0f172a" stopOpacity="0.6" />
              <stop offset="100%" stopColor="#0f172a" stopOpacity="0" />
            </radialGradient>
          </defs>
          <g className="nx-a nx-smoke">
            {[0, 60, 120, 180, 240, 300].map((a, i) => {
              const p = polar(a, R + 4);
              return <circle key={a} cx={p.x} cy={p.y} r={i % 2 ? 13 : 17} fill="url(#nxSmoke)" />;
            })}
          </g>
        </Svg>
      );
    case 'foliage':
      return (
        <Svg className="nx-back">
          {[150, 170, 190, 210, 230, 130, 250].map((a, i) => {
            const p = polar(a, R + 5);
            return (
              <ellipse
                key={a}
                cx={p.x}
                cy={p.y}
                rx="9"
                ry="4.5"
                transform={`rotate(${a + 40} ${p.x} ${p.y})`}
                fill={['#14532d', '#166534', '#15803d'][i % 3]}
                opacity="0.9"
              />
            );
          })}
        </Svg>
      );
    case 'storm-cloud':
      return (
        <Svg className="nx-back">
          <defs>
            <radialGradient id="nxStormBack">
              <stop offset="0%" stopColor="#1e293b" />
              <stop offset="100%" stopColor="#1e293b" stopOpacity="0" />
            </radialGradient>
          </defs>
          <ellipse cx="50" cy="12" rx="44" ry="18" fill="url(#nxStormBack)" />
        </Svg>
      );
  }
}

// ============================================================================
// CAMADA DA FRENTE
// ============================================================================

export const FRONT_ART_KINDS: FrameOrnament[] = [
  'santa-hat', 'vines', 'jaguar', 'fox', 'lurking', 'wave', 'storm', 'halo',
];

export function FrontArt({ kind }: { kind: FrameOrnament }) {
  switch (kind) {
    case 'santa-hat':
      return (
        <Svg>
          <g transform="rotate(14 58 14)">
            {/* cone */}
            <path d="M40 16 C 42 4, 50 -6, 64 -7 L 71 0 C 61 1, 59 9, 69 16 Z" fill="#dc2626" />
            <path d="M47 15 C 49 6, 54 0, 62 -2 L 64 1 C 58 3, 55 9, 55 15 Z" fill="#ef4444" opacity="0.7" />
            {/* ponta mole + pompom (balança) */}
            <g className="nx-a nx-swing">
              <path d="M64 -7 C 74 -8, 83 -2, 85 9 L 80 10 C 78 3, 74 0, 70 0 Z" fill="#b91c1c" />
              <circle cx="84" cy="12" r="5.5" fill="#ffffff" />
              <circle cx="82.5" cy="10.5" r="2" fill="#f1f5f9" />
            </g>
            {/* aba */}
            <rect x="37" y="12" width="36" height="8.5" rx="4.2" fill="#ffffff" />
            <rect x="37" y="16.5" width="36" height="4" rx="2" fill="#e2e8f0" />
          </g>
        </Svg>
      );

    case 'vines': {
      const arc = (from: number, to: number) => {
        const steps = 10;
        let d = '';
        for (let i = 0; i <= steps; i++) {
          const a = from + ((to - from) * i) / steps;
          const p = polar(a, R + (i % 2 ? 4.5 : 2));
          d += i === 0 ? `M${p.x.toFixed(1)} ${p.y.toFixed(1)}` : ` L${p.x.toFixed(1)} ${p.y.toFixed(1)}`;
        }
        return d;
      };
      const leaves = [195, 215, 240, 265, 290, 160, 140, 115, 90, 65];
      return (
        <Svg>
          <path className="nx-a nx-grow" d={arc(180, 300)} fill="none" stroke="#166534" strokeWidth="1.6" strokeLinecap="round" pathLength={100} />
          <path className="nx-a nx-grow" style={delay(0.6)} d={arc(180, 60)} fill="none" stroke="#15803d" strokeWidth="1.4" strokeLinecap="round" pathLength={100} />
          {leaves.map((a, i) => {
            const p = polar(a, R + 4);
            return (
              <ellipse
                key={a}
                className="nx-a nx-leaf"
                style={delay(i * 0.3)}
                cx={p.x}
                cy={p.y}
                rx="3.6"
                ry="1.7"
                transform={`rotate(${a + (i % 2 ? 50 : -50)} ${p.x} ${p.y})`}
                fill={i % 3 === 0 ? '#65a30d' : '#22c55e'}
              />
            );
          })}
          {[230, 120, 300].map((a) => {
            const p = polar(a, R + 3);
            return <circle key={a} cx={p.x} cy={p.y} r="1.8" fill="#f9a8d4" stroke="#fde047" strokeWidth="0.6" />;
          })}
          {[20, 75, 150, 205, 330].map((a, i) => {
            const p = polar(a, R + 9);
            return <circle key={a} className="nx-a nx-firefly" style={delay(i * 0.55)} cx={p.x} cy={p.y} r="1.2" fill="#fef08a" />;
          })}
        </Svg>
      );
    }

    case 'jaguar': {
      const ear = (angle: number, twitch: boolean) => {
        const p = polar(angle, R + 1);
        return (
          <g transform={`translate(${p.x} ${p.y}) rotate(${angle})`}>
            <g className={twitch ? 'nx-a nx-twitch' : undefined}>
              <path d="M-7 3 Q -6.5 -9 0 -10.5 Q 6.5 -9 7 3 Z" fill="#d97706" stroke="#1c1917" strokeWidth="1.2" />
              <path d="M-3.8 1 Q -3.4 -5.5 0 -6.5 Q 3.4 -5.5 3.8 1 Z" fill="#fde68a" />
            </g>
          </g>
        );
      };
      const rosettes = Array.from({ length: 14 }, (_, i) => polar(i * (360 / 14) + 8, R + 2.6));
      return (
        <Svg>
          {rosettes.map((p, i) => (
            <circle key={i} cx={p.x} cy={p.y} r={i % 2 ? 1.3 : 1.7} fill="none" stroke="#1c1917" strokeWidth="0.9" />
          ))}
          {ear(-32, false)}
          {ear(32, true)}
          <g className="nx-a nx-tail">
            <path d="M74 84 C 88 88, 98 76, 94 62 C 92 56, 86 56, 86 60" fill="none" stroke="#d97706" strokeWidth="5" strokeLinecap="round" />
            <path d="M74 84 C 88 88, 98 76, 94 62 C 92 56, 86 56, 86 60" fill="none" stroke="#1c1917" strokeWidth="5" strokeLinecap="round" strokeDasharray="2 6" />
          </g>
        </Svg>
      );
    }

    case 'fox': {
      const ear = (angle: number, twitch: boolean) => {
        const p = polar(angle, R);
        return (
          <g transform={`translate(${p.x} ${p.y}) rotate(${angle})`}>
            <g className={twitch ? 'nx-a nx-twitch' : undefined}>
              <path d="M-7 3 L 0 -15 L 7 3 Z" fill="#ea580c" stroke="#7c2d12" strokeWidth="0.8" strokeLinejoin="round" />
              <path d="M-3.5 1 L 0 -9 L 3.5 1 Z" fill="#fff7ed" />
              <path d="M-1.5 -10 L 0 -15 L 1.5 -10 Z" fill="#1c1917" />
            </g>
          </g>
        );
      };
      return (
        <Svg>
          {ear(-30, true)}
          {ear(30, false)}
        </Svg>
      );
    }

    case 'lurking': {
      const spots = [
        { a: -40, d: 0 }, { a: 50, d: 1.3 }, { a: 140, d: 2.4 }, { a: 215, d: 0.7 }, { a: 280, d: 3.1 }, { a: 100, d: 3.8 },
      ];
      return (
        <Svg>
          {spots.map(({ a, d }) => {
            const p = polar(a, R + 9);
            return (
              <g key={a} transform={`translate(${p.x} ${p.y})`}>
                <g className="nx-a nx-eye" style={delay(d)}>
                  <ellipse cx="-2.6" cy="0" rx="2" ry="1.3" fill="#bef264" />
                  <ellipse cx="2.6" cy="0" rx="2" ry="1.3" fill="#bef264" />
                  <ellipse cx="-2.6" cy="0" rx="0.45" ry="1.1" fill="#0b0f05" />
                  <ellipse cx="2.6" cy="0" rx="0.45" ry="1.1" fill="#0b0f05" />
                </g>
              </g>
            );
          })}
          <g className="nx-a nx-tentacle">
            <path d="M6 100 C 2 86, 10 78, 16 80 C 22 82, 20 90, 15 89" fill="none" stroke="#3b0764" strokeWidth="4.5" strokeLinecap="round" />
            {[{ x: 6.5, y: 92 }, { x: 8, y: 85 }, { x: 13, y: 80.5 }].map((s, i) => (
              <circle key={i} cx={s.x} cy={s.y} r="0.9" fill="#c4b5fd" />
            ))}
          </g>
        </Svg>
      );
    }

    case 'wave':
      return (
        <Svg>
          <g className="nx-a nx-bob">
            <path
              d="M2 100 C -2 82, 2 64, 13 52 C 21 43, 33 41, 39 48 C 43 53, 40 59, 34 58 C 37 54, 34 49, 28 51 C 20 54, 18 67, 26 77 C 34 87, 50 92, 66 100 Z"
              fill="#1e3a5f"
              stroke="#10213a"
              strokeWidth="0.9"
            />
            <path d="M8 92 C 6 80, 10 68, 18 60" fill="none" stroke="#3b6e8f" strokeWidth="1.4" />
            <path d="M14 96 C 12 84, 16 74, 22 68" fill="none" stroke="#9ec5d6" strokeWidth="1" />
            {/* garras de espuma */}
            {[
              'M13 52 q -3 -5 2 -7 q -1 3 2 4',
              'M19 46 q -2 -6 3 -7 q -1 3 2 4',
              'M26 43 q -1 -6 4 -6 q -2 3 1 4',
              'M33 43 q 1 -5 5 -4 q -2 2 0 4',
              'M38 47 q 3 -4 6 -2 q -3 1 -2 4',
            ].map((d, i) => (
              <path key={i} d={d} fill="#f7f3e8" stroke="#10213a" strokeWidth="0.5" />
            ))}
          </g>
          {[{ x: 44, y: 44 }, { x: 47, y: 50 }, { x: 41, y: 38 }, { x: 36, y: 36 }].map((p, i) => (
            <circle key={i} className="nx-a nx-spray" style={delay(i * 0.35)} cx={p.x} cy={p.y} r={0.9 + (i % 2) * 0.5} fill="#f7f3e8" />
          ))}
        </Svg>
      );

    case 'storm':
      return (
        <Svg>
          <clipPath id="nxRainClip">
            <rect x="22" y="12" width="56" height="26" />
          </clipPath>
          <g clipPath="url(#nxRainClip)">
            <g className="nx-a nx-rain">
              {Array.from({ length: 14 }, (_, i) => (
                <line key={i} x1={24 + i * 4} y1={-8 + (i % 3) * 5} x2={22 + i * 4} y2={-2 + (i % 3) * 5} stroke="#93c5fd" strokeWidth="0.7" strokeLinecap="round" />
              ))}
              {Array.from({ length: 14 }, (_, i) => (
                <line key={`b${i}`} x1={26 + i * 4} y1={10 + (i % 3) * 5} x2={24 + i * 4} y2={16 + (i % 3) * 5} stroke="#bfdbfe" strokeWidth="0.6" strokeLinecap="round" />
              ))}
            </g>
          </g>
          <path className="nx-a nx-bolt" d="M66 10 L 60 22 L 65 22 L 58 36 L 70 18 L 64 18 L 69 10 Z" fill="#fde047" stroke="#fff" strokeWidth="0.4" />
          <g>
            <circle cx="36" cy="10" r="8" fill="#475569" />
            <circle cx="47" cy="5" r="10" fill="#64748b" />
            <circle cx="60" cy="8" r="9" fill="#475569" />
            <circle cx="70" cy="12" r="6.5" fill="#334155" />
            <rect x="30" y="10" width="44" height="8" rx="4" fill="#475569" />
          </g>
        </Svg>
      );

    case 'halo':
      return (
        <Svg>
          <g className="nx-a nx-bob">
            <ellipse cx="50" cy="4" rx="21" ry="4.6" fill="none" stroke="#fef9c3" strokeOpacity="0.35" strokeWidth="4" />
            <ellipse cx="50" cy="4" rx="21" ry="4.6" fill="none" stroke="#fef08a" strokeWidth="1.3" />
          </g>
        </Svg>
      );

    default:
      return null;
  }
}
