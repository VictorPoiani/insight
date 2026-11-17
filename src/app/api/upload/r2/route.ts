import { NextRequest, NextResponse } from 'next/server';
import { S3Client, PutObjectCommand, DeleteObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';

const MAX_ALLOWED_SIZE_BYTES = 25 * 1024 * 1024; // 25 MB pós-compressão

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
    endpoint: `https://${process.env.R2_ACCOUNT_ID!.trim()}.r2.cloudflarestorage.com`,
    credentials: {
      accessKeyId: process.env.R2_ACCESS_KEY_ID!.trim(),
      secretAccessKey: process.env.R2_SECRET_ACCESS_KEY!.trim(),
    },
  });
}

// Rota GET para você testar no navegador (http://localhost:3000/api/upload/r2)
export async function GET() {
  const configured = isR2Configured();
  return NextResponse.json({
    status: 'API Cloudflare R2 Online',
    r2Configured: configured,
    bucket: process.env.R2_BUCKET_NAME || null,
    publicUrl: process.env.NEXT_PUBLIC_R2_PUBLIC_URL || null,
  });
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { fileName, contentType, compressedSize, isGif } = body;

    if (!fileName || !contentType) {
      return NextResponse.json(
        { error: 'Parâmetros de arquivo inválidos.' },
        { status: 400 }
      );
    }

    if (Number(compressedSize) > MAX_ALLOWED_SIZE_BYTES) {
      return NextResponse.json(
        { error: 'O vídeo excede o limite de 25MB mesmo após a compactação.' },
        { status: 413 }
      );
    }

    // Se as chaves da Cloudflare ainda não estiverem no .env.local, avisa o front para usar o fallback
    if (!isR2Configured()) {
      return NextResponse.json({ fallbackToSupabase: true }, { status: 200 });
    }

    const r2 = getR2Client();
    const folder = isGif ? 'gifs' : 'videos';
    const yearMonth = new Date().toISOString().slice(0, 7);
    const cleanName = String(fileName).replace(/[^a-zA-Z0-9._-]/g, '_');
    const r2Key = `${folder}/${yearMonth}/${crypto.randomUUID()}-${cleanName}`;

    const command = new PutObjectCommand({
      Bucket: process.env.R2_BUCKET_NAME!.trim(),
      Key: r2Key,
      ContentType: contentType,
    });

    // Gera URL assinada válida por 5 minutos para upload direto do navegador
    const uploadUrl = await getSignedUrl(r2, command, { expiresIn: 300 });
    const basePublicUrl = process.env.NEXT_PUBLIC_R2_PUBLIC_URL!.trim().replace(/\/$/, '');
    const publicUrl = `${basePublicUrl}/${r2Key}`;

    return NextResponse.json({
      uploadUrl,
      publicUrl,
      r2Key,
    });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Erro interno ao assinar URL R2';
    console.error('[Erro API Cloudflare R2]:', msg);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const { r2Key } = await req.json();
    if (!r2Key || !isR2Configured()) {
      return NextResponse.json({ deleted: false });
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