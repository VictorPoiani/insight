import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabase } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { processLevel5Refunds } from '@/lib/nitro/mercadopago';

export const dynamic = 'force-dynamic';

/**
 * Processa agora a fila de reembolsos do Nível 5 (só admin).
 * Abra no navegador logado como admin: /api/admin/nitro-refunds
 * O Cron da Vercel também chama uma vez por dia (Authorization: Bearer CRON_SECRET).
 */
export async function GET(req: NextRequest) {
  const secret = process.env.CRON_SECRET;
  const isCron = Boolean(secret) && req.headers.get('authorization') === `Bearer ${secret}`;
  if (!isCron) {
    const supabase = await createServerSupabase();
    const { data: isAdmin } = await supabase.rpc('is_insight_admin');
    if (!isAdmin) return NextResponse.json({ error: 'Não autorizado.' }, { status: 401 });
  }
  const token = process.env.MERCADOPAGO_ACCESS_TOKEN;
  if (!token) return NextResponse.json({ error: 'Mercado Pago não configurado.' }, { status: 500 });

  const admin = createAdminClient();
  const results = await processLevel5Refunds(admin, token);
  const { data: queue } = await admin
    .from('nitro_level5_refunds')
    .select('profile_id, status, amount, refunded_payment_id, attempts, last_error, processed_at')
    .order('requested_at', { ascending: false })
    .limit(20);
  return NextResponse.json({ processed: results, queue });
}
