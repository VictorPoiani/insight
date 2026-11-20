'use client';

import './brand.css';

/** Logo "Insight*". Com o Rainbow do Insight Nitro ativo, ganha o espectro animado. */
export function InsightLogo({ className = '' }: { className?: string }) {
  return (
    <span className={`insight-logo ${className}`}>
      <span className="il-text text-primary">Insight</span>
      <span className="il-star">*</span>
    </span>
  );
}
