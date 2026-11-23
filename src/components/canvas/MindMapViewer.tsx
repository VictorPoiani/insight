'use client';

import { useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import { Network, Move } from 'lucide-react';
import { usePanZoom, PanZoomControls, boundsFromPercent } from './PanZoom';

export interface ViewerNode {
  id: string;
  label: string;
  note?: string;
  x: number; // % do mundo
  y: number;
  color?: string;
  mediaUrl?: string;
}
export interface ViewerEdge {
  id: string;
  fromId: string;
  toId: string;
}

export const MINDMAP_WORLD = { width: 1100, height: 680 };

function Board({
  nodes,
  edges,
  fullscreen,
  onToggleFullscreen,
}: {
  nodes: ViewerNode[];
  edges: ViewerEdge[];
  fullscreen: boolean;
  onToggleFullscreen: () => void;
}) {
  const { width: W, height: H } = MINDMAP_WORLD;
  const bounds = useMemo(() => boundsFromPercent(nodes, W, H), [nodes, W, H]);
  const pz = usePanZoom({ worldWidth: W, worldHeight: H, wheel: fullscreen ? 'free' : 'ctrl', initialBounds: bounds });
  const byId = useMemo(() => new Map(nodes.map((n) => [n.id, n])), [nodes]);

  return (
    <div
      {...pz.viewportProps}
      aria-label="Mapa mental: arraste para mover, pinça ou Ctrl + roda para zoom"
      style={{
        touchAction: fullscreen ? 'none' : 'pan-y',
        backgroundImage: 'radial-gradient(rgba(161,161,170,0.16) 1px, transparent 1px)',
        backgroundSize: `${18 * pz.view.k}px ${18 * pz.view.k}px`,
        backgroundPosition: `${pz.view.x}px ${pz.view.y}px`,
      }}
      className={`relative overflow-hidden bg-[#09090b] outline-none focus-visible:ring-2 focus-visible:ring-accent ${
        fullscreen ? 'w-full h-full' : 'w-full h-[340px] sm:h-[400px] rounded-xl border border-border'
      } ${pz.panning ? 'cursor-grabbing' : 'cursor-grab'}`}
    >
      <div style={pz.worldStyle} className="absolute left-0 top-0">
        <svg className="absolute inset-0 pointer-events-none" width={W} height={H}>
          {edges.map((edge) => {
            const a = byId.get(edge.fromId);
            const b = byId.get(edge.toId);
            if (!a || !b) return null;
            return (
              <line
                key={edge.id}
                x1={(a.x / 100) * W}
                y1={(a.y / 100) * H}
                x2={(b.x / 100) * W}
                y2={(b.y / 100) * H}
                stroke={a.color || '#52525b'}
                strokeWidth={1.5}
                strokeDasharray="4 3"
                opacity={0.75}
              />
            );
          })}
        </svg>
        {nodes.map((node, i) => (
          <div
            key={node.id}
            style={{ left: `${node.x}%`, top: `${node.y}%`, transform: 'translate(-50%, -50%)' }}
            className="absolute z-10 w-48 p-2.5 rounded-xl bg-[#121215]/95 border border-zinc-800 shadow-xl space-y-1"
          >
            <div className="flex items-center gap-1.5 pb-1 border-b border-zinc-800/80">
              <span style={{ backgroundColor: node.color || '#2563eb' }} className="w-2 h-2 rounded-full shrink-0" />
              <span className="text-[9px] font-mono font-semibold text-zinc-400">NÓ · {String(i).padStart(2, '0')}</span>
            </div>
            <p className="text-xs font-bold text-zinc-100 leading-snug">{node.label}</p>
            {node.note && <p className="text-[10px] text-zinc-400 leading-tight">{node.note}</p>}
            {node.mediaUrl && (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={node.mediaUrl} alt="" loading="lazy" draggable={false} className="mt-1 w-full max-h-28 object-cover rounded-lg border border-zinc-800" />
            )}
          </div>
        ))}
      </div>

      {pz.hint && (
        <div className="absolute inset-x-0 top-3 flex justify-center pointer-events-none">
          <span className="px-3 py-1.5 rounded-full bg-black/80 text-white text-[11px] font-semibold">
            Use Ctrl + roda (ou pinça) para aproximar
          </span>
        </div>
      )}

      <PanZoomControls
        k={pz.view.k}
        onZoomIn={pz.zoomIn}
        onZoomOut={pz.zoomOut}
        onFit={() => pz.fit(bounds)}
        fullscreen={fullscreen}
        onToggleFullscreen={onToggleFullscreen}
        className="absolute bottom-2.5 right-2.5 z-20"
      />
    </div>
  );
}

/** Mapa mental 2D somente leitura (posts), com zoom/arraste e tela cheia. */
export function MindMapViewer({ nodes, edges }: { nodes: ViewerNode[]; edges: ViewerEdge[] }) {
  const [full, setFull] = useState(false);

  useEffect(() => {
    if (!full) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setFull(false);
    window.addEventListener('keydown', onKey);
    return () => {
      document.body.style.overflow = prev;
      window.removeEventListener('keydown', onKey);
    };
  }, [full]);

  return (
    <div onClick={(e) => e.stopPropagation()}>
      <div className="flex items-center justify-between text-xs mb-2.5">
        <span className="font-bold text-primary uppercase tracking-wider text-[11px] flex items-center gap-1.5">
          <Network className="w-3.5 h-3.5 text-[#a855f7]" />
          <span>Arquitetura & Brainstorm 2D</span>
        </span>
        <span className="text-[10px] font-mono text-muted flex items-center gap-1.5">
          <Move className="w-3 h-3" /> {nodes.length} nós
        </span>
      </div>
      {!full && <Board nodes={nodes} edges={edges} fullscreen={false} onToggleFullscreen={() => setFull(true)} />}
      {full &&
        createPortal(
          <div className="fixed inset-0 z-[200] bg-[#09090b]" role="dialog" aria-modal="true" aria-label="Mapa mental em tela cheia">
            <Board nodes={nodes} edges={edges} fullscreen onToggleFullscreen={() => setFull(false)} />
          </div>,
          document.body
        )}
    </div>
  );
}
