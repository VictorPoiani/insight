'use client';

import { useMemo, useState } from 'react';
import { Check, ChevronLeft, ChevronRight, Droplets, Flame, Plus, Scale, Trash2, Trophy, Beef, CalendarDays } from 'lucide-react';
import type { DietDayLog, DietMealItem, TopicWorkspaceData } from '@/types/database';

/**
 * Plano nutricional com agenda.
 *
 * - O plano (refeições, horário, dias da semana) é o modelo.
 * - Cada dia da agenda tem seu registro: refeições feitas, água, peso e nota.
 * - Acompanhamento: visão do dia, da semana (gráfico) e do mês (calendário
 *   de aderência), com médias, dias na meta, sequência e variação de peso.
 */

const WEEKDAYS = ['D', 'S', 'T', 'Q', 'Q', 'S', 'S'];
const WEEKDAY_NAMES = ['Domingo', 'Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado'];
const MONTHS = ['janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho', 'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro'];

const pad = (n: number) => String(n).padStart(2, '0');
const keyOf = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const fromKey = (k: string) => {
  const [y, m, d] = k.split('-').map(Number);
  return new Date(y, m - 1, d);
};
const addDays = (d: Date, n: number) => new Date(d.getFullYear(), d.getMonth(), d.getDate() + n);
const startOfWeek = (d: Date) => addDays(d, -((d.getDay() + 6) % 7)); // semana começa na segunda

function mealsFor(meals: DietMealItem[], date: Date) {
  const wd = date.getDay();
  return meals
    .filter((m) => !m.days || m.days.length === 0 || m.days.includes(wd))
    .sort((a, b) => (a.at || '99:99').localeCompare(b.at || '99:99'));
}

interface DayStats {
  key: string;
  planned: number;
  done: number;
  kcal: number;
  protein: number;
  water: number;
  adherence: number; // 0..1
  logged: boolean;
}

function statsFor(meals: DietMealItem[], log: Record<string, DietDayLog>, date: Date): DayStats {
  const key = keyOf(date);
  const day = log[key];
  const planned = mealsFor(meals, date);
  const doneSet = new Set(day?.done || []);
  const doneMeals = planned.filter((m) => doneSet.has(m.id));
  return {
    key,
    planned: planned.length,
    done: doneMeals.length,
    kcal: doneMeals.reduce((s, m) => s + (Number(m.calories) || 0), 0),
    protein: doneMeals.reduce((s, m) => s + (Number(m.proteinGrams) || 0), 0),
    water: day?.water || 0,
    adherence: planned.length ? doneMeals.length / planned.length : 0,
    logged: Boolean(day && (day.done?.length || day.water || day.weight)),
  };
}

function Bar({ value, goal, color }: { value: number; goal: number; color: string }) {
  return (
    <div className="w-full h-1.5 rounded-full bg-surface overflow-hidden">
      <div style={{ width: `${Math.min(100, Math.round((value / Math.max(1, goal)) * 100))}%`, background: color }} className="h-full transition-all" />
    </div>
  );
}

export function DietPlanner({
  data,
  isAdmin,
  persist,
}: {
  data: TopicWorkspaceData;
  isAdmin: boolean;
  persist: (next: TopicWorkspaceData) => void;
}) {
  const today = useMemo(() => new Date(), []);
  const [view, setView] = useState<'day' | 'week' | 'month'>('day');
  const [selected, setSelected] = useState<Date>(today);
  const [monthCursor, setMonthCursor] = useState<Date>(new Date(today.getFullYear(), today.getMonth(), 1));
  const [editingPlan, setEditingPlan] = useState(false);

  const meals = data.dietMeals || [];
  const calGoal = data.calorieGoal || 2200;
  const protGoal = data.proteinGoal || 150;
  const waterGoal = data.waterGoal || 8;

  // planos antigos (sem datas): o estado "feito" e a água viram o registro de hoje
  const log: Record<string, DietDayLog> = useMemo(() => {
    if (data.dietLog) return data.dietLog;
    const legacyDone = meals.filter((m) => m.completed).map((m) => m.id);
    if (!legacyDone.length && !data.waterGlasses) return {};
    return { [keyOf(today)]: { done: legacyDone, water: data.waterGlasses || 0 } };
  }, [data.dietLog, data.waterGlasses, meals, today]);

  const selKey = keyOf(selected);
  const selLog: DietDayLog = log[selKey] || { done: [], water: 0 };
  const sel = statsFor(meals, log, selected);
  const plannedToday = mealsFor(meals, selected);
  const plannedKcal = plannedToday.reduce((s, m) => s + (Number(m.calories) || 0), 0);

  const writeDay = (patch: Partial<DietDayLog>) => {
    if (!isAdmin) return;
    persist({ ...data, dietLog: { ...log, [selKey]: { ...selLog, ...patch } } });
  };
  const updateMeal = (id: string, patch: Partial<DietMealItem>) =>
    persist({ ...data, dietMeals: meals.map((m) => (m.id === id ? { ...m, ...patch } : m)), dietLog: log });

  const weekStart = startOfWeek(selected);
  const week = Array.from({ length: 7 }, (_, i) => addDays(weekStart, i));
  const weekStats = week.map((d) => statsFor(meals, log, d));

  // ---------------- mês
  const monthDays = useMemo(() => {
    const first = monthCursor;
    const lead = (first.getDay() + 6) % 7;
    const total = new Date(first.getFullYear(), first.getMonth() + 1, 0).getDate();
    const cells: (Date | null)[] = Array.from({ length: lead }, () => null);
    for (let d = 1; d <= total; d++) cells.push(new Date(first.getFullYear(), first.getMonth(), d));
    return cells;
  }, [monthCursor]);
  const monthStats = monthDays.filter((d): d is Date => Boolean(d) && (d as Date) <= today).map((d) => statsFor(meals, log, d));

  const summarize = (list: DayStats[]) => {
    const logged = list.filter((s) => s.logged);
    const n = Math.max(1, logged.length);
    let streak = 0;
    for (let i = list.length - 1; i >= 0; i--) {
      if (list[i].planned && list[i].adherence >= 0.8) streak++;
      else if (list[i].key !== keyOf(today)) break;
    }
    return {
      days: logged.length,
      avgKcal: Math.round(logged.reduce((s, x) => s + x.kcal, 0) / n),
      avgProtein: Math.round(logged.reduce((s, x) => s + x.protein, 0) / n),
      avgWater: Math.round((logged.reduce((s, x) => s + x.water, 0) / n) * 10) / 10,
      adherence: Math.round((logged.reduce((s, x) => s + x.adherence, 0) / n) * 100),
      onTarget: logged.filter((x) => x.kcal >= calGoal * 0.9 && x.kcal <= calGoal * 1.1).length,
      streak,
    };
  };

  const weightsInMonth = monthDays
    .filter((d): d is Date => Boolean(d))
    .map((d) => ({ d, w: log[keyOf(d)]?.weight }))
    .filter((x): x is { d: Date; w: number } => typeof x.w === 'number' && x.w > 0);

  const tabBtn = (id: typeof view, label: string) => (
    <button
      type="button"
      onClick={() => setView(id)}
      className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-colors ${view === id ? 'bg-accent text-white' : 'text-secondary hover:text-primary hover:bg-elevated'}`}
    >
      {label}
    </button>
  );

  const Stat = ({ icon, label, value, sub }: { icon: React.ReactNode; label: string; value: string; sub?: string }) => (
    <div className="p-3 rounded-xl bg-elevated border border-border">
      <span className="flex items-center gap-1.5 text-[10px] font-mono uppercase text-muted">
        {icon} {label}
      </span>
      <p className="mt-1 text-lg font-bold font-mono text-primary">{value}</p>
      {sub && <p className="text-[10px] text-muted">{sub}</p>}
    </div>
  );

  return (
    <div className="flex-1 flex flex-col gap-4">
      {/* abas + metas */}
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-1 p-1 rounded-xl bg-surface border border-border">
          {tabBtn('day', 'Dia')}
          {tabBtn('week', 'Semana')}
          {tabBtn('month', 'Mês')}
        </div>
        {isAdmin && (
          <div className="flex items-center gap-2 text-[11px] font-mono text-muted">
            <label className="flex items-center gap-1">
              Meta
              <input type="number" value={calGoal} onChange={(e) => persist({ ...data, dietLog: log, calorieGoal: Number(e.target.value) || 2000 })} className="w-16 px-1 py-0.5 rounded bg-surface border border-border text-right text-primary" />
              kcal
            </label>
            <label className="flex items-center gap-1">
              <input type="number" value={protGoal} onChange={(e) => persist({ ...data, dietLog: log, proteinGoal: Number(e.target.value) || 150 })} className="w-12 px-1 py-0.5 rounded bg-surface border border-border text-right text-emerald-400" />
              g P
            </label>
            <label className="flex items-center gap-1">
              <input type="number" value={waterGoal} onChange={(e) => persist({ ...data, dietLog: log, waterGoal: Number(e.target.value) || 8 })} className="w-10 px-1 py-0.5 rounded bg-surface border border-border text-right text-sky-400" />
              copos
            </label>
          </div>
        )}
      </div>

      {/* faixa da semana (agenda) */}
      {view !== 'month' && (
        <div className="flex items-center gap-1.5">
          <button type="button" onClick={() => setSelected(addDays(selected, -7))} aria-label="Semana anterior" className="p-1.5 rounded-lg text-secondary hover:text-primary hover:bg-elevated">
            <ChevronLeft className="w-4 h-4" />
          </button>
          <div className="flex-1 grid grid-cols-7 gap-1">
            {week.map((d, i) => {
              const st = weekStats[i];
              const isSel = keyOf(d) === selKey;
              const isToday = keyOf(d) === keyOf(today);
              const ring = st.planned ? Math.round(st.adherence * 100) : 0;
              return (
                <button
                  key={keyOf(d)}
                  type="button"
                  onClick={() => {
                    setSelected(d);
                    if (view === 'week') setView('day');
                  }}
                  className={`flex flex-col items-center gap-1 py-1.5 rounded-xl border transition-colors ${
                    isSel ? 'bg-accent/15 border-accent' : 'bg-elevated border-border hover:border-accent/50'
                  }`}
                >
                  <span className={`text-[10px] font-bold ${isToday ? 'text-accent' : 'text-muted'}`}>{WEEKDAYS[d.getDay()]}</span>
                  <span className="text-sm font-extrabold text-primary">{d.getDate()}</span>
                  <span
                    className="w-6 h-1 rounded-full"
                    style={{ background: st.logged ? `color-mix(in srgb, #10b981 ${Math.max(15, ring)}%, #3f3f46)` : '#27272a' }}
                    title={st.planned ? `${ring}% das refeições` : 'Sem refeições planejadas'}
                  />
                </button>
              );
            })}
          </div>
          <button type="button" onClick={() => setSelected(addDays(selected, 7))} aria-label="Próxima semana" className="p-1.5 rounded-lg text-secondary hover:text-primary hover:bg-elevated">
            <ChevronRight className="w-4 h-4" />
          </button>
          {selKey !== keyOf(today) && (
            <button type="button" onClick={() => setSelected(today)} className="px-2 py-1 rounded-lg text-[11px] font-bold text-accent hover:bg-accent/10">
              Hoje
            </button>
          )}
        </div>
      )}

      {/* ================= DIA ================= */}
      {view === 'day' && (
        <>
          <p className="text-xs font-bold text-primary flex items-center gap-1.5">
            <CalendarDays className="w-3.5 h-3.5 text-amber-400" />
            {WEEKDAY_NAMES[selected.getDay()]}, {selected.getDate()} de {MONTHS[selected.getMonth()]}
            {selKey === keyOf(today) && <span className="px-1.5 py-0.5 rounded-full bg-accent/15 text-accent text-[9px] font-black uppercase">Hoje</span>}
          </p>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div className="p-3.5 rounded-xl bg-elevated border border-border space-y-2">
              <span className="text-[10px] font-mono text-muted uppercase">Energia</span>
              <p className="text-lg font-bold font-mono text-primary">
                {sel.kcal} / {calGoal} kcal <span className="text-xs font-normal text-muted">(plano: {plannedKcal})</span>
              </p>
              <Bar value={sel.kcal} goal={calGoal} color="#f59e0b" />
            </div>
            <div className="p-3.5 rounded-xl bg-elevated border border-border space-y-2">
              <span className="text-[10px] font-mono text-muted uppercase">Proteínas</span>
              <p className="text-lg font-bold font-mono text-emerald-400">
                {sel.protein}g / {protGoal}g
              </p>
              <Bar value={sel.protein} goal={protGoal} color="#10b981" />
            </div>
            <div className="p-3.5 rounded-xl bg-elevated border border-border space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-mono text-muted uppercase">Hidratação ({sel.water * 250} ml)</span>
                {isAdmin && (
                  <div className="flex items-center gap-1">
                    <button type="button" onClick={() => writeDay({ water: Math.max(0, sel.water - 1) })} className="px-2 py-0.5 rounded bg-surface border border-border text-xs font-mono" aria-label="Menos um copo">
                      −
                    </button>
                    <button type="button" onClick={() => writeDay({ water: sel.water + 1 })} className="px-2 py-0.5 rounded bg-surface border border-border hover:border-sky-500 text-sky-400 text-xs font-mono" aria-label="Mais um copo">
                      +1
                    </button>
                  </div>
                )}
              </div>
              <p className="text-lg font-bold font-mono text-sky-400 flex items-center gap-1.5">
                <Droplets className="w-4 h-4" /> {sel.water} / {waterGoal} copos
              </p>
              <Bar value={sel.water} goal={waterGoal} color="#38bdf8" />
            </div>
          </div>

          {/* agenda do dia */}
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-extrabold uppercase tracking-wider text-secondary">Agenda de refeições</span>
            {isAdmin && (
              <button type="button" onClick={() => setEditingPlan((v) => !v)} className={`px-2.5 py-1 rounded-lg text-[11px] font-bold ${editingPlan ? 'bg-accent text-white' : 'text-accent hover:bg-accent/10'}`}>
                {editingPlan ? 'Concluir edição' : 'Editar plano'}
              </button>
            )}
          </div>

          <ol className="relative space-y-2 pl-5 before:absolute before:left-[7px] before:top-2 before:bottom-2 before:w-px before:bg-border">
            {(editingPlan ? meals : plannedToday).map((meal) => {
              const done = selLog.done.includes(meal.id);
              const appliesToday = mealsFor([meal], selected).length > 0;
              return (
                <li key={meal.id} className="relative">
                  <span className={`absolute -left-5 top-3.5 w-3.5 h-3.5 rounded-full border-2 ${done ? 'bg-emerald-500 border-emerald-500' : 'bg-background border-border'}`} />
                  <div className={`p-3 rounded-xl border ${done ? 'bg-emerald-500/5 border-emerald-500/30' : 'bg-elevated border-border'} ${editingPlan && !appliesToday ? 'opacity-60' : ''}`}>
                    <div className="flex flex-wrap items-center gap-3">
                      {!editingPlan && (
                        <button
                          type="button"
                          disabled={!isAdmin}
                          onClick={() => writeDay({ done: done ? selLog.done.filter((x) => x !== meal.id) : [...selLog.done, meal.id] })}
                          aria-label={done ? 'Desmarcar refeição' : 'Marcar refeição como feita'}
                          className={`w-6 h-6 rounded-lg border flex items-center justify-center shrink-0 ${done ? 'bg-emerald-500 border-emerald-500 text-white' : 'border-border bg-surface'}`}
                        >
                          {done && <Check className="w-4 h-4" />}
                        </button>
                      )}
                      {editingPlan ? (
                        <input type="time" value={meal.at || ''} onChange={(e) => updateMeal(meal.id, { at: e.target.value })} className="px-1.5 py-1 rounded bg-surface border border-border text-xs font-mono text-primary" />
                      ) : (
                        meal.at && <span className="text-xs font-mono font-bold text-accent w-11">{meal.at}</span>
                      )}
                      <div className="flex-1 min-w-[160px]">
                        {editingPlan ? (
                          <>
                            <input value={meal.time} onChange={(e) => updateMeal(meal.id, { time: e.target.value })} className="w-full bg-transparent text-xs font-bold text-primary focus:outline-none" />
                            <input value={meal.foods} onChange={(e) => updateMeal(meal.id, { foods: e.target.value })} className="w-full bg-transparent text-xs text-secondary focus:outline-none mt-0.5" />
                          </>
                        ) : (
                          <>
                            <p className="text-xs font-bold text-primary">{meal.time}</p>
                            <p className="text-xs text-secondary">{meal.foods}</p>
                          </>
                        )}
                      </div>
                      <div className="flex items-center gap-1.5 text-xs font-mono">
                        {editingPlan ? (
                          <>
                            <input type="number" value={meal.calories} onChange={(e) => updateMeal(meal.id, { calories: Number(e.target.value) || 0 })} className="w-14 px-1 py-0.5 rounded bg-surface border border-border text-right text-primary" />
                            <span className="text-[10px] text-muted">kcal</span>
                            <input type="number" value={meal.proteinGrams} onChange={(e) => updateMeal(meal.id, { proteinGrams: Number(e.target.value) || 0 })} className="w-11 px-1 py-0.5 rounded bg-surface border border-border text-right text-emerald-400" />
                            <span className="text-[10px] text-muted">g P</span>
                            <button type="button" onClick={() => persist({ ...data, dietLog: log, dietMeals: meals.filter((m) => m.id !== meal.id) })} className="p-1 text-muted hover:text-danger" aria-label="Remover refeição">
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </>
                        ) : (
                          <span className="text-muted">
                            {meal.calories} kcal · <span className="text-emerald-400">{meal.proteinGrams}g P</span>
                          </span>
                        )}
                      </div>
                    </div>
                    {editingPlan && (
                      <div className="mt-2 flex items-center gap-1">
                        <span className="text-[10px] text-muted mr-1">Dias:</span>
                        {WEEKDAYS.map((w, wd) => {
                          const on = !meal.days || meal.days.length === 0 || meal.days.includes(wd);
                          return (
                            <button
                              key={wd}
                              type="button"
                              title={WEEKDAY_NAMES[wd]}
                              onClick={() => {
                                const cur = !meal.days || meal.days.length === 0 ? [0, 1, 2, 3, 4, 5, 6] : meal.days;
                                const next = on ? cur.filter((x) => x !== wd) : [...cur, wd].sort();
                                updateMeal(meal.id, { days: next.length === 7 ? [] : next });
                              }}
                              className={`w-6 h-6 rounded-md text-[10px] font-bold ${on ? 'bg-amber-500/20 text-amber-400 border border-amber-500/40' : 'bg-surface text-muted border border-border'}`}
                            >
                              {w}
                            </button>
                          );
                        })}
                      </div>
                    )}
                  </div>
                </li>
              );
            })}
            {!editingPlan && plannedToday.length === 0 && <li className="text-xs text-muted py-2">Nenhuma refeição planejada para este dia.</li>}
          </ol>

          {isAdmin && editingPlan && (
            <button
              type="button"
              onClick={() =>
                persist({
                  ...data,
                  dietLog: log,
                  dietMeals: [
                    ...meals,
                    { id: `meal-${Date.now()}`, time: 'Nova refeição', foods: 'Alimentos', calories: 350, proteinGrams: 25, completed: false, at: '12:00', days: [] },
                  ],
                })
              }
              className="self-start px-3.5 py-1.5 rounded-xl bg-accent text-white text-xs font-semibold inline-flex items-center gap-1.5"
            >
              <Plus className="w-3.5 h-3.5" /> Adicionar refeição
            </button>
          )}

          {/* peso e nota do dia */}
          <div className="grid grid-cols-1 sm:grid-cols-[180px_1fr] gap-3">
            <label className="p-3 rounded-xl bg-elevated border border-border flex items-center gap-2">
              <Scale className="w-4 h-4 text-violet-400" />
              <span className="text-[10px] font-mono uppercase text-muted">Peso</span>
              <input
                key={`w-${selKey}`}
                type="number"
                step="0.1"
                disabled={!isAdmin}
                defaultValue={selLog.weight ?? ''}
                placeholder="—"
                onBlur={(e) => {
                  const v = e.target.value ? Number(e.target.value) : undefined;
                  if (v !== selLog.weight) writeDay({ weight: v });
                }}
                className="w-16 ml-auto bg-transparent text-right text-sm font-bold font-mono text-primary focus:outline-none"
              />
              <span className="text-xs text-muted">kg</span>
            </label>
            <input
              key={`n-${selKey}`}
              disabled={!isAdmin}
              defaultValue={selLog.note || ''}
              onBlur={(e) => {
                if (e.target.value !== (selLog.note || '')) writeDay({ note: e.target.value });
              }}
              placeholder="Como foi o dia? (fome, treino, sono...)"
              className="p-3 rounded-xl bg-elevated border border-border text-xs text-primary placeholder:text-muted focus:outline-none focus:border-accent"
            />
          </div>
        </>
      )}

      {/* ================= SEMANA ================= */}
      {view === 'week' && (() => {
        const sum = summarize(weekStats.filter((s) => fromKey(s.key) <= today));
        const maxK = Math.max(calGoal * 1.25, ...weekStats.map((s) => s.kcal));
        return (
          <>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <Stat icon={<Trophy className="w-3 h-3" />} label="Aderência" value={`${sum.adherence}%`} sub={`${sum.days} dia(s) registrados`} />
              <Stat icon={<Flame className="w-3 h-3" />} label="Média kcal" value={`${sum.avgKcal}`} sub={`${sum.onTarget} dia(s) na meta ±10%`} />
              <Stat icon={<Beef className="w-3 h-3" />} label="Média proteína" value={`${sum.avgProtein}g`} sub={`meta ${protGoal}g`} />
              <Stat icon={<Droplets className="w-3 h-3" />} label="Média água" value={`${sum.avgWater} copos`} sub={`meta ${waterGoal}`} />
            </div>
            <div className="p-4 rounded-xl bg-elevated border border-border">
              <div className="relative h-48 flex items-end gap-2 sm:gap-4">
                <div className="absolute inset-x-0 border-t border-dashed border-amber-500/60" style={{ bottom: `${(calGoal / maxK) * 100}%` }}>
                  <span className="absolute -top-4 right-0 text-[9px] font-mono text-amber-400">meta {calGoal}</span>
                </div>
                {weekStats.map((s, i) => (
                  <button key={s.key} type="button" onClick={() => { setSelected(week[i]); setView('day'); }} className="flex-1 h-full flex flex-col justify-end items-center gap-1 group" title={`${s.kcal} kcal · ${Math.round(s.adherence * 100)}%`}>
                    <span className="text-[9px] font-mono text-muted opacity-0 group-hover:opacity-100">{s.kcal}</span>
                    <div className="w-full max-w-[38px] rounded-t-lg bg-gradient-to-t from-amber-600 to-amber-400" style={{ height: `${(s.kcal / maxK) * 100}%`, minHeight: s.kcal ? 4 : 0 }} />
                  </button>
                ))}
              </div>
              <div className="mt-2 grid grid-cols-7 gap-2 sm:gap-4 text-center">
                {weekStats.map((s, i) => (
                  <div key={s.key}>
                    <p className="text-[10px] font-bold text-muted">{WEEKDAYS[week[i].getDay()]}</p>
                    <p className="text-[10px] font-mono text-emerald-400">{s.planned ? `${s.done}/${s.planned}` : '—'}</p>
                    <p className="text-[10px] font-mono text-sky-400">{s.water}💧</p>
                  </div>
                ))}
              </div>
            </div>
            {sum.streak > 1 && (
              <p className="text-xs text-emerald-400 font-semibold flex items-center gap-1.5">
                <Trophy className="w-3.5 h-3.5" /> {sum.streak} dias seguidos cumprindo 80%+ do plano
              </p>
            )}
          </>
        );
      })()}

      {/* ================= MÊS ================= */}
      {view === 'month' && (() => {
        const sum = summarize(monthStats);
        const firstW = weightsInMonth[0]?.w;
        const lastW = weightsInMonth[weightsInMonth.length - 1]?.w;
        return (
          <>
            <div className="flex items-center justify-between">
              <button type="button" onClick={() => setMonthCursor(new Date(monthCursor.getFullYear(), monthCursor.getMonth() - 1, 1))} aria-label="Mês anterior" className="p-1.5 rounded-lg text-secondary hover:text-primary hover:bg-elevated">
                <ChevronLeft className="w-4 h-4" />
              </button>
              <span className="text-sm font-extrabold text-primary">
                {MONTHS[monthCursor.getMonth()].replace(/^./, (c) => c.toUpperCase())} de {monthCursor.getFullYear()}
              </span>
              <button type="button" onClick={() => setMonthCursor(new Date(monthCursor.getFullYear(), monthCursor.getMonth() + 1, 1))} aria-label="Próximo mês" className="p-1.5 rounded-lg text-secondary hover:text-primary hover:bg-elevated">
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <Stat icon={<Trophy className="w-3 h-3" />} label="Aderência" value={`${sum.adherence}%`} sub={`${sum.days} dia(s) registrados`} />
              <Stat icon={<Flame className="w-3 h-3" />} label="Dias na meta" value={`${sum.onTarget}`} sub={`média ${sum.avgKcal} kcal`} />
              <Stat icon={<Beef className="w-3 h-3" />} label="Média proteína" value={`${sum.avgProtein}g`} sub={`água ${sum.avgWater} copos/dia`} />
              <Stat
                icon={<Scale className="w-3 h-3" />}
                label="Peso"
                value={lastW ? `${lastW} kg` : '—'}
                sub={firstW && lastW && weightsInMonth.length > 1 ? `${lastW - firstW >= 0 ? '+' : ''}${(lastW - firstW).toFixed(1)} kg no mês` : 'registre no dia'}
              />
            </div>
            <div className="p-3 rounded-xl bg-elevated border border-border">
              <div className="grid grid-cols-7 gap-1 text-center mb-1">
                {['S', 'T', 'Q', 'Q', 'S', 'S', 'D'].map((w, i) => (
                  <span key={i} className="text-[10px] font-bold text-muted">{w}</span>
                ))}
              </div>
              <div className="grid grid-cols-7 gap-1">
                {monthDays.map((d, i) => {
                  if (!d) return <span key={`e${i}`} />;
                  const st = statsFor(meals, log, d);
                  const future = d > today;
                  const pct = Math.round(st.adherence * 100);
                  return (
                    <button
                      key={keyOf(d)}
                      type="button"
                      onClick={() => {
                        setSelected(d);
                        setView('day');
                      }}
                      title={st.logged ? `${pct}% · ${st.kcal} kcal · ${st.water} copos` : 'Sem registro'}
                      className={`aspect-square sm:aspect-auto sm:h-11 rounded-lg text-[11px] font-bold flex items-center justify-center border ${
                        keyOf(d) === keyOf(today) ? 'border-accent' : 'border-transparent'
                      } ${future ? 'text-muted/50' : 'text-primary'}`}
                      style={{
                        background: st.logged ? `color-mix(in srgb, #10b981 ${Math.max(12, pct)}%, #18181b)` : future ? 'transparent' : '#1f1f23',
                      }}
                    >
                      {d.getDate()}
                    </button>
                  );
                })}
              </div>
              <div className="mt-2 flex items-center justify-end gap-1.5 text-[10px] text-muted">
                menos
                {[12, 40, 70, 100].map((p) => (
                  <span key={p} className="w-3 h-3 rounded" style={{ background: `color-mix(in srgb, #10b981 ${p}%, #18181b)` }} />
                ))}
                mais
              </div>
            </div>
          </>
        );
      })()}
    </div>
  );
}
