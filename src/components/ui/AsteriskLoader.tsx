'use client';

import React from 'react';
import { InsightAsterisk } from '@/components/brand/InsightAsterisk';

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

  // Versão inline compacta (para usar dentro do botão da aba ativa)
  if (size === 'xs') {
    return (
      <span
        style={{ width: px, height: px }}
        className={`inline-flex items-center justify-center shrink-0 ${className}`}
      >
        <InsightAsterisk fill="solid" className="w-full h-full animate-spin text-accent" style={{ animationDuration: '1.4s' }} />
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
          <InsightAsterisk fill="gradient" stroke="#93c5fd" className="w-full h-full" />
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