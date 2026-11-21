'use client';

/**
 * Pipeline de mídia do Insight*: compressão no navegador → upload direto ao
 * Cloudflare R2 (URL pré-assinada; multipart acima de 100 MB).
 *
 * A cota dos Níveis de Contribuinte vale para o tamanho FINAL enviado ao R2
 * (`compressedSize`), somado por post. O servidor (/api/upload/r2 + trigger
 * posts_media_quota) confere de novo — este arquivo só evita trabalho inútil.
 *
 * Limites do ffmpeg.wasm (core 0.12 single-thread, sem SharedArrayBuffer):
 *  - memória: heap wasm32 ≤ ~2 GB; a SAÍDA fica inteira em MEMFS e é copiada
 *    mais uma vez no readFile. A ENTRADA é montada via WORKERFS (lida sob
 *    demanda do File, sem cópia).
 *  - velocidade: x264 em 1 thread faz ~3–6 fps em 1080p no desktop e ~1–2 fps
 *    no celular. Um vídeo 4K de 10 min levaria horas — esses casos não são
 *    recomprimidos: o original sobe se couber na cota.
 */

import { FFmpeg } from '@ffmpeg/ffmpeg';

/** Enum de tipos de FS do ffmpeg.wasm (não exportado em runtime pelo pacote). */
type FFFSType = Parameters<FFmpeg['mount']>[0];
import { toBlobURL } from '@ffmpeg/util';
import { createClient } from '@/lib/supabase/client';
import { formatBytes, MB } from '@/lib/contributorLevels';

// ============================================================================
// Ambiente
// ============================================================================

function isMobileDevice(): boolean {
  if (typeof navigator === 'undefined') return false;
  const nav = navigator as Navigator & { userAgentData?: { mobile?: boolean } };
  return Boolean(nav.userAgentData?.mobile) || /Android|iPhone|iPad|iPod/i.test(nav.userAgent);
}

function deviceMemoryGB(): number {
  const nav = navigator as Navigator & { deviceMemory?: number };
  return nav.deviceMemory ?? (isMobileDevice() ? 3 : 8);
}

/** Maior SAÍDA que cabe com folga na memória do wasm (saída + cópia do readFile). */
function safeWasmOutputBytes(): number {
  if (isMobileDevice() || deviceMemoryGB() <= 4) return 220 * MB;
  return 700 * MB;
}

/** Tempo máximo aceitável de encoding no navegador. */
const MAX_ENCODE_SECONDS = 8 * 60;

/** Acima disso o upload vai em partes (mais estável e com retomada por parte). */
export const MULTIPART_THRESHOLD = 100 * MB;
const PART_CONCURRENCY = 3;

// ============================================================================
// FFmpeg (uma instância; o progresso aponta para o job atual)
// ============================================================================

let ffmpegInstance: FFmpeg | null = null;
let currentProgress: ((pct: number) => void) | null = null;

async function getFFmpeg(): Promise<FFmpeg> {
  if (ffmpegInstance?.loaded) return ffmpegInstance;
  const ffmpeg = new FFmpeg();
  ffmpeg.on('progress', ({ progress }) => {
    if (currentProgress && Number.isFinite(progress)) currentProgress(Math.max(0, Math.min(1, progress)));
  });
  // core single-thread: não exige COOP/COEP (que quebrariam o player do Spotify)
  const baseURL = 'https://unpkg.com/@ffmpeg/core@0.12.6/dist/umd';
  await ffmpeg.load({
    coreURL: await toBlobURL(`${baseURL}/ffmpeg-core.js`, 'text/javascript'),
    wasmURL: await toBlobURL(`${baseURL}/ffmpeg-core.wasm`, 'application/wasm'),
  });
  ffmpegInstance = ffmpeg;
  return ffmpeg;
}

/** Libera o heap do wasm (ele só cresce) depois de jobs pesados. */
function releaseFFmpeg() {
  try {
    ffmpegInstance?.terminate();
  } catch {
    // já encerrado
  }
  ffmpegInstance = null;
}

// ============================================================================
// Tipos
// ============================================================================

export interface CompressedMediaResult {
  file: File;
  originalSize: number;
  compressedSize: number;
  isGif: boolean;
  savedPercent: number;
  /** Como o arquivo foi tratado (para o selo no compositor). */
  strategy: 'kept' | 'transcoded' | 'image-reencoded' | 'too-heavy-kept';
  note?: string;
}

export type StatusFn = (label: string, pct: number) => void;

export class MediaQuotaError extends Error {
  constructor(
    message: string,
    public readonly needed: number,
    public readonly remaining: number
  ) {
    super(message);
    this.name = 'MediaQuotaError';
  }
}

function result(
  file: File,
  originalSize: number,
  isGif: boolean,
  strategy: CompressedMediaResult['strategy'],
  note?: string
): CompressedMediaResult {
  return {
    file,
    originalSize,
    compressedSize: file.size,
    isGif,
    savedPercent: Math.max(0, Math.round(((originalSize - file.size) / Math.max(1, originalSize)) * 100)),
    strategy,
    note,
  };
}

// ============================================================================
// Imagens: Canvas/OffscreenCanvas → WebP (ou JPEG se o navegador não codifica WebP)
// ============================================================================

const IMAGE_MAX_SIDE = 2560;

export async function compressImageForInsight(file: File, onStatus?: StatusFn): Promise<CompressedMediaResult> {
  const original = file.size;
  const type = file.type.toLowerCase();
  // GIF animado, SVG e arquivos já leves seguem como estão
  if (type === 'image/gif' || type === 'image/svg+xml' || original <= 300 * 1024) {
    return result(file, original, false, 'kept');
  }

  try {
    onStatus?.('Otimizando imagem...', 20);
    const bitmap = await createImageBitmap(file);
    const scale = Math.min(1, IMAGE_MAX_SIDE / Math.max(bitmap.width, bitmap.height));
    const w = Math.max(1, Math.round(bitmap.width * scale));
    const h = Math.max(1, Math.round(bitmap.height * scale));

    const encode = async (mime: string, quality: number): Promise<Blob | null> => {
      if (typeof OffscreenCanvas !== 'undefined') {
        const canvas = new OffscreenCanvas(w, h);
        const ctx = canvas.getContext('2d');
        if (!ctx) return null;
        ctx.drawImage(bitmap, 0, 0, w, h);
        return canvas.convertToBlob({ type: mime, quality }).catch(() => null);
      }
      const canvas = document.createElement('canvas');
      canvas.width = w;
      canvas.height = h;
      const ctx = canvas.getContext('2d');
      if (!ctx) return null;
      ctx.drawImage(bitmap, 0, 0, w, h);
      return new Promise((resolve) => canvas.toBlob((b) => resolve(b), mime, quality));
    };

    let blob = await encode('image/webp', 0.82);
    // Navegador sem encoder WebP devolve PNG: tenta JPEG só se a origem não tem transparência
    if (!blob || blob.type !== 'image/webp') {
      blob = type === 'image/png' ? null : await encode('image/jpeg', 0.85);
    }
    bitmap.close();

    if (!blob || blob.size >= original) return result(file, original, false, 'kept');

    const ext = blob.type === 'image/webp' ? 'webp' : 'jpg';
    const out = new File([blob], `${file.name.replace(/\.[^/.]+$/, '')}-insight.${ext}`, { type: blob.type });
    onStatus?.('Imagem otimizada', 100);
    return result(out, original, false, 'image-reencoded');
  } catch {
    // HEIC/AVIF sem decoder no navegador etc.
    return result(file, original, false, 'kept');
  }
}

// ============================================================================
// Vídeo e GIF: plano estimado antes de rodar o FFmpeg
// ============================================================================

interface VideoProbe {
  duration: number; // s
  width: number;
  height: number;
}

/** Lê duração e resolução sem decodificar o arquivo (elemento <video>). */
function probeVideo(file: File): Promise<VideoProbe | null> {
  if (file.type === 'image/gif') return Promise.resolve(null);
  return new Promise((resolve) => {
    const url = URL.createObjectURL(file);
    const v = document.createElement('video');
    v.preload = 'metadata';
    v.muted = true;
    const done = (p: VideoProbe | null) => {
      URL.revokeObjectURL(url);
      v.removeAttribute('src');
      v.load();
      resolve(p);
    };
    const t = setTimeout(() => done(null), 8000);
    v.onloadedmetadata = () => {
      clearTimeout(t);
      done(
        Number.isFinite(v.duration) && v.duration > 0
          ? { duration: v.duration, width: v.videoWidth, height: v.videoHeight }
          : null
      );
    };
    v.onerror = () => {
      clearTimeout(t);
      done(null);
    };
    v.src = url;
  });
}

export interface VideoPlan {
  action: 'keep' | 'transcode' | 'reject';
  /** Altura final (≤ 1080). */
  height: number;
  fps: number;
  videoKbps: number;
  audioKbps: number;
  /** Tamanho final estimado (bytes). */
  estimatedBytes: number;
  /** Tempo de encoding estimado (s). */
  estimatedSeconds: number;
  reason?: string;
}

/**
 * Decide ANTES do FFmpeg: manter, recomprimir (com bitrate que cabe na cota e
 * na memória do wasm) ou recusar. Bitrate alvo ~ qualidade "CRF 26" típica,
 * limitado pelo orçamento de bytes.
 */
export function planVideoCompression(
  probe: VideoProbe | null,
  inputBytes: number,
  budgetBytes: number,
  isGif: boolean
): VideoPlan {
  const mobile = isMobileDevice();
  const audioKbps = isGif ? 0 : 96;

  if (!probe) {
    // sem metadados (GIF, codec que o navegador não lê): estimativa conservadora
    const est = Math.round(inputBytes * (isGif ? 0.15 : 0.45));
    const canTranscode = inputBytes <= (mobile ? 250 : 900) * MB;
    return {
      action: canTranscode ? 'transcode' : inputBytes <= budgetBytes ? 'keep' : 'reject',
      height: isGif ? 540 : 720,
      fps: isGif ? 20 : 30,
      videoKbps: isGif ? 900 : 2200,
      audioKbps,
      estimatedBytes: est,
      estimatedSeconds: 0,
      reason: canTranscode ? undefined : 'arquivo grande demais para comprimir no navegador',
    };
  }

  const srcH = Math.min(probe.height || 1080, probe.width || 1920);
  const fps = isGif ? 20 : 30;
  const encodeFpsFor = (h: number) => (h >= 1000 ? 4 : h >= 700 ? 9 : 16) / (mobile ? 3 : 1);

  // maior resolução (≤ 1080p; GIF ≤ 540p) cujo encoding cabe no tempo máximo
  const ladder = (isGif ? [540, 360] : mobile ? [720, 540] : [1080, 720, 540]).filter((h) => h <= Math.max(srcH, 360));
  if (ladder.length === 0) ladder.push(Math.min(srcH, 540));
  let height = ladder[ladder.length - 1];
  for (const h of ladder) {
    if ((probe.duration * fps) / encodeFpsFor(Math.min(h, srcH)) <= MAX_ENCODE_SECONDS) {
      height = h;
      break;
    }
  }
  height = Math.min(height, srcH);

  const quality = height >= 1000 ? 4500 : height >= 700 ? 2400 : 1200; // kbps "bons"
  const byteBudget = Math.min(budgetBytes, safeWasmOutputBytes()) * 0.92; // folga do container
  const fitKbps = ((byteBudget * 8) / probe.duration) / 1000 - audioKbps;
  const videoKbps = Math.floor(Math.min(quality, fitKbps));
  const estimatedBytes = Math.round((((videoKbps + audioKbps) * 1000) / 8) * probe.duration);
  const estimatedSeconds = (probe.duration * fps) / encodeFpsFor(height);

  const srcKbps = ((inputBytes * 8) / probe.duration) / 1000;
  const alreadyLean = srcKbps <= (quality + audioKbps) * 1.15 && srcH <= 1080;

  if (alreadyLean && inputBytes <= budgetBytes) {
    return { action: 'keep', height, fps, videoKbps, audioKbps, estimatedBytes: inputBytes, estimatedSeconds: 0, reason: 'já está em bitrate eficiente' };
  }
  if (estimatedSeconds > MAX_ENCODE_SECONDS || videoKbps < (height >= 700 ? 700 : 350)) {
    return inputBytes <= budgetBytes
      ? { action: 'keep', height, fps, videoKbps, audioKbps, estimatedBytes: inputBytes, estimatedSeconds: 0, reason: 'longo demais para recomprimir no navegador' }
      : {
          action: 'reject',
          height,
          fps,
          videoKbps,
          audioKbps,
          estimatedBytes,
          estimatedSeconds,
          reason:
            estimatedSeconds > MAX_ENCODE_SECONDS
              ? 'o vídeo é longo demais para comprimir no navegador e o original não cabe na cota'
              : 'não cabe na cota restante deste post nem comprimido',
        };
  }
  return { action: 'transcode', height, fps, videoKbps, audioKbps, estimatedBytes, estimatedSeconds };
}

/**
 * Comprime vídeo/GIF para MP4 H.264 respeitando `budgetBytes` (cota restante do post).
 */
export async function compressMediaForInsight(
  inputFile: File,
  forceGifLoop: boolean = false,
  onStatus?: StatusFn,
  budgetBytes: number = Number.POSITIVE_INFINITY
): Promise<CompressedMediaResult> {
  const originalSize = inputFile.size;
  const isGifInput = inputFile.type === 'image/gif' || inputFile.name.toLowerCase().endsWith('.gif');
  const isGifMode = isGifInput || forceGifLoop;

  if (originalSize <= (isGifInput ? 512 * 1024 : 1.5 * MB)) {
    onStatus?.('Arquivo já otimizado!', 100);
    return result(inputFile, originalSize, isGifMode, 'kept');
  }

  onStatus?.('Analisando vídeo...', 4);
  const probe = await probeVideo(inputFile);
  const plan = planVideoCompression(probe, originalSize, budgetBytes, isGifMode);

  if (plan.action === 'reject') {
    throw new MediaQuotaError(
      `Não foi possível enviar: ${plan.reason}. Corte o vídeo ou reduza a resolução antes de enviar.`,
      plan.estimatedBytes,
      budgetBytes
    );
  }
  if (plan.action === 'keep') {
    onStatus?.('Vídeo mantido sem recompressão', 100);
    return result(inputFile, originalSize, isGifMode, plan.reason?.startsWith('longo') ? 'too-heavy-kept' : 'kept', plan.reason);
  }

  const estLabel = `~${formatBytes(plan.estimatedBytes)}`;
  onStatus?.(`Iniciando compressor (estimado ${estLabel})...`, 6);

  const mount = `/in-${Date.now()}`;
  const outputName = `out-${Date.now()}.mp4`;
  let ffmpeg: FFmpeg | null = null;
  let mounted = false;
  const heavy = originalSize > 200 * MB || plan.estimatedBytes > 150 * MB;

  try {
    ffmpeg = await getFFmpeg();
    currentProgress = (p) => onStatus?.(`Compactando (${Math.round(p * 100)}% · ${estLabel})...`, 8 + Math.round(p * 84));

    // WORKERFS: o FFmpeg lê o File sob demanda, sem copiar o bruto para a RAM do wasm
    await ffmpeg.createDir(mount);
    await ffmpeg.mount('WORKERFS' as FFFSType, { files: [inputFile] }, mount);
    mounted = true;
    const inputPath = `${mount}/${inputFile.name}`;

    const scale = `scale=-2:'min(${plan.height},ih)':flags=bicubic`;
    const rate = [
      '-b:v', `${plan.videoKbps}k`,
      '-maxrate', `${Math.round(plan.videoKbps * 1.4)}k`,
      '-bufsize', `${plan.videoKbps * 2}k`,
    ];

    const args = isGifMode
      ? ['-i', inputPath, '-vf', `${scale},fps=${plan.fps}`, '-c:v', 'libx264', '-preset', 'veryfast', '-crf', '27', ...rate, '-pix_fmt', 'yuv420p', '-an', '-movflags', '+faststart', outputName]
      : ['-i', inputPath, '-vf', `${scale},fps=${plan.fps}`, '-c:v', 'libx264', '-preset', 'veryfast', '-crf', '26', ...rate, '-pix_fmt', 'yuv420p', '-c:a', 'aac', '-b:a', `${plan.audioKbps}k`, '-movflags', '+faststart', outputName];

    const code = await ffmpeg.exec(args);
    if (code !== 0) throw new Error(`ffmpeg saiu com código ${code}`);

    const data = await ffmpeg.readFile(outputName);
    await ffmpeg.deleteFile(outputName).catch(() => {});
    const bytes = data instanceof Uint8Array ? data : new TextEncoder().encode(String(data));
    const outFile = new File([bytes as Uint8Array<ArrayBuffer>], `${inputFile.name.replace(/\.[^/.]+$/, '')}-insight.mp4`, { type: 'video/mp4' });

    if (!isGifInput && outFile.size >= originalSize) {
      return result(inputFile, originalSize, isGifMode, 'kept', 'o original já era menor');
    }
    onStatus?.(`Compactado: ${formatBytes(outFile.size)}`, 94);
    return result(outFile, originalSize, isGifMode, 'transcoded');
  } catch (err) {
    console.warn('[mediaCompressor] falha na compressão; avaliando original.', err);
    // memória estourada etc.: o original só segue se couber na cota
    if (originalSize <= budgetBytes && !isGifInput) {
      return result(inputFile, originalSize, isGifMode, 'too-heavy-kept', 'compressão falhou no navegador');
    }
    releaseFFmpeg();
    throw new MediaQuotaError(
      'Não foi possível comprimir este arquivo no navegador e o original não cabe na cota do post.',
      originalSize,
      budgetBytes
    );
  } finally {
    currentProgress = null;
    if (ffmpeg && mounted) await ffmpeg.unmount(mount).catch(() => {});
    if (ffmpeg) await ffmpeg.deleteDir(mount).catch(() => {});
    if (heavy) releaseFFmpeg();
  }
}

// ============================================================================
// Upload ao R2 (PUT único ou multipart), com progresso real
// ============================================================================

export interface UploadR2Result {
  publicUrl: string;
  r2Key: string | null;
  isGif: boolean;
  originalSize: number;
  compressedSize: number;
  savedPercent: number;
  strategy?: CompressedMediaResult['strategy'];
  note?: string;
}

function putWithProgress(
  url: string,
  body: Blob,
  contentType: string | null,
  onProgress?: (loaded: number) => void
): Promise<{ etag: string | null }> {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open('PUT', url);
    if (contentType) xhr.setRequestHeader('Content-Type', contentType);
    xhr.upload.onprogress = (e) => onProgress?.(e.loaded);
    xhr.onload = () =>
      xhr.status >= 200 && xhr.status < 300
        ? resolve({ etag: xhr.getResponseHeader('ETag') })
        : reject(new Error(`R2 respondeu ${xhr.status}`));
    xhr.onerror = () => reject(new Error('Falha de rede ao enviar para o R2 (verifique o CORS do bucket).'));
    xhr.send(body);
  });
}

async function apiR2(body: Record<string, unknown>) {
  const res = await fetch('/api/upload/r2', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  const data = await res.json().catch(() => ({}));
  return { res, data };
}

/** Envia um arquivo JÁ comprimido. O servidor registra o tamanho e assina Content-Length. */
export async function uploadFileToR2(
  file: File,
  meta: { isGif?: boolean; originalSize?: number; scope?: 'posts' | 'notebook' },
  onStatus?: StatusFn
): Promise<{ publicUrl: string; r2Key: string | null }> {
  const contentType = file.type || 'application/octet-stream';
  const report = (sent: number) =>
    onStatus?.(`Enviando ${formatBytes(sent)} de ${formatBytes(file.size)}...`, 95 + Math.round((sent / file.size) * 5));

  const { res, data } = await apiR2({
    action: file.size > MULTIPART_THRESHOLD ? 'multipart-create' : 'single',
    fileName: file.name,
    contentType,
    compressedSize: file.size,
    originalSize: meta.originalSize ?? file.size,
    isGif: Boolean(meta.isGif),
    scope: meta.scope ?? 'posts',
  });

  if (res.ok && data.fallbackToSupabase) {
    // R2 não configurado (ambiente local): Storage do Supabase
    const supabase = createClient();
    const { data: auth } = await supabase.auth.getUser();
    const ext = file.name.split('.').pop() || 'bin';
    const path = `${auth.user?.id ?? 'anon'}/media/${Date.now()}-${Math.random().toString(36).slice(2, 6)}.${ext}`;
    const { error } = await supabase.storage.from('posts').upload(path, file);
    if (error) throw new Error('Erro ao salvar arquivo: ' + error.message);
    return { publicUrl: supabase.storage.from('posts').getPublicUrl(path).data.publicUrl, r2Key: null };
  }
  if (!res.ok) throw new Error(data?.error || 'Erro ao gerar link de upload na Cloudflare.');

  if (data.mode === 'single') {
    await putWithProgress(data.uploadUrl, file, data.contentType, report);
    return { publicUrl: data.publicUrl, r2Key: data.r2Key };
  }

  // multipart: partes em paralelo, com até 3 tentativas cada
  const parts: { partNumber: number; url: string; start: number; end: number }[] = data.parts;
  const loaded = new Map<number, number>();
  const etags: { PartNumber: number; ETag: string }[] = [];
  let next = 0;

  const worker = async () => {
    while (next < parts.length) {
      const part = parts[next++];
      let lastErr: unknown = null;
      for (let attempt = 0; attempt < 3; attempt++) {
        try {
          const { etag } = await putWithProgress(part.url, file.slice(part.start, part.end), null, (n) => {
            loaded.set(part.partNumber, n);
            report([...loaded.values()].reduce((a, b) => a + b, 0));
          });
          if (!etag) throw new Error('O bucket não expõe o cabeçalho ETag (CORS: ExposeHeaders ["ETag"]).');
          etags.push({ PartNumber: part.partNumber, ETag: etag });
          lastErr = null;
          break;
        } catch (err) {
          lastErr = err;
          loaded.set(part.partNumber, 0);
          await new Promise((r) => setTimeout(r, 800 * (attempt + 1)));
        }
      }
      if (lastErr) throw lastErr;
    }
  };

  try {
    await Promise.all(Array.from({ length: Math.min(PART_CONCURRENCY, parts.length) }, worker));
  } catch (err) {
    await apiR2({ action: 'multipart-abort', r2Key: data.r2Key, uploadId: data.uploadId }).catch(() => {});
    throw err;
  }

  onStatus?.('Finalizando envio...', 99);
  const done = await apiR2({
    action: 'multipart-complete',
    r2Key: data.r2Key,
    uploadId: data.uploadId,
    parts: etags.sort((a, b) => a.PartNumber - b.PartNumber),
  });
  if (!done.res.ok) throw new Error(done.data?.error || 'Falha ao finalizar o envio em partes.');
  return { publicUrl: data.publicUrl, r2Key: data.r2Key };
}

/**
 * Fluxo completo: comprime conforme o tipo, confere a cota restante do post
 * (sobre o tamanho comprimido) e envia ao R2.
 *
 * @param budgetBytes cota que ainda resta no post (limite do nível − já usado)
 * @param asImage     true para blocos de imagem (GIF fica como imagem animada)
 */
export async function uploadMediaToInsight(
  rawFile: File,
  opts: { budgetBytes: number; forceGifLoop?: boolean; asImage?: boolean; asFile?: boolean; onStatus?: StatusFn; scope?: 'posts' | 'notebook' }
): Promise<UploadR2Result> {
  const { budgetBytes, forceGifLoop = false, asImage = false, asFile = false, onStatus, scope = 'posts' } = opts;
  const t = rawFile.type.toLowerCase();

  let compressed: CompressedMediaResult;
  if (asFile) {
    compressed = result(rawFile, rawFile.size, false, 'kept');
  } else if (asImage || (t.startsWith('image/') && t !== 'image/gif' && !forceGifLoop)) {
    compressed = await compressImageForInsight(rawFile, onStatus);
  } else {
    compressed = await compressMediaForInsight(rawFile, forceGifLoop, onStatus, budgetBytes);
  }

  if (compressed.compressedSize > budgetBytes) {
    throw new MediaQuotaError(
      `Mesmo comprimido, o arquivo tem ${formatBytes(compressed.compressedSize)} e só restam ${formatBytes(Math.max(0, budgetBytes))} de anexos neste post.`,
      compressed.compressedSize,
      budgetBytes
    );
  }

  onStatus?.('Conectando à Cloudflare R2...', 95);
  const up = await uploadFileToR2(compressed.file, { isGif: compressed.isGif, originalSize: compressed.originalSize, scope }, onStatus);
  onStatus?.('Concluído!', 100);

  return {
    ...up,
    isGif: compressed.isGif,
    originalSize: compressed.originalSize,
    compressedSize: compressed.compressedSize,
    savedPercent: compressed.savedPercent,
    strategy: compressed.strategy,
    note: compressed.note,
  };
}

/** Compatibilidade: vídeo/GIF sem cota informada (o servidor ainda valida). */
export async function uploadCompressedMediaToR2(
  rawFile: File,
  _authorId: string,
  forceGifLoop: boolean = false,
  onStatus?: StatusFn,
  budgetBytes: number = Number.POSITIVE_INFINITY
): Promise<UploadR2Result> {
  return uploadMediaToInsight(rawFile, { budgetBytes, forceGifLoop, onStatus });
}
