'use client';

import { ask as confirmDialog } from '@/lib/ui/feedback';
import { useEffect, useMemo, useRef, useState } from 'react';
import { BookMarked, ImagePlus, GripVertical, Loader2, Plus, Search, Trash2 } from 'lucide-react';
import { ENTRY_CATEGORIES, ENTRY_KINDS, entryLook, type EntryKind, type NotebookEntry } from '@/lib/notebook/entries';
import { EntryAvatar, EntrySidePanel, FamilyTree, MentionGraph, RelationsEditor } from './MentionViews';
import type { NotebookItem } from '@/lib/notebook/types';
import type { EntriesApi } from '@/lib/notebook/useEntries';
import { Glyph } from '../icons/Glyph';
import { itemIcon } from '../FileExplorer';
import { EntryAppearances } from './MentionContext';
import type { NotebookApi } from '@/lib/notebook/useNotebook';

const norm = (s: string) =>
  s
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '');

/**
 * Sumário: todas as menções definidas pelo autor, por projeto,
 * para consultar e editar num lugar só.
 */
export function SummaryView({
  items,
  projects,
  entriesApi,
  projectId,
  focusId,
  onProject,
  onOpen,
  onReadMore,
  onUploadImage,
  api,
}: {
  api: NotebookApi;
  items: NotebookItem[];
  projects: NotebookItem[];
  entriesApi: EntriesApi;
  /** undefined = todos; null = sem projeto */
  projectId: string | null | undefined;
  focusId: string | null;
  onProject: (id: string | null | undefined) => void;
  onOpen: (id: string) => void;
  onReadMore: (e: NotebookEntry) => void;
  onUploadImage: (f: File) => Promise<string | null>;
}) {
  const [tab, setTab] = useState<'lista' | 'grafo' | 'genealogia'>('lista');
  const [selected, setSelected] = useState<string | null>(null);
  const [root, setRoot] = useState<string | null>(null);
  const [q, setQ] = useState('');
  const [kind, setKind] = useState<EntryKind | 'all'>('all');
  const all = Object.values(entriesApi.entries);

  const list = useMemo(() => {
    const s = norm(q.trim());
    return all
      .filter((e) => (projectId === undefined ? true : (e.project_id ?? null) === projectId))
      .filter((e) => kind === 'all' || e.kind === kind)
      .filter((e) => !s || norm(e.title).includes(s) || norm(e.summary).includes(s) || e.aliases.some((a) => norm(a).includes(s)))
      .sort((a, b) => a.title.localeCompare(b.title, 'pt-BR'));
  }, [all, q, kind, projectId]);

  const usage = useMemo(() => {
    const m = new Map<string, NotebookItem[]>();
    for (const it of items) for (const id of it.entry_refs || []) m.set(id, [...(m.get(id) || []), it]);
    return m;
  }, [items]);

  // menções (conceitos) do projeto, para o grafo
  const scoped = useMemo(
    () => all.filter((e) => e.kind === 'elemento' && (projectId === undefined || (e.project_id ?? null) === projectId)),
    [all, projectId]
  );
  // pessoas com família registrada (as mais aparentadas primeiro)
  const people = useMemo(() => {
    const fam = new Map<string, number>();
    entriesApi.links.forEach((l) => {
      if (l.rel !== 'pai' && l.rel !== 'conjuge' && l.rel !== 'irmao') return;
      fam.set(l.from_id, (fam.get(l.from_id) || 0) + 1);
      fam.set(l.to_id, (fam.get(l.to_id) || 0) + 1);
    });
    return scoped
      .filter((e) => e.category === 'personagem' || fam.has(e.id))
      .sort((a, b) => (fam.get(b.id) || 0) - (fam.get(a.id) || 0) || a.title.localeCompare(b.title, 'pt-BR'));
  }, [scoped, entriesApi.links]);
  const treeRoot = root && entriesApi.entries[root] ? root : people[0]?.id || null;

  const notes = useMemo(() => items.filter((i) => i.kind === 'note' || i.template === 'book').sort((a, b) => a.title.localeCompare(b.title, 'pt-BR')), [items]);

  async function addEntry() {
    const e = await entriesApi.create({ kind: kind === 'all' ? 'elemento' : kind, title: 'Nova menção', summary: '', target_id: null, project_id: projectId ?? null });
    if (e) setTimeout(() => document.getElementById(`entry-${e.id}`)?.querySelector('input')?.focus(), 50);
  }

  return (
    <div className="nb-scroll absolute inset-0 overflow-y-auto">
      <div className="max-w-4xl mx-auto px-4 sm:px-8 py-10 space-y-6">
        <header className="flex items-start gap-4">
          <span className="w-12 h-12 shrink-0 grid place-items-center rounded-2xl bg-[var(--nb-hl-soft)] text-[var(--nb-hl)]">
            <BookMarked className="w-5 h-5" />
          </span>
          <div className="min-w-0">
            <p className="text-[10px] font-black uppercase tracking-[0.22em] text-[var(--nb-hl)]">Sumário</p>
            <h1 className="text-2xl sm:text-3xl font-black tracking-tight">Menções</h1>
            <p className="mt-1 text-[13px] text-[var(--nb-ink-3)] max-w-xl">
              Os conceitos da sua obra (personagens, lugares, organizações…), notas do autor e avisos. Digite + no texto para mencionar; passe o mouse numa menção para ver a prévia.
            </p>
          </div>
        </header>

        <div className="flex flex-wrap items-center gap-2">
          <select
            value={projectId === undefined ? '__all' : projectId === null ? '__none' : projectId}
            onChange={(e) => onProject(e.target.value === '__all' ? undefined : e.target.value === '__none' ? null : e.target.value)}
            aria-label="Projeto"
            className="h-9 px-2 rounded-xl bg-[var(--nb-pane)] border border-[var(--nb-line)] text-[13px] font-semibold outline-none"
          >
            <option value="__all">Todos os projetos</option>
            {projects.map((p) => (
              <option key={p.id} value={p.id}>
                {p.title}
              </option>
            ))}
            <option value="__none">Sem projeto</option>
          </select>
          <label className="flex-1 min-w-[180px] flex items-center gap-2 h-9 px-3 rounded-xl bg-[var(--nb-pane)] border border-[var(--nb-line)] focus-within:border-[var(--nb-hl)]">
            <Search className="w-3.5 h-3.5 text-[var(--nb-ink-3)]" />
            <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Buscar no Sumário" className="flex-1 bg-transparent outline-none text-[13px]" />
          </label>
          <button type="button" onClick={() => void addEntry()} className="flex items-center gap-1.5 h-9 px-3 rounded-xl bg-[var(--nb-hl)] text-white text-[12px] font-bold">
            <Plus className="w-3.5 h-3.5" /> Nova menção
          </button>
        </div>

        <div className="flex flex-wrap gap-1.5">
          {[{ id: 'all' as const, short: 'Tudo' }, ...ENTRY_KINDS].map((k) => {
            const n = k.id === 'all' ? list.length : all.filter((e) => e.kind === k.id && (projectId === undefined || (e.project_id ?? null) === projectId)).length;
            return (
              <button
                key={k.id}
                type="button"
                onClick={() => setKind(k.id)}
                aria-pressed={kind === k.id}
                className={`h-7 px-3 rounded-full text-[11px] font-bold border ${
                  kind === k.id ? 'bg-[var(--nb-pane-2)] text-[var(--nb-ink)] border-[var(--nb-line)]' : 'border-transparent text-[var(--nb-ink-3)] hover:text-[var(--nb-ink)]'
                }`}
              >
                {k.short} {k.id !== 'all' && <span className="opacity-60">{n}</span>}
              </button>
            );
          })}
        </div>

        <div className="flex gap-1 p-1 rounded-xl bg-[var(--nb-pane)] border border-[var(--nb-line)] w-max" role="tablist">
          {(
            [
              ['lista', 'Lista'],
              ['grafo', 'Grafo de conexões'],
              ['genealogia', 'Genealogia'],
            ] as const
          ).map(([id, label]) => (
            <button
              key={id}
              type="button"
              role="tab"
              aria-selected={tab === id}
              onClick={() => {
                setTab(id);
                setSelected(null);
              }}
              className={`h-8 px-3.5 rounded-lg text-[12px] font-bold ${tab === id ? 'bg-[var(--nb-pane-2)] text-[var(--nb-ink)]' : 'text-[var(--nb-ink-3)] hover:text-[var(--nb-ink)]'}`}
            >
              {label}
            </button>
          ))}
        </div>

        {tab !== 'lista' ? (
          <div className="relative">
            {tab === 'grafo' ? (
              <MentionGraph
                entries={scoped}
                links={entriesApi.links}
                storageKey={`insight-nb-graph:${projectId === undefined ? 'all' : projectId ?? 'none'}`}
                selectedId={selected}
                onSelect={setSelected}
              />
            ) : (
              <>
                <div className="mb-2 flex items-center gap-2">
                  <span className="text-[12px] font-bold text-[var(--nb-ink-3)]">Árvore de</span>
                  <select
                    value={treeRoot || ''}
                    onChange={(e) => {
                      setRoot(e.target.value || null);
                      setSelected(null);
                    }}
                    aria-label="Pessoa central da árvore"
                    className="h-8 px-2 rounded-lg bg-[var(--nb-pane)] border border-[var(--nb-line)] text-[12px] font-semibold outline-none"
                  >
                    {!people.length && <option value="">nenhum personagem ainda</option>}
                    {people.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.title}
                      </option>
                    ))}
                  </select>
                </div>
                <FamilyTree entries={entriesApi.entries} links={entriesApi.links} rootId={treeRoot} selectedId={selected} onSelect={setSelected} onRoot={(id) => (setRoot(id), setSelected(null))} />
              </>
            )}
            {selected && entriesApi.entries[selected] && (
              <EntrySidePanel entry={entriesApi.entries[selected]} entriesApi={entriesApi} onClose={() => setSelected(null)} onReadMore={onReadMore} />
            )}
          </div>
        ) : list.length ? (
          <div className="space-y-2.5">
            {list.map((e) => (
              <EntryCard
                key={e.id}
                entry={e}
                focus={focusId === e.id}
                usedIn={usage.get(e.id) || []}
                notes={notes}
                projects={projects}
                entriesApi={entriesApi}
                onOpen={onOpen}
                onUploadImage={onUploadImage}
                api={api}
              />
            ))}
          </div>
        ) : (
          <div className="rounded-2xl border border-dashed border-[var(--nb-line)] p-8 text-center">
            <p className="text-[14px] font-bold">Nada por aqui ainda</p>
            <p className="mt-1 text-[13px] text-[var(--nb-ink-3)]">
              Selecione um trecho em qualquer nota ou capítulo e use <span className="font-semibold text-[var(--nb-ink-2)]">Mencionar</span> no menu que aparece.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}

function EntryCard({
  entry,
  focus,
  usedIn,
  notes,
  projects,
  entriesApi,
  onOpen,
  onUploadImage,
  api,
}: {
  api: NotebookApi;
  entry: NotebookEntry;
  focus: boolean;
  usedIn: NotebookItem[];
  notes: NotebookItem[];
  projects: NotebookItem[];
  entriesApi: EntriesApi;
  onOpen: (id: string) => void;
  onUploadImage: (f: File) => Promise<string | null>;
}) {
  const k = entryLook(entry);
  const fileRef = useRef<HTMLInputElement>(null);
  const [context, setContext] = useState(focus);
  const [uploading, setUploading] = useState(false);
  const [title, setTitle] = useState(entry.title);
  const [summary, setSummary] = useState(entry.summary);
  const [aliases, setAliases] = useState(entry.aliases.join(', '));
  const timer = useRef<number | null>(null);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (focus) ref.current?.scrollIntoView({ block: 'center', behavior: 'smooth' });
  }, [focus]);

  const later = (patch: Parameters<EntriesApi['update']>[1]) => {
    if (timer.current) window.clearTimeout(timer.current);
    timer.current = window.setTimeout(() => void entriesApi.update(entry.id, patch), 600);
  };

  return (
    <div
      id={`entry-${entry.id}`}
      ref={ref}
      className={`relative rounded-2xl border bg-[var(--nb-pane)] p-4 transition-colors ${focus ? 'border-[var(--nb-hl)]' : 'border-[var(--nb-line)]'}`}
    >
      {/* arraste para um canvas aberto ao lado */}
      <span
        className="nb-entry-grip"
        draggable
        title="Arraste para um canvas"
        aria-label="Arrastar para um canvas"
        onDragStart={(e) => {
          e.dataTransfer.setData('application/x-insight-entry', entry.id);
          e.dataTransfer.setData('text/plain', entry.title);
          e.dataTransfer.effectAllowed = 'copy';
        }}
      >
        <GripVertical className="w-3.5 h-3.5" />
      </span>
      <div className="flex items-start gap-3">
        <button
          type="button"
          title={entry.image_url ? 'Trocar imagem' : 'Adicionar imagem'}
          onClick={() => fileRef.current?.click()}
          className="relative mt-0.5 shrink-0 rounded-full group"
        >
          <EntryAvatar entry={entry} size={44} />
          <span className="absolute inset-0 grid place-items-center rounded-full bg-black/50 text-white opacity-0 group-hover:opacity-100 transition-opacity">
            {uploading ? <Loader2 className="w-4 h-4 animate-spin" /> : <ImagePlus className="w-4 h-4" />}
          </span>
        </button>
        <input
          ref={fileRef}
          type="file"
          accept="image/*"
          hidden
          onChange={async (e) => {
            const f = e.target.files?.[0];
            e.target.value = '';
            if (!f) return;
            setUploading(true);
            const url = await onUploadImage(f);
            setUploading(false);
            if (url) void entriesApi.update(entry.id, { image_url: url });
          }}
        />
        <div className="min-w-0 flex-1 space-y-2">
          <div className="flex items-center gap-2">
            <input
              value={title}
              onChange={(e) => {
                setTitle(e.target.value.slice(0, 160));
                if (e.target.value.trim()) later({ title: e.target.value.trim().slice(0, 160) });
              }}
              aria-label="Título"
              className="flex-1 min-w-0 bg-transparent outline-none text-[15px] font-extrabold"
            />
            <select
              value={entry.kind}
              onChange={(e) => void entriesApi.update(entry.id, { kind: e.target.value as EntryKind })}
              aria-label="Tipo"
              className="h-7 px-1.5 rounded-lg bg-[var(--nb-pane-2)] text-[11px] font-bold outline-none"
              style={{ color: k.color }}
            >
              {ENTRY_KINDS.map((x) => (
                <option key={x.id} value={x.id}>
                  {x.short}
                </option>
              ))}
            </select>
            <button
              type="button"
              aria-label="Apagar menção"
              title="Apagar"
              onClick={async () => {
                const msg = usedIn.length
                  ? `Esta menção aparece em ${usedIn.length} ${usedIn.length === 1 ? 'texto' : 'textos'}. Os trechos continuam, mas o balão some. Apagar?`
                  : 'Apagar esta menção do Sumário?';
                if ((await confirmDialog({ message: msg }))) void entriesApi.remove(entry.id);
              }}
              className="p-1.5 rounded-md text-[var(--nb-ink-3)] hover:text-red-400"
            >
              <Trash2 className="w-3.5 h-3.5" />
            </button>
          </div>
          <textarea
            value={summary}
            onChange={(e) => {
              setSummary(e.target.value.slice(0, 1200));
              later({ summary: e.target.value.slice(0, 1200) });
            }}
            rows={Math.min(8, Math.max(2, Math.ceil(summary.length / 90)))}
            placeholder="Resumo que aparece no balão"
            aria-label="Resumo"
            className="w-full resize-none bg-transparent outline-none text-[13px] leading-relaxed text-[var(--nb-ink-2)] placeholder:text-[var(--nb-ink-3)]"
          />
          <div className="grid sm:grid-cols-3 gap-2">
            <label className="block">
              <span className="text-[10px] font-bold uppercase tracking-wider text-[var(--nb-ink-3)]">Ler mais abre</span>
              <select
                value={entry.target_id || ''}
                onChange={(e) => void entriesApi.update(entry.id, { target_id: e.target.value || null })}
                className="mt-0.5 w-full h-8 px-1.5 rounded-lg bg-[var(--nb-bg)] border border-[var(--nb-line)] text-[12px] outline-none"
              >
                <option value="">esta entrada</option>
                {notes.map((n) => (
                  <option key={n.id} value={n.id}>
                    {n.title}
                  </option>
                ))}
              </select>
            </label>
            <label className="block">
              <span className="text-[10px] font-bold uppercase tracking-wider text-[var(--nb-ink-3)]">Projeto</span>
              <select
                value={entry.project_id || ''}
                onChange={(e) => void entriesApi.update(entry.id, { project_id: e.target.value || null })}
                className="mt-0.5 w-full h-8 px-1.5 rounded-lg bg-[var(--nb-bg)] border border-[var(--nb-line)] text-[12px] outline-none"
              >
                <option value="">sem projeto</option>
                {projects.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.title}
                  </option>
                ))}
              </select>
            </label>
            <label className="block">
              <span className="text-[10px] font-bold uppercase tracking-wider text-[var(--nb-ink-3)]">Outros nomes</span>
              <input
                value={aliases}
                onChange={(e) => {
                  setAliases(e.target.value);
                  later({
                    aliases: e.target.value
                      .split(',')
                      .map((a) => a.trim())
                      .filter(Boolean)
                      .slice(0, 20),
                  });
                }}
                placeholder="separados por vírgula"
                className="mt-0.5 w-full h-8 px-2 rounded-lg bg-[var(--nb-bg)] border border-[var(--nb-line)] text-[12px] outline-none"
              />
            </label>
          </div>
          <label className="flex items-center gap-1.5 text-[11px] text-[var(--nb-ink-3)] cursor-pointer w-max" title="Aparece nos balões e no Ler mais dos textos publicados">
            <input type="checkbox" checked={!!entry.is_public && !entry.is_secret} disabled={!!entry.is_secret} onChange={(e) => void entriesApi.update(entry.id, { is_public: e.target.checked })} />
            Público nas publicações{entry.is_secret ? ' (secreto)' : ''}
          </label>
          {entry.kind === 'elemento' && (
            <>
              <div className="flex flex-wrap gap-1">
                {ENTRY_CATEGORIES.map((c) => (
                  <button
                    key={c.id}
                    type="button"
                    onClick={() => void entriesApi.update(entry.id, { category: entry.category === c.id ? null : c.id })}
                    aria-pressed={entry.category === c.id}
                    className={`flex items-center gap-1 h-6 px-2 rounded-full text-[10px] font-bold border transition-colors ${
                      entry.category === c.id ? 'border-transparent text-white' : 'border-[var(--nb-line)] text-[var(--nb-ink-3)] hover:text-[var(--nb-ink)]'
                    }`}
                    style={entry.category === c.id ? { background: c.color } : undefined}
                  >
                    <Glyph name={c.glyph} className="text-[11px]" />
                    {c.label}
                  </button>
                ))}
                {entry.image_url && (
                  <button type="button" onClick={() => void entriesApi.update(entry.id, { image_url: null })} className="h-6 px-2 rounded-full text-[10px] font-bold text-[var(--nb-ink-3)] hover:text-red-400">
                    tirar imagem
                  </button>
                )}
              </div>
              <div className="pt-1">
                <span className="block mb-1 text-[10px] font-bold uppercase tracking-wider text-[var(--nb-ink-3)]">Relações</span>
                <RelationsEditor entry={entry} entriesApi={entriesApi} />
              </div>
            </>
          )}
          <div className="flex flex-wrap items-center gap-1.5 pt-0.5">
            <span className="text-[10px] font-bold uppercase tracking-wider text-[var(--nb-ink-3)] mr-1">
              {usedIn.length ? `Aparece em ${usedIn.length}` : 'Ainda não vinculada a nenhum trecho'}
            </span>
            {!context &&
              usedIn.slice(0, 12).map((it) => (
                <button
                  key={it.id}
                  type="button"
                  data-item-id={it.id}
                  onClick={() => onOpen(it.id)}
                  className="flex items-center gap-1 h-6 px-2 rounded-full bg-[var(--nb-pane-2)] text-[11px] font-semibold text-[var(--nb-ink-2)] hover:text-[var(--nb-hl)]"
                >
                  <span className="text-[12px]">{itemIcon(it)}</span>
                  {it.title}
                </button>
              ))}
            <button
              type="button"
              aria-expanded={context}
              onClick={() => setContext((v) => !v)}
              className="h-6 px-2 rounded-full text-[11px] font-bold text-[var(--nb-hl)] hover:bg-[var(--nb-hl-soft)]"
            >
              {context ? 'Ocultar trechos' : usedIn.length ? 'Ver trechos' : 'Procurar no texto'}
            </button>
          </div>
          {context && <EntryAppearances entry={entry} usedIn={usedIn} api={api} onOpen={onOpen} />}
        </div>
      </div>
    </div>
  );
}
