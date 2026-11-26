'use client';

import { useCallback, useMemo, useRef, useState } from 'react';
import { ArrowDown, ArrowUp, ChevronLeft, ChevronRight, Plus, Settings2, Sun, Trash2, X } from 'lucide-react';
import type { NotebookItem } from '@/lib/notebook/types';
import type { NotebookApi } from '@/lib/notebook/useNotebook';
import {
  absDay,
  moonPhase,
  normalizeCalendar,
  phaseName,
  uid,
  weekdayOf,
  type WorldCalendarData,
  type WorldEvent,
} from '@/lib/notebook/worldtime';
import { entryLook } from '@/lib/notebook/entries';
import { useNotebookLinks } from '../editor/linkContext';
import { MentionPicker } from '../map/MapStudio';
import { MoonPhase } from './MoonPhase';

const EVENT_COLORS = ['#a78bfa', '#34d399', '#f59e0b', '#f87171', '#38bdf8', '#f472b6'];

/** Calendário do mundo: meses, semana e luas próprios, com eventos ligados às menções. */
export function WorldCalendar({ item, api }: { item: NotebookItem; api: NotebookApi }) {
  const links = useNotebookLinks();
  const [cal, setCal] = useState<WorldCalendarData>(() => normalizeCalendar((item.data as Record<string, unknown>)?.worldcal));
  const calRef = useRef(cal);
  const itemRef = useRef(item);
  itemRef.current = item;
  const [view, setView] = useState({ year: cal.today.year, month: cal.today.month });
  const [selDay, setSelDay] = useState<number | null>(cal.today.day);
  const [settings, setSettings] = useState(false);

  const save = useCallback(
    (next: WorldCalendarData, debounce = 500) => {
      calRef.current = next;
      setCal(next);
      api.update(itemRef.current.id, { data: { ...(itemRef.current.data || {}), worldcal: next } }, { debounce });
    },
    [api]
  );

  const month = cal.months[Math.min(view.month, cal.months.length - 1)];
  const w = cal.weekdays.length || 7;
  const firstWd = weekdayOf(cal, view.year, view.month, 1);
  const cells: (number | null)[] = [...Array(firstWd).fill(null), ...Array.from({ length: month.days }, (_, i) => i + 1)];
  while (cells.length % w) cells.push(null);

  const eventsOf = (d: number) => cal.events.filter((e) => e.year === view.year && e.month === view.month && e.day === d);
  const isToday = (d: number) => cal.today.year === view.year && cal.today.month === view.month && cal.today.day === d;

  const go = (dm: number) => {
    let m = view.month + dm;
    let y = view.year;
    if (m < 0) {
      m = cal.months.length - 1;
      y--;
    } else if (m >= cal.months.length) {
      m = 0;
      y++;
    }
    setView({ year: y, month: m });
    setSelDay(null);
  };

  const upcoming = useMemo(() => {
    const t = absDay(cal, cal.today.year, cal.today.month, cal.today.day);
    return cal.events
      .map((e) => ({ e, at: absDay(cal, e.year, Math.min(e.month, cal.months.length - 1), e.day) }))
      .filter((x) => x.at >= t)
      .sort((a, b) => a.at - b.at)
      .slice(0, 5);
  }, [cal]);

  const updateEvent = (id: string, patch: Partial<WorldEvent>, debounce = 500) =>
    save({ ...calRef.current, events: calRef.current.events.map((e) => (e.id === id ? { ...e, ...patch } : e)) }, debounce);

  return (
    <div className="space-y-5 pb-16">
      {/* cabeçalho */}
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <button type="button" aria-label="Ano anterior" onClick={() => setView((v) => ({ ...v, year: v.year - 1 }))} className="p-1 rounded-md text-[var(--nb-ink-3)] hover:text-[var(--nb-ink)]">
              <ChevronLeft className="w-3.5 h-3.5" />
            </button>
            <span className="text-[11px] font-black uppercase tracking-[0.22em] text-[var(--nb-ink-3)] tabular-nums">
              {view.year} {cal.era}
            </span>
            <button type="button" aria-label="Próximo ano" onClick={() => setView((v) => ({ ...v, year: v.year + 1 }))} className="p-1 rounded-md text-[var(--nb-ink-3)] hover:text-[var(--nb-ink)]">
              <ChevronRight className="w-3.5 h-3.5" />
            </button>
          </div>
          <div className="flex items-center gap-2 mt-0.5">
            <button type="button" aria-label="Mês anterior" onClick={() => go(-1)} className="p-1.5 rounded-lg text-[var(--nb-ink-3)] hover:text-[var(--nb-ink)] hover:bg-[var(--nb-pane-2)]">
              <ChevronLeft className="w-4 h-4" />
            </button>
            <h2 className="text-3xl font-black tracking-tight" style={{ fontFamily: "var(--nb-literata), Georgia, serif" }}>
              {month.name}
            </h2>
            <button type="button" aria-label="Próximo mês" onClick={() => go(1)} className="p-1.5 rounded-lg text-[var(--nb-ink-3)] hover:text-[var(--nb-ink)] hover:bg-[var(--nb-pane-2)]">
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>
        <div className="flex gap-1.5">
          <button
            type="button"
            onClick={() => {
              setView({ year: cal.today.year, month: cal.today.month });
              setSelDay(cal.today.day);
            }}
            className="flex items-center gap-1.5 h-8 px-3 rounded-lg bg-[var(--nb-pane-2)] text-[12px] font-bold hover:text-[var(--nb-hl)]"
          >
            <Sun className="w-3.5 h-3.5" /> Hoje no mundo
          </button>
          <button
            type="button"
            aria-pressed={settings}
            onClick={() => setSettings((s) => !s)}
            className={`flex items-center gap-1.5 h-8 px-3 rounded-lg text-[12px] font-bold ${settings ? 'bg-[var(--nb-hl)] text-white' : 'bg-[var(--nb-pane-2)] hover:text-[var(--nb-hl)]'}`}
          >
            <Settings2 className="w-3.5 h-3.5" /> Regras do calendário
          </button>
        </div>
      </div>

      {/* meses do ano */}
      <div className="flex gap-1 overflow-x-auto nb-scroll pb-1">
        {cal.months.map((m, i) => (
          <button
            key={m.id}
            type="button"
            onClick={() => {
              setView((v) => ({ ...v, month: i }));
              setSelDay(null);
            }}
            className={`shrink-0 h-7 px-2.5 rounded-full text-[11px] font-bold ${
              i === view.month ? 'bg-[var(--nb-hl)] text-white' : 'text-[var(--nb-ink-3)] hover:text-[var(--nb-ink)] hover:bg-[var(--nb-pane-2)]'
            }`}
          >
            {m.name}
          </button>
        ))}
      </div>

      {settings && <CalendarSettings cal={cal} save={save} />}

      <div className="grid lg:grid-cols-[1fr_300px] gap-4 items-start">
        {/* grade do mês */}
        <div className="rounded-2xl border border-[var(--nb-line)] bg-[var(--nb-pane)] p-2 sm:p-3">
          <div className="grid gap-1" style={{ gridTemplateColumns: `repeat(${w}, minmax(0, 1fr))` }}>
            {cal.weekdays.map((d, i) => (
              <div key={i} className="px-1 pb-1 text-center text-[10px] font-black uppercase tracking-wider text-[var(--nb-ink-3)] truncate">
                {d}
              </div>
            ))}
            {cells.map((d, i) => {
              if (!d) return <div key={i} />;
              const ev = eventsOf(d);
              const abs = absDay(cal, view.year, view.month, d);
              return (
                <button
                  key={i}
                  type="button"
                  onClick={() => setSelDay(d)}
                  className={`nb-wcal-day ${selDay === d ? 'is-selected' : ''} ${isToday(d) ? 'is-today' : ''}`}
                >
                  <span className="flex items-center justify-between gap-1">
                    <span className="text-[12px] font-bold tabular-nums">{d}</span>
                    <span className="flex gap-0.5">
                      {cal.moons.map((m) => {
                        const ph = moonPhase(m, abs);
                        const key = Math.round(ph * 8) % 8;
                        // só nas viradas de fase, para não poluir a grade
                        const prev = Math.round(moonPhase(m, abs - 1) * 8) % 8;
                        return key !== prev || d === 1 ? <MoonPhase key={m.id} phase={ph} size={12} color={m.color} title={`${m.name}: ${phaseName(ph)}`} /> : null;
                      })}
                    </span>
                  </span>
                  <span className="mt-1 flex flex-col gap-0.5 min-w-0">
                    {ev.slice(0, 3).map((e) => (
                      <span
                        key={e.id}
                        data-ref={e.entryId || undefined}
                        className="nb-wcal-event"
                        style={{ ['--ec' as string]: e.color || (e.entryId && links.entries[e.entryId] ? entryLook(links.entries[e.entryId]).color : '#a78bfa') }}
                      >
                        {e.title}
                      </span>
                    ))}
                    {ev.length > 3 && <span className="text-[10px] text-[var(--nb-ink-3)]">+{ev.length - 3}</span>}
                  </span>
                </button>
              );
            })}
          </div>
        </div>

        {/* dia selecionado */}
        <div className="space-y-3">
          {selDay ? (
            <div className="rounded-2xl border border-[var(--nb-line)] bg-[var(--nb-pane)] p-4 space-y-3">
              <div>
                <p className="text-[10px] font-black uppercase tracking-wider text-[var(--nb-hl)]">{cal.weekdays[weekdayOf(cal, view.year, view.month, selDay)]}</p>
                <p className="text-[18px] font-extrabold">
                  {selDay} de {month.name}, {view.year} {cal.era}
                </p>
                <div className="mt-1.5 space-y-1">
                  {cal.moons.map((m) => {
                    const ph = moonPhase(m, absDay(cal, view.year, view.month, selDay));
                    return (
                      <p key={m.id} className="flex items-center gap-1.5 text-[12px] text-[var(--nb-ink-2)]">
                        <MoonPhase phase={ph} size={14} color={m.color} />
                        {m.name}: {phaseName(ph).toLowerCase()}
                      </p>
                    );
                  })}
                </div>
              </div>
              {eventsOf(selDay).map((e) => (
                <div key={e.id} className="rounded-xl border border-[var(--nb-line)] p-2.5 space-y-2">
                  <div className="flex items-center gap-1.5">
                    <input
                      value={e.title}
                      onChange={(ev) => updateEvent(e.id, { title: ev.target.value.slice(0, 120) })}
                      className="flex-1 min-w-0 h-7 px-2 rounded-md bg-[var(--nb-bg)] text-[13px] font-semibold outline-none"
                      aria-label="Evento"
                    />
                    <button type="button" aria-label="Apagar evento" onClick={() => save({ ...calRef.current, events: calRef.current.events.filter((x) => x.id !== e.id) }, 0)} className="p-1 text-[var(--nb-ink-3)] hover:text-red-400">
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                  <div className="flex gap-1">
                    {EVENT_COLORS.map((c) => (
                      <button key={c} type="button" aria-label={`Cor ${c}`} onClick={() => updateEvent(e.id, { color: c }, 0)} className={`w-5 h-5 rounded-full border-2 ${e.color === c ? 'border-white' : 'border-transparent'}`} style={{ background: c }} />
                    ))}
                  </div>
                  <MentionPicker value={e.entryId || null} label={e.title} onChange={(id) => updateEvent(e.id, { entryId: id }, 0)} />
                </div>
              ))}
              <div className="flex flex-wrap gap-1.5">
                <button
                  type="button"
                  onClick={() =>
                    save({ ...calRef.current, events: [...calRef.current.events, { id: uid(), year: view.year, month: view.month, day: selDay, title: 'Novo evento', color: EVENT_COLORS[0] }] }, 0)
                  }
                  className="flex items-center gap-1.5 h-8 px-3 rounded-lg bg-[var(--nb-hl)] text-white text-[12px] font-bold"
                >
                  <Plus className="w-3.5 h-3.5" /> Evento neste dia
                </button>
                {!isToday(selDay) && (
                  <button
                    type="button"
                    onClick={() => save({ ...calRef.current, today: { year: view.year, month: view.month, day: selDay } }, 0)}
                    className="flex items-center gap-1.5 h-8 px-3 rounded-lg bg-[var(--nb-pane-2)] text-[12px] font-bold hover:text-[var(--nb-hl)]"
                  >
                    <Sun className="w-3.5 h-3.5" /> É hoje na história
                  </button>
                )}
              </div>
            </div>
          ) : (
            <p className="rounded-2xl border border-dashed border-[var(--nb-line)] p-4 text-[13px] text-[var(--nb-ink-3)]">Escolha um dia para ver as luas e marcar eventos.</p>
          )}

          {upcoming.length > 0 && (
            <div className="rounded-2xl border border-[var(--nb-line)] bg-[var(--nb-pane)] p-4">
              <p className="nb-pane-title mb-2">Próximos na história</p>
              <div className="space-y-1.5">
                {upcoming.map(({ e }) => (
                  <button
                    key={e.id}
                    type="button"
                    onClick={() => {
                      setView({ year: e.year, month: Math.min(e.month, cal.months.length - 1) });
                      setSelDay(e.day);
                    }}
                    className="w-full flex items-center gap-2 text-left text-[12px] hover:text-[var(--nb-hl)]"
                  >
                    <span className="w-2 h-2 rounded-full shrink-0" style={{ background: e.color || '#a78bfa' }} />
                    <span className="flex-1 truncate font-semibold" data-ref={e.entryId || undefined}>
                      {e.title}
                    </span>
                    <span className="text-[var(--nb-ink-3)] tabular-nums shrink-0">
                      {e.day} {cal.months[Math.min(e.month, cal.months.length - 1)]?.name.slice(0, 3)} {e.year}
                    </span>
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

/** Regras do calendário: era, meses, dias da semana e luas. */
function CalendarSettings({ cal, save }: { cal: WorldCalendarData; save: (c: WorldCalendarData, d?: number) => void }) {
  const [weekdays, setWeekdays] = useState(cal.weekdays.join(', '));
  const input = 'h-8 px-2 rounded-lg bg-[var(--nb-bg)] border border-[var(--nb-line)] text-[12px] outline-none focus:border-[var(--nb-hl)]';
  const moveMonth = (i: number, d: -1 | 1) => {
    const j = i + d;
    if (j < 0 || j >= cal.months.length) return;
    const m = [...cal.months];
    [m[i], m[j]] = [m[j], m[i]];
    save({ ...cal, months: m }, 0);
  };
  return (
    <div className="grid md:grid-cols-2 gap-4 rounded-2xl border border-[var(--nb-line)] bg-[var(--nb-pane)] p-4">
      <div className="space-y-3">
        <label className="block">
          <span className="text-[10px] font-black uppercase tracking-wider text-[var(--nb-ink-3)]">Era (depois do ano)</span>
          <input value={cal.era} onChange={(e) => save({ ...cal, era: e.target.value.slice(0, 16) })} placeholder="ex.: D.C." className={`mt-1 w-full ${input}`} />
        </label>
        <label className="block">
          <span className="text-[10px] font-black uppercase tracking-wider text-[var(--nb-ink-3)]">Dias da semana (separados por vírgula)</span>
          <input
            value={weekdays}
            onChange={(e) => {
              setWeekdays(e.target.value);
              const list = e.target.value.split(',').map((s) => s.trim()).filter(Boolean).slice(0, 14);
              if (list.length >= 1) save({ ...cal, weekdays: list });
            }}
            className={`mt-1 w-full ${input}`}
          />
        </label>
        <div>
          <span className="text-[10px] font-black uppercase tracking-wider text-[var(--nb-ink-3)]">Luas</span>
          <div className="mt-1 space-y-1.5">
            {cal.moons.map((m) => (
              <div key={m.id} className="flex items-center gap-1.5">
                <MoonPhase phase={0.35} size={18} color={m.color} />
                <input value={m.name} onChange={(e) => save({ ...cal, moons: cal.moons.map((x) => (x.id === m.id ? { ...x, name: e.target.value.slice(0, 40) } : x)) })} className={`flex-1 min-w-0 ${input}`} aria-label="Nome da lua" />
                <input
                  type="number"
                  min={2}
                  max={999}
                  value={m.cycle}
                  title="Ciclo (dias)"
                  onChange={(e) => save({ ...cal, moons: cal.moons.map((x) => (x.id === m.id ? { ...x, cycle: Math.max(2, Math.min(999, Number(e.target.value) || 29)) } : x)) })}
                  className={`w-16 ${input}`}
                  aria-label="Ciclo em dias"
                />
                <input type="color" value={m.color} onChange={(e) => save({ ...cal, moons: cal.moons.map((x) => (x.id === m.id ? { ...x, color: e.target.value } : x)) })} className="w-8 h-8 rounded-lg bg-transparent" aria-label="Cor da lua" />
                <button type="button" aria-label="Remover lua" onClick={() => save({ ...cal, moons: cal.moons.filter((x) => x.id !== m.id) }, 0)} className="p-1 text-[var(--nb-ink-3)] hover:text-red-400">
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>
            ))}
            <button type="button" onClick={() => save({ ...cal, moons: [...cal.moons, { id: uid(), name: 'Nova lua', cycle: 40, offset: 7, color: '#fca5a5' }] }, 0)} className="flex items-center gap-1 h-7 px-2.5 rounded-lg bg-[var(--nb-pane-2)] text-[11px] font-bold hover:text-[var(--nb-hl)]">
              <Plus className="w-3 h-3" /> Lua
            </button>
          </div>
        </div>
      </div>
      <div>
        <span className="text-[10px] font-black uppercase tracking-wider text-[var(--nb-ink-3)]">Meses ({cal.months.reduce((s, m) => s + m.days, 0)} dias no ano)</span>
        <div className="mt-1 space-y-1 max-h-72 overflow-y-auto nb-scroll pr-1">
          {cal.months.map((m, i) => (
            <div key={m.id} className="flex items-center gap-1.5">
              <span className="w-5 text-right text-[11px] text-[var(--nb-ink-3)] tabular-nums">{i + 1}</span>
              <input value={m.name} onChange={(e) => save({ ...cal, months: cal.months.map((x) => (x.id === m.id ? { ...x, name: e.target.value.slice(0, 30) } : x)) })} className={`flex-1 min-w-0 ${input}`} aria-label="Nome do mês" />
              <input
                type="number"
                min={1}
                max={99}
                value={m.days}
                onChange={(e) => save({ ...cal, months: cal.months.map((x) => (x.id === m.id ? { ...x, days: Math.max(1, Math.min(99, Number(e.target.value) || 1)) } : x)) })}
                className={`w-14 ${input}`}
                aria-label="Dias"
              />
              <button type="button" aria-label="Subir" onClick={() => moveMonth(i, -1)} className="p-1 text-[var(--nb-ink-3)] hover:text-[var(--nb-ink)]">
                <ArrowUp className="w-3 h-3" />
              </button>
              <button type="button" aria-label="Descer" onClick={() => moveMonth(i, 1)} className="p-1 text-[var(--nb-ink-3)] hover:text-[var(--nb-ink)]">
                <ArrowDown className="w-3 h-3" />
              </button>
              <button type="button" aria-label="Remover mês" disabled={cal.months.length <= 1} onClick={() => save({ ...cal, months: cal.months.filter((x) => x.id !== m.id) }, 0)} className="p-1 text-[var(--nb-ink-3)] hover:text-red-400 disabled:opacity-30">
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          ))}
        </div>
        <button type="button" onClick={() => save({ ...cal, months: [...cal.months, { id: uid(), name: 'Novo mês', days: 30 }] }, 0)} className="mt-2 flex items-center gap-1 h-7 px-2.5 rounded-lg bg-[var(--nb-pane-2)] text-[11px] font-bold hover:text-[var(--nb-hl)]">
          <Plus className="w-3 h-3" /> Mês
        </button>
      </div>
    </div>
  );
}
