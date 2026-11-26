'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Minus, Plus, Star, Trash2, X } from 'lucide-react';
import type { NotebookItem } from '@/lib/notebook/types';
import type { NotebookApi } from '@/lib/notebook/useNotebook';
import { ERA_COLORS, normalizeChronos, uid, type ChronoEra, type ChronoEvent, type ChronosData } from '@/lib/notebook/worldtime';
import { entryLook } from '@/lib/notebook/entries';
import { useNotebookLinks } from '../editor/linkContext';
import { MentionPicker } from '../map/MapStudio';

/** Intervalo "bonito" entre marcas da régua. */
function niceStep(span: number, px: number) {
  const target = span / Math.max(1, px / 110);
  const pow = Math.pow(10, Math.floor(Math.log10(Math.max(1, target))));
  for (const m of [1, 2, 5, 10]) if (pow * m >= target) return pow * m;
  return pow * 10;
}

/** Cronos: a história do mundo numa linha (eras, marcos e eventos). */
export function Chronos({ item, api }: { item: NotebookItem; api: NotebookApi }) {
  const links = useNotebookLinks();
  const [data, setData] = useState<ChronosData>(() => normalizeChronos((item.data as Record<string, unknown>)?.chronos));
  const dataRef = useRef(data);
  const itemRef = useRef(item);
  itemRef.current = item;
  const [sel, setSel] = useState<{ type: 'event' | 'era'; id: string } | null>(null);
  const [pxPerYear, setPxPerYear] = useState(24);
  const scrollRef = useRef<HTMLDivElement>(null);

  const save = useCallback(
    (next: ChronosData, debounce = 500) => {
      dataRef.current = next;
      setData(next);
      api.update(itemRef.current.id, { data: { ...(itemRef.current.data || {}), chronos: next } }, { debounce });
    },
    [api]
  );

  const events = useMemo(() => [...data.events].sort((a, b) => a.year - b.year), [data.events]);
  const years = [...events.map((e) => e.year), ...data.eras.flatMap((e) => [e.start, e.end])];
  const min = years.length ? Math.min(...years) : 0;
  const max = years.length ? Math.max(...years) : 100;
  const pad = Math.max(5, Math.round((max - min) * 0.08));
  const from = min - pad;
  const to = max + pad;
  const width = Math.max(720, (to - from) * pxPerYear);
  const xOf = (y: number) => ((y - from) / (to - from)) * width;
  const step = niceStep(to - from, width);
  const ticks: number[] = [];
  for (let t = Math.ceil(from / step) * step; t <= to; t += step) ticks.push(t);

  // eras empilhadas em faixas para não se sobreporem
  const eraLanes = useMemo(() => {
    const lanes: ChronoEra[][] = [];
    [...data.eras]
      .sort((a, b) => a.start - b.start)
      .forEach((e) => {
        const lane = lanes.find((l) => l[l.length - 1].end <= e.start);
        if (lane) lane.push(e);
        else lanes.push([e]);
      });
    return lanes;
  }, [data.eras]);

  const AXIS = 150 + eraLanes.length * 30;

  // abre enquadrando toda a história
  const fitted = useRef(false);
  const fitAll = () => {
    const w = scrollRef.current?.clientWidth || 900;
    setPxPerYear(Math.max(0.5, Math.min(400, (w - 60) / Math.max(1, to - from))));
  };
  useEffect(() => {
    if (fitted.current) return;
    fitted.current = true;
    fitAll();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  const selEvent = sel?.type === 'event' ? data.events.find((e) => e.id === sel.id) : null;
  const selEra = sel?.type === 'era' ? data.eras.find((e) => e.id === sel.id) : null;

  const addEvent = (year: number) => {
    const ev: ChronoEvent = { id: uid(), year: Math.round(year), title: 'Novo acontecimento', summary: '', major: false };
    save({ ...dataRef.current, events: [...dataRef.current.events, ev] }, 0);
    setSel({ type: 'event', id: ev.id });
  };
  const updEvent = (id: string, patch: Partial<ChronoEvent>, d = 500) =>
    save({ ...dataRef.current, events: dataRef.current.events.map((e) => (e.id === id ? { ...e, ...patch } : e)) }, d);
  const updEra = (id: string, patch: Partial<ChronoEra>, d = 500) =>
    save({ ...dataRef.current, eras: dataRef.current.eras.map((e) => (e.id === id ? { ...e, ...patch } : e)) }, d);

  const eraOf = (y: number) => data.eras.find((e) => y >= e.start && y <= e.end);
  const input = 'h-8 px-2 rounded-lg bg-[var(--nb-bg)] border border-[var(--nb-line)] text-[12px] outline-none focus:border-[var(--nb-hl)]';

  return (
    <div className="space-y-5 pb-16">
      <div className="flex flex-wrap items-center gap-2">
        <button type="button" onClick={() => addEvent(events.length ? events[events.length - 1].year + 1 : 1)} className="flex items-center gap-1.5 h-8 px-3 rounded-lg bg-[var(--nb-hl)] text-white text-[12px] font-bold">
          <Plus className="w-3.5 h-3.5" /> Acontecimento
        </button>
        <button
          type="button"
          onClick={() => {
            const s = events.length ? events[0].year : 0;
            const era: ChronoEra = { id: uid(), name: 'Nova era', start: s, end: s + 50, color: ERA_COLORS[data.eras.length % ERA_COLORS.length] };
            save({ ...dataRef.current, eras: [...dataRef.current.eras, era] }, 0);
            setSel({ type: 'era', id: era.id });
          }}
          className="flex items-center gap-1.5 h-8 px-3 rounded-lg bg-[var(--nb-pane-2)] text-[12px] font-bold hover:text-[var(--nb-hl)]"
        >
          <Plus className="w-3.5 h-3.5" /> Era
        </button>
        <label className="flex items-center gap-1.5 text-[12px] text-[var(--nb-ink-3)]">
          Calendário
          <input value={data.era} onChange={(e) => save({ ...dataRef.current, era: e.target.value.slice(0, 16) })} placeholder="ex.: D.C." className={`w-20 ${input}`} />
        </label>
        <span className="flex-1" />
        <div className="flex items-center gap-0.5 p-1 rounded-xl bg-[var(--nb-pane)] border border-[var(--nb-line)]">
          <button type="button" aria-label="Afastar" onClick={() => setPxPerYear((p) => Math.max(1, p / 1.5))} className="p-1.5 rounded-lg text-[var(--nb-ink-3)] hover:text-[var(--nb-ink)]">
            <Minus className="w-3.5 h-3.5" />
          </button>
          <button type="button" onClick={fitAll} title="Enquadrar toda a história" className="w-16 text-center text-[10px] font-bold text-[var(--nb-ink-2)] hover:text-[var(--nb-ink)]">
            ajustar
          </button>
          <button type="button" aria-label="Aproximar" onClick={() => setPxPerYear((p) => Math.min(400, p * 1.5))} className="p-1.5 rounded-lg text-[var(--nb-ink-3)] hover:text-[var(--nb-ink)]">
            <Plus className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* linha do tempo */}
      <div ref={scrollRef} className="nb-chronos nb-scroll" onWheel={(e) => e.shiftKey || (scrollRef.current && (scrollRef.current.scrollLeft += e.deltaY))}>
        <div className="relative" style={{ width, height: AXIS * 2 - 40 }}>
          {/* eras */}
          {eraLanes.map((lane, li) =>
            lane.map((era) => (
              <button
                key={era.id}
                type="button"
                onClick={() => setSel({ type: 'era', id: era.id })}
                className={`nb-chronos-era ${sel?.id === era.id ? 'is-selected' : ''}`}
                style={{ left: xOf(era.start), width: Math.max(24, xOf(era.end) - xOf(era.start)), top: 16 + li * 30, ['--era' as string]: era.color }}
                title={`${era.name} (${era.start}–${era.end} ${data.era})`}
              >
                {era.name}
              </button>
            ))
          )}
          {/* eixo e marcas */}
          <div className="nb-chronos-axis" style={{ top: AXIS }} onDoubleClick={(e) => addEvent(from + ((e.clientX - (e.currentTarget.getBoundingClientRect().left || 0)) / width) * (to - from))} title="Clique duas vezes para criar um acontecimento aqui" />
          {ticks.map((t) => (
            <span key={t} className="nb-chronos-tick" style={{ left: xOf(t), top: AXIS + 10 }}>
              {t}
            </span>
          ))}
          {/* acontecimentos */}
          {events.map((ev, i) => {
            const up = i % 2 === 0;
            const entry = ev.entryId ? links.entries[ev.entryId] : null;
            const color = entry ? entryLook(entry).color : eraOf(ev.year)?.color || 'var(--nb-hl)';
            const stem = ev.major ? 64 : 44 + (i % 4) * 14;
            return (
              <button
                key={ev.id}
                type="button"
                onClick={() => setSel({ type: 'event', id: ev.id })}
                className={`nb-chronos-event ${ev.major ? 'is-major' : ''} ${sel?.id === ev.id ? 'is-selected' : ''}`}
                style={{ left: xOf(ev.year), top: AXIS, ['--ev' as string]: color }}
              >
                <span className="nb-chronos-dot" />
                <span className="nb-chronos-stem" style={{ height: stem, [up ? 'bottom' : 'top']: 6 }} />
                <span className="nb-chronos-card" style={{ [up ? 'bottom' : 'top']: stem + 4 }} data-ref={ev.entryId || undefined}>
                  <span className="block text-[10px] font-black tabular-nums" style={{ color }}>
                    {ev.year} {data.era}
                  </span>
                  <span className="block text-[12px] font-bold leading-tight">{ev.title}</span>
                </span>
              </button>
            );
          })}
          {!events.length && !data.eras.length && (
            <p className="absolute left-1/2 -translate-x-1/2 text-[13px] text-[var(--nb-ink-3)]" style={{ top: AXIS + 40 }}>
              Crie o primeiro acontecimento ou uma era. Clique duas vezes na linha para marcar um ano.
            </p>
          )}
        </div>
      </div>

      {/* edição do item selecionado */}
      {(selEvent || selEra) && (
        <div className="rounded-2xl border border-[var(--nb-line)] bg-[var(--nb-pane)] p-4 space-y-3">
          <div className="flex items-center justify-between">
            <p className="text-[10px] font-black uppercase tracking-wider text-[var(--nb-hl)]">{selEvent ? 'Acontecimento' : 'Era'}</p>
            <div className="flex gap-1">
              <button
                type="button"
                aria-label="Apagar"
                onClick={() => {
                  if (selEvent) save({ ...dataRef.current, events: dataRef.current.events.filter((e) => e.id !== selEvent.id) }, 0);
                  if (selEra) save({ ...dataRef.current, eras: dataRef.current.eras.filter((e) => e.id !== selEra.id) }, 0);
                  setSel(null);
                }}
                className="p-1.5 rounded-md text-[var(--nb-ink-3)] hover:text-red-400"
              >
                <Trash2 className="w-3.5 h-3.5" />
              </button>
              <button type="button" aria-label="Fechar" onClick={() => setSel(null)} className="p-1.5 rounded-md text-[var(--nb-ink-3)] hover:text-[var(--nb-ink)]">
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
          {selEvent && (
            <div className="grid md:grid-cols-[1fr_260px] gap-4">
              <div className="space-y-2">
                <div className="flex gap-2">
                  <input
                    type="number"
                    value={selEvent.year}
                    onChange={(e) => updEvent(selEvent.id, { year: Math.round(Number(e.target.value) || 0) })}
                    className={`w-24 ${input}`}
                    aria-label="Ano"
                  />
                  <input value={selEvent.title} onChange={(e) => updEvent(selEvent.id, { title: e.target.value.slice(0, 120) })} className={`flex-1 min-w-0 font-semibold ${input}`} aria-label="Título do acontecimento" />
                  <button
                    type="button"
                    aria-pressed={!!selEvent.major}
                    title="Marco (destaque na linha)"
                    onClick={() => updEvent(selEvent.id, { major: !selEvent.major }, 0)}
                    className={`h-8 px-2.5 rounded-lg text-[11px] font-bold flex items-center gap-1 ${selEvent.major ? 'bg-amber-500 text-black' : 'bg-[var(--nb-pane-2)] text-[var(--nb-ink-3)]'}`}
                  >
                    <Star className="w-3.5 h-3.5" /> Marco
                  </button>
                </div>
                <textarea
                  value={selEvent.summary}
                  onChange={(e) => updEvent(selEvent.id, { summary: e.target.value.slice(0, 2000) })}
                  rows={4}
                  placeholder="O que aconteceu e por que importa para a história"
                  className="w-full resize-y px-3 py-2 rounded-xl bg-[var(--nb-bg)] border border-[var(--nb-line)] text-[13px] leading-relaxed outline-none focus:border-[var(--nb-hl)]"
                />
              </div>
              <MentionPicker value={selEvent.entryId || null} label={selEvent.title} onChange={(id) => updEvent(selEvent.id, { entryId: id }, 0)} />
            </div>
          )}
          {selEra && (
            <div className="flex flex-wrap items-center gap-2">
              <input value={selEra.name} onChange={(e) => updEra(selEra.id, { name: e.target.value.slice(0, 60) })} className={`flex-1 min-w-[160px] font-semibold ${input}`} aria-label="Nome da era" />
              <label className="flex items-center gap-1 text-[12px] text-[var(--nb-ink-3)]">
                de
                <input type="number" value={selEra.start} onChange={(e) => updEra(selEra.id, { start: Math.round(Number(e.target.value) || 0) })} className={`w-24 ${input}`} />
              </label>
              <label className="flex items-center gap-1 text-[12px] text-[var(--nb-ink-3)]">
                a
                <input type="number" value={selEra.end} onChange={(e) => updEra(selEra.id, { end: Math.round(Number(e.target.value) || 0) })} className={`w-24 ${input}`} />
              </label>
              <div className="flex gap-1">
                {ERA_COLORS.map((c) => (
                  <button key={c} type="button" aria-label={`Cor ${c}`} onClick={() => updEra(selEra.id, { color: c }, 0)} className={`w-6 h-6 rounded-full border-2 ${selEra.color === c ? 'border-white' : 'border-transparent'}`} style={{ background: c }} />
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* a história, em ordem */}
      {events.length > 0 && (
        <div className="rounded-2xl border border-[var(--nb-line)] bg-[var(--nb-pane)] p-4">
          <p className="nb-pane-title mb-3">A história, em ordem</p>
          <ol className="relative border-l border-[var(--nb-line)] ml-2 space-y-3">
            {events.map((ev) => {
              const era = eraOf(ev.year);
              return (
                <li key={ev.id} className="pl-4 relative">
                  <span className="absolute -left-[5px] top-1.5 w-2.5 h-2.5 rounded-full" style={{ background: era?.color || 'var(--nb-hl)' }} />
                  <button type="button" onClick={() => setSel({ type: 'event', id: ev.id })} className="text-left">
                    <span className="text-[11px] font-black tabular-nums text-[var(--nb-ink-3)]">
                      {ev.year} {data.era}
                      {era ? ` · ${era.name}` : ''}
                    </span>
                    <span className="block text-[14px] font-bold hover:text-[var(--nb-hl)]" data-ref={ev.entryId || undefined}>
                      {ev.major && <Star className="inline w-3 h-3 mr-1 text-amber-500 -mt-0.5" />}
                      {ev.title}
                    </span>
                    {ev.summary && <span className="block text-[12px] text-[var(--nb-ink-2)] line-clamp-2">{ev.summary}</span>}
                  </button>
                </li>
              );
            })}
          </ol>
        </div>
      )}
    </div>
  );
}
