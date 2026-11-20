'use client';

import { useId, type CSSProperties } from 'react';
import './brand.css';

const ARMS = [0, 45, 90, 135];

const MASK_SVG = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 200 200"><g transform="translate(100 100)">${ARMS.map(
  (a) => `<rect x="-17" y="-86" width="34" height="172" rx="6" transform="rotate(${a})"/>`
).join('')}<circle r="26"/></g></svg>`;

const MASK_URL = `url("data:image/svg+xml,${encodeURIComponent(MASK_SVG)}")`;

interface InsightAsteriskProps {
  /** 'gradient' = azul oficial; 'solid' = usa `color` (ou currentColor). */
  fill?: 'gradient' | 'solid';
  color?: string;
  stroke?: string;
  className?: string;
  style?: CSSProperties;
}

/**
 * Asterisco de 8 pontas do Insight — fonte única para logo, spinners e loaders.
 * Ocupa 100% do contêiner; giros e halos ficam por conta de quem usa.
 * Com o Rainbow do Insight Nitro ativo, troca para o espectro animado.
 */
export function InsightAsterisk({ fill = 'gradient', color, stroke, className = '', style }: InsightAsteriskProps) {
  const gradientId = `ia-grad-${useId().replace(/:/g, '')}`;
  const paint = fill === 'gradient' ? `url(#${gradientId})` : color || 'currentColor';

  return (
    <span
      className={`insight-asterisk ${className}`}
      style={{ ...style, ['--ia-mask' as string]: MASK_URL } as CSSProperties}
      aria-hidden
    >
      <svg viewBox="0 0 200 200" className="ia-base">
        {fill === 'gradient' && (
          <defs>
            <linearGradient id={gradientId} x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="#60a5fa" />
              <stop offset="50%" stopColor="#3898ec" />
              <stop offset="100%" stopColor="#2563eb" />
            </linearGradient>
          </defs>
        )}
        <g transform="translate(100, 100)">
          {ARMS.map((angle) => (
            <rect
              key={angle}
              x="-17"
              y="-86"
              width="34"
              height="172"
              rx="6"
              ry="6"
              transform={`rotate(${angle})`}
              fill={paint}
              stroke={stroke}
              strokeWidth={stroke ? 1.5 : undefined}
            />
          ))}
          <circle r="26" fill={paint} />
        </g>
      </svg>
      <span className="ia-rainbow" />
    </span>
  );
}
