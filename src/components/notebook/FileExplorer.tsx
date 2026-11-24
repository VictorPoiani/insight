'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import {
  ChevronRight,
  FilePlus2,
  FolderPlus,
  ArrowDownAZ,
  Clock3,
  GripVertical,
  Pin,
  Trash2,
  Copy,
  Pencil,
  LayoutTemplate,
  CornerLeftUp,
  BookPlus,
  Search,
  X,
  RotateCcw,
} from '@/components/icons';
import type { NotebookItem } from '@/lib/notebook/types';
import type { NotebookApi } from '@/lib/notebook/useNotebook';
import { getTemplate } from '@/lib/notebook/templates';

type SortMode = 'manual' | 'name' | 'edited';

interface Props {
  api: NotebookApi;
  activeId: string | null;
  onOpen: (id: string) => void;
  onNew: (opts: { parentId: string | null; template?: string }) => void;
  onPickTemplate: (parentId: string | null) => void;
  onRename: (id: string, title: string) => void;
  onClose?: () => void;
}

const OPEN_KEY = 'insight-notebook-open-folders';

export function itemIcon(item: Pick<NotebookItem, 'icon' | 'template' | 'kind'>) {
  return item.icon || getTemplate(item.template).icon;
}

export function FileExplorer({ api, activeId, onOpen, onNew, onPickTemplate, onRename, onClose }: Props) {
  const [sort, setSort] = useState<SortMode>('manual');
  const [filter, setFilter] = useState('');
  const [open, setOpen] = useState<Record<string, boolean>>({});
  const [menu, setMenu] = useState<{ id: string | null; x: number; y: number } | null>(null);
  const [renaming, setRenaming] = useState<string | null>(null);
  const [drag, setDrag] = useState<string | null>(null);
  const [drop, setDrop] = useState<{ id: string | null; mode: 'inside' | 'before' } | null>(null);
  const [showTrash, setShowTrash] = useState(false);

  useEffect(() => {
    try {
      setOpen(JSON.parse(localStorage.getItem(OPEN_KEY) || '{}'));
    } catch {
      /* ignora */
    }
  }, []);
  useEffect(() => {
    try {
      localStorage.setItem(OPEN_KEY, JSON.stringify(open));
    } catch {
      /* ignora */
    }
  }, [open]);

  // abre as pastas do caminho da nota ativa
  useEffect(() => {
    if (!activeId) return;
    let cur = api.items[activeId];
    const add: Record<string, boolean> = {};
    while (cur?.parent_id) {
      add[cur.parent_id] = true;
      cur = api.items[cur.parent_id];
    }
    if (Object.keys(add).length) setOpen((o) => ({ ...o, ...add }));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeId]);

  const live = useMemo(() => Object.values(api.items).filter((i) => !i.archived_at), [api.items]);
  const trashed = useMemo(
    () =>
      Object.values(api.items)
        .filter((i) => i.archived_at && !(i.parent_id && api.items[i.parent_id]?.archived_at))
        .sort((a, b) => (b.archived_at || '').localeCompare(a.archived_at || '')),
    [api.items]
  );

  const children = useMemo(() => {
    const map = new Map<string | null, NotebookItem[]>();
    for (const i of live) {
      const k = i.parent_id && api.items[i.parent_id] && !api.items[i.parent_id].archived_at ? i.parent_id : null;
      if (!map.has(k)) map.set(k, []);
      map.get(k)!.push(i);
    }
    const cmp = (a: NotebookItem, b: NotebookItem) => {
      if (a.kind !== b.kind) return a.kind === 'folder' ? -1 : 1;
      if (sort === 'name') return a.title.localeCompare(b.title, 'pt-BR', { numeric: true });
      if (sort === 'edited') return b.updated_at.localeCompare(a.updated_at);
      return a.position - b.position || a.title.localeCompare(b.title, 'pt-BR', { numeric: true });
    };
    map.forEach((arr) => arr.sort(cmp));
    return map;
  }, [api.items, live, sort]);

  const q = filter.trim().toLowerCase();
  const filtered = useMemo(
    () => (q ? live.filter((i) => i.title.toLowerCase().includes(q) || i.tags.some((t) => t.includes(q.replace(/^#/, '')))) : []),
    [live, q]
  );
  const pinned = live.filter((i) => i.pinned);

  function startDrag(e: React.DragEvent, id: string) {
    setDrag(id);
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/plain', id);
  }

  function onDragOver(e: React.DragEvent, target: NotebookItem | null) {
    if (!drag) return;
    e.preventDefault();
    if (!target) return setDrop({ id: null, mode: 'inside' });
    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
    const y = e.clientY - rect.top;
    const mode = target.kind === 'folder' && y > rect.height * 0.3 ? 'inside' : 'before';
    setDrop({ id: target.id, mode });
  }

  function onDrop(e: React.DragEvent, target: NotebookItem | null) {
    e.preventDefault();
    const id = drag;
    setDrag(null);
    setDrop(null);
    if (!id) return;
    if (!target) return api.move(id, null);
    if (target.id === id) return;
    if (drop?.mode === 'inside' && target.kind === 'folder') {
      setOpen((o) => ({ ...o, [target.id]: true }));
      return api.move(id, target.id);
    }
    // antes do alvo, no mesmo pai
    const sibs = children.get(target.parent_id) || [];
    const idx = sibs.findIndex((s) => s.id === target.id);
    const prev = sibs[idx - 1];
    const pos = prev && prev.id !== id ? (prev.position + target.position) / 2 : target.position - 1;
    if (sort !== 'manual') setSort('manual');
    api.move(id, target.parent_id, pos);
  }

  function renderRow(item: NotebookItem, depth: number): React.ReactElement {
    const kids = children.get(item.id) || [];
    const isOpen = !!open[item.id];
    const isFolder = item.kind === 'folder';
    const words = isFolder ? null : item.word_count;
    return (
      <div key={item.id}>
        <div
          className="nb-tree-row group"
          data-active={activeId === item.id}
          data-drop={drop?.id === item.id ? drop.mode : undefined}
          style={{ paddingLeft: 6 + depth * 14 }}
          draggable={renaming !== item.id}
          onDragStart={(e) => startDrag(e, item.id)}
          onDragEnd={() => {
            setDrag(null);
            setDrop(null);
          }}
          onDragOver={(e) => onDragOver(e, item)}
          onDragLeave={() => setDrop((d) => (d?.id === item.id ? null : d))}
          onDrop={(e) => onDrop(e, item)}
          onClick={() => {
            if (isFolder && item.template === 'folder') setOpen((o) => ({ ...o, [item.id]: !isOpen }));
            else {
              onOpen(item.id);
              if (isFolder) setOpen((o) => ({ ...o, [item.id]: true }));
              onClose?.();
            }
          }}
          onDoubleClick={() => setRenaming(item.id)}
          onContextMenu={(e) => {
            e.preventDefault();
            setMenu({ id: item.id, x: e.clientX, y: e.clientY });
          }}
          role="treeitem"
          aria-expanded={isFolder ? isOpen : undefined}
          aria-selected={activeId === item.id}
        >
          <span
            className={`w-4 h-4 grid place-items-center shrink-0 text-[var(--nb-ink-3)] transition-transform ${isOpen ? 'rotate-90' : ''} ${
              isFolder ? '' : 'invisible'
            }`}
            onClick={(e) => {
              e.stopPropagation();
              setOpen((o) => ({ ...o, [item.id]: !isOpen }));
            }}
          >
            <ChevronRight className="w-3.5 h-3.5" />
          </span>
          <span className="w-4 text-center shrink-0 text-[13px] leading-none" aria-hidden="true">
            {itemIcon(item)}
          </span>
          {renaming === item.id ? (
            <input
              autoFocus
              defaultValue={item.title}
              onClick={(e) => e.stopPropagation()}
              onBlur={(e) => {
                setRenaming(null);
                const v = e.target.value.trim();
                if (v && v !== item.title) onRename(item.id, v);
              }}
              onKeyDown={(e) => {
                if (e.key === 'Enter') (e.target as HTMLInputElement).blur();
                if (e.key === 'Escape') setRenaming(null);
              }}
              className="flex-1 min-w-0 bg-[var(--nb-bg)] border border-[var(--nb-hl)] rounded px-1.5 text-[13px] outline-none"
            />
          ) : (
            <span className="truncate flex-1" style={item.color ? { color: item.color } : undefined}>
              {item.title}
            </span>
          )}
          {item.pinned && <Pin className="w-3 h-3 shrink-0 text-[var(--nb-ink-3)]" />}
          {item.is_template && <LayoutTemplate className="w-3 h-3 shrink-0 text-[var(--nb-hl)]" />}
          {words ? (
            <span className="text-[10px] font-mono text-[var(--nb-ink-3)] opacity-0 group-hover:opacity-100 shrink-0">
              {words > 999 ? `${(words / 1000).toFixed(1)}k` : words}
            </span>
          ) : null}
          <GripVertical className="w-3 h-3 shrink-0 text-[var(--nb-ink-3)] opacity-0 group-hover:opacity-60" />
        </div>
        {isFolder && isOpen && (
          <div className="nb-tree-guide" style={{ marginLeft: 13 + depth * 14 }}>
            {kids.length ? (
              kids.map((k) => renderRow(k, 0))
            ) : (
              <button
                type="button"
                onClick={() => onNew({ parentId: item.id, template: item.template === 'book' ? 'chapter' : 'markdown' })}
                className="ml-3 my-0.5 text-[11px] text-[var(--nb-ink-3)] hover:text-[var(--nb-hl)]"
              >
                + {item.template === 'book' ? 'primeiro capítulo' : 'nota aqui'}
              </button>
            )}
          </div>
        )}
      </div>
    );
  }

  const menuItem = menu?.id ? api.items[menu.id] : null;

  return (
    <div className="flex flex-col h-full min-h-0" onClick={() => setMenu(null)}>
      <div className="flex items-center justify-between px-3 pt-3 pb-2">
        <span className="nb-pane-title">Arquivos</span>
        <div className="flex items-center gap-0.5">
          <IconBtn title="Nova nota (Ctrl+N)" onClick={() => onNew({ parentId: null })}>
            <FilePlus2 className="w-4 h-4" />
          </IconBtn>
          <IconBtn title="Nova pasta" onClick={() => onNew({ parentId: null, template: 'folder' })}>
            <FolderPlus className="w-4 h-4" />
          </IconBtn>
          <IconBtn title="Novo livro" onClick={() => onNew({ parentId: null, template: 'book' })}>
            <BookPlus className="w-4 h-4" />
          </IconBtn>
          <IconBtn title="Novo a partir de modelo" onClick={() => onPickTemplate(null)}>
            <LayoutTemplate className="w-4 h-4" />
          </IconBtn>
          <IconBtn
            title={sort === 'manual' ? 'Ordem: manual' : sort === 'name' ? 'Ordem: nome' : 'Ordem: editado'}
            onClick={() => setSort((s) => (s === 'manual' ? 'name' : s === 'name' ? 'edited' : 'manual'))}
          >
            {sort === 'edited' ? <Clock3 className="w-4 h-4" /> : <ArrowDownAZ className={`w-4 h-4 ${sort === 'manual' ? 'opacity-50' : ''}`} />}
          </IconBtn>
          {onClose && (
            <IconBtn title="Fechar" onClick={onClose}>
              <X className="w-4 h-4" />
            </IconBtn>
          )}
        </div>
      </div>

      <div className="px-3 pb-2">
        <label className="flex items-center gap-2 h-8 px-2.5 rounded-lg bg-[var(--nb-bg)] border border-[var(--nb-line)] focus-within:border-[var(--nb-hl)]">
          <Search className="w-3.5 h-3.5 text-[var(--nb-ink-3)]" />
          <input
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
            placeholder="Filtrar por nome ou #tag"
            className="flex-1 min-w-0 bg-transparent text-[12px] outline-none placeholder:text-[var(--nb-ink-3)]"
          />
          {filter && (
            <button type="button" onClick={() => setFilter('')} aria-label="Limpar filtro">
              <X className="w-3.5 h-3.5 text-[var(--nb-ink-3)]" />
            </button>
          )}
        </label>
      </div>

      <div
        className="nb-scroll flex-1 min-h-0 overflow-y-auto px-1.5 pb-4"
        role="tree"
        onDragOver={(e) => {
          if (e.target === e.currentTarget) onDragOver(e, null);
        }}
        onDrop={(e) => {
          if (e.target === e.currentTarget) onDrop(e, null);
        }}
        onContextMenu={(e) => {
          if (e.target === e.currentTarget) {
            e.preventDefault();
            setMenu({ id: null, x: e.clientX, y: e.clientY });
          }
        }}
      >
        {q ? (
          filtered.length ? (
            filtered.map((i) => renderRow(i, 0))
          ) : (
            <p className="px-3 py-6 text-center text-xs text-[var(--nb-ink-3)]">Nada encontrado.</p>
          )
        ) : (
          <>
            {pinned.length > 0 && (
              <div className="mb-2">
                <p className="nb-pane-title px-2 py-1">Fixados</p>
                {pinned.map((i) => (
                  <div
                    key={`pin-${i.id}`}
                    className="nb-tree-row"
                    data-active={activeId === i.id}
                    style={{ paddingLeft: 10 }}
                    onClick={() => {
                      onOpen(i.id);
                      onClose?.();
                    }}
                  >
                    <span className="w-4 text-center text-[13px]">{itemIcon(i)}</span>
                    <span className="truncate">{i.title}</span>
                  </div>
                ))}
                <div className="mx-2 my-2 border-t border-[var(--nb-line)]" />
              </div>
            )}
            {(children.get(null) || []).map((i) => renderRow(i, 0))}
            {!live.length && !api.loading && (
              <div className="px-4 py-8 text-center space-y-3">
                <p className="text-xs text-[var(--nb-ink-3)]">Seu notebook está vazio.</p>
                <button
                  type="button"
                  onClick={() => onPickTemplate(null)}
                  className="px-3 py-1.5 rounded-lg bg-[var(--nb-hl)] text-white text-xs font-bold"
                >
                  Criar primeira página
                </button>
              </div>
            )}
          </>
        )}
      </div>

      {/* lixeira */}
      <div className="border-t border-[var(--nb-line)]">
        <button
          type="button"
          onClick={() => setShowTrash((v) => !v)}
          className="w-full flex items-center gap-2 px-3 h-9 text-[12px] text-[var(--nb-ink-3)] hover:text-[var(--nb-ink)]"
        >
          <Trash2 className="w-3.5 h-3.5" />
          <span className="flex-1 text-left">Lixeira</span>
          {trashed.length > 0 && <span className="font-mono text-[10px]">{trashed.length}</span>}
          <ChevronRight className={`w-3.5 h-3.5 transition-transform ${showTrash ? '-rotate-90' : ''}`} />
        </button>
        {showTrash && (
          <div className="nb-scroll max-h-52 overflow-y-auto px-1.5 pb-2">
            {trashed.length === 0 && <p className="px-3 py-2 text-[11px] text-[var(--nb-ink-3)]">Vazia.</p>}
            {trashed.map((i) => (
              <div key={i.id} className="nb-tree-row group" style={{ paddingLeft: 10 }}>
                <span className="w-4 text-center text-[13px] opacity-60">{itemIcon(i)}</span>
                <span className="truncate flex-1 opacity-70">{i.title}</span>
                <button type="button" title="Restaurar" onClick={() => api.restore(i.id)} className="p-1 hover:text-[var(--nb-hl)]">
                  <RotateCcw className="w-3.5 h-3.5" />
                </button>
                <button
                  type="button"
                  title="Excluir para sempre"
                  onClick={() => {
                    if (confirm(`Excluir "${i.title}" para sempre? Não dá para desfazer.`)) void api.destroy(i.id);
                  }}
                  className="p-1 hover:text-red-400"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* menu de contexto */}
      {menu && (
        <div
          className="fixed z-[90] w-56 py-1.5 rounded-xl bg-[var(--nb-pane)] border border-[var(--nb-line)] shadow-2xl text-[13px]"
          style={{ left: Math.min(menu.x, window.innerWidth - 232), top: Math.min(menu.y, window.innerHeight - 340) }}
          onClick={(e) => e.stopPropagation()}
        >
          {(() => {
            const target = menuItem;
            const parentForNew = target ? (target.kind === 'folder' ? target.id : target.parent_id) : null;
            const close = () => setMenu(null);
            const isBook = target?.template === 'book' || (target?.parent_id && api.items[target.parent_id]?.template === 'book');
            return (
              <>
                <MenuBtn icon={<FilePlus2 />} onClick={() => (onNew({ parentId: parentForNew, template: isBook ? 'chapter' : 'markdown' }), close())}>
                  {isBook ? 'Novo capítulo' : 'Nova nota aqui'}
                </MenuBtn>
                <MenuBtn icon={<FolderPlus />} onClick={() => (onNew({ parentId: parentForNew, template: 'folder' }), close())}>
                  Nova pasta aqui
                </MenuBtn>
                <MenuBtn icon={<LayoutTemplate />} onClick={() => (onPickTemplate(parentForNew), close())}>
                  Novo a partir de modelo…
                </MenuBtn>
                {target && (
                  <>
                    <div className="my-1 border-t border-[var(--nb-line)]" />
                    <MenuBtn icon={<Pencil />} onClick={() => (setRenaming(target.id), close())}>
                      Renomear
                    </MenuBtn>
                    <MenuBtn icon={<Copy />} onClick={() => (void api.duplicate(target.id), close())}>
                      Duplicar
                    </MenuBtn>
                    <MenuBtn icon={<Pin />} onClick={() => (api.update(target.id, { pinned: !target.pinned }), close())}>
                      {target.pinned ? 'Desafixar' : 'Fixar no topo'}
                    </MenuBtn>
                    {target.kind === 'note' && (
                      <MenuBtn icon={<LayoutTemplate />} onClick={() => (api.update(target.id, { is_template: !target.is_template }), close())}>
                        {target.is_template ? 'Deixar de ser modelo' : 'Usar como modelo'}
                      </MenuBtn>
                    )}
                    {target.parent_id && (
                      <MenuBtn icon={<CornerLeftUp />} onClick={() => (api.move(target.id, null), close())}>
                        Mover para a raiz
                      </MenuBtn>
                    )}
                    <div className="my-1 border-t border-[var(--nb-line)]" />
                    <MenuBtn danger icon={<Trash2 />} onClick={() => (api.trash(target.id), close())}>
                      Mover para a lixeira
                    </MenuBtn>
                  </>
                )}
              </>
            );
          })()}
        </div>
      )}
    </div>
  );
}

function IconBtn({ children, title, onClick }: { children: React.ReactNode; title: string; onClick: () => void }) {
  return (
    <button
      type="button"
      title={title}
      aria-label={title}
      onClick={(e) => {
        e.stopPropagation();
        onClick();
      }}
      className="p-1.5 rounded-md text-[var(--nb-ink-3)] hover:text-[var(--nb-ink)] hover:bg-[var(--nb-pane-2)]"
    >
      {children}
    </button>
  );
}

function MenuBtn({ children, icon, onClick, danger }: { children: React.ReactNode; icon: React.ReactElement; onClick: () => void; danger?: boolean }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`w-full flex items-center gap-2.5 px-3 py-1.5 text-left hover:bg-[var(--nb-pane-2)] ${danger ? 'text-red-400' : 'text-[var(--nb-ink-2)] hover:text-[var(--nb-ink)]'}`}
    >
      <span className="w-4 h-4 [&>svg]:w-4 [&>svg]:h-4 opacity-80">{icon}</span>
      {children}
    </button>
  );
}
