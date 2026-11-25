/**
 * Política de moderação do Insight: notas do classificador → veredito.
 *
 *   BLOCK  — crime, violência gráfica, ódio grave, incitação, ameaça, terrorismo,
 *            automutilação, exploração de menores. Vai para quarentena.
 *   REVIEW — zona cinzenta: fica oculto até alguém da equipe decidir.
 *   NSFW   — conteúdo adulto legal: publicado com is_nsfw = true (borrado, +18).
 *   ALLOW  — segue para o feed.
 *
 * Limiares pensados para errar do lado da segurança em menores e ameaças, e do
 * lado da liberdade em temas adultos legais.
 */
import type { CategoryScores } from './openai';
import type { RuleCategory } from './rules';

export type Verdict = 'ALLOW' | 'NSFW' | 'REVIEW' | 'BLOCK';

export type ReasonCode =
  | 'sexual/minors'
  | 'self-harm'
  | 'violence/threat'
  | 'violence/graphic'
  | 'hate'
  | 'harassment'
  | 'terrorism'
  | 'illicit'
  | 'sexual'
  | 'media_unverified'
  | 'none';

export interface Decision {
  verdict: Verdict;
  reason: ReasonCode;
  /** categorias que pesaram na decisão (para o log e para a equipe) */
  categories: string[];
}

type Rule = { cat: string; block?: number; review?: number; reason: ReasonCode };

// ordem = prioridade (o primeiro que bate define o motivo)
const RULES: Rule[] = [
  { cat: 'sexual/minors', block: 0.25, review: 0.08, reason: 'sexual/minors' },
  { cat: 'self-harm/instructions', block: 0.4, review: 0.2, reason: 'self-harm' },
  { cat: 'self-harm/intent', block: 0.5, review: 0.3, reason: 'self-harm' },
  { cat: 'self-harm', block: 0.75, review: 0.45, reason: 'self-harm' },
  { cat: 'hate/threatening', block: 0.45, review: 0.25, reason: 'hate' },
  { cat: 'harassment/threatening', block: 0.6, review: 0.35, reason: 'violence/threat' },
  { cat: 'illicit/violent', block: 0.6, review: 0.35, reason: 'illicit' },
  { cat: 'violence/graphic', block: 0.6, review: 0.35, reason: 'violence/graphic' },
  { cat: 'violence', block: 0.88, review: 0.65, reason: 'violence/threat' },
  { cat: 'hate', block: 0.8, review: 0.5, reason: 'hate' },
  { cat: 'illicit', block: 0.92, review: 0.75, reason: 'illicit' },
  { cat: 'harassment', review: 0.88, reason: 'harassment' },
];

const NSFW_THRESHOLD = 0.5;

const RULE_TO_REASON: Record<RuleCategory, ReasonCode> = {
  'sexual/minors': 'sexual/minors',
  'violence/threat': 'violence/threat',
  'self-harm': 'self-harm',
  terrorism: 'terrorism',
  illicit: 'illicit',
};

export function decideFromRule(cat: RuleCategory): Decision {
  return { verdict: 'BLOCK', reason: RULE_TO_REASON[cat], categories: [`rule:${cat}`] };
}

/**
 * @param scores maior nota de cada categoria entre texto, texto normalizado e mídias
 * @param obfuscated o texto tentou esconder palavras (sobe REVIEW para BLOCK)
 */
export function decideFromScores(scores: CategoryScores, obfuscated = false): Decision {
  for (const r of RULES) {
    const s = scores[r.cat] ?? 0;
    if (r.block !== undefined && s >= r.block) return { verdict: 'BLOCK', reason: r.reason, categories: [r.cat] };
    if (r.review !== undefined && s >= r.review) {
      return { verdict: obfuscated && r.block !== undefined ? 'BLOCK' : 'REVIEW', reason: r.reason, categories: [r.cat] };
    }
  }
  if ((scores['sexual'] ?? 0) >= NSFW_THRESHOLD) return { verdict: 'NSFW', reason: 'sexual', categories: ['sexual'] };
  return { verdict: 'ALLOW', reason: 'none', categories: [] };
}

const SEVERITY: Record<Verdict, number> = { ALLOW: 0, NSFW: 1, REVIEW: 2, BLOCK: 3 };

/** O pior de vários vereditos (texto, imagens, vídeo). */
export function worst(...ds: Decision[]): Decision {
  return ds.reduce((a, b) => (SEVERITY[b.verdict] > SEVERITY[a.verdict] ? b : a), { verdict: 'ALLOW', reason: 'none', categories: [] } as Decision);
}

/** Mensagem clara para quem publicou. */
export function userMessage(d: Decision, kind: 'post' | 'reply' | 'topic' | 'profile' = 'post'): string {
  const what = kind === 'reply' ? 'Sua resposta' : kind === 'topic' ? 'Seu tópico' : kind === 'profile' ? 'A alteração no seu perfil' : 'Seu Insight';
  if (d.verdict === 'ALLOW') return `${what} foi publicado.`;
  if (d.verdict === 'NSFW') return `${what} foi publicado com o aviso +18: ele aparece borrado até a pessoa confirmar que quer ver.`;
  if (d.verdict === 'REVIEW') {
    if (d.reason === 'media_unverified') return `${what} está em análise: não conseguimos verificar a mídia automaticamente, então a equipe vai revisar antes de liberar.`;
    return `${what} está em análise pela moderação e só aparece no feed depois da revisão.`;
  }
  const why: Record<ReasonCode, string> = {
    'sexual/minors': 'Conteúdo sexual envolvendo menores de idade é proibido e é crime (ECA, art. 241). Esse tipo de material pode ser reportado às autoridades.',
    'self-harm': 'O conteúdo fala em se machucar ou tirar a própria vida. Se você estiver passando por isso, não precisa enfrentar sozinho: o CVV atende 24h pelo telefone 188 (gratuito) ou em cvv.org.br.',
    'violence/threat': 'Ameaças e incitação à violência não são permitidas.',
    'violence/graphic': 'Imagens ou descrições de violência gráfica não são permitidas.',
    hate: 'Discurso de ódio contra pessoas ou grupos não é permitido.',
    harassment: 'Assédio e ataques pessoais não são permitidos.',
    terrorism: 'Apoio ou apologia a terrorismo não é permitido.',
    illicit: 'Venda ou instruções para atividades ilegais não são permitidas.',
    sexual: 'Conteúdo sexual não é permitido aqui.',
    media_unverified: 'A mídia não pôde ser verificada.',
    none: 'O conteúdo viola as regras da comunidade.',
  };
  const tail = kind === 'profile' ? ' Os valores anteriores foram restaurados.' : ' Ele ficou retido e não aparece para ninguém. Se achar que foi um engano, peça uma revisão.';
  return `${what} foi bloqueado. ${why[d.reason]}${tail}`;
}

/** Rótulo curto para a interface (selo no post e painel da equipe). */
export const REASON_LABEL: Record<ReasonCode, string> = {
  'sexual/minors': 'Exploração de menores',
  'self-harm': 'Automutilação',
  'violence/threat': 'Ameaça ou incitação à violência',
  'violence/graphic': 'Violência gráfica',
  hate: 'Discurso de ódio',
  harassment: 'Assédio',
  terrorism: 'Terrorismo',
  illicit: 'Atividade ilegal',
  sexual: 'Conteúdo sexual',
  media_unverified: 'Mídia não verificada',
  none: 'Regras da comunidade',
};
