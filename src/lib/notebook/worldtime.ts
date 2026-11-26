/**
 * Tempo do mundo da obra: calendário próprio (meses, semana, luas) e Cronos
 * (eras e eventos numa linha do tempo). Dados em item.data.worldcal / item.data.chronos.
 */

export interface WorldMonth {
  id: string;
  name: string;
  days: number;
}
export interface WorldMoon {
  id: string;
  name: string;
  /** duração do ciclo, em dias */
  cycle: number;
  /** deslocamento: em que dia do ciclo está o dia 1 do ano 0 */
  offset: number;
  color: string;
}
export interface WorldEvent {
  id: string;
  year: number;
  month: number; // índice do mês
  day: number; // 1..dias do mês
  title: string;
  entryId?: string | null;
  color?: string;
}
export interface WorldCalendarData {
  era: string;
  months: WorldMonth[];
  weekdays: string[];
  moons: WorldMoon[];
  events: WorldEvent[];
  today: { year: number; month: number; day: number };
}

export interface ChronoEra {
  id: string;
  name: string;
  start: number;
  end: number;
  color: string;
}
export interface ChronoEvent {
  id: string;
  year: number;
  title: string;
  summary: string;
  entryId?: string | null;
  major?: boolean;
}
export interface ChronosData {
  era: string;
  eras: ChronoEra[];
  events: ChronoEvent[];
  focus?: string | null;
}

export const uid = () => Math.random().toString(36).slice(2, 10);

const MONTH_NAMES = ['Degelo', 'Semeadura', 'Flores', 'Sol Alto', 'Colheita', 'Folhas', 'Brumas', 'Geada', 'Longa Noite', 'Neve', 'Silêncio', 'Retorno'];

export function defaultCalendar(): WorldCalendarData {
  return {
    era: 'D.C.',
    months: MONTH_NAMES.map((name) => ({ id: uid(), name, days: 30 })),
    weekdays: ['Lua', 'Fogo', 'Água', 'Vento', 'Terra', 'Ouro', 'Repouso'],
    moons: [{ id: uid(), name: 'Lua Branca', cycle: 29, offset: 0, color: '#e5e7eb' }],
    events: [],
    today: { year: 1, month: 0, day: 1 },
  };
}

export function normalizeCalendar(raw: unknown): WorldCalendarData {
  const d = (raw || {}) as Partial<WorldCalendarData>;
  const base = defaultCalendar();
  const months = Array.isArray(d.months) && d.months.length ? d.months.map((m) => ({ ...m, days: Math.max(1, Math.min(99, Number(m.days) || 30)) })) : base.months;
  return {
    era: typeof d.era === 'string' ? d.era : base.era,
    months,
    weekdays: Array.isArray(d.weekdays) && d.weekdays.length ? d.weekdays : base.weekdays,
    moons: Array.isArray(d.moons) ? d.moons : base.moons,
    events: Array.isArray(d.events) ? d.events : [],
    today: d.today && typeof d.today.year === 'number' ? { ...d.today, month: Math.min(d.today.month, months.length - 1) } : base.today,
  };
}

export function daysInYear(c: WorldCalendarData) {
  return c.months.reduce((s, m) => s + m.days, 0);
}

/** Dia absoluto desde o dia 1 do ano 0 (pode ser negativo). */
export function absDay(c: WorldCalendarData, year: number, month: number, day: number) {
  let n = year * daysInYear(c);
  for (let i = 0; i < month; i++) n += c.months[i].days;
  return n + day - 1;
}

export function weekdayOf(c: WorldCalendarData, year: number, month: number, day: number) {
  const w = c.weekdays.length || 7;
  return ((absDay(c, year, month, day) % w) + w) % w;
}

/** Fase da lua: 0 = nova, 0.5 = cheia. */
export function moonPhase(m: WorldMoon, abs: number) {
  const cyc = Math.max(2, m.cycle);
  return ((((abs + m.offset) % cyc) + cyc) % cyc) / cyc;
}

export const PHASE_NAMES = ['Lua nova', 'Crescente', 'Quarto crescente', 'Crescente gibosa', 'Lua cheia', 'Minguante gibosa', 'Quarto minguante', 'Minguante'];
export const phaseName = (p: number) => PHASE_NAMES[Math.round(p * 8) % 8];

export function defaultChronos(): ChronosData {
  return { era: 'D.C.', eras: [], events: [], focus: null };
}

export function normalizeChronos(raw: unknown): ChronosData {
  const d = (raw || {}) as Partial<ChronosData>;
  return {
    era: typeof d.era === 'string' ? d.era : 'D.C.',
    eras: Array.isArray(d.eras) ? d.eras : [],
    events: Array.isArray(d.events) ? d.events : [],
    focus: d.focus || null,
  };
}

export const ERA_COLORS = ['#7c3aed', '#0891b2', '#16a34a', '#d97706', '#db2777', '#64748b'];
