'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import type { CarouselImage } from '@/types/database';

/** proporção usada quando a foto não tem tamanho salvo, e os limites (evita faixas finas demais) */
const FALLBACK_RATIO = 4 / 5;
const MIN_RATIO = 0.56; // 9:16
const MAX_RATIO = 1.91; // panorâmica

function ratioOf(img: CarouselImage) {
  const r = img.width && img.height ? img.width / img.height : FALLBACK_RATIO;
  return Math.min(MAX_RATIO, Math.max(MIN_RATIO, r));
}

/**
 * Carrossel lateral (como o do X): as fotos ficam lado a lado na mesma altura,
 * cada uma na sua proporção, e a fileira rola para o lado. No celular arrasta
 * com o dedo; no PC tem setas ao passar o mouse e rola com o trackpad/teclado.
 */
export function MediaStrip({
  images,
  onOpen,
  label = 'Fotos do post',
}: {
  images: CarouselImage[];
  onOpen?: (index: number) => void;
  label?: string;
}) {
  const trackRef = useRef<HTMLDivElement>(null);
  const [canPrev, setCanPrev] = useState(false);
  const [canNext, setCanNext] = useState(false);

  const sync = useCallback(() => {
    const el = trackRef.current;
    if (!el) return;
    setCanPrev(el.scrollLeft > 4);
    setCanNext(el.scrollLeft + el.clientWidth < el.scrollWidth - 4);
  }, []);

  useEffect(() => {
    const el = trackRef.current;
    if (!el) return;
    sync();
    let raf = 0;
    const onScroll = () => {
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(sync);
    };
    el.addEventListener('scroll', onScroll, { passive: true });
    const ro = new ResizeObserver(sync);
    ro.observe(el);
    return () => {
      el.removeEventListener('scroll', onScroll);
      ro.disconnect();
      cancelAnimationFrame(raf);
    };
  }, [sync, images.length]);

  const scrollByPage = (dir: 1 | -1) => {
    const el = trackRef.current;
    if (!el) return;
    el.scrollBy({ left: dir * el.clientWidth * 0.8, behavior: 'smooth' });
  };

  if (!images.length) return null;

  return (
    <div
      className="relative group/strip"
      role="region"
      aria-roledescription="carrossel"
      aria-label={`${label} (${images.length})`}
      onClick={(e) => e.stopPropagation()}
    >
      <div
        ref={trackRef}
        tabIndex={0}
        className="flex gap-1.5 overflow-x-auto overscroll-x-contain snap-x snap-proximity scroll-smooth rounded-xl [scrollbar-width:none] [&::-webkit-scrollbar]:hidden focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
      >
        {images.map((img, i) => (
          <button
            key={img.id || i}
            type="button"
            onClick={() => onOpen?.(i)}
            aria-label={`Abrir foto ${i + 1} de ${images.length}`}
            style={{ aspectRatio: String(ratioOf(img)) }}
            className="relative shrink-0 snap-start h-[clamp(13rem,58vw,21rem)] max-w-[88%] overflow-hidden rounded-xl bg-elevated cursor-zoom-in"
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={img.imageUrl}
              alt={img.caption || `Foto ${i + 1} de ${images.length}`}
              loading={i < 2 ? 'eager' : 'lazy'}
              decoding="async"
              draggable={false}
              className="w-full h-full object-cover select-none"
            />
          </button>
        ))}
      </div>

      {canPrev && (
        <button
          type="button"
          aria-label="Fotos anteriores"
          onClick={() => scrollByPage(-1)}
          className="hidden md:flex absolute left-2 top-1/2 -translate-y-1/2 w-8 h-8 rounded-full bg-black/65 text-white items-center justify-center opacity-0 group-hover/strip:opacity-100 focus-visible:opacity-100 transition-opacity"
        >
          <ChevronLeft className="w-5 h-5" />
        </button>
      )}
      {canNext && (
        <button
          type="button"
          aria-label="Próximas fotos"
          onClick={() => scrollByPage(1)}
          className="hidden md:flex absolute right-2 top-1/2 -translate-y-1/2 w-8 h-8 rounded-full bg-black/65 text-white items-center justify-center opacity-0 group-hover/strip:opacity-100 focus-visible:opacity-100 transition-opacity"
        >
          <ChevronRight className="w-5 h-5" />
        </button>
      )}
    </div>
  );
}
