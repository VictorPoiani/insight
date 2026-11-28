import { rateLimit } from '@/lib/net/rateLimit';
import { NextRequest, NextResponse } from 'next/server';


function getGiphyApiKey(): string {
  return (
    process.env.GIPHY_API_KEY?.trim() ||
    process.env.NEXT_PUBLIC_GIPHY_API_KEY?.trim() ||
    ''
  );
}

export interface GiphyMediaResult {
  id: string;
  title: string;
  previewUrl: string;
  fullUrl: string;
  mp4Url: string | null;
  width: number;
  height: number;
}

export async function GET(req: NextRequest) {
  const limited = await rateLimit(req, 'giphy', 60, 60);
  if (limited) return limited;
  try {
    const { searchParams } = new URL(req.url);

    // Se aceder a /api/giphy?status=check no navegador, mostra o diagnóstico da chave
    if (searchParams.get('status') === 'check') {
      return NextResponse.json({
        status: 'API GIPHY Online',
        customKeyConfigured: Boolean(
          process.env.GIPHY_API_KEY || process.env.NEXT_PUBLIC_GIPHY_API_KEY
        ),
        endpoint: 'https://api.giphy.com/v1',
      });
    }

    const q = searchParams.get('q')?.trim() || '';
    const type = searchParams.get('type') === 'stickers' ? 'stickers' : 'gifs';
    const limit = Math.min(Number(searchParams.get('limit')) || 18, 30);
    const offset = Math.max(Number(searchParams.get('offset')) || 0, 0);
    const apiKey = getGiphyApiKey();

    if (!apiKey) {
      // sem chave a GIPHY responde 401 e a busca parecia "sem resultados"
      console.error('[giphy] GIPHY_API_KEY não configurada');
      return NextResponse.json(
        { ok: false, error: 'no_key', message: 'A busca de GIFs está indisponível no momento.', items: [] },
        { status: 503 }
      );
    }

    const baseUrl = q
      ? `https://api.giphy.com/v1/${type}/search`
      : `https://api.giphy.com/v1/${type}/trending`;

    const params = new URLSearchParams({
      api_key: apiKey,
      limit: String(limit),
      offset: String(offset),
      rating: 'g',
      lang: 'pt',
    });
    if (q) params.set('q', q);

    const res = await fetch(`${baseUrl}?${params.toString()}`, {
      next: { revalidate: 120 },
    });

    if (!res.ok) {
      console.error('[giphy] resposta', res.status);
      const limited = res.status === 429;
      return NextResponse.json(
        {
          ok: false,
          error: limited ? 'rate_limited' : 'upstream',
          message: limited
            ? 'Muitas buscas de GIF agora. Tente de novo em alguns minutos.'
            : 'A busca de GIFs está indisponível no momento.',
          items: [],
        },
        { status: 502 }
      );
    }

    const json = await res.json();
    const items: GiphyMediaResult[] = (Array.isArray(json.data) ? json.data : [])
      .map((item: any) => {
        const images = item.images || {};
        const previewUrl =
          images.fixed_width?.webp ||
          images.fixed_width?.url ||
          images.downsized?.url ||
          images.original?.url ||
          '';
        const fullUrl =
          images.downsized_large?.url ||
          images.original?.webp ||
          images.original?.url ||
          images.fixed_height?.url ||
          '';
        const mp4Url =
          images.original_mp4?.mp4 ||
          images.fixed_height?.mp4 ||
          images.downsized_small?.mp4 ||
          null;

        return {
          id: String(item.id),
          title: String(item.title || 'GIF'),
          previewUrl,
          fullUrl,
          mp4Url,
          width: Number(images.original?.width) || 480,
          height: Number(images.original?.height) || 360,
        };
      })
      .filter((g: GiphyMediaResult) => Boolean(g.previewUrl && g.fullUrl));

    return NextResponse.json({
      ok: true,
      provider: 'giphy',
      items,
      pagination: json.pagination || { offset, count: items.length },
    });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Erro interno na API GIPHY';
    return NextResponse.json({ ok: false, error: msg, items: [] }, { status: 500 });
  }
}