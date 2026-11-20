import { NextRequest, NextResponse } from 'next/server';
import crypto from 'crypto';
import { createAdminClient } from '@/lib/supabase/admin';

/** Confirma o token do link (não exige estar logado: o link pode abrir em outro aparelho). */
export async function POST(req: NextRequest) {
  const { token } = await req.json().catch(() => ({ token: '' }));
  if (typeof token !== 'string' || token.length < 20 || token.length > 100) {
    return NextResponse.json({ error: 'Link inválido.' }, { status: 400 });
  }
  const tokenHash = crypto.createHash('sha256').update(token).digest('hex');
  const admin = createAdminClient();

  const { data: row } = await admin
    .from('email_verifications')
    .select('user_id, email, expires_at')
    .eq('token_hash', tokenHash)
    .maybeSingle();
  if (!row) return NextResponse.json({ error: 'Link inválido ou já utilizado.' }, { status: 400 });
  if (new Date(row.expires_at).getTime() < Date.now()) {
    return NextResponse.json({ error: 'Este link expirou. Peça um novo nas configurações.' }, { status: 410 });
  }

  // o e-mail da conta não pode ter mudado desde o envio
  const { data: authUser } = await admin.auth.admin.getUserById(row.user_id);
  if (authUser?.user?.email?.toLowerCase() !== row.email) {
    await admin.from('email_verifications').delete().eq('user_id', row.user_id);
    return NextResponse.json({ error: 'O e-mail da conta mudou. Peça um novo link.' }, { status: 409 });
  }

  await admin
    .from('profiles')
    .update({ email_verified_at: new Date().toISOString() })
    .or(`user_id.eq.${row.user_id},id.eq.${row.user_id}`);
  await admin.from('email_verifications').delete().eq('user_id', row.user_id);

  return NextResponse.json({ verified: true });
}
