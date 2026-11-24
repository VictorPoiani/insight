'use client';

import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { ChevronLeft, ChevronRight, X, ZoomIn, ZoomOut, Download } from '@/components/icons';
import { usePanZoom } from '@/components/canvas/PanZoom';

export interface LightboxImage {
  src: string;
  alt?: string;
}

function ZoomableImage({ img, w, h }: { img: LightboxImage; w: number; h: number }) {
  const pz = usePanZoom({ worldWidth: w, worldHeight: h, wheel: 'free', minZoom: 0.05, maxZoom: 8 });
  // zoom que enquadra a imagem inteira (sem ampliar além do tamanho real)
  const fitK = () => {
    const el = pz.viewportRef.current;
    if (!el) return 1;
    return Math.min((el.clientWidth - 48) / w, (el.clientHeight - 48) / h, 1);
  };

  useEffect(() => {
    const t = setTimeout(() => pz.fit(null, 1), 0);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [w, h]);

  return (
    <div
      {...pz.viewportProps}
      onDoubleClick={(e) => {
        const r = (e.currentTarget as HTMLElement).getBoundingClientRect();
        const zoomedIn = pz.view.k > fitK() * 1.2;
        if (zoomedIn) pz.fit(null, 1);
        else pz.zoomAt(2.5, e.clientX - r.left, e.clientY - r.top);
      }}
      style={{ touchAction: 'none' }}
      className={`absolute inset-0 outline-none ${pz.panning ? 'cursor-grabbing' : 'cursor-grab'}`}
    >
      <div style={pz.worldStyle} className="absolute left-0 top-0">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={img.src} alt={img.alt || ''} draggable={false} className="w-full h-full select-none" />
      </div>
      <div data-pz-stop className="absolute bottom-4 left-1/2 -translate-x-1/2 flex items-center gap-1 p-1 rounded-full bg-black/70 backdrop-blur text-white">
        <button type="button" onClick={pz.zoomOut} aria-label="Afastar" className="p-2 rounded-full hover:bg-white/15">
          <ZoomOut className="w-4 h-4" />
        </button>
        <span className="w-12 text-center text-xs font-mono tabular-nums">{Math.round(pz.view.k * 100)}%</span>
        <button type="button" onClick={pz.zoomIn} aria-label="Aproximar" className="p-2 rounded-full hover:bg-white/15">
          <ZoomIn className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
}

/**
 * Visualizador de imagens em tela cheia: pinça/roda para zoom, arrastar para
 * mover, toque duplo alterna o zoom, setas trocam de imagem, Esc fecha.
 */
export function ImageLightbox({
  images,
  index,
  onClose,
  onIndexChange,
}: {
  images: LightboxImage[];
  index: number;
  onClose: () => void;
  onIndexChange: (i: number) => void;
}) {
  const img = images[index];
  const [dims, setDims] = useState<{ src: string; w: number; h: number } | null>(null);

  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = prev;
    };
  }, []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
      if (e.key === 'ArrowLeft' && index > 0) onIndexChange(index - 1);
      if (e.key === 'ArrowRight' && index < images.length - 1) onIndexChange(index + 1);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [index, images.length, onClose, onIndexChange]);

  useEffect(() => {
    if (!img) return;
    let alive = true;
    const probe = new Image();
    probe.onload = () => alive && setDims({ src: img.src, w: probe.naturalWidth || 1200, h: probe.naturalHeight || 800 });
    probe.onerror = () => alive && setDims({ src: img.src, w: 1200, h: 800 });
    probe.src = img.src;
    return () => {
      alive = false;
    };
  }, [img]);

  if (!img) return null;
  const ready = dims && dims.src === img.src;

  return createPortal(
    <div role="dialog" aria-modal="true" aria-label="Imagem ampliada" className="fixed inset-0 z-[300] bg-black/95 animate-in fade-in duration-150">
      {ready ? (
        <ZoomableImage key={img.src} img={img} w={dims.w} h={dims.h} />
      ) : (
        <div className="absolute inset-0 grid place-items-center text-white/60 text-sm">Carregando…</div>
      )}

      <div className="absolute top-0 inset-x-0 flex items-center justify-between p-3 bg-gradient-to-b from-black/60 to-transparent text-white pointer-events-none">
        <span className="text-xs font-semibold tabular-nums pl-1">{images.length > 1 ? `${index + 1} / ${images.length}` : ''}</span>
        <div className="flex items-center gap-1 pointer-events-auto">
          <a href={img.src} target="_blank" rel="noopener noreferrer" aria-label="Abrir original" className="p-2 rounded-full hover:bg-white/15">
            <Download className="w-5 h-5" />
          </a>
          <button type="button" onClick={onClose} aria-label="Fechar" className="p-2 rounded-full hover:bg-white/15">
            <X className="w-6 h-6" />
          </button>
        </div>
      </div>

      {index > 0 && (
        <button
          type="button"
          onClick={() => onIndexChange(index - 1)}
          aria-label="Imagem anterior"
          className="absolute left-2 top-1/2 -translate-y-1/2 p-2.5 rounded-full bg-black/50 text-white hover:bg-black/70"
        >
          <ChevronLeft className="w-6 h-6" />
        </button>
      )}
      {index < images.length - 1 && (
        <button
          type="button"
          onClick={() => onIndexChange(index + 1)}
          aria-label="Próxima imagem"
          className="absolute right-2 top-1/2 -translate-y-1/2 p-2.5 rounded-full bg-black/50 text-white hover:bg-black/70"
        >
          <ChevronRight className="w-6 h-6" />
        </button>
      )}
    </div>,
    document.body
  );
}
