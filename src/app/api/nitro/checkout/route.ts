import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabase } from '@/lib/supabase/server';
import { NITRO_PRICE_BRL, NITRO_LIFETIME_LEVEL } from '@/lib/nitro/entitlement';
import { findNitroPreapprovals } from '@/lib/nitro/mercadopago';
import { createAdminClient } from '@/lib/supabase/admin';

/**
 * Checkout do Insight Nitro — assinatura recorrente (Mercado Pago preapproval):
 * R$ 3,99 cobrados todo mês no cartão, até a pessoa cancelar.
 *
 * Abre quando NITRO_BILLING_ENABLED=true no servidor OU nitro_settings
 * billing_enabled = 'true' no banco (liga/desliga sem deploy) — e sempre exige
 * MERCADOPAGO_ACCESS_TOKEN. A ativação acontece no webhook
 * (/api/webhooks/mercadopago), nunca aqui.
 */
async function billingEnabled(supabase: Awaited<ReturnType<typeof createServerSupabase>>): Promise<boolean> {
  if (!process.env.MERCADOPAGO_ACCESS_TOKEN) return false;
  if (process.env.NITRO_BILLING_ENABLED === 'true') return true;
  if (process.env.NITRO_BILLING_ENABLED === 'false') return false;
  const { data } = await supabase.rpc('nitro_billing_enabled');
  return data === true;
}

export async function GET() {
  const supabase = await createServerSupabase();
  return NextResponse.json({ enabled: await billingEnabled(supabase) }, { headers: { 'Cache-Control': 'no-store' } });
}

export async function POST(req: NextRequest) {
  const supabase = await createServerSupabase();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: 'Entre na sua conta para assinar.' }, { status: 401 });
  }

  if (!(await billingEnabled(supabase))) {
    return NextResponse.json(
      { error: 'O Insight Nitro chega em breve. A assinatura ainda não está aberta.', comingSoon: true },
      { status: 503 }
    );
  }

  const accessToken = process.env.MERCADOPAGO_ACCESS_TOKEN;
  if (!accessToken) {
    return NextResponse.json({ error: 'Pagamento indisponível no momento.' }, { status: 500 });
  }

  const { data: profile } = await supabase
    .from('profiles')
    .select('id, role, contributor_level, has_lifetime_nitro, nitro_status, nitro_expires_at, nitro_subscription_id')
    .or(`user_id.eq.${user.id},id.eq.${user.id}`)
    .maybeSingle();
  if (!profile) return NextResponse.json({ error: 'Perfil não encontrado.' }, { status: 404 });

  // Vitalício (fundador / Nível 5) nunca assina
  if (profile.role === 'admin' || profile.has_lifetime_nitro || (profile.contributor_level ?? 0) >= NITRO_LIFETIME_LEVEL) {
    return NextResponse.json({ error: 'Você já tem o Nitro vitalício.' }, { status: 409 });
  }
  // Uma assinatura por vez: só assina de novo quem cancelou
  if (profile.nitro_status === 'active' || profile.nitro_status === 'past_due') {
    return NextResponse.json({ error: 'Você já tem uma assinatura do Nitro. Para trocar, cancele a atual primeiro.' }, { status: 409 });
  }

  // Confere no próprio Mercado Pago (o webhook pode não ter chegado ainda)
  const existing = await findNitroPreapprovals(accessToken, profile.id);
  const live = existing.find((p) => p.status === 'authorized' || p.status === 'paused');
  if (live) {
    try {
      await createAdminClient()
        .from('profiles')
        .update({ nitro_status: live.status === 'authorized' ? 'active' : 'past_due', nitro_subscription_id: String(live.id) })
        .eq('id', profile.id);
    } catch {
      /* o webhook sincroniza depois */
    }
    return NextResponse.json({ error: 'Você já tem uma assinatura do Nitro ativa.' }, { status: 409 });
  }
  // checkout já aberto e não pago: reaproveita em vez de criar outra assinatura
  const pending = existing.find((p) => p.status === 'pending' && p.init_point);
  if (pending?.init_point) return NextResponse.json({ checkoutUrl: pending.init_point, reused: true });

  const origin = req.headers.get('origin') || process.env.NEXT_PUBLIC_SITE_URL || 'https://insight.app';
  const mpRes = await fetch('https://api.mercadopago.com/preapproval', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
      'X-Idempotency-Key': `nitro-${profile.id}-${new Date().toISOString().slice(0, 13)}-${profile.nitro_subscription_id || 'novo'}`,
    },
    body: JSON.stringify({
      reason: 'Insight Nitro — assinatura mensal',
      external_reference: `nitro:${profile.id}`,
      payer_email: user.email,
      back_url: `${origin}/nitro/assinar?retorno=1`,
      status: 'pending',
      auto_recurring: {
        frequency: 1,
        frequency_type: 'months',
        transaction_amount: NITRO_PRICE_BRL,
        currency_id: 'BRL',
      },
    }),
  });

  const data = await mpRes.json().catch(() => ({}));
  if (!mpRes.ok || !data?.init_point) {
    console.error('[Nitro checkout] Mercado Pago:', mpRes.status, data?.message);
    return NextResponse.json({ error: 'Não foi possível iniciar a assinatura.' }, { status: 502 });
  }

  return NextResponse.json({ checkoutUrl: data.init_point });
}
