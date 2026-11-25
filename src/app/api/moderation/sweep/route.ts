import { NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { processQueue } from '@/lib/moderation/engine';
import { getCaller } from '@/lib/moderation/auth';

export const maxDuration = 60;

/** Varredura geral da fila: Cron da Vercel (Bearer CRON_SECRET) ou equipe. */
export async function GET(req: Request) {
  const secret = process.env.CRON_SECRET;
  const isCron = Boolean(secret) && req.headers.get('authorization') === `Bearer ${secret}`;
  if (!isCron) {
    const caller = await getCaller();
    if (!caller?.isStaff) return NextResponse.json({ error: 'Sem permissão.' }, { status: 403 });
  }
  const admin = createAdminClient();
  const started = Date.now();
  let processed = 0;
  // lotes até ~45s
  while (Date.now() - started < 45_000) {
    const done = await processQueue(admin, { limit: 10 });
    processed += done.length;
    if (done.length < 10) break;
  }
  const { count } = await admin.from('moderation_queue').select('entity_id', { count: 'exact', head: true });
  return NextResponse.json({ processed, remaining: count ?? 0 });
}
