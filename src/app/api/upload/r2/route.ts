import { NextRequest, NextResponse } from 'next/server';
import {
  S3Client,
  PutObjectCommand,
  DeleteObjectCommand,
  CreateMultipartUploadCommand,
  UploadPartCommand,
  CompleteMultipartUploadCommand,
  AbortMultipartUploadCommand,
  HeadObjectCommand,
} from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { createServerSupabase } from '@/lib/supabase/server';
import { formatBytes, getUserUploadLimitBytes, MB } from '@/lib/contributorLevels';
import { NOTEBOOK_NAME } from '@/lib/notebook/copy';

/**
 * Upload direto ao Cloudflare R2.
 *
 * A cota de anexos é do Nível de Contribuinte e vale para o tamanho FINAL
 * (pós-compressão). Garantias no servidor:
 *  1. register_media_upload() (Supabase) recusa arquivos acima do limite do
 *     nível e grava o tamanho exato de cada objeto;
 *  2. a URL pré-assinada amarra Content-Length (e Content-Type): o R2 recusa
 *     um corpo de outro tamanho;
 *  3. o trigger posts_media_quota soma o peso real das mídias referenciadas no
 *     post ao salvar e recusa se passar do limite.
 */

const MULTIPART_THRESHOLD = 100 * MB;
const MIN_PART = 16 * MB;
const MAX_PARTS = 10_000;

/** Tipos servidos inline; o resto vira download (evita HTML/JS ativo no domínio da CDN). */
const INLINE_TYPES = /^(image\/(png|jpe?g|webp|gif|avif)|video\/(mp4|webm|quicktime)|audio\/(mpeg|mp4|ogg|wav|webm)|application\/pdf)$/;

function isR2Configured(): boolean {
  return Boolean(
    process.env.R2_ACCOUNT_ID &&
      process.env.R2_ACCESS_KEY_ID &&
      process.env.R2_SECRET_ACCESS_KEY &&
      process.env.R2_BUCKET_NAME &&
      process.env.NEXT_PUBLIC_R2_PUBLIC_URL
  );
}

function getR2Client(): S3Client {
  return new S3Client({
    region: 'auto',
    // sem checksum automático do corpo vazio na URL pré-assinada
    requestChecksumCalculation: 'WHEN_REQUIRED',
    endpoint: `https://${process.env.R2_ACCOUNT_ID!.trim()}.r2.cloudflarestorage.com`,
    credentials: {
      accessKeyId: process.env.R2_ACCESS_KEY_ID!.trim(),
      secretAccessKey: process.env.R2_SECRET_ACCESS_KEY!.trim(),
    },
  });
}

const bucket = () => process.env.R2_BUCKET_NAME!.trim();
const publicUrlFor = (key: string) =>
  `${process.env.NEXT_PUBLIC_R2_PUBLIC_URL!.trim().replace(/\/$/, '')}/${key}`;

export async function GET() {
  const configured = isR2Configured();
  return NextResponse.json({
    status: 'API Cloudflare R2 Online',
    r2Configured: configured,
    bucket: process.env.R2_BUCKET_NAME || null,
    publicUrl: process.env.NEXT_PUBLIC_R2_PUBLIC_URL || null,
  });
}

function quotaMessage(limit: number) {
  return `O arquivo passa do limite de anexos do seu nível (${formatBytes(limit)} por post, após compressão).`;
}

export async function POST(req: NextRequest) {
  try {
    const supabase = await createServerSupabase();
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json(
        { error: 'Acesso negado. Faça login para enviar arquivos.' },
        { status: 401 }
      );
    }

    const body = await req.json();
    const action: string = body.action || 'single';

    // ------------------------------------------------ finalizar multipart
    if (action === 'multipart-complete' || action === 'multipart-abort') {
      const r2Key = String(body.r2Key || '');
      const uploadId = String(body.uploadId || '');
      if (!r2Key.startsWith(`users/${user.id}/`) || !uploadId || !isR2Configured()) {
        return NextResponse.json({ error: 'Upload inválido.' }, { status: 400 });
      }
      const r2 = getR2Client();
      if (action === 'multipart-abort') {
        await r2.send(new AbortMultipartUploadCommand({ Bucket: bucket(), Key: r2Key, UploadId: uploadId })).catch(() => {});
        return NextResponse.json({ aborted: true });
      }

      const { data: reg } = await supabase
        .from('media_uploads')
        .select('size_bytes')
        .eq('r2_key', r2Key)
        .maybeSingle();
      if (!reg) return NextResponse.json({ error: 'Upload não registrado.' }, { status: 400 });

      const parts = Array.isArray(body.parts) ? body.parts : [];
      await r2.send(
        new CompleteMultipartUploadCommand({
          Bucket: bucket(),
          Key: r2Key,
          UploadId: uploadId,
          MultipartUpload: {
            Parts: parts.map((p: { PartNumber: number; ETag: string }) => ({
              PartNumber: Number(p.PartNumber),
              ETag: String(p.ETag),
            })),
          },
        })
      );

      // confere o tamanho real gravado no bucket
      const head = await r2.send(new HeadObjectCommand({ Bucket: bucket(), Key: r2Key }));
      if (Number(head.ContentLength) !== Number(reg.size_bytes)) {
        await r2.send(new DeleteObjectCommand({ Bucket: bucket(), Key: r2Key })).catch(() => {});
        return NextResponse.json({ error: 'Tamanho enviado não confere com o registrado.' }, { status: 422 });
      }
      return NextResponse.json({ completed: true, publicUrl: publicUrlFor(r2Key), r2Key });
    }

    // ------------------------------------------------ novo upload
    const { fileName, contentType, isGif } = body;
    // My Notebook: pasta própria no bucket, só para quem tem acesso ao notebook
    const scope = body.scope === 'notebook' ? 'notebook' : 'posts';
    if (scope === 'notebook') {
      const { data: allowed } = await supabase.rpc('notebook_has_access');
      if (!allowed) {
        return NextResponse.json({ error: `O ${NOTEBOOK_NAME} ainda não está liberado para a sua conta.` }, { status: 403 });
      }
    }
    const size = Math.floor(Number(body.compressedSize));
    const originalSize = Math.floor(Number(body.originalSize)) || null;

    if (!fileName || !contentType || !Number.isFinite(size) || size <= 0) {
      return NextResponse.json({ error: 'Parâmetros de arquivo inválidos.' }, { status: 400 });
    }

    // Limite do nível real (lido no banco, não no cliente)
    const { data: prof } = await supabase
      .from('profiles')
      .select('contributor_level, role')
      .or(`user_id.eq.${user.id},id.eq.${user.id}`)
      .maybeSingle();
    const limit = getUserUploadLimitBytes(prof?.contributor_level ?? 0, prof?.role);
    if (size > limit) {
      return NextResponse.json({ error: quotaMessage(limit), limit }, { status: 413 });
    }

    if (!isR2Configured()) {
      console.error('[upload] Cloudflare R2 não configurado (variáveis R2_* ausentes)');
      return NextResponse.json({ error: 'Armazenamento indisponível no momento. Tente de novo mais tarde.' }, { status: 503 });
    }

    const type = String(contentType).toLowerCase();
    const servedType = INLINE_TYPES.test(type) ? type : 'application/octet-stream';
    const folder = isGif
      ? 'gifs'
      : type.startsWith('video/')
        ? 'videos'
        : type.startsWith('image/')
          ? 'images'
          : 'files';
    const yearMonth = new Date().toISOString().slice(0, 7);
    const cleanName = String(fileName).replace(/[^a-zA-Z0-9._-]/g, '_').slice(-120);
    // Notebook: users/{uid}/notebook/p/{projeto}/{anexo}/{original|preview}/{nome}
    const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    const asset = body.asset as { project?: string | null; id?: string; variant?: string } | undefined;
    const r2Key =
      scope === 'notebook' && asset && typeof asset.id === 'string' && UUID_RE.test(asset.id)
        ? `users/${user.id}/notebook/${asset.project && UUID_RE.test(asset.project) ? `p/${asset.project.toLowerCase()}` : 'inbox'}/${asset.id.toLowerCase()}/${asset.variant === 'preview' ? 'preview' : 'original'}/${cleanName}`
        : `users/${user.id}/${scope === 'notebook' ? 'notebook/' : ''}${folder}/${yearMonth}/${crypto.randomUUID()}-${cleanName}`;

    // registra ANTES de assinar: o banco valida o limite de novo e guarda o tamanho exato
    const { error: regError } = await supabase.rpc('register_media_upload', {
      p_r2_key: r2Key,
      p_size: size,
      p_content_type: servedType,
      p_original: originalSize,
    });
    if (regError) {
      const quota = regError.message.includes('post_media_quota_exceeded');
      return NextResponse.json(
        { error: quota ? quotaMessage(limit) : 'Não foi possível registrar o upload.' },
        { status: quota ? 413 : 500 }
      );
    }

    const r2 = getR2Client();
    const sign = { expiresIn: 3600, signableHeaders: new Set(['content-type', 'content-length']) };

    if (action === 'multipart-create' || size > MULTIPART_THRESHOLD) {
      const partSize = Math.max(MIN_PART, Math.ceil(size / MAX_PARTS));
      const created = await r2.send(
        new CreateMultipartUploadCommand({
          Bucket: bucket(),
          Key: r2Key,
          ContentType: servedType,
        })
      );
      const uploadId = created.UploadId!;
      const parts = [];
      for (let start = 0, n = 1; start < size; start += partSize, n++) {
        const end = Math.min(size, start + partSize);
        const url = await getSignedUrl(
          r2,
          new UploadPartCommand({ Bucket: bucket(), Key: r2Key, UploadId: uploadId, PartNumber: n, ContentLength: end - start }),
          { expiresIn: 3 * 3600 }
        );
        parts.push({ partNumber: n, url, start, end });
      }
      return NextResponse.json({ mode: 'multipart', uploadId, parts, r2Key, publicUrl: publicUrlFor(r2Key), limit });
    }

    const uploadUrl = await getSignedUrl(
      r2,
      new PutObjectCommand({
        Bucket: bucket(),
        Key: r2Key,
        ContentType: servedType,
        ContentLength: size,
      }),
      sign
    );

    return NextResponse.json({
      mode: 'single',
      uploadUrl,
      contentType: servedType,
      publicUrl: publicUrlFor(r2Key),
      r2Key,
      limit,
    });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Erro interno ao assinar URL R2';
    console.error('[Erro API Cloudflare R2]:', msg);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const supabase = await createServerSupabase();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: 'Não autorizado.' }, { status: 401 });
    }

    const { r2Key } = await req.json();
    if (!r2Key || !isR2Configured()) {
      return NextResponse.json({ deleted: false });
    }

    // Só permite apagar se o arquivo pertencer à pasta do próprio usuário ou se for Staff/Admin
    const isOwnFile = String(r2Key).startsWith(`users/${user.id}/`);
    if (!isOwnFile) {
      const { data: prof } = await supabase
        .from('profiles')
        .select('role')
        .or(`user_id.eq.${user.id},id.eq.${user.id}`)
        .maybeSingle();

      const isStaff = prof?.role === 'admin' || prof?.role === 'moderator';
      if (!isStaff) {
        return NextResponse.json(
          { error: 'Sem permissão para remover este arquivo.' },
          { status: 403 }
        );
      }
    }

    const r2 = getR2Client();
    await r2.send(
      new DeleteObjectCommand({
        Bucket: process.env.R2_BUCKET_NAME!.trim(),
        Key: r2Key,
      })
    );

    return NextResponse.json({ deleted: true });
  } catch {
    return NextResponse.json({ error: 'Falha ao remover do R2' }, { status: 500 });
  }
}