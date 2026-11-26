'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Check, Flame, Timer, Type, X } from 'lucide-react';
import type { NotebookItem } from '@/lib/notebook/types';
import type { NotebookApi } from '@/lib/notebook/useNotebook';

/**
 * Sessão de escrita: meta da sessão (palavras ou minutos), cronômetro discreto,
 * sequência de dias escrevendo e um resumo no fim.
 * Conta as palavras novas em qualquer nota do Notebook durante a sessão.
 */

export type GoalType = 'words' | 'minutes';

interface SessionState {
  startedAt: number;
  goalType: GoalType;
  goal: number;
  /** palavras de cada nota no início */
  base: Record<string, number>;
  reached?: boolean;
}

export interface SessionSummary {
  words: number;
  minutes: number;
  goalType: GoalType;
  goal: number;
  reached: boolean;
  streak: number;
  notes: { id: string; title: string; words: number }[];
}

const KEY = (pid: string) => `insight-notebook-session:${pid}`;
const LOG = (pid: string) => `insight-notebook-writing-log:${pid}`;

export const dayKey = (d = new Date()) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

function readJson<T>(k: string, fallback: T): T {
  try {
    const v = JSON.parse(localStorage.getItem(k) || 'null');
    return v ?? fallback;
  } catch {
    return fallback;
  }
}
function writeJson(k: string, v: unknown) {
  try {
    if (v === null) localStorage.removeItem(k);
    else localStorage.setItem(k, JSON.stringify(v));
  } catch {
    /* sem armazenamento: a sessão vale só nesta aba */
  }
}

/** Dias seguidos escrevendo (hoje conta só se já escreveu). */
export function computeStreak(days: Set<string>) {
  let s = 0;
  const d = new Date();
  if (!days.has(dayKey(d))) d.setDate(d.getDate() - 1);
  while (days.has(dayKey(d))) {
    s++;
    d.setDate(d.getDate() - 1);
  }
  return s;
}

export function useWritingSession(api: NotebookApi, profileId: string) {
  const [state, setState] = useState<SessionState | null>(null);
  const [now, setNow] = useState(() => Date.now());
  const [summary, setSummary] = useState<SessionSummary | null>(null);
  const [toast, setToast] = useState<string | null>(null);

  useEffect(() => {
    const s = readJson<SessionState | null>(KEY(profileId), null);
    // sessões esquecidas abertas por mais de 12 h são descartadas
    if (s && Date.now() - s.startedAt < 12 * 3600_000) setState(s);
  }, [profileId]);

  useEffect(() => {
    if (!state) return;
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, [state]);

  const perNote = useMemo(() => {
    if (!state) return [] as { item: NotebookItem; words: number }[];
    const out: { item: NotebookItem; words: number }[] = [];
    for (const it of Object.values(api.items)) {
      if (it.kind !== 'note') continue;
      const created = new Date(it.created_at).getTime() >= state.startedAt;
      const base = state.base[it.id] ?? (created ? 0 : it.word_count);
      const w = it.word_count - base;
      if (w > 0) out.push({ item: it, words: w });
    }
    return out.sort((a, b) => b.words - a.words);
  }, [api.items, state]);

  const words = perNote.reduce((n, p) => n + p.words, 0);
  const elapsedMs = state ? Math.max(0, now - state.startedAt) : 0;
  const progress = state ? Math.min(1, state.goalType === 'words' ? words / state.goal : elapsedMs / (state.goal * 60_000)) : 0;

  // dias com escrita (este aparelho + histórico dos livros, que é sincronizado)
  const writingDays = useCallback(() => {
    const days = new Set<string>();
    const log = readJson<Record<string, number>>(LOG(profileId), {});
    Object.entries(log).forEach(([k, v]) => v > 0 && days.add(k));
    Object.values(api.items).forEach((i) => {
      if (i.template !== 'book' || !i._full) return;
      Object.entries((i.data?.history as Record<string, number>) || {}).forEach(([k, v]) => v > 0 && days.add(k));
    });
    return days;
  }, [api.items, profileId]);

  // meta alcançada: aviso discreto, uma vez
  useEffect(() => {
    if (!state || state.reached || progress < 1) return;
    const next = { ...state, reached: true };
    setState(next);
    writeJson(KEY(profileId), next);
    setToast(state.goalType === 'words' ? `Meta da sessão alcançada: ${state.goal.toLocaleString('pt-BR')} palavras` : `${state.goal} minutos de escrita concluídos`);
  }, [progress, state, profileId]);
  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 5000);
    return () => clearTimeout(t);
  }, [toast]);

  const start = useCallback(
    (goalType: GoalType, goal: number) => {
      const base: Record<string, number> = {};
      Object.values(api.items).forEach((i) => (base[i.id] = i.word_count));
      const s: SessionState = { startedAt: Date.now(), goalType, goal: Math.max(1, Math.round(goal)), base };
      setState(s);
      setNow(Date.now());
      writeJson(KEY(profileId), s);
    },
    [api.items, profileId]
  );

  const end = useCallback(
    (show = true) => {
      if (!state) return;
      void api.flushAll();
      if (words > 0) {
        const log = readJson<Record<string, number>>(LOG(profileId), {});
        const k = dayKey();
        log[k] = (log[k] || 0) + words;
        const keys = Object.keys(log).sort();
        while (keys.length > 400) delete log[keys.shift()!];
        writeJson(LOG(profileId), log);
      }
      if (show)
        setSummary({
          words,
          minutes: Math.max(1, Math.round(elapsedMs / 60_000)),
          goalType: state.goalType,
          goal: state.goal,
          reached: progress >= 1,
          streak: computeStreak(writingDays()),
          notes: perNote.slice(0, 6).map((p) => ({ id: p.item.id, title: p.item.title, words: p.words })),
        });
      setState(null);
      writeJson(KEY(profileId), null);
    },
    [api, state, words, elapsedMs, progress, perNote, profileId, writingDays]
  );

  return { state, words, elapsedMs, progress, start, end, summary, closeSummary: () => setSummary(null), toast, streak: () => computeStreak(writingDays()) };
}

export type WritingSessionApi = ReturnType<typeof useWritingSession>;

const clock = (ms: number) => {
  const s = Math.floor(ms / 1000);
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const ss = String(s % 60).padStart(2, '0');
  return h ? `${h}:${String(m).padStart(2, '0')}:${ss}` : `${m}:${ss}`;
};

function Ring({ value, done, size = 22 }: { value: number; done: boolean; size?: number }) {
  const r = size / 2 - 2.5;
  const c = 2 * Math.PI * r;
  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className="-rotate-90 shrink-0" aria-hidden="true">
      <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="var(--nb-line)" strokeWidth="2.5" />
      <circle
        cx={size / 2}
        cy={size / 2}
        r={r}
        fill="none"
        stroke={done ? '#22c55e' : 'var(--nb-hl)'}
        strokeWidth="2.5"
        strokeLinecap="round"
        strokeDasharray={c}
        strokeDashoffset={c * (1 - value)}
        style={{ transition: 'stroke-dashoffset .4s ease' }}
      />
    </svg>
  );
}

// ============================================================================
// Começar
// ============================================================================

const WORD_PRESETS = [250, 500, 1000, 2000];
const MIN_PRESETS = [15, 25, 45, 60];

export function SessionStartDialog({ onStart, onClose, streak }: { onStart: (t: GoalType, goal: number) => void; onClose: () => void; streak: number }) {
  const [type, setType] = useState<GoalType>(() => (typeof window !== 'undefined' && (localStorage.getItem('insight-notebook-session-type') as GoalType)) || 'words');
  const [goal, setGoal] = useState<number>(type === 'words' ? 500 : 25);
  const presets = type === 'words' ? WORD_PRESETS : MIN_PRESETS;
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const k = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', k);
    return () => window.removeEventListener('keydown', k);
  }, [onClose]);

  return (
    <div className="nb-modal-back" onClick={onClose}>
      <form
        className="nb-modal !max-w-sm p-5 space-y-4"
        role="dialog"
        aria-label="Sessão de escrita"
        onClick={(e) => e.stopPropagation()}
        onSubmit={(e) => {
          e.preventDefault();
          try {
            localStorage.setItem('insight-notebook-session-type', type);
          } catch {
            /* ignora */
          }
          onStart(type, goal);
        }}
      >
        <div className="flex items-start gap-3">
          <span className="w-10 h-10 grid place-items-center rounded-xl bg-[var(--nb-hl-soft)] text-[var(--nb-hl)]">
            <Timer className="w-5 h-5" />
          </span>
          <div className="flex-1">
            <p className="font-black text-[16px]">Sessão de escrita</p>
            <p className="text-[12px] text-[var(--nb-ink-3)]">Defina uma meta para agora. O contador fica num canto, sem atrapalhar.</p>
          </div>
          <button type="button" onClick={onClose} aria-label="Fechar" className="p-1 rounded-md text-[var(--nb-ink-3)] hover:text-[var(--nb-ink)]">
            <X className="w-4 h-4" />
          </button>
        </div>
        <div className="grid grid-cols-2 gap-1 p-1 rounded-xl bg-[var(--nb-bg)] border border-[var(--nb-line)]">
          {(
            [
              ['words', 'Palavras', Type],
              ['minutes', 'Minutos', Timer],
            ] as const
          ).map(([id, label, Icon]) => (
            <button
              key={id}
              type="button"
              aria-pressed={type === id}
              onClick={() => {
                setType(id);
                setGoal(id === 'words' ? 500 : 25);
              }}
              className={`flex items-center justify-center gap-1.5 h-8 rounded-lg text-[12px] font-bold ${type === id ? 'bg-[var(--nb-pane-2)] text-[var(--nb-ink)]' : 'text-[var(--nb-ink-3)]'}`}
            >
              <Icon className="w-3.5 h-3.5" /> {label}
            </button>
          ))}
        </div>
        <div className="flex flex-wrap gap-1.5">
          {presets.map((p) => (
            <button
              key={p}
              type="button"
              aria-pressed={goal === p}
              onClick={() => setGoal(p)}
              className={`h-8 px-3 rounded-lg text-[12px] font-bold border ${goal === p ? 'border-[var(--nb-hl)] text-[var(--nb-hl)] bg-[var(--nb-hl-soft)]' : 'border-[var(--nb-line)] text-[var(--nb-ink-2)]'}`}
            >
              {p.toLocaleString('pt-BR')}
            </button>
          ))}
          <label className="flex items-center gap-1.5 h-8 px-2 rounded-lg border border-[var(--nb-line)] text-[12px] text-[var(--nb-ink-3)]">
            outra
            <input
              ref={inputRef}
              type="number"
              min={1}
              max={type === 'words' ? 50000 : 600}
              value={goal}
              onChange={(e) => setGoal(Math.max(1, Math.min(type === 'words' ? 50000 : 600, Number(e.target.value) || 1)))}
              aria-label="Meta"
              className="w-16 bg-transparent text-[var(--nb-ink)] font-bold outline-none"
            />
          </label>
        </div>
        {streak > 0 && (
          <p className="flex items-center gap-1.5 text-[12px] text-[var(--nb-ink-2)]">
            <Flame className="w-3.5 h-3.5 text-amber-400" /> {streak} {streak === 1 ? 'dia seguido' : 'dias seguidos'} escrevendo
          </p>
        )}
        <button type="submit" autoFocus className="w-full h-10 rounded-xl bg-[var(--nb-hl)] text-white text-[13px] font-black">
          Começar · {goal.toLocaleString('pt-BR')} {type === 'words' ? 'palavras' : 'minutos'}
        </button>
      </form>
    </div>
  );
}

// ============================================================================
// Contador discreto
// ============================================================================

export function SessionPill({ s, dim }: { s: WritingSessionApi; dim?: boolean }) {
  const [open, setOpen] = useState(false);
  if (!s.state) return s.toast ? <SessionToast text={s.toast} /> : null;
  const st = s.state;
  const done = s.progress >= 1;
  const main =
    st.goalType === 'words' ? `${s.words.toLocaleString('pt-BR')} / ${st.goal.toLocaleString('pt-BR')}` : `${clock(s.elapsedMs)} / ${st.goal}:00`;
  return (
    <>
      {s.toast && <SessionToast text={s.toast} />}
      <div className="nb-session" data-dim={dim} data-done={done}>
        <button type="button" className="nb-session-pill" onClick={() => setOpen((v) => !v)} aria-expanded={open} title="Sessão de escrita">
          {done ? <Check className="w-4 h-4 text-emerald-400" /> : <Ring value={s.progress} done={done} />}
          <span className="font-mono tabular-nums">{main}</span>
          <span className="text-[var(--nb-ink-3)]">{st.goalType === 'words' ? 'palavras' : 'min'}</span>
        </button>
        {open && (
          <div className="nb-session-pop">
            <div className="flex items-center gap-3">
              <Ring value={s.progress} done={done} size={44} />
              <div>
                <p className="text-[18px] font-black leading-none">{Math.round(s.progress * 100)}%</p>
                <p className="text-[11px] text-[var(--nb-ink-3)]">{done ? 'meta alcançada, siga se quiser' : 'da meta da sessão'}</p>
              </div>
            </div>
            <dl className="grid grid-cols-2 gap-2 text-[12px]">
              <div className="rounded-lg bg-[var(--nb-bg)] p-2">
                <dt className="text-[var(--nb-ink-3)]">Palavras</dt>
                <dd className="font-black text-[15px]">+{s.words.toLocaleString('pt-BR')}</dd>
              </div>
              <div className="rounded-lg bg-[var(--nb-bg)] p-2">
                <dt className="text-[var(--nb-ink-3)]">Tempo</dt>
                <dd className="font-black text-[15px] font-mono">{clock(s.elapsedMs)}</dd>
              </div>
            </dl>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => {
                  setOpen(false);
                  s.end(true);
                }}
                className="flex-1 h-8 rounded-lg bg-[var(--nb-hl)] text-white text-[12px] font-bold"
              >
                Encerrar sessão
              </button>
              <button
                type="button"
                onClick={() => {
                  if (!confirm('Descartar esta sessão? As palavras continuam nas notas, só o contador some.')) return;
                  setOpen(false);
                  s.end(false);
                }}
                className="h-8 px-3 rounded-lg border border-[var(--nb-line)] text-[12px] font-bold text-[var(--nb-ink-3)] hover:text-[var(--nb-ink)]"
              >
                Descartar
              </button>
            </div>
          </div>
        )}
      </div>
    </>
  );
}

function SessionToast({ text }: { text: string }) {
  return (
    <div className="nb-session-toast" role="status">
      <Check className="w-4 h-4 text-emerald-400" /> {text}
    </div>
  );
}

// ============================================================================
// Resumo
// ============================================================================

export function SessionSummaryDialog({ summary, onClose, onOpen, onAgain }: { summary: SessionSummary; onClose: () => void; onOpen: (id: string) => void; onAgain: () => void }) {
  const pace = Math.round(summary.words / Math.max(1, summary.minutes));
  return (
    <div className="nb-modal-back" onClick={onClose}>
      <div className="nb-modal !max-w-sm p-5 space-y-4" role="dialog" aria-label="Resumo da sessão" onClick={(e) => e.stopPropagation()}>
        <div className="text-center space-y-1">
          <p className="text-[11px] font-black uppercase tracking-[0.2em] text-[var(--nb-ink-3)]">Sessão encerrada</p>
          <p className="text-[40px] font-black leading-none">+{summary.words.toLocaleString('pt-BR')}</p>
          <p className="text-[13px] text-[var(--nb-ink-2)]">palavras em {summary.minutes} min</p>
        </div>
        <div className="grid grid-cols-3 gap-2 text-center text-[12px]">
          <div className="rounded-xl bg-[var(--nb-bg)] p-2">
            <p className="font-black text-[16px]">{pace}</p>
            <p className="text-[var(--nb-ink-3)]">palavras/min</p>
          </div>
          <div className="rounded-xl bg-[var(--nb-bg)] p-2">
            <p className={`font-black text-[16px] ${summary.reached ? 'text-emerald-400' : ''}`}>{summary.reached ? 'Sim' : 'Não'}</p>
            <p className="text-[var(--nb-ink-3)]">meta atingida</p>
          </div>
          <div className="rounded-xl bg-[var(--nb-bg)] p-2">
            <p className="font-black text-[16px] flex items-center justify-center gap-1">
              <Flame className="w-4 h-4 text-amber-400" />
              {summary.streak}
            </p>
            <p className="text-[var(--nb-ink-3)]">{summary.streak === 1 ? 'dia seguido' : 'dias seguidos'}</p>
          </div>
        </div>
        {summary.notes.length > 0 && (
          <div>
            <p className="mb-1 text-[10px] font-black uppercase tracking-wider text-[var(--nb-ink-3)]">Onde você escreveu</p>
            {summary.notes.map((n) => (
              <button
                key={n.id}
                type="button"
                onClick={() => (onClose(), onOpen(n.id))}
                className="w-full flex items-center gap-2 px-2 py-1.5 rounded-md text-[13px] hover:bg-[var(--nb-pane-2)]"
              >
                <span className="flex-1 truncate text-left">{n.title}</span>
                <span className="font-mono text-[12px] text-emerald-400">+{n.words.toLocaleString('pt-BR')}</span>
              </button>
            ))}
          </div>
        )}
        <div className="flex gap-2">
          <button type="button" onClick={onClose} className="flex-1 h-9 rounded-xl bg-[var(--nb-hl)] text-white text-[13px] font-bold">
            Fechar
          </button>
          <button type="button" onClick={onAgain} className="h-9 px-3 rounded-xl border border-[var(--nb-line)] text-[13px] font-bold text-[var(--nb-ink-2)]">
            Nova sessão
          </button>
        </div>
      </div>
    </div>
  );
}

