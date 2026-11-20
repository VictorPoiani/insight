'use client';

import { useEffect, useRef, type CSSProperties, type ReactNode } from 'react';
import { observeFrame } from './inViewBudget';
import {
  Cpu,
  Crown,
  Flame,
  Gem,
  Gift,
  Orbit,
  Snowflake,
  Sparkles,
  Star,
  Zap,
} from 'lucide-react';
import {
  FrameItem,
  FrameOrnament,
  NitroCosmetics,
  TagIcon,
  TitleItem,
  getNitroItem,
} from '@/lib/nitro/catalog';
import { useNitro, useProfileCosmetics } from './NitroProvider';

type CosmeticProfile = { id: string; cosmetics?: NitroCosmetics | null };

type CSSVars = CSSProperties & Record<`--${string}`, string | number>;

/** Pseudoaleatório determinístico (mesmo resultado no servidor e no cliente). */
function rand(seed: number) {
  const x = Math.sin(seed * 9301 + 49297) * 233280;
  return x - Math.floor(x);
}

// ============================================================================
// MOLDURA
// ============================================================================

interface CosmeticAvatarProps {
  profile: CosmeticProfile | null | undefined;
  /** Tamanho do avatar em px (sem a moldura). */
  size: number;
  children: ReactNode;
  className?: string;
  /** Força animação contínua (padrão: avatares ≥ 64px). Abaixo disso anima no hover. */
  live?: boolean;
  /** Usado na galeria para pré-visualizar sem salvar. */
  preview?: NitroCosmetics | null;
}

/**
 * Envolve um avatar existente e desenha a moldura equipada em volta.
 * Sempre renderiza o wrapper (mesmo sem moldura) para não mudar o layout.
 */
export function CosmeticAvatar({ profile, size, children, className = '', live, preview }: CosmeticAvatarProps) {
  const saved = useProfileCosmetics(profile);
  const { prefs } = useNitro();
  const cosmetics = preview !== undefined ? preview : saved;
  const frame =
    cosmetics && cosmetics.frameEnabled !== false ? getNitroItem(cosmetics.frame, 'frame') : null;

  if (!frame) {
    return <span className={`relative inline-flex shrink-0 ${className}`}>{children}</span>;
  }

  const isTier = frame.collection === 'patentes';
  const animated =
    !frame.alwaysStatic &&
    cosmetics?.frameAnimated !== false &&
    (!isTier || cosmetics?.levelAnimation !== false);
  const isLive = live ?? size >= 64;
  // nx-auto: anima quando está na tela (orçamento) ou no hover do desktop
  const mode = !animated ? 'nx-static' : isLive ? 'nx-live' : prefs.animateLists ? 'nx-auto' : 'nx-static';

  return (
    <FrameShell frame={frame} size={size} mode={mode} className={className}>
      {children}
    </FrameShell>
  );
}

function FrameShell({
  frame,
  size,
  mode,
  className,
  children,
}: {
  frame: FrameItem;
  size: number;
  mode: 'nx-static' | 'nx-live' | 'nx-auto';
  className: string;
  children: ReactNode;
}) {
  const colors = frame.ring.colors;
  const style: CSSVars = {
    '--nx-size': `${size}px`,
    '--nx-rw': `${Math.max(2, Math.round(size * (frame.ring.width ?? 0.07)))}px`,
    '--nx-conic': `conic-gradient(from 0deg, ${colors.join(', ')})`,
    '--nx-glowc': frame.glow || 'transparent',
  };
  const animatedOrnament = mode === 'nx-live';
  const ref = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    if (mode !== 'nx-auto' || !ref.current) return;
    return observeFrame(ref.current);
  }, [mode]);

  return (
    <span ref={ref} className={`nx-frame ${mode} ${className}`} style={style}>
      {frame.glow && <span aria-hidden className="nx-deco nx-glow nx-anim" />}
      <span aria-hidden className={`nx-deco nx-ring nx-anim nx-ring--${frame.ring.anim}`} />
      {children}
      {frame.ornament && <FrameOrnamentSvg kind={frame.ornament} animated={animatedOrnament} />}
      {frame.particles && (
        <span aria-hidden className={`nx-deco nx-particles nx-p--${frame.particles.mode} nx-anim`}>
          {Array.from({ length: frame.particles.count }, (_, i) => {
            const n = frame.particles!.count;
            const pStyle: CSSVars = {
              '--a': `${(360 / n) * i}deg`,
              '--x': `${Math.round(8 + rand(i + 1) * 84)}%`,
              '--d': `${(-rand(i + 7) * 4).toFixed(2)}s`,
              '--dur': `${(2.6 + rand(i + 3) * 1.8).toFixed(2)}s`,
              color: frame.particles!.color,
            };
            return (
              <span key={i} className="nx-part nx-anim" style={pStyle}>
                {frame.particles!.glyph}
              </span>
            );
          })}
        </span>
      )}
    </span>
  );
}

/** Ornamentos em SVG. viewBox 0–100; o avatar ocupa o círculo central (r ≈ 36.8). */
function FrameOrnamentSvg({ kind, animated }: { kind: FrameOrnament; animated: boolean }) {
  const R = 36.8;
  const polar = (deg: number, r: number) => {
    const rad = ((deg - 90) * Math.PI) / 180;
    return { x: 50 + r * Math.cos(rad), y: 50 + r * Math.sin(rad) };
  };

  let content: ReactNode = null;

  switch (kind) {
    case 'crown':
      content = (
        <g>
          <path d="M37 13 L40 3 L45 9 L50 1 L55 9 L60 3 L63 13 Z" fill="url(#nxGold)" stroke="#78350f" strokeWidth="0.6" />
          <circle cx="50" cy="1.8" r="1.6" fill="#ef4444" />
          <circle cx="40" cy="3.6" r="1.1" fill="#3b82f6" />
          <circle cx="60" cy="3.6" r="1.1" fill="#22c55e" />
        </g>
      );
      break;
    case 'tiara': {
      const gems = [-30, -15, 0, 15, 30];
      content = (
        <g>
          <path d="M30 14 Q50 2 70 14" fill="none" stroke="#f5d0fe" strokeWidth="1.6" />
          {gems.map((g, i) => {
            const p = polar(g, R + 7 + (i === 2 ? 3 : 0));
            return (
              <path
                key={g}
                d={`M${p.x} ${p.y - (i === 2 ? 4.5 : 3)} L${p.x + 2} ${p.y} L${p.x} ${p.y + 2.5} L${p.x - 2} ${p.y} Z`}
                fill={i === 2 ? '#f472b6' : '#e9d5ff'}
                stroke="#ffffff"
                strokeWidth="0.4"
              />
            );
          })}
        </g>
      );
      break;
    }
    case 'horns':
      content = (
        <g fill="url(#nxHorn)" stroke="#1c0505" strokeWidth="0.6">
          <path d="M30 22 C22 14 20 6 24 0 C26 8 31 12 37 15 Z" />
          <path d="M70 22 C78 14 80 6 76 0 C74 8 69 12 63 15 Z" />
        </g>
      );
      break;
    case 'laurel': {
      const leaves: ReactNode[] = [];
      for (let side = -1; side <= 1; side += 2) {
        for (let i = 0; i < 8; i++) {
          const deg = 180 + side * (25 + i * 16);
          const p = polar(deg, R + 4);
          leaves.push(
            <ellipse
              key={`${side}-${i}`}
              cx={p.x}
              cy={p.y}
              rx="4.2"
              ry="1.7"
              transform={`rotate(${deg + side * 55} ${p.x} ${p.y})`}
              fill="url(#nxGold)"
              stroke="#78350f"
              strokeWidth="0.3"
            />
          );
        }
      }
      content = <g>{leaves}</g>;
      break;
    }
    case 'wreath': {
      const items: ReactNode[] = [];
      for (let i = 0; i < 18; i++) {
        const deg = i * 20;
        const p = polar(deg, R + 3.5);
        items.push(
          <ellipse
            key={`l${i}`}
            cx={p.x}
            cy={p.y}
            rx="4"
            ry="2"
            transform={`rotate(${deg + (i % 2 ? 40 : -40)} ${p.x} ${p.y})`}
            fill={i % 2 ? '#15803d' : '#166534'}
          />
        );
      }
      [30, 150, 270].forEach((deg) => {
        [0, 1, 2].forEach((k) => {
          const p = polar(deg + (k - 1) * 4, R + 3 + (k === 1 ? 1.5 : 0));
          items.push(<circle key={`b${deg}${k}`} cx={p.x} cy={p.y} r="1.6" fill="#dc2626" className={animated ? 'nx-blink' : ''} style={{ animationDelay: `${k * 0.4}s` }} />);
        });
      });
      items.push(
        <g key="bow">
          <path d="M50 92 L42 87 L42 97 Z M50 92 L58 87 L58 97 Z" fill="#dc2626" />
          <circle cx="50" cy="92" r="1.8" fill="#991b1b" />
        </g>
      );
      content = <g>{items}</g>;
      break;
    }
    case 'snowflake':
      content = (
        <g className={animated ? 'nx-svg-spin' : ''}>
          {[0, 60, 120, 180, 240, 300].map((deg) => {
            const p = polar(deg, R + 6);
            return (
              <text key={deg} x={p.x} y={p.y + 2.5} fontSize="7" textAnchor="middle" fill="#e0f2fe">
                ❄
              </text>
            );
          })}
        </g>
      );
      break;
    case 'circuit':
      content = (
        <g fill="none" stroke="#22d3ee" strokeWidth="0.9" strokeLinecap="round">
          <circle cx="50" cy="50" r={R + 6} strokeDasharray="6 4 1 4" className={animated ? 'nx-dash' : ''} />
          {[20, 75, 140, 200, 250, 320].map((deg) => {
            const a = polar(deg, R + 2);
            const b = polar(deg, R + 9);
            const c = polar(deg + 8, R + 9);
            return (
              <g key={deg}>
                <path d={`M${a.x} ${a.y} L${b.x} ${b.y} L${c.x} ${c.y}`} />
                <circle cx={c.x} cy={c.y} r="1.2" fill="#e11d48" stroke="none" />
              </g>
            );
          })}
        </g>
      );
      break;
    case 'saturn':
      content = (
        <g>
          <ellipse cx="50" cy="50" rx="50" ry="11" transform="rotate(-18 50 50)" fill="none" stroke="url(#nxSaturn)" strokeWidth="2.2" opacity="0.9" />
          <circle r="3.2" fill="#fde68a" stroke="#f59e0b" strokeWidth="0.5" cx={animated ? 0 : 97} cy={animated ? 0 : 35}>
            {animated && (
              <animateMotion
                dur="5s"
                repeatCount="indefinite"
                path="M 97.5 34.6 A 50 11 -18 1 1 2.5 65.4 A 50 11 -18 1 1 97.5 34.6"
              />
            )}
          </circle>
        </g>
      );
      break;
    case 'grid':
      content = (
        <g stroke="#38bdf8" strokeWidth="0.8" className={animated ? 'nx-pulse-svg' : ''}>
          {Array.from({ length: 36 }, (_, i) => {
            const deg = i * 10;
            const a = polar(deg, R + 2);
            const b = polar(deg, R + (i % 3 === 0 ? 8 : 5));
            return <line key={i} x1={a.x} y1={a.y} x2={b.x} y2={b.y} />;
          })}
        </g>
      );
      break;
  }

  return (
    <svg aria-hidden className="nx-deco nx-orn" viewBox="0 0 100 100" overflow="visible">
      <defs>
        <linearGradient id="nxGold" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#fef08a" />
          <stop offset="50%" stopColor="#eab308" />
          <stop offset="100%" stopColor="#a16207" />
        </linearGradient>
        <linearGradient id="nxHorn" x1="0" y1="1" x2="0" y2="0">
          <stop offset="0%" stopColor="#450a0a" />
          <stop offset="100%" stopColor="#dc2626" />
        </linearGradient>
        <linearGradient id="nxSaturn" x1="0" y1="0" x2="1" y2="0">
          <stop offset="0%" stopColor="#a78bfa" />
          <stop offset="50%" stopColor="#f472b6" />
          <stop offset="100%" stopColor="#fbbf24" />
        </linearGradient>
      </defs>
      {content}
    </svg>
  );
}

// ============================================================================
// TÍTULO
// ============================================================================

interface CosmeticNameProps {
  profile: CosmeticProfile | null | undefined;
  children: ReactNode;
  preview?: NitroCosmetics | null;
  className?: string;
}

export function CosmeticName({ profile, children, preview, className = '' }: CosmeticNameProps) {
  const saved = useProfileCosmetics(profile);
  const cosmetics = preview !== undefined ? preview : saved;
  const title = getNitroItem(cosmetics?.title, 'title');
  if (!title) return <>{children}</>;
  return <TitleText title={title} className={className}>{children}</TitleText>;
}

export function TitleText({
  title,
  children,
  className = '',
}: {
  title: TitleItem;
  children: ReactNode;
  className?: string;
}) {
  const style: CSSVars = {
    '--nx-grad': `linear-gradient(90deg, ${title.colors.join(', ')})`,
    '--nx-fallback': title.fallback,
    '--nx-tglow': title.glow || 'transparent',
  };
  return (
    <span className={`nx-title-wrap ${className}`}>
      {title.icon === 'crown' && <Crown aria-hidden className="nx-title-icon" style={{ color: '#facc15' }} />}
      {title.icon === 'snow' && <span aria-hidden className="nx-title-glyph">❄</span>}
      <span
        className={`nx-title nx-title--${title.anim}`}
        style={style}
        data-text={typeof children === 'string' ? children : undefined}
      >
        {children}
      </span>
      {title.icon === 'sparkle' && <span aria-hidden className="nx-title-glyph nx-twinkle-glyph">✦</span>}
      {title.icon === 'petal' && <span aria-hidden className="nx-title-glyph nx-petal">🌸</span>}
    </span>
  );
}

// ============================================================================
// TAG
// ============================================================================

const TAG_ICONS: Record<TagIcon, typeof Zap> = {
  zap: Zap,
  gift: Gift,
  snowflake: Snowflake,
  flame: Flame,
  crown: Crown,
  star: Star,
  sparkles: Sparkles,
  gem: Gem,
  cpu: Cpu,
  orbit: Orbit,
};

export function CosmeticTag({
  profile,
  preview,
  className = '',
}: {
  profile: CosmeticProfile | null | undefined;
  preview?: NitroCosmetics | null;
  className?: string;
}) {
  const saved = useProfileCosmetics(profile);
  const cosmetics = preview !== undefined ? preview : saved;
  const tag = getNitroItem(cosmetics?.tag, 'tag');
  if (!tag) return null;
  return <TagPill tagId={tag.id} className={className} />;
}

export function TagPill({ tagId, className = '' }: { tagId: string; className?: string }) {
  const tag = getNitroItem(tagId, 'tag');
  if (!tag) return null;
  const Icon = TAG_ICONS[tag.icon];
  const style: CSSVars = { '--nx-tbg': tag.bg, '--nx-tfg': tag.fg, '--nx-tb': tag.border };
  return (
    <span
      className={`nx-tag ${tag.shimmer ? 'nx-tag--shimmer' : ''} ${tag.mono ? 'font-mono tracking-wider' : ''} ${className}`}
      style={style}
      title={tag.name}
    >
      <Icon aria-hidden className="w-2.5 h-2.5 shrink-0" />
      <span>{tag.label}</span>
    </span>
  );
}

/** Pré-visualização isolada de uma moldura (galeria). */
export function FramePreview({
  frameId,
  size,
  live = true,
  children,
}: {
  frameId: string;
  size: number;
  live?: boolean;
  children: ReactNode;
}) {
  const frame = getNitroItem(frameId, 'frame');
  if (!frame) return <>{children}</>;
  const mode = frame.alwaysStatic ? 'nx-static' : live ? 'nx-live' : 'nx-auto';
  return (
    <FrameShell frame={frame} size={size} mode={mode} className="">
      {children}
    </FrameShell>
  );
}
