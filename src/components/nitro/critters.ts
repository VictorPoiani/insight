/**
 * Molduras ilustradas de bichinhos (estilo adesivo: traço fino escuro,
 * sombreado em dois tons, brilhos). Desenhos originais do Insight.
 *
 * Coordenadas: viewBox 0–100, avatar = círculo (50, 50) r 36.8.
 * `back` fica atrás da foto; `front` por cima. Elementos animados usam
 * `nx-a` + uma classe cr-* (nitro.css) e só transform/opacity.
 */

export type CritterId = 'cat-ribbon' | 'bunny-daisy' | 'fox-shrine' | 'shiba-nap' | 'ghost-hug' | 'bear-honey' | 'frog-king' | 'storm-cloud';

const LINE = '#4a2c2a';

/** Orelha de gato/raposa genérica (lado esquerdo); a direita é espelhada. */
function catEar(id: string, outer: [string, string], inner: string, twitch: boolean) {
  return `
  <g transform="translate(31 22) scale(1.18) translate(-31 -22)"><g class="${twitch ? 'nx-a cr-twitch' : ''}" style="transform-origin:31px 22px">
    <path d="M23.5 26 C 20 16, 18.5 7, 20.5 0.5 C 27 3, 34 8, 39.5 15 C 33 16, 27 20, 23.5 26 Z" fill="url(#${id})" stroke="${LINE}" stroke-width="0.9" stroke-linejoin="round"/>
    <path d="M25.6 20.6 C 23.6 14, 22.9 8.6, 23.6 4.6 C 28 7, 32 10.2, 35.6 14.6 C 31.2 15.6, 28.1 17.6, 25.6 20.6 Z" fill="${inner}"/>
    <path d="M24.6 11 C 24.7 8.4, 24.9 6.6, 25.4 5.5 C 27.4 6.8, 29.2 8.2, 30.8 9.8" fill="none" stroke="#ffffff" stroke-opacity="0.55" stroke-width="0.7" stroke-linecap="round"/>
    <path d="M26.4 19.2 l 2.4 -3.8 M28.6 17.9 l 1.9 -4.1 M31 16.8 l 1.1 -3.7" stroke="#fffaf3" stroke-width="0.75" stroke-linecap="round"/>
    <defs><linearGradient id="${id}" x1="0" y1="0" x2="1" y2="1"><stop offset="0%" stop-color="${outer[0]}"/><stop offset="100%" stop-color="${outer[1]}"/></linearGradient></defs>
  </g></g>`;
}

/** Patinha vista de cima segurando a borda (lado esquerdo, centro x≈37). */
function paw(id: string, colors: [string, string], cls = '', style = '') {
  return `
  <g class="${cls}" style="${style}">
    <defs><linearGradient id="${id}" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stop-color="${colors[0]}"/><stop offset="100%" stop-color="${colors[1]}"/></linearGradient></defs>
    <path d="M29.6 93.6 C 28.6 89.6, 30 85.6, 33 85.2 C 33.8 82.8, 36.4 82.6, 37.4 84.6 C 38.6 82.7, 41.2 83.1, 41.8 85.4 C 44.6 85.2, 46.2 89, 45.2 93.4 C 44.2 98.6, 30.8 98.8, 29.6 93.6 Z" fill="url(#${id})" stroke="${LINE}" stroke-width="0.9" stroke-linejoin="round"/>
    <path d="M33.4 85.6 C 33.6 87.2, 33.8 88.4, 34 89.2 M37.6 85 C 37.7 86.8, 37.7 88, 37.6 89.2 M41.6 85.8 C 41.3 87.2, 41 88.4, 40.8 89.2" fill="none" stroke="${LINE}" stroke-width="0.75" stroke-linecap="round"/>
    <path d="M31.2 87.4 C 31.4 86.2, 32 85.7, 32.7 85.8" fill="none" stroke="#ffffff" stroke-opacity="0.75" stroke-width="0.7" stroke-linecap="round"/>
    <path d="M31.4 95.6 C 35 97.2, 40.6 97.2, 44 95.4" fill="none" stroke="${LINE}" stroke-opacity="0.25" stroke-width="1.2" stroke-linecap="round"/>
  </g>`;
}

const MIRROR = 'transform="translate(100 0) scale(-1 1)"';

// ============================================================================
// GATINHO DE FITA — gato tricolor, laço de cetim, patinhas e plaquinha
// ============================================================================

const catRibbon = {
  front: `
  ${catEar('crCatL', ['#f8b16a', '#d9772b'], '#f9b8c6', false)}
  <g ${MIRROR}>${catEar('crCatR', ['#fffaf1', '#ead6bb'], '#f7b0c0', true)}</g>
  <!-- laço de cetim na orelha direita -->
  <g class="nx-a cr-bob" style="transform-origin:68px 18px">
    <defs>
      <linearGradient id="crBow" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stop-color="#ffd3e0"/><stop offset="100%" stop-color="#ec86a8"/></linearGradient>
    </defs>
    <path d="M67.5 18.4 C 66 22, 64.2 25.6, 62.4 28.8 L 65.4 28.1 L 66.8 30.6 C 67.9 26.4, 68.4 22.4, 68.4 18.4 Z" fill="url(#crBow)" stroke="${LINE}" stroke-width="0.8" stroke-linejoin="round"/>
    <path d="M68.6 18.4 C 71 22, 73.4 25.2, 75.6 27.6 L 72.6 27.7 L 72.1 30.6 C 70.6 26.6, 69.3 22.2, 68.6 18.4 Z" fill="url(#crBow)" stroke="${LINE}" stroke-width="0.8" stroke-linejoin="round"/>
    <path d="M68 17.6 C 62 10.8, 56.6 13.6, 58.6 19 C 60.6 23.4, 65 21.4, 68 17.6 Z" fill="url(#crBow)" stroke="${LINE}" stroke-width="0.85" stroke-linejoin="round"/>
    <path d="M68.6 17.6 C 73.6 10.2, 79.6 12, 78.4 18.2 C 77.4 23, 72.2 21.2, 68.6 17.6 Z" fill="url(#crBow)" stroke="${LINE}" stroke-width="0.85" stroke-linejoin="round"/>
    <path d="M60.4 17.6 C 61.8 16, 64 16.4, 65.8 17.8 M76.6 16.6 C 75.2 15.2, 73 15.4, 71 17" fill="none" stroke="#d76b92" stroke-width="0.7" stroke-linecap="round"/>
    <path d="M60 15.6 C 60.8 14.4, 62 14, 63.2 14.3 M74 13.2 C 75.4 13, 76.6 13.6, 77.2 14.6" fill="none" stroke="#ffffff" stroke-opacity="0.85" stroke-width="0.7" stroke-linecap="round"/>
    <ellipse cx="68.3" cy="17.9" rx="2.4" ry="2.6" fill="#f39bbb" stroke="${LINE}" stroke-width="0.8"/>
    <ellipse cx="67.7" cy="17.1" rx="0.8" ry="0.6" fill="#fff" fill-opacity="0.9"/>
  </g>
  <!-- patinhas -->
  ${paw('crCatPawL', ['#f9b977', '#dc7f33'], 'nx-a cr-knead', 'transform-origin:37px 95px')}
  <g ${MIRROR}>${paw('crCatPawR', ['#fffaf2', '#e8d2b4'], 'nx-a cr-knead cr-delay', 'transform-origin:37px 95px')}</g>
  <!-- fita e plaquinha de coração -->
  <path d="M44.6 92.2 Q 50 95.6 55.4 92.2" fill="none" stroke="${LINE}" stroke-width="2.6" stroke-linecap="round"/>
  <path d="M44.6 92.2 Q 50 95.6 55.4 92.2" fill="none" stroke="#e05587" stroke-width="1.6" stroke-linecap="round"/>
  <g class="nx-a cr-swing" style="transform-origin:50px 94px">
    <defs><linearGradient id="crTag" x1="0" y1="0" x2="1" y2="1"><stop offset="0%" stop-color="#fff2b3"/><stop offset="55%" stop-color="#f2c44c"/><stop offset="100%" stop-color="#c98b1b"/></linearGradient></defs>
    <circle cx="50" cy="94.2" r="0.95" fill="none" stroke="${LINE}" stroke-width="0.6"/>
    <path d="M50 100.6 C 45.2 97.4, 45.6 93.4, 48.2 93.6 C 49.2 93.7, 49.8 94.4, 50 95.3 C 50.2 94.4, 50.8 93.7, 51.8 93.6 C 54.4 93.4, 54.8 97.4, 50 100.6 Z" fill="url(#crTag)" stroke="${LINE}" stroke-width="0.8" stroke-linejoin="round"/>
    <path d="M47.6 95 C 47.8 94.4, 48.3 94.2, 48.8 94.3" fill="none" stroke="#fff" stroke-width="0.6" stroke-linecap="round"/>
  </g>`,
};

// ============================================================================
// COELHINHO ALGODÃO — orelhas caídas atrás da foto + coroa de margaridas
// ============================================================================

function daisy(x: number, y: number, s: number, rot: number) {
  const petals = Array.from({ length: 10 }, (_, i) => {
    const a = i * 36;
    return `<ellipse cx="0" cy="-3.1" rx="1.15" ry="2.3" transform="rotate(${a})" fill="#ffffff" stroke="${LINE}" stroke-width="0.45"/>`;
  }).join('');
  return `<g transform="translate(${x} ${y}) rotate(${rot}) scale(${s})">${petals}
    <circle r="1.7" fill="#fbbf24" stroke="${LINE}" stroke-width="0.45"/>
    <circle cx="-0.5" cy="-0.5" r="0.55" fill="#fff7d1"/></g>`;
}

const bunnyDaisy = {
  back: `
  <defs>
    <linearGradient id="crBunEar" x1="0" y1="0" x2="1" y2="1"><stop offset="0%" stop-color="#ffffff"/><stop offset="100%" stop-color="#e4dbe2"/></linearGradient>
    <linearGradient id="crBunIn" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stop-color="#ffd7e1"/><stop offset="100%" stop-color="#f3a6ba"/></linearGradient>
  </defs>
  <g class="nx-a cr-sway" style="transform-origin:37px 14px">
    <path d="M38.5 13 C 26 9.5, 11.5 18, 6.6 34 C 2.8 47, 3.8 60, 8.6 68.4 C 12.4 74, 19.4 73, 21.2 66.4 C 23.4 56, 22.4 44, 26.2 32.4 C 29 24.4, 33.8 18, 38.5 13 Z" fill="url(#crBunEar)" stroke="${LINE}" stroke-width="0.9" stroke-linejoin="round"/>
    <path d="M33 17.4 C 24.4 18.4, 15.4 27.4, 12.4 39 C 10.2 49, 11 58, 13.8 64 C 15.8 66.6, 18 65.4, 18.4 62.4 C 19.4 52.4, 20 42.4, 23.4 32.4 C 25.8 25.2, 29 20.4, 33 17.4 Z" fill="url(#crBunIn)"/>
    <path d="M9.4 40 C 9.8 34, 12.6 27.6, 17 23" fill="none" stroke="#ffffff" stroke-width="0.9" stroke-linecap="round"/>
  </g>
  <g ${MIRROR}>
    <g class="nx-a cr-sway cr-delay" style="transform-origin:37px 14px">
      <path d="M38.5 13 C 26 9.5, 11.5 18, 6.6 34 C 2.8 47, 3.8 60, 8.6 68.4 C 12.4 74, 19.4 73, 21.2 66.4 C 23.4 56, 22.4 44, 26.2 32.4 C 29 24.4, 33.8 18, 38.5 13 Z" fill="url(#crBunEar)" stroke="${LINE}" stroke-width="0.9" stroke-linejoin="round"/>
      <path d="M33 17.4 C 24.4 18.4, 15.4 27.4, 12.4 39 C 10.2 49, 11 58, 13.8 64 C 15.8 66.6, 18 65.4, 18.4 62.4 C 19.4 52.4, 20 42.4, 23.4 32.4 C 25.8 25.2, 29 20.4, 33 17.4 Z" fill="url(#crBunIn)"/>
    </g>
  </g>`,
  front: `
  <g class="nx-a cr-bob" style="transform-origin:50px 16px">
    <path d="M27 21 C 34 14.6, 42 12.2, 50 12.2 C 58 12.2, 66 14.6, 73 21" fill="none" stroke="#4d7c0f" stroke-width="1.3" stroke-linecap="round"/>
    ${[[32, 17.2, -30], [41, 13.8, -15], [59, 13.8, 15], [68, 17.2, 30]].map(([x, y, r]) => `<ellipse cx="${x}" cy="${y}" rx="2.6" ry="1.1" transform="rotate(${r} ${x} ${y})" fill="#65a30d" stroke="${LINE}" stroke-width="0.45"/>`).join('')}
    ${daisy(28.5, 20, 0.85, -20)}${daisy(37.5, 14.8, 1, -8)}${daisy(50, 12.4, 1.15, 0)}${daisy(62.5, 14.8, 1, 10)}${daisy(71.5, 20, 0.85, 22)}
  </g>`,
};

// ============================================================================
// RAPOSA DO SANTUÁRIO — orelhas, corda trançada, papel shide e sininho
// ============================================================================

function foxEar(id: string, twitch: boolean) {
  return `
  <g class="${twitch ? 'nx-a cr-twitch' : ''}" style="transform-origin:31px 22px">
    <defs><linearGradient id="${id}" x1="0" y1="0" x2="1" y2="1"><stop offset="0%" stop-color="#f7a15a"/><stop offset="100%" stop-color="#c2501c"/></linearGradient></defs>
    <path d="M23.6 27 C 19.6 16, 16.8 6, 17.4 -6 C 26.2 -1, 35 8, 41 15.2 C 34 17, 28 21, 23.6 27 Z" fill="url(#${id})" stroke="${LINE}" stroke-width="0.9" stroke-linejoin="round"/>
    <path d="M17.4 -6 C 22 -3.4, 25.4 -0.4, 28.4 3 C 24.2 3.4, 21 3.2, 19 4.4 C 18 1, 17.5 -2.6, 17.4 -6 Z" fill="#2b1a14"/>
    <path d="M25.6 22 C 23 15, 21.6 8, 21.9 2.4 C 27 6.2, 32 11, 36 15.6 C 31.6 16.6, 28 19, 25.6 22 Z" fill="#fff3e3"/>
    <path d="M26 20.4 l 2.6 -4.4 M28.4 19 l 2 -4.6 M30.9 17.8 l 1.3 -4.2 M24.7 16 l 1.8 -3.6" stroke="#ffffff" stroke-width="0.75" stroke-linecap="round"/>
    <path d="M19.4 6 C 19.6 10, 20.8 14.6, 22.6 18.6" fill="none" stroke="#ffd9b0" stroke-opacity="0.8" stroke-width="0.7" stroke-linecap="round"/>
  </g>
  <!-- corda trançada -->
  <path d="M22.4 26.6 C 28.6 19.6, 34.6 16.4, 41.4 15.2" fill="none" stroke="${LINE}" stroke-width="3.3" stroke-linecap="round"/>
  <path d="M22.4 26.6 C 28.6 19.6, 34.6 16.4, 41.4 15.2" fill="none" stroke="#d62839" stroke-width="2.2" stroke-linecap="round"/>
  <path d="M22.4 26.6 C 28.6 19.6, 34.6 16.4, 41.4 15.2" fill="none" stroke="#ffffff" stroke-width="2.2" stroke-dasharray="1.3 1.5" stroke-linecap="butt"/>
  <!-- papel shide em zigue-zague -->
  <g class="nx-a cr-flutter" style="transform-origin:23px 27px">
    ${[[21.4, 27.6, 0], [22.8, 31.4, 1], [21.4, 35.2, 0], [22.8, 39, 1]].map(([x, y, odd]) => `<path d="M${x} ${y} h3.2 l ${odd ? -0.4 : 0.4} 3.6 h-3.2 Z" fill="${odd ? '#f1f2f5' : '#ffffff'}" stroke="#7c8291" stroke-width="0.5" stroke-linejoin="round"/>`).join('')}
    <path d="M22.4 28.4 l 0 2" stroke="#d6d9e0" stroke-width="0.5"/>
  </g>
  <!-- sininho -->
  <g class="nx-a cr-swing" style="transform-origin:27.6px 25px">
    <defs><radialGradient id="crBell" cx="35%" cy="30%" r="70%"><stop offset="0%" stop-color="#fff6c2"/><stop offset="60%" stop-color="#e9b631"/><stop offset="100%" stop-color="#a86f12"/></radialGradient></defs>
    <path d="M27.6 25 L 27.6 26.6" stroke="${LINE}" stroke-width="0.6"/>
    <circle cx="27.6" cy="28.4" r="2" fill="url(#crBell)" stroke="${LINE}" stroke-width="0.7"/>
    <path d="M26.2 28.9 L 29 28.9" stroke="${LINE}" stroke-width="0.5"/>
  </g>`;
}

const foxShrine = {
  front: `${foxEar('crFoxL', false)}<g ${MIRROR}>${foxEar('crFoxR', true)}</g>`,
};

// ============================================================================
// SONECA DO SHIBA — dormindo em cima da foto, respirando, com "z"
// ============================================================================

const shibaNap = {
  front: `
  <defs>
    <linearGradient id="crShiba" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stop-color="#f3a352"/><stop offset="100%" stop-color="#cc6b25"/></linearGradient>
  </defs>
  <g transform="translate(50 16.5) scale(1.14) translate(-50 -16.5)"><g class="nx-a cr-breathe" style="transform-origin:50px 16.5px">
    <!-- rabo enrolado -->
    <g class="nx-a cr-wag" style="transform-origin:66px 8px">
      <path d="M64.4 6 C 65.6 -3, 77.4 -4.6, 77.6 3.6 C 77.8 9.2, 71.4 10.8, 69.2 7.8 C 71.6 8.2, 73.8 6.6, 73 4.2 C 72.2 1.4, 67.6 1.4, 66.6 6 Z" fill="url(#crShiba)" stroke="${LINE}" stroke-width="0.85" stroke-linejoin="round"/>
      <path d="M68 2.6 C 70.4 1.2, 73.8 1.4, 75 3.8" fill="none" stroke="#fff1dc" stroke-width="1.2" stroke-linecap="round"/>
    </g>
    <!-- corpo -->
    <path d="M31 13 C 29 4, 38 -3, 51 -3 C 64 -3, 72 3, 71 11 C 70.5 15, 66 16.6, 60 16.6 L 38 16.6 C 34 16.6, 31.5 15.6, 31 13 Z" fill="url(#crShiba)" stroke="${LINE}" stroke-width="0.9" stroke-linejoin="round"/>
    <path d="M34 15.6 C 38 12, 48 11.6, 58 12 C 63 12.3, 67 13.6, 68 15.2 C 62 16.7, 40 16.8, 34 15.6 Z" fill="#fff1dc"/>
    <path d="M44 -1.6 C 50 -2.6, 57 -2, 62 0.4" fill="none" stroke="#ffd1a0" stroke-width="0.9" stroke-linecap="round"/>
    <!-- cabeça apoiada -->
    <path d="M30 2.6 L 29.4 -4.2 L 34.6 0.6 Z M36.2 0.9 L 38.6 -5.2 L 40.8 2.6 Z" fill="url(#crShiba)" stroke="${LINE}" stroke-width="0.8" stroke-linejoin="round"/>
    <path d="M30.6 1.6 L 30.4 -2 L 33.2 0.6 Z M37.2 0.8 L 38.6 -2.8 L 39.8 1.6 Z" fill="#ffd9c2"/>
    <path d="M27 8 C 27 1.6, 33 -1, 38 0.6 C 42 1.6, 44 5, 43.6 9 C 43 13.6, 39 16, 34 16 C 29.6 16, 27 12.6, 27 8 Z" fill="url(#crShiba)" stroke="${LINE}" stroke-width="0.9" stroke-linejoin="round"/>
    <path d="M28.6 11 C 30 8.6, 34 8, 37 9.6 C 39.6 11, 39.6 14.6, 36 15.6 C 32 16.6, 28.6 14.6, 28.6 11 Z" fill="#fff1dc"/>
    <path d="M31.4 8.8 q 1.4 1.1 2.8 0 M36 9.2 q 1.3 1.1 2.6 0" fill="none" stroke="${LINE}" stroke-width="0.75" stroke-linecap="round"/>
    <ellipse cx="34.6" cy="11.8" rx="1.1" ry="0.8" fill="${LINE}"/>
    <ellipse cx="30.4" cy="11.6" rx="1.3" ry="0.7" fill="#f7a7b4" opacity="0.8"/>
    <ellipse cx="39.4" cy="11.8" rx="1.3" ry="0.7" fill="#f7a7b4" opacity="0.8"/>
    <!-- patinhas -->
    <ellipse cx="36.6" cy="15.8" rx="2.6" ry="1.5" fill="#fff6ea" stroke="${LINE}" stroke-width="0.7"/>
    <ellipse cx="41.6" cy="16" rx="2.4" ry="1.4" fill="#fff6ea" stroke="${LINE}" stroke-width="0.7"/>
  </g></g>
  ${[0, 1, 2].map((i) => `<text class="nx-a cr-z" style="animation-delay:${i * 1.1}s" x="${44 + i * 2}" y="${-3 - i * 0.5}" font-size="${3.2 + i * 0.8}" font-weight="800" font-family="system-ui, sans-serif" fill="#e0e7ff" stroke="${LINE}" stroke-width="0.35">z</text>`).join('')}`,
};

// ============================================================================
// ABRAÇO FANTASMA — fantasminha espiando e segurando a foto
// ============================================================================

const ghostHug = {
  back: `
  <defs>
    <linearGradient id="crGhostB" x1="0" y1="0" x2="1" y2="1"><stop offset="0%" stop-color="#f3ecff"/><stop offset="100%" stop-color="#b9a4e6"/></linearGradient>
  </defs>
  <g class="nx-a cr-float">
    <path d="M60 14 C 64 -2, 86 -4, 94 10 C 100 22, 98 38, 96 52 C 94.6 62, 99 70, 95 76 C 91 80, 88 74, 85 78 C 82 82, 78 76, 76 70 Z" fill="url(#crGhostB)" fill-opacity="0.92" stroke="#4b3277" stroke-width="0.9" stroke-linejoin="round"/>
    <path d="M90 18 C 93 26, 93.6 36, 92 46" fill="none" stroke="#ffffff" stroke-opacity="0.7" stroke-width="1" stroke-linecap="round"/>
  </g>`,
  front: `
  <defs>
    <linearGradient id="crGhost" x1="0" y1="0" x2="0.6" y2="1"><stop offset="0%" stop-color="#ffffff"/><stop offset="100%" stop-color="#d9cbf5"/></linearGradient>
  </defs>
  <g class="nx-a cr-float">
    <!-- cabeça espiando -->
    <path d="M61.6 22 C 59.6 10, 70 2, 80 4 C 90 6, 94 16, 91 26 C 89 32, 84 35, 77 34 C 69 33, 63 29, 61.6 22 Z" fill="url(#crGhost)" stroke="#4b3277" stroke-width="0.9" stroke-linejoin="round"/>
    <g class="nx-a cr-blink" style="transform-origin:76px 18px">
      <ellipse cx="71.6" cy="18" rx="2.6" ry="3.4" fill="#2a1747"/>
      <ellipse cx="81.2" cy="17.4" rx="2.6" ry="3.4" fill="#2a1747"/>
      <circle cx="70.8" cy="16.8" r="1" fill="#fff"/>
      <circle cx="80.4" cy="16.2" r="1" fill="#fff"/>
    </g>
    <ellipse cx="76.6" cy="25" rx="1.6" ry="2" fill="#2a1747"/>
    <ellipse cx="67.4" cy="22.6" rx="2" ry="1" fill="#f9a8d4" opacity="0.7"/>
    <ellipse cx="85.6" cy="21.8" rx="2" ry="1" fill="#f9a8d4" opacity="0.7"/>
    <path d="M66 8.6 C 68.6 6.4, 72 5.4, 75 5.6" fill="none" stroke="#ffffff" stroke-width="1" stroke-linecap="round"/>
  </g>
  <!-- mãozinhas segurando a borda -->
  <g class="nx-a cr-squeeze" style="transform-origin:14px 40px">
    <path d="M7.6 40 C 7.6 35, 12.6 33, 16.6 35 L 20.6 36 C 22.6 36.5, 22.6 39, 20.6 39.4 L 18.6 39.8 C 20.6 40.3, 20.8 42.8, 18.6 43.2 L 17.6 43.4 C 19.4 44.3, 19 46.6, 17 46.6 L 13.6 46.4 C 9.6 46, 7.6 44, 7.6 40 Z" fill="url(#crGhost)" stroke="#4b3277" stroke-width="0.85" stroke-linejoin="round"/>
  </g>
  <g class="nx-a cr-squeeze cr-delay" style="transform-origin:70px 86px">
    <path d="M66 92.6 C 63 89, 64.6 84.4, 68.6 83.6 L 72 82.6 C 74 82, 75.4 84.2, 73.8 85.4 L 72.2 86.6 C 74.2 86, 75.8 88.2, 74 89.4 L 73.2 90 C 75.2 89.8, 76 92, 74.4 93.2 L 71.6 95 C 68.6 96.6, 67.6 94.6, 66 92.6 Z" fill="url(#crGhost)" stroke="#4b3277" stroke-width="0.85" stroke-linejoin="round"/>
  </g>`,
};

// ============================================================================
// URSINHO DO MEL — orelhas redondas, patinhas com pote de mel e uma abelha
// ============================================================================

function bearEar(id: string) {
  return `
  <defs><radialGradient id="${id}" cx="40%" cy="35%" r="70%"><stop offset="0%" stop-color="#b07a4c"/><stop offset="100%" stop-color="#7a4a26"/></radialGradient></defs>
  <circle cx="25" cy="20" r="9" fill="url(#${id})" stroke="${LINE}" stroke-width="0.9"/>
  <circle cx="25.6" cy="20.8" r="5" fill="#e8b884"/>
  <path d="M19.4 16.4 C 20.4 14, 22.6 12.6, 25 12.4" fill="none" stroke="#e7c39e" stroke-width="0.9" stroke-linecap="round"/>`;
}

const bearHoney = {
  back: `${bearEar('crBearL')}<g ${MIRROR}>${bearEar('crBearR')}</g>`,
  front: `
  ${paw('crBearPawL', ['#a46f42', '#734420'], 'nx-a cr-knead', 'transform-origin:37px 95px')}
  <g ${MIRROR}>${paw('crBearPawR', ['#a46f42', '#734420'], 'nx-a cr-knead cr-delay', 'transform-origin:37px 95px')}</g>
  <!-- pote de mel -->
  <defs>
    <linearGradient id="crPot" x1="0" y1="0" x2="1" y2="0"><stop offset="0%" stop-color="#c98a2a"/><stop offset="45%" stop-color="#f6c45a"/><stop offset="100%" stop-color="#b8741c"/></linearGradient>
  </defs>
  <path d="M42.2 89 C 42 85.2, 58 85.2, 57.8 89 L 59 97 C 59.2 101.6, 40.8 101.6, 41 97 Z" fill="url(#crPot)" stroke="${LINE}" stroke-width="0.9" stroke-linejoin="round"/>
  <path d="M41.4 87.6 C 41.4 85.4, 58.6 85.4, 58.6 87.6 C 58.6 89.4, 41.4 89.4, 41.4 87.6 Z" fill="#fde68a" stroke="${LINE}" stroke-width="0.8"/>
  <path d="M44 88.6 C 44.2 91, 45.6 91.4, 45.8 89 M52 89 C 52.2 92.2, 54 92.4, 54.2 89.2" fill="#f59e0b" stroke="${LINE}" stroke-width="0.6"/>
  <path d="M44.4 93 C 44.8 95.4, 45.6 97, 46.6 98" fill="none" stroke="#fff3c4" stroke-width="1" stroke-linecap="round"/>
  <!-- abelha -->
  <g class="nx-a cr-bee">
    <g transform="translate(80 12)">
      <ellipse class="nx-a cr-wing" cx="-0.6" cy="-2.6" rx="1.8" ry="2.4" fill="#ffffff" fill-opacity="0.85" stroke="${LINE}" stroke-width="0.4" style="transform-origin:-0.6px -0.6px"/>
      <ellipse class="nx-a cr-wing cr-delay" cx="1.4" cy="-2.4" rx="1.6" ry="2.2" fill="#ffffff" fill-opacity="0.85" stroke="${LINE}" stroke-width="0.4" style="transform-origin:1.4px -0.6px"/>
      <ellipse cx="0" cy="0" rx="3.2" ry="2.3" fill="#fcd34d" stroke="${LINE}" stroke-width="0.6"/>
      <path d="M-0.8 -2.1 L -0.8 2.1 M1 -2 L 1 2" stroke="${LINE}" stroke-width="0.9"/>
      <circle cx="-2.4" cy="-0.4" r="0.45" fill="${LINE}"/>
    </g>
  </g>`,
};

// ============================================================================
// SAPO REI — sapinho de coroa no topo, papo inflando e piscando
// ============================================================================

const frogKing = {
  front: `
  <defs>
    <linearGradient id="crFrog" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stop-color="#9be15d"/><stop offset="100%" stop-color="#3f8f2a"/></linearGradient>
    <linearGradient id="crCrown" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stop-color="#fff2b3"/><stop offset="60%" stop-color="#f2c44c"/><stop offset="100%" stop-color="#b9821a"/></linearGradient>
  </defs>
  <g class="nx-a cr-hop" style="transform-origin:50px 16px">
    <!-- corpo -->
    <path d="M36 15.6 C 34 9, 39 2.4, 50 2.4 C 61 2.4, 66 9, 64 15.6 C 60 17.4, 40 17.4, 36 15.6 Z" fill="url(#crFrog)" stroke="${LINE}" stroke-width="0.9" stroke-linejoin="round"/>
    <!-- papo -->
    <ellipse class="nx-a cr-croak" cx="50" cy="13.4" rx="5.4" ry="3.2" fill="#fef9c3" stroke="${LINE}" stroke-width="0.7" style="transform-origin:50px 11.6px"/>
    <!-- olhos -->
    <circle cx="43.4" cy="2.6" r="4.4" fill="url(#crFrog)" stroke="${LINE}" stroke-width="0.85"/>
    <circle cx="56.6" cy="2.6" r="4.4" fill="url(#crFrog)" stroke="${LINE}" stroke-width="0.85"/>
    <g class="nx-a cr-blink" style="transform-origin:50px 2.6px">
      <circle cx="43.4" cy="2.6" r="2.7" fill="#ffffff" stroke="${LINE}" stroke-width="0.5"/>
      <circle cx="56.6" cy="2.6" r="2.7" fill="#ffffff" stroke="${LINE}" stroke-width="0.5"/>
      <ellipse cx="43.8" cy="2.9" rx="1.2" ry="1.6" fill="${LINE}"/>
      <ellipse cx="56.2" cy="2.9" rx="1.2" ry="1.6" fill="${LINE}"/>
      <circle cx="43.3" cy="2.2" r="0.45" fill="#fff"/>
      <circle cx="55.7" cy="2.2" r="0.45" fill="#fff"/>
    </g>
    <path d="M45.6 9 Q 50 11, 54.4 9" fill="none" stroke="${LINE}" stroke-width="0.7" stroke-linecap="round"/>
    <ellipse cx="41" cy="9.4" rx="1.6" ry="0.8" fill="#f9a8b4" opacity="0.7"/>
    <ellipse cx="59" cy="9.4" rx="1.6" ry="0.8" fill="#f9a8b4" opacity="0.7"/>
    <!-- coroa -->
    <path d="M45 -1.6 L 44.4 -7 L 47.4 -4.4 L 50 -8.6 L 52.6 -4.4 L 55.6 -7 L 55 -1.6 Z" fill="url(#crCrown)" stroke="${LINE}" stroke-width="0.75" stroke-linejoin="round"/>
    <circle cx="50" cy="-3.4" r="0.9" fill="#e11d48" stroke="${LINE}" stroke-width="0.4"/>
    <!-- patinhas da frente segurando a borda -->
    <path d="M40.6 16 C 39 17.6, 38.8 19.4, 40 19.8 C 41 20, 41.2 19, 41.8 18.6 C 42.4 19.6, 43.6 19.6, 43.6 18.4 C 43.6 17.2, 42.6 16.2, 41.6 15.8 Z" fill="url(#crFrog)" stroke="${LINE}" stroke-width="0.7"/>
    <path d="M59.4 16 C 61 17.6, 61.2 19.4, 60 19.8 C 59 20, 58.8 19, 58.2 18.6 C 57.6 19.6, 56.4 19.6, 56.4 18.4 C 56.4 17.2, 57.4 16.2, 58.4 15.8 Z" fill="url(#crFrog)" stroke="${LINE}" stroke-width="0.7"/>
    <path d="M40 5.6 C 41.4 4.4, 43 4, 44.4 4.2" fill="none" stroke="#e9ffd6" stroke-width="0.8" stroke-linecap="round"/>
  </g>`,
};


// ============================================================================
// NUVEM DE TEMPESTADE — nuvens fofinhas no topo, raio que pisca e gotas
// ============================================================================

function cloudPuffs(fill: string, shade: string) {
  // contorno único da nuvem (arco no topo do avatar)
  return `
  <path d="M14 30 C 8 30, 6 22, 12 19.6 C 11.6 13, 19 9.6, 24 13 C 25.6 6.4, 34 4, 38.6 9 C 41 2.4, 52 1, 56.6 7.6 C 60 2.6, 70.6 3.4, 72 10.4 C 77.6 7.6, 85.6 11.6, 84.6 18.4 C 91 18.6, 93.4 26.4, 87.6 29.6 C 82 32.6, 76 28.6, 74 25.6 C 68 30, 60 29, 57 24.6 C 52 29.4, 43 29.4, 39.6 24.6 C 35 29.6, 26 30, 23.4 25.6 C 21 29.4, 17.6 30.6, 14 30 Z" fill="${fill}" stroke="${LINE}" stroke-width="0.9" stroke-linejoin="round"/>
  <path d="M16 27.6 C 19 28, 21.6 26.4, 23.4 23.6 C 26.6 27.6, 34 27.4, 39.6 22.4 C 44 27, 51.4 27, 57 22.6 C 61 27, 68.6 27.6, 74 23.6 C 77 27, 83 28.6, 87 26.4" fill="none" stroke="${shade}" stroke-width="2.2" stroke-linecap="round" stroke-opacity="0.75"/>
  <path d="M15.6 18.6 C 15.4 15.4, 18.4 13.4, 21.4 14.4 M27.6 11.4 C 29.4 8, 33.6 7.4, 36 9.4 M44.6 6.4 C 47.4 3.8, 51.6 4, 54 6.4 M61.6 6.6 C 64.4 5, 68 5.6, 69.6 8.4 M76.6 11.2 C 79.4 10.4, 82.4 12, 83 14.8" fill="none" stroke="#ffffff" stroke-opacity="0.55" stroke-width="1" stroke-linecap="round"/>`;
}

const stormCloud = {
  back: `
  <g class="nx-a cr-bob" style="transform-origin:50px 18px">
    <g transform="translate(0 -3.2) scale(1.04 1)">${cloudPuffs('#4b5568', '#2f3646')}</g>
  </g>`,
  front: `
  <defs>
    <linearGradient id="crCloud" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stop-color="#b8c2d6"/><stop offset="100%" stop-color="#6f7c96"/></linearGradient>
    <linearGradient id="crBolt" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stop-color="#fff7c2"/><stop offset="100%" stop-color="#f5b81a"/></linearGradient>
    <radialGradient id="crFlash"><stop offset="0%" stop-color="#fef9c3" stop-opacity="0.9"/><stop offset="100%" stop-color="#fef9c3" stop-opacity="0"/></radialGradient>
  </defs>
  <!-- raio (pisca) -->
  <g class="nx-a cr-bolt">
    <circle cx="66" cy="34" r="12" fill="url(#crFlash)"/>
    <path d="M67.6 22 L 61.4 33.4 L 66 33.4 L 62.2 43.6 L 71.4 30.4 L 66.6 30.4 L 70.4 22 Z" fill="url(#crBolt)" stroke="${LINE}" stroke-width="0.8" stroke-linejoin="round"/>
  </g>
  <g class="nx-a cr-bob" style="transform-origin:50px 18px">${cloudPuffs('url(#crCloud)', '#56627a')}</g>
  <!-- gotas -->
  ${[[22, 31, 0], [30, 30, 0.5], [78, 31, 0.25], [84, 30, 0.75], [38, 29.6, 1]].map(([x, y, d]) => `<path class="nx-a cr-drop" style="animation-delay:${d}s" d="M${x} ${y} C ${x - 1.4} ${y + 2.2}, ${x - 1.5} ${y + 3.6}, ${x} ${y + 4} C ${x + 1.5} ${y + 3.6}, ${x + 1.4} ${y + 2.2}, ${x} ${y} Z" fill="#93c5fd" stroke="${LINE}" stroke-width="0.5"/>`).join('')}`,
};

export const CRITTERS: Record<CritterId, { back?: string; front: string }> = {
  'cat-ribbon': catRibbon,
  'bunny-daisy': bunnyDaisy,
  'fox-shrine': foxShrine,
  'shiba-nap': shibaNap,
  'ghost-hug': ghostHug,
  'bear-honey': bearHoney,
  'frog-king': frogKing,
  'storm-cloud': stormCloud,
};
