/**
 * Temas de notícias do Insight. Cada notícia recebe os temas da fonte e os
 * que o classificador encontra no título/resumo (palavras-chave).
 */

export type NewsTopicId =
  | 'tecnologia'
  | 'ia'
  | 'dev'
  | 'seguranca'
  | 'games'
  | 'ciencia'
  | 'espaco'
  | 'saude'
  | 'economia'
  | 'cripto'
  | 'politica'
  | 'brasil'
  | 'mundo'
  | 'esportes'
  | 'futebol'
  | 'cinema'
  | 'musica'
  | 'cultura-pop';

export interface NewsTopic {
  id: NewsTopicId;
  label: string;
  color: string;
  /** palavras-chave (sem acento, minúsculas) que puxam a notícia para o tema */
  keywords: RegExp;
}

export const NEWS_TOPICS: NewsTopic[] = [
  { id: 'tecnologia', label: 'Tecnologia', color: '#38bdf8', keywords: /\b(tecnologia|smartphone|celular|iphone|android|apple|samsung|google|microsoft|meta|chip|processador|notebook|gadget|app|aplicativo)\b/ },
  { id: 'ia', label: 'Inteligência Artificial', color: '#a78bfa', keywords: /\b(inteligencia artificial|ia generativa|chatgpt|openai|gemini|claude|anthropic|llm|machine learning|deepseek|copilot)\b/ },
  { id: 'dev', label: 'Programação', color: '#22d3ee', keywords: /\b(programacao|programador|desenvolvedor|software|javascript|typescript|python|react|next\.?js|github|codigo|open source|linux|api)\b/ },
  { id: 'seguranca', label: 'Segurança digital', color: '#f87171', keywords: /\b(hacker|ataque|vazamento|ciberseguranca|ransomware|golpe|phishing|malware|senha|seguranca digital|vulnerabilidade)\b/ },
  { id: 'games', label: 'Games', color: '#c084fc', keywords: /\b(game|games|jogo|jogos|playstation|ps5|xbox|nintendo|switch|steam|gta|esports|e-sports)\b/ },
  { id: 'ciencia', label: 'Ciência', color: '#10b981', keywords: /\b(ciencia|cientistas|pesquisa|estudo|descoberta|fisica|quimica|biologia|fossil|dinossauro|clima)\b/ },
  { id: 'espaco', label: 'Espaço', color: '#6366f1', keywords: /\b(nasa|espaco|astronauta|foguete|spacex|marte|lua|planeta|galaxia|telescopio|asteroide|cometa)\b/ },
  { id: 'saude', label: 'Saúde', color: '#14b8a6', keywords: /\b(saude|doenca|vacina|medico|hospital|cancer|dengue|virus|tratamento|anvisa|sus)\b/ },
  { id: 'economia', label: 'Economia', color: '#eab308', keywords: /\b(economia|inflacao|juros|selic|pib|dolar|bolsa|ibovespa|mercado financeiro|investimento|imposto|banco central)\b/ },
  { id: 'cripto', label: 'Cripto', color: '#f59e0b', keywords: /\b(bitcoin|cripto|criptomoeda|ethereum|blockchain|btc|stablecoin)\b/ },
  { id: 'politica', label: 'Política', color: '#64748b', keywords: /\b(politica|governo|congresso|senado|camara|ministro|presidente|eleicao|eleicoes|stf|lula|deputado)\b/ },
  { id: 'brasil', label: 'Brasil', color: '#16a34a', keywords: /\b(brasil|brasileiro|brasileira|sao paulo|rio de janeiro|minas gerais|nordeste)\b/ },
  { id: 'mundo', label: 'Mundo', color: '#3b82f6', keywords: /\b(eua|estados unidos|china|russia|ucrania|europa|israel|guerra|onu|trump|internacional)\b/ },
  { id: 'esportes', label: 'Esportes', color: '#f97316', keywords: /\b(esporte|esportes|olimpiada|nba|formula 1|f1|tenis|volei|basquete|ufc|corrida)\b/ },
  { id: 'futebol', label: 'Futebol', color: '#22c55e', keywords: /\b(futebol|brasileirao|libertadores|copa do mundo|champions|selecao|flamengo|corinthians|palmeiras|sao paulo fc|gol)\b/ },
  { id: 'cinema', label: 'Cinema & Séries', color: '#ef4444', keywords: /\b(filme|filmes|cinema|serie|series|netflix|hbo|disney|oscar|trailer|bilheteria|streaming)\b/ },
  { id: 'musica', label: 'Música', color: '#f43f5e', keywords: /\b(musica|album|show|cantor|cantora|banda|rock|turne|festival|spotify|grammy|rap|kpop|k-pop)\b/ },
  { id: 'cultura-pop', label: 'Cultura pop', color: '#ec4899', keywords: /\b(anime|manga|marvel|dc comics|hq|quadrinhos|nerd|geek|cosplay|star wars|pokemon)\b/ },
];

export const TOPIC_BY_ID = new Map(NEWS_TOPICS.map((t) => [t.id, t]));

const strip = (s: string) =>
  s
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '');

/** Temas da notícia: os da fonte + os achados no texto (no máximo 4). */
export function classifyTopics(text: string, base: NewsTopicId[]): NewsTopicId[] {
  const t = ` ${strip(text)} `;
  const found = new Set<NewsTopicId>(base);
  for (const topic of NEWS_TOPICS) if (topic.keywords.test(t)) found.add(topic.id);
  // futebol implica esportes; ia e dev implicam tecnologia
  if (found.has('futebol')) found.add('esportes');
  if (found.has('ia') || found.has('dev') || found.has('seguranca')) found.add('tecnologia');
  if (found.has('espaco')) found.add('ciencia');
  return Array.from(found).slice(0, 5);
}

/** Chave para juntar a mesma história publicada por vários portais. */
export function titleKey(title: string): string {
  const STOP = new Set(['a', 'o', 'as', 'os', 'de', 'da', 'do', 'das', 'dos', 'e', 'em', 'no', 'na', 'nos', 'nas', 'um', 'uma', 'para', 'por', 'com', 'que', 'se', 'ao', 'the', 'of', 'to', 'in', 'and']);
  return strip(title)
    .replace(/[^a-z0-9 ]+/g, ' ')
    .split(/\s+/)
    .filter((w) => w.length > 2 && !STOP.has(w))
    .slice(0, 8)
    .sort()
    .join(' ');
}
