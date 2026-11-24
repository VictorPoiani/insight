'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { ZoomIn, ZoomOut, Maximize2, Minimize2, Scan } from '@/components/icons';

/**
 * Navegação 2D (arrastar + zoom) para quadros: mapa mental dos posts, editor
 * e workspace de tópicos.
 *
 * - Mouse: arrastar o fundo move; Ctrl/⌘ + roda (ou pinça no trackpad) dá zoom
 *   no ponto do cursor. Em modo `wheel: 'free'` (tela cheia/editor) a roda
 *   sozinha move o quadro, como no Figma.
 * - Toque: um dedo arrasta (na vertical a página continua rolando quando o
 *   quadro está embutido no feed); dois dedos dão zoom e movem ao mesmo tempo.
 * - Teclado (com o quadro focado): + / − zoom, 0 ajustar, setas movem.
 *
 * O conteúdo é um "mundo" de worldWidth × worldHeight px; o visor aplica
 * translate + scale. Elementos que não devem iniciar o arrasto do fundo levam
 * `data-pz-stop` (cartões, botões, campos).
 */

export interface View {
  x: number;
  y: number;
  k: number;
}

export interface Bounds {
  x0: number;
  y0: number;
  x1: number;
  y1: number;
}

const STOP_SELECTOR = '[data-pz-stop],button,input,textarea,select,a,[contenteditable="true"]';

export function usePanZoom({
  worldWidth,
  worldHeight,
  minZoom = 0.2,
  maxZoom = 2.5,
  wheel = 'ctrl',
  initialBounds,
}: {
  worldWidth: number;
  worldHeight: number;
  minZoom?: number;
  maxZoom?: number;
  /** 'ctrl': roda rola a página e Ctrl+roda dá zoom; 'free': roda move, Ctrl+roda dá zoom */
  wheel?: 'ctrl' | 'free';
  /** Área a enquadrar ao abrir (px do mundo). Padrão: o mundo inteiro. */
  initialBounds?: Bounds | null;
}) {
  const viewportRef = useRef<HTMLDivElement | null>(null);
  const [view, setViewState] = useState<View>({ x: 0, y: 0, k: 1 });
  const viewRef = useRef(view);
  const [panning, setPanning] = useState(false);
  const [hint, setHint] = useState(false);
  const hintTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pointers = useRef(new Map<number, { x: number; y: number }>());
  const gesture = useRef<{ x: number; y: number; dist: number; view: View } | null>(null);
  const fitted = useRef(false);
  const wheelRef = useRef(wheel);
  wheelRef.current = wheel;

  const clampK = useCallback((k: number) => Math.max(minZoom, Math.min(maxZoom, k)), [minZoom, maxZoom]);

  const setView = useCallback((v: View | ((p: View) => View)) => {
    setViewState((prev) => {
      const next = typeof v === 'function' ? v(prev) : v;
      viewRef.current = next;
      return next;
    });
  }, []);

  /** Zoom mantendo fixo o ponto (cx, cy) do visor. */
  const zoomAt = useCallback(
    (factor: number, cx?: number, cy?: number) => {
      const el = viewportRef.current;
      setView((p) => {
        const k = clampK(p.k * factor);
        const px = cx ?? (el ? el.clientWidth / 2 : 0);
        const py = cy ?? (el ? el.clientHeight / 2 : 0);
        const wx = (px - p.x) / p.k;
        const wy = (py - p.y) / p.k;
        return { k, x: px - wx * k, y: py - wy * k };
      });
    },
    [clampK, setView]
  );

  const fit = useCallback(
    (b?: Bounds | null, maxK = 1) => {
      const el = viewportRef.current;
      if (!el) return;
      const bounds = b ?? { x0: 0, y0: 0, x1: worldWidth, y1: worldHeight };
      const pad = 24;
      const bw = Math.max(1, bounds.x1 - bounds.x0);
      const bh = Math.max(1, bounds.y1 - bounds.y0);
      const k = clampK(Math.min((el.clientWidth - pad * 2) / bw, (el.clientHeight - pad * 2) / bh, maxK));
      setView({
        k,
        x: (el.clientWidth - bw * k) / 2 - bounds.x0 * k,
        y: (el.clientHeight - bh * k) / 2 - bounds.y0 * k,
      });
    },
    [worldWidth, worldHeight, clampK, setView]
  );

  // enquadra ao montar e quando o visor muda de tamanho pela primeira vez
  useEffect(() => {
    const el = viewportRef.current;
    if (!el) return;
    const ro = new ResizeObserver(() => {
      if (!fitted.current && el.clientWidth > 0) {
        fitted.current = true;
        fit(initialBounds);
      }
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, [fit, initialBounds]);

  const showHint = useCallback(() => {
    setHint(true);
    if (hintTimer.current) clearTimeout(hintTimer.current);
    hintTimer.current = setTimeout(() => setHint(false), 1400);
  }, []);

  // roda do mouse / pinça do trackpad (listener nativo: precisa de passive:false)
  useEffect(() => {
    const el = viewportRef.current;
    if (!el) return;
    const onWheel = (e: WheelEvent) => {
      const r = el.getBoundingClientRect();
      const cx = e.clientX - r.left;
      const cy = e.clientY - r.top;
      if (e.ctrlKey || e.metaKey) {
        e.preventDefault();
        const delta = e.deltaMode === 1 ? e.deltaY * 16 : e.deltaY;
        zoomAt(Math.exp(-delta * 0.0022), cx, cy);
      } else if (wheelRef.current === 'free') {
        e.preventDefault();
        setView((p) => ({ ...p, x: p.x - e.deltaX, y: p.y - e.deltaY }));
      } else {
        showHint();
      }
    };
    el.addEventListener('wheel', onWheel, { passive: false });
    return () => el.removeEventListener('wheel', onWheel);
  }, [zoomAt, setView, showHint]);

  useEffect(() => () => {
    if (hintTimer.current) clearTimeout(hintTimer.current);
  }, []);

  const startGesture = () => {
    const pts = [...pointers.current.values()];
    if (pts.length === 0) {
      gesture.current = null;
      return;
    }
    const cx = pts.reduce((s, p) => s + p.x, 0) / pts.length;
    const cy = pts.reduce((s, p) => s + p.y, 0) / pts.length;
    const dist = pts.length >= 2 ? Math.hypot(pts[0].x - pts[1].x, pts[0].y - pts[1].y) : 0;
    gesture.current = { x: cx, y: cy, dist, view: viewRef.current };
  };

  const onPointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    if (e.button !== 0 && e.pointerType === 'mouse') return;
    if ((e.target as HTMLElement).closest(STOP_SELECTOR) && pointers.current.size === 0) return;
    const r = e.currentTarget.getBoundingClientRect();
    pointers.current.set(e.pointerId, { x: e.clientX - r.left, y: e.clientY - r.top });
    e.currentTarget.setPointerCapture?.(e.pointerId);
    setPanning(true);
    startGesture();
  };

  const onPointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!pointers.current.has(e.pointerId)) return;
    const r = e.currentTarget.getBoundingClientRect();
    pointers.current.set(e.pointerId, { x: e.clientX - r.left, y: e.clientY - r.top });
    const g = gesture.current;
    if (!g) return;
    const pts = [...pointers.current.values()];
    const cx = pts.reduce((s, p) => s + p.x, 0) / pts.length;
    const cy = pts.reduce((s, p) => s + p.y, 0) / pts.length;
    let k = g.view.k;
    if (pts.length >= 2 && g.dist > 0) {
      const dist = Math.hypot(pts[0].x - pts[1].x, pts[0].y - pts[1].y);
      k = clampK(g.view.k * (dist / g.dist));
    }
    // ponto do mundo sob o centro inicial do gesto acompanha o centro atual
    const wx = (g.x - g.view.x) / g.view.k;
    const wy = (g.y - g.view.y) / g.view.k;
    setView({ k, x: cx - wx * k, y: cy - wy * k });
  };

  const endPointer = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!pointers.current.delete(e.pointerId)) return;
    if (pointers.current.size === 0) setPanning(false);
    startGesture(); // ao tirar um dedo, o outro continua arrastando sem pular
  };

  const onKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
    if ((e.target as HTMLElement).closest('input,textarea,[contenteditable="true"]')) return;
    const step = 60;
    const map: Record<string, () => void> = {
      '+': () => zoomAt(1.2),
      '=': () => zoomAt(1.2),
      '-': () => zoomAt(1 / 1.2),
      '0': () => fit(initialBounds),
      ArrowLeft: () => setView((p) => ({ ...p, x: p.x + step })),
      ArrowRight: () => setView((p) => ({ ...p, x: p.x - step })),
      ArrowUp: () => setView((p) => ({ ...p, y: p.y + step })),
      ArrowDown: () => setView((p) => ({ ...p, y: p.y - step })),
    };
    if (map[e.key]) {
      e.preventDefault();
      map[e.key]();
    }
  };

  return {
    viewportRef,
    view,
    panning,
    hint,
    zoomIn: () => zoomAt(1.25),
    zoomOut: () => zoomAt(1 / 1.25),
    zoomAt,
    fit,
    setView,
    /** props para o elemento visor */
    viewportProps: {
      ref: viewportRef,
      tabIndex: 0,
      onPointerDown,
      onPointerMove,
      onPointerUp: endPointer,
      onPointerCancel: endPointer,
      onKeyDown,
    },
    /** estilo do "mundo" transformado */
    worldStyle: {
      width: worldWidth,
      height: worldHeight,
      transform: `translate3d(${view.x}px, ${view.y}px, 0) scale(${view.k})`,
      transformOrigin: '0 0',
      willChange: panning ? 'transform' : undefined,
    } as React.CSSProperties,
  };
}

/** Converte nós em % do mundo para a área (px) que os contém, com margem. */
export function boundsFromPercent(
  points: { x: number; y: number }[],
  worldWidth: number,
  worldHeight: number,
  marginX = 130,
  marginY = 90
): Bounds | null {
  if (!points.length) return null;
  const xs = points.map((p) => (p.x / 100) * worldWidth);
  const ys = points.map((p) => (p.y / 100) * worldHeight);
  return {
    x0: Math.max(0, Math.min(...xs) - marginX),
    y0: Math.max(0, Math.min(...ys) - marginY),
    x1: Math.min(worldWidth, Math.max(...xs) + marginX),
    y1: Math.min(worldHeight, Math.max(...ys) + marginY),
  };
}

export function PanZoomControls({
  k,
  onZoomIn,
  onZoomOut,
  onFit,
  fullscreen,
  onToggleFullscreen,
  className = '',
}: {
  k: number;
  onZoomIn: () => void;
  onZoomOut: () => void;
  onFit: () => void;
  fullscreen?: boolean;
  onToggleFullscreen?: () => void;
  className?: string;
}) {
  const btn = 'p-1.5 rounded-lg text-zinc-300 hover:text-white hover:bg-white/10 transition-colors';
  return (
    <div
      data-pz-stop
      className={`flex items-center gap-0.5 p-1 rounded-xl bg-[#141417]/90 backdrop-blur border border-zinc-800 shadow-xl ${className}`}
    >
      <button type="button" onClick={onZoomOut} aria-label="Afastar" title="Afastar (−)" className={btn}>
        <ZoomOut className="w-3.5 h-3.5" />
      </button>
      <span className="w-11 text-center font-mono text-[10px] font-bold text-zinc-200 tabular-nums">{Math.round(k * 100)}%</span>
      <button type="button" onClick={onZoomIn} aria-label="Aproximar" title="Aproximar (+)" className={btn}>
        <ZoomIn className="w-3.5 h-3.5" />
      </button>
      <span className="w-px h-3.5 bg-zinc-700 mx-0.5" />
      <button type="button" onClick={onFit} aria-label="Ajustar à tela" title="Ajustar à tela (0)" className={btn}>
        <Scan className="w-3.5 h-3.5" />
      </button>
      {onToggleFullscreen && (
        <button
          type="button"
          onClick={onToggleFullscreen}
          aria-label={fullscreen ? 'Sair da tela cheia' : 'Tela cheia'}
          title={fullscreen ? 'Sair da tela cheia' : 'Tela cheia'}
          className={btn}
        >
          {fullscreen ? <Minimize2 className="w-3.5 h-3.5" /> : <Maximize2 className="w-3.5 h-3.5" />}
        </button>
      )}
    </div>
  );
}

/**
 * Superfície pronta: visor + mundo transformado + controles + tela cheia.
 * `worldRef` aponta para o mundo (o getBoundingClientRect dele já considera o
 * zoom, então cálculos de arraste em % continuam corretos).
 */
export function PanZoomSurface({
  worldWidth,
  worldHeight,
  bounds,
  heightClass = 'h-[380px]',
  worldRef,
  onBackgroundClick,
  children,
  overlay,
  gridSize = 18,
}: {
  worldWidth: number;
  worldHeight: number;
  bounds?: Bounds | null;
  heightClass?: string;
  worldRef?: (el: HTMLDivElement | null) => void;
  onBackgroundClick?: () => void;
  children: React.ReactNode;
  overlay?: React.ReactNode;
  gridSize?: number;
}) {
  const [full, setFull] = useState(false);
  const pz = usePanZoom({ worldWidth, worldHeight, wheel: 'free', initialBounds: bounds });
  const down = useRef<{ x: number; y: number } | null>(null);

  useEffect(() => {
    if (!full) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setFull(false);
    window.addEventListener('keydown', onKey);
    const t = setTimeout(() => pz.fit(bounds), 30);
    return () => {
      clearTimeout(t);
      document.body.style.overflow = prev;
      window.removeEventListener('keydown', onKey);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [full]);

  return (
    <div
      {...pz.viewportProps}
      onPointerDownCapture={(e) => {
        down.current = { x: e.clientX, y: e.clientY };
      }}
      onClick={(e) => {
        // clique "parado" no fundo (não um arrasto) limpa a seleção
        const d = down.current;
        if (!onBackgroundClick || !d) return;
        if (Math.hypot(e.clientX - d.x, e.clientY - d.y) > 5) return;
        if ((e.target as HTMLElement).closest(STOP_SELECTOR)) return;
        onBackgroundClick();
      }}
      style={{
        touchAction: 'none',
        backgroundImage: 'radial-gradient(rgba(161,161,170,0.16) 1px, transparent 1px)',
        backgroundSize: `${gridSize * pz.view.k}px ${gridSize * pz.view.k}px`,
        backgroundPosition: `${pz.view.x}px ${pz.view.y}px`,
      }}
      className={`overflow-hidden bg-[#09090b] select-none outline-none focus-visible:ring-2 focus-visible:ring-accent ${
        full ? 'fixed inset-0 z-[200]' : `relative w-full ${heightClass} rounded-xl border border-border`
      } ${pz.panning ? 'cursor-grabbing' : 'cursor-grab'}`}
    >
      <div ref={worldRef} style={pz.worldStyle} className="absolute left-0 top-0">
        {children}
      </div>
      {overlay}
      <PanZoomControls
        k={pz.view.k}
        onZoomIn={pz.zoomIn}
        onZoomOut={pz.zoomOut}
        onFit={() => pz.fit(bounds)}
        fullscreen={full}
        onToggleFullscreen={() => setFull((f) => !f)}
        className="absolute bottom-2.5 right-2.5 z-30"
      />
    </div>
  );
}
