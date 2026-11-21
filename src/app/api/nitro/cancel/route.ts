import { NextResponse } from 'next/server';
import { createServerSupabase } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { cancelPreapproval, findNitroPreapprovals } from '@/lib/nitro/mercadopago';

/**
 * Cancela a assinatura do Nitro de quem está logado. O acesso continua até o
 * fim do período já pago (nitro_expires_at); depois disso o botão de assinar
 * volta a aparecer.
 */
export async function POST() {
  const supabase = await createServerSupabase();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Entre na sua conta.' }, { status: 401 });

  const token = process.env.MERCADOPAGO_ACCESS_TOKEN;
  if (!token) return NextResponse.json({ error: 'Pagamento indisponível no momento.' }, { status: 500 });

  const { data: profile } = await supabase
    .from('profiles')
    .select('id, nitro_status, nitro_subscription_id')
    .or(`user_id.eq.${user.id},id.eq.${user.id}`)
    .maybeSingle();
  if (!profile) return NextResponse.json({ error: 'Perfil não encontrado.' }, { status: 404 });

  // cancela todas as assinaturas vivas deste perfil (inclusive uma pendente)
  const subs = await findNitroPreapprovals(token, profile.id);
  const toCancel = subs.filter((p) => p.status === 'authorized' || p.status === 'paused' || p.status === 'pending');
  if (!toCancel.length && profile.nitro_subscription_id && profile.nitro_status !== 'canceled') {
    toCancel.push({ id: profile.nitro_subscription_id, status: 'authorized' });
  }
  let ok = true;
  for (const p of toCancel) ok = (await cancelPreapproval(token, String(p.id))) && ok;
  if (!ok) return NextResponse.json({ error: 'Não foi possível cancelar agora. Tente de novo em instantes.' }, { status: 502 });

  await createAdminClient().from('profiles').update({ nitro_status: 'canceled' }).eq('id', profile.id);
  return NextResponse.json({ canceled: true });
}
