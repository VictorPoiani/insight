import { NextRequest, NextResponse } from 'next/server';
import crypto from 'crypto';
import { createAdminClient } from '@/lib/supabase/admin';
import { accountEmailHtml, sendAccountEmail, siteUrl } from '@/lib/account/mailer';

const MAX_PER_HOUR = 3;
/** por IP: impede usar o site para disparar e-mails em massa para endereços alheios */
const MAX_PER_IP_HOUR = 10;
const GENERIC = {
  ok: true,
  message: 'Se existir uma conta com esse e-mail, enviamos um link para redefinir a senha.',
};

/**
 * Esqueci minha senha. Resposta sempre igual (não revela se o e-mail existe).
 * O link usa token_hash da Supabase e é validado em /redefinir-senha via verifyOtp.
 */
export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}));
  const email = String(body.email || '').trim().toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || email.length > 200) {
    return NextResponse.json({ error: 'Digite um e-mail válido.' }, { status: 400 });
  }

  const admin = createAdminClient();
  const emailHash = crypto.createHash('sha256').update(email).digest('hex');
  const since = new Date(Date.now() - 60 * 60 * 1000).toISOString();
  const { count } = await admin
    .from('account_email_log')
    .select('id', { count: 'exact', head: true })
    .eq('email_hash', emailHash)
    .eq('kind', 'recovery')
    .gte('sent_at', since);
  if ((count ?? 0) >= MAX_PER_HOUR) return NextResponse.json(GENERIC);

  const ip = (req.headers.get('x-real-ip') || req.headers.get('x-forwarded-for')?.split(',')[0] || '').trim();
  const ipHash = ip ? crypto.createHash('sha256').update(`ip:${ip}`).digest('hex') : null;
  if (ipHash) {
    const { count: ipCount } = await admin
      .from('account_email_log')
      .select('id', { count: 'exact', head: true })
      .eq('ip_hash', ipHash)
      .eq('kind', 'recovery')
      .gte('sent_at', since);
    if ((ipCount ?? 0) >= MAX_PER_IP_HOUR) {
      return NextResponse.json({ error: 'Muitas solicitações. Tente de novo mais tarde.' }, { status: 429 });
    }
  }
  await admin.from('account_email_log').insert({ email_hash: emailHash, kind: 'recovery', ip_hash: ipHash });

  const { data, error } = await admin.auth.admin.generateLink({ type: 'recovery', email });
  const tokenHash = data?.properties?.hashed_token;
  if (error || !tokenHash) return NextResponse.json(GENERIC); // e-mail inexistente: mesma resposta

  const link = `${siteUrl()}/redefinir-senha?token_hash=${encodeURIComponent(tokenHash)}&type=recovery`;
  await sendAccountEmail(
    email,
    'Redefinir sua senha do Insight*',
    accountEmailHtml(
      'Redefinir senha',
      'Recebemos um pedido para trocar a senha da sua conta. O link vale por 1 hora e só pode ser usado uma vez.',
      'Criar nova senha',
      link
    ),
    `Redefina sua senha do Insight*: ${link}`
  );
  return NextResponse.json(GENERIC);
}
