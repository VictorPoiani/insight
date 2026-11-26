'use client';

import { useEffect, useMemo, useState } from 'react';
import { Plus, Search, X } from 'lucide-react';
import { ENTRY_KINDS, entryKind, type EntryKind, type NotebookEntry } from '@/lib/notebook/entries';
import type { NotebookItem } from '@/lib/notebook/types';
import type { EntriesApi } from '@/lib/notebook/useEntries';
import { Glyph } from '../icons/Glyph';

const norm = (s: string) =>
  s
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '');

/** "Vincular informação": escolhe uma entrada do Sumário ou cria uma nova. */
export function EntryDialog({
  text,
  projectId,
  entriesApi,
  notes,
  onCancel,
  onDone,
}: {
  text: string;
  projectId: string | null;
  entriesApi: EntriesApi;
  notes: NotebookItem[];
  onCancel: () => void;
  onDone: (e: NotebookEntry) => void;
}) {
  const all = Object.values(entriesApi.entries);
  const [query, setQuery] = useState(text);
  const [mode, setMode] = useState<'pick' | 'new'>('pick');
  const [kind, setKind] = useState<EntryKind>('elemento');
  const [title, setTitle] = useState(text);
  const [summary, setSummary] = useState('');
  const sameTitle = notes.find((n) => norm(n.title) === norm(text));
  const [target, setTarget] = useState<string>(sameTitle?.id || '');
  const [saving, setSaving] = useState(false);

  const matches = useMemo(() => {
    const q = norm(query.trim());
    return all
      .filter((e) => !q || norm(e.title).includes(q) || e.aliases.some((a) => norm(a).includes(q)))
      .sort((a, b) => Number(b.project_id === projectId) - Number(a.project_id === projectId) || a.title.localeCompare(b.title, 'pt-BR'))
      .slice(0, 8);
  }, [all, query, projectId]);

  useEffect(() => {
    if (!all.some((e) => norm(e.title) === norm(text))) setMode(all.length ? 'pick' : 'new');
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onCancel();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const sortedNotes = useMemo(
    () =>
      notes
        .filter((n) => n.kind === 'note' || n.template === 'book')
        .sort((a, b) => a.title.localeCompare(b.title, 'pt-BR'))
        .slice(0, 400),
    [notes]
  );

  async function create() {
    if (!title.trim()) return;
    setSaving(true);
    const e = await entriesApi.create({ kind, title, summary, target_id: target || null, project_id: projectId });
    setSaving(false);
    if (e) onDone(e);
  }

  return (
    <div className="fixed inset-0 z-[75] grid place-items-center p-4 bg-black/55 backdrop-blur-sm" onMouseDown={onCancel}>
      <div role="dialog" aria-label="Vincular informação" onMouseDown={(e) => e.stopPropagation()} className="w-full max-w-lg rounded-2xl border border-[var(--nb-line)] bg-[var(--nb-pane)] shadow-2xl nb-cs-in">
        <div className="flex items-center justify-between px-5 pt-4">
          <div className="min-w-0">
            <p className="text-[10px] font-black uppercase tracking-[0.22em] text-[var(--nb-hl)]">Vincular informação</p>
            <p className="mt-0.5 text-[13px] text-[var(--nb-ink-2)] truncate">
              Trecho: <span className="font-semibold text-[var(--nb-ink)]">“{text}”</span>
            </p>
          </div>
          <button type="button" aria-label="Fechar" onClick={onCancel} className="p-1 rounded-md text-[var(--nb-ink-3)] hover:text-[var(--nb-ink)]">
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="px-5 pt-3 flex gap-1" role="tablist">
          {(
            [
              ['pick', 'Usar do Sumário'],
              ['new', 'Criar nova'],
            ] as const
          ).map(([m, label]) => (
            <button
              key={m}
              type="button"
              role="tab"
              aria-selected={mode === m}
              onClick={() => setMode(m)}
              className={`h-7 px-3 rounded-full text-[12px] font-bold ${mode === m ? 'bg-[var(--nb-pane-2)] text-[var(--nb-ink)]' : 'text-[var(--nb-ink-3)] hover:text-[var(--nb-ink)]'}`}
            >
              {label}
            </button>
          ))}
        </div>

        {mode === 'pick' ? (
          <div className="p-5 space-y-3">
            <label className="flex items-center gap-2 h-9 px-3 rounded-xl bg-[var(--nb-bg)] border border-[var(--nb-line)] focus-within:border-[var(--nb-hl)]">
              <Search className="w-3.5 h-3.5 text-[var(--nb-ink-3)]" />
              <input autoFocus value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Buscar no Sumário" className="flex-1 bg-transparent outline-none text-[13px]" />
            </label>
            <div className="max-h-72 overflow-y-auto nb-scroll space-y-1">
              {matches.map((e) => {
                const k = entryKind(e.kind);
                return (
                  <button
                    key={e.id}
                    type="button"
                    onClick={() => onDone(e)}
                    className="w-full flex items-start gap-3 p-2.5 rounded-xl text-left hover:bg-[var(--nb-pane-2)]"
                  >
                    <span className="mt-0.5 w-7 h-7 shrink-0 grid place-items-center rounded-lg text-[15px]" style={{ color: k.color, background: `color-mix(in srgb, ${k.color} 14%, transparent)` }}>
                      <Glyph name={k.glyph} />
                    </span>
                    <span className="min-w-0">
                      <span className="block text-[13px] font-bold">{e.title}</span>
                      <span className="block text-[12px] text-[var(--nb-ink-3)] line-clamp-2">{e.summary || k.short}</span>
                    </span>
                  </button>
                );
              })}
              {!matches.length && <p className="text-[13px] text-[var(--nb-ink-3)] px-1">Nada no Sumário com esse nome.</p>}
            </div>
            <button
              type="button"
              onClick={() => {
                setTitle(query.trim() || text);
                setMode('new');
              }}
              className="flex items-center gap-1.5 h-8 px-3 rounded-lg bg-[var(--nb-pane-2)] text-[12px] font-bold hover:text-[var(--nb-hl)]"
            >
              <Plus className="w-3.5 h-3.5" /> Criar “{(query.trim() || text).slice(0, 40)}”
            </button>
          </div>
        ) : (
          <form
            className="p-5 space-y-3.5"
            onSubmit={(e) => {
              e.preventDefault();
              void create();
            }}
          >
            <div className="grid grid-cols-3 gap-1.5" role="radiogroup" aria-label="Tipo de informação">
              {ENTRY_KINDS.map((k) => (
                <button
                  key={k.id}
                  type="button"
                  role="radio"
                  aria-checked={kind === k.id}
                  onClick={() => setKind(k.id)}
                  className={`flex flex-col items-center gap-1 p-2 rounded-xl border text-[11px] font-bold transition-colors ${
                    kind === k.id ? 'border-[var(--nb-hl)] bg-[var(--nb-hl-soft)] text-[var(--nb-ink)]' : 'border-[var(--nb-line)] text-[var(--nb-ink-3)]'
                  }`}
                >
                  <Glyph name={k.glyph} className="text-[17px]" />
                  {k.short}
                </button>
              ))}
            </div>
            <p className="text-[12px] text-[var(--nb-ink-3)]">{entryKind(kind).hint}</p>
            <input
              autoFocus
              value={title}
              onChange={(e) => setTitle(e.target.value.slice(0, 160))}
              placeholder="Título (ex.: Filho de Maicon)"
              aria-label="Título"
              className="w-full h-9 px-3 rounded-xl bg-[var(--nb-bg)] border border-[var(--nb-line)] focus:border-[var(--nb-hl)] outline-none text-[14px] font-semibold"
            />
            <textarea
              value={summary}
              onChange={(e) => setSummary(e.target.value.slice(0, 1200))}
              rows={4}
              placeholder={kind === 'aviso' ? 'Ex.: Este trecho é uma interpretação do autor e pode conter imprecisões.' : 'Resumo curto que aparece no balão.'}
              aria-label="Resumo"
              className="w-full resize-none px-3 py-2 rounded-xl bg-[var(--nb-bg)] border border-[var(--nb-line)] focus:border-[var(--nb-hl)] outline-none text-[13px] leading-relaxed"
            />
            <label className="block">
              <span className="text-[11px] font-bold text-[var(--nb-ink-3)]">“Ler mais” abre</span>
              <select
                value={target}
                onChange={(e) => setTarget(e.target.value)}
                className="mt-1 w-full h-9 px-2 rounded-xl bg-[var(--nb-bg)] border border-[var(--nb-line)] outline-none text-[13px]"
              >
                <option value="">a própria entrada no Sumário</option>
                {sortedNotes.map((n) => (
                  <option key={n.id} value={n.id}>
                    {n.title}
                  </option>
                ))}
              </select>
            </label>
            <div className="flex justify-end gap-2 pt-1">
              <button type="button" onClick={onCancel} className="h-9 px-4 rounded-lg text-[13px] font-bold text-[var(--nb-ink-2)] hover:bg-[var(--nb-pane-2)]">
                Cancelar
              </button>
              <button type="submit" disabled={saving || !title.trim()} className="h-9 px-4 rounded-lg bg-[var(--nb-hl)] text-white text-[13px] font-bold disabled:opacity-50">
                {saving ? 'Criando…' : 'Criar e vincular'}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
