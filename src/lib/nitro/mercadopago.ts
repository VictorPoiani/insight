import { NITRO_PRICE_BRL } from './entitlement';
/**
 * Insight Nitro × Mercado Pago (só no servidor: usa MERCADOPAGO_ACCESS_TOKEN).
 *
 * - Assinatura = preapproval com external_reference "nitro:<profile_id>".
 * - Nível 5: a assinatura é cancelada e a última mensalidade reembolsada
 *   (fila public.nitro_level5_refunds, preenchida por trigger no banco).
 */
import type { SupabaseClient } from '@supabase/supabase-js';

const MP = 'https://api.mercadopago.com';

function headers(token: string, idem?: string): HeadersInit {
  return {
    Authorization: `Bearer ${token}`,
    'Content-Type': 'application/json',
    ...(idem ? { 'X-Idempotency-Key': idem } : {}),
  };
}

export interface MpPreapproval {
  id: string;
  status: 'pending' | 'authorized' | 'paused' | 'cancelled' | string;
  init_point?: string;
  external_reference?: string;
  next_payment_date?: string;
  date_created?: string;
  auto_recurring?: { transaction_amount?: number };
}

/** Assinaturas Nitro deste perfil no Mercado Pago (mais novas primeiro). */
export async function findNitroPreapprovals(token: string, profileId: string): Promise<MpPreapproval[]> {
  const url = `${MP}/preapproval/search?external_reference=${encodeURIComponent(`nitro:${profileId}`)}&limit=20`;
  const res = await fetch(url, { headers: headers(token), cache: 'no-store' });
  if (!res.ok) return [];
  const data = await res.json().catch(() => ({}));
  const list: MpPreapproval[] = Array.isArray(data?.results) ? data.results : [];
  return list
    .filter((p) => p.external_reference === `nitro:${profileId}`)
    .sort((a, b) => String(b.date_created || '').localeCompare(String(a.date_created || '')));
}

/** Tolerância depois da data da próxima cobrança. */
export const NITRO_GRACE_MS = 3 * 24 * 60 * 60 * 1000;

/** Campos do perfil a partir de uma assinatura do Mercado Pago (sempre com validade). */
export function profileFieldsFromPreapproval(pre: MpPreapproval): Record<string, unknown> | null {
  const map: Record<string, string> = { authorized: 'active', paused: 'past_due', cancelled: 'canceled' };
  const status = map[pre.status];
  if (!status) return null;
  // Defesa extra: só libera se a assinatura for do valor e moeda do Nitro
  // (o preço vem do servidor; nunca de algo que o cliente possa alterar).
  if (status === 'active') {
    const ar = (pre as { auto_recurring?: { transaction_amount?: number; currency_id?: string } }).auto_recurring;
    if (ar?.currency_id && ar.currency_id !== 'BRL') return null;
    if (ar?.transaction_amount != null && Number(ar.transaction_amount) + 0.001 < NITRO_PRICE_BRL) return null;
  }
  const out: Record<string, unknown> = { nitro_status: status, nitro_subscription_id: String(pre.id) };
  if (status === 'active') {
    const next = pre.next_payment_date ? new Date(pre.next_payment_date).getTime() : NaN;
    // sem data da próxima cobrança: 1 mês a partir de agora (o webhook corrige depois)
    const base = Number.isFinite(next) && next > Date.now() ? next : Date.now() + 30 * 24 * 60 * 60 * 1000;
    out.nitro_expires_at = new Date(base + NITRO_GRACE_MS).toISOString();
  }
  return out;
}

/**
 * Sincroniza o Nitro de um perfil consultando o Mercado Pago direto
 * (não depende do webhook). Usa a assinatura viva mais recente.
 */
export async function syncNitroForProfile(admin: SupabaseClient, token: string, profileId: string) {
  const subs = await findNitroPreapprovals(token, profileId);
  const pick = subs.find((p) => p.status === 'authorized') || subs.find((p) => p.status === 'paused') || subs.find((p) => p.status === 'cancelled');
  if (!pick) return { synced: false as const, status: 'none' };
  const fields = profileFieldsFromPreapproval(pick);
  if (!fields) return { synced: false as const, status: pick.status };
  // cancelada: não apaga a validade do período já pago
  await admin.from('profiles').update(fields).eq('id', profileId);
  return { synced: true as const, status: String(fields.nitro_status) };
}

export async function cancelPreapproval(token: string, id: string): Promise<boolean> {
  const res = await fetch(`${MP}/preapproval/${encodeURIComponent(id)}`, {
    method: 'PUT',
    headers: headers(token),
    body: JSON.stringify({ status: 'cancelled' }),
  });
  return res.ok;
}

/** Última mensalidade aprovada de uma assinatura (id e valor). */
async function latestApprovedPayment(
  token: string,
  preapprovalId: string,
  profileId: string
): Promise<{ id: string; amount: number } | null> {
  // 1) faturas da assinatura
  try {
    const res = await fetch(`${MP}/authorized_payments/search?preapproval_id=${encodeURIComponent(preapprovalId)}`, {
      headers: headers(token),
      cache: 'no-store',
    });
    if (res.ok) {
      const data = await res.json();
      const list: any[] = Array.isArray(data?.results) ? data.results : [];
      const paid = list
        .filter((r) => r?.payment?.id && (r.payment.status === 'approved' || r.status === 'processed'))
        .sort((a, b) => String(b.date_created || b.debit_date || '').localeCompare(String(a.date_created || a.debit_date || '')));
      if (paid[0]) return { id: String(paid[0].payment.id), amount: Number(paid[0].transaction_amount) || 0 };
    }
  } catch {
    /* tenta o próximo caminho */
  }
  // 2) busca de pagamentos pela referência
  try {
    const res = await fetch(
      `${MP}/v1/payments/search?external_reference=${encodeURIComponent(`nitro:${profileId}`)}&status=approved&sort=date_created&criteria=desc&limit=5`,
      { headers: headers(token), cache: 'no-store' }
    );
    if (res.ok) {
      const data = await res.json();
      const p = (Array.isArray(data?.results) ? data.results : [])[0];
      if (p?.id) return { id: String(p.id), amount: Number(p.transaction_amount) || 0 };
    }
  } catch {
    /* sem pagamento encontrado */
  }
  return null;
}

async function refundPayment(token: string, paymentId: string, idem: string): Promise<boolean> {
  const res = await fetch(`${MP}/v1/payments/${encodeURIComponent(paymentId)}/refunds`, {
    method: 'POST',
    headers: headers(token, idem),
    body: JSON.stringify({}),
  });
  // 400 com "already refunded" também conta como feito
  if (res.ok) return true;
  const body = await res.text().catch(() => '');
  return /refund|already/i.test(body) && res.status === 400;
}

/**
 * Processa a fila do Nível 5: cancela a assinatura e reembolsa a última
 * mensalidade. Idempotente (chave por perfil+assinatura) e com até 5 tentativas.
 */
export async function processLevel5Refunds(admin: SupabaseClient, token: string, onlyProfileId?: string) {
  let q = admin
    .from('nitro_level5_refunds')
    .select('id, profile_id, subscription_id, attempts')
    .eq('status', 'pending')
    .lt('attempts', 5)
    .order('requested_at', { ascending: true })
    .limit(5);
  if (onlyProfileId) q = q.eq('profile_id', onlyProfileId);
  const { data: rows } = await q;
  const results: { profileId: string; status: string }[] = [];

  for (const row of rows || []) {
    try {
      await admin.from('nitro_level5_refunds').update({ attempts: row.attempts + 1 }).eq('id', row.id);
      await cancelPreapproval(token, row.subscription_id);
      const pay = await latestApprovedPayment(token, row.subscription_id, row.profile_id);
      let status: 'refunded' | 'canceled_no_payment' = 'canceled_no_payment';
      if (pay) {
        const ok = await refundPayment(token, pay.id, `nitro-l5-${row.profile_id}-${pay.id}`);
        if (!ok) throw new Error(`refund_failed ${pay.id}`);
        status = 'refunded';
      }
      await admin
        .from('nitro_level5_refunds')
        .update({
          status,
          processed_at: new Date().toISOString(),
          refunded_payment_id: pay?.id ?? null,
          amount: pay?.amount ?? null,
          last_error: null,
        })
        .eq('id', row.id);
      // assinatura encerrada; o Nível 5 já garante o Nitro vitalício
      await admin.from('profiles').update({ nitro_status: 'canceled', has_lifetime_nitro: true }).eq('id', row.profile_id);

      const valor = pay?.amount ? ` A mensalidade de R$ ${pay.amount.toFixed(2).replace('.', ',')} foi reembolsada.` : '';
      const text = `Você chegou ao Nível 5 — Grão-Mestre! Seu Insight Nitro agora é vitalício e a assinatura foi encerrada.${valor}`;
      await admin
        .from('notifications')
        .insert({ recipient_id: row.profile_id, actor_id: row.profile_id, type: 'system', content_preview: text, message: text })
        .then(() => undefined, () => undefined);
      results.push({ profileId: row.profile_id, status });
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      await admin
        .from('nitro_level5_refunds')
        .update({ last_error: msg.slice(0, 500), status: row.attempts + 1 >= 5 ? 'error' : 'pending' })
        .eq('id', row.id);
      results.push({ profileId: row.profile_id, status: 'error' });
    }
  }
  return results;
}
