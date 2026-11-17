import { NextRequest, NextResponse } from 'next/server';

const FALLBACK_GIPHY_KEY = 'GlVGYHkr3WSBnllca54iNt0yFbjz7L65';

function getGiphyApiKey(): string {
  return (
    process.env.GIPHY_API_KEY?.trim() ||
    process.env.NEXT_PUBLIC_GIPHY_API_KEY?.trim() ||
    FALLBACK_GIPHY_KEY
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

    if (q) {
      params.set('q', q);
    }

    const res = await fetch(`${baseUrl}?${params.toString()}`, {
      next: { revalidate: 120 },
    });

    if (res.ok) {
      const json = await res.json();
      if (Array.isArray(json.data) && json.data.length > 0) {
        const items: GiphyMediaResult[] = json.data
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
      }
    }

    // Fallback de segurança caso a chave a pública atinja o limite de requisições
    const fallbackUrl = q
      ? `https://g.tenor.com/v1/search?q=${encodeURIComponent(
          q
        )}&key=LIVDSRZULELA&limit=${limit}&pos=${offset}&locale=pt_BR`
      : `https://g.tenor.com/v1/trending?key=LIVDSRZULELA&limit=${limit}&pos=${offset}&locale=pt_BR`;

    const fbRes = await fetch(fallbackUrl);
    if (fbRes.ok) {
      const fbJson = await fbRes.json();
      const items: GiphyMediaResult[] = (fbJson.results || [])
        .map((item: any) => ({
          id: String(item.id),
          title: String(item.content_description || 'GIF'),
          previewUrl:
            item.media?.[0]?.tinygif?.url || item.media?.[0]?.gif?.url || '',
          fullUrl: item.media?.[0]?.gif?.url || '',
          mp4Url: item.media?.[0]?.mp4?.url || null,
          width: 480,
          height: 360,
        }))
        .filter((g: GiphyMediaResult) => Boolean(g.previewUrl && g.fullUrl));

      return NextResponse.json({
        ok: true,
        provider: 'fallback',
        items,
        pagination: { offset, count: items.length },
      });
    }

    return NextResponse.json({ ok: true, items: [] });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Erro interno na API GIPHY';
    return NextResponse.json({ ok: false, error: msg, items: [] }, { status: 500 });
  }
}