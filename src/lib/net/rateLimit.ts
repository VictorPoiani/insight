import { NextResponse } from 'next/server';
import { createHash } from 'node:crypto';
import { createAdminClient } from '@/lib/supabase/admin';

/** IP de quem chamou (Vercel manda em x-forwarded-for / x-real-ip). */
export function clientIp(req: Request) {
  const fwd = req.headers.get('x-forwarded-for');
  return (fwd ? fwd.split(',')[0] : req.headers.get('x-real-ip') || 'desconhecido').trim();
}

/**
 * Limite de uso por IP numa janela de tempo (contador no banco: api_rate_hit).
 * Devolve uma resposta 429 pronta quando passou do limite, ou null para seguir.
 * Se o banco falhar, deixa passar (nunca derruba a rota por causa do limitador).
 */
export async function rateLimit(req: Request, route: string, limit: number, windowSeconds = 60): Promise<NextResponse | null> {
  try {
    // o IP vai como hash: o banco não guarda IP de ninguém
    const ipHash = createHash('sha256').update(`${clientIp(req)}:${process.env.SUPABASE_SERVICE_ROLE_KEY?.slice(-8) || ''}`).digest('hex').slice(0, 24);
    const { data, error } = await createAdminClient().rpc('api_rate_hit', {
      p_bucket: `${route}:${ipHash}`,
      p_limit: limit,
      p_window_seconds: windowSeconds,
    });
    if (error || data !== false) return null;
    return NextResponse.json(
      { error: 'Muitas requisições. Tente de novo em instantes.' },
      { status: 429, headers: { 'Retry-After': String(windowSeconds) } }
    );
  } catch {
    return null;
  }
}
