'use client';

/**
 * Compressão de vídeo acelerada por hardware (WebCodecs, via Mediabunny).
 *
 * O ffmpeg.wasm roda x264 em uma única thread de CPU (~3–6 fps em 1080p no PC,
 * ~1–2 fps no celular): um vídeo de 1 min levava minutos. Aqui o navegador usa o
 * codificador H.264 do próprio aparelho (GPU/chip de vídeo) — tipicamente
 * 10–50× mais rápido — e o trabalho pesado sai da thread principal, então a
 * página continua fluida durante a compressão.
 *
 * Retorna `null` quando o navegador não oferece o caminho rápido (sem
 * WebCodecs, codec de entrada que não decodifica, H.264 indisponível); quem
 * chama cai no ffmpeg.wasm.
 */

export interface FastEncodePlan {
  /** Altura máxima de saída (o vídeo nunca é ampliado). */
  height: number;
  /** Taxa de quadros máxima (vídeos acima disso são reduzidos). */
  fps: number;
  videoKbps: number;
  /** 0 = sem áudio (modo GIF). */
  audioKbps: number;
}

export function hasWebCodecs(): boolean {
  return (
    typeof window !== 'undefined' &&
    typeof (window as unknown as { VideoEncoder?: unknown }).VideoEncoder === 'function' &&
    typeof (window as unknown as { VideoDecoder?: unknown }).VideoDecoder === 'function'
  );
}

const even = (n: number) => Math.max(2, Math.round(n / 2) * 2);

export async function transcodeWithWebCodecs(
  file: File,
  plan: FastEncodePlan,
  onProgress?: (p: number) => void,
  signal?: AbortSignal
): Promise<File | null> {
  if (!hasWebCodecs()) return null;

  // carregado sob demanda: não pesa no bundle de quem só lê o feed
  const mb = await import('mediabunny');
  const input = new mb.Input({ source: new mb.BlobSource(file), formats: mb.ALL_FORMATS });

  try {
    const videoTrack = await input.getPrimaryVideoTrack().catch(() => null);
    if (!videoTrack || !(await videoTrack.canDecode())) return null;

    // tamanho de saída: mesma proporção, altura ≤ plano, dimensões pares (H.264)
    const dw = videoTrack.displayWidth;
    const dh = videoTrack.displayHeight;
    const shortSide = Math.min(dw, dh);
    const scale = Math.min(1, plan.height / Math.max(1, shortSide));
    const width = even(dw * scale);
    const height = even(dh * scale);
    const bitrate = plan.videoKbps * 1000;

    const ok = await mb.canEncodeVideo('avc', { width, height, bitrate }).catch(() => false);
    if (!ok) return null;

    // só reduz a taxa de quadros se a origem passar do alvo (ex.: 60 → 30)
    const stats = await videoTrack.computePacketStats(120).catch(() => null);
    const srcFps = stats?.averagePacketRate ?? 0;
    const frameRate = srcFps > plan.fps + 1 ? plan.fps : undefined;

    const output = new mb.Output({
      format: new mb.Mp4OutputFormat({ fastStart: 'in-memory' }), // moov no início: começa a tocar antes de baixar tudo
      target: new mb.BufferTarget(),
    });

    const audioTrack = plan.audioKbps > 0 ? await input.getPrimaryAudioTrack().catch(() => null) : null;
    type AudioOpts = { discard?: boolean; codec?: 'aac' | 'opus'; quality?: InstanceType<typeof mb.Quality> };
    let audio: AudioOpts = { discard: true };
    if (audioTrack) {
      const codec = await audioTrack.getCodec().catch(() => null);
      const srcBitrate = await audioTrack.getAverageBitrate().catch(() => null);
      const quality = new mb.Quality({ bitrate: plan.audioKbps * 1000 });
      // nem todo navegador gera AAC (Chrome no Linux, Firefox): aí o áudio é copiado ou vira Opus
      const canAac = await mb.canEncodeAudio('aac', { quality }).catch(() => false);
      const copyable = codec === 'aac' || codec === 'mp3' || codec === 'opus';
      const lean = srcBitrate !== null && srcBitrate <= plan.audioKbps * 1000 * 1.6;
      if (copyable && (lean || !canAac)) audio = {}; // copia sem recodificar (instantâneo)
      else if (canAac) audio = { codec: 'aac', quality };
      else if (await mb.canEncodeAudio('opus', { quality }).catch(() => false)) audio = { codec: 'opus', quality };
      else return null;
    }

    const conversion = await mb.Conversion.init({
      input,
      output,
      tracks: 'primary',
      showWarnings: false,
      video: {
        codec: 'avc',
        width,
        height,
        fit: 'fill',
        frameRate,
        quality: new mb.Quality({ bitrate, bitrateMode: 'variable' }),
        keyFrameInterval: 2, // pular para qualquer ponto do vídeo fica rápido
        forceTranscode: true,
      },
      audio,
    });

    if (!conversion.isValid) return null;
    // o vídeo precisa ter sobrevivido; perder o áudio silenciosamente não é aceitável
    if (conversion.discardedTracks.some((d) => d.reason !== 'discarded_by_user' && (d.track === videoTrack || d.track === audioTrack))) {
      return null;
    }

    conversion.onProgress = (p) => onProgress?.(Math.max(0, Math.min(1, p)));
    const abort = () => void conversion.cancel();
    signal?.addEventListener('abort', abort, { once: true });
    try {
      await conversion.execute();
    } finally {
      signal?.removeEventListener('abort', abort);
    }

    const buffer = output.target.buffer;
    if (!buffer || buffer.byteLength === 0) return null;
    return new File([buffer], `${file.name.replace(/\.[^/.]+$/, '')}-insight.mp4`, { type: 'video/mp4' });
  } finally {
    input.dispose();
  }
}
