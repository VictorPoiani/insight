'use client';

/**
 * Plugins do Canvas: fontes externas que trazem conteúdo para o quadro.
 * Cada plugin busca e devolve resultados; o Canvas decide como inserir
 * (imagem sobe sem perda ao R2, texto vira cartão, página vira cartão de link).
 *
 * Gratuitos e sem chave: Wikimedia Commons, Openverse, Wikipedia e captura de
 * página. Google Drive, Unsplash e Pexels ficam listados, mas só ligam quando
 * houver chave configurada.
 */

export type PluginResult =
  | { kind: 'image'; id: string; title: string; thumb: string; full: string; width?: number; height?: number; credit: string; source: string; creditUrl?: string; hotlink?: boolean; track?: string }
  | { kind: 'text'; id: string; title: string; text: string; url: string; thumb?: string }
  | { kind: 'link'; id: string; title: string; url: string; description?: string; image?: string; site?: string };

export interface CanvasPlugin {
  id: string;
  name: string;
  description: string;
  /** placeholder da busca */
  hint: string;
  /** precisa de chave: fica visível, mas desligado */
  needsKey?: string;
  /** fonte com chave no servidor (liga quando /api/notebook/stock?status=1 confirmar) */
  provider?: 'pixabay' | 'unsplash';
  /** busca (ou captura, para o recortador) */
  search: (q: string, signal: AbortSignal) => Promise<PluginResult[]>;
}

const strip = (html: string) => {
  const d = typeof document !== 'undefined' ? document.createElement('div') : null;
  if (!d) return html.replace(/<[^>]+>/g, '');
  d.innerHTML = html;
  return (d.textContent || '').replace(/\s+/g, ' ').trim();
};

async function getJson<T>(url: string, signal: AbortSignal): Promise<T> {
  const r = await fetch(url, { signal, headers: { Accept: 'application/json' } });
  if (!r.ok) throw new Error(`A busca respondeu com erro (${r.status}).`);
  return (await r.json()) as T;
}

// ------------------------------------------------------------ Wikimedia Commons
type CommonsPage = { pageid: number; title: string; imageinfo?: { url: string; thumburl?: string; width: number; height: number; mime: string; descriptionurl: string; extmetadata?: Record<string, { value: string }> }[] };
const wikimedia: CanvasPlugin = {
  id: 'wikimedia',
  name: 'Wikimedia Commons',
  description: 'Imagens livres (domínio público e Creative Commons).',
  hint: 'Buscar imagens livres…',
  search: async (q, signal) => {
    const u = new URL('https://commons.wikimedia.org/w/api.php');
    Object.entries({
      action: 'query',
      format: 'json',
      origin: '*',
      generator: 'search',
      gsrsearch: `${q} filetype:bitmap`,
      gsrnamespace: '6',
      gsrlimit: '30',
      prop: 'imageinfo',
      iiprop: 'url|size|mime|extmetadata',
      iiurlwidth: '360',
      iiextmetadatafilter: 'Artist|LicenseShortName',
    }).forEach(([k, v]) => u.searchParams.set(k, v));
    const d = await getJson<{ query?: { pages?: Record<string, CommonsPage> } }>(u.toString(), signal);
    return Object.values(d.query?.pages || {})
      .filter((p) => p.imageinfo?.[0] && /^image\/(png|jpeg|webp|gif)$/.test(p.imageinfo[0].mime))
      .map((p) => {
        const ii = p.imageinfo![0];
        const artist = strip(ii.extmetadata?.Artist?.value || '').slice(0, 120);
        const lic = ii.extmetadata?.LicenseShortName?.value || '';
        return {
          kind: 'image' as const,
          id: `wm-${p.pageid}`,
          title: p.title.replace(/^File:|^Arquivo:/, '').replace(/\.[a-z]+$/i, ''),
          thumb: ii.thumburl || ii.url,
          full: ii.url,
          width: ii.width,
          height: ii.height,
          credit: [artist, lic, 'Wikimedia Commons'].filter(Boolean).join(' · '),
          source: ii.descriptionurl,
        };
      });
  },
};

// ------------------------------------------------------------ Openverse
type OvImage = { id: string; title: string; url: string; thumbnail: string; width?: number; height?: number; creator?: string; license: string; license_version?: string; foreign_landing_url: string; source?: string };
const openverse: CanvasPlugin = {
  id: 'openverse',
  name: 'Openverse',
  description: 'Mais de 800 milhões de imagens com licença aberta.',
  hint: 'Buscar no Openverse…',
  search: async (q, signal) => {
    const d = await getJson<{ results: OvImage[] }>(`https://api.openverse.org/v1/images/?q=${encodeURIComponent(q)}&page_size=30&mature=false`, signal);
    return (d.results || []).map((r) => ({
      kind: 'image' as const,
      id: `ov-${r.id}`,
      title: r.title || 'Imagem',
      thumb: r.thumbnail || r.url,
      full: r.url,
      width: r.width,
      height: r.height,
      credit: [r.creator, `CC ${r.license.toUpperCase()} ${r.license_version || ''}`.trim(), 'Openverse'].filter(Boolean).join(' · '),
      source: r.foreign_landing_url,
    }));
  },
};

// ------------------------------------------------------------ Wikipedia
type WikiSummary = { title: string; extract: string; content_urls?: { desktop?: { page?: string } }; thumbnail?: { source: string } };
const wikipedia: CanvasPlugin = {
  id: 'wikipedia',
  name: 'Wikipedia',
  description: 'Resumo de artigos da Wikipedia em português, como cartão de texto.',
  hint: 'Buscar artigos…',
  search: async (q, signal) => {
    const s = await getJson<{ query?: { search?: { title: string }[] } }>(
      `https://pt.wikipedia.org/w/api.php?action=query&list=search&format=json&origin=*&srlimit=8&srsearch=${encodeURIComponent(q)}`,
      signal
    );
    const titles = (s.query?.search || []).map((x) => x.title);
    const out = await Promise.all(
      titles.map((t) =>
        getJson<WikiSummary>(`https://pt.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(t.replace(/ /g, '_'))}`, signal)
          .then((w) => ({ kind: 'text' as const, id: `wp-${t}`, title: w.title, text: w.extract || '', url: w.content_urls?.desktop?.page || `https://pt.wikipedia.org/wiki/${encodeURIComponent(t)}`, thumb: w.thumbnail?.source }))
          .catch(() => null)
      )
    );
    return out.filter((x): x is NonNullable<typeof x> => !!x && !!x.text);
  },
};

// ------------------------------------------------------------ recortador de páginas
export interface PageMeta {
  url: string;
  title: string;
  description: string;
  image: string;
  site: string;
  isImage?: boolean;
}
export async function clipPage(url: string, signal?: AbortSignal): Promise<PageMeta> {
  const r = await fetch(`/api/notebook/clip?url=${encodeURIComponent(url)}`, { signal });
  const d = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(d?.error || 'Não foi possível capturar a página.');
  return d as PageMeta;
}
/** Baixa uma imagem externa pelo servidor (com proteção) para subir ao R2. */
export async function fetchExternalImage(url: string, name: string): Promise<File> {
  // tenta direto (muitos bancos liberam CORS); se não der, passa pelo servidor
  let blob: Blob | null = null;
  try {
    const r = await fetch(url, { mode: 'cors' });
    if (r.ok && /^image\//.test(r.headers.get('content-type') || '')) blob = await r.blob();
  } catch {
    /* sem CORS */
  }
  if (!blob) {
    const r = await fetch(`/api/notebook/clip?mode=image&url=${encodeURIComponent(url)}`);
    if (!r.ok) {
      const d = await r.json().catch(() => ({}));
      throw new Error(d?.error || 'Não foi possível baixar a imagem.');
    }
    blob = await r.blob();
  }
  const ext = (blob.type.split('/')[1] || 'jpg').replace('jpeg', 'jpg');
  const clean = name.replace(/[\\/:*?"<>|]+/g, ' ').trim().slice(0, 120) || 'imagem';
  return new File([blob], /\.[a-z0-9]{2,5}$/i.test(clean) ? clean : `${clean}.${ext}`, { type: blob.type });
}

const clipper: CanvasPlugin = {
  id: 'clipper',
  name: 'Recortar página',
  description: 'Cole um endereço: título, resumo e imagem viram um cartão.',
  hint: 'https://…',
  search: async (q, signal) => {
    const url = /^https?:\/\//i.test(q.trim()) ? q.trim() : `https://${q.trim()}`;
    const m = await clipPage(url, signal);
    return [{ kind: 'link', id: `clip-${m.url}`, title: m.title || m.site, url: m.url, description: m.description, image: m.image, site: m.site }];
  },
};

// ------------------------------------------------------------ bancos com chave (no servidor)
async function stockSearch(provider: 'pixabay' | 'unsplash', q: string, signal: AbortSignal): Promise<PluginResult[]> {
  const r = await fetch(`/api/notebook/stock?provider=${provider}&q=${encodeURIComponent(q)}`, { signal });
  const d = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(d?.error || 'A busca falhou.');
  return (d.results || []) as PluginResult[];
}
let statusPromise: Promise<Record<string, boolean>> | null = null;
/** Quais bancos com chave estão ligados (consulta uma vez por sessão). */
export function stockStatus(): Promise<Record<string, boolean>> {
  statusPromise ||= fetch('/api/notebook/stock?status=1')
    .then((r) => (r.ok ? r.json() : {}))
    .catch(() => ({}));
  return statusPromise;
}
/** Regra do Unsplash: avisar cada foto usada. */
export function trackStockDownload(provider: string, track?: string) {
  if (provider !== 'unsplash' || !track) return;
  void fetch('/api/notebook/stock', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ provider, track }) }).catch(() => {});
}

const pixabay: CanvasPlugin = {
  id: 'pixabay',
  name: 'Pixabay',
  description: 'Fotos gratuitas para qualquer uso. A original sobe para o seu Notebook.',
  hint: 'Buscar no Pixabay…',
  provider: 'pixabay',
  needsKey: 'PIXABAY_API_KEY',
  search: (q, signal) => stockSearch('pixabay', q, signal),
};
const unsplash: CanvasPlugin = {
  id: 'unsplash',
  name: 'Unsplash',
  description: 'Fotos de alta resolução. Pelas regras do Unsplash, a foto é exibida direto de lá, com crédito ao fotógrafo.',
  hint: 'Buscar no Unsplash…',
  provider: 'unsplash',
  needsKey: 'UNSPLASH_ACCESS_KEY',
  search: (q, signal) => stockSearch('unsplash', q, signal),
};

const needsKey = (id: string, name: string, description: string, key: string): CanvasPlugin => ({
  id,
  name,
  description,
  hint: '',
  needsKey: key,
  search: async () => [],
});

/** Registro: a ordem é a ordem das abas. */
export const CANVAS_PLUGINS: CanvasPlugin[] = [
  wikimedia,
  openverse,
  wikipedia,
  pixabay,
  unsplash,
  clipper,
  needsKey('gdrive', 'Google Drive', 'Imagens, PDFs, áudios, vídeos e documentos do seu Drive. O Insight só enxerga o que você escolher.', 'NEXT_PUBLIC_GOOGLE_CLIENT_ID e NEXT_PUBLIC_GOOGLE_API_KEY'),
];
