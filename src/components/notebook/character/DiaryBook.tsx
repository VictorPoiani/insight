'use client';

import { useEffect, useState } from 'react';
import { ChevronLeft, ChevronRight, Plus, Trash2 } from 'lucide-react';
import { newId, type DiaryEntry } from '@/lib/notebook/character';

const SERIF = "var(--nb-literata), Georgia, 'Times New Roman', serif";
const PAPER_KEY = 'insight-nb-diary-paper';
type Paper = 'claro' | 'sepia' | 'noite';

function fmtDate(iso: string) {
  const d = new Date(`${iso}T12:00:00`);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleDateString('pt-BR', { day: 'numeric', month: 'long', year: 'numeric' });
}

/**
 * Diário do personagem em forma de livro: páginas pautadas, uma entrada por
 * página, duas páginas abertas no computador e uma no celular, com virada de página.
 */
export function DiaryBook({
  diary,
  onChange,
  characterName,
}: {
  diary: DiaryEntry[];
  onChange: (next: DiaryEntry[], debounce?: number) => void;
  characterName: string;
}) {
  const [wide, setWide] = useState(true);
  const [spread, setSpread] = useState(0);
  const [dir, setDir] = useState<'next' | 'prev'>('next');
  const [paper, setPaper] = useState<Paper>('sepia');

  useEffect(() => {
    const mq = window.matchMedia('(min-width: 768px)');
    const on = () => setWide(mq.matches);
    on();
    mq.addEventListener('change', on);
    try {
      const p = localStorage.getItem(PAPER_KEY) as Paper | null;
      if (p === 'claro' || p === 'sepia' || p === 'noite') setPaper(p);
    } catch {
      /* sem armazenamento: fica o padrão */
    }
    return () => mq.removeEventListener('change', on);
  }, []);

  const per = wide ? 2 : 1;
  // páginas: capa interna (folha de rosto) + uma por entrada
  const pages: (DiaryEntry | 'rosto')[] = ['rosto', ...diary];
  const spreads = Math.max(1, Math.ceil((pages.length + 1) / per)); // +1 = página em branco para escrever
  const cur = Math.min(spread, spreads - 1);

  const turn = (n: number) => {
    const t = Math.max(0, Math.min(spreads - 1, n));
    if (t === cur) return;
    setDir(t > cur ? 'next' : 'prev');
    setSpread(t);
  };

  const addPage = () => {
    const today = new Date().toISOString().slice(0, 10);
    const next = [...diary, { id: newId(), date: today, text: '' }];
    onChange(next, 0);
    const idx = next.length; // posição em "pages"
    setDir('next');
    setSpread(Math.floor(idx / per));
  };

  const setEntry = (id: string, patch: Partial<DiaryEntry>, debounce?: number) =>
    onChange(diary.map((e) => (e.id === id ? { ...e, ...patch } : e)), debounce);

  const choosePaper = (p: Paper) => {
    setPaper(p);
    try {
      localStorage.setItem(PAPER_KEY, p);
    } catch {
      /* ignora */
    }
  };

  const slots = Array.from({ length: per }, (_, k) => cur * per + k);

  return (
    <div>
      <div className="nb-diary" data-paper={paper}>
        <div key={`${cur}-${per}`} className={`nb-diary-book ${dir === 'next' ? 'nb-turn-next' : 'nb-turn-prev'}`} data-wide={wide}>
          {slots.map((pi, k) => {
            const pg = pages[pi];
            const side = wide ? (k === 0 ? 'left' : 'right') : 'single';
            return (
              <div key={pi} className="nb-diary-page" data-side={side}>
                {pg === 'rosto' ? (
                  <div className="h-full flex flex-col items-center justify-center text-center px-6">
                    <p className="text-[10px] font-bold uppercase tracking-[0.35em] text-[var(--paper-ink-2)]">Diário de</p>
                    <p className="mt-3 text-2xl sm:text-3xl" style={{ fontFamily: SERIF }}>
                      {characterName || 'Sem nome'}
                    </p>
                    <span aria-hidden className="mt-4 text-2xl text-[var(--nb-hl)]">
                      *
                    </span>
                    <p className="mt-6 max-w-[16rem] text-[13px] italic text-[var(--paper-ink-2)]" style={{ fontFamily: SERIF }}>
                      Escreva como ele escreveria: o jeito de pensar, de falar, até os erros.
                    </p>
                  </div>
                ) : pg ? (
                  <div className="group h-full flex flex-col">
                    <div className="flex items-center gap-2">
                      <input
                        type="date"
                        value={pg.date}
                        aria-label="Data da página"
                        onChange={(ev) => setEntry(pg.id, { date: ev.target.value || pg.date }, 0)}
                        className="nb-diary-date"
                        title={fmtDate(pg.date)}
                      />
                      <span className="flex-1 text-[12px] italic text-[var(--paper-ink-2)] truncate" style={{ fontFamily: SERIF }}>
                        {fmtDate(pg.date)}
                      </span>
                      <button
                        type="button"
                        aria-label="Arrancar esta página"
                        title="Arrancar esta página"
                        onClick={() => {
                          if (pg.text.trim() && !confirm('Arrancar esta página do diário?')) return;
                          onChange(
                            diary.filter((e) => e.id !== pg.id),
                            0
                          );
                        }}
                        className="opacity-0 group-hover:opacity-100 focus:opacity-100 p-1 rounded text-[var(--paper-ink-2)] hover:text-red-500"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                    <textarea
                      value={pg.text}
                      onChange={(e) => setEntry(pg.id, { text: e.target.value })}
                      placeholder="Querido diário…"
                      aria-label={`Página de ${fmtDate(pg.date)}`}
                      className="nb-diary-text"
                      style={{ fontFamily: SERIF }}
                    />
                  </div>
                ) : (
                  <button type="button" onClick={addPage} className="h-full w-full flex flex-col items-center justify-center gap-2 text-[var(--paper-ink-2)] hover:text-[var(--paper-ink)]">
                    <span className="w-10 h-10 rounded-full border border-dashed border-current grid place-items-center">
                      <Plus className="w-4 h-4" />
                    </span>
                    <span className="text-[13px] italic" style={{ fontFamily: SERIF }}>
                      {diary.length ? 'Escrever uma nova página' : 'Escrever a primeira página'}
                    </span>
                  </button>
                )}
                {pg && pg !== 'rosto' && <span className="nb-diary-num">{pi}</span>}
              </div>
            );
          })}
        </div>
      </div>

      <div className="mt-3 flex items-center gap-1 sm:gap-2">
        <button
          type="button"
          aria-label="Página anterior"
          disabled={cur === 0}
          onClick={() => turn(cur - 1)}
          className="p-1.5 rounded-lg text-[var(--nb-ink-2)] hover:bg-[var(--nb-pane-2)] disabled:opacity-30"
        >
          <ChevronLeft className="w-4 h-4" />
        </button>
        <span className="whitespace-nowrap text-[11px] font-bold tabular-nums text-[var(--nb-ink-3)]">
          {diary.length ? `${diary.length} ${diary.length === 1 ? 'página' : 'páginas'}` : 'Diário em branco'}
        </span>
        <button
          type="button"
          aria-label="Próxima página"
          disabled={cur >= spreads - 1}
          onClick={() => turn(cur + 1)}
          className="p-1.5 rounded-lg text-[var(--nb-ink-2)] hover:bg-[var(--nb-pane-2)] disabled:opacity-30"
        >
          <ChevronRight className="w-4 h-4" />
        </button>
        <span className="flex-1" />
        <div className="flex items-center gap-1" role="radiogroup" aria-label="Papel do diário">
          {(
            [
              ['claro', '#fbf8f1'],
              ['sepia', '#f3e7cf'],
              ['noite', '#17171c'],
            ] as const
          ).map(([p, c]) => (
            <button
              key={p}
              type="button"
              role="radio"
              aria-checked={paper === p}
              aria-label={`Papel ${p}`}
              title={`Papel ${p}`}
              onClick={() => choosePaper(p)}
              className={`w-4 h-4 rounded-full border ${paper === p ? 'ring-2 ring-[var(--nb-hl)] ring-offset-1 ring-offset-[var(--nb-pane)]' : ''} border-[var(--nb-line)]`}
              style={{ background: c }}
            />
          ))}
        </div>
        <button
          type="button"
          onClick={addPage}
          aria-label="Nova página"
          className="ml-1 sm:ml-2 shrink-0 whitespace-nowrap flex items-center gap-1.5 h-8 px-2.5 sm:px-3 rounded-lg bg-[var(--nb-pane-2)] text-[12px] font-bold hover:text-[var(--nb-hl)]"
        >
          <Plus className="w-3.5 h-3.5" /> <span className="hidden sm:inline">Nova página</span>
          <span className="sm:hidden">Nova</span>
        </button>
      </div>
    </div>
  );
}
