import { NextResponse } from 'next/server';
import { createServerSupabase } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { processLevel5Refunds, syncNitroForProfile } from '@/lib/nitro/mercadopago';

/**
 * Confere a assinatura de quem está logado direto no Mercado Pago e atualiza o
 * perfil. Rede de segurança para quando o webhook atrasa ou não chega.
 */
export async function POST() {
  const supabase = await createServerSupabase();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Entre na sua conta.' }, { status: 401 });
  const token = process.env.MERCADOPAGO_ACCESS_TOKEN;
  if (!token) return NextResponse.json({ synced: false });

  const { data: profile } = await supabase
    .from('profiles')
    .select('id')
    .or(`user_id.eq.${user.id},id.eq.${user.id}`)
    .maybeSingle();
  if (!profile) return NextResponse.json({ synced: false });

  const admin = createAdminClient();
  const result = await syncNitroForProfile(admin, token, profile.id);
  // Nível 5 alcançado (inclusive por doação manual): encerra e reembolsa a assinatura
  const refunds = await processLevel5Refunds(admin, token, profile.id).catch(() => []);
  return NextResponse.json({ ...result, level5Refunds: refunds.length });
}
