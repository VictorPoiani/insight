'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { BookOpen, Feather, NotebookPen, Plus, Trash2, Pencil, Check, X, Download, Lock } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import { useNitro } from '@/components/nitro/NitroProvider';
import type { TopicWorkspaceData, WritingPiece } from '@/types/database';
import { NOTEBOOK_NAME } from '@/lib/notebook/copy';

const KIND_LABEL: Record<WritingPiece['kind'], string> = {
  poem: 'Poema',
  chapter: 'Capítulo',
  text: 'Texto',
};

const uid = () => `wr-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`;

/** HTML/markdown do notebook → texto corrido (mantém as quebras de linha dos versos). */
function toPlain(src?: string | null) {
  return (src || '')
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/(p|div|h\d|li|blockquote)>/gi, '\n')
    .replace(/<[^>]+>/g, '')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/^#{1,6}\s+/gm, '')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

interface NotebookRow {
  id: string;
  title: string;
  template: string;
  updated_at: string;
}

/**
 * Modelo de tópico "Poemas & Livros": mural de escritos no perfil, ligado ao
 * My Notebook (importar textos de lá ou abrir o original para continuar).
 */
export function WritingDesk({
  data,
  isAdmin,
  persist,
}: {
  data: TopicWorkspaceData;
  isAdmin: boolean;
  persist: (next: TopicWorkspaceData) => void;
}) {
  const { viewer } = useNitro();
  const notebookAllowed = viewer?.role === 'admin';
  const pieces = useMemo(() => data.writings || [], [data.writings]);
  const [editing, setEditing] = useState<WritingPiece | null>(null);
  const [importOpen, setImportOpen] = useState(false);
  const [nbItems, setNbItems] = useState<NotebookRow[] | null>(null);
  const [importing, setImporting] = useState<string | null>(null);

  const save = (list: WritingPiece[]) => persist({ ...data, writings: list });

  function commit(piece: WritingPiece) {
    const clean = { ...piece, title: piece.title.trim() || 'Sem título', updatedAt: new Date().toISOString() };
    const exists = pieces.some((p) => p.id === clean.id);
    save(exists ? pieces.map((p) => (p.id === clean.id ? clean : p)) : [clean, ...pieces]);
    setEditing(null);
  }

  useEffect(() => {
    if (!importOpen || nbItems || !viewer?.id) return;
    createClient()
      .from('notebook_items')
      .select('id, title, template, updated_at')
      .eq('profile_id', viewer.id)
      .in('template', ['chapter', 'markdown', 'blocks', 'journal', 'idea'])
      .is('archived_at', null)
      .order('updated_at', { ascending: false })
      .limit(40)
      .then(({ data: rows }) => setNbItems((rows as NotebookRow[]) || []));
  }, [importOpen, nbItems, viewer?.id]);

  async function importFromNotebook(row: NotebookRow) {
    setImporting(row.id);
    const { data: full } = await createClient()
      .from('notebook_items')
      .select('id, title, template, content, data')
      .eq('id', row.id)
      .maybeSingle();
    setImporting(null);
    if (!full) return;
    const body = toPlain((full.data as { html?: string } | null)?.html || full.content);
    setImportOpen(false);
    setEditing({
      id: uid(),
      kind: full.template === 'chapter' ? 'chapter' : 'text',
      title: full.title || 'Sem título',
      body,
      notebookId: full.id,
      updatedAt: new Date().toISOString(),
    });
  }

  return (
    <div className="space-y-5">
      {/* Cabeçalho com atalhos */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-xs text-secondary max-w-md">
          Poemas, crônicas e trechos de livros. Escreva aqui ou traga do <strong>{NOTEBOOK_NAME}</strong>, onde ficam os livros completos.
        </p>
        {isAdmin && (
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => setEditing({ id: uid(), kind: 'poem', title: '', body: '', updatedAt: new Date().toISOString() })}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-accent text-white text-xs font-bold"
            >
              <Plus className="w-3.5 h-3.5" /> Novo escrito
            </button>
            {notebookAllowed ? (
              <>
                <button
                  type="button"
                  onClick={() => setImportOpen((v) => !v)}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full border border-border text-xs font-bold text-primary hover:border-accent"
                >
                  <Download className="w-3.5 h-3.5" /> Trazer do Notebook
                </button>
                <Link
                  href="/notebook"
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full border border-amber-500/40 text-xs font-bold text-amber-500 hover:bg-amber-500/10"
                >
                  <NotebookPen className="w-3.5 h-3.5" /> Escrever um livro
                </Link>
              </>
            ) : (
              <span
                title={`O ${NOTEBOOK_NAME} ainda está em testes fechados`}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full border border-border text-xs font-bold text-muted opacity-70"
              >
                <Lock className="w-3.5 h-3.5" /> {NOTEBOOK_NAME} em breve
              </span>
            )}
          </div>
        )}
      </div>

      {/* Lista do notebook para importar */}
      {importOpen && (
        <div className="rounded-xl border border-border bg-elevated/40 p-3 space-y-1.5">
          <p className="text-[11px] font-bold uppercase tracking-wider text-muted">Seus textos no {NOTEBOOK_NAME}</p>
          {!nbItems ? (
            <p className="text-xs text-muted py-2">Carregando…</p>
          ) : nbItems.length === 0 ? (
            <p className="text-xs text-muted py-2">Nenhum capítulo ou nota ainda.</p>
          ) : (
            nbItems.map((r) => (
              <button
                key={r.id}
                type="button"
                disabled={importing === r.id}
                onClick={() => importFromNotebook(r)}
                className="w-full flex items-center justify-between gap-3 px-2.5 py-2 rounded-lg hover:bg-surface text-left"
              >
                <span className="min-w-0">
                  <span className="block text-xs font-semibold text-primary truncate">{r.title || 'Sem título'}</span>
                  <span className="block text-[10px] text-muted">
                    {r.template === 'chapter' ? 'Capítulo' : 'Nota'} · {new Date(r.updated_at).toLocaleDateString('pt-BR')}
                  </span>
                </span>
                <span className="text-[11px] font-bold text-accent shrink-0">{importing === r.id ? '…' : 'Importar'}</span>
              </button>
            ))
          )}
        </div>
      )}

      {/* Editor */}
      {editing && (
        <div className="rounded-2xl border border-accent bg-surface p-4 space-y-3">
          <div className="flex flex-wrap items-center gap-2">
            {(Object.keys(KIND_LABEL) as WritingPiece['kind'][]).map((k) => (
              <button
                key={k}
                type="button"
                onClick={() => setEditing({ ...editing, kind: k })}
                className={`px-2.5 py-1 rounded-full text-[11px] font-bold border ${
                  editing.kind === k ? 'bg-accent text-white border-accent' : 'border-border text-secondary'
                }`}
              >
                {KIND_LABEL[k]}
              </button>
            ))}
          </div>
          <input
            value={editing.title}
            onChange={(e) => setEditing({ ...editing, title: e.target.value })}
            placeholder="Título"
            maxLength={120}
            className="w-full bg-transparent text-lg font-bold text-primary font-serif placeholder:text-muted focus:outline-none"
          />
          <textarea
            value={editing.body}
            onChange={(e) => setEditing({ ...editing, body: e.target.value })}
            placeholder={editing.kind === 'poem' ? 'Um verso por linha…' : 'Escreva aqui…'}
            rows={10}
            maxLength={20000}
            className="w-full bg-elevated/40 rounded-xl border border-border p-3 text-sm leading-relaxed text-primary font-serif placeholder:text-muted focus:outline-none focus:border-accent resize-y"
          />
          <div className="flex items-center justify-end gap-2">
            <button type="button" onClick={() => setEditing(null)} className="inline-flex items-center gap-1 px-3 py-1.5 rounded-full text-xs font-bold text-secondary">
              <X className="w-3.5 h-3.5" /> Cancelar
            </button>
            <button
              type="button"
              disabled={!editing.body.trim()}
              onClick={() => commit(editing)}
              className="inline-flex items-center gap-1 px-3 py-1.5 rounded-full bg-accent text-white text-xs font-bold disabled:opacity-40"
            >
              <Check className="w-3.5 h-3.5" /> Salvar
            </button>
          </div>
        </div>
      )}

      {/* Mural */}
      {pieces.length === 0 && !editing ? (
        <div className="py-12 text-center text-muted">
          <Feather className="w-6 h-6 mx-auto mb-2 text-amber-500" />
          <p className="text-xs">Nenhum escrito publicado ainda.</p>
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2">
          {pieces.map((p) => (
            <article key={p.id} className="rounded-2xl border border-border bg-gradient-to-b from-amber-500/[0.05] to-transparent p-5 flex flex-col">
              <p className="flex items-center gap-1.5 text-[10px] font-black uppercase tracking-[0.18em] text-amber-500">
                {p.kind === 'poem' ? <Feather className="w-3 h-3" /> : <BookOpen className="w-3 h-3" />} {KIND_LABEL[p.kind]}
              </p>
              <h3 className="mt-1.5 text-base font-bold text-primary font-serif">{p.title}</h3>
              <div
                className={`mt-3 text-sm text-secondary font-serif whitespace-pre-line leading-relaxed ${
                  p.kind === 'poem' ? 'italic' : 'line-clamp-[12]'
                }`}
              >
                {p.body}
              </div>
              <div className="mt-auto pt-4 flex items-center justify-between gap-2 text-[10px] text-muted">
                <span>{new Date(p.updatedAt).toLocaleDateString('pt-BR')}</span>
                <span className="flex items-center gap-1">
                  {p.notebookId && notebookAllowed && isAdmin && (
                    <Link href={`/notebook?n=${encodeURIComponent(p.notebookId)}`} title={`Abrir original no ${NOTEBOOK_NAME}`} className="p-1 rounded hover:text-amber-500">
                      <NotebookPen className="w-3.5 h-3.5" />
                    </Link>
                  )}
                  {isAdmin && (
                    <>
                      <button type="button" title="Editar" onClick={() => setEditing(p)} className="p-1 rounded hover:text-primary">
                        <Pencil className="w-3.5 h-3.5" />
                      </button>
                      <button
                        type="button"
                        title="Apagar"
                        onClick={() => window.confirm(`Apagar “${p.title}”?`) && save(pieces.filter((x) => x.id !== p.id))}
                        className="p-1 rounded hover:text-danger"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </>
                  )}
                </span>
              </div>
            </article>
          ))}
        </div>
      )}
    </div>
  );
}
