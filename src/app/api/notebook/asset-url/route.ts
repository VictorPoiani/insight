/**
 * Links temporários (10 min) para baixar os originais do R2 — usados pelo
 * backup .zip quando o navegador não consegue ler o arquivo pelo endereço
 * público (CORS). Só para anexos do próprio usuário.
 */
import { NextRequest, NextResponse } from 'next/server';
import { GetObjectCommand, S3Client } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { createServerSupabase } from '@/lib/supabase/server';

export const runtime = 'nodejs';
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function POST(req: NextRequest) {
  const supabase = await createServerSupabase();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Entre na sua conta.' }, { status: 401 });
  const body = (await req.json().catch(() => ({}))) as { ids?: unknown };
  const ids = (Array.isArray(body.ids) ? body.ids : []).filter((x): x is string => typeof x === 'string' && UUID.test(x)).slice(0, 200);
  if (!ids.length) return NextResponse.json({ urls: {} });
  // a RLS garante que só vêm anexos do próprio usuário
  const { data } = await supabase.from('notebook_assets').select('id, r2_key').in('id', ids);
  const { R2_ACCOUNT_ID, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY, R2_BUCKET_NAME } = process.env;
  if (!R2_ACCOUNT_ID || !R2_ACCESS_KEY_ID || !R2_SECRET_ACCESS_KEY || !R2_BUCKET_NAME) return NextResponse.json({ urls: {} });
  const r2 = new S3Client({
    region: 'auto',
    endpoint: `https://${R2_ACCOUNT_ID.trim()}.r2.cloudflarestorage.com`,
    credentials: { accessKeyId: R2_ACCESS_KEY_ID.trim(), secretAccessKey: R2_SECRET_ACCESS_KEY.trim() },
    requestChecksumCalculation: 'WHEN_REQUIRED',
  });
  const urls: Record<string, string> = {};
  for (const a of (data || []) as { id: string; r2_key: string }[]) {
    if (!a.r2_key.startsWith(`users/${user.id}/`)) continue;
    urls[a.id] = await getSignedUrl(r2, new GetObjectCommand({ Bucket: R2_BUCKET_NAME.trim(), Key: a.r2_key }), { expiresIn: 600 });
  }
  return NextResponse.json({ urls });
}
