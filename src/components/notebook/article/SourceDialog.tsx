'use client';

import { ask as confirmDialog } from '@/lib/ui/feedback';
import { notify } from '@/lib/ui/feedback';
import { useEffect, useMemo, useState } from 'react';
import { Plus, Trash2, X } from 'lucide-react';
import { SOURCE_TYPES, apaReference, abntReference, sourceType, type Source, type SourceAuthor, type SourceExtra, type SourceField, type SourceType } from '@/lib/notebook/sources';
import type { SourceInput, SourcesApi } from '@/lib/notebook/useSources';
import { NbPortal } from '../history/VersionHistory';
import { RefText } from './RefText';

const EMPTY: SourceInput = {
  project_id: null,
  type: 'livro',
  authors: [{ family: '', given: '', kind: 'pessoa' }],
  title: '',
  subtitle: null,
  container: null,
  edition: null,
  place: null,
  publisher: null,
  year: null,
  month: null,
  volume: null,
  issue: null,
  pages: null,
  doi: null,
  isbn: null,
  url: null,
  accessed_on: null,
  extra: {},
  notes: '',
};

/** Cadastro e edição de uma fonte, com a referência formatada ao vivo. */
export function SourceDialog({
  source,
  initialTitle,
  projectId,
  sourcesApi,
  onClose,
  onSaved,
}: {
  source: Source | null;
  /** título já digitado (ao criar a fonte de dentro do texto) */
  initialTitle?: string;
  projectId: string | null;
  sourcesApi: SourcesApi;
  onClose: () => void;
  onSaved?: (s: Source) => void;
}) {
  const [f, setF] = useState<SourceInput>(() => (source ? { ...EMPTY, ...source, authors: source.authors.length ? source.authors : EMPTY.authors } : { ...EMPTY, project_id: projectId, title: initialTitle || '' }));
  const [quote, setQuote] = useState('');
  const [qpage, setQpage] = useState('');
  const [saving, setSaving] = useState(false);
  const def = sourceType(f.type);
  const quotes = source ? sourcesApi.quotes.filter((q) => q.source_id === source.id) : [];

  useEffect(() => {
    const k = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', k);
    return () => window.removeEventListener('keydown', k);
  }, [onClose]);

  const get = (k: SourceField): string => (k.startsWith('extra.') ? String((f.extra as Record<string, unknown>)[k.slice(6)] || '') : String((f as unknown as Record<string, unknown>)[k] || ''));
  const set = (k: SourceField, v: string) =>
    setF((p) =>
      k.startsWith('extra.')
        ? { ...p, extra: { ...p.extra, [k.slice(6) as keyof SourceExtra]: v || undefined } }
        : { ...p, [k]: v.trim() ? v : null }
    );
  const setAuthor = (i: number, patch: Partial<SourceAuthor>) => setF((p) => ({ ...p, authors: p.authors.map((a, j) => (j === i ? { ...a, ...patch } : a)) }));

  const preview = useMemo(() => ({ ...(f as Source), id: 'x', profile_id: '', created_at: '', updated_at: '', authors: f.authors.filter((a) => a.family.trim()) }), [f]);

  async function save() {
    if (!f.title.trim()) return notify('Dê um título à fonte.');
    setSaving(true);
    const clean: SourceInput = {
      ...f,
      authors: f.authors.filter((a) => a.family.trim()).map((a) => ({ family: a.family.trim(), given: (a.given || '').trim(), kind: a.kind || 'pessoa' })),
      url: f.url?.trim() ? (/^https?:\/\//i.test(f.url.trim()) ? f.url.trim() : `https://${f.url.trim()}`) : null,
    };
    let saved: Source | null = null;
    if (source) {
      await sourcesApi.update(source.id, clean);
      saved = { ...source, ...clean };
    } else saved = await sourcesApi.create(clean);
    setSaving(false);
    if (saved) {
      onSaved?.(saved);
      onClose();
    }
  }

  const input = 'w-full h-8 px-2 rounded-md bg-transparent border border-white/[0.09] focus:border-white/25 outline-none text-[13px]';
  const label = 'block mb-1 text-[11px] text-[var(--nb-ink-3)]';

  return (
    <NbPortal>
      <div className="nb-modal-back !pt-[5vh]" onClick={onClose}>
        <div className="nb-modal !max-w-2xl !max-h-[90vh]" role="dialog" aria-label={source ? 'Editar fonte' : 'Nova fonte'} onClick={(e) => e.stopPropagation()}>
          <div className="flex items-center gap-3 px-5 py-3.5 border-b border-[var(--nb-line)]">
            <p className="flex-1 text-[15px] font-semibold">{source ? 'Editar fonte' : 'Nova fonte'}</p>
            <select value={f.type} onChange={(e) => setF((p) => ({ ...p, type: e.target.value as SourceType }))} className="nb-world-select" aria-label="Tipo de fonte">
              {SOURCE_TYPES.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.label}
                </option>
              ))}
            </select>
            <button type="button" onClick={onClose} aria-label="Fechar" className="p-1 text-[var(--nb-ink-3)] hover:text-[var(--nb-ink)]">
              <X className="w-4 h-4" />
            </button>
          </div>

          <div className="nb-scroll flex-1 min-h-0 overflow-y-auto px-5 py-4 space-y-5">
            {/* autores */}
            <section>
              <span className={label}>{f.type === 'entrevista' ? 'Entrevistado' : 'Autoria'}</span>
              <div className="space-y-1.5">
                {f.authors.map((a, i) => (
                  <div key={i} className="flex items-center gap-2">
                    <input
                      value={a.family}
                      onChange={(e) => setAuthor(i, { family: e.target.value.slice(0, 200) })}
                      placeholder={a.kind === 'entidade' ? 'Nome da instituição' : 'Sobrenome'}
                      aria-label="Sobrenome"
                      className={`${input} ${a.kind === 'entidade' ? 'flex-[2]' : 'flex-1'}`}
                    />
                    {a.kind !== 'entidade' && (
                      <input value={a.given || ''} onChange={(e) => setAuthor(i, { given: e.target.value.slice(0, 200) })} placeholder="Nome" aria-label="Nome" className={`${input} flex-1`} />
                    )}
                    <label className="flex items-center gap-1 text-[11px] text-[var(--nb-ink-3)] whitespace-nowrap cursor-pointer">
                      <input type="checkbox" checked={a.kind === 'entidade'} onChange={(e) => setAuthor(i, { kind: e.target.checked ? 'entidade' : 'pessoa' })} className="accent-[var(--nb-ink-2)]" />
                      instituição
                    </label>
                    <button type="button" aria-label="Tirar autor" onClick={() => setF((p) => ({ ...p, authors: p.authors.filter((_, j) => j !== i) }))} className="p-1 text-[var(--nb-ink-3)] hover:text-red-400">
                      <X className="w-3.5 h-3.5" />
                    </button>
                  </div>
                ))}
              </div>
              <button type="button" onClick={() => setF((p) => ({ ...p, authors: [...p.authors, { family: '', given: '', kind: 'pessoa' }] }))} className="mt-1.5 flex items-center gap-1 text-[12px] text-[var(--nb-ink-3)] hover:text-[var(--nb-ink)]">
                <Plus className="w-3 h-3" /> Autor
              </button>
            </section>

            <section className="grid grid-cols-2 gap-x-3 gap-y-3">
              <label className="col-span-2">
                <span className={label}>Título</span>
                <input value={f.title} onChange={(e) => setF((p) => ({ ...p, title: e.target.value.slice(0, 500) }))} className={input} autoFocus={!source} />
              </label>
              {def.fields.map((fd) => (
                <label key={fd.key} className={fd.key === 'subtitle' || fd.key === 'container' || fd.key === 'url' || fd.key.startsWith('extra.') ? 'col-span-2' : ''}>
                  <span className={label}>{fd.label}</span>
                  <input
                    type={fd.key === 'accessed_on' ? 'date' : 'text'}
                    value={get(fd.key)}
                    onChange={(e) => set(fd.key, e.target.value)}
                    placeholder={fd.hint || ''}
                    className={input}
                  />
                </label>
              ))}
              <label className="col-span-2">
                <span className={label}>Notas de leitura</span>
                <textarea value={f.notes} onChange={(e) => setF((p) => ({ ...p, notes: e.target.value.slice(0, 10000) }))} rows={2} className={`${input} h-auto py-1.5 resize-y`} />
              </label>
            </section>

            {/* prévia */}
            <section className="border-t border-white/[0.07] pt-4 space-y-2">
              <p className="nb-world-kicker">Como fica nas referências</p>
              <p className="text-[13px] leading-relaxed">
                <span className="inline-block w-12 text-[11px] text-[var(--nb-ink-3)]">ABNT</span>
                <RefText segs={abntReference(preview)} />
              </p>
              <p className="text-[13px] leading-relaxed">
                <span className="inline-block w-12 text-[11px] text-[var(--nb-ink-3)]">APA</span>
                <RefText segs={apaReference(preview)} />
              </p>
            </section>

            {/* trechos */}
            {source && (
              <section className="border-t border-white/[0.07] pt-4">
                <p className="nb-world-kicker mb-2">Trechos salvos</p>
                <ul className="space-y-2 mb-3">
                  {quotes.map((q) => (
                    <li key={q.id} className="group flex gap-2 text-[13px] leading-relaxed">
                      <span className="flex-1 border-l border-white/15 pl-3 text-[var(--nb-ink-2)]">
                        “{q.text}”{q.page && <span className="text-[var(--nb-ink-3)]"> (p. {q.page})</span>}
                      </span>
                      <button type="button" aria-label="Apagar trecho" onClick={() => void sourcesApi.removeQuote(q.id)} className="opacity-0 group-hover:opacity-100 p-1 text-[var(--nb-ink-3)] hover:text-red-400">
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </li>
                  ))}
                </ul>
                <div className="flex gap-2">
                  <textarea value={quote} onChange={(e) => setQuote(e.target.value)} rows={2} placeholder="Cole um trecho para citar depois" className={`${input} h-auto py-1.5 flex-1 resize-y`} />
                  <input value={qpage} onChange={(e) => setQpage(e.target.value)} placeholder="pág." aria-label="Página" className={`${input} w-16`} />
                  <button
                    type="button"
                    disabled={!quote.trim()}
                    onClick={async () => {
                      await sourcesApi.addQuote(source.id, quote, qpage || null);
                      setQuote('');
                      setQpage('');
                    }}
                    className="h-8 px-3 rounded-md border border-white/15 text-[12px] font-semibold disabled:opacity-40"
                  >
                    Salvar
                  </button>
                </div>
              </section>
            )}
          </div>

          <div className="flex items-center gap-2 px-5 py-3 border-t border-[var(--nb-line)]">
            {source && (
              <button
                type="button"
                onClick={async () => {
                  if (!(await confirmDialog({ message: 'Apagar esta fonte da sua biblioteca? Ela sai de todos os artigos.', danger: true }))) return;
                  void sourcesApi.remove(source.id);
                  onClose();
                }}
                className="text-[12px] text-[var(--nb-ink-3)] hover:text-red-400"
              >
                Apagar da biblioteca
              </button>
            )}
            <div className="flex-1" />
            <button type="button" onClick={onClose} className="h-8 px-3 text-[12px] font-semibold text-[var(--nb-ink-2)] hover:text-[var(--nb-ink)]">
              Cancelar
            </button>
            <button type="button" disabled={saving} onClick={() => void save()} className="h-8 px-4 rounded-md bg-[var(--nb-ink)] text-[var(--nb-bg)] text-[12px] font-bold disabled:opacity-50">
              Salvar fonte
            </button>
          </div>
        </div>
      </div>
    </NbPortal>
  );
}
