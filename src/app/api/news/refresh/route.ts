import { NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { claimIngestSlot, ingestNews } from '@/lib/news/ingest';

export const maxDuration = 60;
export const dynamic = 'force-dynamic';

/**
 * Chamado pelo feed: se a última coleta tem mais de 20 minutos, coleta agora.
 * Público, mas limitado pela trava (no máximo uma coleta a cada 20 min).
 */
export async function POST() {
  try {
    const admin = createAdminClient();
    if (!(await claimIngestSlot(admin, 20))) return NextResponse.json({ refreshed: false });
    const report = await ingestNews(admin);
    return NextResponse.json({ refreshed: true, inserted: report.inserted, ms: report.ms });
  } catch (err) {
    return NextResponse.json({ refreshed: false, error: err instanceof Error ? err.message : 'erro' }, { status: 500 });
  }
}
