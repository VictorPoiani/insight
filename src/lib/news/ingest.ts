/**
 * Coleta de notícias (só no servidor, com service role).
 *
 * Busca as fontes em paralelo (com tempo limite), classifica os temas, junta a
 * mesma história publicada por vários portais (title_key), grava em
 * news_items e registra a saúde de cada fonte em news_sources. Notícias com
 * mais de 7 dias são apagadas.
 */
import type { SupabaseClient } from '@supabase/supabase-js';
import { NEWS_SOURCES, type NewsSource } from './sources';
import { parseFeed, stripHtml, type ParsedItem } from './rss';
import { classifyTopics, titleKey } from './topics';

const UA = 'Mozilla/5.0 (compatible; InsightNews/1.0; +https://www.insight.app.br)';
const TIMEOUT_MS = 8000;
const CONCURRENCY = 8;

/**
 * Decodifica pelo charset declarado (cabeçalho HTTP ou <?xml encoding?>).
 * Vários portais (ex.: Folha) ainda publicam em ISO-8859-1/Windows-1252;
 * ler como UTF-8 gera "B�lgica".
 */
export function decodeBody(bytes: Uint8Array, contentType: string | null): string {
  const fromHeader = contentType?.match(/charset=["']?([\w-]+)/i)?.[1];
  const head = new TextDecoder('latin1').decode(bytes.slice(0, 300));
  const fromXml = head.match(/<\?xml[^>]*encoding=["']([\w-]+)["']/i)?.[1];
  let charset = (fromXml || fromHeader || 'utf-8').toLowerCase();
  if (charset === 'iso-8859-1' || charset === 'latin1') charset = 'windows-1252'; // superconjunto (aspas curvas, travessão)
  try {
    const text = new TextDecoder(charset).decode(bytes);
    // declarou UTF-8 mas não é: tenta windows-1252
    if (charset === 'utf-8' && text.includes('\uFFFD')) return new TextDecoder('windows-1252').decode(bytes);
    return text;
  } catch {
    return new TextDecoder('utf-8').decode(bytes);
  }
}

async function fetchText(url: string): Promise<string> {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), TIMEOUT_MS);
  try {
    const res = await fetch(url, {
      headers: { 'User-Agent': UA, Accept: 'application/rss+xml, application/atom+xml, application/xml, text/xml, application/json;q=0.9, */*;q=0.5' },
      signal: ctrl.signal,
      cache: 'no-store',
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return decodeBody(new Uint8Array(await res.arrayBuffer()), res.headers.get('content-type'));
  } finally {
    clearTimeout(t);
  }
}

async function readSource(src: NewsSource): Promise<ParsedItem[]> {
  const body = await fetchText(src.url);
  if (src.kind === 'tabnews') {
    const list = JSON.parse(body) as { title?: string; slug?: string; owner_username?: string; published_at?: string; body?: string }[];
    return (Array.isArray(list) ? list : [])
      .filter((x) => x.title && x.slug && x.owner_username)
      .slice(0, 20)
      .map((x) => ({
        title: String(x.title).slice(0, 300),
        url: `https://www.tabnews.com.br/${x.owner_username}/${x.slug}`,
        summary: stripHtml(String(x.body || '')).slice(0, 280),
        image: null,
        publishedAt: x.published_at ? new Date(x.published_at) : null,
      }));
  }
  return parseFeed(body, 25);
}

async function pool<T, R>(items: T[], n: number, fn: (x: T) => Promise<R>): Promise<R[]> {
  const out: R[] = new Array(items.length);
  let i = 0;
  await Promise.all(
    Array.from({ length: Math.min(n, items.length) }, async () => {
      while (i < items.length) {
        const k = i++;
        out[k] = await fn(items[k]);
      }
    })
  );
  return out;
}

export interface IngestReport {
  sources: { id: string; ok: boolean; count: number; error?: string }[];
  inserted: number;
  pruned: number;
  ms: number;
}

export async function ingestNews(admin: SupabaseClient): Promise<IngestReport> {
  const started = Date.now();
  const now = new Date();
  const report: IngestReport = { sources: [], inserted: 0, pruned: 0, ms: 0 };

  const results = await pool(NEWS_SOURCES, CONCURRENCY, async (src) => {
    try {
      const items = await readSource(src);
      return { src, items, error: null as string | null };
    } catch (err) {
      return { src, items: [] as ParsedItem[], error: err instanceof Error ? err.message : String(err) };
    }
  });

  const rows: Record<string, unknown>[] = [];
  const seenUrls = new Set<string>();
  for (const { src, items, error } of results) {
    report.sources.push({ id: src.id, ok: !error, count: items.length, error: error ?? undefined });
    for (const it of items) {
      if (seenUrls.has(it.url)) continue;
      seenUrls.add(it.url);
      const published = it.publishedAt && it.publishedAt.getTime() <= now.getTime() + 3600_000 ? it.publishedAt : now;
      if (now.getTime() - published.getTime() > 4 * 86400_000) continue; // velha demais
      const isGoogle = src.kind === 'gnews';
      const sourceName = (isGoogle && it.publisher) || src.name;
      const summary = it.summary.length > 280 ? `${it.summary.slice(0, 277).replace(/\s+\S*$/, '')}…` : it.summary;
      rows.push({
        url: it.url,
        title: it.title,
        title_key: titleKey(it.title),
        summary,
        image_url: it.image,
        source_id: src.id,
        source_name: sourceName.slice(0, 80),
        source_home: src.home,
        topics: classifyTopics(`${it.title} ${summary}`, src.topics),
        lang: src.lang ?? 'pt',
        weight: src.weight ?? 1,
        published_at: published.toISOString(),
        fetched_at: now.toISOString(),
      });
    }
  }

  // grava em lotes; URL repetida é ignorada (mantém contadores de quem já leu)
  for (let i = 0; i < rows.length; i += 200) {
    const { data, error } = await admin
      .from('news_items')
      .upsert(rows.slice(i, i + 200), { onConflict: 'url', ignoreDuplicates: true })
      .select('id');
    if (!error) report.inserted += data?.length ?? 0;
  }

  // saúde das fontes
  await admin.from('news_sources').upsert(
    results.map(({ src, items, error }) => ({
      id: src.id,
      name: src.name,
      last_run_at: now.toISOString(),
      ...(error ? { last_error: error.slice(0, 300) } : { last_ok_at: now.toISOString(), last_error: null }),
      last_count: items.length,
    })),
    { onConflict: 'id', defaultToNull: false }
  );

  // limpeza
  const { count } = await admin
    .from('news_items')
    .delete({ count: 'exact' })
    .lt('published_at', new Date(now.getTime() - 7 * 86400_000).toISOString());
  report.pruned = count ?? 0;

  report.ms = Date.now() - started;
  return report;
}

/**
 * Trava simples para não coletar duas vezes ao mesmo tempo nem com
 * frequência maior que `minMinutes` (linha '_meta' em news_sources).
 */
export async function claimIngestSlot(admin: SupabaseClient, minMinutes: number): Promise<boolean> {
  await admin.from('news_sources').upsert({ id: '_meta', name: 'coleta' }, { onConflict: 'id', ignoreDuplicates: true });
  const cutoff = new Date(Date.now() - minMinutes * 60_000).toISOString();
  const { data } = await admin
    .from('news_sources')
    .update({ last_run_at: new Date().toISOString() })
    .eq('id', '_meta')
    .or(`last_run_at.is.null,last_run_at.lt.${cutoff}`)
    .select('id');
  return Boolean(data && data.length);
}
