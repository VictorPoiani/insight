/**
 * Tags ilustradas do Insight Nitro — ícone próprio (16×16) + cenário animado
 * de fundo (120×20, cortado para cobrir a pílula). Desenhos originais, sem lucide.
 * Animações só com transform/opacity (classes ta-* em nitro.css).
 */
import type { ReactNode } from 'react';

export interface TagArt {
  icon: ReactNode;
  scene: ReactNode;
}

const K = '#0b1020'; // contorno

/** Repete um padrão 2× na horizontal para rolar sem emenda (ta-scroll). */
function Loop({ children, cls = 'ta-scroll' }: { children: ReactNode; cls?: string }) {
  return (
    <g className={cls}>
      {children}
      <g transform="translate(120 0)">{children}</g>
    </g>
  );
}

export const TAG_ART: Record<string, TagArt> = {
  // ------------------------------------------------------------ MEMES BR
  'tag-caneta-azul': {
    icon: (
      <g>
        <path d="M3 13 L11 3.5 L13 5.5 L5 14.5 Z" fill="#2563eb" stroke={K} strokeWidth="0.9" strokeLinejoin="round" />
        <path d="M11 3.5 L12.4 2.2 L14.3 4.1 L13 5.5 Z" fill="#93c5fd" stroke={K} strokeWidth="0.9" />
        <path d="M3 13 L2.2 15.4 L5 14.5 Z" fill="#fde68a" stroke={K} strokeWidth="0.8" />
        <path d="M4.6 11.4 L10.6 4.4" stroke="#fff" strokeOpacity="0.6" strokeWidth="0.7" />
      </g>
    ),
    scene: (
      <g>
        {[5, 10, 15].map((y) => (
          <line key={y} x1="0" x2="120" y1={y} y2={y} stroke="#93c5fd" strokeOpacity="0.55" strokeWidth="0.5" />
        ))}
        <line x1="8" x2="8" y1="0" y2="20" stroke="#fca5a5" strokeOpacity="0.7" strokeWidth="0.6" />
        <path
          className="ta-draw"
          pathLength={100}
          d="M14 13 C 22 4, 28 18, 36 9 S 50 15, 58 8 S 74 16, 82 9 S 98 14, 112 7"
          fill="none"
          stroke="#1d4ed8"
          strokeWidth="1.4"
          strokeLinecap="round"
          opacity="0.75"
        />
      </g>
    ),
  },
  'tag-bora-bill': {
    icon: (
      <g>
        <rect x="1.5" y="2" width="13" height="1.8" rx="0.6" fill="#facc15" stroke={K} strokeWidth="0.8" />
        <path d="M2 3.8 C 2 9, 4.5 12, 6.6 14.5 L2 14.5 Z" fill="#dc2626" stroke={K} strokeWidth="0.8" strokeLinejoin="round" />
        <path d="M14 3.8 C 14 9, 11.5 12, 9.4 14.5 L14 14.5 Z" fill="#dc2626" stroke={K} strokeWidth="0.8" strokeLinejoin="round" />
        <circle cx="8" cy="10.5" r="1.6" fill="#fef3c7" stroke={K} strokeWidth="0.7" />
      </g>
    ),
    scene: (
      <g>
        <ellipse className="ta-pulse" cx="60" cy="16" rx="26" ry="7" fill="#fde68a" opacity="0.35" />
        <path d="M0 0 H22 C 18 8, 14 14, 6 20 H0 Z" fill="#b91c1c" />
        <path d="M120 0 H98 C 102 8, 106 14, 114 20 H120 Z" fill="#b91c1c" />
        {[4, 9, 14].map((x) => (
          <path key={x} d={`M${x} 0 C ${x - 2} 8, ${x - 4} 14, ${x - 7} 20`} stroke="#7f1d1d" strokeWidth="0.8" fill="none" />
        ))}
        {[106, 111, 116].map((x) => (
          <path key={x} d={`M${x} 0 C ${x + 2} 8, ${x + 4} 14, ${x + 7} 20`} stroke="#7f1d1d" strokeWidth="0.8" fill="none" />
        ))}
        <rect x="0" y="0" width="120" height="2.2" fill="#facc15" opacity="0.8" />
      </g>
    ),
  },
  'tag-receba': {
    icon: (
      <g>
        <path d="M4 2.5 H12 V6 C 12 9, 10 10.5, 8 10.5 C 6 10.5, 4 9, 4 6 Z" fill="#facc15" stroke={K} strokeWidth="0.9" strokeLinejoin="round" />
        <path d="M4 3.6 H2 C 2 6, 3 7, 4.4 7.3 M12 3.6 H14 C 14 6, 13 7, 11.6 7.3" fill="none" stroke={K} strokeWidth="0.9" />
        <rect x="7" y="10.5" width="2" height="2.2" fill="#ca8a04" stroke={K} strokeWidth="0.7" />
        <rect x="4.5" y="12.7" width="7" height="2" rx="0.6" fill="#a16207" stroke={K} strokeWidth="0.8" />
        <path d="M6 4 V6.6" stroke="#fff" strokeOpacity="0.7" strokeWidth="0.8" strokeLinecap="round" />
      </g>
    ),
    scene: (
      <g>
        {[
          [8, '#ef4444', 0],
          [22, '#22c55e', 0.6],
          [37, '#3b82f6', 1.1],
          [52, '#ffffff', 0.3],
          [68, '#ec4899', 0.9],
          [83, '#22c55e', 1.5],
          [97, '#ef4444', 0.4],
          [111, '#3b82f6', 1.2],
        ].map(([x, c, d]) => (
          <rect
            key={x as number}
            className="ta-fall"
            style={{ animationDelay: `${d}s` }}
            x={x as number}
            y="-4"
            width="2.4"
            height="3.4"
            rx="0.4"
            fill={c as string}
          />
        ))}
      </g>
    ),
  },
  'tag-ai-dentu': {
    icon: (
      <g>
        <path d="M3 12.5 C 6 11, 7 5, 9.5 2.5 C 10 6, 11.5 9.5, 13.5 12.5 Z" fill="#64748b" stroke={K} strokeWidth="0.9" strokeLinejoin="round" />
        <path d="M1 13.5 C 3 12.3, 5 14.7, 7.5 13.5 S 12 12.3, 15 13.5" fill="none" stroke="#38bdf8" strokeWidth="1.3" strokeLinecap="round" />
        <path d="M8.6 5 C 8 7, 7.4 9, 6.6 11" stroke="#fff" strokeOpacity="0.5" strokeWidth="0.7" fill="none" />
      </g>
    ),
    scene: (
      <g>
        <g className="ta-sweep">
          <path d="M-14 14 C -10 12, -9 6, -6 3 C -5 7, -4 10, -1 14 Z" fill="#475569" stroke="#0f172a" strokeWidth="0.6" />
        </g>
        <Loop>
          <path d="M0 14 Q 7.5 11 15 14 T 30 14 T 45 14 T 60 14 T 75 14 T 90 14 T 105 14 T 120 14 V20 H0 Z" fill="#0ea5e9" opacity="0.65" />
          <path d="M0 17 Q 10 15 20 17 T 40 17 T 60 17 T 80 17 T 100 17 T 120 17 V20 H0 Z" fill="#0369a1" opacity="0.8" />
        </Loop>
      </g>
    ),
  },
  'tag-pave-pacume': {
    icon: (
      <g>
        <rect x="2" y="5" width="12" height="9.5" rx="1.2" fill="#fef3c7" stroke={K} strokeWidth="0.9" />
        <rect x="2" y="7.4" width="12" height="2" fill="#92400e" />
        <rect x="2" y="11.2" width="12" height="1.6" fill="#facc15" />
        <circle cx="10.5" cy="3.6" r="1.8" fill="#dc2626" stroke={K} strokeWidth="0.8" />
        <path d="M10.5 1.8 C 11 0.8, 12 0.6, 12.8 0.8" stroke="#166534" strokeWidth="0.8" fill="none" />
      </g>
    ),
    scene: (
      <g>
        <rect x="0" y="0" width="120" height="5" fill="#fffbeb" />
        <rect x="0" y="5" width="120" height="4" fill="#78350f" opacity="0.55" />
        <rect x="0" y="9" width="120" height="4" fill="#fde68a" opacity="0.8" />
        <rect x="0" y="13" width="120" height="3" fill="#78350f" opacity="0.45" />
        <rect x="0" y="16" width="120" height="4" fill="#fef3c7" />
        {[18, 52, 88].map((x, i) => (
          <circle key={x} className="ta-bob" style={{ animationDelay: `${i * 0.4}s` }} cx={x} cy="3" r="2.2" fill="#dc2626" opacity="0.85" />
        ))}
      </g>
    ),
  },
  'tag-complicado': {
    icon: (
      <g>
        <rect x="2" y="2" width="12" height="5" rx="1" fill="#334155" stroke={K} strokeWidth="0.9" />
        <rect x="2" y="8.5" width="12" height="5" rx="1" fill="#334155" stroke={K} strokeWidth="0.9" />
        <circle cx="4.5" cy="4.5" r="0.9" fill="#22c55e" />
        <circle cx="4.5" cy="11" r="0.9" fill="#ef4444" />
        <path d="M11 9.6 L13 13 H9 Z" fill="#facc15" stroke={K} strokeWidth="0.6" strokeLinejoin="round" />
      </g>
    ),
    scene: (
      <g>
        {Array.from({ length: 10 }, (_, i) => (
          <g key={i} transform={`translate(${i * 12 + 1} 2)`}>
            <rect width="10" height="16" rx="1" fill="#1f2937" stroke="#374151" strokeWidth="0.5" />
            {[3, 7, 11].map((y, j) => (
              <circle
                key={y}
                className="ta-blink"
                style={{ animationDelay: `${((i * 3 + j) % 7) * 0.23}s` }}
                cx="2.4"
                cy={y}
                r="0.8"
                fill={(i + j) % 4 === 0 ? '#ef4444' : '#22c55e'}
              />
            ))}
          </g>
        ))}
      </g>
    ),
  },
  'tag-this-is-fine': {
    icon: (
      <g>
        <path d="M3.5 6 H11 V12.5 C 11 13.6, 10.1 14.5, 9 14.5 H5.5 C 4.4 14.5, 3.5 13.6, 3.5 12.5 Z" fill="#fef3c7" stroke={K} strokeWidth="0.9" />
        <path d="M11 7.5 C 13.5 7.5, 13.5 11.5, 11 11.5" fill="none" stroke={K} strokeWidth="0.9" />
        <path d="M5.5 4.5 C 5 3.5, 6.5 2.6, 6 1.4 M8.5 4.5 C 8 3.5, 9.5 2.6, 9 1.4" stroke="#94a3b8" strokeWidth="0.8" fill="none" strokeLinecap="round" />
        <path d="M5 9 H9.5" stroke="#92400e" strokeWidth="1.2" />
      </g>
    ),
    scene: (
      <g>
        {Array.from({ length: 12 }, (_, i) => (
          <path
            key={i}
            className="ta-flicker"
            style={{ animationDelay: `${(i % 5) * 0.17}s` }}
            d={`M${i * 10 + 1} 20 C ${i * 10 + 1} 15, ${i * 10 + 4} 13, ${i * 10 + 5} ${9 + (i % 3) * 2} C ${i * 10 + 6} 13, ${i * 10 + 9} 15, ${i * 10 + 9} 20 Z`}
            fill={i % 2 ? '#f97316' : '#facc15'}
            opacity="0.85"
          />
        ))}
      </g>
    ),
  },
  'tag-404': {
    icon: (
      <g>
        <circle cx="6.5" cy="6.5" r="4.5" fill="#0e7490" fillOpacity="0.35" stroke="#a5f3fc" strokeWidth="1.3" />
        <path d="M10 10 L14.2 14.2" stroke="#a5f3fc" strokeWidth="1.8" strokeLinecap="round" />
        <path d="M5.2 5.2 C 5.2 3.8, 7.8 3.8, 7.8 5.2 C 7.8 6.2, 6.5 6.2, 6.5 7.2" stroke="#fff" strokeWidth="0.9" fill="none" strokeLinecap="round" />
        <circle cx="6.5" cy="8.6" r="0.5" fill="#fff" />
      </g>
    ),
    scene: (
      <g fontFamily="ui-monospace, monospace" fontWeight="800" fontSize="8">
        <text x="78" y="14" fill="#22d3ee" opacity="0.28">404</text>
        <text className="ta-glitch" x="78" y="14" fill="#f472b6" opacity="0.35">404</text>
        {[3, 9, 15].map((y, i) => (
          <rect key={y} className="ta-glitch" style={{ animationDelay: `${i * 0.37}s` }} x="0" y={y} width="120" height="1.3" fill="#22d3ee" opacity="0.18" />
        ))}
      </g>
    ),
  },
  'tag-plot-twist': {
    icon: (
      <g>
        <path d="M3 13 C 3 6, 13 10, 13 3.5" fill="none" stroke="#f0abfc" strokeWidth="1.8" strokeLinecap="round" />
        <path d="M10.5 3.3 L13 3.2 L13.2 5.8" fill="none" stroke="#f0abfc" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
        <circle cx="3" cy="13" r="1.4" fill="#fff" stroke={K} strokeWidth="0.6" />
      </g>
    ),
    scene: (
      <g>
        <g className="ta-spin" style={{ transformOrigin: '92px 10px' }}>
          {Array.from({ length: 6 }, (_, i) => (
            <path
              key={i}
              transform={`rotate(${i * 60} 92 10)`}
              d="M92 10 C 96 6, 104 7, 106 12"
              fill="none"
              stroke={i % 2 ? '#c084fc' : '#f472b6'}
              strokeWidth="1.6"
              strokeLinecap="round"
              opacity="0.6"
            />
          ))}
        </g>
      </g>
    ),
  },

  // ------------------------------------------------------------ K-POP
  'tag-bias-wrecked': {
    icon: (
      <g>
        <path d="M8 14 C 2 10, 1 6.5, 2.4 4.4 C 3.8 2.3, 6.6 2.6, 8 4.6 C 9.4 2.6, 12.2 2.3, 13.6 4.4 C 15 6.5, 14 10, 8 14 Z" fill="#f472b6" stroke={K} strokeWidth="0.9" strokeLinejoin="round" />
        <path d="M8 4.6 L6.8 7.4 L9 8.6 L7.4 11.6" fill="none" stroke="#fff" strokeWidth="1" strokeLinejoin="round" />
      </g>
    ),
    scene: (
      <g>
        {[10, 30, 50, 70, 90, 110].map((x, i) => (
          <path
            key={x}
            className="ta-rise"
            style={{ animationDelay: `${i * 0.45}s` }}
            d={`M${x} 18 c -3 -2 -3.5 -4 -2.4 -5 c 1 -1 2 -0.6 2.4 0.3 c 0.4 -0.9 1.4 -1.3 2.4 -0.3 c 1.1 1 0.6 3 -2.4 5 Z`}
            fill={i % 2 ? '#ec4899' : '#f9a8d4'}
          />
        ))}
      </g>
    ),
  },
  'tag-ending-fairy': {
    icon: (
      <g>
        <path d="M8 1.5 L9.5 6.5 L14.5 8 L9.5 9.5 L8 14.5 L6.5 9.5 L1.5 8 L6.5 6.5 Z" fill="#fde68a" stroke={K} strokeWidth="0.8" strokeLinejoin="round" />
        <circle cx="8" cy="8" r="1.6" fill="#fff" />
        <circle cx="13" cy="3" r="0.9" fill="#f0abfc" />
        <circle cx="3" cy="13" r="0.7" fill="#a5f3fc" />
      </g>
    ),
    scene: (
      <g>
        <path className="ta-pulse" d="M80 0 L104 0 L118 20 L66 20 Z" fill="#fef9c3" opacity="0.2" />
        {[[12, 5], [28, 14], [44, 6], [62, 13], [86, 4], [102, 12], [114, 6]].map(([x, y], i) => (
          <path
            key={i}
            className="ta-twinkle"
            style={{ animationDelay: `${i * 0.3}s`, transformOrigin: `${x}px ${y}px` }}
            d={`M${x} ${y - 2.4} L${x + 0.7} ${y - 0.7} L${x + 2.4} ${y} L${x + 0.7} ${y + 0.7} L${x} ${y + 2.4} L${x - 0.7} ${y + 0.7} L${x - 2.4} ${y} L${x - 0.7} ${y - 0.7} Z`}
            fill={i % 2 ? '#f0abfc' : '#fef9c3'}
          />
        ))}
      </g>
    ),
  },
  'tag-lightstick': {
    icon: (
      <g>
        <rect x="6.8" y="8" width="2.4" height="7" rx="1" fill="#e5e7eb" stroke={K} strokeWidth="0.8" />
        <circle cx="8" cy="5" r="4" fill="#c084fc" stroke={K} strokeWidth="0.9" />
        <circle cx="8" cy="5" r="2" fill="#fff" fillOpacity="0.85" />
        <path d="M2 1.5 L3 2.5 M14 1.5 L13 2.5 M1 6 H2.2 M15 6 H13.8" stroke="#f0abfc" strokeWidth="0.8" strokeLinecap="round" />
      </g>
    ),
    scene: (
      <g>
        {Array.from({ length: 16 }, (_, i) => (
          <circle
            key={i}
            className="ta-pulse"
            style={{ animationDelay: `${(i % 4) * 0.25}s`, transformOrigin: `${i * 7.5 + 4}px ${14 + (i % 2) * 3}px` }}
            cx={i * 7.5 + 4}
            cy={14 + (i % 2) * 3}
            r="1.8"
            fill={['#c084fc', '#f0abfc', '#a78bfa', '#e879f9'][i % 4]}
            opacity="0.75"
          />
        ))}
      </g>
    ),
  },
  'tag-all-kill': {
    icon: (
      <g>
        <path d="M2 12 L2.6 4 L5.5 7 L8 2.5 L10.5 7 L13.4 4 L14 12 Z" fill="#facc15" stroke={K} strokeWidth="0.9" strokeLinejoin="round" />
        <rect x="2" y="12" width="12" height="2.4" rx="0.6" fill="#ca8a04" stroke={K} strokeWidth="0.8" />
        <path d="M5.5 9.3 L7.3 11 L10.6 7.6" fill="none" stroke="#0a0a0a" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round" />
      </g>
    ),
    scene: (
      <g>
        {[6, 9, 7, 12, 10, 14, 16].map((h, i) => (
          <rect
            key={i}
            className="ta-grow"
            style={{ animationDelay: `${i * 0.12}s`, transformOrigin: `${62 + i * 8}px 20px` }}
            x={58 + i * 8}
            y={20 - h}
            width="6"
            height={h}
            rx="1"
            fill={i === 6 ? '#facc15' : '#a16207'}
            opacity="0.7"
          />
        ))}
      </g>
    ),
  },
  'tag-full-combo': {
    icon: (
      <g>
        <circle cx="8" cy="8" r="6.4" fill="#0284c7" stroke={K} strokeWidth="0.9" />
        <circle cx="8" cy="8" r="4.2" fill="none" stroke="#7dd3fc" strokeWidth="0.8" />
        <path d="M6.6 10.6 V4.6 L11 3.8 V9.6" fill="none" stroke="#fff" strokeWidth="1.1" strokeLinejoin="round" />
        <circle cx="5.6" cy="10.6" r="1.2" fill="#fff" />
        <circle cx="10" cy="9.6" r="1.2" fill="#fff" />
      </g>
    ),
    scene: (
      <g>
        {[5, 10, 15].map((y) => (
          <line key={y} x1="0" x2="120" y1={y} y2={y} stroke="#38bdf8" strokeOpacity="0.25" strokeWidth="0.6" />
        ))}
        <line x1="20" x2="20" y1="2" y2="18" stroke="#fef08a" strokeOpacity="0.6" strokeWidth="1" />
        <Loop cls="ta-scroll-rev">
          {[[10, 5], [28, 10], [40, 15], [56, 5], [70, 10], [86, 15], [98, 10], [112, 5]].map(([x, y], i) => (
            <rect key={i} x={x - 2.5} y={y - 1.5} width="5" height="3" rx="1.5" fill={['#f472b6', '#38bdf8', '#facc15'][i % 3]} opacity="0.85" />
          ))}
        </Loop>
      </g>
    ),
  },

  // ------------------------------------------------------------ FILMES & SÉRIES
  'tag-inevitavel': {
    icon: (
      <g>
        <path d="M3 15 V8 C 3 6.5, 4 6, 5 6 V3.5 C 5 2.6, 6.6 2.6, 6.6 3.5 V6 V2.8 C 6.6 1.9, 8.2 1.9, 8.2 2.8 V6 V3.2 C 8.2 2.3, 9.8 2.3, 9.8 3.2 V6.5 V4.4 C 9.8 3.5, 11.4 3.5, 11.4 4.4 V10 C 11.4 13, 10 15, 8 15 Z" fill="#ca8a04" stroke={K} strokeWidth="0.8" strokeLinejoin="round" />
        {[['#ef4444', 5.8, 4.2], ['#3b82f6', 7.4, 3.6], ['#22c55e', 9, 4], ['#a855f7', 10.6, 5.2], ['#f97316', 7.2, 10], ['#facc15', 4.4, 9]].map(([c, x, y], i) => (
          <circle key={i} cx={x as number} cy={y as number} r="0.8" fill={c as string} />
        ))}
      </g>
    ),
    scene: (
      <g>
        {['#ef4444', '#3b82f6', '#22c55e', '#a855f7', '#f97316', '#facc15'].map((c, i) => (
          <circle
            key={c}
            className="ta-pulse"
            style={{ animationDelay: `${i * 0.28}s`, transformOrigin: `${52 + i * 12}px 10px` }}
            cx={52 + i * 12}
            cy="10"
            r="3.4"
            fill={c}
            opacity="0.55"
          />
        ))}
      </g>
    ),
  },
  'tag-multiverso': {
    icon: (
      <g>
        <circle cx="8" cy="8" r="6.4" fill="#1e1b4b" stroke="#fb923c" strokeWidth="1.6" strokeDasharray="2 1.2" />
        <circle cx="8" cy="8" r="3.8" fill="none" stroke="#fdba74" strokeWidth="1" />
        <circle cx="8" cy="8" r="1.6" fill="#c084fc" />
      </g>
    ),
    scene: (
      <g>
        {[14, 10, 6].map((r, i) => (
          <circle
            key={r}
            className={i % 2 ? 'ta-spin-rev' : 'ta-spin'}
            style={{ transformOrigin: '96px 10px' }}
            cx="96"
            cy="10"
            r={r}
            fill="none"
            stroke={['#fb923c', '#c084fc', '#fdba74'][i]}
            strokeWidth="1.2"
            strokeDasharray={`${r * 0.6} ${r * 0.35}`}
            opacity="0.7"
          />
        ))}
      </g>
    ),
  },
  'tag-nao-olhe': {
    icon: (
      <g>
        <path d="M1.5 8 C 4 4, 12 4, 14.5 8" fill="none" stroke="#e2e8f0" strokeWidth="1.3" strokeLinecap="round" />
        <path d="M3 10 L2 12 M6 11.2 L5.6 13.4 M10 11.2 L10.4 13.4 M13 10 L14 12" stroke="#e2e8f0" strokeWidth="1" strokeLinecap="round" />
        <path d="M1.5 8 C 4 11.5, 12 11.5, 14.5 8" fill="none" stroke="#e2e8f0" strokeWidth="1.3" strokeLinecap="round" />
      </g>
    ),
    scene: (
      <g>
        {[[8, 4], [26, 13], [40, 6], [58, 16], [74, 5], [100, 15], [114, 8]].map(([x, y], i) => (
          <circle key={i} cx={x} cy={y} r="0.6" fill="#fff" opacity="0.7" />
        ))}
        <g className="ta-comet">
          <path d="M-30 -2 L-6 9" stroke="#fdba74" strokeWidth="1.6" strokeLinecap="round" opacity="0.5" />
          <circle cx="-5" cy="9.5" r="2.4" fill="#fde68a" />
        </g>
      </g>
    ),
  },
  'tag-hora-aventura': {
    icon: (
      <g>
        <path d="M12.8 1.6 L14.4 3.2 L6.4 11.2 L4.8 9.6 Z" fill="#e2e8f0" stroke={K} strokeWidth="0.8" strokeLinejoin="round" />
        <path d="M3.4 8.6 L7.4 12.6" stroke="#facc15" strokeWidth="1.6" strokeLinecap="round" />
        <path d="M4.6 11.4 L2 14" stroke="#92400e" strokeWidth="1.6" strokeLinecap="round" />
      </g>
    ),
    scene: (
      <g>
        <circle className="ta-bob" cx="100" cy="5" r="3.4" fill="#fde047" />
        <g className="ta-drift">
          <ellipse cx="30" cy="5" rx="6" ry="2" fill="#fff" opacity="0.85" />
          <ellipse cx="66" cy="3.6" rx="5" ry="1.6" fill="#fff" opacity="0.7" />
        </g>
        <path d="M0 20 C 14 10, 28 10, 42 20 Z" fill="#4ade80" />
        <path d="M30 20 C 50 8, 72 8, 92 20 Z" fill="#22c55e" />
        <path d="M80 20 C 96 12, 110 12, 124 20 Z" fill="#16a34a" />
      </g>
    ),
  },
  'tag-modo-furtivo': {
    icon: (
      <g>
        <path d="M1.5 6 C 4 3.6, 12 3.6, 14.5 6 V9.5 C 12 12, 4 12, 1.5 9.5 Z" fill="#27272a" stroke="#a1a1aa" strokeWidth="0.9" />
        <path d="M3.6 7.6 C 4.6 6.6, 6.4 6.6, 7 7.8 M9 7.8 C 9.6 6.6, 11.4 6.6, 12.4 7.6" stroke="#fafafa" strokeWidth="1.1" strokeLinecap="round" fill="none" />
      </g>
    ),
    scene: (
      <g>
        <circle cx="100" cy="10" r="8" fill="none" stroke="#3f3f46" strokeWidth="0.6" />
        <circle cx="100" cy="10" r="4.5" fill="none" stroke="#3f3f46" strokeWidth="0.6" />
        <g className="ta-spin" style={{ transformOrigin: '100px 10px' }}>
          <path d="M100 10 L108 10 A8 8 0 0 0 104 3.1 Z" fill="#a1a1aa" opacity="0.35" />
        </g>
        <circle className="ta-blink" cx="104" cy="13" r="0.9" fill="#22c55e" />
      </g>
    ),
  },

  // ------------------------------------------------------------ MÚSICA
  'tag-stairway': {
    icon: (
      <g>
        <path d="M1.5 14.5 H5 V11 H8.5 V7.5 H12 V4 H14.5" fill="none" stroke="#1e3a8a" strokeWidth="1.6" strokeLinejoin="round" />
        <path d="M11 2 C 11.5 1, 13 1, 13.4 2 C 14.6 1.8, 15 3, 14.2 3.6 H10.8 C 10 3.2, 10.2 2.1, 11 2 Z" fill="#fff" stroke="#1e3a8a" strokeWidth="0.6" />
      </g>
    ),
    scene: (
      <g>
        <g className="ta-pulse" style={{ transformOrigin: '110px 0px' }}>
          {[0, 1, 2].map((i) => (
            <path key={i} d={`M110 0 L${70 + i * 14} 20 L${76 + i * 14} 20 Z`} fill="#fef3c7" opacity="0.4" />
          ))}
        </g>
        <path d="M54 20 V17 H64 V14 H74 V11 H84 V8 H94 V5 H104 V20 Z" fill="#fff" opacity="0.55" />
        <g className="ta-drift">
          <ellipse cx="22" cy="6" rx="7" ry="2.2" fill="#fff" opacity="0.8" />
          <ellipse cx="40" cy="13" rx="5" ry="1.6" fill="#fff" opacity="0.6" />
        </g>
      </g>
    ),
  },
  'tag-bohemian': {
    icon: (
      <g>
        <rect x="5.6" y="1.5" width="4.8" height="7.5" rx="2.4" fill="#e5e7eb" stroke={K} strokeWidth="0.9" />
        <path d="M6 4 H10 M6 6 H10" stroke="#9ca3af" strokeWidth="0.6" />
        <path d="M3.6 7 C 3.6 10, 5.6 11.4, 8 11.4 C 10.4 11.4, 12.4 10, 12.4 7" fill="none" stroke="#e5e7eb" strokeWidth="1" />
        <path d="M8 11.4 V14.4 M5.6 14.5 H10.4" stroke="#e5e7eb" strokeWidth="1.1" strokeLinecap="round" />
      </g>
    ),
    scene: (
      <g>
        {['#a855f7', '#ec4899', '#f59e0b', '#3b82f6'].map((c, i) => (
          <rect
            key={c}
            className="ta-glow"
            style={{ animationDelay: `${i * 0.5}s` }}
            x={60 + (i % 2) * 30}
            y={i < 2 ? 0 : 10}
            width="30"
            height="10"
            fill={c}
            opacity="0.25"
          />
        ))}
      </g>
    ),
  },
  'tag-solo-guitarra': {
    icon: (
      <g>
        <path d="M10 2 L14 6 L12.6 7.4 L8.6 3.4 Z" fill="#78350f" stroke={K} strokeWidth="0.8" strokeLinejoin="round" />
        <path d="M9.6 6.4 L5.4 10.6" stroke="#a16207" strokeWidth="1.2" />
        <path d="M5.4 8 C 3 7.4, 1.4 9.4, 2.4 11.4 C 2 13.4, 4.4 15, 6 13.6 C 8.6 14, 9 11.4, 7.6 10.4 C 7.4 9, 6.6 8.2, 5.4 8 Z" fill="#ea580c" stroke={K} strokeWidth="0.9" strokeLinejoin="round" />
        <circle cx="5" cy="11.2" r="0.9" fill={K} />
      </g>
    ),
    scene: (
      <g>
        {[0, 1, 2].map((i) => (
          <path
            key={i}
            className="ta-wave"
            style={{ animationDelay: `${i * 0.35}s`, transformOrigin: '60px 10px' }}
            d={`M40 10 Q 50 ${2 + i * 2} 60 10 T 80 10 T 100 10 T 120 10`}
            fill="none"
            stroke={['#fdba74', '#fb923c', '#fed7aa'][i]}
            strokeWidth="1"
            opacity="0.7"
          />
        ))}
      </g>
    ),
  },
  'tag-replay': {
    icon: (
      <g>
        <circle cx="8" cy="8" r="6.6" fill="#111827" stroke={K} strokeWidth="0.8" />
        <circle cx="8" cy="8" r="4.4" fill="none" stroke="#374151" strokeWidth="0.6" />
        <circle cx="8" cy="8" r="2.2" fill="#34d399" />
        <circle cx="8" cy="8" r="0.6" fill="#111827" />
        <path d="M3 4.6 A 5.6 5.6 0 0 1 9.4 2.4" fill="none" stroke="#d1fae5" strokeWidth="0.8" strokeLinecap="round" />
      </g>
    ),
    scene: (
      <g>
        <g className="ta-spin" style={{ transformOrigin: '100px 10px' }}>
          <circle cx="100" cy="10" r="14" fill="#022c22" stroke="#065f46" strokeWidth="0.6" />
          {[11, 8, 5].map((r) => (
            <circle key={r} cx="100" cy="10" r={r} fill="none" stroke="#047857" strokeWidth="0.5" />
          ))}
          <circle cx="100" cy="10" r="3" fill="#34d399" />
          <path d="M100 -4 A14 14 0 0 1 112 3" stroke="#a7f3d0" strokeOpacity="0.5" strokeWidth="1" fill="none" />
        </g>
      </g>
    ),
  },
  'tag-backstage': {
    icon: (
      <g>
        <path d="M5 1.5 L8 5 L11 1.5" fill="none" stroke="#ef4444" strokeWidth="1.2" />
        <rect x="3" y="5" width="10" height="9.5" rx="1.2" fill="#fef08a" stroke={K} strokeWidth="0.9" />
        <rect x="4.5" y="7" width="7" height="2.4" fill={K} />
        <path d="M4.5 11 H11.5 M4.5 12.8 H9" stroke={K} strokeWidth="0.7" />
      </g>
    ),
    scene: (
      <g>
        <g className="ta-swing" style={{ transformOrigin: '70px -2px' }}>
          <path d="M70 -2 L56 22 L84 22 Z" fill="#fef08a" opacity="0.22" />
        </g>
        <g className="ta-swing-rev" style={{ transformOrigin: '104px -2px' }}>
          <path d="M104 -2 L90 22 L118 22 Z" fill="#f0abfc" opacity="0.2" />
        </g>
      </g>
    ),
  },
};
