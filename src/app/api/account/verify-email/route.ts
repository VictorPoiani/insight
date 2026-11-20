import { NextResponse } from 'next/server';
import crypto from 'crypto';
import { createServerSupabase } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { accountEmailHtml, sendAccountEmail, siteUrl } from '@/lib/account/mailer';

const TOKEN_TTL_MS = 24 * 60 * 60 * 1000;
const RESEND_COOLDOWN_MS = 60 * 1000;
const MAX_PER_DAY = 5;

/** Envia (ou reenvia) o link de verificação para o e-mail da conta logada. */
export async function POST() {
  const supabase = await createServerSupabase();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user?.email) return NextResponse.json({ error: 'Faça login.' }, { status: 401 });

  const admin = createAdminClient();
  const { data: prof } = await admin
    .from('profiles')
    .select('id, email_verified_at')
    .or(`user_id.eq.${user.id},id.eq.${user.id}`)
    .maybeSingle();
  if (prof?.email_verified_at) return NextResponse.json({ alreadyVerified: true });

  const now = Date.now();
  const { data: prev } = await admin
    .from('email_verifications')
    .select('sent_count, last_sent_at, window_started_at')
    .eq('user_id', user.id)
    .maybeSingle();

  let sentCount = 1;
  let windowStart = new Date(now).toISOString();
  if (prev) {
    if (now - new Date(prev.last_sent_at).getTime() < RESEND_COOLDOWN_MS) {
      return NextResponse.json({ error: 'Aguarde 1 minuto para reenviar.' }, { status: 429 });
    }
    const inWindow = now - new Date(prev.window_started_at).getTime() < 24 * 60 * 60 * 1000;
    if (inWindow && prev.sent_count >= MAX_PER_DAY) {
      return NextResponse.json({ error: 'Limite de envios de hoje atingido. Tente amanhã.' }, { status: 429 });
    }
    if (inWindow) {
      sentCount = prev.sent_count + 1;
      windowStart = prev.window_started_at;
    }
  }

  const token = crypto.randomBytes(32).toString('base64url');
  const tokenHash = crypto.createHash('sha256').update(token).digest('hex');
  await admin.from('email_verifications').upsert({
    user_id: user.id,
    token_hash: tokenHash,
    email: user.email.toLowerCase(),
    expires_at: new Date(now + TOKEN_TTL_MS).toISOString(),
    sent_count: sentCount,
    last_sent_at: new Date(now).toISOString(),
    window_started_at: windowStart,
  });

  const link = `${siteUrl()}/verificar-email?token=${token}`;
  const sent = await sendAccountEmail(
    user.email,
    'Confirme seu e-mail no Insight*',
    accountEmailHtml(
      'Confirme seu e-mail',
      'Toque no botão para verificar sua conta. O link vale por 24 horas.',
      'Verificar meu e-mail',
      link
    ),
    `Confirme seu e-mail no Insight*: ${link} (vale por 24 horas)`
  );
  if (!sent.ok) return NextResponse.json({ error: 'Não foi possível enviar o e-mail agora.' }, { status: 502 });
  return NextResponse.json({ sent: true });
}
