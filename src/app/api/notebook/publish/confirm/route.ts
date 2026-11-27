/** Depois que o post sai: liga a cópia publicada ao post e a torna pública. */
import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabase } from '@/lib/supabase/server';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function POST(req: NextRequest) {
  const supabase = await createServerSupabase();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Entre na sua conta.' }, { status: 401 });
  const body = (await req.json().catch(() => ({}))) as { publicationId?: string; postId?: string };
  if (!body.publicationId || !UUID.test(body.publicationId) || !body.postId || !UUID.test(body.postId)) return NextResponse.json({ error: 'Dados inválidos.' }, { status: 400 });
  const { error } = await supabase.from('notebook_publications').update({ post_id: body.postId, is_public: true, published_at: new Date().toISOString() }).eq('id', body.publicationId);
  if (error) return NextResponse.json({ error: 'Não foi possível concluir a publicação.' }, { status: 422 });
  return NextResponse.json({ ok: true });
}
