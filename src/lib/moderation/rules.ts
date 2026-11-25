/**
 * Regras locais de alta precisão. Rodam SEMPRE (antes da IA) e são a rede de
 * segurança quando o classificador externo está fora do ar.
 *
 * Só entram padrões quase sem falso positivo: ameaças diretas, intenção de
 * automutilação, exploração de menores, terrorismo e comércio ilegal explícito.
 * O resto (ódio, assédio, nudez, violência gráfica) é com o classificador.
 *
 * Os padrões rodam sobre o texto já normalizado (normalize.ts → folded).
 */

export type RuleCategory = 'sexual/minors' | 'violence/threat' | 'self-harm' | 'terrorism' | 'illicit';

interface Rule {
  category: RuleCategory;
  re: RegExp;
}

const W = String.raw`(?:^|[^a-z])`; // borda de palavra simples (texto já sem acentos)

const RULES: Rule[] = [
  // exploração sexual de menores
  { category: 'sexual/minors', re: new RegExp(`${W}(child ?porn|pornografia infantil|porno infantil|cp de menor|conteudo de menor|nudes? de menor|menor(es)? (nua|nu|nuas|nus|pelad[ao]s?)|loli ?(hentai|porn|nude)|shota ?(hentai|porn))`) },
  { category: 'sexual/minors', re: new RegExp(`${W}(vend[oe]|compro|troco|passo|tenho) (nudes?|fotos? intimas?|videos? intimos?) de (menor|crianca|novinha de 1[0-7]|garot[ao] de 1[0-7])`) },

  // ameaças diretas
  { category: 'violence/threat', re: new RegExp(`${W}(vou|vamos|irei|quero) (te|lhe|voce|vc|vcs|voces|todos|todo mundo|ele|ela) (matar|esfaquear|executar|degolar|estuprar)`) },
  { category: 'violence/threat', re: new RegExp(`${W}(vou|vamos|irei) (matar|esfaquear|executar|estuprar|atirar em) (voce|vc|vcs|voces|todos|todo mundo|sua familia|tua familia)`) },
  { category: 'violence/threat', re: new RegExp(`${W}(te mato|te matarei|sua familia vai morrer|vou explodir (a|o) (escola|igreja|faculdade|shopping))`) },
  { category: 'violence/threat', re: new RegExp(`${W}(massacre|ataque|tiroteio) (na|no) (escola|colegio|faculdade) (amanha|hoje|semana que vem|segunda|terca|quarta|quinta|sexta)`) },
  { category: 'violence/threat', re: new RegExp(`${W}(i will|im going to|i am going to|gonna) (kill|shoot|stab|rape) (you|u|everyone|your family)`) },

  // intenção de automutilação
  { category: 'self-harm', re: new RegExp(`${W}(vou|quero|vou acabar e) (me matar|tirar (a )?minha (propria )?vida|me suicidar|me cortar ate)`) },
  { category: 'self-harm', re: new RegExp(`${W}(como (me )?(se )?matar sem dor|melhor jeito de (me )?(se )?matar|quantos comprimidos (pra|para) morrer)`) },
  { category: 'self-harm', re: new RegExp(`${W}(i want to|im going to|going to) (kill myself|end my life)`) },

  // terrorismo
  { category: 'terrorism', re: new RegExp(`${W}(junte-?se ao|jure lealdade ao|apoie o) (estado islamico|isis|isil|daesh)`) },
  { category: 'terrorism', re: new RegExp(`${W}(como (fazer|montar|construir) (uma )?bomba caseira|receita de (bomba|explosivo))`) },

  // comércio ilegal explícito
  { category: 'illicit', re: new RegExp(`${W}(vend[oe]|vendemos) (arma|armas|pistola|fuzil|cocaina|crack|heroina|metanfetamina|lsd|ecstasy|maconha) (no|pelo|chama|whats|zap|pix|dm|direct|inbox)`) },
  { category: 'illicit', re: new RegExp(`${W}(vend[oe]) (cartao clonado|cartoes clonados|dados de cartao|cpf vazado|logins? vazados?)`) },
];

export interface RuleHit {
  category: RuleCategory;
  sample: string;
}

export function runLocalRules(folded: string): RuleHit | null {
  for (const r of RULES) {
    const m = r.re.exec(folded);
    if (m) return { category: r.category, sample: m[0].trim().slice(0, 80) };
  }
  return null;
}
