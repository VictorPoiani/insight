/**
 * Normalização anti-bypass. O classificador recebe o texto ORIGINAL e esta
 * versão "desofuscada", e vale o pior dos dois resultados.
 *
 * Cobre: caracteres invisíveis (zero-width, bidi, variação), letras de outros
 * alfabetos que imitam o latino (homóglifos), letras estilizadas (𝓂𝒶𝓉𝒶𝓇),
 * leetspeak (m4t4r, @, $), letras repetidas (maaaatar) e letras separadas por
 * pontos/espaços (m.a.t.a.r, m a t a r).
 */

// zero-width, joiners, bidi overrides, soft hyphen, variation selectors, tags
const INVISIBLE = /[­͏؜ᅟᅠ឴឵᠋-᠏​-‏‪-‮⁠-⁯ㅤ︀-️﻿ﾠ]|\uDB40[\uDC00-\uDCFF]/g;
// marcas combinantes (acentos empilhados "zalgo")
const COMBINING = /[̀-ͯ᪰-᫿᷀-᷿⃐-⃿︠-︯]/g;

// cirílico/grego/etc. que parecem latinos
const HOMOGLYPHS: Record<string, string> = {
  а: 'a', е: 'e', о: 'o', р: 'p', с: 'c', у: 'y', х: 'x', і: 'i', ј: 'j', ѕ: 's', ԁ: 'd', ɡ: 'g', һ: 'h', ӏ: 'l', ʀ: 'r',
  к: 'k', м: 'm', н: 'h', т: 't', в: 'b', ь: 'b', ԛ: 'q', ԝ: 'w', ᴀ: 'a', ʙ: 'b', ᴄ: 'c', ᴅ: 'd', ᴇ: 'e', ɢ: 'g',
  ʜ: 'h', ɪ: 'i', ᴊ: 'j', ᴋ: 'k', ʟ: 'l', ᴍ: 'm', ɴ: 'n', ᴏ: 'o', ᴘ: 'p', ǫ: 'q', ꜱ: 's', ᴛ: 't', ᴜ: 'u', ᴠ: 'v',
  ᴡ: 'w', ʏ: 'y', ᴢ: 'z', α: 'a', β: 'b', ε: 'e', ι: 'i', κ: 'k', ν: 'v', ο: 'o', ρ: 'p', τ: 't', υ: 'u', χ: 'x',
};

const LEET: Record<string, string> = {
  '4': 'a', '@': 'a', '∆': 'a', '8': 'b', '3': 'e', '€': 'e', '6': 'g', '9': 'g', '#': 'h', '1': 'i', '!': 'i',
  '|': 'i', '0': 'o', '5': 's', $: 's', '7': 't', '+': 't', '2': 'z', '%': 'x',
};

export interface NormalizedText {
  /** como folded, mas sem NENHUMA letra repetida ("maatar" → "matar"), só para regras */
  squeezed: string;
  /** texto limpo de invisíveis, ainda legível (vai como está para o classificador) */
  clean: string;
  /** versão desofuscada, minúscula, para regras e 2ª passada do classificador */
  folded: string;
  /** houve ofuscação relevante? (sinal extra de má intenção) */
  obfuscated: boolean;
}

export function normalizeText(input: string): NormalizedText {
  const raw = String(input || '');
  // NFKC transforma letras estilizadas/fullwidth (𝓂, ｍ) em letras comuns
  const clean = raw.normalize('NFKC').replace(INVISIBLE, '').replace(/\s+/g, ' ').trim();

  let folded = clean
    .normalize('NFKD')
    .replace(COMBINING, '')
    .toLowerCase()
    .replace(/./gu, (ch) => HOMOGLYPHS[ch] ?? ch);

  // leetspeak em palavras que têm letras ("m4t4r", "t3"); "!" e "|" no fim são
  // pontuação, não letra ("matar!!!"); números soltos ("2026") ficam como estão
  folded = folded.replace(/[a-z0-9@$!|€∆#%+]+/g, (word) => {
    const m = /^(.*?)([!|]*)$/.exec(word)!;
    const core = m[1];
    if (core.length < 2 || !/[a-z]/.test(core)) return word;
    return core.replace(/[0-9@$!|€∆#%+]/g, (c) => LEET[c] ?? c) + m[2];
  });

  // letras separadas: "m.a.t.a.r" / "m a t a r" / "m-a-t-a-r" (4+ letras)
  folded = folded.replace(/\b(?:[a-z][\s._\-*]{1,3}){3,}[a-z]\b/g, (m) => m.replace(/[\s._\-*]/g, ''));
  // repetições: "maaaatar" → "maatar"
  folded = folded.replace(/(.)\1{2,}/g, '$1$1');
  folded = folded.replace(/\s+/g, ' ').trim();

  const plain = clean.toLowerCase().normalize('NFKD').replace(COMBINING, '');
  const obfuscated = raw.length - clean.length > 3 || (folded.length > 0 && similarity(plain, folded) < 0.85);
  const squeezed = folded.replace(/([a-z])\1+/g, '$1');
  return { clean, folded, squeezed, obfuscated };
}

/** Semelhança simples (proporção de caracteres iguais na mesma posição). */
function similarity(a: string, b: string): number {
  const n = Math.max(a.length, b.length);
  if (!n) return 1;
  let same = 0;
  for (let i = 0; i < Math.min(a.length, b.length); i++) if (a[i] === b[i]) same++;
  return same / n;
}

/** HTML de usuário → texto (sem tags, entidades básicas). */
export function htmlToText(html?: string | null): string {
  return String(html || '')
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/(p|div|li|h\d|blockquote)>/gi, '\n')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/[ \t]+/g, ' ')
    .trim();
}
