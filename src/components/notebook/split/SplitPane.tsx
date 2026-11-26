'use client';

import { useEffect, useMemo, useRef } from 'react';
import { ArrowLeftRight, BookMarked, Loader2, Maximize2, X, ArrowUpRight } from 'lucide-react';
import type { NotebookItem } from '@/lib/notebook/types';
import type { NotebookApi } from '@/lib/notebook/useNotebook';
import type { EntriesApi } from '@/lib/notebook/useEntries';
import { entryLook, type NotebookEntry } from '@/lib/notebook/entries';
import { sanitizeUserHtml } from '@/lib/security/sanitizeHtml';
import { sanitizeWriterHtml } from '../WriterMode';
import { itemIcon } from '../FileExplorer';
import { EntryAvatar, RelationsEditor } from '../entries/MentionViews';
import { EntryAppearances } from '../entries/MentionContext';

export type SplitTarget = { kind: 'item'; id: string } | { kind: 'entry'; id: string };

export const SPLIT_MIN = 300;

/**
 * Tela dividida: uma segunda nota (ficha, mapa, capítulo…) ou uma menção ao
 * lado do texto principal, para consultar sem perder o lugar.
 */
export function SplitPane({
  target,
  width,
  onWidth,
  api,
  entriesApi,
  activeId,
  onClose,
  onPromote,
  onSwap,
  onTarget,
  onOpen,
  onSummary,
  renderItem,
}: {
  target: SplitTarget;
  width: number;
  onWidth: (w: number) => void;
  api: NotebookApi;
  entriesApi: EntriesApi;
  /** nota aberta no painel principal */
  activeId: string | null;
  onClose: () => void;
  /** abre o conteúdo do painel no lugar principal */
  onPromote: () => void;
  /** troca os dois painéis de lugar */
  onSwap: (() => void) | null;
  onTarget: (t: SplitTarget) => void;
  onOpen: (id: string) => void;
  onSummary: (entryId: string) => void;
  renderItem: (item: NotebookItem) => React.ReactNode;
}) {
  const ref = useRef<HTMLElement>(null);
  const item = target.kind === 'item' ? api.items[target.id] : null;
  const entry = target.kind === 'entry' ? entriesApi.entries[target.id] : null;

  useEffect(() => {
    if (item && !item._full) void api.loadFull(item.id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [item?.id, item?._full]);

  // arrastar a borda para redimensionar
  function startResize(e: React.PointerEvent) {
    e.preventDefault();
    const startX = e.clientX;
    const startW = width;
    const host = ref.current?.parentElement;
    const max = Math.max(SPLIT_MIN, (host?.clientWidth || window.innerWidth) - 360);
    const move = (ev: PointerEvent) => onWidth(Math.min(max, Math.max(SPLIT_MIN, startW + (startX - ev.clientX))));
    const up = () => {
      window.removeEventListener('pointermove', move);
      window.removeEventListener('pointerup', up);
      document.body.style.cursor = '';
    };
    document.body.style.cursor = 'col-resize';
    window.addEventListener('pointermove', move);
    window.addEventListener('pointerup', up);
  }

  const gone = (target.kind === 'item' && (!item || item.archived_at)) || (target.kind === 'entry' && !entry);
  const sameAsMain = target.kind === 'item' && target.id === activeId;
  const title = item?.title || entry?.title || '';

  return (
    <aside ref={ref} className="nb-split" style={{ ['--split-w' as string]: `${width}px` }} aria-label={`Ao lado: ${title}`}>
      <div
        className="nb-split-handle"
        role="separator"
        aria-orientation="vertical"
        aria-label="Redimensionar painel"
        tabIndex={0}
        onPointerDown={startResize}
        onDoubleClick={() => onWidth(420)}
        onKeyDown={(e) => {
          if (e.key === 'ArrowLeft') onWidth(width + 24);
          if (e.key === 'ArrowRight') onWidth(Math.max(SPLIT_MIN, width - 24));
        }}
      />
      <header className="nb-split-head">
        <span className="text-[13px] shrink-0">{item ? itemIcon(item) : entry ? <EntryAvatar entry={entry} size={18} ring={false} /> : null}</span>
        <span className="flex-1 min-w-0 truncate text-[12px] font-bold">{title || 'Painel ao lado'}</span>
        {onSwap && !gone && (
          <button type="button" className="nb-split-btn" title="Trocar de lado" aria-label="Trocar de lado" onClick={onSwap}>
            <ArrowLeftRight />
          </button>
        )}
        {!gone && (
          <button type="button" className="nb-split-btn" title="Abrir no painel principal" aria-label="Abrir no painel principal" onClick={onPromote}>
            <Maximize2 />
          </button>
        )}
        <button type="button" className="nb-split-btn" title="Fechar tela dividida" aria-label="Fechar tela dividida" onClick={onClose}>
          <X />
        </button>
      </header>

      <div className="nb-split-body">
        {gone ? (
          <p className="p-6 text-center text-sm text-[var(--nb-ink-3)]">Este conteúdo não existe mais.</p>
        ) : sameAsMain ? (
          <p className="p-6 text-center text-sm text-[var(--nb-ink-3)]">Esta nota já está aberta no painel principal. Escolha outra para consultar ao lado.</p>
        ) : entry ? (
          <EntryPane entry={entry} api={api} entriesApi={entriesApi} onOpen={onOpen} onTarget={onTarget} onSummary={onSummary} />
        ) : item && !item._full ? (
          <div className="h-40 grid place-items-center">
            <Loader2 className="w-5 h-5 animate-spin text-[var(--nb-ink-3)]" />
          </div>
        ) : item && item.template === 'chapter' ? (
          <ChapterPreview item={item} onEdit={onPromote} />
        ) : item && (item.template === 'map' || item.template === 'mindmap' || item.template === 'canvas') ? (
          <div className="absolute inset-0">{renderItem(item)}</div>
        ) : item ? (
          <div className="nb-scroll absolute inset-0 overflow-y-auto">
            <div className="px-4 sm:px-6 py-5">
              <p className="mb-3 text-[22px] font-black leading-tight">{item.title}</p>
              {renderItem(item)}
            </div>
          </div>
        ) : null}
      </div>
    </aside>
  );
}

/** Capítulo para consulta: leitura na página, sem editar. */
function ChapterPreview({ item, onEdit }: { item: NotebookItem; onEdit: () => void }) {
  const html = useMemo(() => sanitizeUserHtml(sanitizeWriterHtml(String(item.data?.html || ''))), [item.data?.html]);
  return (
    <div className="nb-scroll absolute inset-0 overflow-y-auto nb-writer" data-paper="sepia" style={{ ['--paper-font' as string]: 'var(--nb-literata), Georgia, serif' }}>
      <article className="nb-paper-sheet nb-book-read px-6 sm:px-10 py-10 text-[16px] leading-[1.8]" style={{ fontFamily: 'var(--paper-font)' }}>
        <h2>{item.title}</h2>
        {html ? <div dangerouslySetInnerHTML={{ __html: html }} /> : <p className="!indent-0 opacity-60">Capítulo em branco.</p>}
      </article>
      <div className="flex justify-center py-4">
        <button type="button" onClick={onEdit} className="h-8 px-3 rounded-lg bg-[var(--nb-pane)] border border-[var(--nb-line)] text-[12px] font-bold text-[var(--nb-ink-2)] hover:text-[var(--nb-ink)]">
          Editar no painel principal
        </button>
      </div>
    </div>
  );
}

function EntryPane({
  entry,
  api,
  entriesApi,
  onOpen,
  onTarget,
  onSummary,
}: {
  entry: NotebookEntry;
  api: NotebookApi;
  entriesApi: EntriesApi;
  onOpen: (id: string) => void;
  onTarget: (t: SplitTarget) => void;
  onSummary: (id: string) => void;
}) {
  const look = entryLook(entry);
  const usedIn = useMemo(
    () => Object.values(api.items).filter((i) => !i.archived_at && (i.entry_refs || []).includes(entry.id)),
    [api.items, entry.id]
  );
  const target = entry.target_id ? api.items[entry.target_id] : null;
  return (
    <div className="nb-scroll absolute inset-0 overflow-y-auto px-4 py-5 space-y-4">
      <div className="flex items-start gap-3">
        <EntryAvatar entry={entry} size={56} />
        <div className="min-w-0 flex-1">
          <p className="text-[10px] font-black uppercase tracking-wider" style={{ color: look.color }}>
            {look.label}
          </p>
          <p className="text-[20px] font-black leading-tight">{entry.title}</p>
          {entry.aliases.length > 0 && <p className="text-[12px] text-[var(--nb-ink-3)] truncate">também: {entry.aliases.join(', ')}</p>}
        </div>
      </div>
      <p className="text-[14px] leading-relaxed text-[var(--nb-ink-2)] whitespace-pre-line">{entry.summary || 'Sem resumo ainda.'}</p>
      <div className="flex flex-wrap gap-2">
        {target && !target.archived_at && (
          <button
            type="button"
            onClick={() => onTarget({ kind: 'item', id: target.id })}
            className="flex items-center gap-1.5 h-8 px-3 rounded-lg bg-[var(--nb-hl)] text-white text-[12px] font-bold"
          >
            {itemIcon(target)} Abrir “{target.title}” aqui
          </button>
        )}
        <button
          type="button"
          onClick={() => onSummary(entry.id)}
          className="flex items-center gap-1.5 h-8 px-3 rounded-lg border border-[var(--nb-line)] text-[12px] font-bold text-[var(--nb-ink-2)] hover:text-[var(--nb-ink)]"
        >
          <BookMarked className="w-3.5 h-3.5" /> Editar no Sumário
        </button>
        {target && (
          <button
            type="button"
            onClick={() => onOpen(target.id)}
            className="flex items-center gap-1 h-8 px-2 rounded-lg text-[12px] font-bold text-[var(--nb-ink-3)] hover:text-[var(--nb-ink)]"
          >
            principal <ArrowUpRight className="w-3 h-3" />
          </button>
        )}
      </div>
      {entry.kind === 'elemento' && (
        <section>
          <p className="mb-1.5 text-[10px] font-black uppercase tracking-wider text-[var(--nb-ink-3)]">Relações</p>
          <RelationsEditor entry={entry} entriesApi={entriesApi} />
        </section>
      )}
      <section>
        <p className="mb-1.5 text-[10px] font-black uppercase tracking-wider text-[var(--nb-ink-3)]">
          {usedIn.length ? `Aparece em ${usedIn.length}` : 'Ainda não aparece em nenhum texto'}
        </p>
        <EntryAppearances entry={entry} usedIn={usedIn} api={api} onOpen={onOpen} compact />
      </section>
    </div>
  );
}
