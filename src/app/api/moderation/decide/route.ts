import { NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { ENTITY_SELECT, ownerOf } from '@/lib/moderation/extract';
import { getCaller, isEntityType, UUID_RE } from '@/lib/moderation/auth';

type Decision = 'approve' | 'approve_nsfw' | 'block' | 'delete';
const VERDICT: Record<Decision, 'ALLOW' | 'NSFW' | 'BLOCK'> = { approve: 'ALLOW', approve_nsfw: 'NSFW', block: 'BLOCK', delete: 'BLOCK' };

/** Decisão humana da equipe (aprova, aprova como +18, mantém bloqueado ou exclui). */
export async function POST(req: Request) {
  const caller = await getCaller();
  if (!caller?.isStaff) return NextResponse.json({ error: 'Sem permissão.' }, { status: 403 });
  const body = await req.json().catch(() => ({}));
  const kind = body?.kind;
  const id = String(body?.id || '');
  const decision = body?.decision as Decision;
  const note = String(body?.note || '').trim().slice(0, 500) || null;
  if (!isEntityType(kind) || kind === 'profile' || !UUID_RE.test(id) || !(decision in VERDICT)) {
    return NextResponse.json({ error: 'Pedido inválido.' }, { status: 400 });
  }

  const admin = createAdminClient();
  const { table, columns } = ENTITY_SELECT[kind];
  const { data: row } = await admin.from(table).select(columns).eq('id', id).maybeSingle();
  const r = row as unknown as Record<string, unknown> | null;
  if (!r) return NextResponse.json({ error: 'Não encontrado.' }, { status: 404 });
  const owner = ownerOf(kind, r);
  const now = new Date().toISOString();

  if (decision === 'delete') {
    await admin.from(table).delete().eq('id', id);
  } else {
    await admin
      .from(table)
      .update({
        moderation_status: decision === 'block' ? 'blocked' : 'approved',
        is_nsfw: decision === 'approve_nsfw',
        moderation_reason: decision === 'approve' ? null : decision === 'approve_nsfw' ? 'sexual' : r.moderation_reason ?? 'none',
        moderated_at: now,
        flagged_at: decision === 'approve' ? null : now,
      })
      .eq('id', id);
  }
  await admin.from('moderation_queue').delete().eq('entity_type', kind).eq('entity_id', id);

  const approved = decision === 'approve' || decision === 'approve_nsfw';
  await admin
    .from('moderation_appeals')
    .update({ status: approved ? 'approved' : 'rejected', resolution_note: note, resolved_by: caller.profileId, resolved_at: now })
    .eq('entity_type', kind)
    .eq('entity_id', id)
    .eq('status', 'pending');

  await admin.from('moderation_logs').insert({
    entity_type: kind,
    entity_id: id,
    profile_id: owner,
    verdict: VERDICT[decision],
    action: `manual_${decision}`,
    reason: note,
    provider: 'human',
    reviewer_id: caller.profileId,
  });

  const what = kind === 'reply' ? 'Sua resposta' : kind === 'topic' ? 'Seu tópico' : 'Seu Insight';
  const text = approved
    ? `${what} foi revisado pela equipe e liberado${decision === 'approve_nsfw' ? ' com o aviso +18' : ''}.`
    : decision === 'delete'
      ? `${what} foi revisado pela equipe e removido por violar as regras da comunidade.${note ? ` Nota: ${note}` : ''}`
      : `${what} foi revisado pela equipe e continua bloqueado.${note ? ` Nota: ${note}` : ''}`;
  if (owner) {
    await admin
      .from('notifications')
      .insert({ recipient_id: owner, actor_id: caller.profileId, type: 'system', post_id: kind === 'post' && decision !== 'delete' ? id : null, content_preview: text, message: text })
      .then(() => undefined, () => undefined);
  }
  return NextResponse.json({ ok: true });
}
