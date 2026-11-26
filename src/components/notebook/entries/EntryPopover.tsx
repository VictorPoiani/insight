'use client';

import { useEffect, useRef, useState } from 'react';
import { ArrowUpRight, BookMarked, Columns2 } from 'lucide-react';
import { entryLook, type NotebookEntry } from '@/lib/notebook/entries';
import { Glyph } from '../icons/Glyph';

type State = { id: string; rect: DOMRect } | null;

/**
 * Prévia da menção: passar o mouse (ou tocar) num trecho vinculado
 * mostra o resumo, com "Ler mais" para a ficha/nota completa.
 */
export function EntryPopover({
  entries,
  targetTitle,
  onReadMore,
  onOpenSummary,
  onAside,
}: {
  entries: Record<string, NotebookEntry>;
  targetTitle: (id: string) => string | null;
  onReadMore: (entry: NotebookEntry) => void;
  onOpenSummary: (entryId: string) => void;
  /** abre a menção na tela dividida, ao lado do texto */
  onAside?: (entry: NotebookEntry) => void;
}) {
  const [state, setState] = useState<State>(null);
  const showT = useRef<number | null>(null);
  const hideT = useRef<number | null>(null);
  const cardRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const clear = () => {
      if (showT.current) window.clearTimeout(showT.current);
      if (hideT.current) window.clearTimeout(hideT.current);
      showT.current = null;
      hideT.current = null;
    };
    const refAt = (t: EventTarget | null) => (t as HTMLElement | null)?.closest?.('.nb-app [data-ref]') as HTMLElement | null;
    const over = (e: MouseEvent) => {
      const el = refAt(e.target);
      if (el) {
        clear();
        showT.current = window.setTimeout(() => setState({ id: el.dataset.ref || '', rect: el.getBoundingClientRect() }), 160);
      } else if (!(e.target as HTMLElement)?.closest?.('.nb-entry-pop')) {
        if (showT.current) window.clearTimeout(showT.current);
        showT.current = null;
        if (!hideT.current) hideT.current = window.setTimeout(() => ((hideT.current = null), setState(null)), 260);
      } else if (hideT.current) {
        window.clearTimeout(hideT.current);
        hideT.current = null;
      }
    };
    // toque: mostra ao tocar no trecho
    const click = (e: MouseEvent) => {
      if (!window.matchMedia('(pointer: coarse)').matches) return;
      const el = refAt(e.target);
      if (el) setState({ id: el.dataset.ref || '', rect: el.getBoundingClientRect() });
      else if (!(e.target as HTMLElement)?.closest?.('.nb-entry-pop')) setState(null);
    };
    const away = () => setState(null);
    document.addEventListener('mouseover', over);
    document.addEventListener('click', click);
    window.addEventListener('scroll', away, true);
    window.addEventListener('keydown', away);
    return () => {
      clear();
      document.removeEventListener('mouseover', over);
      document.removeEventListener('click', click);
      window.removeEventListener('scroll', away, true);
      window.removeEventListener('keydown', away);
    };
  }, []);

  if (!state) return null;
  const entry = entries[state.id];
  const look = entryLook(entry);
  const width = 320;
  const left = Math.max(12, Math.min(state.rect.left + state.rect.width / 2 - width / 2, window.innerWidth - width - 12));
  const below = state.rect.bottom + 230 < window.innerHeight;
  const style: React.CSSProperties = below ? { left, top: state.rect.bottom + 8, width } : { left, bottom: window.innerHeight - state.rect.top + 8, width };
  const target = entry?.target_id ? targetTitle(entry.target_id) : null;

  return (
    <div ref={cardRef} className="nb-entry-pop" style={style} role="tooltip">
      {entry ? (
        <>
          <div className="flex items-center gap-2.5">
            {entry.image_url ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={entry.image_url} alt="" className="w-10 h-10 rounded-xl object-cover border-2" style={{ borderColor: look.color }} />
            ) : (
              <span className="w-8 h-8 grid place-items-center rounded-lg text-[15px]" style={{ color: look.color, background: `color-mix(in srgb, ${look.color} 16%, transparent)` }}>
                <Glyph name={look.glyph} />
              </span>
            )}
            <span className="text-[10px] font-black uppercase tracking-wider" style={{ color: look.color }}>
              {look.label}
            </span>
          </div>
          <p className="mt-2 text-[15px] font-extrabold leading-snug">{entry.title}</p>
          <p className="mt-1 text-[13px] leading-relaxed text-[var(--nb-ink-2)] whitespace-pre-line max-h-40 overflow-y-auto nb-scroll">
            {entry.summary || 'Sem resumo ainda. Escreva um no Sumário.'}
          </p>
          <div className="mt-3 flex items-center gap-2">
            <button
              type="button"
              onClick={() => (setState(null), onReadMore(entry))}
              className="flex items-center gap-1 h-7 px-2.5 rounded-lg bg-[var(--nb-hl)] text-white text-[11px] font-bold hover:opacity-90"
            >
              Ler mais <ArrowUpRight className="w-3 h-3" />
            </button>
            {target && <span className="text-[11px] text-[var(--nb-ink-3)] truncate">{target}</span>}
            <span className="flex-1" />
            {onAside && (
              <button
                type="button"
                title="Abrir ao lado (Alt+clique)"
                aria-label="Abrir ao lado"
                onClick={() => (setState(null), onAside(entry))}
                className="p-1.5 rounded-md text-[var(--nb-ink-3)] hover:text-[var(--nb-ink)] hover:bg-[var(--nb-pane-2)]"
              >
                <Columns2 className="w-3.5 h-3.5" />
              </button>
            )}
            <button
              type="button"
              title="Abrir no Sumário"
              aria-label="Abrir no Sumário"
              onClick={() => (setState(null), onOpenSummary(entry.id))}
              className="p-1.5 rounded-md text-[var(--nb-ink-3)] hover:text-[var(--nb-ink)] hover:bg-[var(--nb-pane-2)]"
            >
              <BookMarked className="w-3.5 h-3.5" />
            </button>
          </div>
        </>
      ) : (
        <p className="text-[13px] text-[var(--nb-ink-3)]">Esta menção foi removida do Sumário.</p>
      )}
    </div>
  );
}
