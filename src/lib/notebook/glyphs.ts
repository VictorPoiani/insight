/**
 * Ícones autorais do Notebook (sem emojis): traço fino de 1.6 em grade 24×24,
 * cantos arredondados e cor herdada (currentColor). O asterisco do Insight é
 * o "sparkle" da casa. Guardados como marcação SVG para servir tanto ao React
 * quanto ao HTML gerado (pré-visualização do markdown).
 */

export const GLYPHS = {
  note: '<path d="M6 3h9l4 4v14H6z"/><path d="M15 3v4h4"/><path d="M9 12h7M9 16h5"/>',
  blocks: '<rect x="4" y="4" width="7" height="7" rx="1.5"/><rect x="13" y="4" width="7" height="7" rx="1.5"/><rect x="4" y="13" width="7" height="7" rx="1.5"/><rect x="13" y="13" width="7" height="7" rx="1.5"/>',
  folder: '<path d="M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/>',
  book: '<path d="M12 6.5c-2.2-1.6-5.2-2.1-8.5-1.6V19c3.3-.5 6.3 0 8.5 1.6 2.2-1.6 5.2-2.1 8.5-1.6V4.9c-3.3-.5-6.3 0-8.5 1.6z"/><path d="M12 6.5v14"/>',
  chapter: '<path d="M6 3h12v18H6z"/><path d="M13 3v6l2-1.4L17 9V3"/><path d="M9 13h6M9 17h4"/>',
  character: '<circle cx="12" cy="8" r="3.6"/><path d="M5 20.5c.8-4 3.6-6.2 7-6.2s6.2 2.2 7 6.2"/>',
  world: '<circle cx="12" cy="12" r="8.5"/><path d="M3.5 12h17"/><path d="M12 3.5c2.4 2.6 3.5 5.4 3.5 8.5s-1.1 5.9-3.5 8.5c-2.4-2.6-3.5-5.4-3.5-8.5s1.1-5.9 3.5-8.5z"/>',
  journal: '<rect x="6.5" y="3" width="13" height="18" rx="2"/><path d="M10 3v18"/><path d="M4 7.5h3M4 12h3M4 16.5h3"/>',
  screenplay: '<rect x="3.5" y="9.5" width="17" height="10.5" rx="1.5"/><path d="M3.5 9.5 4.6 5.6 19.9 4l.6 4"/><path d="m8.6 5.1 1.6 3.6M13.7 4.6l1.6 3.6"/>',
  study: '<path d="M2.5 9.5 12 5l9.5 4.5L12 14z"/><path d="M6.5 11.6v4c1.5 1.4 3.5 2.1 5.5 2.1s4-.7 5.5-2.1v-4"/><path d="M21.5 9.5v5"/>',
  meeting: '<circle cx="8.5" cy="8.5" r="3"/><path d="M16.5 5.5a2.6 2.6 0 0 1 0 5.2"/><path d="M3 19.5c.6-3 2.7-5 5.5-5s4.9 2 5.5 5"/><path d="M16 14.5c2.4.2 4.3 2 4.9 4.7"/>',
  idea: '<path d="M9.5 18h5M10.5 21h3"/><path d="M12 3a6 6 0 0 0-3.6 10.8c.7.5 1.1 1.3 1.1 2.1v.1h5v-.1c0-.8.4-1.6 1.1-2.1A6 6 0 0 0 12 3z"/>',
  goals: '<circle cx="12" cy="12" r="8.5"/><circle cx="12" cy="12" r="5"/><circle cx="12" cy="12" r="1.4"/>',
  habits: '<path d="M20 12a8 8 0 1 1-2.3-5.6"/><path d="M20 4v4.5h-4.5"/><path d="m8.6 12.4 2.3 2.3 4.6-4.7"/>',
  tasks: '<rect x="4" y="4" width="6" height="6" rx="1.2"/><path d="m5.6 7 1.2 1.2 2-2.2"/><rect x="4" y="14" width="6" height="6" rx="1.2"/><path d="M13.5 7h6.5M13.5 17h6.5"/>',
  roadmap: '<path d="M5 21V4"/><path d="M5 4h11.5l-2.2 3.6 2.2 3.6H5"/>',
  mindmap: '<circle cx="12" cy="12" r="2.6"/><circle cx="5" cy="6" r="2"/><circle cx="19" cy="6" r="2"/><circle cx="12" cy="20" r="1.8"/><path d="M10 10.4 6.5 7.4M14 10.4l3.5-3M12 14.6v3.6"/>',
  diet: '<path d="M12 7.6c-1.5-1-4.5-1.3-6 .7-1.8 2.4-1 6.6 1 9.3 1.3 1.8 2.8 3 5 2 2.2 1 3.7-.2 5-2 2-2.7 2.8-6.9 1-9.3-1.5-2-4.5-1.7-6-.7z"/><path d="M12 7.6c0-2 .8-3.6 2.5-4.6"/>',
  agenda: '<rect x="3.5" y="5" width="17" height="15.5" rx="2"/><path d="M3.5 10h17M8 3v4M16 3v4"/><path d="M8 14.5h.01M12 14.5h.01M16 14.5h.01"/>',
  sparkle: '<path d="M12 4v16M5.1 8l13.8 8M5.1 16 18.9 8"/>',
  star: '<path d="m12 3.5 2.6 5.3 5.9.9-4.3 4.1 1 5.8L12 16.9l-5.2 2.7 1-5.8-4.3-4.1 5.9-.9z"/>',
  flame: '<path d="M12 21c-3.6 0-6-2.4-6-5.6 0-3.3 2.4-5 3.4-7.9.6 1.3 1.5 2.1 2.4 2.4-.4-2.8.6-5.4 2.7-6.9 0 3.3 3.5 5.4 3.5 9.6v2.4c0 3.4-2.4 6-6 6z"/>',
  moon: '<path d="M20 14.5A8 8 0 1 1 9.5 4 6.5 6.5 0 0 0 20 14.5z"/>',
  leaf: '<path d="M5 19c0-8 5-13 14-14 0 9-5 14-13 14z"/><path d="m5 19 8-8"/>',
  music: '<path d="M9 18V5.5l10-2V16"/><circle cx="6.5" cy="18" r="2.5"/><circle cx="16.5" cy="16" r="2.5"/>',
  flask: '<path d="M9.5 3h5M10.5 3v6L5 18.5A1.7 1.7 0 0 0 6.5 21h11a1.7 1.7 0 0 0 1.5-2.5L13.5 9V3"/><path d="M7.4 15h9.2"/>',
  briefcase: '<rect x="3.5" y="7.5" width="17" height="12" rx="2"/><path d="M9 7.5v-2A1.5 1.5 0 0 1 10.5 4h3A1.5 1.5 0 0 1 15 5.5v2M3.5 12.5h17"/>',
  heart: '<path d="M12 20s-7.5-4.4-7.5-10A4.3 4.3 0 0 1 12 7.4 4.3 4.3 0 0 1 19.5 10c0 5.6-7.5 10-7.5 10z"/>',
  feather: '<path d="M19.5 4.5C12 4.5 7 9 7 16v4"/><path d="M7 16c5.5 0 9.5-3.5 11-9"/><path d="M10 12.5h5.5"/>',
  rocket: '<path d="M14 4.2c3-1.2 6-1.2 6-1.2s0 3-1.2 6l-6.3 6.3-4.8-4.8z"/><path d="m7.7 10.5-3.4.6L3 14l4 1M13.5 16.3l-.6 3.4L10 21l-1-4"/>',
  compass: '<circle cx="12" cy="12" r="8.5"/><path d="m15.5 8.5-2 5-5 2 2-5z"/>',
  pen: '<path d="m4 20 1-4L16 5l3 3L8 19z"/><path d="m14 7 3 3"/>',
  alert: '<path d="M12 4 21 19.5H3z"/><path d="M12 10v4M12 16.8h.01"/>',
  cross: '<circle cx="12" cy="12" r="8.5"/><path d="m9 9 6 6M15 9l-6 6"/>',
  quote: '<path d="M10 7c-3 .8-4.5 3-4.5 6v4h4.5v-4.5H7.2M18.5 7c-3 .8-4.5 3-4.5 6v4h4.5v-4.5h-2.8"/>',
  todo: '<rect x="4.5" y="4.5" width="15" height="15" rx="3"/>',
  plus: '<path d="M12 5v14M5 12h14"/>',
  timeline: '<path d="M3 12h18"/><circle cx="6" cy="12" r="2"/><circle cx="12.5" cy="12" r="2"/><circle cx="18.5" cy="12" r="2"/><path d="M6 10V6M12.5 14v4M18.5 10V6"/>',
  map: '<path d="M3.5 6.5 9 4l6 2.5L20.5 4v13.5L15 20l-6-2.5L3.5 20z"/><path d="M9 4v13.5M15 6.5V20"/>',
  crown: '<path d="M4 17.5 3 7.5l5 4 4-6 4 6 5-4-1 10z"/><path d="M4.5 20.5h15"/>',
  gem: '<path d="M6.5 4h11l3.5 5-9 11L3 9z"/><path d="M3 9h18M9 4l-1.8 5L12 20l4.8-11L15 4"/>',
  castle: '<path d="M4 21V8h3v2.5h2.5V8h5V10.5H17V8h3v13z"/><path d="M10 21v-4.5a2 2 0 0 1 4 0V21"/><path d="M4 8V5.5h3V8M17 8V5.5h3V8"/>',
  tower: '<path d="M8 21 9 9h6l1 12z"/><path d="M7.5 9h9V6h-2V4.5h-1.5V6h-2V4.5H9.5V6h-2z"/><path d="M11 13h2"/>',
  anchor: '<circle cx="12" cy="5" r="2"/><path d="M12 7v13.5M8.5 10.5h7"/><path d="M4.5 13.5c0 4 3.4 7 7.5 7s7.5-3 7.5-7"/>',
  mountain: '<path d="m2.5 19.5 6.5-11 4 6.5 2.5-3.5 6 8z"/><path d="m7.4 11.2 1.6 1.3 1.5-1.3"/>',
  tree: '<path d="M12 3 6 11h3l-4 6h14l-4-6h3z"/><path d="M12 17v4"/>',
  house: '<path d="M4 11 12 4.5 20 11"/><path d="M6 9.5V20h12V9.5"/><path d="M10 20v-5h4v5"/>',
  skull: '<path d="M12 3.5a7 7 0 0 0-7 7c0 2.4 1.2 4.3 3 5.5V19h8v-3c1.8-1.2 3-3.1 3-5.5a7 7 0 0 0-7-7z"/><circle cx="9.3" cy="11" r="1.4"/><circle cx="14.7" cy="11" r="1.4"/><path d="M10.5 19v2M13.5 19v2"/>',
  info: '<circle cx="12" cy="12" r="8.5"/><path d="M12 11v5.5M12 7.8h.01"/>',
  canvas: '<rect x="3.5" y="4.5" width="7" height="6" rx="1"/><rect x="13.5" y="13.5" width="7" height="6" rx="1"/><rect x="13.5" y="4.5" width="7" height="4" rx="1"/><path d="M10.5 7.5h3M17 8.5v5M7 10.5v6.5h6.5"/>',
  inbox: '<path d="M3.5 13.5l2.6-7.2A1.5 1.5 0 0 1 7.5 5.3h9a1.5 1.5 0 0 1 1.4 1l2.6 7.2v4.7a1.5 1.5 0 0 1-1.5 1.5h-14a1.5 1.5 0 0 1-1.5-1.5z"/><path d="M3.5 13.5h5l1.2 2.2h4.6l1.2-2.2h5"/>',
  lock: '<rect x="5" y="10.5" width="14" height="10" rx="2"/><path d="M8 10.5V8a4 4 0 0 1 8 0v2.5"/>',
  codex: '<path d="M6 3.5h10.5a1.5 1.5 0 0 1 1.5 1.5v15.5H7.5A1.5 1.5 0 0 1 6 19V3.5z"/><path d="M6 17.5h12M9.5 7.5h5M9.5 10.5h5"/>',
} as const;

export type GlyphName = keyof typeof GLYPHS;

export const ICON_CHOICES: GlyphName[] = [
  'note', 'book', 'chapter', 'idea', 'character', 'world', 'journal', 'screenplay',
  'study', 'goals', 'tasks', 'roadmap', 'mindmap', 'agenda', 'star', 'flame',
  'moon', 'leaf', 'music', 'flask', 'briefcase', 'heart', 'feather', 'rocket',
  'compass', 'pen', 'sparkle', 'folder',
];

/** Ícones antigos (emoji) → ícone autoral equivalente. */
export const LEGACY_EMOJI: Record<string, GlyphName> = {
  '📝': 'note', '🧱': 'blocks', '📁': 'folder', '📂': 'folder', '📖': 'book', '📚': 'book', '📄': 'chapter',
  '🎭': 'character', '🗺️': 'world', '🗺': 'world', '🌍': 'world', '📔': 'journal', '📓': 'journal', '🎬': 'screenplay',
  '🎓': 'study', '🗓️': 'meeting', '🗓': 'meeting', '💡': 'idea', '🎯': 'goals', '🔁': 'habits', '✅': 'tasks',
  '🧭': 'roadmap', '🕸️': 'mindmap', '🕸': 'mindmap', '🍎': 'diet', '📅': 'agenda', '⭐': 'star', '🔥': 'flame',
  '🌙': 'moon', '🌱': 'leaf', '🎵': 'music', '🧪': 'flask', '💼': 'briefcase', '❤️': 'heart', '❤': 'heart',
  '🐉': 'feather', '🚀': 'rocket', '✨': 'sparkle',
};

export function isGlyph(v: unknown): v is GlyphName {
  return typeof v === 'string' && Object.prototype.hasOwnProperty.call(GLYPHS, v);
}

/** Ícone a mostrar: o escolhido (ou o emoji antigo convertido), senão o do modelo. */
export function resolveGlyph(icon: string | null | undefined, fallback: GlyphName): GlyphName {
  if (isGlyph(icon)) return icon;
  if (icon && LEGACY_EMOJI[icon]) return LEGACY_EMOJI[icon];
  return fallback;
}

/** SVG em texto (para HTML gerado fora do React). */
export function glyphSvg(name: GlyphName, cls = 'nb-glyph'): string {
  return `<svg class="${cls}" viewBox="0 0 24 24" width="1em" height="1em" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${GLYPHS[name]}</svg>`;
}
