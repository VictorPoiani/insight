import { NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { moderateEntity } from '@/lib/moderation/engine';
import { ENTITY_SELECT, ownerOf } from '@/lib/moderation/extract';
import { getCaller, isEntityType, tooMany, UUID_RE } from '@/lib/moderation/auth';

export const maxDuration = 30;

/**
 * Modera AGORA um item do próprio usuário e devolve o veredito (o editor mostra
 * a mensagem na hora). Se ninguém chamar esta rota, o item continua oculto e
 * é processado pela fila (pump/sweep) — falha fechada.
 */
export async function POST(req: Request) {
  const caller = await getCaller();
  if (!caller) return NextResponse.json({ error: 'Entre na sua conta.' }, { status: 401 });
  if (tooMany(`check:${caller.profileId}`, 40, 60_000)) {
    return NextResponse.json({ error: 'Muitas verificações seguidas. Aguarde um pouco.' }, { status: 429 });
  }
  const body = await req.json().catch(() => ({}));
  const kind = body?.kind;
  const id = String(body?.id || '');
  if (!isEntityType(kind) || !UUID_RE.test(id)) return NextResponse.json({ error: 'Pedido inválido.' }, { status: 400 });

  const admin = createAdminClient();
  const { table, columns } = ENTITY_SELECT[kind];
  const { data: row } = await admin.from(table).select(columns).eq('id', id).maybeSingle();
  if (!row) return NextResponse.json({ error: 'Não encontrado.' }, { status: 404 });
  if (ownerOf(kind, row as unknown as Record<string, unknown>) !== caller.profileId && !caller.isStaff) {
    return NextResponse.json({ error: 'Sem permissão.' }, { status: 403 });
  }

  const outcome = await moderateEntity(admin, kind, id);
  return NextResponse.json(outcome);
}
