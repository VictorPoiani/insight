'use client';

import { useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import { Camera, GitCompareArrows, Loader2, MoreHorizontal, Pencil, RotateCcw, Trash2, X, Eye, Undo2 } from 'lucide-react';
import type { NotebookItem } from '@/lib/notebook/types';
import type { NotebookApi, NotebookRevision } from '@/lib/notebook/useNotebook';
import { htmlToText } from '@/lib/notebook/markdown';
import { blockMode, diffBlocks, joinBlocks, restoreHunk, splitBlocks, type BlockRange, type DiffPiece } from '@/lib/notebook/diff';
import { useNotebookMenu } from '../menu/ContextMenu';

const fmt = (iso: string) => new Date(iso).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' });
const reloadEditor = (id: string) => window.dispatchEvent(new CustomEvent('insight-notebook-reload', { detail: id }));

/** Portal dentro do app para herdar as cores do tema. */
export function NbPortal({ children }: { children: React.ReactNode }) {
  const [host, setHost] = useState<Element | null>(null);
  useEffect(() => setHost(document.querySelector('.nb-app') || document.body), []);
  return host ? createPortal(children, host) : null;
}

/**
 * Histórico da nota: versões automáticas + instantâneos nomeados,
 * com comparação lado a lado e restauração por trecho.
 */
export function VersionHistory({ item, api }: { item: NotebookItem; api: NotebookApi }) {
  const [revs, setRevs] = useState<NotebookRevision[] | null>(null);
  const [filter, setFilter] = useState<'all' | 'named'>('all');
  const [name, setName] = useState('');
  const [saving, setSaving] = useState(false);
  const [preview, setPreview] = useState<string | null>(null);
  const [compare, setCompare] = useState<string | null>(null);
  const [renaming, setRenaming] = useState<string | null>(null);
  const menu = useNotebookMenu();

  const refresh = async () => setRevs(await api.listRevisions(item.id));
  useEffect(() => {
    let alive = true;
    setRevs(null);
    api.listRevisions(item.id).then((r) => alive && setRevs(r));
    return () => {
      alive = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [item.id]);

  const shown = useMemo(() => (revs || []).filter((r) => filter === 'all' || r.label), [revs, filter]);

  async function snapshot() {
    setSaving(true);
    await api.flushAll();
    await api.saveRevisionNow(item.id, name.trim() || null);
    setName('');
    await refresh();
    setSaving(false);
  }

  async function restoreAll(r: NotebookRevision) {
    if (!confirm(`Restaurar a versão ${r.label ? `“${r.label}”` : `de ${fmt(r.created_at)}`}? O texto atual é guardado antes como instantâneo.`)) return;
    await api.flushAll();
    await api.saveRevisionNow(item.id, 'Antes de restaurar');
    api.update(item.id, { title: r.title, content: r.content, blocks: r.blocks, data: (r.data as NotebookItem['data']) || item.data });
    await refresh();
    reloadEditor(item.id);
  }

  const revMenu = (e: React.MouseEvent, r: NotebookRevision) =>
    menu.open(
      e,
      [
        { label: 'Comparar com a atual', icon: <GitCompareArrows className="w-3.5 h-3.5" />, run: () => setCompare(r.id) },
        { label: preview === r.id ? 'Fechar prévia' : 'Ver texto', icon: <Eye className="w-3.5 h-3.5" />, run: () => setPreview(preview === r.id ? null : r.id) },
        { label: r.label ? 'Renomear' : 'Dar um nome', icon: <Pencil className="w-3.5 h-3.5" />, run: () => setRenaming(r.id) },
        'sep',
        { label: 'Restaurar esta versão', icon: <RotateCcw className="w-3.5 h-3.5" />, run: () => void restoreAll(r) },
        {
          label: 'Apagar',
          icon: <Trash2 className="w-3.5 h-3.5" />,
          danger: true,
          run: async () => {
            if (!confirm('Apagar esta versão do histórico?')) return;
            await api.deleteRevision(r.id);
            await refresh();
          },
        },
      ],
      r.label || fmt(r.created_at)
    );

  return (
    <div className="px-2 py-1 space-y-3">
      <form
        onSubmit={(e) => {
          e.preventDefault();
          void snapshot();
        }}
        className="space-y-1.5"
      >
        <input
          value={name}
          onChange={(e) => setName(e.target.value.slice(0, 80))}
          placeholder="Nome do instantâneo (opcional)"
          aria-label="Nome do instantâneo"
          className="w-full h-8 px-2.5 rounded-lg bg-[var(--nb-bg)] border border-[var(--nb-line)] text-[12px] outline-none focus:border-[var(--nb-hl)]"
        />
        <button
          type="submit"
          disabled={saving}
          className="w-full flex items-center justify-center gap-2 h-8 rounded-lg bg-[var(--nb-hl)] text-white text-[12px] font-bold disabled:opacity-60"
        >
          {saving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Camera className="w-3.5 h-3.5" />} Salvar instantâneo
        </button>
      </form>
      <p className="text-[11px] leading-snug text-[var(--nb-ink-3)]">
        Instantâneos com nome ficam guardados para sempre (até 60). Versões automáticas são salvas a cada 10 minutos de edição (as 40 mais recentes).
      </p>

      <div className="flex gap-1">
        {(['all', 'named'] as const).map((f) => (
          <button
            key={f}
            type="button"
            aria-pressed={filter === f}
            onClick={() => setFilter(f)}
            className={`h-6 px-2.5 rounded-full text-[11px] font-bold ${filter === f ? 'bg-[var(--nb-hl-soft)] text-[var(--nb-hl)]' : 'text-[var(--nb-ink-3)] hover:text-[var(--nb-ink)]'}`}
          >
            {f === 'all' ? 'Todas' : 'Instantâneos'}
          </button>
        ))}
      </div>

      {!revs && <Loader2 className="w-4 h-4 mx-auto animate-spin text-[var(--nb-ink-3)]" />}
      {revs && !shown.length && <p className="text-xs text-[var(--nb-ink-3)]">{filter === 'named' ? 'Nenhum instantâneo com nome ainda.' : 'Nenhuma versão ainda.'}</p>}

      {shown.map((r, i) => {
        const older = shown[i + 1];
        const delta = older ? r.word_count - older.word_count : null;
        return (
          <div key={r.id} className={`group rounded-lg border ${preview === r.id ? 'border-[var(--nb-hl)]' : 'border-[var(--nb-line)]'}`} onContextMenu={(e) => revMenu(e, r)}>
            <div className="flex items-start gap-1 px-3 py-2">
              <div className="flex-1 min-w-0">
                {renaming === r.id ? (
                  <input
                    autoFocus
                    defaultValue={r.label || ''}
                    placeholder="Nome do instantâneo"
                    aria-label="Nome do instantâneo"
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') (e.target as HTMLInputElement).blur();
                      if (e.key === 'Escape') setRenaming(null);
                    }}
                    onBlur={async (e) => {
                      setRenaming(null);
                      const v = e.target.value.trim();
                      if (v === (r.label || '')) return;
                      await api.renameRevision(r.id, v || null);
                      await refresh();
                    }}
                    className="w-full h-6 px-1.5 rounded bg-[var(--nb-bg)] border border-[var(--nb-hl)] text-[12px] outline-none"
                  />
                ) : r.label ? (
                  <span className="flex items-center gap-1.5 text-[12px] font-bold text-[var(--nb-ink)]">
                    <Camera className="w-3 h-3 shrink-0 text-[var(--nb-hl)]" />
                    <span className="truncate">{r.label}</span>
                  </span>
                ) : (
                  <span className="block text-[12px] font-semibold">{fmt(r.created_at)}</span>
                )}
                <span className="block text-[11px] text-[var(--nb-ink-3)]">
                  {r.label && `${fmt(r.created_at)} · `}
                  {r.word_count.toLocaleString('pt-BR')} palavras
                  {delta !== null && delta !== 0 && (
                    <span className={delta > 0 ? 'text-emerald-400' : 'text-rose-400'}>
                      {' '}
                      {delta > 0 ? '+' : ''}
                      {delta.toLocaleString('pt-BR')}
                    </span>
                  )}
                </span>
              </div>
              <button
                type="button"
                title="Comparar com a versão atual"
                aria-label="Comparar com a versão atual"
                onClick={() => setCompare(r.id)}
                className="p-1 rounded-md text-[var(--nb-ink-3)] hover:text-[var(--nb-hl)] hover:bg-[var(--nb-pane-2)]"
              >
                <GitCompareArrows className="w-3.5 h-3.5" />
              </button>
              <button
                type="button"
                title="Mais"
                aria-label="Mais ações da versão"
                onClick={(e) => revMenu(e, r)}
                className="p-1 rounded-md text-[var(--nb-ink-3)] hover:text-[var(--nb-ink)] hover:bg-[var(--nb-pane-2)]"
              >
                <MoreHorizontal className="w-3.5 h-3.5" />
              </button>
            </div>
            {preview === r.id && (
              <div className="px-3 pb-3 space-y-2">
                <pre className="max-h-48 overflow-auto nb-scroll whitespace-pre-wrap text-[11px] leading-relaxed p-2 rounded bg-[var(--nb-bg)] text-[var(--nb-ink-2)]">
                  {(r.content || htmlToText(String(r.data?.html || ''))).slice(0, 3000) || '(sem texto)'}
                </pre>
                <button
                  type="button"
                  onClick={() => void restoreAll(r)}
                  className="w-full flex items-center justify-center gap-1.5 h-7 rounded-md border border-[var(--nb-line)] text-[11px] font-bold hover:bg-[var(--nb-pane-2)]"
                >
                  <RotateCcw className="w-3 h-3" /> Restaurar esta versão
                </button>
              </div>
            )}
          </div>
        );
      })}

      {compare && revs && (
        <CompareDialog
          item={item}
          api={api}
          revisions={revs}
          initial={compare}
          onClose={() => setCompare(null)}
          onChanged={refresh}
          onRestoreAll={(r) => void restoreAll(r).then(() => setCompare(null))}
        />
      )}
    </div>
  );
}

// ============================================================================
// Comparação
// ============================================================================

const CURRENT = 'atual';

function CompareDialog({
  item,
  api,
  revisions,
  initial,
  onClose,
  onChanged,
  onRestoreAll,
}: {
  item: NotebookItem;
  api: NotebookApi;
  revisions: NotebookRevision[];
  initial: string;
  onClose: () => void;
  onChanged: () => Promise<void> | void;
  onRestoreAll: (r: NotebookRevision) => void;
}) {
  const [left, setLeft] = useState(initial);
  const [right, setRight] = useState(CURRENT);
  const [showSame, setShowSame] = useState<Set<number>>(new Set());
  const live = api.items[item.id] || item;
  const mode = blockMode(item.template);

  const srcOf = (id: string) => {
    if (id === CURRENT) return { template: live.template, content: live.content, data: live.data };
    const r = revisions.find((x) => x.id === id);
    return r ? { template: item.template, content: r.content, data: r.data } : null;
  };
  const leftRev = revisions.find((r) => r.id === left) || null;

  const result = useMemo(() => {
    const a = srcOf(left);
    const b = srcOf(right);
    if (!a || !b) return null;
    const oldB = splitBlocks(a);
    const curB = splitBlocks(b);
    if (!oldB || !curB) return null;
    return { oldB, curB, diff: diffBlocks(oldB, curB) };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [left, right, revisions, live.content, live.data]);

  useEffect(() => {
    const k = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', k);
    return () => window.removeEventListener('keydown', k);
  }, [onClose]);

  async function restorePiece(h: BlockRange) {
    if (!result || !mode || right !== CURRENT) return;
    await api.flushAll();
    await api.saveRevisionNow(item.id, 'Antes de restaurar trecho');
    const next = joinBlocks(restoreHunk(result.oldB, result.curB, h), mode);
    if (mode === 'html') api.update(item.id, { data: { ...live.data, html: next } });
    else api.update(item.id, { content: next });
    reloadEditor(item.id);
    await onChanged();
  }

  const options = (
    <>
      {revisions.map((r) => (
        <option key={r.id} value={r.id}>
          {r.label ? `${r.label} · ${fmt(r.created_at)}` : fmt(r.created_at)}
        </option>
      ))}
    </>
  );

  return (
    <NbPortal>
      <div className="nb-modal-back !pt-[6vh]" onClick={onClose}>
        <div className="nb-modal !max-w-4xl !max-h-[86vh]" role="dialog" aria-label="Comparar versões" onClick={(e) => e.stopPropagation()}>
          <div className="flex flex-wrap items-center gap-2 px-4 py-3 border-b border-[var(--nb-line)]">
            <GitCompareArrows className="w-4 h-4 text-[var(--nb-hl)]" />
            <p className="font-black text-[14px] mr-2">Comparar versões</p>
            <select value={left} onChange={(e) => setLeft(e.target.value)} aria-label="Versão antiga" className="nb-cmp-select">
              {options}
            </select>
            <span className="text-[var(--nb-ink-3)] text-[12px]">com</span>
            <select value={right} onChange={(e) => setRight(e.target.value)} aria-label="Versão nova" className="nb-cmp-select">
              <option value={CURRENT}>Versão atual</option>
              {options}
            </select>
            <div className="flex-1" />
            {result && (
              <span className="text-[12px] font-mono">
                <span className="text-emerald-400">+{result.diff.added.toLocaleString('pt-BR')}</span>{' '}
                <span className="text-rose-400">−{result.diff.removed.toLocaleString('pt-BR')}</span> palavras
              </span>
            )}
            <button type="button" onClick={onClose} aria-label="Fechar" className="p-1.5 rounded-md hover:bg-[var(--nb-pane-2)]">
              <X className="w-4 h-4" />
            </button>
          </div>

          <div className="nb-scroll flex-1 min-h-0 overflow-y-auto px-4 py-4 space-y-2">
            {!result && (
              <p className="py-10 text-center text-sm text-[var(--nb-ink-3)]">
                A comparação trecho a trecho está disponível para textos, capítulos e fichas. Para este tipo de nota, use “Restaurar versão inteira”.
              </p>
            )}
            {result && !result.diff.hunks.length && <p className="py-10 text-center text-sm text-[var(--nb-ink-3)]">As duas versões têm o mesmo texto.</p>}
            {result?.diff.pieces.map((p: DiffPiece, i) =>
              p.t === 'same' ? (
                p.count <= 1 || showSame.has(i) ? (
                  p.text.map((t, j) => (
                    <p key={`${i}-${j}`} className="nb-cmp-same">
                      {t || ' '}
                    </p>
                  ))
                ) : (
                  <button key={i} type="button" onClick={() => setShowSame((s) => new Set(s).add(i))} className="nb-cmp-fold">
                    {p.count} {p.count === 1 ? 'parágrafo igual' : 'parágrafos iguais'}
                  </button>
                )
              ) : (
                <div key={i} className="nb-cmp-hunk">
                  {p.hunk.rows.map((r, j) => (
                    <div key={j} className="nb-cmp-line group">
                      <p className="nb-cmp-row" data-kind={r.kind}>
                        {r.segs.map((s, k) =>
                          s.t === 'same' ? (
                            <span key={k}>{s.s}</span>
                          ) : s.t === 'add' ? (
                            <ins key={k}>{s.s}</ins>
                          ) : (
                            <del key={k}>{s.s}</del>
                          )
                        )}
                      </p>
                      {right === CURRENT && mode && (
                        <button type="button" onClick={() => void restorePiece(r)} className="nb-cmp-restore">
                          <Undo2 className="w-3 h-3" /> {r.kind === 'added' ? 'Tirar este trecho' : r.kind === 'removed' ? 'Trazer de volta' : 'Voltar ao antigo'}
                        </button>
                      )}
                    </div>
                  ))}
                </div>
              )
            )}
          </div>

          <div className="flex items-center gap-3 px-4 py-2.5 border-t border-[var(--nb-line)] text-[11px] text-[var(--nb-ink-3)]">
            <span>
              <ins className="nb-cmp-key-add">texto novo</ins> <del className="nb-cmp-key-del">texto que saiu</del>
            </span>
            <div className="flex-1" />
            {leftRev && (
              <button
                type="button"
                onClick={() => onRestoreAll(leftRev)}
                className="flex items-center gap-1.5 h-7 px-3 rounded-lg border border-[var(--nb-line)] text-[11px] font-bold text-[var(--nb-ink-2)] hover:bg-[var(--nb-pane-2)]"
              >
                <RotateCcw className="w-3 h-3" /> Restaurar versão inteira
              </button>
            )}
          </div>
        </div>
      </div>
    </NbPortal>
  );
}
