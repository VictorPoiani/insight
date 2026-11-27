'use client';

/**
 * Leitor final de uma publicação do Notebook — o mesmo na Prova Final e na
 * página pública. O HTML já vem limpo do servidor (sem segredos). Os termos do
 * Sumário abrem um balão ao passar o mouse (ou tocar), com "Ler mais".
 */
import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { entryLook } from '@/lib/notebook/entries';
import type { PublicEntry } from '@/lib/notebook/publication';
import { Glyph } from '../icons/Glyph';
import './publication.css';

export function PublicationView({
  title,
  html,
  entries,
  byline,
  readMoreBase,
  onReadMore,
}: {
  title: string;
  html: string;
  entries: Record<string, PublicEntry>;
  byline?: React.ReactNode;
  /** página pública: o "Ler mais" vai para readMoreBase + id */
  readMoreBase?: string;
  onReadMore?: (id: string) => void;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [pop, setPop] = useState<{ id: string; x: number; y: number; below: boolean } | null>(null);
  const hide = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    const root = ref.current;
    if (!root) return;
    // termos sem verbete público já vêm como texto; os outros ficam focáveis
    root.querySelectorAll<HTMLElement>('[data-ref]').forEach((el) => {
      if (entries[el.dataset.ref || '']) {
        el.tabIndex = 0;
        el.setAttribute('role', 'button');
        el.setAttribute('aria-label', `${el.textContent} — ver no Sumário`);
      }
    });
    const show = (el: HTMLElement) => {
      const id = el.dataset.ref || '';
      if (!entries[id]) return;
      if (hide.current) clearTimeout(hide.current);
      const r = el.getBoundingClientRect();
      const below = r.top < 260;
      setPop({ id, x: Math.min(Math.max(16, r.left + r.width / 2 - 160), window.innerWidth - 336), y: below ? r.bottom + 8 : r.top - 8, below });
    };
    const over = (e: Event) => {
      const el = (e.target as HTMLElement).closest?.('[data-ref]') as HTMLElement | null;
      if (el) show(el);
    };
    const out = (e: Event) => {
      if ((e.target as HTMLElement).closest?.('[data-ref]')) hide.current = setTimeout(() => setPop(null), 220);
    };
    const click = (e: Event) => {
      const el = (e.target as HTMLElement).closest?.('[data-ref]') as HTMLElement | null;
      if (el) show(el);
    };
    root.addEventListener('mouseover', over);
    root.addEventListener('mouseout', out);
    root.addEventListener('focusin', over);
    root.addEventListener('focusout', out);
    root.addEventListener('click', click);
    const close = () => setPop(null);
    window.addEventListener('scroll', close, true);
    return () => {
      root.removeEventListener('mouseover', over);
      root.removeEventListener('mouseout', out);
      root.removeEventListener('focusin', over);
      root.removeEventListener('focusout', out);
      root.removeEventListener('click', click);
      window.removeEventListener('scroll', close, true);
    };
  }, [html, entries]);

  const e = pop ? entries[pop.id] : null;
  const look = e ? entryLook({ kind: e.kind as never, category: e.category as never }) : null;

  return (
    <div className="pub">
      <header className="pub-head">
        <h1>{title}</h1>
        {byline && <div className="pub-byline">{byline}</div>}
      </header>
      <div ref={ref} className="pub-body" dangerouslySetInnerHTML={{ __html: html }} />
      {e && pop && look && (
        <div
          className="pub-pop"
          data-below={pop.below || undefined}
          style={{ left: pop.x, top: pop.y }}
          role="dialog"
          aria-label={e.title}
          onMouseEnter={() => hide.current && clearTimeout(hide.current)}
          onMouseLeave={() => setPop(null)}
        >
          {e.image_url && (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={e.image_url} alt="" />
          )}
          <div className="pub-pop-body">
            <span className="pub-pop-kind" style={{ color: look.color }}>
              <Glyph name={look.glyph} /> {look.label}
            </span>
            <strong>{e.title}</strong>
            {e.summary && <p>{e.summary}</p>}
            {readMoreBase ? (
              <Link href={`${readMoreBase}${e.id}`} className="pub-pop-more">
                Ler mais
              </Link>
            ) : onReadMore ? (
              <button type="button" className="pub-pop-more" onClick={() => onReadMore(e.id)}>
                Ler mais
              </button>
            ) : null}
          </div>
        </div>
      )}
    </div>
  );
}

/** Página de um verbete (o "Ler mais"). */
export function PublicEntryView({ entry, backHref, onBack }: { entry: PublicEntry; backHref?: string; onBack?: () => void }) {
  const look = entryLook({ kind: entry.kind as never, category: entry.category as never });
  return (
    <div className="pub pub-entry">
      {backHref ? (
        <Link href={backHref} className="pub-back">
          ← Voltar ao texto
        </Link>
      ) : onBack ? (
        <button type="button" className="pub-back" onClick={onBack}>
          ← Voltar ao texto
        </button>
      ) : null}
      <span className="pub-pop-kind" style={{ color: look.color }}>
        <Glyph name={look.glyph} /> {look.label}
      </span>
      <h1>{entry.title}</h1>
      {entry.aliases?.length ? <p className="pub-entry-alias">Também chamado de {entry.aliases.join(', ')}</p> : null}
      {entry.image_url && (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={entry.image_url} alt="" className="pub-entry-img" />
      )}
      <p className="pub-entry-summary">{entry.summary || 'Sem resumo.'}</p>
    </div>
  );
}
