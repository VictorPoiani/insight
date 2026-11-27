'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';

/**
 * Carrossel de mídias estilo Instagram: uma por vez, a próxima aparece ao lado
 * com baixa opacidade. Arrasta no celular, setas/teclado no desktop.
 */
export function MediaCarousel({ slides, label = 'Mídias do post' }: { slides: { key: string; node: React.ReactNode }[]; label?: string }) {
  const trackRef = useRef<HTMLDivElement>(null);
  const [active, setActive] = useState(0);

  // slide mais próximo do centro = ativo
  const onScroll = useCallback(() => {
    const el = trackRef.current;
    if (!el) return;
    const center = el.scrollLeft + el.clientWidth / 2;
    let best = 0;
    let bestDist = Infinity;
    Array.from(el.children).forEach((child, i) => {
      const c = child as HTMLElement;
      const d = Math.abs(c.offsetLeft + c.offsetWidth / 2 - center);
      if (d < bestDist) {
        bestDist = d;
        best = i;
      }
    });
    setActive(best);
  }, []);

  useEffect(() => {
    const el = trackRef.current;
    if (!el) return;
    let raf = 0;
    const handler = () => {
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(onScroll);
    };
    el.addEventListener('scroll', handler, { passive: true });
    return () => {
      el.removeEventListener('scroll', handler);
      cancelAnimationFrame(raf);
    };
  }, [onScroll]);

  const goTo = (i: number) => {
    const el = trackRef.current;
    const target = el?.children[Math.max(0, Math.min(slides.length - 1, i))] as HTMLElement | undefined;
    if (!el || !target) return;
    el.scrollTo({ left: target.offsetLeft - (el.clientWidth - target.offsetWidth) / 2, behavior: 'smooth' });
  };

  return (
    <div
      // no PC o carrossel ocupa metade da coluna (como as fotos soltas); no celular, a largura toda
      className="col-span-12 relative group/carousel py-1 w-full md:max-w-[50%] md:mx-auto"
      role="region"
      aria-roledescription="carrossel"
      aria-label={label}
      onClick={(e) => e.stopPropagation()}
      onKeyDown={(e) => {
        if (e.key === 'ArrowRight') goTo(active + 1);
        if (e.key === 'ArrowLeft') goTo(active - 1);
      }}
    >
      <div
        ref={trackRef}
        tabIndex={0}
        className="flex gap-3 overflow-x-auto snap-x snap-mandatory scroll-smooth [scrollbar-width:none] [&::-webkit-scrollbar]:hidden focus:outline-none"
      >
        {slides.map((s, i) => (
          <div
            key={s.key}
            aria-roledescription="slide"
            aria-label={`${i + 1} de ${slides.length}`}
            aria-hidden={i !== active}
            className={`shrink-0 basis-[86%] sm:basis-[82%] md:basis-full snap-center transition-opacity duration-300 [&_img]:max-h-[560px] [&_img]:object-contain [&_img]:bg-black/30 ${
              i === active ? 'opacity-100' : 'opacity-35 hover:opacity-60 cursor-pointer'
            }`}
            onClickCapture={(e) => {
              if (i !== active) {
                e.preventDefault();
                e.stopPropagation();
                goTo(i);
              }
            }}
          >
            {s.node}
          </div>
        ))}
        {/* espaço final para a última mídia poder centralizar */}
        <div aria-hidden className="shrink-0 basis-[8%] sm:basis-[10%]" />
      </div>

      {active > 0 && (
        <button
          type="button"
          aria-label="Mídia anterior"
          onClick={() => goTo(active - 1)}
          className="hidden md:flex absolute left-2 top-1/2 -translate-y-1/2 w-8 h-8 rounded-full bg-black/60 text-white items-center justify-center opacity-0 group-hover/carousel:opacity-100 transition-opacity"
        >
          <ChevronLeft className="w-5 h-5" />
        </button>
      )}
      {active < slides.length - 1 && (
        <button
          type="button"
          aria-label="Próxima mídia"
          onClick={() => goTo(active + 1)}
          className="hidden md:flex absolute right-2 top-1/2 -translate-y-1/2 w-8 h-8 rounded-full bg-black/60 text-white items-center justify-center opacity-0 group-hover/carousel:opacity-100 transition-opacity"
        >
          <ChevronRight className="w-5 h-5" />
        </button>
      )}

      <div className="mt-2 flex items-center justify-center gap-1.5">
        {slides.map((s, i) => (
          <button
            key={s.key}
            type="button"
            aria-label={`Ir para a mídia ${i + 1}`}
            onClick={() => goTo(i)}
            className={`h-1.5 rounded-full transition-all ${i === active ? 'w-4 bg-accent' : 'w-1.5 bg-border hover:bg-muted'}`}
          />
        ))}
        <span className="ml-2 text-[10px] font-mono text-muted">
          {active + 1}/{slides.length}
        </span>
      </div>
    </div>
  );
}
