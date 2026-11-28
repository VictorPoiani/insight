import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

/**
 * Link curto dos Stories: /s/<8 primeiros caracteres do id do post>.
 * Cabe na figurinha "Link" do Instagram e na própria imagem do story, e leva
 * direto ao post (com ?ref=story para saber de onde veio a visita).
 */
export async function GET(req: Request, ctx: { params: Promise<{ code: string }> }) {
  const { code } = await ctx.params;
  const home = new URL('/', req.url);
  if (!/^[0-9a-f]{8}$/i.test(code)) return NextResponse.redirect(home, 307);

  const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, {
    auth: { persistSession: false },
  });
  const prefix = code.toLowerCase();
  // ids que começam com o código: faixa [prefixo-0000…, prefixo-ffff…]
  const { data } = await supabase
    .from('posts')
    .select('id')
    .gte('id', `${prefix}-0000-0000-0000-000000000000`)
    .lte('id', `${prefix}-ffff-ffff-ffff-ffffffffffff`)
    .order('created_at', { ascending: false })
    .limit(1);

  const id = (data as { id: string }[] | null)?.[0]?.id;
  if (!id) return NextResponse.redirect(home, 307);
  const target = new URL(`/post/${id}`, req.url);
  target.searchParams.set('ref', 'story');
  return NextResponse.redirect(target, 307);
}
