import { NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { processQueue } from '@/lib/moderation/engine';
import { getCaller, tooMany } from '@/lib/moderation/auth';

export const maxDuration = 60;

/** Processa a fila de moderação de quem está logado (o app chama sozinho). */
export async function POST() {
  const caller = await getCaller();
  if (!caller) return NextResponse.json({ processed: 0, remaining: 0 });
  if (tooMany(`pump:${caller.profileId}`, 12, 60_000)) return NextResponse.json({ processed: 0, remaining: 0, throttled: true });
  const admin = createAdminClient();
  const done = await processQueue(admin, { profileId: caller.profileId, limit: 5 });
  const { count } = await admin
    .from('moderation_queue')
    .select('entity_id', { count: 'exact', head: true })
    .eq('profile_id', caller.profileId)
    .lt('attempts', 6);
  return NextResponse.json({
    processed: done.length,
    remaining: count ?? 0,
    outcomes: done.filter((d) => !d.skipped).map((d) => ({ kind: d.entityType, id: d.entityId, verdict: d.verdict, message: d.message })),
  });
}
