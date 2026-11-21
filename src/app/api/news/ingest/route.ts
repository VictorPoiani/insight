import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { createServerSupabase } from '@/lib/supabase/server';
import { ingestNews } from '@/lib/news/ingest';

export const maxDuration = 60;
export const dynamic = 'force-dynamic';

/**
 * Coleta completa com relatório por fonte. Usada pelo Cron da Vercel
 * (Authorization: Bearer CRON_SECRET) ou por um admin logado.
 */
export async function GET(req: NextRequest) {
  const secret = process.env.CRON_SECRET;
  const isCron = Boolean(secret) && req.headers.get('authorization') === `Bearer ${secret}`;
  if (!isCron) {
    const supabase = await createServerSupabase();
    const { data: isAdmin } = await supabase.rpc('is_insight_admin');
    if (!isAdmin) return NextResponse.json({ error: 'Não autorizado.' }, { status: 401 });
  }
  const report = await ingestNews(createAdminClient());
  return NextResponse.json(report);
}
