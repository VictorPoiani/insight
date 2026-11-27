/**
 * Bancos de imagens com chave (a chave fica só no servidor).
 *
 *   GET  ?status=1                       → { pixabay: bool, unsplash: bool }
 *   GET  ?provider=pixabay&q=…           → resultados normalizados
 *   GET  ?provider=unsplash&q=…          → resultados normalizados
 *   POST { provider:'unsplash', track }   → avisa o download ao Unsplash (regra da API)
 *
 * Regras de cada serviço:
 * - Pixabay: não pode exibir pelo endereço deles por muito tempo; o Canvas baixa
 *   o original e guarda no R2. Respostas de busca ficam em cache por 24 h.
 * - Unsplash: a imagem é exibida pelo endereço deles (sem cópia), o download é
 *   avisado pelo endpoint próprio e o crédito leva links com utm.
 */
import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabase } from '@/lib/supabase/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const APP = 'insight_notebook';
const DAY = 24 * 60 * 60 * 1000;
const cache = new Map<string, { at: number; data: unknown }>();

const keys = () => ({ pixabay: process.env.PIXABAY_API_KEY?.trim() || '', unsplash: process.env.UNSPLASH_ACCESS_KEY?.trim() || '' });

function cached<T>(k: string): T | null {
  const hit = cache.get(k);
  if (hit && Date.now() - hit.at < DAY) return hit.data as T;
  if (hit) cache.delete(k);
  return null;
}
function store(k: string, data: unknown) {
  if (cache.size > 500) cache.delete(cache.keys().next().value as string);
  cache.set(k, { at: Date.now(), data });
}

async function guard() {
  const supabase = await createServerSupabase();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Entre na sua conta.' }, { status: 401 });
  const { data: allowed } = await supabase.rpc('notebook_has_access');
  if (!allowed) return NextResponse.json({ error: 'Sem acesso ao Notebook.' }, { status: 403 });
  return null;
}

type PixabayHit = { id: number; tags: string; previewURL: string; webformatURL: string; largeImageURL: string; imageWidth: number; imageHeight: number; user: string; pageURL: string };
type UnsplashPhoto = {
  id: string;
  alt_description: string | null;
  description: string | null;
  width: number;
  height: number;
  urls: { small: string; regular: string; full: string };
  links: { html: string; download_location: string };
  user: { name: string; links: { html: string } };
};

const utm = (u: string) => `${u}${u.includes('?') ? '&' : '?'}utm_source=${APP}&utm_medium=referral`;

export async function GET(req: NextRequest) {
  const denied = await guard();
  if (denied) return denied;
  const k = keys();
  const sp = req.nextUrl.searchParams;
  if (sp.get('status')) return NextResponse.json({ pixabay: !!k.pixabay, unsplash: !!k.unsplash });

  const provider = sp.get('provider');
  const q = (sp.get('q') || '').trim().slice(0, 100);
  if (!q) return NextResponse.json({ results: [] });

  try {
    if (provider === 'pixabay') {
      if (!k.pixabay) return NextResponse.json({ error: 'Pixabay sem chave configurada.' }, { status: 503 });
      const ck = `px:${q.toLowerCase()}`;
      const hit = cached<unknown[]>(ck);
      if (hit) return NextResponse.json({ results: hit });
      const u = new URL('https://pixabay.com/api/');
      Object.entries({ key: k.pixabay, q, image_type: 'photo', per_page: '30', safesearch: 'true', lang: 'pt' }).forEach(([a, b]) => u.searchParams.set(a, b));
      const r = await fetch(u, { signal: AbortSignal.timeout(8000) });
      if (!r.ok) return NextResponse.json({ error: r.status === 429 ? 'Muitas buscas no Pixabay; tente em um minuto.' : `O Pixabay respondeu com erro (${r.status}).` }, { status: 502 });
      const d = (await r.json()) as { hits: PixabayHit[] };
      const results = (d.hits || []).map((h) => ({
        kind: 'image',
        id: `px-${h.id}`,
        title: h.tags.split(',')[0]?.trim() || 'Imagem',
        thumb: h.webformatURL || h.previewURL,
        full: h.largeImageURL,
        credit: `${h.user} · Pixabay`,
        creditUrl: h.pageURL,
        source: h.pageURL,
      }));
      store(ck, results);
      return NextResponse.json({ results });
    }

    if (provider === 'unsplash') {
      if (!k.unsplash) return NextResponse.json({ error: 'Unsplash sem chave configurada.' }, { status: 503 });
      const ck = `us:${q.toLowerCase()}`;
      const hit = cached<unknown[]>(ck);
      if (hit) return NextResponse.json({ results: hit });
      const r = await fetch(`https://api.unsplash.com/search/photos?query=${encodeURIComponent(q)}&per_page=30&content_filter=high`, {
        headers: { Authorization: `Client-ID ${k.unsplash}`, 'Accept-Version': 'v1' },
        signal: AbortSignal.timeout(8000),
      });
      if (!r.ok) return NextResponse.json({ error: r.status === 403 ? 'Limite de buscas do Unsplash atingido nesta hora.' : `O Unsplash respondeu com erro (${r.status}).` }, { status: 502 });
      const d = (await r.json()) as { results: UnsplashPhoto[] };
      const results = (d.results || []).map((p) => ({
        kind: 'image',
        id: `us-${p.id}`,
        title: (p.alt_description || p.description || 'Foto').slice(0, 120),
        thumb: p.urls.small,
        full: p.urls.regular,
        width: p.width,
        height: p.height,
        credit: `Foto de ${p.user.name} no Unsplash`,
        creditUrl: utm(p.user.links.html),
        source: utm(p.links.html),
        hotlink: true,
        track: p.links.download_location,
      }));
      store(ck, results);
      return NextResponse.json({ results });
    }
  } catch (err) {
    console.error('[notebook/stock]', err);
    return NextResponse.json({ error: 'A busca falhou. Tente de novo.' }, { status: 502 });
  }
  return NextResponse.json({ error: 'Fonte desconhecida.' }, { status: 400 });
}

export async function POST(req: NextRequest) {
  const denied = await guard();
  if (denied) return denied;
  const k = keys();
  const body = (await req.json().catch(() => ({}))) as { provider?: string; track?: string };
  // só o endpoint oficial de download do Unsplash
  if (body.provider !== 'unsplash' || !k.unsplash || typeof body.track !== 'string' || !/^https:\/\/api\.unsplash\.com\/photos\/[\w-]+\/download(\?|$)/.test(body.track)) {
    return NextResponse.json({ ok: false }, { status: 400 });
  }
  await fetch(body.track, { headers: { Authorization: `Client-ID ${k.unsplash}`, 'Accept-Version': 'v1' }, signal: AbortSignal.timeout(6000) }).catch(() => null);
  return NextResponse.json({ ok: true });
}
