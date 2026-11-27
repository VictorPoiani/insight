'use client';

import { useEffect, useState } from 'react';

/** "agora", "há 5 min", "há 3 h", "ontem", "há 4 dias", "há 2 sem.", "há 3 meses", "há 1 ano". */
export function relativeTime(date: Date, now = Date.now()): string {
  const s = Math.max(0, Math.round((now - date.getTime()) / 1000));
  if (s < 45) return 'agora';
  const m = Math.round(s / 60);
  if (m < 60) return `há ${m} min`;
  const h = Math.round(m / 60);
  if (h < 24) return `há ${h} h`;
  const d = Math.round(h / 24);
  if (d === 1) return 'ontem';
  if (d < 7) return `há ${d} dias`;
  if (d < 30) return `há ${Math.round(d / 7)} sem.`;
  const mo = Math.round(d / 30);
  if (mo < 12) return `há ${mo} ${mo === 1 ? 'mês' : 'meses'}`;
  const y = Math.round(d / 365);
  return `há ${y} ${y === 1 ? 'ano' : 'anos'}`;
}

/** "21 nov. 2026, 14:32" (hora local de quem vê). */
export function exactTime(date: Date): string {
  return `${date.toLocaleDateString('pt-BR', { day: '2-digit', month: 'short', year: 'numeric' }).replace(/ de /g, ' ')}, ${date.toLocaleTimeString('pt-BR', {
    hour: '2-digit',
    minute: '2-digit',
  })}`;
}

/**
 * Hora do post: há quanto tempo + data e hora exatas. Atualiza sozinho a cada
 * minuto; o texto completo (com segundos e dia da semana) fica no título.
 * `compact` mostra só o relativo ("há 3 h").
 */
export function PostTime({ iso, className = '', compact = false }: { iso: string; className?: string; compact?: boolean }) {
  const date = new Date(iso);
  const [now, setNow] = useState<number | null>(null);

  useEffect(() => {
    setNow(Date.now());
    const t = setInterval(() => setNow(Date.now()), 60_000);
    return () => clearInterval(t);
  }, []);

  if (Number.isNaN(date.getTime())) return null;
  const full = date.toLocaleString('pt-BR', {
    weekday: 'long',
    day: '2-digit',
    month: 'long',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  });

  return (
    <time dateTime={iso} title={full} className={className}>
      {/* relativo só no cliente (evita diferença entre servidor e navegador) */}
      {now !== null && <span>{relativeTime(date, now)}</span>}
      {/* compacto: só o relativo; a data exata fica no título (passar o mouse) */}
      {now !== null && !compact && <span aria-hidden="true"> · </span>}
      {(!compact || now === null) && <span>{exactTime(date)}</span>}
    </time>
  );
}
