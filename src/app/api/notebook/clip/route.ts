/**
 * Captura de páginas e mídia externa para o Canvas do Notebook.
 *
 *   GET ?url=…              → { url, title, description, image, site }
 *   GET ?url=…&mode=image   → os bytes da imagem (para subir sem perda ao R2)
 *
 * Proteção contra SSRF: só http/https nas portas padrão; o nome é resolvido
 * aqui e TODOS os endereços precisam ser públicos; a conexão usa o endereço
 * já conferido (sem nova consulta de DNS, o que barra DNS rebinding); cada
 * redirecionamento passa pela mesma checagem; tempo e tamanho limitados.
 * Só para quem está logado e tem o Notebook.
 */
import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabase } from '@/lib/supabase/server';
import { ClipError, IMAGE_MAX, IMAGE_TYPES, PAGE_MAX, TIMEOUT, readMeta, safeFetch } from '@/lib/net/safeFetch';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  try {
    const supabase = await createServerSupabase();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: 'Entre na sua conta.' }, { status: 401 });
    const { data: allowed } = await supabase.rpc('notebook_has_access');
    if (!allowed) return NextResponse.json({ error: 'Sem acesso ao Notebook.' }, { status: 403 });

    const raw = req.nextUrl.searchParams.get('url') || '';
    if (raw.length > 2000) throw new ClipError('Endereço longo demais.');
    const mode = req.nextUrl.searchParams.get('mode') === 'image' ? 'image' : 'page';
    const deadline = Date.now() + TIMEOUT;

    if (mode === 'image') {
      const r = await safeFetch(raw, IMAGE_MAX, 'image/avif,image/webp,image/png,image/jpeg,image/gif;q=0.9', deadline);
      if (!IMAGE_TYPES.test(r.type)) throw new ClipError('Esse endereço não é uma imagem.', 415);
      return new NextResponse(new Uint8Array(r.body), {
        headers: { 'Content-Type': r.type, 'Cache-Control': 'private, max-age=300', 'X-Content-Type-Options': 'nosniff', 'Content-Disposition': 'attachment' },
      });
    }

    const r = await safeFetch(raw, PAGE_MAX, 'text/html,application/xhtml+xml;q=0.9,*/*;q=0.1', deadline);
    if (IMAGE_TYPES.test(r.type)) return NextResponse.json({ url: r.url, title: '', description: '', image: r.url, site: new URL(r.url).hostname, isImage: true });
    if (!/html|xml/.test(r.type)) return NextResponse.json({ url: r.url, title: '', description: '', image: '', site: new URL(r.url).hostname });
    const charset = /charset=["']?(iso-8859-1|latin1|windows-1252)/i.test(r.body.subarray(0, 4000).toString('latin1')) ? 'latin1' : 'utf8';
    return NextResponse.json(readMeta(r.body.toString(charset), r.url));
  } catch (err) {
    if (err instanceof ClipError) return NextResponse.json({ error: err.message }, { status: err.status });
    console.error('[notebook/clip]', err);
    return NextResponse.json({ error: 'Não foi possível capturar essa página.' }, { status: 502 });
  }
}
