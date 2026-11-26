'use client';

import { useEffect, useRef, useState } from 'react';
import { ArrowRight, BookMarked, FilePlus2, FolderPlus, Upload } from 'lucide-react';
import { entryKind } from '@/lib/notebook/entries';
import { useNotebookLinks } from '../editor/linkContext';
import type { NotebookItem } from '@/lib/notebook/types';
import type { NotebookApi } from '@/lib/notebook/useNotebook';
import { PROJECT_TYPES, projectData, projectType, type ProjectType } from '@/lib/notebook/projects';
import { Glyph } from '../icons/Glyph';
import { itemIcon } from '../FileExplorer';

type NewOpts = { parentId: string | null; template?: string; title?: string };

/** Página inicial do projeto: tipo, descrição, sugestões e conteúdo. */
export function ProjectHome({
  item,
  api,
  onOpen,
  onNew,
  onSummary,
  onImport,
}: {
  item: NotebookItem;
  api: NotebookApi;
  onOpen: (id: string) => void;
  onNew: (o: NewOpts) => void;
  onSummary: (projectId: string) => void;
  onImport: (parentId: string | null) => void;
}) {
  const { entries } = useNotebookLinks();
  const projEntries = Object.values(entries)
    .filter((e) => e.project_id === item.id)
    .sort((a, b) => b.updated_at.localeCompare(a.updated_at));
  const data = projectData(item);
  const def = projectType(data.type);
  const [desc, setDesc] = useState(data.description || '');
  const descRef = useRef<HTMLTextAreaElement>(null);
  useEffect(() => setDesc(projectData(item).description || ''), [item.id]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => {
    const el = descRef.current;
    if (!el) return;
    el.style.height = 'auto';
    el.style.height = `${el.scrollHeight}px`;
  }, [desc]);

  const setProject = (patch: Partial<{ type: ProjectType; description: string }>, debounce = 600) => {
    const next = { ...projectData(item), ...patch };
    const extra: Partial<NotebookItem> = patch.type ? { icon: projectType(patch.type).glyph } : {};
    api.update(item.id, { ...extra, data: { ...(item.data || {}), project: next } }, { debounce });
  };

  // tudo o que está dentro do projeto (todas as seções)
  const all = Object.values(api.items).filter((i) => !i.archived_at);
  const inside: NotebookItem[] = [];
  const walk = (pid: string) => {
    for (const k of all.filter((i) => i.parent_id === pid)) {
      inside.push(k);
      walk(k.id);
    }
  };
  walk(item.id);
  const words = inside.reduce((n, i) => n + (i.word_count || 0), 0);
  const kids = all
    .filter((i) => i.parent_id === item.id)
    .sort((a, b) => (a.kind === b.kind ? a.position - b.position : a.kind === 'folder' ? -1 : 1));
  const last = inside.reduce((m, i) => (i.updated_at > m ? i.updated_at : m), item.updated_at);

  return (
    <div className="space-y-10 pb-16">
      {/* tipo + descrição */}
      <section className="space-y-4">
        <div className="flex items-start gap-4">
          <span
            className="w-14 h-14 shrink-0 grid place-items-center rounded-2xl text-[28px]"
            style={{ color: def.color, background: `color-mix(in srgb, ${def.color} 14%, transparent)` }}
          >
            <Glyph name={def.glyph} />
          </span>
          <div className="min-w-0 flex-1">
            <p className="text-[10px] font-black uppercase tracking-[0.22em]" style={{ color: def.color }}>
              Projeto · {def.label}
            </p>
            <textarea
              ref={descRef}
              value={desc}
              rows={1}
              onChange={(e) => {
                setDesc(e.target.value.slice(0, 600));
                setProject({ description: e.target.value.slice(0, 600) });
              }}
              placeholder={`Sobre este projeto. ${def.pitch}`}
              aria-label="Descrição do projeto"
              className="mt-1 w-full resize-none overflow-hidden bg-transparent outline-none text-[15px] leading-relaxed text-[var(--nb-ink-2)] placeholder:text-[var(--nb-ink-3)]"
            />
            <p className="mt-1 text-[12px] text-[var(--nb-ink-3)]">
              {inside.length} {inside.length === 1 ? 'item' : 'itens'} · {words.toLocaleString('pt-BR')} palavras · editado em{' '}
              {new Date(last).toLocaleDateString('pt-BR')}
            </p>
          </div>
        </div>
        <div className="flex flex-wrap gap-1.5" role="radiogroup" aria-label="Tipo do projeto">
          {PROJECT_TYPES.map((t) => (
            <button
              key={t.id}
              type="button"
              role="radio"
              aria-checked={t.id === def.id}
              onClick={() => setProject({ type: t.id }, 0)}
              className={`flex items-center gap-1.5 h-7 px-2.5 rounded-full border text-[11px] font-bold transition-colors ${
                t.id === def.id ? 'text-white border-transparent' : 'border-[var(--nb-line)] text-[var(--nb-ink-3)] hover:text-[var(--nb-ink)]'
              }`}
              style={t.id === def.id ? { background: t.color } : undefined}
            >
              <Glyph name={t.glyph} className="text-[13px]" />
              {t.label}
            </button>
          ))}
        </div>
      </section>

      {/* sugestões */}
      <section>
        <h2 className="nb-pane-title mb-3">Sugestões para este projeto</h2>
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-2.5">
          {def.suggestions.map((s) => (
            <button
              key={`${s.template}-${s.label}`}
              type="button"
              onClick={() => onNew({ parentId: item.id, template: s.template, title: s.title })}
              className="group flex items-center gap-3 p-3 rounded-xl border border-[var(--nb-line)] bg-[var(--nb-pane)] hover:border-[var(--nb-hl)] text-left transition-colors"
            >
              <span className="w-10 h-10 shrink-0 grid place-items-center rounded-xl bg-[var(--nb-pane-2)] text-[19px] text-[var(--nb-ink-2)] group-hover:text-[var(--nb-hl)] group-hover:bg-[var(--nb-hl-soft)] transition-colors">
                <Glyph name={glyphFor(s.template)} />
              </span>
              <span className="min-w-0 flex-1">
                <span className="block text-[13px] font-bold">{s.label}</span>
                <span className="block text-[11px] text-[var(--nb-ink-3)] truncate">{s.hint}</span>
              </span>
              <ArrowRight className="w-3.5 h-3.5 text-[var(--nb-ink-3)] opacity-0 group-hover:opacity-100 transition-opacity" />
            </button>
          ))}
        </div>
      </section>

      {/* sumário */}
      <section>
        <div className="flex items-center justify-between gap-3 mb-3">
          <h2 className="nb-pane-title">Menções do projeto</h2>
          <button
            type="button"
            onClick={() => onSummary(item.id)}
            className="flex items-center gap-1.5 h-8 px-3 rounded-lg bg-[var(--nb-pane-2)] text-xs font-bold hover:text-[var(--nb-hl)]"
          >
            <BookMarked className="w-3.5 h-3.5" /> Abrir Sumário{projEntries.length ? ` (${projEntries.length})` : ''}
          </button>
        </div>
        {projEntries.length ? (
          <div className="flex flex-wrap gap-1.5">
            {projEntries.slice(0, 14).map((e) => {
              const k = entryKind(e.kind);
              return (
                <span
                  key={e.id}
                  data-ref={e.id}
                  className="flex items-center gap-1.5 h-7 px-2.5 rounded-full border border-[var(--nb-line)] bg-[var(--nb-pane)] text-[12px] font-semibold cursor-default"
                >
                  <Glyph name={k.glyph} className="text-[12px]" />
                  <span style={{ color: k.color }} className="sr-only">
                    {k.short}
                  </span>
                  {e.title}
                </span>
              );
            })}
          </div>
        ) : (
          <p className="text-[13px] text-[var(--nb-ink-3)]">
            Selecione um trecho num capítulo ou nota e use <span className="font-semibold text-[var(--nb-ink-2)]">Mencionar</span> (ou digite + no texto): personagens, lugares, organizações, notas do autor e avisos aparecem aqui.
          </p>
        )}
      </section>

      {/* conteúdo */}
      <section>
        <div className="flex items-center justify-between gap-3 mb-3">
          <h2 className="nb-pane-title">Neste projeto</h2>
          <div className="flex gap-1.5">
            <button
              type="button"
              onClick={() => onImport(item.id)}
              title="Importar arquivos para este projeto"
              className="flex items-center gap-1.5 h-8 px-3 rounded-lg bg-[var(--nb-pane-2)] text-xs font-bold hover:text-[var(--nb-hl)]"
            >
              <Upload className="w-3.5 h-3.5" /> Importar
            </button>
            <button
              type="button"
              onClick={() => onNew({ parentId: item.id })}
              className="flex items-center gap-1.5 h-8 px-3 rounded-lg bg-[var(--nb-pane-2)] text-xs font-bold hover:text-[var(--nb-hl)]"
            >
              <FilePlus2 className="w-3.5 h-3.5" /> Nota
            </button>
            <button
              type="button"
              onClick={() => onNew({ parentId: item.id, template: 'folder' })}
              className="flex items-center gap-1.5 h-8 px-3 rounded-lg bg-[var(--nb-pane-2)] text-xs font-bold hover:text-[var(--nb-hl)]"
            >
              <FolderPlus className="w-3.5 h-3.5" /> Seção
            </button>
          </div>
        </div>
        {kids.length ? (
          <div className="grid sm:grid-cols-2 gap-2">
            {kids.map((k) => {
              const n = k.kind === 'folder' ? all.filter((i) => i.parent_id === k.id).length : 0;
              return (
                <button
                  key={k.id}
                  type="button"
                  data-item-id={k.id}
                  onClick={() => onOpen(k.id)}
                  className="flex items-center gap-3 p-3 rounded-xl border border-[var(--nb-line)] bg-[var(--nb-pane)] hover:border-[var(--nb-hl)] text-left"
                >
                  <span className="text-[19px] text-[var(--nb-ink-2)]">{itemIcon(k)}</span>
                  <span className="min-w-0">
                    <span className="block truncate text-sm font-semibold">{k.title}</span>
                    <span className="text-[11px] text-[var(--nb-ink-3)]">
                      {k.template === 'book'
                        ? `livro · ${n} ${n === 1 ? 'capítulo' : 'capítulos'}`
                        : k.kind === 'folder'
                          ? `seção · ${n} ${n === 1 ? 'item' : 'itens'}`
                          : `${k.word_count} palavras`}{' '}
                      ·{' '}
                      {new Date(k.updated_at).toLocaleDateString('pt-BR')}
                    </span>
                  </span>
                </button>
              );
            })}
          </div>
        ) : (
          <p className="text-sm text-[var(--nb-ink-3)]">Projeto vazio. Comece por uma das sugestões acima.</p>
        )}
      </section>
    </div>
  );
}

function glyphFor(t: string) {
  const map: Record<string, Parameters<typeof Glyph>[0]['name']> = {
    book: 'book',
    character: 'character',
    world: 'world',
    map: 'map',
    calendar: 'moon',
    timeline: 'timeline',
    mindmap: 'mindmap',
    roadmap: 'roadmap',
    idea: 'idea',
    poem: 'feather',
    markdown: 'note',
    article: 'pen',
    study: 'study',
    agenda: 'agenda',
    goals: 'goals',
    journal: 'journal',
    tasks: 'tasks',
  };
  return map[t] || 'note';
}
