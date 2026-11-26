/** Desenho da fase da lua (0 = nova, 0.5 = cheia), em traço do Insight. */
export function MoonPhase({ phase, size = 14, color = '#e5e7eb', title }: { phase: number; size?: number; color?: string; title?: string }) {
  const r = size / 2 - 1;
  const c = size / 2;
  // iluminação: 0..1..0 ao longo do ciclo
  const lit = phase <= 0.5 ? phase * 2 : (1 - phase) * 2;
  const waxing = phase < 0.5;
  // elipse do terminador: largura vai de r (nova/cheia) a 0 (quartos)
  const rx = Math.abs(1 - 2 * lit) * r;
  const sweepOuter = waxing ? 1 : 0;
  const sweepInner = lit < 0.5 ? (waxing ? 0 : 1) : waxing ? 1 : 0;
  const d =
    lit <= 0.02
      ? ''
      : lit >= 0.98
      ? `M${c} ${c - r} a${r} ${r} 0 1 1 0 ${2 * r} a${r} ${r} 0 1 1 0 ${-2 * r}`
      : `M${c} ${c - r} A${r} ${r} 0 0 ${sweepOuter} ${c} ${c + r} A${rx} ${r} 0 0 ${sweepInner} ${c} ${c - r}`;
  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} role={title ? 'img' : undefined} aria-label={title} className="shrink-0">
      {title && <title>{title}</title>}
      <circle cx={c} cy={c} r={r} fill="none" stroke={color} strokeOpacity="0.45" strokeWidth="1" />
      {d && <path d={d} fill={color} />}
    </svg>
  );
}
