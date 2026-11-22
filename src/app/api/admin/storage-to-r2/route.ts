import { NextRequest, NextResponse } from 'next/server';
import { S3Client, PutObjectCommand, HeadObjectCommand } from '@aws-sdk/client-s3';
import { createServerSupabase } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';

export const maxDuration = 60;
export const dynamic = 'force-dynamic';

/**
 * Migração única: Supabase Storage → Cloudflare R2 (só admin).
 *
 * 1. Copia cada arquivo dos buckets antigos para o R2 em legacy/<bucket>/<caminho>
 *    (idempotente: o que já está no R2 é pulado; pode chamar várias vezes).
 * 2. Quando tudo foi copiado, troca os links no banco inteiro
 *    (rewrite_storage_urls: posts, respostas, perfis, tópicos, atualizações...).
 * 3. Com ?apagar=1&confirmar=SIM, apaga os originais do Supabase — só depois do passo 2.
 *
 * Abra no navegador logado como admin: GET /api/admin/storage-to-r2
 */
const BUCKETS = ['posts', 'avatar', 'cover', 'updates'];

function r2() {
  return new S3Client({
    region: 'auto',
    requestChecksumCalculation: 'WHEN_REQUIRED',
    endpoint: `https://${process.env.R2_ACCOUNT_ID!.trim()}.r2.cloudflarestorage.com`,
    credentials: {
      accessKeyId: process.env.R2_ACCESS_KEY_ID!.trim(),
      secretAccessKey: process.env.R2_SECRET_ACCESS_KEY!.trim(),
    },
  });
}

async function listAll(admin: ReturnType<typeof createAdminClient>, bucket: string, prefix = ''): Promise<string[]> {
  const out: string[] = [];
  for (let offset = 0; ; offset += 1000) {
    const { data, error } = await admin.storage.from(bucket).list(prefix, { limit: 1000, offset });
    if (error || !data?.length) break;
    for (const entry of data) {
      const path = prefix ? `${prefix}/${entry.name}` : entry.name;
      if (entry.id === null) out.push(...(await listAll(admin, bucket, path))); // pasta
      else out.push(path);
    }
    if (data.length < 1000) break;
  }
  return out;
}

export async function POST(req: NextRequest) {
  const supabase = await createServerSupabase();
  const { data: isAdmin } = await supabase.rpc('is_insight_admin');
  if (!isAdmin) return NextResponse.json({ error: 'Não autorizado.' }, { status: 401 });

  const needed = ['R2_ACCOUNT_ID', 'R2_ACCESS_KEY_ID', 'R2_SECRET_ACCESS_KEY', 'R2_BUCKET_NAME', 'NEXT_PUBLIC_R2_PUBLIC_URL'];
  const missing = needed.filter((k) => !process.env[k]);
  if (missing.length) return NextResponse.json({ error: `Faltam variáveis: ${missing.join(', ')}` }, { status: 500 });

  const remove = req.nextUrl.searchParams.get('apagar') === '1' && req.nextUrl.searchParams.get('confirmar') === 'SIM';
  const admin = createAdminClient();
  const client = r2();
  const bucketName = process.env.R2_BUCKET_NAME!.trim();
  const started = Date.now();
  const report = { copied: 0, skipped: 0, failed: [] as string[], pending: 0, rewritten: null as unknown, deleted: 0 };

  const files: { bucket: string; path: string }[] = [];
  for (const b of BUCKETS) for (const path of await listAll(admin, b)) files.push({ bucket: b, path });

  let i = 0;
  const worker = async () => {
    while (i < files.length) {
      if (Date.now() - started > 45_000) return; // deixa tempo para responder; chame de novo
      const { bucket, path } = files[i++];
      const key = `legacy/${bucket}/${path}`;
      try {
        const exists = await client
          .send(new HeadObjectCommand({ Bucket: bucketName, Key: key }))
          .then(() => true)
          .catch(() => false);
        if (exists) {
          report.skipped++;
          continue;
        }
        const { data, error } = await admin.storage.from(bucket).download(path);
        if (error || !data) throw new Error(error?.message || 'download');
        const body = new Uint8Array(await data.arrayBuffer());
        await client.send(
          new PutObjectCommand({
            Bucket: bucketName,
            Key: key,
            Body: body,
            ContentType: data.type || 'application/octet-stream',
            CacheControl: 'public, max-age=31536000, immutable',
          })
        );
        report.copied++;
      } catch (err) {
        report.failed.push(`${bucket}/${path}: ${err instanceof Error ? err.message : 'erro'}`);
      }
    }
  };
  await Promise.all(Array.from({ length: 4 }, worker));
  report.pending = files.length - i;

  // Só troca os links quando todos os arquivos estão no R2
  if (report.pending === 0 && report.failed.length === 0) {
    const oldPrefix = `${process.env.NEXT_PUBLIC_SUPABASE_URL!.replace(/\/$/, '')}/storage/v1/object/public/`;
    const newPrefix = `${process.env.NEXT_PUBLIC_R2_PUBLIC_URL!.replace(/\/$/, '')}/legacy/`;
    const { data, error } = await admin.rpc('rewrite_storage_urls', { p_old: oldPrefix, p_new: newPrefix });
    report.rewritten = error ? `erro: ${error.message}` : data;

    if (!error && remove) {
      for (const b of BUCKETS) {
        const paths = files.filter((f) => f.bucket === b).map((f) => f.path);
        for (let k = 0; k < paths.length; k += 100) {
          const { data: del } = await admin.storage.from(b).remove(paths.slice(k, k + 100));
          report.deleted += del?.length ?? 0;
        }
      }
    }
  }

  return NextResponse.json({ total: files.length, ...report, ms: Date.now() - started });
}

// também pelo navegador (só admin; é idempotente)
export const GET = POST;
