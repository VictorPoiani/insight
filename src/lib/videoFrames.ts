'use client';

/**
 * Extrai alguns quadros de um vídeo NO NAVEGADOR (canvas) para a moderação
 * analisar como imagens. Sem quadros, o vídeo vai para revisão humana.
 */
export async function extractVideoFrames(file: Blob, count = 3, maxSide = 512): Promise<Blob[]> {
  const url = URL.createObjectURL(file);
  const video = document.createElement('video');
  video.muted = true;
  video.playsInline = true;
  video.preload = 'auto';
  video.src = url;
  const frames: Blob[] = [];
  const once = (ev: string, ms = 8000) =>
    new Promise<void>((resolve, reject) => {
      const t = setTimeout(() => reject(new Error(`timeout:${ev}`)), ms);
      video.addEventListener(ev, () => {
        clearTimeout(t);
        resolve();
      }, { once: true });
      video.addEventListener('error', () => {
        clearTimeout(t);
        reject(new Error('video_error'));
      }, { once: true });
    });
  try {
    await once('loadeddata');
    const duration = Number.isFinite(video.duration) && video.duration > 0 ? video.duration : 1;
    const scale = Math.min(1, maxSide / Math.max(video.videoWidth || maxSide, video.videoHeight || maxSide));
    const canvas = document.createElement('canvas');
    canvas.width = Math.max(1, Math.round((video.videoWidth || maxSide) * scale));
    canvas.height = Math.max(1, Math.round((video.videoHeight || maxSide) * scale));
    const ctx = canvas.getContext('2d');
    if (!ctx) return [];
    for (let i = 0; i < count; i++) {
      // 10%, 50%, 90% (evita o 1º quadro, que costuma ser preto)
      const at = duration * (count === 1 ? 0.5 : 0.1 + (0.8 * i) / (count - 1));
      video.currentTime = Math.min(Math.max(at, 0), Math.max(0, duration - 0.05));
      await once('seeked');
      ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
      const blob = await new Promise<Blob | null>((r) => canvas.toBlob(r, 'image/jpeg', 0.72));
      if (blob) frames.push(blob);
    }
    return frames;
  } catch {
    return frames;
  } finally {
    URL.revokeObjectURL(url);
    video.removeAttribute('src');
    video.load();
  }
}
