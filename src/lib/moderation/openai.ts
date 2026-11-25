/**
 * OpenAI Moderation API (omni-moderation-latest) — gratuita, texto + imagem.
 * Só no servidor (OPENAI_API_KEY).
 */

export type CategoryScores = Record<string, number>;

export interface ProviderResult {
  flagged: boolean;
  categories: Record<string, boolean>;
  scores: CategoryScores;
}

const ENDPOINT = 'https://api.openai.com/v1/moderations';
const MODEL = 'omni-moderation-latest';

export function openAiConfigured() {
  return Boolean(process.env.OPENAI_API_KEY?.trim());
}

type Input = { type: 'text'; text: string } | { type: 'image_url'; image_url: { url: string } };

async function call(input: Input[], timeoutMs: number): Promise<ProviderResult[]> {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    const res = await fetch(ENDPOINT, {
      method: 'POST',
      headers: { Authorization: `Bearer ${process.env.OPENAI_API_KEY!.trim()}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ model: MODEL, input }),
      signal: ctrl.signal,
      cache: 'no-store',
    });
    if (res.status === 429 || res.status >= 500) throw new Error(`openai_${res.status}`);
    if (!res.ok) {
      const body = await res.text().catch(() => '');
      // imagem inacessível/inválida: trata como erro de mídia (vai para revisão)
      throw new Error(`openai_${res.status}:${body.slice(0, 160)}`);
    }
    const data = (await res.json()) as {
      results?: { flagged: boolean; categories: Record<string, boolean>; category_scores: CategoryScores }[];
    };
    return (data.results || []).map((r) => ({ flagged: r.flagged, categories: r.categories, scores: r.category_scores }));
  } finally {
    clearTimeout(timer);
  }
}

async function withRetry<T>(fn: () => Promise<T>): Promise<T> {
  try {
    return await fn();
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    if (!/openai_(429|5\d\d)|abort/i.test(msg)) throw e;
    await new Promise((r) => setTimeout(r, 700));
    return fn();
  }
}

/** Classifica um texto (até ~30k caracteres por chamada; textos maiores vão em pedaços). */
export async function moderateTextOpenAI(text: string): Promise<ProviderResult> {
  const chunks: string[] = [];
  for (let i = 0; i < text.length && chunks.length < 6; i += 24000) chunks.push(text.slice(i, i + 24000));
  const results = await withRetry(() => call(chunks.map((t) => ({ type: 'text', text: t })), 8000));
  return mergeResults(results);
}

/** Classifica uma imagem por URL pública (R2/media). */
export async function moderateImageOpenAI(url: string): Promise<ProviderResult> {
  const [r] = await withRetry(() => call([{ type: 'image_url', image_url: { url } }], 15000));
  if (!r) throw new Error('openai_empty');
  return r;
}

/** Junta vários resultados ficando com a maior nota de cada categoria. */
export function mergeResults(list: ProviderResult[]): ProviderResult {
  const out: ProviderResult = { flagged: false, categories: {}, scores: {} };
  for (const r of list) {
    out.flagged ||= r.flagged;
    for (const [k, v] of Object.entries(r.categories || {})) out.categories[k] ||= Boolean(v);
    for (const [k, v] of Object.entries(r.scores || {})) out.scores[k] = Math.max(out.scores[k] ?? 0, Number(v) || 0);
  }
  return out;
}
