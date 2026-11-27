'use client';

/**
 * Central de Pendências: todo trecho marcado como pendente (revisar, checar
 * fato, ajustar lore, geral) em qualquer nota, capítulo, ficha ou canvas do
 * projeto, num painel só. Clicar leva até o trecho; "Concluir" tira a marca.
 */
import { useMemo, useState } from 'react';
import { Check } from 'lucide-react';
import type { NotebookItem } from '@/lib/notebook/types';
import type { NotebookApi } from '@/lib/notebook/useNotebook';
import { isProject, projectRootOf } from '@/lib/notebook/projects';
import { TODO_KINDS } from '../editor/extensions';
import { itemIcon } from '../FileExplorer';

const KIND_LABEL: Record<string, string> = Object.fromEntries(TODO_KINDS.map((k) => [k.id, k.label]));

/** Tira a n-ésima marca de pendência do texto (Markdown ou HTML do capítulo). */
export function resolveTodo(it: NotebookItem, index: number): Partial<NotebookItem> | null {
  let n = -1;
  if (it.template === 'chapter') {
    const doc = new DOMParser().parseFromString(`<div>${String(it.data?.html || '')}</div>`, 'text/html');
    const md = (it.content || '').match(/\[[^\]\n]+\]\(todo:(revisar|checar|lore|geral)\)/gi)?.length || 0;
    const el = doc.querySelectorAll('span[data-todo]')[index - md];
    if (!el) return null;
    el.replaceWith(...Array.from(el.childNodes));
    return { data: { ...(it.data || {}), html: (doc.body.firstChild as HTMLElement).innerHTML } };
  }
  const content = (it.content || '').replace(/\[([^\]\n]+)\]\(todo:(revisar|checar|lore|geral)\)/gi, (all, text) => (++n === index ? text : all));
  return n >= index ? { content } : null;
}

export function TodoPanel({ api, projectId, onGo }: { api: NotebookApi; projectId: string | null; onGo: (id: string, index: number, text: string) => void }) {
  const [scope, setScope] = useState<'projeto' | 'tudo'>(projectId ? 'projeto' : 'tudo');
  const [kind, setKind] = useState<string>('todas');
  const groups = useMemo(() => {
    const list = Object.values(api.items).filter((i) => !i.archived_at && (i.todos?.length || 0) > 0);
    return list
      .filter((i) => scope === 'tudo' || !projectId || projectRootOf(api.items, i.id) === projectId)
      .map((i) => ({ item: i, todos: (i.todos || []).filter((t) => kind === 'todas' || t.k === kind) }))
      .filter((g) => g.todos.length)
      .sort((a, b) => b.item.updated_at.localeCompare(a.item.updated_at));
  }, [api.items, scope, kind, projectId]);
  const total = groups.reduce((s, g) => s + g.todos.length, 0);
  const counts = useMemo(() => {
    const m: Record<string, number> = {};
    Object.values(api.items).forEach((i) => !i.archived_at && (scope === 'tudo' || !projectId || projectRootOf(api.items, i.id) === projectId) && (i.todos || []).forEach((t) => (m[t.k] = (m[t.k] || 0) + 1)));
    return m;
  }, [api.items, scope, projectId]);

  const done = async (it: NotebookItem, index: number) => {
    const full = (await api.loadFull(it.id)) || it;
    const patch = resolveTodo(full, index);
    if (patch) api.update(it.id, patch);
  };

  const project = projectId ? api.items[projectId] : null;

  return (
    <div className="flex flex-col h-full min-h-0 nb-todos">
      <div className="px-3 pt-3 pb-2 space-y-2">
        <span className="nb-pane-title">Pendências</span>
        <div className="nb-todos-filters">
          {project && isProject(project) && (
            <select value={scope} onChange={(e) => setScope(e.target.value as 'projeto' | 'tudo')} aria-label="Onde">
              <option value="projeto">{project.title}</option>
              <option value="tudo">Todo o Notebook</option>
            </select>
          )}
          <div className="nb-todos-kinds" role="tablist">
            <button type="button" role="tab" aria-selected={kind === 'todas'} onClick={() => setKind('todas')}>
              Todas <span>{Object.values(counts).reduce((a, b) => a + b, 0)}</span>
            </button>
            {TODO_KINDS.map((k) => (
              <button key={k.id} type="button" role="tab" aria-selected={kind === k.id} onClick={() => setKind(k.id)} data-kind={k.id}>
                {k.label} <span>{counts[k.id] || 0}</span>
              </button>
            ))}
          </div>
        </div>
      </div>
      <div className="nb-scroll flex-1 min-h-0 overflow-y-auto px-1.5 pb-4">
        {!total && (
          <p className="px-3 py-6 text-[12px] leading-relaxed text-[var(--nb-ink-3)]">
            Nenhuma pendência. Selecione um trecho e aperte Ctrl+Alt+P, ou digite /pendência no editor.
          </p>
        )}
        {groups.map(({ item, todos }) => (
          <section key={item.id} className="nb-todos-group">
            <button type="button" className="nb-todos-note" onClick={() => onGo(item.id, todos[0].i, todos[0].t)}>
              <span className="text-[13px]">{itemIcon(item)}</span>
              <span className="truncate">{item.title}</span>
              <span className="nb-todos-n">{todos.length}</span>
            </button>
            {todos.map((t) => (
              <div key={`${t.i}-${t.t}`} className="nb-todos-row">
                <button type="button" onClick={() => onGo(item.id, t.i, t.t)} title="Ir até o trecho">
                  <span className="nb-todos-kind" data-kind={t.k}>
                    {KIND_LABEL[t.k] || 'Pendência'}
                  </span>
                  <span className="nb-todos-text">{t.t}</span>
                </button>
                {item.template !== 'canvas' && (
                  <button type="button" className="nb-todos-done" title="Concluir (tira a marca)" aria-label="Concluir" onClick={() => void done(item, t.i)}>
                    <Check className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>
            ))}
          </section>
        ))}
      </div>
    </div>
  );
}
