'use client';

import type { CSSProperties } from 'react';
import Link from 'next/link';
import {
  CONTRIBUTOR_TIERS,
  ContributorTier,
  amountToPoints,
  getContributorTier,
} from '@/lib/contributorLevels';
import { Eye, Zap, Hexagon, Award, Compass, Sparkles } from 'lucide-react';

interface ContributorLevelPillProps {
  points?: number | null;
  totalDonated?: number | null;
  level?: number | null;
  size?: 'sm' | 'md';
  showName?: boolean;
  hideLevelZero?: boolean;
  clickable?: boolean;
  className?: string;
}

function getTierIcon(level: number) {
  switch (level) {
    case 1:
      return Zap;
    case 2:
      return Hexagon;
    case 3:
      return Award;
    case 4:
      return Compass;
    case 5:
      return Sparkles;
    default:
      return Eye;
  }
}

function resolveTier({
  points,
  totalDonated,
  level,
}: Pick<ContributorLevelPillProps, 'points' | 'totalDonated' | 'level'>): {
  tier: ContributorTier;
  resolvedPoints: number;
} {
  if (typeof points === 'number' && Number.isFinite(points) && points > 0) {
    return { tier: getContributorTier(points), resolvedPoints: Math.floor(points) };
  }

  if (
    typeof totalDonated === 'number' &&
    Number.isFinite(totalDonated) &&
    totalDonated > 0
  ) {
    const pts = amountToPoints(totalDonated);
    return { tier: getContributorTier(pts), resolvedPoints: pts };
  }

  if (typeof level === 'number' && Number.isFinite(level) && level >= 0) {
    const byLevel =
      CONTRIBUTOR_TIERS.find((t) => t.level === level) || CONTRIBUTOR_TIERS[0];
    return { tier: byLevel, resolvedPoints: byLevel.minPoints };
  }

  return { tier: CONTRIBUTOR_TIERS[0], resolvedPoints: 0 };
}

export default function ContributorLevelPill({
  points,
  totalDonated,
  level,
  size = 'md',
  showName = true,
  hideLevelZero = false,
  clickable = true,
  className = '',
}: ContributorLevelPillProps) {
  const { tier, resolvedPoints } = resolveTier({ points, totalDonated, level });

  if (hideLevelZero && tier.level === 0) {
    return null;
  }

  const Icon = getTierIcon(tier.level);
  const isRainbow = tier.effect === 'singularity';
  const isSmall = size === 'sm';

  const tooltip =
    tier.level === 0
      ? `Nível 0 · ${tier.name}`
      : `Nível ${tier.level} · ${tier.name} (${resolvedPoints} ${
          resolvedPoints === 1 ? 'ponto' : 'pontos'
        } de contribuinte)`;

  const pillStyle: CSSProperties = {
    color: tier.color,
    backgroundColor: tier.badgeBg,
    borderColor: tier.badgeBorder,
    ['--tier-glow' as string]: tier.glowRgba,
  };

  const innerPill = (
    <span
      style={isRainbow ? { ['--tier-glow' as string]: tier.glowRgba } : pillStyle}
      title={tooltip}
      className={`relative overflow-hidden inline-flex items-center gap-1.5 rounded-full border font-mono font-bold tracking-tight select-none transition-transform hover:scale-[1.02] cl-pill-${tier.effect} ${
        isSmall ? 'px-2.5 py-0.5 text-[10px]' : 'px-3 py-1 text-[11px]'
      } ${isRainbow ? 'border-transparent' : ''} ${className}`}
    >
      <Icon className={isSmall ? 'w-3 h-3 shrink-0' : 'w-3.5 h-3.5 shrink-0'} />
      <span>LVL {tier.level}</span>
      {showName && (
        <>
          <span className="opacity-45">·</span>
          <span className={isRainbow ? 'cl-pill-rainbow-text' : ''}>
            {tier.name}
          </span>
        </>
      )}
    </span>
  );

  // LVL 5 (Singularidade) ganha moldura fina prismática animada ao redor da pill
  const wrappedPill = isRainbow ? (
    <span className="relative inline-flex p-[1.5px] rounded-full overflow-hidden cl-pill-rainbow-ring align-middle">
      <span className="relative rounded-full bg-background flex items-center">
        {innerPill}
      </span>
    </span>
  ) : (
    innerPill
  );

  return (
    <>
      <style jsx global>{`
        @keyframes clPillSheen {
          0% {
            transform: translateX(-160%) skewX(-24deg);
          }
          50%,
          100% {
            transform: translateX(260%) skewX(-24deg);
          }
        }

        @keyframes clPillPulse {
          0%,
          100% {
            box-shadow: 0 0 0 0 var(--tier-glow, rgba(56, 189, 248, 0.2));
          }
          50% {
            box-shadow: 0 0 14px 1px var(--tier-glow, rgba(56, 189, 248, 0.3));
          }
        }

        @keyframes clPillRainbowShift {
          0% {
            background-position: 0% 50%;
          }
          50% {
            background-position: 100% 50%;
          }
          100% {
            background-position: 0% 50%;
          }
        }

        @keyframes clPillSpin {
          from {
            transform: rotate(0deg);
          }
          to {
            transform: rotate(360deg);
          }
        }

        .cl-pill-ember {
          animation: clPillPulse 3.6s ease-in-out infinite;
        }
        .cl-pill-ember::after {
          content: '';
          position: absolute;
          inset: 0;
          width: 45%;
          background: linear-gradient(
            90deg,
            transparent,
            rgba(251, 146, 60, 0.35),
            transparent
          );
          animation: clPillSheen 4.4s ease-in-out infinite;
          pointer-events: none;
        }

        .cl-pill-prism {
          box-shadow: 0 0 10px rgba(125, 211, 252, 0.2);
        }
        .cl-pill-prism::after {
          content: '';
          position: absolute;
          inset: 0;
          width: 55%;
          background: linear-gradient(
            90deg,
            transparent,
            rgba(56, 189, 248, 0.25),
            rgba(255, 255, 255, 0.48),
            rgba(167, 139, 250, 0.25),
            transparent
          );
          animation: clPillSheen 3.4s ease-in-out infinite;
          pointer-events: none;
        }

        .cl-pill-gold {
          animation: clPillPulse 3s ease-in-out infinite;
        }
        .cl-pill-gold::after {
          content: '';
          position: absolute;
          inset: 0;
          width: 55%;
          background: linear-gradient(
            90deg,
            transparent,
            rgba(254, 240, 138, 0.5),
            transparent
          );
          animation: clPillSheen 2.9s ease-in-out infinite;
          pointer-events: none;
        }

        .cl-pill-sapphire {
          animation: clPillPulse 2.6s ease-in-out infinite;
        }
        .cl-pill-sapphire::after {
          content: '';
          position: absolute;
          inset: 0;
          width: 55%;
          background: linear-gradient(
            90deg,
            transparent,
            rgba(125, 211, 252, 0.55),
            transparent
          );
          animation: clPillSheen 2.5s ease-in-out infinite;
          pointer-events: none;
        }

        .cl-pill-singularity {
          color: #1e293b;
          background: linear-gradient(
            90deg,
            rgba(66, 133, 244, 0.18),
            rgba(234, 67, 53, 0.16),
            rgba(251, 188, 5, 0.2),
            rgba(52, 168, 83, 0.18),
            rgba(66, 133, 244, 0.18)
          );
          background-size: 260% 260%;
          animation: clPillRainbowShift 4.5s ease infinite;
        }

        html[data-theme='dark'] .cl-pill-singularity {
          color: #f8fafc;
        }

        .cl-pill-rainbow-ring::before {
          content: '';
          position: absolute;
          inset: -120%;
          background: conic-gradient(
            from 0deg,
            #4285f4,
            #ea4335,
            #fbbc05,
            #34a853,
            #9b72cb,
            #4285f4
          );
          animation: clPillSpin 6s linear infinite;
          pointer-events: none;
        }

        .cl-pill-rainbow-text {
          background: linear-gradient(
            90deg,
            #4285f4,
            #ea4335,
            #d99b00,
            #2e9e4c,
            #8b5cf6,
            #4285f4
          );
          background-size: 220% auto;
          -webkit-background-clip: text;
          background-clip: text;
          color: transparent;
          animation: clPillRainbowShift 5s linear infinite;
        }

        @media (prefers-reduced-motion: reduce) {
          .cl-pill-ember,
          .cl-pill-ember::after,
          .cl-pill-prism::after,
          .cl-pill-gold,
          .cl-pill-gold::after,
          .cl-pill-sapphire,
          .cl-pill-sapphire::after,
          .cl-pill-singularity,
          .cl-pill-rainbow-ring::before,
          .cl-pill-rainbow-text {
            animation: none !important;
          }
        }
      `}</style>

      {clickable ? (
        <Link href="/apoie" className="inline-flex items-center">
          {wrappedPill}
        </Link>
      ) : (
        wrappedPill
      )}
    </>
  );
}