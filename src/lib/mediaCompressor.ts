'use client';

import { FFmpeg } from '@ffmpeg/ffmpeg';
import { fetchFile, toBlobURL } from '@ffmpeg/util';
import { createClient } from '@/lib/supabase/client';

let ffmpegInstance: FFmpeg | null = null;

async function getFFmpegInstance(onProgress?: (pct: number) => void): Promise<FFmpeg> {
  if (ffmpegInstance && ffmpegInstance.loaded) {
    return ffmpegInstance;
  }

  const ffmpeg = new FFmpeg();

  if (onProgress) {
    ffmpeg.on('progress', ({ progress }) => {
      const clamped = Math.max(5, Math.min(95, Math.round(progress * 100)));
      onProgress(clamped);
    });
  }

  // Usa o core single-thread para não exigir headers COOP/COEP que bloqueiam o player do Spotify
  const baseURL = 'https://unpkg.com/@ffmpeg/core@0.12.6/dist/umd';
  await ffmpeg.load({
    coreURL: await toBlobURL(`${baseURL}/ffmpeg-core.js`, 'text/javascript'),
    wasmURL: await toBlobURL(`${baseURL}/ffmpeg-core.wasm`, 'application/wasm'),
  });

  ffmpegInstance = ffmpeg;
  return ffmpeg;
}

export interface CompressedMediaResult {
  file: File;
  originalSize: number;
  compressedSize: number;
  isGif: boolean;
  savedPercent: number;
}

/**
 * Compacta vídeos para MP4 (H.264, máx 720p, 30fps, CRF 28)
 * e converte GIFs pesados (> 1.5MB) em MP4 silencioso em loop.
 */
export async function compressMediaForInsight(
  inputFile: File,
  forceGifLoop: boolean = false,
  onStatus?: (label: string, pct: number) => void
): Promise<CompressedMediaResult> {
  const originalSize = inputFile.size;
  const isGifInput =
    inputFile.type === 'image/gif' || inputFile.name.toLowerCase().endsWith('.gif');
  const isGifMode = isGifInput || forceGifLoop;

  // Se o arquivo já for muito leve (<= 1.5 MB), não gasta tempo re-encodando
  if (originalSize <= 1.5 * 1024 * 1024) {
    onStatus?.('Arquivo já otimizado!', 100);
    return {
      file: inputFile,
      originalSize,
      compressedSize: originalSize,
      isGif: isGifMode,
      savedPercent: 0,
    };
  }

  try {
    onStatus?.('Iniciando compressor de vídeo...', 8);
    const ffmpeg = await getFFmpegInstance((pct) => {
      onStatus?.(`Compactando vídeo (${pct}%)...`, pct);
    });

    const ext = isGifInput ? 'gif' : 'mp4';
    const inputName = `input_${Date.now()}.${ext}`;
    const outputName = `output_${Date.now()}.mp4`;

    await ffmpeg.writeFile(inputName, await fetchFile(inputFile));

    if (isGifMode) {
      // Converte GIF pesado ou vídeo curto em MP4 sem áudio para loop infinito super leve
      await ffmpeg.exec([
        '-i',
        inputName,
        '-movflags',
        '+faststart',
        '-pix_fmt',
        'yuv420p',
        '-vf',
        "scale='min(960,iw)':-2,fps=20",
        '-c:v',
        'libx264',
        '-crf',
        '27',
        '-preset',
        'veryfast',
        '-an',
        outputName,
      ]);
    } else {
      // Compressão de vídeo padrão: máx 1280px (720p), 30fps, CRF 28, áudio AAC 96kbps
      await ffmpeg.exec([
        '-i',
        inputName,
        '-vf',
        "scale='min(1280,iw)':-2,fps=30",
        '-c:v',
        'libx264',
        '-crf',
        '28',
        '-preset',
        'veryfast',
        '-c:a',
        'aac',
        '-b:a',
        '96k',
        '-movflags',
        '+faststart',
        outputName,
      ]);
    }

    const data = await ffmpeg.readFile(outputName);
    const safeBytes =
      data instanceof Uint8Array
        ? new Uint8Array(data)
        : new TextEncoder().encode(String(data));
    const blob = new Blob([safeBytes], { type: 'video/mp4' });

    const baseName = inputFile.name.replace(/\.[^/.]+$/, '');
    const outFile = new File([blob], `${baseName}-insight.mp4`, { type: 'video/mp4' });

    await ffmpeg.deleteFile(inputName).catch(() => {});
    await ffmpeg.deleteFile(outputName).catch(() => {});

    // Se o vídeo original já estava mais leve que o resultado, mantém o original
    if (!isGifInput && outFile.size >= originalSize) {
      return {
        file: inputFile,
        originalSize,
        compressedSize: originalSize,
        isGif: isGifMode,
        savedPercent: 0,
      };
    }

    const savedPercent = Math.max(
      0,
      Math.round(((originalSize - outFile.size) / originalSize) * 100)
    );

    return {
      file: outFile,
      originalSize,
      compressedSize: outFile.size,
      isGif: isGifMode,
      savedPercent,
    };
  } catch (err) {
    console.warn('[Compressor Fallback]: enviando arquivo original.', err);
    return {
      file: inputFile,
      originalSize,
      compressedSize: originalSize,
      isGif: isGifMode,
      savedPercent: 0,
    };
  }
}

export interface UploadR2Result {
  publicUrl: string;
  r2Key: string | null;
  isGif: boolean;
  originalSize: number;
  compressedSize: number;
  savedPercent: number;
}

/* Compacta o vídeo e faz o upload direto para a Cloudflare */
export async function uploadCompressedMediaToR2(
  rawFile: File,
  authorId: string,
  forceGifLoop: boolean = false,
  onStatus?: (label: string, pct: number) => void
): Promise<UploadR2Result> {
  // 1. Compacta o vídeo ou GIF no navegador
  const compressed = await compressMediaForInsight(rawFile, forceGifLoop, onStatus);

  // Limite máximo de segurança pós-compressão: 25 MB
  const MAX_COMPRESSED_BYTES = 25 * 1024 * 1024;
  if (compressed.compressedSize > MAX_COMPRESSED_BYTES) {
    throw new Error(
      `Mesmo compactado, o vídeo ficou com ${(
        compressed.compressedSize /
        (1024 * 1024)
      ).toFixed(1)}MB (máximo permitido: 25MB). Tente um vídeo mais curto.`
    );
  }

  onStatus?.('Conectando à Cloudflare R2...', 96);

  const presignRes = await fetch('/api/upload/r2', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      fileName: compressed.file.name,
      contentType: compressed.file.type || 'video/mp4',
      originalSize: compressed.originalSize,
      compressedSize: compressed.compressedSize,
      userId: authorId,
      isGif: compressed.isGif,
    }),
  });

  const presignData = await presignRes.json();

  if (presignRes.ok && presignData.uploadUrl) {
    onStatus?.('Enviando para Cloudflare R2...', 98);
    const putRes = await fetch(presignData.uploadUrl, {
      method: 'PUT',
      headers: {
        'Content-Type': compressed.file.type || 'video/mp4',
      },
      body: compressed.file,
    });

    if (!putRes.ok) {
      throw new Error(
        'Falha ao enviar para a Cloudflare R2. Verifique a regra de CORS do seu bucket.'
      );
    }

    onStatus?.('Concluído!', 100);
    return {
      publicUrl: presignData.publicUrl,
      r2Key: presignData.r2Key,
      isGif: compressed.isGif,
      originalSize: compressed.originalSize,
      compressedSize: compressed.compressedSize,
      savedPercent: compressed.savedPercent,
    };
  }


  if (presignData?.fallbackToSupabase) {
    onStatus?.('Subindo vídeo compactado...', 98);
    const supabase = createClient();
    const ext = compressed.file.name.split('.').pop() || 'mp4';
    const fileName = `${authorId}/videos/${Date.now()}-${Math.random()
      .toString(36)
      .slice(2, 6)}.${ext}`;

    const { error } = await supabase.storage
      .from('posts')
      .upload(fileName, compressed.file);

    if (error) {
      throw new Error('Erro ao salvar vídeo: ' + error.message);
    }

    const { data: pubData } = supabase.storage.from('posts').getPublicUrl(fileName);
    onStatus?.('Concluído!', 100);

    return {
      publicUrl: pubData.publicUrl,
      r2Key: null,
      isGif: compressed.isGif,
      originalSize: compressed.originalSize,
      compressedSize: compressed.compressedSize,
      savedPercent: compressed.savedPercent,
    };
  }

  throw new Error(presignData?.error || 'Erro ao gerar link de upload na Cloudflare.');
}