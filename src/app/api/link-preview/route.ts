/**
 * Prévia de link dos posts: título, descrição, imagem e site de uma página.
 *   GET /api/link-preview?url=…  → { url, title, description, image, site }
 * Usa a busca segura (proteção contra SSRF) e fica no cache da CDN por um dia,
 * então o mesmo link é buscado uma vez só, não a cada pessoa que vê o post.
 */
import { NextRequest, NextResponse } from 'next/server';
import { ClipError, IMAGE_TYPES, readMeta, safeFetch } from '@/lib/net/safeFetch';

export const runtime = 'nodejs';

const PAGE_MAX = 800_000;
const TIMEOUT = 6000;
const memo = new Map<string, { at: number; data: unknown }>();
const MEMO_MS = 30 * 60_000;

export async function GET(req: NextRequest) {
  const raw = (req.nextUrl.searchParams.get('url') || '').trim();
  if (!raw || raw.length > 2000 || !/^https?:\/\//i.test(raw)) {
    return NextResponse.json({ error: 'Endereço inválido.' }, { status: 400 });
  }
  const hit = memo.get(raw);
  if (hit && Date.now() - hit.at < MEMO_MS) return ok(hit.data);

  try {
    const r = await safeFetch(raw, PAGE_MAX, 'text/html,application/xhtml+xml;q=0.9,*/*;q=0.1', Date.now() + TIMEOUT);
    let data: { url: string; title: string; description: string; image: string; site: string };
    if (IMAGE_TYPES.test(r.type)) {
      data = { url: r.url, title: '', description: '', image: r.url, site: new URL(r.url).hostname.replace(/^www\./, '') };
    } else if (/html|xml/.test(r.type)) {
      const charset = /charset=["']?(iso-8859-1|latin1|windows-1252)/i.test(r.body.subarray(0, 4000).toString('latin1')) ? 'latin1' : 'utf8';
      data = readMeta(r.body.toString(charset), r.url);
    } else {
      return NextResponse.json({ error: 'Sem prévia.' }, { status: 404, headers: { 'Cache-Control': 'public, s-maxage=3600' } });
    }
    // só vale a prévia se tiver ao menos um título
    if (!data.title) return NextResponse.json({ error: 'Sem prévia.' }, { status: 404, headers: { 'Cache-Control': 'public, s-maxage=3600' } });
    if (memo.size > 500) memo.clear();
    memo.set(raw, { at: Date.now(), data });
    return ok(data);
  } catch (err) {
    const status = err instanceof ClipError ? err.status : 502;
    return NextResponse.json({ error: 'Sem prévia.' }, { status: status === 400 ? 400 : 404, headers: { 'Cache-Control': 'public, s-maxage=1800' } });
  }
}

function ok(data: unknown) {
  return NextResponse.json(data, {
    headers: { 'Cache-Control': 'public, max-age=3600, s-maxage=86400, stale-while-revalidate=604800' },
  });
}
