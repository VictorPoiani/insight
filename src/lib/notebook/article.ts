/**
 * Modo Artigo: norma (ABNT, APA ou editorial), elementos pré-textuais,
 * numeração progressiva e as fontes ligadas. Fica em item.data.article.
 */
import type { CitationNorm } from './sources';

export interface ArticlePre {
  subtitle: string;
  /** um autor por linha (ex.: "Maria Souza — Universidade Federal de…") */
  authors: string;
  abstract: string;
  keywords: string;
  /** resumo em língua estrangeira */
  showForeign: boolean;
  abstractForeign: string;
  keywordsForeign: string;
}

export interface ArticleData {
  norm: CitationNorm;
  /** numeração progressiva das seções (NBR 6024) */
  numbered: boolean;
  /** elementos pré-textuais (título, autores, resumo, palavras-chave) */
  showPre: boolean;
  pre: ArticlePre;
  /** fontes ligadas ao artigo (além das citadas no texto) */
  sources: string[];
  /** ABNT: sobrenome em maiúsculas nas chamadas entre parênteses */
  upperCase: boolean;
  /** referências só com as fontes citadas no texto (como pede a NBR 6023) */
  onlyCited: boolean;
}

export const NORMS: { id: CitationNorm; label: string; hint: string }[] = [
  { id: 'abnt', label: 'Acadêmico · ABNT', hint: 'NBR 6022, 6023, 6024, 6028 e 10520' },
  { id: 'apa', label: 'Técnico/Científico · APA 7', hint: 'autor-data, referências em inglês acadêmico' },
  { id: 'editorial', label: 'Editorial / Blog', hint: 'sem elementos pré-textuais nem numeração' },
];

const EMPTY_PRE: ArticlePre = { subtitle: '', authors: '', abstract: '', keywords: '', showForeign: false, abstractForeign: '', keywordsForeign: '' };

export function articleData(data: unknown): ArticleData {
  const a = (data as { article?: Partial<ArticleData> } | null)?.article;
  // artigos antigos (sem configuração) seguem como texto editorial
  if (!a) return { norm: 'editorial', numbered: false, showPre: false, pre: EMPTY_PRE, sources: [], upperCase: true, onlyCited: false };
  const norm = a.norm === 'abnt' || a.norm === 'apa' || a.norm === 'editorial' ? a.norm : 'abnt';
  return {
    norm,
    numbered: a.numbered ?? norm !== 'editorial',
    showPre: a.showPre ?? norm !== 'editorial',
    pre: { ...EMPTY_PRE, ...(a.pre || {}) },
    sources: Array.isArray(a.sources) ? a.sources.filter((x) => typeof x === 'string') : [],
    upperCase: a.upperCase ?? true,
    onlyCited: a.onlyCited ?? true,
  };
}

export const newArticleData = (): { article: ArticleData } => ({
  article: { norm: 'abnt', numbered: true, showPre: true, pre: EMPTY_PRE, sources: [], upperCase: true, onlyCited: true },
});

export const splitKeywords = (s: string) =>
  s
    .split(/[;,\n]/)
    .map((k) => k.trim())
    .filter(Boolean);

export const countWords = (s: string) => (s.match(/[\p{L}\p{N}]+/gu) || []).length;

/** Limites da NBR 6022 (artigo): resumo de 100 a 250 palavras, 3 a 5 palavras-chave. */
export function preWarnings(a: ArticleData): string[] {
  if (a.norm !== 'abnt' || !a.showPre) return [];
  const out: string[] = [];
  const w = countWords(a.pre.abstract);
  if (w && w < 100) out.push(`Resumo com ${w} palavras: a NBR 6022 pede de 100 a 250.`);
  if (w > 250) out.push(`Resumo com ${w} palavras: a NBR 6022 pede no máximo 250.`);
  const k = splitKeywords(a.pre.keywords).length;
  if (k && (k < 3 || k > 5)) out.push(`${k} palavras-chave: a NBR 6028 pede de 3 a 5.`);
  return out;
}
