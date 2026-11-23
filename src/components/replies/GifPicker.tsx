'use client';

import { useEffect, useRef, useState } from 'react';
import { Loader2, Search, X } from 'lucide-react';

interface GifItem {
  id: string;
  title: string;
  previewUrl: string;
  fullUrl: string;
  mp4Url: string | null;
  width: number;
  height: number;
}

/** Seletor compacto de GIFs (Giphy, com Tenor de reserva) para respostas. */
export function GifPicker({
  onPick,
  onClose,
}: {
  onPick: (gif: { url: string; previewUrl: string; width: number; height: number }) => void;
  onClose: () => void;
}) {
  const [q, setQ] = useState('');
  const [items, setItems] = useState<GifItem[]>([]);
  const [loading, setLoading] = useState(true);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const reqId = useRef(0);

  useEffect(() => {
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(async () => {
      const id = ++reqId.current;
      setLoading(true);
      try {
        const res = await fetch(`/api/giphy?${new URLSearchParams({ q, type: 'gifs', limit: '24' })}`);
        const json = await res.json();
        if (id === reqId.current) setItems(Array.isArray(json.items) ? json.items : []);
      } catch {
        if (id === reqId.current) setItems([]);
      } finally {
        if (id === reqId.current) setLoading(false);
      }
    }, q ? 350 : 0);
    return () => {
      if (timer.current) clearTimeout(timer.current);
    };
  }, [q]);

  return (
    <div className="rounded-xl bg-elevated border border-border overflow-hidden">
      <div className="flex items-center gap-2 px-2.5 py-2 border-b border-border">
        <Search className="w-3.5 h-3.5 text-muted shrink-0" />
        <input
          autoFocus
          value={q}
          onChange={(e) => setQ(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Escape') onClose();
            if (e.key === 'Enter') e.preventDefault();
          }}
          placeholder="Buscar GIFs..."
          className="flex-1 min-w-0 bg-transparent text-xs text-primary focus:outline-none"
        />
        <button type="button" onClick={onClose} aria-label="Fechar GIFs" className="p-0.5 text-muted hover:text-primary">
          <X className="w-3.5 h-3.5" />
        </button>
      </div>
      <div className="h-56 overflow-y-auto p-1.5">
        {loading && items.length === 0 ? (
          <div className="h-full grid place-items-center">
            <Loader2 className="w-5 h-5 text-muted animate-spin" />
          </div>
        ) : items.length === 0 ? (
          <p className="h-full grid place-items-center text-xs text-muted">Nenhum GIF encontrado.</p>
        ) : (
          <div className="columns-3 gap-1.5 [&>*]:mb-1.5">
            {items.map((g) => (
              <button
                key={g.id}
                type="button"
                title={g.title}
                onClick={() =>
                  onPick({ url: g.mp4Url || g.fullUrl, previewUrl: g.previewUrl, width: g.width, height: g.height })
                }
                className="block w-full rounded-lg overflow-hidden bg-surface hover:ring-2 hover:ring-accent focus-visible:ring-2 focus-visible:ring-accent outline-none"
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={g.previewUrl} alt={g.title} loading="lazy" className="w-full h-auto block" />
              </button>
            ))}
          </div>
        )}
      </div>
      <p className="px-2.5 py-1 text-[9px] text-muted text-right border-t border-border">via GIPHY</p>
    </div>
  );
}
