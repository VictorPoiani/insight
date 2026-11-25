import { NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { ENTITY_SELECT, ownerOf } from '@/lib/moderation/extract';
import { getCaller, isEntityType, tooMany, UUID_RE } from '@/lib/moderation/auth';

/** Autor pede revisão humana de um conteúdo bloqueado ou em análise. */
export async function POST(req: Request) {
  const caller = await getCaller();
  if (!caller) return NextResponse.json({ error: 'Entre na sua conta.' }, { status: 401 });
  if (tooMany(`appeal:${caller.profileId}`, 5, 60 * 60_000)) {
    return NextResponse.json({ error: 'Você já enviou vários pedidos agora. Aguarde a equipe responder.' }, { status: 429 });
  }
  const body = await req.json().catch(() => ({}));
  const kind = body?.kind;
  const id = String(body?.id || '');
  const message = String(body?.message || '').trim().slice(0, 1000);
  if (!isEntityType(kind) || kind === 'profile' || !UUID_RE.test(id)) return NextResponse.json({ error: 'Pedido inválido.' }, { status: 400 });

  const admin = createAdminClient();
  const { table, columns } = ENTITY_SELECT[kind];
  const { data: row } = await admin.from(table).select(columns).eq('id', id).maybeSingle();
  const r = row as unknown as Record<string, unknown> | null;
  if (!r || ownerOf(kind, r) !== caller.profileId) return NextResponse.json({ error: 'Não encontrado.' }, { status: 404 });
  if (!['blocked', 'review'].includes(String(r.moderation_status))) {
    return NextResponse.json({ error: 'Este conteúdo não está retido.' }, { status: 409 });
  }

  const { error } = await admin.from('moderation_appeals').insert({ entity_type: kind, entity_id: id, profile_id: caller.profileId, message: message || null });
  if (error && !/duplicate/i.test(error.message)) return NextResponse.json({ error: 'Não foi possível enviar.' }, { status: 500 });
  await admin.from(table).update({ moderation_status: 'appealed' }).eq('id', id);

  // avisa a equipe
  const { data: staff } = await admin.from('profiles').select('id').in('role', ['admin', 'moderator']).limit(20);
  const text = `Novo pedido de revisão de moderação (${kind === 'post' ? 'Insight' : kind === 'reply' ? 'resposta' : 'tópico'}).`;
  if (staff?.length) {
    await admin
      .from('notifications')
      .insert(staff.map((s) => ({ recipient_id: s.id, actor_id: caller.profileId, type: 'system', post_id: kind === 'post' ? id : null, content_preview: text, message: text })))
      .then(() => undefined, () => undefined);
  }
  return NextResponse.json({ ok: true, status: 'appealed' });
}
