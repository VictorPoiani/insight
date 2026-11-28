'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Search, X } from 'lucide-react';

type Emoji = { u: string; label: string; tags: string; group: number };

// grupos do emojibase (2 = componentes, fora da galeria)
const GROUPS: { id: number; label: string; icon: string }[] = [
  { id: -1, label: 'Recentes', icon: '🕘' },
  { id: 0, label: 'Carinhas e emoções', icon: '😀' },
  { id: 1, label: 'Pessoas e corpo', icon: '👋' },
  { id: 3, label: 'Animais e natureza', icon: '🐻' },
  { id: 4, label: 'Comida e bebida', icon: '🍕' },
  { id: 5, label: 'Viagens e lugares', icon: '✈️' },
  { id: 6, label: 'Atividades', icon: '⚽' },
  { id: 7, label: 'Objetos', icon: '💡' },
  { id: 8, label: 'Símbolos', icon: '❤️' },
  { id: 9, label: 'Bandeiras', icon: '🏳️' },
];

let dataPromise: Promise<Emoji[]> | null = null;
/** Lista completa em português, baixada só na primeira vez que a galeria abre. */
function loadEmojis() {
  dataPromise ??= import('emojibase-data/pt/compact.json').then((mod) => {
    const raw = (mod.default || mod) as { unicode: string; label: string; tags?: string[]; group?: number; order?: number }[];
    return raw
      .filter((e) => typeof e.group === 'number' && e.group !== 2)
      .sort((a, b) => (a.order ?? 0) - (b.order ?? 0))
      .map((e) => ({
        u: e.unicode,
        label: e.label,
        tags: [e.label, ...(e.tags || [])].join(' ').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, ''),
        group: e.group as number,
      }));
  });
  return dataPromise;
}

const norm = (s: string) => s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').trim();

/** Galeria completa de emojis (busca em português + categorias). */
export function EmojiGallery({
  recent,
  onPick,
  onClose,
}: {
  recent: string[];
  onPick: (emoji: string) => void;
  onClose: () => void;
}) {
  const [all, setAll] = useState<Emoji[] | null>(null);
  const [failed, setFailed] = useState(false);
  const [q, setQ] = useState('');
  const [group, setGroup] = useState<number>(recent.length ? -1 : 0);
  const gridRef = useRef<HTMLDivElement>(null);
  const searchRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    let alive = true;
    loadEmojis()
      .then((d) => alive && setAll(d))
      .catch(() => alive && setFailed(true));
    const t = setTimeout(() => searchRef.current?.focus(), 50);
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    return () => {
      alive = false;
      clearTimeout(t);
      window.removeEventListener('keydown', onKey);
    };
  }, [onClose]);

  const shown = useMemo(() => {
    if (!all) return [];
    const term = norm(q);
    if (term) return all.filter((e) => e.tags.includes(term)).slice(0, 240);
    if (group === -1) {
      const byChar = new Map(all.map((e) => [e.u, e]));
      return recent.map((u) => byChar.get(u) || { u, label: u, tags: '', group: -1 });
    }
    return all.filter((e) => e.group === group);
  }, [all, q, group, recent]);

  useEffect(() => {
    gridRef.current?.scrollTo({ top: 0 });
  }, [group, q]);

  return createPortal(
    <div className="fixed inset-0 z-[150] flex items-end sm:items-center justify-center bg-black/40 p-0 sm:p-4" onClick={onClose}>
      <div
        role="dialog"
        aria-label="Escolher emoji"
        onClick={(e) => e.stopPropagation()}
        className="w-full sm:w-[360px] h-[70vh] sm:h-[420px] flex flex-col rounded-t-3xl sm:rounded-2xl bg-surface border border-border shadow-2xl overflow-hidden insight-dialog-in"
      >
        <div className="flex items-center gap-2 px-3 pt-3 pb-2">
          <div className="relative flex-1">
            <Search className="w-4 h-4 text-muted absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
            <input
              ref={searchRef}
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Buscar emoji (ex.: coração, risada)"
              className="w-full h-9 pl-9 pr-3 rounded-full bg-background border border-border text-sm text-primary placeholder:text-muted focus:outline-none focus:border-accent"
            />
          </div>
          <button type="button" onClick={onClose} aria-label="Fechar" className="p-1.5 rounded-full text-muted hover:text-primary hover:bg-elevated">
            <X className="w-4 h-4" />
          </button>
        </div>

        {!q && (
          <div className="flex items-center gap-0.5 px-2 pb-1.5 border-b border-border overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
            {GROUPS.filter((g) => g.id !== -1 || recent.length).map((g) => (
              <button
                key={g.id}
                type="button"
                title={g.label}
                aria-label={g.label}
                aria-pressed={group === g.id}
                onClick={() => setGroup(g.id)}
                className={`shrink-0 w-9 h-9 grid place-items-center rounded-lg text-lg transition-colors ${
                  group === g.id ? 'bg-accent/15' : 'opacity-70 hover:opacity-100 hover:bg-elevated'
                }`}
              >
                {g.icon}
              </button>
            ))}
          </div>
        )}

        <div ref={gridRef} className="flex-1 overflow-y-auto px-2 py-2">
          {failed ? (
            <p className="py-10 text-center text-xs text-muted">Não foi possível carregar os emojis agora.</p>
          ) : !all ? (
            <p className="py-10 text-center text-xs text-muted">Carregando emojis…</p>
          ) : shown.length === 0 ? (
            <p className="py-10 text-center text-xs text-muted">Nenhum emoji encontrado.</p>
          ) : (
            <>
              <p className="px-1 pb-1 text-[11px] font-semibold text-muted">
                {q ? 'Resultados' : GROUPS.find((g) => g.id === group)?.label}
              </p>
              <div className="grid grid-cols-8 gap-0.5">
                {shown.map((e) => (
                  <button
                    key={e.u}
                    type="button"
                    title={e.label}
                    aria-label={e.label}
                    onClick={() => onPick(e.u)}
                    className="aspect-square grid place-items-center rounded-lg text-[22px] leading-none hover:bg-elevated hover:scale-110 transition-transform"
                  >
                    {e.u}
                  </button>
                ))}
              </div>
            </>
          )}
        </div>
      </div>
    </div>,
    document.body
  );
}
