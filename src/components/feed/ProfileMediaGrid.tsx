'use client';

import Link from 'next/link';
import { Film, GalleryHorizontal } from 'lucide-react';
import type { Post } from '@/types/database';

type Item = { key: string; postId: string; src: string; kind: 'image' | 'video'; count: number };

/** Mídias dos posts, na ordem do perfil (uma por post, com indicador de "mais"). */
function collect(posts: Post[]): Item[] {
  const out: Item[] = [];
  for (const p of posts) {
    if (p.is_nsfw) continue; // +18 não entra na grade
    const media: { src: string; kind: 'image' | 'video' }[] = [];
    for (const b of Array.isArray(p.blocks) ? p.blocks : []) {
      if (b.spoiler) continue;
      if (b.type === 'image' && b.imageUrl) media.push({ src: b.imageUrl, kind: 'image' });
      if (b.type === 'carousel') for (const img of b.carouselImages || []) if (img.imageUrl) media.push({ src: img.imageUrl, kind: 'image' });
      if ((b.type === 'video' || b.type === 'gif') && b.videoUrl) media.push({ src: b.videoUrl, kind: /\.(gif|webp)(\?|$)/i.test(b.videoUrl) ? 'image' : 'video' });
    }
    if (!media.length && p.image_url) media.push({ src: p.image_url, kind: 'image' });
    if (media.length) out.push({ key: p.id, postId: p.id, src: media[0].src, kind: media[0].kind, count: media.length });
  }
  return out;
}

/** Aba "Mídia" do perfil: grade quadrada, clicar abre o post. */
export function ProfileMediaGrid({ posts }: { posts: Post[] }) {
  const items = collect(posts);
  if (!items.length) return <div className="py-16 text-center text-xs text-muted">Nenhuma foto ou vídeo publicado ainda.</div>;
  return (
    <div className="grid grid-cols-3 gap-0.5 sm:gap-1 p-0.5 sm:p-1">
      {items.map((it) => (
        <Link key={it.key} href={`/post/${it.postId}`} className="relative aspect-square overflow-hidden bg-elevated group/m">
          {it.kind === 'video' ? (
            <video src={`${it.src}#t=0.001`} muted playsInline preload="metadata" className="w-full h-full object-cover" />
          ) : (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={it.src} alt="" loading="lazy" className="w-full h-full object-cover transition-transform duration-300 group-hover/m:scale-[1.04]" />
          )}
          {(it.kind === 'video' || it.count > 1) && (
            <span className="absolute top-1.5 right-1.5 p-1 rounded-md bg-black/55 text-white">
              {it.kind === 'video' ? <Film className="w-3.5 h-3.5" /> : <GalleryHorizontal className="w-3.5 h-3.5" />}
            </span>
          )}
        </Link>
      ))}
    </div>
  );
}
