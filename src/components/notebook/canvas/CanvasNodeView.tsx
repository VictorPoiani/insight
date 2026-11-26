'use client';

import { memo } from 'react';
import { Link2, Loader2, Lock } from 'lucide-react';
import type { NotebookItem } from '@/lib/notebook/types';
import { renderMarkdown } from '@/lib/notebook/markdown';
import { sanitizeUserHtml } from '@/lib/security/sanitizeHtml';
import { canvasColor, type CanvasNode, type CanvasSide } from '@/lib/notebook/canvas';
import { sanitizeWriterHtml } from '../WriterMode';
import { itemIcon } from '../FileExplorer';

const NOTE_TEXT = new Set(['markdown', 'journal', 'screenplay', 'study', 'idea', 'world', 'meeting', 'poem', 'article', 'character', 'codex']);
const SIDES: CanvasSide[] = ['top', 'right', 'bottom', 'left'];
const DIRS = ['n', 's', 'e', 'w', 'ne', 'nw', 'se', 'sw'] as const;

/** Ações do Canvas que os cartões chamam (objeto estável: não re-renderiza). */
export interface NodeCtx {
  down: (e: React.PointerEvent, n: CanvasNode) => void;
  dbl: (e: React.MouseEvent, n: CanvasNode) => void;
  menu: (e: React.MouseEvent, n: CanvasNode) => void;
  resize: (e: React.PointerEvent, n: CanvasNode, dir: string) => void;
  connect: (e: React.PointerEvent, n: CanvasNode, side: CanvasSide) => void;
  finishText: (n: CanvasNode, text: string) => void;
  finishLabel: (n: CanvasNode, label: string) => void;
  openNote: (id: string) => void;
  linkClick: (e: React.MouseEvent) => void;
  titleExists: (t: string) => boolean;
}

interface Props {
  n: CanvasNode;
  selected: boolean;
  /** única selecionada: mostra alças */
  handles: boolean;
  editing: boolean;
  note: NotebookItem | null;
  ctx: NodeCtx;
}

function NodeViewImpl({ n, selected, handles, editing, note, ctx }: Props) {
  const color = canvasColor(n.color);
  return (
    <div
      data-cnode={n.id}
      className={`nb-cv-node nb-cv-${n.type}`}
      data-selected={selected || undefined}
      data-editing={editing || undefined}
      data-locked={n.locked || undefined}
      style={{ transform: `translate3d(${n.x}px, ${n.y}px, 0)`, width: n.width, height: n.height, ['--cv' as string]: color || undefined }}
      onPointerDown={(e) => !editing && ctx.down(e, n)}
      onDoubleClick={(e) => ctx.dbl(e, n)}
      onContextMenu={(e) => ctx.menu(e, n)}
    >
      <Body n={n} editing={editing} note={note} ctx={ctx} />
      {n.locked && selected && (
        <span className="nb-cv-lock" title="Travado">
          <Lock />
        </span>
      )}
      {handles && !editing && (
        <>
          {!n.locked &&
            DIRS.map((d) => (
              <span
                key={d}
                className={`nb-cv-rz nb-cv-rz--${d}`}
                onPointerDown={(e) => {
                  e.stopPropagation();
                  ctx.resize(e, n, d);
                }}
              />
            ))}
          {n.type !== 'group' &&
            SIDES.map((s) => (
              <span
                key={s}
                className={`nb-cv-handle nb-cv-handle--${s}`}
                title="Arraste para ligar"
                onPointerDown={(e) => {
                  e.stopPropagation();
                  ctx.connect(e, n, s);
                }}
              />
            ))}
        </>
      )}
    </div>
  );
}

function Body({ n, editing, note, ctx }: { n: CanvasNode; editing: boolean; note: NotebookItem | null; ctx: NodeCtx }) {
  if (n.type === 'group')
    return editing ? (
      <input
        autoFocus
        defaultValue={n.label || ''}
        onPointerDown={(e) => e.stopPropagation()}
        onBlur={(e) => ctx.finishLabel(n, e.target.value.slice(0, 80))}
        onKeyDown={(e) => (e.key === 'Enter' || e.key === 'Escape') && (e.target as HTMLInputElement).blur()}
        className="nb-cv-group-label nb-cv-group-input"
        aria-label="Nome do grupo"
      />
    ) : (
      <span className="nb-cv-group-label">{n.label || 'Grupo'}</span>
    );

  if (n.type === 'text')
    return editing ? (
      <textarea
        autoFocus
        defaultValue={n.text || ''}
        onPointerDown={(e) => e.stopPropagation()}
        onBlur={(e) => ctx.finishText(n, e.target.value.slice(0, 20000))}
        onKeyDown={(e) => {
          if (e.key === 'Escape') (e.target as HTMLTextAreaElement).blur();
        }}
        placeholder="Escreva em markdown…"
        className="nb-cv-textarea"
      />
    ) : n.text?.trim() ? (
      <div className="nb-cv-scroll nb-md nb-cv-md" onClick={ctx.linkClick} dangerouslySetInnerHTML={{ __html: renderMarkdown(n.text, { titleExists: ctx.titleExists }) }} />
    ) : (
      <p className="nb-cv-empty">Clique duas vezes para escrever</p>
    );

  if (n.type === 'note')
    return (
      <>
        <button type="button" className="nb-cv-note-head" onPointerDown={(e) => e.stopPropagation()} onClick={() => note && ctx.openNote(note.id)} title="Abrir a nota">
          <span className="text-[13px]">{note ? itemIcon(note) : null}</span>
          <span className="truncate">{note?.title || 'Nota removida'}</span>
        </button>
        <div className="nb-cv-scroll nb-cv-note-body" onClick={ctx.linkClick}>
          {!note ? null : !note._full ? (
            <Loader2 className="w-4 h-4 m-3 animate-spin text-[var(--nb-ink-3)]" />
          ) : note.template === 'chapter' ? (
            <div className="nb-md nb-cv-md" dangerouslySetInnerHTML={{ __html: sanitizeUserHtml(sanitizeWriterHtml(String(note.data?.html || ''))) }} />
          ) : NOTE_TEXT.has(note.template) ? (
            <div className="nb-md nb-cv-md" dangerouslySetInnerHTML={{ __html: renderMarkdown((note.content || '').replace(/^---\n[\s\S]*?\n---\n?/, '')) }} />
          ) : (
            <p className="nb-cv-empty">Abra a nota para ver este conteúdo.</p>
          )}
        </div>
      </>
    );

  if (n.type === 'image')
    return (
      <>
        <span className="nb-cv-caption">{n.label}</span>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={n.url} alt={n.label || ''} draggable={false} decoding="async" loading="lazy" />
        {n.pending && (
          <span className="nb-cv-uploading">
            <Loader2 className="animate-spin" /> Enviando o original…
          </span>
        )}
      </>
    );

  let host = n.url || '';
  try {
    host = new URL(n.url || '').hostname;
  } catch {
    /* ignora */
  }
  return (
    <div className="nb-cv-link">
      <Link2 className="w-4 h-4 shrink-0 text-[var(--nb-ink-3)]" />
      <span className="min-w-0">
        <span className="block truncate font-semibold text-[13px]">{host}</span>
        <span className="block truncate text-[11px] text-[var(--nb-ink-3)]">{n.url}</span>
      </span>
    </div>
  );
}

export const CanvasNodeView = memo(NodeViewImpl);
