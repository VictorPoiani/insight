'use client';

/**
 * Ponte de mídia do Canvas para o R2 (servido pela CDN).
 *
 * - O arquivo vai como foi recebido (sem compressão, sem trocar o formato),
 *   sempre que o navegador sabe exibi-lo direto.
 * - Antes de subir, calcula o SHA-256: se o mesmo arquivo já está nos anexos
 *   do usuário, reaproveita o endereço (não ocupa espaço de novo).
 * - Formatos que o navegador não mostra (HEIC, TIFF, BMP, SVG) viram WebP.
 * - Guarda os metadados no anexo: tipo, tamanho, dimensões, hash e nome.
 *
 * Os limites de armazenamento por plano ainda serão definidos; por enquanto
 * vale o limite por arquivo do nível do usuário (o servidor confere).
 */
import { createClient } from '@/lib/supabase/client';
import { MediaQuotaError, uploadMediaToInsight } from '@/lib/mediaCompressor';

/** Formatos exibidos direto (o servidor também serve estes inline). */
const LOSSLESS_IMAGE = /^image\/(png|jpe?g|webp|gif|avif)$/i;

export interface CanvasUpload {
  url: string;
  assetId: string | null;
  bytes: number;
  mime: string;
  width: number | null;
  height: number | null;
  /** foi convertido (formato que o navegador não mostra ou acima do limite) */
  converted: boolean;
  /** já existia nos anexos */
  reused: boolean;
}

export async function sha256Hex(file: Blob): Promise<string | null> {
  try {
    // arquivos muito grandes: pula o hash (evita travar a memória do navegador)
    if (file.size > 300 * 1024 * 1024 || !crypto?.subtle) return null;
    const buf = await crypto.subtle.digest('SHA-256', await file.arrayBuffer());
    return Array.from(new Uint8Array(buf))
      .map((b) => b.toString(16).padStart(2, '0'))
      .join('');
  } catch {
    return null;
  }
}

/** Dimensões da imagem sem decodificar no fio principal quando possível. */
export async function imageSize(file: Blob): Promise<{ width: number; height: number } | null> {
  try {
    const bmp = await createImageBitmap(file);
    const r = { width: bmp.width, height: bmp.height };
    bmp.close();
    return r;
  } catch {
    return await new Promise((res) => {
      const url = URL.createObjectURL(file);
      const img = new Image();
      img.onload = () => (res(img.naturalWidth ? { width: img.naturalWidth, height: img.naturalHeight } : null), URL.revokeObjectURL(url));
      img.onerror = () => (res(null), URL.revokeObjectURL(url));
      img.src = url;
    });
  }
}

export async function uploadCanvasImage(
  file: File,
  o: { itemId: string; profileId: string; budgetBytes: number; size?: { width: number; height: number } | null }
): Promise<CanvasUpload> {
  const supabase = createClient();
  const size = o.size !== undefined ? o.size : await imageSize(file);
  const hash = await sha256Hex(file);
  const name = (file.name || 'imagem').slice(0, 300);

  // mesmo arquivo já enviado: reaproveita
  if (hash) {
    const { data } = await supabase.from('notebook_assets').select('id, url, size_bytes, content_type').eq('profile_id', o.profileId).eq('sha256', hash).limit(1);
    const hit = data?.[0] as { id: string; url: string; size_bytes: number; content_type: string | null } | undefined;
    if (hit?.url) {
      return { url: hit.url, assetId: hit.id, bytes: Number(hit.size_bytes) || file.size, mime: hit.content_type || file.type, width: size?.width ?? null, height: size?.height ?? null, converted: false, reused: true };
    }
  }

  const lossless = LOSSLESS_IMAGE.test(file.type);
  let converted = !lossless;
  let res;
  try {
    res = await uploadMediaToInsight(file, { budgetBytes: o.budgetBytes, asFile: lossless, asImage: !lossless, scope: 'notebook' });
  } catch (err) {
    // acima do limite por arquivo: tenta uma versão comprimida
    if (!(err instanceof MediaQuotaError) || !lossless) throw err;
    res = await uploadMediaToInsight(file, { budgetBytes: o.budgetBytes, asImage: true, scope: 'notebook' });
    converted = true;
  }

  let assetId: string | null = null;
  if (res.r2Key) {
    const { data, error } = await supabase
      .from('notebook_assets')
      .insert({
        profile_id: o.profileId,
        item_id: o.itemId,
        r2_key: res.r2Key,
        url: res.publicUrl,
        width: size?.width ?? null,
        height: size?.height ?? null,
        // o hash só identifica o original; a versão convertida não é o mesmo arquivo
        sha256: converted ? null : hash,
        original_name: name,
      })
      .select('id')
      .single();
    if (error) console.warn('[canvas] anexo sem registro', error.message);
    assetId = (data as { id: string } | null)?.id ?? null;
  }
  return {
    url: res.publicUrl,
    assetId,
    bytes: res.compressedSize || file.size,
    mime: converted ? 'image/webp' : file.type,
    width: size?.width ?? null,
    height: size?.height ?? null,
    converted,
    reused: false,
  };
}

export const formatSize = (b?: number) => (!b ? '' : b < 1024 * 1024 ? `${Math.max(1, Math.round(b / 1024))} KB` : `${(b / 1024 / 1024).toFixed(1).replace('.', ',')} MB`);
