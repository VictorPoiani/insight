/**
 * Molduras ilustradas — anime clássico, datas comemorativas e animais queridos.
 * Mesmo padrão de critters.ts: viewBox 0–100, avatar = círculo (50,50) r 36.8,
 * `back` atrás da foto e `front` por cima; animação só com transform/opacity
 * (classes nx-a + cr-* em nitro.css). Desenhos originais do Insight.
 */

const L = '#2b1b17';
const MIRROR = 'transform="translate(100 0) scale(-1 1)"';

/** Brilho de 4 pontas. */
function sparkle(x: number, y: number, s: number, color: string, delay = 0) {
  return `<path class="nx-a cr-tw" style="transform-origin:${x}px ${y}px;animation-delay:${delay}s" d="M${x} ${y - s} C ${x + s * 0.15} ${y - s * 0.15}, ${x + s * 0.15} ${y - s * 0.15}, ${x + s} ${y} C ${x + s * 0.15} ${y + s * 0.15}, ${x + s * 0.15} ${y + s * 0.15}, ${x} ${y + s} C ${x - s * 0.15} ${y + s * 0.15}, ${x - s * 0.15} ${y + s * 0.15}, ${x - s} ${y} C ${x - s * 0.15} ${y - s * 0.15}, ${x - s * 0.15} ${y - s * 0.15}, ${x} ${y - s} Z" fill="${color}"/>`;
}

function heart(x: number, y: number, s: number, fill: string, stroke = L) {
  return `<path d="M${x} ${y + s * 0.9} C ${x - s * 1.4} ${y}, ${x - s * 1.1} ${y - s * 1.1}, ${x - s * 0.5} ${y - s * 1.05} C ${x - s * 0.15} ${y - s}, ${x} ${y - s * 0.7}, ${x} ${y - s * 0.55} C ${x} ${y - s * 0.7}, ${x + s * 0.15} ${y - s}, ${x + s * 0.5} ${y - s * 1.05} C ${x + s * 1.1} ${y - s * 1.1}, ${x + s * 1.4} ${y}, ${x} ${y + s * 0.9} Z" fill="${fill}" stroke="${stroke}" stroke-width="0.7" stroke-linejoin="round"/>`;
}

// ============================================================================
// PERGAMINHO NINJA — faixa com placa, kunais cruzadas, shuriken e fumaça
// ============================================================================

const ninja = {
  back: `
  <defs>
    <linearGradient id="njPaper" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#fdf3d8"/><stop offset="1" stop-color="#e6cf9c"/></linearGradient>
    <linearGradient id="njRod" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#a0522d"/><stop offset="0.5" stop-color="#d98c4a"/><stop offset="1" stop-color="#6b3410"/></linearGradient>
  </defs>
  <!-- pergaminho aberto atrás da foto -->
  <path d="M14 26 C 30 22, 70 22, 86 26 L 86 40 C 70 36, 30 36, 14 40 Z" fill="url(#njPaper)" stroke="${L}" stroke-width="0.9"/>
  <path d="M20 29 L 26 29 M20 32 L 30 32 M74 29 L 80 29 M70 32 L 80 32" stroke="#7c5a2a" stroke-width="0.8" stroke-linecap="round" opacity="0.55"/>
  <rect x="10.5" y="23" width="5" height="19" rx="2.4" fill="url(#njRod)" stroke="${L}" stroke-width="0.8"/>
  <rect x="84.5" y="23" width="5" height="19" rx="2.4" fill="url(#njRod)" stroke="${L}" stroke-width="0.8"/>
  <rect x="11.6" y="21" width="2.8" height="23" rx="1.2" fill="#3f2414"/>
  <rect x="85.6" y="21" width="2.8" height="23" rx="1.2" fill="#3f2414"/>`,
  front: `
  <defs>
    <linearGradient id="njCloth" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#334155"/><stop offset="1" stop-color="#0f172a"/></linearGradient>
    <linearGradient id="njMetal" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#f1f5f9"/><stop offset="0.45" stop-color="#94a3b8"/><stop offset="1" stop-color="#475569"/></linearGradient>
    <linearGradient id="njBlade" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#cbd5e1"/><stop offset="0.5" stop-color="#ffffff"/><stop offset="1" stop-color="#64748b"/></linearGradient>
  </defs>
  <!-- faixa na testa com placa metálica -->
  <path d="M22 22 C 34 15, 66 15, 78 22 L 76.5 27 C 64 21, 36 21, 23.5 27 Z" fill="url(#njCloth)" stroke="${L}" stroke-width="0.9" stroke-linejoin="round"/>
  <rect x="38" y="15.5" width="24" height="10" rx="2" fill="url(#njMetal)" stroke="${L}" stroke-width="0.9"/>
  <rect x="39.4" y="16.8" width="21.2" height="7.4" rx="1.4" fill="none" stroke="#ffffff" stroke-opacity="0.55" stroke-width="0.5"/>
  ${[41, 59].map((x) => `<circle cx="${x}" cy="20.5" r="0.8" fill="#334155"/>`).join('')}
  <text x="50" y="23.6" text-anchor="middle" font-size="7" font-weight="900" fill="#1e293b" font-family="serif">忍</text>
  <path d="M40 17.4 L 47 17.4" stroke="#fff" stroke-opacity="0.8" stroke-width="0.6" stroke-linecap="round"/>
  <!-- pontas da faixa ao vento -->
  <g class="nx-a cr-flutter" style="transform-origin:78px 23px">
    <path d="M77.5 22.5 C 84 24, 89 22, 94 25.5 C 90 27, 86 28.5, 80 26.4 Z" fill="url(#njCloth)" stroke="${L}" stroke-width="0.8" stroke-linejoin="round"/>
    <path d="M77 24.5 C 82 28, 86 30, 90 34 C 85 34.4, 81 31.6, 77.6 27.4 Z" fill="url(#njCloth)" stroke="${L}" stroke-width="0.8" stroke-linejoin="round"/>
  </g>
  <!-- duas kunais cruzadas -->
  ${[0, 1].map((i) => `
  <g transform="translate(${i ? 30 : 18} 88) rotate(${i ? 35 : -35})">
    <path d="M0 -15 L 2.6 -5 L 0 -3.6 L -2.6 -5 Z" fill="url(#njBlade)" stroke="${L}" stroke-width="0.7" stroke-linejoin="round"/>
    <rect x="-0.9" y="-3.6" width="1.8" height="8" fill="#1f2937" stroke="${L}" stroke-width="0.5"/>
    ${[-2.4, -0.6, 1.2, 3].map((y) => `<path d="M-0.9 ${y} L 0.9 ${y + 0.9}" stroke="#ef4444" stroke-width="0.5"/>`).join('')}
    <circle cx="0" cy="6.2" r="1.8" fill="none" stroke="#94a3b8" stroke-width="0.9"/>
  </g>`).join('')}
  <!-- shuriken girando -->
  <g transform="translate(83 72)"><g class="nx-a cr-spin" style="transform-origin:0px 0px">
    <path d="M0 -8 L 2 -2 L 8 0 L 2 2 L 0 8 L -2 2 L -8 0 L -2 -2 Z" fill="url(#njMetal)" stroke="${L}" stroke-width="0.8" stroke-linejoin="round"/>
    <circle r="1.6" fill="#0f172a"/>
    <path d="M0 -7 L 1.2 -2.2" stroke="#fff" stroke-width="0.5" opacity="0.8"/>
  </g></g>
  <!-- fumaça -->
  ${[[70, 92, 0], [78, 88, 0.6], [64, 95, 1.2]].map(([x, y, d]) => `<g class="nx-a cr-float" style="animation-delay:${d}s"><circle cx="${x}" cy="${y}" r="4" fill="#e2e8f0" opacity="0.85" stroke="#94a3b8" stroke-width="0.5"/><circle cx="${(x as number) + 3}" cy="${(y as number) - 2}" r="3" fill="#f8fafc" opacity="0.9"/></g>`).join('')}`,
};

// ============================================================================
// GAROTA MÁGICA — broche de coração alado, fitas, varinha de estrela
// ============================================================================

const magical = {
  back: `
  <defs><linearGradient id="mgRib" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#fbcfe8"/><stop offset="1" stop-color="#ec4899"/></linearGradient></defs>
  <path d="M18 64 C 6 70, 4 84, 14 92 C 10 82, 14 74, 22 70 Z" fill="url(#mgRib)" stroke="${L}" stroke-width="0.8"/>
  <path d="M82 64 C 94 70, 96 84, 86 92 C 90 82, 86 74, 78 70 Z" fill="url(#mgRib)" stroke="${L}" stroke-width="0.8"/>`,
  front: `
  <defs>
    <radialGradient id="mgGem" cx="0.35" cy="0.3" r="0.8"><stop offset="0" stop-color="#ffe4f1"/><stop offset="0.45" stop-color="#f472b6"/><stop offset="1" stop-color="#9d174d"/></radialGradient>
    <linearGradient id="mgGold" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#fff7cc"/><stop offset="0.5" stop-color="#facc15"/><stop offset="1" stop-color="#a16207"/></linearGradient>
    <linearGradient id="mgWing" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#ffffff"/><stop offset="1" stop-color="#dbeafe"/></linearGradient>
  </defs>
  <!-- broche: asas + coração + gema -->
  <g class="nx-a cr-bob" style="transform-origin:50px 88px">
    ${[0, 1].map((m) => `<g ${m ? MIRROR : ''}>
      <path d="M44 88 C 36 80, 26 80, 22 84 C 26 86, 28 88, 26 91 C 31 90, 33 92, 33 95 C 37 92, 41 92, 44 92 Z" fill="url(#mgWing)" stroke="${L}" stroke-width="0.8" stroke-linejoin="round"/>
      <path d="M41 86 C 36 83, 31 83, 27 85 M40 89 C 36 88, 33 89, 31 91" fill="none" stroke="#93c5fd" stroke-width="0.6"/>
    </g>`).join('')}
    ${heart(50, 88, 7.5, 'url(#mgGold)')}
    ${heart(50, 88.4, 5, 'url(#mgGem)', '#831843')}
    <ellipse cx="47.6" cy="85.4" rx="1.5" ry="1" fill="#fff" opacity="0.9"/>
  </g>
  <!-- varinha de estrela -->
  <g class="nx-a cr-swing" style="transform-origin:80px 30px">
    <path d="M80 30 L 92 8" stroke="#f9a8d4" stroke-width="2" stroke-linecap="round"/>
    <path d="M80 30 L 92 8" stroke="#ffffff" stroke-width="0.6" stroke-linecap="round" opacity="0.8"/>
    <path d="M93 1 L 95 6 L 100.5 6.4 L 96.2 9.8 L 97.8 15 L 93 12 L 88.2 15 L 89.8 9.8 L 85.5 6.4 L 91 6 Z" fill="url(#mgGold)" stroke="${L}" stroke-width="0.8" stroke-linejoin="round"/>
    <circle cx="93" cy="9" r="1.8" fill="#fb7185"/>
  </g>
  <!-- laço no topo esquerdo -->
  <g transform="translate(22 18)">
    <path d="M0 0 C -6 -6, -12 -2, -10 3 C -8 7, -3 4, 0 0 Z M0 0 C 6 -6, 12 -2, 10 3 C 8 7, 3 4, 0 0 Z" fill="url(#mgRib)" stroke="${L}" stroke-width="0.8"/>
    <circle r="2.2" fill="#f472b6" stroke="${L}" stroke-width="0.7"/>
  </g>
  ${sparkle(14, 46, 3, '#fde68a')}${sparkle(88, 48, 2.4, '#f9a8d4', 0.5)}${sparkle(30, 8, 2, '#c4b5fd', 1)}${sparkle(70, 96, 2.2, '#fde68a', 1.4)}`,
};

// ============================================================================
// NOITE DAS BRUXAS — abóbora iluminada, morcegos, teia e aranha
// ============================================================================

const halloween = {
  front: `
  <defs>
    <radialGradient id="hwPump" cx="0.4" cy="0.35" r="0.8"><stop offset="0" stop-color="#fdba74"/><stop offset="0.6" stop-color="#f97316"/><stop offset="1" stop-color="#9a3412"/></radialGradient>
    <radialGradient id="hwFire" cx="0.5" cy="0.6" r="0.6"><stop offset="0" stop-color="#fffbeb"/><stop offset="0.5" stop-color="#fde047"/><stop offset="1" stop-color="#f59e0b"/></radialGradient>
  </defs>
  <!-- teia no canto -->
  <g opacity="0.85" stroke="#e5e7eb" stroke-width="0.45" fill="none">
    <path d="M4 4 L 26 8 M4 4 L 20 20 M4 4 L 8 26"/>
    <path d="M10 5 C 11 8, 9 10, 6 10 M17 6.5 C 18 11, 14 15, 7 16.5 M23 7.5 C 24 15, 18 21, 7.5 23"/>
  </g>
  <!-- aranha descendo -->
  <g class="nx-a cr-bob" style="transform-origin:16px 30px">
    <path d="M16 18 L 16 30" stroke="#e5e7eb" stroke-width="0.4"/>
    <ellipse cx="16" cy="31.5" rx="2.6" ry="3" fill="#111827" stroke="#000" stroke-width="0.4"/>
    <path d="M13.8 30 L 10.8 28 M13.6 31.6 L 10.4 31.4 M13.8 33 L 11 35 M18.2 30 L 21.2 28 M18.4 31.6 L 21.6 31.4 M18.2 33 L 21 35" stroke="#111827" stroke-width="0.6"/>
    <circle cx="15.2" cy="30.6" r="0.5" fill="#ef4444"/><circle cx="16.8" cy="30.6" r="0.5" fill="#ef4444"/>
  </g>
  <!-- abóbora na borda direita -->
  <g transform="translate(76 18)">
    <path d="M-1 -11 C -1 -14, 2 -16, 4 -15" fill="none" stroke="#3f6212" stroke-width="1.6" stroke-linecap="round"/>
    <path d="M1 -10 C 6 -13, 8 -10, 6 -8" fill="#65a30d" stroke="${L}" stroke-width="0.6"/>
    <ellipse cx="-6" cy="0" rx="7" ry="10" fill="url(#hwPump)" stroke="${L}" stroke-width="0.8"/>
    <ellipse cx="6" cy="0" rx="7" ry="10" fill="url(#hwPump)" stroke="${L}" stroke-width="0.8"/>
    <ellipse cx="0" cy="0" rx="7.5" ry="10.6" fill="url(#hwPump)" stroke="${L}" stroke-width="0.8"/>
    <g class="nx-a cr-glow">
      <path d="M-7 -3 L -3 -6 L -2 -1.6 Z M7 -3 L 3 -6 L 2 -1.6 Z" fill="url(#hwFire)"/>
      <path d="M-8 3 C -4 9, 4 9, 8 3 L 5 4.5 L 3.4 2.6 L 1.6 4.8 L 0 2.8 L -1.6 4.8 L -3.4 2.6 L -5 4.5 Z" fill="url(#hwFire)"/>
    </g>
    <path d="M-10 -5 C -11 -1, -10 3, -8 6" fill="none" stroke="#fff" stroke-opacity="0.45" stroke-width="0.8" stroke-linecap="round"/>
  </g>
  <!-- morcegos -->
  ${[[30, 6, 0, 1], [58, 3, 0.4, 0.8], [92, 46, 0.8, 0.9]].map(([x, y, d, s]) => `
  <g transform="translate(${x} ${y}) scale(${s})"><g class="nx-a cr-bat" style="transform-origin:0px 0px;animation-delay:${d}s">
    <path d="M0 0 C -2 -2, -5 -3, -9 -1 C -7 0, -6 1.4, -6.4 2.6 C -4.6 1.6, -3 2, -2 3.2 C -1 2, 1 2, 2 3.2 C 3 2, 4.6 1.6, 6.4 2.6 C 6 1.4, 7 0, 9 -1 C 5 -3, 2 -2, 0 0 Z" fill="#1f1235" stroke="#000" stroke-width="0.4"/>
    <circle cx="-0.8" cy="0.4" r="0.35" fill="#fde047"/><circle cx="0.8" cy="0.4" r="0.35" fill="#fde047"/>
  </g></g>`).join('')}`,
};

// ============================================================================
// ARRAIÁ — bandeirinhas, chapéu de palha, fogueira e milho
// ============================================================================

const junina = {
  front: `
  <defs>
    <linearGradient id="jnStraw" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#fde68a"/><stop offset="1" stop-color="#ca8a04"/></linearGradient>
    <radialGradient id="jnFire" cx="0.5" cy="0.8" r="0.8"><stop offset="0" stop-color="#fffbeb"/><stop offset="0.4" stop-color="#fde047"/><stop offset="1" stop-color="#ea580c"/></radialGradient>
    <linearGradient id="jnCorn" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#fef08a"/><stop offset="1" stop-color="#eab308"/></linearGradient>
  </defs>
  <!-- cordão de bandeirinhas acompanhando a borda -->
  <path d="M8 34 C 20 12, 80 12, 92 34" fill="none" stroke="#78350f" stroke-width="0.6"/>
  ${Array.from({ length: 11 }, (_, i) => {
    const t = i / 10;
    const x = 8 + 84 * t;
    const y = 34 - 22 * 4 * t * (1 - t) * 0.92 - 0.5;
    const colors = ['#ef4444', '#facc15', '#22c55e', '#3b82f6', '#ec4899', '#f97316'];
    return `<g class="nx-a cr-flutter" style="transform-origin:${x}px ${y}px;animation-delay:${(i % 4) * 0.25}s"><path d="M${x - 3} ${y} L ${x + 3} ${y} L ${x + 3} ${y + 6.5} L ${x} ${y + 4.6} L ${x - 3} ${y + 6.5} Z" fill="${colors[i % colors.length]}" stroke="${L}" stroke-width="0.45" stroke-linejoin="round"/><path d="M${x - 2} ${y + 1} L ${x - 2} ${y + 4}" stroke="#fff" stroke-opacity="0.5" stroke-width="0.5"/></g>`;
  }).join('')}
  <!-- chapéu de palha com remendo -->
  <g transform="translate(24 14) rotate(-14)">
    <ellipse cx="0" cy="4" rx="13" ry="3.4" fill="url(#jnStraw)" stroke="${L}" stroke-width="0.8"/>
    <path d="M-7 4 C -7 -4, 7 -4, 7 4 Z" fill="url(#jnStraw)" stroke="${L}" stroke-width="0.8"/>
    <path d="M-7 2.4 C -2 3.6, 2 3.6, 7 2.4" fill="none" stroke="#b91c1c" stroke-width="1.4"/>
    <rect x="1.4" y="-2" width="3.4" height="3" fill="#2563eb" stroke="${L}" stroke-width="0.4" transform="rotate(10)"/>
    ${[-10, -6, -2, 2, 6, 10].map((x) => `<path d="M${x} 2.2 L ${x + 1} 5.6" stroke="#a16207" stroke-width="0.4"/>`).join('')}
  </g>
  <!-- fogueirinha -->
  <g transform="translate(50 92)">
    <path d="M-8 4 L 8 1 M-8 1 L 8 4" stroke="#78350f" stroke-width="2.2" stroke-linecap="round"/>
    <g class="nx-a cr-flame" style="transform-origin:0px 3px">
      <path d="M0 -9 C 4 -5, 6 -2, 5 1.5 C 4 3.5, -4 3.5, -5 1.5 C -6 -2, -3 -4, -2 -6 C -1 -3, 0 -3, 0 -9 Z" fill="url(#jnFire)" stroke="#9a3412" stroke-width="0.5"/>
      <path d="M0 -3 C 2 -1, 2 1, 1 2 C 0 2.6, -1 2.6, -1.4 1.6 C -1.6 0, -0.4 -1, 0 -3 Z" fill="#fffbeb"/>
    </g>
  </g>
  <!-- milho -->
  <g transform="translate(84 82) rotate(28)">
    <path d="M-3.4 -9 C -4 -2, -3.2 6, 0 9 C 3.2 6, 4 -2, 3.4 -9 C 1.6 -11, -1.6 -11, -3.4 -9 Z" fill="url(#jnCorn)" stroke="${L}" stroke-width="0.7"/>
    ${[-6, -3, 0, 3, 6].map((y) => `<path d="M-3 ${y} L 3 ${y}" stroke="#ca8a04" stroke-width="0.35"/>`).join('')}
    <path d="M0 -10 L 0 8" stroke="#ca8a04" stroke-width="0.35"/>
    <path d="M-1 9 C -7 6, -8 0, -6 -6 C -5 0, -3 5, 0 9 Z M1 9 C 7 6, 8 0, 6 -6 C 5 0, 3 5, 0 9 Z" fill="#65a30d" stroke="${L}" stroke-width="0.6"/>
  </g>`,
};

// ============================================================================
// CARNAVAL — máscara com plumas, confete e serpentina
// ============================================================================

const carnaval = {
  front: `
  <defs>
    <linearGradient id="cvMask" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#c4b5fd"/><stop offset="0.5" stop-color="#7c3aed"/><stop offset="1" stop-color="#4c1d95"/></linearGradient>
    <linearGradient id="cvGold" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#fef3c7"/><stop offset="1" stop-color="#d97706"/></linearGradient>
  </defs>
  <!-- plumas -->
  ${[[-26, '#22c55e'], [-12, '#06b6d4'], [0, '#f43f5e'], [12, '#f59e0b'], [26, '#a855f7']].map(([r, c], i) => `
  <g class="nx-a cr-sway" style="transform-origin:50px 16px;animation-delay:${i * 0.2}s"><g transform="rotate(${r} 50 16)">
    <path d="M50 16 C 46 8, 46 -2, 50 -8 C 54 -2, 54 8, 50 16 Z" fill="${c}" stroke="${L}" stroke-width="0.6"/>
    <path d="M50 14 L 50 -6" stroke="#fff" stroke-opacity="0.65" stroke-width="0.5"/>
    ${[-4, 0, 4, 8].map((y) => `<path d="M50 ${y} L 47.6 ${y - 2} M50 ${y} L 52.4 ${y - 2}" stroke="#ffffff" stroke-opacity="0.4" stroke-width="0.35"/>`).join('')}
  </g></g>`).join('')}
  <!-- máscara -->
  <path d="M30 19 C 36 13, 46 15, 50 19 C 54 15, 64 13, 70 19 C 68 27, 60 29, 55 25 C 53 24, 47 24, 45 25 C 40 29, 32 27, 30 19 Z" fill="url(#cvMask)" stroke="${L}" stroke-width="0.9" stroke-linejoin="round"/>
  <path d="M34 20 C 36 17, 42 17, 44 20 C 42 22.6, 36 22.6, 34 20 Z M56 20 C 58 17, 64 17, 66 20 C 64 22.6, 58 22.6, 56 20 Z" fill="#0b1020"/>
  <path d="M30 19 C 36 13, 46 15, 50 19 C 54 15, 64 13, 70 19" fill="none" stroke="url(#cvGold)" stroke-width="1.2"/>
  ${[36, 42, 58, 64].map((x) => `<circle cx="${x}" cy="${x < 50 ? 26 : 26}" r="0.9" fill="#fde68a"/>`).join('')}
  <circle cx="50" cy="20.6" r="1.8" fill="#f43f5e" stroke="${L}" stroke-width="0.5"/>
  <!-- serpentinas -->
  <path class="nx-a cr-sway" style="transform-origin:10px 50px" d="M12 40 C 4 44, 12 48, 6 52 C 0 56, 10 60, 4 66" fill="none" stroke="#22d3ee" stroke-width="1.4" stroke-linecap="round"/>
  <path class="nx-a cr-sway cr-delay" style="transform-origin:92px 56px" d="M90 46 C 98 50, 88 54, 95 58 C 101 62, 91 66, 97 72" fill="none" stroke="#f472b6" stroke-width="1.4" stroke-linecap="round"/>
  <!-- confete -->
  ${[[18, 0, '#facc15'], [28, 0.4, '#22c55e'], [72, 0.8, '#3b82f6'], [82, 0.2, '#ef4444'], [90, 1.1, '#a855f7'], [10, 1.4, '#06b6d4'], [64, 1.7, '#f97316']].map(([x, d, c]) => `<rect class="nx-a cr-confetti" style="animation-delay:${d}s;transform-origin:${x}px 30px" x="${x}" y="30" width="2" height="3" rx="0.4" fill="${c}"/>`).join('')}`,
};

// ============================================================================
// CAPIVARA ZEN — deitada no topo, laranja na cabeça e passarinho
// ============================================================================

const capivara = {
  front: `
  <defs>
    <linearGradient id="cpFur" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#c08552"/><stop offset="1" stop-color="#7c4a26"/></linearGradient>
    <radialGradient id="cpOrange" cx="0.35" cy="0.3" r="0.8"><stop offset="0" stop-color="#fed7aa"/><stop offset="0.5" stop-color="#fb923c"/><stop offset="1" stop-color="#c2410c"/></radialGradient>
  </defs>
  <g class="nx-a cr-breathe" style="transform-origin:50px 16px">
    <!-- corpo -->
    <path d="M28 18 C 26 8, 40 3, 54 4 C 66 4.6, 72 9, 72 16 C 72 20, 66 21, 50 21 C 36 21, 29 21, 28 18 Z" fill="url(#cpFur)" stroke="${L}" stroke-width="0.9" stroke-linejoin="round"/>
    <path d="M34 9 C 38 6, 46 5, 52 5.6" fill="none" stroke="#e0b083" stroke-width="0.8" stroke-linecap="round" opacity="0.8"/>
    ${[36, 42, 48, 54, 60].map((x) => `<path d="M${x} 8 l 1 2" stroke="#6b3d1d" stroke-width="0.45" opacity="0.6"/>`).join('')}
    <!-- patinhas -->
    <path d="M34 20.6 C 34 22.6, 38 22.6, 38 20.6 M60 20.6 C 60 22.6, 64 22.6, 64 20.6" fill="#7c4a26" stroke="${L}" stroke-width="0.7"/>
    <!-- cabeça -->
    <path d="M66 9 C 72 6, 84 7, 87 12 C 89 16, 86 20, 80 20 C 74 20, 68 18, 66 14 Z" fill="url(#cpFur)" stroke="${L}" stroke-width="0.9" stroke-linejoin="round"/>
    <path d="M84 12.6 C 87 12.6, 88.6 14, 88 16 C 87.4 17.6, 85 17.6, 84 16.4" fill="#6b3d1d" stroke="${L}" stroke-width="0.6"/>
    <ellipse cx="86.4" cy="13.6" rx="0.6" ry="0.4" fill="#1c1917"/>
    <path d="M75 12.6 C 76.4 11.8, 78 11.8, 79 12.6" fill="none" stroke="#1c1917" stroke-width="0.8" stroke-linecap="round"/>
    <path d="M70 8.6 C 69.4 6.4, 71 5.2, 72.6 6.4 C 73 7.4, 72.4 8.4, 71.2 8.8" fill="#8a5530" stroke="${L}" stroke-width="0.6"/>
    <ellipse cx="81" cy="17" rx="1.6" ry="0.8" fill="#f4a3a3" opacity="0.6"/>
    <!-- laranja equilibrada -->
    <g class="nx-a cr-bob" style="transform-origin:77px 4px">
      <circle cx="77" cy="2.8" r="3.6" fill="url(#cpOrange)" stroke="${L}" stroke-width="0.7"/>
      <path d="M77 -0.8 C 78 -2.4, 80 -2.6, 81 -1.8 C 80 -0.8, 78.4 -0.6, 77 -0.8 Z" fill="#65a30d" stroke="${L}" stroke-width="0.4"/>
      <circle cx="75.8" cy="1.6" r="0.8" fill="#fff" opacity="0.7"/>
    </g>
  </g>
  <!-- passarinho nas costas -->
  <g class="nx-a cr-hop" style="transform-origin:40px 5px">
    <ellipse cx="40" cy="2.4" rx="3.2" ry="2.4" fill="#fde047" stroke="${L}" stroke-width="0.6"/>
    <circle cx="42.4" cy="0.6" r="1.8" fill="#fde047" stroke="${L}" stroke-width="0.6"/>
    <path d="M44 0.6 L 45.6 1 L 44 1.6 Z" fill="#f97316"/>
    <circle cx="42.8" cy="0.2" r="0.35" fill="#1c1917"/>
    <path d="M37 2 C 38 1, 39.4 1.2, 40 2.2" fill="none" stroke="#ca8a04" stroke-width="0.6"/>
  </g>
  ${sparkle(20, 12, 1.8, '#a7f3d0', 0.3)}${sparkle(94, 30, 1.6, '#a7f3d0', 1)}`,
};

// ============================================================================
// PANDA DO BAMBU — panda espiando por baixo, mastigando, folhas de bambu
// ============================================================================

const panda = {
  back: `
  <defs><linearGradient id="pdBamboo" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#4d7c0f"/><stop offset="0.5" stop-color="#a3e635"/><stop offset="1" stop-color="#3f6212"/></linearGradient></defs>
  ${[[8, 30, -6], [90, 26, 8]].map(([x, y, r]) => `<g transform="rotate(${r} ${x} ${y})">
    <rect x="${(x as number) - 2.4}" y="${y}" width="4.8" height="62" rx="1.6" fill="url(#pdBamboo)" stroke="${L}" stroke-width="0.7"/>
    ${[14, 30, 46].map((o) => `<rect x="${(x as number) - 2.8}" y="${(y as number) + o}" width="5.6" height="1.6" rx="0.8" fill="#365314"/>`).join('')}
  </g>`).join('')}`,
  front: `
  <defs>
    <radialGradient id="pdFace" cx="0.45" cy="0.4" r="0.7"><stop offset="0" stop-color="#ffffff"/><stop offset="1" stop-color="#e5e7eb"/></radialGradient>
    <linearGradient id="pdLeaf" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#bef264"/><stop offset="1" stop-color="#4d7c0f"/></linearGradient>
  </defs>
  <!-- folhas balançando -->
  ${[[10, 28, -40, 0], [14, 34, -10, 0.4], [88, 24, 40, 0.2], [86, 31, 10, 0.6]].map(([x, y, r, d]) => `<g class="nx-a cr-sway" style="transform-origin:${x}px ${y}px;animation-delay:${d}s"><path transform="rotate(${r} ${x} ${y})" d="M${x} ${y} C ${(x as number) + 4} ${(y as number) - 3}, ${(x as number) + 10} ${(y as number) - 3}, ${(x as number) + 14} ${y} C ${(x as number) + 10} ${(y as number) + 3}, ${(x as number) + 4} ${(y as number) + 3}, ${x} ${y} Z" fill="url(#pdLeaf)" stroke="${L}" stroke-width="0.6"/></g>`).join('')}
  <!-- panda espiando por baixo -->
  <g class="nx-a cr-bob" style="transform-origin:50px 96px">
    <circle cx="38" cy="80" r="5" fill="#111827" stroke="#000" stroke-width="0.5"/>
    <circle cx="62" cy="80" r="5" fill="#111827" stroke="#000" stroke-width="0.5"/>
    <path d="M30 98 C 28 86, 38 78, 50 78 C 62 78, 72 86, 70 98 Z" fill="url(#pdFace)" stroke="${L}" stroke-width="0.9"/>
    <path d="M39 86 C 36 86, 35 90, 38 91.6 C 41 93, 44 90, 43 87.4 C 42.4 86.4, 40.6 86, 39 86 Z" fill="#111827"/>
    <path d="M61 86 C 64 86, 65 90, 62 91.6 C 59 93, 56 90, 57 87.4 C 57.6 86.4, 59.4 86, 61 86 Z" fill="#111827"/>
    <g class="nx-a cr-blink" style="transform-origin:50px 89px">
      <circle cx="40.6" cy="88.6" r="1.1" fill="#fff"/><circle cx="59.4" cy="88.6" r="1.1" fill="#fff"/>
    </g>
    <ellipse cx="50" cy="93" rx="2" ry="1.3" fill="#111827"/>
    <ellipse cx="44" cy="95" rx="2" ry="1" fill="#fda4af" opacity="0.6"/><ellipse cx="56" cy="95" rx="2" ry="1" fill="#fda4af" opacity="0.6"/>
    <!-- patinhas segurando a borda -->
    <ellipse cx="34" cy="86" rx="4.2" ry="3.4" fill="#111827" stroke="#000" stroke-width="0.4"/>
    <ellipse cx="66" cy="86" rx="4.2" ry="3.4" fill="#111827" stroke="#000" stroke-width="0.4"/>
    <!-- broto de bambu na boca -->
    <g class="nx-a cr-chew" style="transform-origin:54px 96px">
      <rect x="53" y="94" width="11" height="2" rx="1" fill="#84cc16" stroke="${L}" stroke-width="0.4" transform="rotate(-12 53 94)"/>
      <path d="M63 91 C 66 89, 69 89, 70 90.6 C 68 92, 65 92, 63 91 Z" fill="url(#pdLeaf)" stroke="${L}" stroke-width="0.4"/>
    </g>
  </g>`,
};

// ============================================================================
// CUPIDO — asas atrás da foto, flecha atravessando coração, corações subindo
// ============================================================================

const cupido = {
  back: `
  <defs><linearGradient id="cuWing" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#ffffff"/><stop offset="1" stop-color="#fce7f3"/></linearGradient></defs>
  ${[0, 1].map((m) => `<g ${m ? MIRROR : ''}><g class="nx-a cr-wingflap" style="transform-origin:20px 48px">
    <path d="M20 40 C 8 30, -2 34, -2 44 C 2 44, 4 46, 2 50 C 7 49, 9 52, 6 56 C 11 55, 14 57, 13 61 C 17 58, 20 56, 21 52 Z" fill="url(#cuWing)" stroke="${L}" stroke-width="0.8" stroke-linejoin="round"/>
    <path d="M18 43 C 11 39, 4 40, 1 44 M17 47 C 12 45, 7 47, 5 50 M17 51 C 14 50, 11 52, 10 55" fill="none" stroke="#f9a8d4" stroke-width="0.6"/>
  </g></g>`).join('')}`,
  front: `
  <defs>
    <linearGradient id="cuHeart" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#fda4af"/><stop offset="1" stop-color="#be123c"/></linearGradient>
    <linearGradient id="cuGold" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#fde68a"/><stop offset="1" stop-color="#ca8a04"/></linearGradient>
  </defs>
  <!-- coração com flecha -->
  <g class="nx-a cr-beat" style="transform-origin:80px 82px">
    ${heart(80, 82, 8, 'url(#cuHeart)')}
    <ellipse cx="76.4" cy="78" rx="2" ry="1.2" fill="#fff" opacity="0.75"/>
  </g>
  <path d="M64 92 L 96 70" stroke="url(#cuGold)" stroke-width="1.4" stroke-linecap="round"/>
  <path d="M96 70 L 92 70.4 L 94.8 73.6 Z" fill="#ca8a04" stroke="${L}" stroke-width="0.4"/>
  <path d="M64 92 L 61 91 M64 92 L 63 95 M66 90.6 L 63 89.6 M66 90.6 L 65 93.6" stroke="#f43f5e" stroke-width="1" stroke-linecap="round"/>
  <!-- corações subindo -->
  ${[[18, 0, 3], [28, 1.2, 2.2], [12, 2, 2.6], [88, 0.6, 2.4], [24, 2.8, 1.8]].map(([x, d, s]) => `<g class="nx-a cr-heartrise" style="animation-delay:${d}s">${heart(x as number, 70, s as number, '#fb7185', '#9f1239')}</g>`).join('')}
  ${sparkle(30, 14, 2, '#fbcfe8', 0.4)}${sparkle(72, 10, 2.4, '#fde68a', 1)}`,
};

export type Critter2Id = 'ninja' | 'magical-girl' | 'halloween' | 'junina' | 'carnaval' | 'capivara' | 'panda' | 'cupido';

export const CRITTERS2: Record<Critter2Id, { back?: string; front: string }> = {
  ninja,
  'magical-girl': magical,
  halloween,
  junina,
  carnaval,
  capivara,
  panda,
  cupido,
};
