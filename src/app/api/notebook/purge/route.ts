/**
 * Limpeza diária do Notebook (Cron da Vercel, Bearer CRON_SECRET).
 *  1. Apaga de vez o que está na lixeira há mais de 30 dias (notas, verbetes,
 *     fontes, trechos, categorias do Codex).
 *  2. Apaga do R2 os anexos que estão na lixeira de anexos há mais de 30 dias
 *     (original e miniatura) e remove o registro.
 */
import { NextResponse } from 'next/server';
import { DeleteObjectCommand, S3Client } from '@aws-sdk/client-s3';
import { createAdminClient } from '@/lib/supabase/admin';

export const maxDuration = 60;
const DAYS = 30;

function r2(): S3Client | null {
  const { R2_ACCOUNT_ID, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY, R2_BUCKET_NAME } = process.env;
  if (!R2_ACCOUNT_ID || !R2_ACCESS_KEY_ID || !R2_SECRET_ACCESS_KEY || !R2_BUCKET_NAME) return null;
  return new S3Client({
    region: 'auto',
    endpoint: `https://${R2_ACCOUNT_ID.trim()}.r2.cloudflarestorage.com`,
    credentials: { accessKeyId: R2_ACCESS_KEY_ID.trim(), secretAccessKey: R2_SECRET_ACCESS_KEY.trim() },
    requestChecksumCalculation: 'WHEN_REQUIRED',
  });
}

export async function GET(req: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret || req.headers.get('authorization') !== `Bearer ${secret}`) return NextResponse.json({ error: 'Sem permissão.' }, { status: 403 });
  const admin = createAdminClient();

  const { data: purged, error } = await admin.rpc('notebook_purge_trash', { p_days: DAYS });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  // anexos vencidos: tira do R2 em lotes e depois apaga os registros
  const cut = new Date(Date.now() - DAYS * 86400000).toISOString();
  const client = r2();
  let removed = 0;
  if (client) {
    for (let round = 0; round < 10; round++) {
      const { data: due } = await admin.from('notebook_assets').select('id, r2_key, preview_key').lt('deleted_at', cut).limit(500);
      if (!due?.length) break;
      const keys = due.flatMap((a) => [a.r2_key, a.preview_key].filter(Boolean) as string[]).filter((k) => k.startsWith('users/'));
      if (keys.length) {
        // um a um (o R2 recusa o checksum que o SDK põe no DeleteObjects em lote)
        const bucket = process.env.R2_BUCKET_NAME!.trim();
        for (let i = 0; i < keys.length; i += 20) await Promise.all(keys.slice(i, i + 20).map((Key) => client.send(new DeleteObjectCommand({ Bucket: bucket, Key })).catch(() => null)));
        await admin.from('media_uploads').delete().in('r2_key', keys);
      }
      await admin.from('notebook_assets').delete().in('id', due.map((a) => a.id));
      removed += due.length;
      if (due.length < 500) break;
    }
  }
  return NextResponse.json({ purged, assets_removed: removed });
}
