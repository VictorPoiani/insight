'use client';

import React from 'react';

interface AsteriskLoaderProps {
  size?: 'xs' | 'sm' | 'md' | 'lg';
  label?: string;
  fullHeight?: boolean;
  className?: string;
}

const SIZE_MAP = {
  xs: 14,
  sm: 22,
  md: 38,
  lg: 54,
};

export function AsteriskLoader({
  size = 'md',
  label,
  fullHeight = false,
  className = '',
}: AsteriskLoaderProps) {
  const px = SIZE_MAP[size];
  const armAngles = [0, 45, 90, 135];

  // Versão inline compacta (para usar dentro do botão da aba ativa)
  if (size === 'xs') {
    return (
      <span
        style={{ width: px, height: px }}
        className={`inline-flex items-center justify-center shrink-0 ${className}`}
      >
        <svg
          viewBox="0 0 200 200"
          className="w-full h-full animate-spin text-accent"
          style={{ animationDuration: '1.4s' }}
        >
          <g transform="translate(100, 100)">
            {armAngles.map((angle) => (
              <rect
                key={angle}
                x="-18"
                y="-86"
                width="36"
                height="172"
                rx="7"
                ry="7"
                transform={`rotate(${angle})`}
                fill="currentColor"
              />
            ))}
            <circle r="28" fill="currentColor" />
          </g>
        </svg>
      </span>
    );
  }

  return (
    <div
      className={`w-full flex flex-col items-center justify-center gap-3 select-none ${
        fullHeight ? 'min-h-[55vh] py-16' : 'py-12'
      } ${className}`}
    >
      <style jsx>{`
        @keyframes insightAsteriskSpin3D {
          0% {
            transform: perspective(400px) rotateX(14deg) rotateY(-14deg) rotateZ(0deg) scale(0.94);
          }
          50% {
            transform: perspective(400px) rotateX(-14deg) rotateY(14deg) rotateZ(180deg) scale(1.04);
          }
          100% {
            transform: perspective(400px) rotateX(14deg) rotateY(-14deg) rotateZ(360deg) scale(0.94);
          }
        }
      `}</style>

      <div className="relative flex items-center justify-center">
        {/* Halo luminoso sutil atrás do asterisco */}
        <div
          style={{ width: px * 1.45, height: px * 1.45 }}
          className="absolute rounded-full bg-accent/20 blur-xl animate-pulse pointer-events-none"
        />

        {/* Escultura vetorial do Asterisco de 8 pontas girando */}
        <div
          style={{
            width: px,
            height: px,
            animation: 'insightAsteriskSpin3D 1.65s cubic-bezier(0.4, 0, 0.2, 1) infinite',
          }}
          className="relative z-10 drop-shadow-[0_6px_16px_rgba(37,99,235,0.35)]"
        >
          <svg viewBox="0 0 200 200" className="w-full h-full overflow-visible">
            <defs>
              <linearGradient id="insightAsteriskGrad" x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%" stopColor="#60a5fa" />
                <stop offset="50%" stopColor="#3898ec" />
                <stop offset="100%" stopColor="#2563eb" />
              </linearGradient>
            </defs>
            <g transform="translate(100, 100)">
              {armAngles.map((angle) => (
                <rect
                  key={angle}
                  x="-17"
                  y="-86"
                  width="34"
                  height="172"
                  rx="6"
                  ry="6"
                  transform={`rotate(${angle})`}
                  fill="url(#insightAsteriskGrad)"
                  stroke="#93c5fd"
                  strokeWidth="1.5"
                />
              ))}
              <circle r="26" fill="url(#insightAsteriskGrad)" />
            </g>
          </svg>
        </div>
      </div>

      {label && (
        <span className="text-xs font-mono font-medium text-muted tracking-wide animate-pulse">
          {label}
        </span>
      )}
    </div>
  );
}