import type { PostBlock } from '@/types/database';

type BlockLike = Pick<PostBlock, 'type'> & {
  imageUrl?: string | null;
  carouselImages?: { imageUrl?: string | null }[] | null;
};

/** Todas as fotos de um post, na ordem em que aparecem (blocos de imagem e carrosséis). */
export function postImageUrls(blocks: BlockLike[] | null | undefined): string[] {
  const out: string[] = [];
  for (const b of Array.isArray(blocks) ? blocks : []) {
    if (b?.type === 'image' && b.imageUrl) out.push(b.imageUrl);
    if (b?.type === 'carousel') for (const img of b.carouselImages || []) if (img?.imageUrl) out.push(img.imageUrl);
  }
  return out;
}

/** Primeira foto do post (capa de compartilhamento, citação, atividade). */
export function firstPostImage(blocks: BlockLike[] | null | undefined): string | null {
  return postImageUrls(blocks)[0] ?? null;
}
