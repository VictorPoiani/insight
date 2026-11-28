'use client';

/**
 * Lixeira do Notebook: notas, capítulos, canvases, verbetes, fontes e
 * categorias do Codex ficam aqui por 30 dias antes de sumirem de vez.
 * Filtra por projeto, mostra quantos dias faltam e permite restaurar ou
 * excluir para sempre.
 */
import { ask as confirmDialog } from '@/lib/ui/feedback';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { BookMarked, FolderTree, Library, RotateCcw, Trash2, X } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import type { NotebookItem } from '@/lib/notebook/types';
import type { NotebookApi } from '@/lib/notebook/useNotebook';
import { isProject, projectRootOf } from '@/lib/notebook/projects';
import { itemIcon } from '../FileExplorer';
import { NbPortal } from '../history/VersionHistory';

const RETENTION_DAYS = 30;
type Tab = 'notas' | 'verbetes' | 'fontes' | 'categorias';
interface Row {
  id: string;
  title: string;
  project: string | null;
  at: string;
  icon: React.ReactNode;
  extra?: string;
}

const daysLeft = (at: string) => Math.max(0, RETENTION_DAYS - Math.floor((Date.now() - new Date(at).getTime()) / 86400000));
const ago = (at: string) => {
  const d = Math.floor((Date.now() - new Date(at).getTime()) / 86400000);
  return d <= 0 ? 'hoje' : d === 1 ? 'ontem' : `há ${d} dias`;
};

export function TrashDialog({ api, profileId, onRestoredEntries, onRestoredCodex, onClose }: { api: NotebookApi; profileId: string; onRestoredEntries: () => void; onRestoredCodex: () => void; onClose: () => void }) {
  const supabase = useMemo(() => createClient(), []);
  const [tab, setTab] = useState<Tab>('notas');
  const [project, setProject] = useState<string>('todos');
  const [remote, setRemote] = useState<Record<Exclude<Tab, 'notas'>, Row[]>>({ verbetes: [], fontes: [], categorias: [] });
  const [busy, setBusy] = useState(false);

  const projects = useMemo(() => Object.values(api.items).filter((i) => isProject(i)).sort((a, b) => a.title.localeCompare(b.title)), [api.items]);
  const projectName = (id: string | null) => (id ? api.items[id]?.title || 'Projeto' : 'Sem projeto');

  const load = useCallback(async () => {
    const [e, s, c] = await Promise.all([
      supabase.from('notebook_entries').select('id, title, project_id, deleted_at, kind').eq('profile_id', profileId).not('deleted_at', 'is', null).order('deleted_at', { ascending: false }).limit(500),
      supabase.from('notebook_sources').select('id, title, project_id, deleted_at, year').eq('profile_id', profileId).not('deleted_at', 'is', null).order('deleted_at', { ascending: false }).limit(500),
      supabase.from('notebook_codex_categories').select('id, name, project_id, deleted_at, parent_id').eq('profile_id', profileId).not('deleted_at', 'is', null).order('deleted_at', { ascending: false }).limit(500),
    ]);
    type R = { id: string; title?: string; name?: string; project_id: string | null; deleted_at: string; year?: string | null; parent_id?: string | null };
    setRemote({
      verbetes: ((e.data || []) as R[]).map((r) => ({ id: r.id, title: r.title || 'Sem título', project: r.project_id, at: r.deleted_at, icon: <BookMarked className="w-3.5 h-3.5" /> })),
      fontes: ((s.data || []) as R[]).map((r) => ({ id: r.id, title: r.title || 'Sem título', project: r.project_id, at: r.deleted_at, icon: <Library className="w-3.5 h-3.5" />, extra: r.year || undefined })),
      // só as categorias de cima: as subcategorias voltam junto
      categorias: ((c.data || []) as R[])
        .filter((r, _, all) => !all.some((p) => p.id === r.parent_id))
        .map((r) => ({ id: r.id, title: r.name || 'Categoria', project: r.project_id, at: r.deleted_at, icon: <FolderTree className="w-3.5 h-3.5" /> })),
    });
  }, [profileId, supabase]);
  useEffect(() => {
    void load();
  }, [load]);

  // notas: só as raízes do que foi para a lixeira (os filhos vão e voltam juntos)
  const notes: Row[] = useMemo(
    () =>
      Object.values(api.items)
        .filter((i) => i.archived_at && !(i.parent_id && api.items[i.parent_id]?.archived_at))
        .sort((a, b) => (b.archived_at || '').localeCompare(a.archived_at || ''))
        .map((i: NotebookItem) => {
          const kids = Object.values(api.items).filter((c) => c.parent_id === i.id).length;
          return { id: i.id, title: i.title, project: isProject(i) ? i.id : projectRootOf(api.items, i.id), at: i.archived_at!, icon: <span className="text-[13px]">{itemIcon(i)}</span>, extra: kids ? `${kids} dentro` : undefined };
        }),
    [api.items]
  );

  const all: Record<Tab, Row[]> = { notas: notes, ...remote };
  const filter = (rows: Row[]) => (project === 'todos' ? rows : rows.filter((r) => (project === 'nenhum' ? !r.project : r.project === project)));
  const rows = filter(all[tab]);
  const table = { verbetes: 'notebook_entries', fontes: 'notebook_sources', categorias: 'notebook_codex_categories' } as const;

  const restore = async (r: Row) => {
    if (tab === 'notas') return api.restore(r.id);
    if (tab === 'categorias') {
      // volta junto com as subcategorias apagadas no mesmo momento
      await supabase.from('notebook_codex_categories').update({ deleted_at: null }).eq('profile_id', profileId).eq('deleted_at', r.at).or(`id.eq.${r.id},parent_id.eq.${r.id}`);
    } else await supabase.from(table[tab]).update({ deleted_at: null }).eq('id', r.id);
    if (tab === 'verbetes') onRestoredEntries();
    if (tab === 'categorias') onRestoredCodex();
    await load();
  };
  const destroy = async (r: Row, ask = true) => {
    if (ask && !(await confirmDialog({ message: `Excluir “${r.title}” para sempre? Não dá para desfazer.`, danger: true }))) return;
    if (tab === 'notas') await api.destroy(r.id);
    else await supabase.from(table[tab]).delete().eq('id', r.id);
    if (tab !== 'notas') await load();
  };
  const emptyAll = async () => {
    if (!rows.length || !(await confirmDialog({ message: `Excluir para sempre ${rows.length} ${rows.length === 1 ? 'item' : 'itens'} desta lista? Não dá para desfazer.`, danger: true }))) return;
    setBusy(true);
    for (const r of rows) await destroy(r, false);
    setBusy(false);
  };

  const TABS: [Tab, string][] = [
    ['notas', 'Notas e pastas'],
    ['verbetes', 'Verbetes'],
    ['fontes', 'Fontes'],
    ['categorias', 'Categorias do Codex'],
  ];

  return (
    <NbPortal>
      <div className="nb-modal-back" onClick={onClose}>
        <div className="nb-modal nb-trash !max-w-2xl" role="dialog" aria-label="Lixeira" onClick={(e) => e.stopPropagation()}>
          <header>
            <div>
              <h2>Lixeira</h2>
              <p>Tudo fica aqui por {RETENTION_DAYS} dias e depois é apagado de vez.</p>
            </div>
            <button type="button" onClick={onClose} aria-label="Fechar">
              <X className="w-4 h-4" />
            </button>
          </header>
          <div className="nb-trash-bar">
            <nav role="tablist">
              {TABS.map(([id, label]) => (
                <button key={id} type="button" role="tab" aria-selected={tab === id} onClick={() => setTab(id)}>
                  {label}
                  {filter(all[id]).length > 0 && <span>{filter(all[id]).length}</span>}
                </button>
              ))}
            </nav>
            <select value={project} onChange={(e) => setProject(e.target.value)} aria-label="Projeto">
              <option value="todos">Todos os projetos</option>
              {projects.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.title}
                </option>
              ))}
              <option value="nenhum">Sem projeto</option>
            </select>
          </div>
          <ul className="nb-trash-list nb-scroll">
            {rows.map((r) => {
              const left = daysLeft(r.at);
              return (
                <li key={r.id}>
                  <span className="nb-trash-icon">{r.icon}</span>
                  <span className="nb-trash-main">
                    <strong>{r.title}</strong>
                    <small>
                      {projectName(r.project)} · apagado {ago(r.at)}
                      {r.extra ? ` · ${r.extra}` : ''}
                    </small>
                  </span>
                  <span className="nb-trash-left" data-soon={left <= 3 || undefined}>
                    {left === 0 ? 'some hoje' : `${left} ${left === 1 ? 'dia' : 'dias'}`}
                  </span>
                  <button type="button" title="Restaurar" aria-label={`Restaurar ${r.title}`} onClick={() => void restore(r)}>
                    <RotateCcw className="w-3.5 h-3.5" />
                  </button>
                  <button type="button" title="Excluir para sempre" aria-label={`Excluir ${r.title} para sempre`} className="nb-trash-danger" onClick={() => void destroy(r)}>
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </li>
              );
            })}
            {!rows.length && <li className="nb-trash-empty">Nada aqui.</li>}
          </ul>
          <footer>
            <button type="button" disabled={!rows.length || busy} onClick={() => void emptyAll()}>
              {busy ? 'Apagando…' : 'Esvaziar esta lista'}
            </button>
          </footer>
        </div>
      </div>
    </NbPortal>
  );
}
