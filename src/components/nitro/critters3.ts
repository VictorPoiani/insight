/**
 * Molduras ilustradas — pacote 3 (encomenda): Lírio-do-vale, Mana Preta,
 * Gargantilha de Ametista, Morceguinha, Depresso, Patinha de Chapéu,
 * Querendo Briga, Lutador de Arcade, Harmonia Floral, Cartão Amarelo,
 * Coração Coreano e Abelhinha Dorminhoca (pixel art).
 *
 * viewBox 0–100; avatar = círculo (50,50) r 36.8; `back` atrás da foto,
 * `front` por cima; animação só com transform/opacity (classes cr-* em nitro.css).
 */

const L = '#241a2e';
const MIRROR = 'transform="translate(100 0) scale(-1 1)"';
const R = 36.8;

const pt = (deg: number, r = R) => {
  const a = (deg * Math.PI) / 180;
  return [50 + Math.cos(a) * r, 50 + Math.sin(a) * r] as const;
};
const f = (n: number) => n.toFixed(2);

function sparkle(x: number, y: number, s: number, color: string, delay = 0) {
  return `<path class="nx-a cr-tw" style="transform-origin:${f(x)}px ${f(y)}px;animation-delay:${delay}s" d="M${f(x)} ${f(y - s)} Q ${f(x + s * 0.18)} ${f(y - s * 0.18)} ${f(x + s)} ${f(y)} Q ${f(x + s * 0.18)} ${f(y + s * 0.18)} ${f(x)} ${f(y + s)} Q ${f(x - s * 0.18)} ${f(y + s * 0.18)} ${f(x - s)} ${f(y)} Q ${f(x - s * 0.18)} ${f(y - s * 0.18)} ${f(x)} ${f(y - s)} Z" fill="${color}"/>`;
}

/** Arco ao longo da borda do avatar (graus, 0 = direita, 90 = baixo). */
function arc(fromDeg: number, toDeg: number, r: number) {
  const [x0, y0] = pt(fromDeg, r);
  const [x1, y1] = pt(toDeg, r);
  const large = Math.abs(toDeg - fromDeg) > 180 ? 1 : 0;
  const sweep = toDeg > fromDeg ? 1 : 0;
  return `M${f(x0)} ${f(y0)} A ${r} ${r} 0 ${large} ${sweep} ${f(x1)} ${f(y1)}`;
}

// ============================================================================
// 1. LÍRIO-DO-VALE — crescente de folhas e sininhos à esquerda e embaixo
// ============================================================================

const lily = (() => {
  const bells = [190, 202, 214, 228, 242, 256].map((deg, i) => {
    const [x, y] = pt(deg - 90 + 180, R + 4.5); // ao longo da curva esquerda/baixo
    return { x, y, i };
  });
  // posições ao longo do crescente esquerdo (de cima para baixo)
  const curve = [200, 185, 170, 155, 140, 125].map((deg) => pt(deg, R + 3.6));
  return {
    back: `
  <defs>
    <radialGradient id="lyAura" cx="0.5" cy="0.5" r="0.5"><stop offset="0" stop-color="#e0f2fe" stop-opacity="0.75"/><stop offset="1" stop-color="#e0f2fe" stop-opacity="0"/></radialGradient>
  </defs>
  <g class="nx-a cr-pulse2" style="transform-origin:16px 40px"><ellipse cx="16" cy="40" rx="16" ry="20" fill="url(#lyAura)"/></g>
  <g class="nx-a cr-pulse2 cr-delay" style="transform-origin:46px 92px"><ellipse cx="46" cy="92" rx="26" ry="10" fill="url(#lyAura)"/></g>`,
    front: `
  <defs>
    <linearGradient id="lyLeaf" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#bbf7d0"/><stop offset="0.5" stop-color="#6ee7b7"/><stop offset="1" stop-color="#3f7d6e"/></linearGradient>
    <linearGradient id="lyLeaf2" x1="1" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#a7f3d0"/><stop offset="1" stop-color="#4b6f7a"/></linearGradient>
    <radialGradient id="lyBell" cx="0.4" cy="0.3" r="0.8"><stop offset="0" stop-color="#ffffff"/><stop offset="0.6" stop-color="#f1f5f9"/><stop offset="1" stop-color="#c7d2fe"/></radialGradient>
    <linearGradient id="lyBand" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#bae6fd" stop-opacity="0"/><stop offset="0.2" stop-color="#7dd3fc"/><stop offset="0.6" stop-color="#bfdbfe"/><stop offset="1" stop-color="#e0f2fe" stop-opacity="0"/></linearGradient>
    <clipPath id="lyBandClip"><path d="${arc(40, 150, R + 1.6)} L ${f(pt(150, R + 5.4)[0])} ${f(pt(150, R + 5.4)[1])} ${arc(150, 40, R + 5.4).replace(/^M[^A]+/, '')} Z"/></clipPath>
  </defs>
  <!-- faixa inferior perolada com brilho deslizando -->
  <path d="${arc(40, 150, R + 3.5)}" fill="none" stroke="url(#lyBand)" stroke-width="3.6" stroke-linecap="round"/>
  <path d="${arc(50, 140, R + 2.3)}" fill="none" stroke="#ffffff" stroke-opacity="0.65" stroke-width="0.5"/>
  <g clip-path="url(#lyBandClip)"><g class="nx-a cr-glint"><rect x="0" y="70" width="10" height="40" fill="#ffffff" opacity="0.7" transform="skewX(-25)"/></g></g>
  <!-- haste em crescente -->
  <path d="M28 12 C 10 24, 6 48, 14 66 C 20 80, 34 90, 52 90" fill="none" stroke="#3f7d6e" stroke-width="1.3" stroke-linecap="round"/>
  <!-- folhas longas -->
  <path d="M14 66 C 2 56, 0 36, 10 20 C 12 36, 12 52, 14 66 Z" fill="url(#lyLeaf)" stroke="#2f5d55" stroke-width="0.6"/>
  <path d="M11 24 C 11 38, 12 52, 14 64" fill="none" stroke="#ecfdf5" stroke-opacity="0.6" stroke-width="0.5"/>
  <path d="M22 82 C 16 92, 26 100, 40 98 C 32 94, 26 88, 22 82 Z" fill="url(#lyLeaf2)" stroke="#2f5d55" stroke-width="0.6"/>
  <path d="M8 44 C 0 46, -2 56, 4 62 C 6 56, 8 50, 8 44 Z" fill="url(#lyLeaf2)" stroke="#2f5d55" stroke-width="0.5"/>
  <!-- sininhos pendentes -->
  ${curve
    .map(([x, y], i) => {
      const s = 3.4 - i * 0.14;
      return `<g class="nx-a cr-swing" style="transform-origin:${f(x)}px ${f(y - 2)}px;animation-delay:${(i * 0.23).toFixed(2)}s">
      <path d="M${f(x)} ${f(y - 3.6)} C ${f(x + 0.6)} ${f(y - 2.6)}, ${f(x + 0.4)} ${f(y - 1.4)}, ${f(x)} ${f(y - 1)}" fill="none" stroke="#3f7d6e" stroke-width="0.5"/>
      <path d="M${f(x - s)} ${f(y + s * 0.9)} C ${f(x - s)} ${f(y - s * 0.6)}, ${f(x + s)} ${f(y - s * 0.6)}, ${f(x + s)} ${f(y + s * 0.9)} L ${f(x + s * 0.55)} ${f(y + s * 0.6)} L ${f(x)} ${f(y + s * 1.05)} L ${f(x - s * 0.55)} ${f(y + s * 0.6)} Z" fill="url(#lyBell)" stroke="#94a3b8" stroke-width="0.4" stroke-linejoin="round"/>
      <path d="M${f(x - s * 0.55)} ${f(y + s * 0.6)} L ${f(x)} ${f(y + s * 1.05)} L ${f(x + s * 0.55)} ${f(y + s * 0.6)}" fill="none" stroke="#c4b5fd" stroke-width="0.5"/>
      <ellipse cx="${f(x - s * 0.35)}" cy="${f(y - s * 0.05)}" rx="${f(s * 0.25)}" ry="${f(s * 0.4)}" fill="#fff" opacity="0.9"/>
    </g>`;
    })
    .join('')}
  ${sparkle(20, 18, 1.6, '#e0f2fe')}${sparkle(6, 52, 1.3, '#c7d2fe', 0.6)}${sparkle(30, 96, 1.4, '#e0f2fe', 1.1)}${sparkle(62, 96, 1.2, '#ddd6fe', 1.6)}`,
  };
})();

// ============================================================================
// 2. MANA PRETA — aro metálico gótico, garras de osso e medalhão de crânio
// ============================================================================

function claw() {
  // mão esquelética de quatro dedos agarrando o aro (lado esquerdo, topo)
  const fingers = [
    'M27 22 C 26 16, 28 10, 32 8 C 34 7.4, 35 8.6, 34 10 C 31 12, 30 16, 30.6 21',
    'M31 20 C 31 13, 34 7, 38.6 6 C 40.4 5.8, 41 7.2, 39.6 8.2 C 36.4 10.4, 34.8 15, 34.4 19.6',
    'M35 19.4 C 36 13, 40 9, 44.6 9 C 46.2 9.2, 46.4 10.6, 45 11.2 C 41.6 12.6, 39.4 16, 38.4 19.6',
    'M25 25 C 21 22, 19 17, 20.6 13 C 21.4 11.6, 22.8 11.8, 22.8 13.4 C 22.6 17, 24 20.6, 27.4 23',
  ];
  return `
    <path d="M18 34 C 20 28, 24 23, 30 20 C 34 19, 38 19.6, 40 21 C 38 25, 32 29, 26 33 Z" fill="url(#mpBone)" stroke="${L}" stroke-width="0.8" stroke-linejoin="round"/>
    ${fingers.map((d) => `<path d="${d}" fill="none" stroke="${L}" stroke-width="3.1" stroke-linecap="round"/><path d="${d}" fill="none" stroke="url(#mpBone)" stroke-width="2.1" stroke-linecap="round"/>`).join('')}
    ${[[33.6, 9.4], [39.8, 7.6], [45.6, 10.6], [21.6, 12.8]].map(([x, y]) => `<circle cx="${x}" cy="${y}" r="0.55" fill="#4c1d95"/>`).join('')}
    <path d="M22 30 C 26 27, 30 25, 34 23.4" fill="none" stroke="#f5f3ff" stroke-opacity="0.5" stroke-width="0.6"/>`;
}

const manaPreta = {
  back: `
  <defs><radialGradient id="mpAura" cx="0.5" cy="0.5" r="0.5"><stop offset="0" stop-color="#7c3aed" stop-opacity="0.85"/><stop offset="0.6" stop-color="#4c1d95" stop-opacity="0.35"/><stop offset="1" stop-color="#1e1b4b" stop-opacity="0"/></radialGradient></defs>
  <g class="nx-a cr-pulse2" style="transform-origin:50px 90px"><ellipse cx="50" cy="90" rx="22" ry="16" fill="url(#mpAura)"/></g>`,
  front: `
  <defs>
    <linearGradient id="mpRing" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#cbd5e1"/><stop offset="0.35" stop-color="#64748b"/><stop offset="0.7" stop-color="#4c3a66"/><stop offset="1" stop-color="#1e1b2e"/></linearGradient>
    <linearGradient id="mpBone" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#f4f1ea"/><stop offset="0.6" stop-color="#cfc8d8"/><stop offset="1" stop-color="#8b7fa6"/></linearGradient>
    <linearGradient id="mpShield" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#a78bfa"/><stop offset="0.5" stop-color="#6d28d9"/><stop offset="1" stop-color="#2e1065"/></linearGradient>
    <radialGradient id="mpGlow" cx="0.5" cy="0.45" r="0.5"><stop offset="0" stop-color="#e9d5ff"/><stop offset="0.5" stop-color="#a855f7"/><stop offset="1" stop-color="#581c87" stop-opacity="0"/></radialGradient>
  </defs>
  <!-- aro espesso com relevo -->
  <circle cx="50" cy="50" r="${R + 2.4}" fill="none" stroke="${L}" stroke-width="6.2"/>
  <circle cx="50" cy="50" r="${R + 2.4}" fill="none" stroke="url(#mpRing)" stroke-width="4.8"/>
  <circle cx="50" cy="50" r="${R + 0.6}" fill="none" stroke="#e2e8f0" stroke-opacity="0.45" stroke-width="0.5"/>
  <circle cx="50" cy="50" r="${R + 4.2}" fill="none" stroke="#1e1b2e" stroke-opacity="0.7" stroke-width="0.5"/>
  ${Array.from({ length: 16 }, (_, i) => {
    const [x, y] = pt(i * 22.5 + 11.25, R + 2.4);
    return `<circle cx="${f(x)}" cy="${f(y)}" r="0.9" fill="#94a3b8" stroke="${L}" stroke-width="0.35"/><circle cx="${f(x - 0.25)}" cy="${f(y - 0.25)}" r="0.3" fill="#fff" opacity="0.8"/>`;
  }).join('')}
  ${[45, 135].map((deg) => {
    const [x, y] = pt(deg, R + 2.4);
    return `<path d="M${f(x)} ${f(y - 3)} L ${f(x + 2)} ${f(y)} L ${f(x)} ${f(y + 3)} L ${f(x - 2)} ${f(y)} Z" fill="#4c3a66" stroke="#cbd5e1" stroke-width="0.4"/>`;
  }).join('')}
  <!-- garras agarrando o topo -->
  <g class="nx-a cr-grip" style="transform-origin:30px 22px">${claw()}</g>
  <g ${MIRROR}><g class="nx-a cr-grip cr-delay" style="transform-origin:30px 22px">${claw()}</g></g>
  <!-- medalhão / brasão com crânio -->
  <g transform="translate(50 88)">
    <path d="M-10 -9 L 10 -9 L 12 -12 L 13 -4 C 13 4, 6 9, 0 12 C -6 9, -13 4, -13 -4 L -12 -12 Z" fill="url(#mpRing)" stroke="${L}" stroke-width="0.9" stroke-linejoin="round"/>
    <path d="M-8 -7 L 8 -7 C 10.6 -4, 10.6 3, 0 9.4 C -10.6 3, -10.6 -4, -8 -7 Z" fill="url(#mpShield)" stroke="#1e1b2e" stroke-width="0.6"/>
    <path d="M-13 -4 L -17 -2 L -13 0 M13 -4 L 17 -2 L 13 0 M0 12 L 0 15" stroke="#94a3b8" stroke-width="1.2" stroke-linecap="round"/>
    <g class="nx-a cr-pulse2" style="transform-origin:0px 0px"><circle r="7" fill="url(#mpGlow)"/></g>
    <path d="M0 -5.4 C -3.6 -5.4, -5 -3, -5 -0.6 C -5 1.4, -4 2.4, -3 2.8 L -3 4.6 L 3 4.6 L 3 2.8 C 4 2.4, 5 1.4, 5 -0.6 C 5 -3, 3.6 -5.4, 0 -5.4 Z" fill="#ede9fe" stroke="${L}" stroke-width="0.6"/>
    <ellipse cx="-2" cy="-0.6" rx="1.3" ry="1.5" fill="#3b0764"/><ellipse cx="2" cy="-0.6" rx="1.3" ry="1.5" fill="#3b0764"/>
    <g class="nx-a cr-pulse2" style="transform-origin:0px -0.6px"><circle cx="-2" cy="-0.6" r="0.55" fill="#d8b4fe"/><circle cx="2" cy="-0.6" r="0.55" fill="#d8b4fe"/></g>
    <path d="M-0.6 1.4 L 0 0.4 L 0.6 1.4 Z" fill="#3b0764"/>
    <path d="M-1.6 3 V 4.6 M0 3 V 4.6 M1.6 3 V 4.6" stroke="${L}" stroke-width="0.4"/>
    <path d="M-7 -6 L -2 -6" stroke="#fff" stroke-opacity="0.5" stroke-width="0.6"/>
  </g>`,
};

// ============================================================================
// 3. GARGANTILHA DE AMETISTA — choker rendado com gema oval facetada
// ============================================================================

const choker = {
  front: `
  <defs>
    <linearGradient id="chBand" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#2a2333"/><stop offset="1" stop-color="#0b0a10"/></linearGradient>
    <radialGradient id="chGem" cx="0.38" cy="0.3" r="0.8"><stop offset="0" stop-color="#f5d0fe"/><stop offset="0.45" stop-color="#a855f7"/><stop offset="1" stop-color="#4c1d95"/></radialGradient>
    <linearGradient id="chSilver" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#f1f5f9"/><stop offset="1" stop-color="#475569"/></linearGradient>
    <clipPath id="chGemClip"><ellipse cx="50" cy="${f(50 + R + 3)}" rx="5.4" ry="6.6"/></clipPath>
  </defs>
  <!-- renda branca em leques -->
  ${Array.from({ length: 17 }, (_, i) => {
    const deg = 30 + i * 7.5;
    const [x, y] = pt(deg, R + 7.4);
    return `<g class="nx-a cr-lace" style="transform-origin:${f(x)}px ${f(y)}px;animation-delay:${(i * 0.08).toFixed(2)}s"><circle cx="${f(x)}" cy="${f(y)}" r="1.9" fill="#f8fafc" stroke="#a1a1aa" stroke-width="0.35"/><circle cx="${f(x)}" cy="${f(y)}" r="0.6" fill="none" stroke="#a1a1aa" stroke-width="0.3"/></g>`;
  }).join('')}
  <!-- tira larga preta com malha -->
  <path d="${arc(28, 152, R + 3.6)}" fill="none" stroke="${L}" stroke-width="7.4" stroke-linecap="butt"/>
  <path d="${arc(28, 152, R + 3.6)}" fill="none" stroke="url(#chBand)" stroke-width="6.4"/>
  <path d="${arc(30, 150, R + 3.6)}" fill="none" stroke="#52525b" stroke-width="5" stroke-dasharray="0.4 1.4" opacity="0.8"/>
  <path d="${arc(30, 150, R + 2.2)}" fill="none" stroke="#3f3f46" stroke-width="0.4" stroke-dasharray="1 0.8"/>
  <path d="${arc(30, 150, R + 5)}" fill="none" stroke="#3f3f46" stroke-width="0.4" stroke-dasharray="1 0.8"/>
  <!-- bordas lavanda -->
  <path d="${arc(28, 152, R + 0.3)}" fill="none" stroke="#c4b5fd" stroke-width="1"/>
  <path d="${arc(28, 152, R + 6.9)}" fill="none" stroke="#c4b5fd" stroke-width="1"/>
  <!-- pingentes -->
  ${[60, 78, 102, 120].map((deg, i) => {
    const [x, y] = pt(deg, R + 9.8);
    return `<g class="nx-a cr-swing" style="transform-origin:${f(x)}px ${f(y - 2.6)}px;animation-delay:${i * 0.3}s"><path d="M${f(x)} ${f(y - 2.6)} V ${f(y - 0.6)}" stroke="#94a3b8" stroke-width="0.4"/><path d="M${f(x)} ${f(y - 0.8)} l 1.2 1.8 l -1.2 1.8 l -1.2 -1.8 Z" fill="url(#chGem)" stroke="${L}" stroke-width="0.35"/></g>`;
  }).join('')}
  <!-- gema oval central -->
  <ellipse cx="50" cy="${f(50 + R + 3)}" rx="7.4" ry="8.6" fill="url(#chSilver)" stroke="${L}" stroke-width="0.8"/>
  <ellipse cx="50" cy="${f(50 + R + 3)}" rx="5.4" ry="6.6" fill="url(#chGem)" stroke="#3b0764" stroke-width="0.5"/>
  <path d="M50 ${f(50 + R - 3.6)} L 52.6 ${f(50 + R + 3)} L 50 ${f(50 + R + 9.6)} L 47.4 ${f(50 + R + 3)} Z M44.6 ${f(50 + R + 3)} H 55.4" fill="none" stroke="#e9d5ff" stroke-opacity="0.55" stroke-width="0.4"/>
  <g clip-path="url(#chGemClip)"><g class="nx-a cr-glint-y"><rect x="40" y="${f(50 + R - 6)}" width="20" height="3" fill="#ffffff" opacity="0.75" transform="rotate(-30 50 ${f(50 + R + 3)})"/></g></g>
  <ellipse cx="48" cy="${f(50 + R + 0.4)}" rx="1.3" ry="1.8" fill="#fff" opacity="0.85"/>
  ${sparkle(36, 92, 1.1, '#e9d5ff', 0.5)}${sparkle(66, 92, 1.1, '#e9d5ff', 1.3)}`,
};

// ============================================================================
// 4. MORCEGUINHA — cabelo índigo em camadas, orelhas de morcego e coleira de lua
// ============================================================================

const batgirl = {
  back: `
  <defs><linearGradient id="bgHairB" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#3b2a6b"/><stop offset="1" stop-color="#1e1440"/></linearGradient></defs>
  <!-- cabelo de trás (volume atrás da foto) -->
  <path d="M10 70 C 4 40, 18 10, 50 9 C 82 10, 96 40, 90 70 C 84 84, 80 90, 76 96 L 24 96 C 20 90, 16 84, 10 70 Z" fill="url(#bgHairB)" stroke="${L}" stroke-width="0.8"/>`,
  front: `
  <defs>
    <linearGradient id="bgHair" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#7c6bd6"/><stop offset="0.45" stop-color="#4c3b9e"/><stop offset="1" stop-color="#241a52"/></linearGradient>
    <linearGradient id="bgEar" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#2e1f63"/><stop offset="1" stop-color="#4c3b9e"/></linearGradient>
  </defs>
  <!-- orelhas de morcego -->
  ${[0, 1].map((m) => `<g ${m ? MIRROR : ''}><g class="nx-a cr-twitch" style="transform-origin:30px 18px;animation-delay:${m * 0.9}s">
    <path d="M24 20 C 20 12, 18 4, 20 -4 C 24 0, 30 4, 36 6 C 33 10, 30 14, 30 18 Z" fill="url(#bgEar)" stroke="${L}" stroke-width="0.8" stroke-linejoin="round"/>
    <path d="M25.4 17 C 23 11, 22 5, 22.6 0.4 C 25.6 3, 29 5, 32.4 6.6 C 30 9.6, 28 13, 27.8 16.6 Z" fill="#f5c2e7"/>
    <path d="M23.6 2 L 24.4 8" stroke="#fff" stroke-opacity="0.6" stroke-width="0.5"/>
  </g></g>`).join('')}
  <!-- franja dividida e mechas -->
  <path d="M14 40 C 14 20, 30 10, 50 10 C 70 10, 86 20, 86 40 C 80 30, 74 24, 64 22 C 66 28, 64 32, 60 34 C 58 28, 54 24, 50 22 C 46 24, 42 28, 40 34 C 36 32, 34 28, 36 22 C 26 24, 20 30, 14 40 Z" fill="url(#bgHair)" stroke="${L}" stroke-width="0.9" stroke-linejoin="round"/>
  <path d="M50 22 C 48 18, 44 14, 38 13 M50 22 C 52 18, 56 14, 62 13" fill="none" stroke="${L}" stroke-width="0.6"/>
  <g class="nx-a cr-hairwave" style="transform-origin:46px 26px">
    <path d="M46 24 C 45 28, 44 31, 41.6 34" fill="none" stroke="#3a2c7a" stroke-width="0.9" stroke-linecap="round"/>
    <path d="M54 24 C 55 28, 56 31, 58.4 34" fill="none" stroke="#3a2c7a" stroke-width="0.9" stroke-linecap="round"/>
  </g>
  <!-- mechas laterais longas -->
  ${[0, 1].map((m) => `<g ${m ? MIRROR : ''}><g class="nx-a cr-hairwave cr-delay" style="transform-origin:16px 40px">
    <path d="M16 36 C 10 50, 10 66, 16 82 C 18 86, 20 88, 22 90 C 18 80, 16 66, 20 50 C 20 44, 19 40, 16 36 Z" fill="url(#bgHair)" stroke="${L}" stroke-width="0.8"/>
    <path d="M16 46 C 14 56, 14 68, 17 78" fill="none" stroke="#a5b4fc" stroke-opacity="0.55" stroke-width="0.6"/>
  </g></g>`).join('')}
  <!-- reflexo percorrendo o cabelo -->
  <path class="nx-a cr-shine" d="M24 24 C 34 16, 46 14, 52 14" fill="none" stroke="#c4b5fd" stroke-width="1.2" stroke-linecap="round" stroke-dasharray="8 40"/>
  <path d="M30 20 C 36 16, 42 15, 46 15" fill="none" stroke="#e0e7ff" stroke-opacity="0.7" stroke-width="0.7" stroke-linecap="round"/>
  <!-- coleira com pingente de lua -->
  <path d="${arc(62, 118, R + 1.6)}" fill="none" stroke="${L}" stroke-width="3.6"/>
  <path d="${arc(62, 118, R + 1.6)}" fill="none" stroke="#18181b" stroke-width="2.8"/>
  <circle cx="50" cy="${f(50 + R + 3.6)}" r="1.4" fill="none" stroke="#cbd5e1" stroke-width="0.6"/>
  <g class="nx-a cr-swing" style="transform-origin:50px ${f(50 + R + 4.6)}px">
    <path d="M51.8 ${f(50 + R + 5.6)} A 3.2 3.2 0 1 0 52.4 ${f(50 + R + 11)} A 2.4 2.4 0 1 1 51.8 ${f(50 + R + 5.6)} Z" fill="#e2e8f0" stroke="${L}" stroke-width="0.4"/>
  </g>`,
};

// ============================================================================
// 5. DEPRESSO — bichinho cansado com moicano e picareta (canto inferior esquerdo)
// ============================================================================

const depresso = {
  front: `
  <g class="nx-a cr-breathe" style="transform-origin:22px 96px">
    <!-- picareta -->
    <g class="nx-a cr-sway" style="transform-origin:30px 88px">
      <path d="M30 90 L 40 66" stroke="#111" stroke-width="2.8" stroke-linecap="round"/>
      <path d="M30 90 L 40 66" stroke="#6b3e1f" stroke-width="1.8" stroke-linecap="round"/>
      <path d="M31.6 64.6 C 36 61.4, 44 62.4, 48.6 66.6 C 44.6 65.2, 41.4 65.4, 40.2 67.6 C 38.6 65.8, 35 64.8, 31.6 64.6 Z" fill="#d4d4d8" stroke="#111" stroke-width="0.8" stroke-linejoin="round"/>
      <path d="M34 64.4 C 38 63.6, 42 64, 45 65.4" fill="none" stroke="#fff" stroke-opacity="0.8" stroke-width="0.5"/>
    </g>
    <!-- corpo -->
    <path d="M6 98 C 4 86, 8 76, 18 74 C 28 72, 34 80, 34 90 C 34 96, 30 99, 20 99 C 12 99, 7 99, 6 98 Z" fill="#64748b" stroke="#111" stroke-width="1"/>
    <path d="M10 92 C 10 86, 12 80, 18 78" fill="none" stroke="#94a3b8" stroke-width="1" stroke-linecap="round"/>
    <!-- moicano -->
    <path d="M12 76 L 13 68 L 16 74 L 18 64 L 20 73 L 24 66 L 24 75 Z" fill="#c026d3" stroke="#111" stroke-width="0.8" stroke-linejoin="round"/>
    <!-- rosto cansado -->
    <g class="nx-a cr-blink-slow" style="transform-origin:21px 84px">
      <path d="M13.6 83 C 15 82.2, 17 82.2, 18 83 L 18 84.4 C 17 85, 15 85, 13.6 84.4 Z" fill="#f8fafc" stroke="#111" stroke-width="0.6"/>
      <path d="M22.4 83 C 23.8 82.2, 25.8 82.2, 26.8 83 L 26.8 84.4 C 25.8 85, 23.8 85, 22.4 84.4 Z" fill="#f8fafc" stroke="#111" stroke-width="0.6"/>
      <circle cx="16" cy="84" r="0.6" fill="#111"/><circle cx="24.8" cy="84" r="0.6" fill="#111"/>
      <path d="M13.2 82.6 L 18.4 82.6 M22 82.6 L 27.2 82.6" stroke="#111" stroke-width="0.9" stroke-linecap="round"/>
    </g>
    <path d="M17 90 C 19 89.2, 22 89.2, 24 90" fill="none" stroke="#111" stroke-width="0.8" stroke-linecap="round"/>
    <path d="M27 86 C 27.6 88, 27.2 89.4, 26.4 90" fill="none" stroke="#7dd3fc" stroke-width="0.7"/>
    <!-- bracinho segurando o cabo -->
    <path d="M30 86 C 32 87, 33 88.4, 32.4 90 C 31 90.6, 29.4 90, 28.6 88.6" fill="#64748b" stroke="#111" stroke-width="0.8"/>
  </g>`,
};

// ============================================================================
// 6. PATINHA DE CHAPÉU — arco roxo no topo/esquerda e patinha de boina e laço
// ============================================================================

const duckling = {
  front: `
  <defs>
    <linearGradient id="dkArc" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#8b5cf6"/><stop offset="1" stop-color="#6d28d9"/></linearGradient>
    <linearGradient id="dkBeret" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#c4b5fd"/><stop offset="1" stop-color="#8b9fe0"/></linearGradient>
  </defs>
  <!-- arco roxo (topo e lado esquerdo) -->
  <path d="${arc(110, 300, R + 3)}" fill="none" stroke="${L}" stroke-width="5"/>
  <path d="${arc(110, 300, R + 3)}" fill="none" stroke="url(#dkArc)" stroke-width="3.8" stroke-linecap="round"/>
  <path class="nx-a cr-shine" d="${arc(120, 290, R + 3.6)}" fill="none" stroke="#ddd6fe" stroke-width="1" stroke-linecap="round" stroke-dasharray="10 120"/>
  <!-- patinha no canto superior direito -->
  <g class="nx-a cr-bob" style="transform-origin:80px 24px">
    <path d="M70 30 C 68 22, 74 16, 82 17 C 90 18, 94 26, 90 32 C 87 36, 74 36, 70 30 Z" fill="#ffffff" stroke="#111" stroke-width="0.9"/>
    <circle cx="80" cy="14" r="7.4" fill="#ffffff" stroke="#111" stroke-width="0.9"/>
    <path d="M86 15 C 90 14.6, 93 15.6, 93 17 C 92 18.4, 89 18.6, 86 17.6 Z" fill="#fb923c" stroke="#111" stroke-width="0.7"/>
    <ellipse cx="82.4" cy="13" rx="1" ry="1.4" fill="#111"/><circle cx="82.7" cy="12.5" r="0.35" fill="#fff"/>
    <path d="M80.6 10.8 C 81.4 10.2, 82.6 10.2, 83.4 10.8" fill="none" stroke="#111" stroke-width="0.5"/>
    <path d="M86 30 C 84 26, 84 24, 86 22" fill="none" stroke="#bfdbfe" stroke-width="0.8"/>
    <path d="M74 35 L 73 38 L 76 37.4 M84 35 L 84 38 L 87 37.4" fill="#fb923c" stroke="#111" stroke-width="0.5"/>
    <!-- boina inclinada -->
    <g transform="rotate(-14 80 8)">
      <ellipse cx="80" cy="8" rx="9" ry="2.6" fill="#e0e7ff" stroke="#111" stroke-width="0.7"/>
      <path d="M72 7.6 C 72 1.6, 88 1.6, 88 7.6 Z" fill="url(#dkBeret)" stroke="#111" stroke-width="0.7"/>
      <circle cx="80" cy="1.6" r="1" fill="#8b9fe0" stroke="#111" stroke-width="0.5"/>
    </g>
    <!-- laço rosa grande -->
    <g class="nx-a cr-sway" style="transform-origin:72px 7px">
      <path d="M72 7 C 66 1, 61 4, 63 9 C 65 12, 69 10, 72 7 Z M72 7 C 74 0, 80 0, 79 5 C 78 9, 74 9, 72 7 Z" fill="#f9a8d4" stroke="#111" stroke-width="0.7" stroke-linejoin="round"/>
      <circle cx="72" cy="7" r="1.6" fill="#f472b6" stroke="#111" stroke-width="0.5"/>
      <path d="M64.6 6 C 65.6 5, 67 4.8, 68 5.4" fill="none" stroke="#fff" stroke-width="0.5"/>
    </g>
  </g>`,
};

// ============================================================================
// 7. QUERENDO BRIGA — punhos na base, traços de impacto e veia saltando
// ============================================================================

function fist(x: number, flip = false) {
  const t = flip ? `translate(${x * 2} 0) scale(-1 1)` : '';
  return `<g transform="${t}">
    <path d="M${x - 8} 99 C ${x - 9} 92, ${x - 8} 86, ${x - 4} 84 C ${x} 82, ${x + 6} 82, ${x + 8} 85 C ${x + 10} 88, ${x + 9} 94, ${x + 7} 99 Z" fill="#a0673d" stroke="#2a160b" stroke-width="0.9"/>
    ${[0, 1, 2, 3].map((k) => `<path d="M${x - 5 + k * 3.4} 84.4 C ${x - 5.4 + k * 3.4} 86.6, ${x - 5 + k * 3.4} 88.4, ${x - 4 + k * 3.4} 89.6" fill="none" stroke="#5c3418" stroke-width="0.7" stroke-linecap="round"/>`).join('')}
    <path d="M${x - 6} 91 C ${x - 2} 92, ${x + 2} 92, ${x + 5} 90" fill="none" stroke="#5c3418" stroke-width="0.8"/>
    <path d="M${x - 6} 91 C ${x - 8} 88, ${x - 6} 86, ${x - 3} 87" fill="#b87a4b" stroke="#2a160b" stroke-width="0.7"/>
    <path d="M${x - 3} 84.6 C ${x - 1} 83.8, ${x + 2} 83.8, ${x + 4} 84.4" fill="none" stroke="#d9a074" stroke-width="0.6"/>
  </g>`;
}

const angry = {
  front: `
  <!-- punhos -->
  <g class="nx-a cr-jitter">${fist(40)}</g>
  <g class="nx-a cr-jitter cr-delay">${fist(60, true)}</g>
  <!-- traços amarelos de impacto -->
  ${[[18, 22, -140], [12, 30, -160], [24, 15, -120], [82, 22, -40], [88, 30, -20], [76, 15, -60]].map(([x, y, a], i) => `<g class="nx-a cr-burst" style="transform-origin:${x}px ${y}px;animation-delay:${(i % 3) * 0.12}s"><path d="M${x} ${y} l ${f(Math.cos(((a as number) * Math.PI) / 180) * 7)} ${f(Math.sin(((a as number) * Math.PI) / 180) * 7)}" stroke="#facc15" stroke-width="1.8" stroke-linecap="round"/></g>`).join('')}
  <!-- veia saltando -->
  <g class="nx-a cr-beat" style="transform-origin:84px 12px">
    ${[0, 90, 180, 270].map((r) => `<path transform="rotate(${r} 84 12)" d="M85.6 10.4 C 86 7, 88.4 6, 90 6.6 M85.6 10.4 C 89 10, 90 7.6, 89.4 6" fill="none" stroke="#dc2626" stroke-width="1.8" stroke-linecap="round"/>`).join('')}
  </g>`,
};

// ============================================================================
// 8. LUTADOR DE ARCADE — topete loiro espetado e luvas de couro em guarda
// ============================================================================

function glove(x: number, flip = false) {
  const t = flip ? `translate(${x * 2} 0) scale(-1 1)` : '';
  return `<g transform="${t}">
    <path d="M${x - 9} 99 L ${x - 8} 92 L ${x + 6} 92 L ${x + 7} 99 Z" fill="#e7d3b0" stroke="#3b2414" stroke-width="0.8"/>
    <path d="M${x - 8} 94.4 L ${x + 6.6} 94.4" stroke="#3b2414" stroke-width="0.5" stroke-dasharray="1 0.8"/>
    <path d="M${x - 9} 92 C ${x - 12} 84, ${x - 8} 74, ${x} 74 C ${x + 8} 74, ${x + 11} 82, ${x + 7} 92 Z" fill="url(#lfGlove)" stroke="#3b2414" stroke-width="0.9"/>
    <path d="M${x - 9} 84 C ${x - 6} 82, ${x - 3} 83, ${x - 2} 86 C ${x - 4} 88, ${x - 7} 88, ${x - 9} 87 Z" fill="#a16a3c" stroke="#3b2414" stroke-width="0.6"/>
    <path d="M${x - 4} 76 C ${x} 75, ${x + 4} 76, ${x + 6} 79" fill="none" stroke="#f3d9b3" stroke-opacity="0.7" stroke-width="0.8" stroke-linecap="round"/>
    <path d="M${x - 6} 80 C ${x - 2} 78, ${x + 3} 78.6, ${x + 7} 82" fill="none" stroke="#3b2414" stroke-width="0.4" stroke-dasharray="0.9 0.7"/>
  </g>`;
}

const fighter = {
  front: `
  <defs>
    <linearGradient id="lfHair" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#fff3b0"/><stop offset="0.45" stop-color="#f6c443"/><stop offset="1" stop-color="#b7791f"/></linearGradient>
    <linearGradient id="lfGlove" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#d49a63"/><stop offset="0.6" stop-color="#a5642f"/><stop offset="1" stop-color="#6b3a16"/></linearGradient>
  </defs>
  <!-- topete loiro volumoso -->
  <g class="nx-a cr-hairwave" style="transform-origin:50px 22px">
    <path d="M16 36 C 12 24, 18 14, 26 12 C 24 8, 28 3, 34 4 C 36 -1, 44 -2, 48 2 C 52 -3, 62 -2, 64 4 C 70 2, 78 6, 76 12 C 84 12, 90 22, 86 34 C 82 28, 76 24, 70 24 C 72 28, 70 32, 66 33 C 64 28, 58 24, 50 24 C 42 24, 36 28, 34 33 C 30 32, 28 28, 30 24 C 24 24, 19 29, 16 36 Z" fill="url(#lfHair)" stroke="#5b3a0e" stroke-width="0.9" stroke-linejoin="round"/>
    <path d="M26 14 C 32 12, 36 14, 38 18 M44 6 C 48 8, 50 12, 50 18 M60 6 C 64 9, 66 13, 66 18 M74 14 C 70 14, 68 16, 66 20" fill="none" stroke="#b7791f" stroke-width="0.7" stroke-linecap="round"/>
    <path class="nx-a cr-shine" d="M30 10 C 40 4, 56 3, 70 8" fill="none" stroke="#fffbe6" stroke-width="1.2" stroke-linecap="round" stroke-dasharray="7 50"/>
    <!-- fios caídos nas laterais -->
    <path d="M18 34 C 14 40, 13 46, 14 52 C 16 46, 18 42, 22 38 Z M82 34 C 86 40, 87 46, 86 52 C 84 46, 82 42, 78 38 Z" fill="url(#lfHair)" stroke="#5b3a0e" stroke-width="0.7"/>
  </g>
  <!-- luvas em guarda -->
  <g class="nx-a cr-guard">${glove(24)}</g>
  <g class="nx-a cr-guard cr-delay">${glove(76, true)}</g>`,
};

// ============================================================================
// 9. HARMONIA FLORAL — guirlanda de folhas finas, flores amarelas e roxas
// ============================================================================

function flower(x: number, y: number, petal: string, core: string, s: number, n = 6) {
  return `<g>${Array.from({ length: n }, (_, i) => `<ellipse cx="${f(x)}" cy="${f(y - s)}" rx="${f(s * 0.5)}" ry="${f(s)}" fill="${petal}" stroke="#4d3a12" stroke-width="0.35" transform="rotate(${(360 / n) * i} ${f(x)} ${f(y)})"/>`).join('')}<circle cx="${f(x)}" cy="${f(y)}" r="${f(s * 0.5)}" fill="${core}" stroke="#4d3a12" stroke-width="0.35"/></g>`;
}

const harmony = {
  front: `
  <defs><linearGradient id="hmLeaf" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#bef264"/><stop offset="0.5" stop-color="#65a30d"/><stop offset="1" stop-color="#3f6212"/></linearGradient></defs>
  <path d="${arc(160, 380, R + 2.2)}" fill="none" stroke="#4d7c0f" stroke-width="0.9"/>
  ${Array.from({ length: 22 }, (_, i) => {
    const deg = 160 + i * 10;
    const [x, y] = pt(deg, R + 2.2);
    const out = deg + (i % 2 ? 24 : -24);
    const [x2, y2] = pt(out, R + 9);
    return `<g class="nx-a cr-sway" style="transform-origin:${f(x)}px ${f(y)}px;animation-delay:${((i % 5) * 0.2).toFixed(1)}s"><path d="M${f(x)} ${f(y)} Q ${f((x + x2) / 2 + 1.5)} ${f((y + y2) / 2 - 1.5)} ${f(x2)} ${f(y2)} Q ${f((x + x2) / 2 - 1.5)} ${f((y + y2) / 2 + 1.5)} ${f(x)} ${f(y)} Z" fill="url(#hmLeaf)" stroke="#365314" stroke-width="0.3"/>${i % 3 === 0 ? `<circle cx="${f(x2)}" cy="${f(y2)}" r="0.7" fill="#facc15"/>` : ''}</g>`;
  }).join('')}
  <!-- flores amarelas à esquerda -->
  <g class="nx-a cr-sway" style="transform-origin:28px 14px">${flower(26, 14, '#facc15', '#ea580c', 3.4)}${flower(18, 20, '#fde047', '#f97316', 2.6)}${flower(34, 8, '#fde047', '#ea580c', 2.2)}</g>
  <!-- flores roxas à direita -->
  <g class="nx-a cr-sway cr-delay" style="transform-origin:72px 14px">${flower(74, 14, '#a855f7', '#f5d0fe', 3.4, 5)}${flower(82, 20, '#c084fc', '#faf5ff', 2.6, 5)}${flower(66, 8, '#8b5cf6', '#ede9fe', 2.2, 5)}</g>
  ${sparkle(50, 8, 1.4, '#fef9c3')}${sparkle(40, 4, 1, '#fef9c3', 0.8)}${sparkle(60, 4, 1, '#f5d0fe', 1.4)}`,
};

// ============================================================================
// 10. CARTÃO AMARELO — mão de árbitro erguendo o cartão ao lado do avatar
// ============================================================================

const yellowCard = {
  front: `
  <defs><linearGradient id="ycCard" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#fef08a"/><stop offset="0.5" stop-color="#facc15"/><stop offset="1" stop-color="#ca8a04"/></linearGradient>
    <clipPath id="ycClip"><rect x="2" y="30" width="18" height="26" rx="2.4"/></clipPath></defs>
  <g class="nx-a cr-card" style="transform-origin:16px 92px">
    <!-- manga -->
    <path d="M2 100 L 4 84 C 6 80, 14 80, 16 84 L 18 100 Z" fill="#d4d4d8" stroke="#111" stroke-width="0.8"/>
    <path d="M3.6 86 C 7 84.4, 13 84.4, 16.4 86 L 16 89 C 12 88, 8 88, 4 89 Z" fill="#27272a" stroke="#111" stroke-width="0.6"/>
    <!-- cartão -->
    <rect x="2" y="30" width="18" height="26" rx="2.4" fill="url(#ycCard)" stroke="#111" stroke-width="0.9" transform="rotate(-8 11 43)"/>
    <g clip-path="url(#ycClip)" transform="rotate(-8 11 43)"><g class="nx-a cr-glint-y"><rect x="-4" y="26" width="30" height="4" fill="#fff" opacity="0.8" transform="rotate(-30 11 43)"/></g></g>
    <!-- mão segurando -->
    <path d="M6 84 C 4 78, 5 70, 8 64 C 9 60, 11 58, 13 56 L 16 57 C 15 60, 14 63, 14 66 C 16 64, 18 64, 18.6 66 C 19 69, 18 74, 16 84 Z" fill="#f2c9a0" stroke="#111" stroke-width="0.8" stroke-linejoin="round"/>
    <path d="M11 60 C 12 57, 13 55.6, 14.4 54.4 C 15.6 54, 16.4 55, 16 56.4" fill="#f2c9a0" stroke="#111" stroke-width="0.7"/>
    <path d="M8 72 C 10 71, 12 71, 14 72 M8 76 C 10 75, 12 75, 14 76" fill="none" stroke="#b8865c" stroke-width="0.5"/>
  </g>`,
};

// ============================================================================
// 11. CORAÇÃO COREANO — mão fazendo coração com os dedos (canto inferior esquerdo)
// ============================================================================

const fingerHeart = {
  front: `
  <g class="nx-a cr-fingerheart" style="transform-origin:14px 96px">
    <path d="M4 100 C 2 92, 4 84, 10 80 C 14 78, 18 78, 20 80 C 22 82, 22 86, 20 88 C 22 90, 22 94, 20 96 L 18 100 Z" fill="#b07a52" stroke="#3b2414" stroke-width="0.8"/>
    ${[83, 87.4, 91.6].map((y) => `<path d="M11 ${y} C 15 ${y - 1}, 19 ${y - 0.6}, 21 ${y + 0.6} C 21.6 ${y + 1.6}, 21 ${y + 2.4}, 19.6 ${y + 2.4} C 17 ${y + 2.4}, 14 ${y + 2}, 11 ${y + 2}" fill="#c08a5f" stroke="#3b2414" stroke-width="0.6"/>`).join('')}
    <!-- polegar e indicador cruzados -->
    <path d="M12 80 C 12 74, 15 68, 19 66 C 21 65.4, 22.4 66.4, 22 68 C 21 71, 19 75, 17.6 80" fill="#c08a5f" stroke="#3b2414" stroke-width="0.8"/>
    <path d="M16 81 C 18 76, 22 72, 26 72 C 28 72, 28.6 73.6, 27.6 74.6 C 25 76.6, 22 79, 20 82" fill="#d09a6e" stroke="#3b2414" stroke-width="0.8"/>
    <path d="M24.6 72.6 C 25.6 72.4, 26.4 72.8, 26.8 73.6" fill="none" stroke="#f1c9a5" stroke-width="0.5"/>
  </g>
  <g class="nx-a cr-heartrise"><path d="M25 70 C 21 67, 21 64, 23 63 C 24 62.6, 25 63.2, 25 64 C 25 63.2, 26 62.6, 27 63 C 29 64, 29 67, 25 70 Z" fill="#f43f5e" stroke="#881337" stroke-width="0.4"/></g>
  <g class="nx-a cr-heartrise cr-delay2"><path d="M30 66 C 27.6 64.2, 27.6 62.4, 28.8 61.8 C 29.4 61.6, 30 62, 30 62.4 C 30 62, 30.6 61.6, 31.2 61.8 C 32.4 62.4, 32.4 64.2, 30 66 Z" fill="#fb7185"/></g>
  ${sparkle(28, 72, 1.2, '#fde68a', 0.4)}`,
};

// ============================================================================
// 12. ABELHINHA DORMINHOCA — pixel art: trepadeira em volta e abelha dormindo
// ============================================================================

const beePixel = (() => {
  const P = 1.6; // tamanho do pixel
  const snap = (v: number) => Math.round(v / P) * P;
  const px = (x: number, y: number, c: string, w = 1, h = 1) =>
    `<rect x="${f(snap(x))}" y="${f(snap(y))}" width="${f(P * w)}" height="${f(P * h)}" fill="${c}"/>`;
  let vine = '';
  const greens = ['#3f7d2c', '#5a9e3a', '#2f5e22', '#7cb342'];
  for (let deg = 0; deg < 360; deg += 2.6) {
    const [x, y] = pt(deg, R + 2.6 + Math.sin(deg * 0.21) * 1.2);
    vine += px(x, y, greens[Math.floor(deg / 2.6) % 3]);
    if (Math.floor(deg / 2.6) % 7 === 0) {
      const [lx, ly] = pt(deg + 2, R + 5);
      vine += px(lx, ly, greens[3]) + px(lx + P, ly, greens[1]) + px(lx, ly + P, greens[2]);
    }
  }
  const flowerColors = [['#facc15', '#a16207'], ['#7dd3fc', '#0369a1'], ['#d8b4fe', '#7e22ce'], ['#fef9c3', '#ca8a04']];
  let flowers = '';
  [15, 55, 95, 175, 215, 255, 295, 335].forEach((deg, i) => {
    const [x, y] = pt(deg, R + 4.4);
    const [c, cc] = flowerColors[i % 4];
    flowers += `<g class="nx-a cr-pixsway" style="transform-origin:${f(x)}px ${f(y)}px;animation-delay:${(i * 0.25).toFixed(2)}s">${px(x, y - P, c)}${px(x - P, y, c)}${px(x + P, y, c)}${px(x, y + P, c)}${px(x, y, cc)}</g>`;
  });
  // abelha dormindo sobre uma flor clara (canto inferior esquerdo) — sprites
  const Q = 1.5;
  const sprite = (rows: string[], ox: number, oy: number, pal: Record<string, string>) =>
    rows
      .map((row, j) =>
        [...row].map((ch, i) => (pal[ch] ? `<rect x="${f(ox + i * Q)}" y="${f(oy + j * Q)}" width="${Q}" height="${Q}" fill="${pal[ch]}"/>` : '')).join('')
      )
      .join('');
  const beePal = { k: '#3f2a14', y: '#facc15', Y: '#fde68a', w: '#f0f9ff', W: '#bae6fd', p: '#fb7185' };
  const bee = `<g class="nx-a cr-pixbreathe" style="transform-origin:11px 92px">${sprite(
    [
      '.....kkkk...',
      '....kwwWWk..',
      '....kwWWWk..',
      '..kkkkkkkkk.',
      '.kYykykyyYYk',
      'kyyykykyyykk',
      'kyyykykyypyk',
      '.kyykykyyyk.',
      '..kkkkkkkk..',
    ],
    2,
    80,
    beePal
  )}</g>`;
  const bigFlower = sprite(
    ['..cCCcCCcCC..', '.CCCCoooCCCC.', '..cCC.g.CCc..', '......g......'],
    1,
    93.5,
    { c: '#fde68a', C: '#fffbeb', o: '#f59e0b', g: '#3f7d2c' }
  );
  const Zrows = ['ZZZZZ', '...Z.', '..Z..', '.Z...', 'ZZZZZ'];
  const zz = [0, 1, 2]
    .map((i) => `<g class="nx-a cr-pixz" style="animation-delay:${(i * 0.9).toFixed(1)}s">${sprite(Zrows, 20 + i * 7, 76 - i * 8, { Z: '#e0e7ff' })}</g>`)
    .join('');
  return {
    front: `<g shape-rendering="crispEdges">${vine}${flowers}${bigFlower}${bee}${zz}</g>`,
  };
})();

export type Critter3Id =
  | 'lily'
  | 'mana-preta'
  | 'amethyst-choker'
  | 'batgirl'
  | 'depresso'
  | 'duckling-hat'
  | 'angry-fists'
  | 'arcade-fighter'
  | 'floral-harmony'
  | 'yellow-card'
  | 'finger-heart'
  | 'sleepy-bee';

export const CRITTERS3: Record<Critter3Id, { back?: string; front: string }> = {
  lily,
  'mana-preta': manaPreta,
  'amethyst-choker': choker,
  batgirl,
  depresso,
  'duckling-hat': duckling,
  'angry-fists': angry,
  'arcade-fighter': fighter,
  'floral-harmony': harmony,
  'yellow-card': yellowCard,
  'finger-heart': fingerHeart,
  'sleepy-bee': beePixel,
};
