import { NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { ENTITY_SELECT, inputFor, ownerOf, type EntityType } from '@/lib/moderation/extract';
import { getCaller } from '@/lib/moderation/auth';

/** Painel da equipe: recursos, itens em revisão, bloqueados recentes e log. */
export async function GET(req: Request) {
  const caller = await getCaller();
  if (!caller?.isStaff) return NextResponse.json({ error: 'Sem permissão.' }, { status: 403 });
  const tab = new URL(req.url).searchParams.get('tab') || 'appeals';
  const admin = createAdminClient();

  type Item = { kind: EntityType; id: string; status?: string; reason?: string | null; appeal?: { message: string | null; created_at: string } };
  let items: Item[] = [];

  if (tab === 'log') {
    const { data } = await admin
      .from('moderation_logs')
      .select('id, entity_type, entity_id, verdict, action, reason, provider, excerpt, created_at, profile_id')
      .order('created_at', { ascending: false })
      .limit(80);
    return NextResponse.json({ log: data || [] });
  }

  if (tab === 'appeals') {
    const { data } = await admin
      .from('moderation_appeals')
      .select('entity_type, entity_id, message, created_at')
      .eq('status', 'pending')
      .order('created_at', { ascending: true })
      .limit(40);
    items = (data || []).map((a) => ({ kind: a.entity_type as EntityType, id: a.entity_id as string, appeal: { message: a.message as string | null, created_at: a.created_at as string } }));
  } else {
    const status = tab === 'blocked' ? 'blocked' : 'review';
    for (const kind of ['post', 'reply', 'topic'] as const) {
      const { table } = ENTITY_SELECT[kind];
      const { data } = await admin.from(table).select('id').eq('moderation_status', status).order('flagged_at', { ascending: false }).limit(25);
      items.push(...(data || []).map((d) => ({ kind, id: d.id as string })));
    }
  }

  // prévia de cada item + autor
  const out = [];
  for (const it of items) {
    const { table, columns } = ENTITY_SELECT[it.kind];
    const { data: row } = await admin.from(table).select(columns).eq('id', it.id).maybeSingle();
    if (!row) continue;
    const r = row as unknown as Record<string, unknown>;
    const input = inputFor(it.kind, r);
    const owner = ownerOf(it.kind, r);
    const { data: author } = owner
      ? await admin.from('profiles').select('username, display_name, avatar_url').eq('id', owner).maybeSingle()
      : { data: null };
    const { data: lastLog } = await admin
      .from('moderation_logs')
      .select('verdict, reason, categories, scores, provider, created_at')
      .eq('entity_type', it.kind)
      .eq('entity_id', it.id)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();
    out.push({
      ...it,
      status: r.moderation_status,
      isNsfw: r.is_nsfw,
      reason: r.moderation_reason ?? lastLog?.reason ?? null,
      postId: it.kind === 'post' ? it.id : it.kind === 'reply' ? r.post_id : null,
      text: input.text.slice(0, 1200),
      images: input.images.slice(0, 6),
      videos: input.unverifiedVideos.slice(0, 3),
      author,
      lastLog,
    });
  }
  return NextResponse.json({ items: out });
}
