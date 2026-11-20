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
    case 'santa-hat': {
      // pelúcia da aba: bolinhas sobrepostas com luz vinda de cima
      const fluff = Array.from({ length: 13 }, (_, i) => ({ x: 38.5 + i * 2.75, y: 16.2 + (i % 2 ? 0.9 : -0.4), r: 2.6 + (i % 3) * 0.35 }));
      return (
        <Svg>
          <defs>
            <linearGradient id="nxHatRed" x1="0" y1="0" x2="1" y2="1">
              <stop offset="0%" stopColor="#f87171" />
              <stop offset="45%" stopColor="#dc2626" />
              <stop offset="100%" stopColor="#7f1d1d" />
            </linearGradient>
            <radialGradient id="nxFur" cx="40%" cy="30%" r="70%">
              <stop offset="0%" stopColor="#ffffff" />
              <stop offset="70%" stopColor="#e5e7eb" />
              <stop offset="100%" stopColor="#9ca3af" />
            </radialGradient>
            <filter id="nxSoftShadow" x="-30%" y="-30%" width="160%" height="160%">
              <feDropShadow dx="0" dy="1.2" stdDeviation="1.1" floodColor="#000" floodOpacity="0.45" />
            </filter>
          </defs>
          <g transform="rotate(14 58 14)" filter="url(#nxSoftShadow)">
            <path d="M40 16 C 42 3, 51 -7, 65 -8 L 72 0 C 62 1, 59 9, 70 16 Z" fill="url(#nxHatRed)" />
            {/* dobras do tecido */}
            <path d="M48 15 C 50 6, 55 0, 62 -3" fill="none" stroke="#fca5a5" strokeOpacity="0.55" strokeWidth="1.2" strokeLinecap="round" />
            <path d="M58 15 C 58 9, 61 4, 67 1" fill="none" stroke="#450a0a" strokeOpacity="0.35" strokeWidth="1.4" strokeLinecap="round" />
            <g className="nx-a nx-swing">
              <path d="M65 -8 C 75 -9, 84 -3, 86 8 L 80 9.5 C 78 2.5, 74 -0.5, 70 0 Z" fill="url(#nxHatRed)" />
              <path d="M70 -6 C 77 -6, 82 -1, 84 5" fill="none" stroke="#fca5a5" strokeOpacity="0.5" strokeWidth="0.9" strokeLinecap="round" />
              {[0, 1, 2, 3, 4, 5, 6].map((i) => {
                const a = (i / 7) * Math.PI * 2;
                return <circle key={i} cx={84 + Math.cos(a) * 3} cy={11.5 + Math.sin(a) * 3} r="3" fill="url(#nxFur)" />;
              })}
              <circle cx="84" cy="11.5" r="3.4" fill="url(#nxFur)" />
              <circle cx="82.6" cy="10" r="1.2" fill="#fff" />
            </g>
            {fluff.map((f, i) => (
              <circle key={i} cx={f.x} cy={f.y} r={f.r} fill="url(#nxFur)" />
            ))}
            <path d="M37 18.5 Q 55 21.5 74 18.5" fill="none" stroke="#9ca3af" strokeOpacity="0.5" strokeWidth="0.8" />
          </g>
        </Svg>
      );
    }
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
              <path d="M-8 4 Q -7.5 -10 0 -11.5 Q 7.5 -10 8 4 Z" fill="url(#nxJagFur)" stroke="#1c1917" strokeWidth="1.1" />
              <path d="M-4.6 2 Q -4 -6.2 0 -7.3 Q 4 -6.2 4.6 2 Z" fill="url(#nxJagInner)" />
              {/* tufos de pelo */}
              <path d="M-3 1 L -1.6 -3.5 M0 1.5 L 0 -4.5 M3 1 L 1.6 -3.5" stroke="#fff7ed" strokeOpacity="0.7" strokeWidth="0.45" strokeLinecap="round" />
              <circle cx="0" cy="-9.4" r="1.4" fill="#1c1917" />
            </g>
          </g>
        );
      };
      const rosettes = Array.from({ length: 14 }, (_, i) => ({ p: polar(i * (360 / 14) + 8, R + 2.6), big: i % 2 === 0 }));
      return (
        <Svg>
          <defs>
            <linearGradient id="nxJagFur" x1="0" y1="1" x2="0" y2="0">
              <stop offset="0%" stopColor="#92400e" />
              <stop offset="55%" stopColor="#d97706" />
              <stop offset="100%" stopColor="#fbbf24" />
            </linearGradient>
            <radialGradient id="nxJagInner" cx="50%" cy="70%" r="70%">
              <stop offset="0%" stopColor="#fde68a" />
              <stop offset="100%" stopColor="#f59e0b" />
            </radialGradient>
            <linearGradient id="nxJagTail" x1="0" y1="0" x2="1" y2="1">
              <stop offset="0%" stopColor="#fbbf24" />
              <stop offset="100%" stopColor="#b45309" />
            </linearGradient>
            <filter id="nxJagShadow" x="-30%" y="-30%" width="160%" height="160%">
              <feDropShadow dx="0" dy="1" stdDeviation="0.9" floodColor="#000" floodOpacity="0.5" />
            </filter>
          </defs>
          {rosettes.map(({ p, big }, i) => (
            <g key={i}>
              <circle cx={p.x} cy={p.y} r={big ? 1.9 : 1.4} fill="none" stroke="#1c1917" strokeWidth="0.8" strokeDasharray={big ? '2.2 0.9' : '1.6 0.8'} />
              <circle cx={p.x + 0.2} cy={p.y + 0.2} r={big ? 0.7 : 0.5} fill="#78350f" />
            </g>
          ))}
          <g filter="url(#nxJagShadow)">
            {ear(-32, false)}
            {ear(32, true)}
            <g className="nx-a nx-tail">
              <path d="M73 84 C 88 89, 99 77, 95 62 C 93 55, 86 55, 86 60" fill="none" stroke="url(#nxJagTail)" strokeWidth="5.4" strokeLinecap="round" />
              <path d="M73 84 C 88 89, 99 77, 95 62 C 93 55, 86 55, 86 60" fill="none" stroke="#1c1917" strokeWidth="5.4" strokeLinecap="round" strokeDasharray="1.6 4.2" />
              <path d="M75 83 C 88 87, 96 77, 93 64" fill="none" stroke="#fde68a" strokeOpacity="0.45" strokeWidth="1.2" strokeLinecap="round" />
            </g>
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
              <path d="M-8 4 Q -5 -6 0 -17 Q 5 -6 8 4 Z" fill="url(#nxFoxEar)" stroke="#7c2d12" strokeWidth="0.7" strokeLinejoin="round" />
              <path d="M-4.2 2 Q -2.6 -4 0 -10.5 Q 2.6 -4 4.2 2 Z" fill="url(#nxFoxInner)" />
              <path d="M-1.8 -11 Q 0 -17.5 1.8 -11 Z" fill="#1c1917" />
              <path d="M-5.5 0 Q -3 -6 -1 -11" fill="none" stroke="#fed7aa" strokeOpacity="0.7" strokeWidth="0.6" strokeLinecap="round" />
            </g>
          </g>
        );
      };
      return (
        <Svg>
          <defs>
            <linearGradient id="nxFoxEar" x1="0" y1="1" x2="0" y2="0">
              <stop offset="0%" stopColor="#9a3412" />
              <stop offset="60%" stopColor="#ea580c" />
              <stop offset="100%" stopColor="#fb923c" />
            </linearGradient>
            <linearGradient id="nxFoxInner" x1="0" y1="1" x2="0" y2="0">
              <stop offset="0%" stopColor="#fff7ed" />
              <stop offset="100%" stopColor="#fecaca" />
            </linearGradient>
            <filter id="nxFoxShadow" x="-30%" y="-30%" width="160%" height="160%">
              <feDropShadow dx="0" dy="1" stdDeviation="0.9" floodColor="#000" floodOpacity="0.5" />
            </filter>
          </defs>
          <g filter="url(#nxFoxShadow)">
            {ear(-30, true)}
            {ear(30, false)}
          </g>
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
          <defs>
            <clipPath id="nxRainClip">
              <rect x="22" y="14" width="56" height="24" />
            </clipPath>
            <linearGradient id="nxCloud" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#cbd5e1" />
              <stop offset="45%" stopColor="#64748b" />
              <stop offset="100%" stopColor="#1e293b" />
            </linearGradient>
            <filter id="nxCloudShadow" x="-30%" y="-30%" width="160%" height="160%">
              <feDropShadow dx="0" dy="1.5" stdDeviation="1.4" floodColor="#020617" floodOpacity="0.6" />
            </filter>
          </defs>
          <g clipPath="url(#nxRainClip)">
            <g className="nx-a nx-rain">
              {Array.from({ length: 16 }, (_, i) => (
                <line key={i} x1={24 + i * 3.6} y1={-8 + (i % 3) * 5} x2={22 + i * 3.6} y2={-2 + (i % 3) * 5} stroke="#bfdbfe" strokeOpacity="0.8" strokeWidth="0.55" strokeLinecap="round" />
              ))}
              {Array.from({ length: 16 }, (_, i) => (
                <line key={`b${i}`} x1={26 + i * 3.6} y1={10 + (i % 3) * 5} x2={24 + i * 3.6} y2={16 + (i % 3) * 5} stroke="#e0f2fe" strokeOpacity="0.7" strokeWidth="0.5" strokeLinecap="round" />
              ))}
            </g>
          </g>
          <path className="nx-a nx-bolt" d="M66 12 L 60 23 L 65 23 L 58 37 L 70 20 L 64 20 L 69 12 Z" fill="#fef9c3" stroke="#fde047" strokeWidth="0.5" />
          <g filter="url(#nxCloudShadow)">
            <circle cx="35" cy="11" r="8" fill="url(#nxCloud)" />
            <circle cx="46" cy="5.5" r="10.5" fill="url(#nxCloud)" />
            <circle cx="59.5" cy="7.5" r="9.5" fill="url(#nxCloud)" />
            <circle cx="70" cy="12" r="6.8" fill="url(#nxCloud)" />
            <rect x="29" y="10" width="47" height="9" rx="4.5" fill="#334155" />
            <ellipse cx="44" cy="2.5" rx="5" ry="2.2" fill="#f1f5f9" opacity="0.55" />
          </g>
        </Svg>
      );
    case 'halo':
      return (
        <Svg>
          <defs>
            <linearGradient id="nxHalo" x1="0" y1="0" x2="1" y2="0">
              <stop offset="0%" stopColor="#fde68a" />
              <stop offset="50%" stopColor="#fffbeb" />
              <stop offset="100%" stopColor="#fbbf24" />
            </linearGradient>
          </defs>
          <g className="nx-a nx-bob">
            <ellipse cx="50" cy="3" rx="22" ry="5" fill="none" stroke="#fef3c7" strokeOpacity="0.18" strokeWidth="6" />
            <ellipse cx="50" cy="3" rx="22" ry="5" fill="none" stroke="#fde68a" strokeOpacity="0.4" strokeWidth="3" />
            <ellipse cx="50" cy="3" rx="22" ry="5" fill="none" stroke="url(#nxHalo)" strokeWidth="1.4" />
            <ellipse cx="42" cy="-1.2" rx="5" ry="0.9" fill="#fff" opacity="0.8" />
          </g>
        </Svg>
      );
    default:
      return null;
  }
}
