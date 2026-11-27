'use client';

import { memo } from 'react';
import { ExternalLink, FileAudio, FileText, FileVideo, Link2, Loader2, Lock } from 'lucide-react';
import type { NotebookItem } from '@/lib/notebook/types';
import { entryLook, type NotebookEntry } from '@/lib/notebook/entries';
import { fileKind, formatSize } from '@/lib/notebook/canvasMedia';
import { Glyph } from '../icons/Glyph';
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
  openEntry: (id: string) => void;
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
  entry?: NotebookEntry | null;
  ctx: NodeCtx;
}

function NodeViewImpl({ n, selected, handles, editing, note, entry, ctx }: Props) {
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
      <Body n={n} editing={editing} note={note} entry={entry || null} selected={selected} ctx={ctx} />
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

/** Campos do frontmatter (ficha de personagem, etc.). */
function frontFields(md: string): [string, string][] {
  const m = /^---\n([\s\S]*?)\n---/.exec(md || '');
  if (!m) return [];
  return m[1]
    .split('\n')
    .map((l) => l.match(/^([\w\p{L} -]{1,40}):\s*(.+)$/u))
    .filter((x): x is RegExpMatchArray => !!x && x[1].trim().toLowerCase() !== 'tags')
    .slice(0, 6)
    .map((x) => [x[1].trim(), x[2].trim()]);
}

const STATUS: Record<string, string> = { ideia: 'Ideia', rascunho: 'Rascunho', revisao: 'Em revisão', revisão: 'Em revisão', pronto: 'Pronto', final: 'Pronto' };

function Body({ n, editing, note, entry, selected, ctx }: { n: CanvasNode; editing: boolean; note: NotebookItem | null; entry: NotebookEntry | null; selected: boolean; ctx: NodeCtx }) {
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
          <span className="truncate flex-1">{note?.title || 'Nota removida'}</span>
          {note?.template === 'chapter' && (
            <span className="nb-cv-chip">
              {STATUS[String(note.data?.status || '').toLowerCase()] || 'Capítulo'} · {(note.word_count || 0).toLocaleString('pt-BR')} palavras
            </span>
          )}
        </button>
        {note?._full && note.template === 'character' && frontFields(note.content || '').length > 0 && (
          <dl className="nb-cv-fields">
            {frontFields(note.content || '').map(([k, v]) => (
              <div key={k}>
                <dt>{k}</dt>
                <dd>{v}</dd>
              </div>
            ))}
          </dl>
        )}
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
        {n.credit &&
          (n.creditUrl ? (
            <a className="nb-cv-credit" href={n.creditUrl} target="_blank" rel="noopener noreferrer" onPointerDown={(e) => e.stopPropagation()}>
              {n.credit}
            </a>
          ) : (
            <span className="nb-cv-credit">{n.credit}</span>
          ))}
        {n.pending && (
          <span className="nb-cv-uploading">
            <Loader2 className="animate-spin" /> Enviando o original…
          </span>
        )}
      </>
    );

  if (n.type === 'file') {
    const kind = fileKind(n.mime);
    const Icon = kind === 'audio' ? FileAudio : kind === 'video' ? FileVideo : FileText;
    return (
      <>
        <div className="nb-cv-file-head">
          <Icon />
          <span className="truncate flex-1">{n.label || 'Arquivo'}</span>
          <span className="nb-cv-chip">{[kind === 'pdf' ? 'PDF' : (n.mime || '').split('/')[1]?.toUpperCase(), formatSize(n.bytes)].filter(Boolean).join(' · ')}</span>
          {n.url && !n.pending && (
            <a href={n.url} target="_blank" rel="noopener noreferrer" onPointerDown={(e) => e.stopPropagation()} title="Abrir o original" aria-label="Abrir o original">
              <ExternalLink />
            </a>
          )}
        </div>
        {/* o conteúdo só recebe o mouse com o cartão selecionado (senão arrastaria o PDF, não o cartão) */}
        <div className="nb-cv-file-body" data-live={selected || undefined} onPointerDown={(e) => selected && e.stopPropagation()}>
          {kind === 'pdf' ? (
            <iframe src={`${n.url}#view=FitH&toolbar=0`} title={n.label || 'PDF'} loading="lazy" />
          ) : kind === 'video' ? (
            <video src={n.url} controls preload="metadata" playsInline />
          ) : kind === 'audio' ? (
            <audio src={n.url} controls preload="metadata" />
          ) : (
            <p className="nb-cv-empty">Pré-visualização indisponível.</p>
          )}
          {n.pending && (
            <span className="nb-cv-uploading">
              <Loader2 className="animate-spin" /> Enviando o original…
            </span>
          )}
        </div>
      </>
    );
  }

  if (n.type === 'entry') {
    const look = entryLook(entry);
    return (
      <div className="nb-cv-entry" style={{ ['--ent' as string]: look.color }}>
        {entry?.image_url && (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={entry.image_url} alt="" draggable={false} />
        )}
        <div className="nb-cv-entry-body">
          <span className="nb-cv-entry-kind">
            <Glyph name={look.glyph} /> {look.label}
          </span>
          <button type="button" className="nb-cv-entry-title" onPointerDown={(e) => e.stopPropagation()} onClick={() => entry && ctx.openEntry(entry.id)} title="Abrir o verbete">
            {entry?.title || n.label || 'Verbete removido'}
          </button>
          {entry?.aliases?.length ? <span className="nb-cv-entry-alias">Também: {entry.aliases.join(', ')}</span> : null}
          <p className="nb-cv-scroll">{entry?.summary || (entry ? 'Sem resumo ainda.' : '')}</p>
        </div>
      </div>
    );
  }

  if (n.type === 'link' && n.meta && (n.meta.title || n.meta.image)) {
    return (
      <a className="nb-cv-card-link" href={n.url} target="_blank" rel="noopener noreferrer" onClick={(e) => e.preventDefault()} draggable={false}>
        {n.meta.image && (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={n.meta.image} alt="" draggable={false} referrerPolicy="no-referrer" />
        )}
        <span className="nb-cv-card-link-body">
          <span className="nb-cv-card-link-site">{n.meta.site}</span>
          <span className="nb-cv-card-link-title">{n.meta.title}</span>
          {n.meta.description && <span className="nb-cv-card-link-desc">{n.meta.description}</span>}
        </span>
      </a>
    );
  }

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
