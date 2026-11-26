'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { ArrowDown, ArrowUp, ImagePlus, Loader2, Lock, LockOpen, Plus, Trash2, X } from 'lucide-react';
import { FIELD_TYPES, slugKey, type CodexCategory, type CodexField, type CodexValue } from '@/lib/notebook/codex';
import { ENTRY_CATEGORIES, type NotebookEntry } from '@/lib/notebook/entries';
import { useNotebookLinks } from '../editor/linkContext';
import { NbPortal } from '../history/VersionHistory';
import { Glyph } from '../icons/Glyph';
import type { GlyphName } from '@/lib/notebook/glyphs';

const norm = (s: string) =>
  s
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '');

// ============================================================================
// Infobox do verbete
// ============================================================================

export function Infobox({
  entry,
  fields,
  values,
  caption,
  onValue,
  onCaption,
  onImage,
  onFields,
  onSecretEntry,
  onOpenEntry,
}: {
  entry: NotebookEntry;
  fields: CodexField[];
  values: Record<string, CodexValue>;
  caption: string;
  onValue: (key: string, v: CodexValue | null) => void;
  onCaption: (c: string) => void;
  onImage: (f: File | null) => Promise<void>;
  onFields: () => void;
  onSecretEntry: (v: boolean) => void;
  onOpenEntry: (id: string) => void;
}) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);

  return (
    <aside className="nb-ibx" aria-label="Infobox">
      <p className="nb-ibx-name">{entry.title}</p>
      <figure className="nb-ibx-fig">
        {entry.image_url ? (
          <div className="relative group">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={entry.image_url} alt={caption || entry.title} />
            <div className="absolute top-2 right-2 flex gap-1 opacity-0 group-hover:opacity-100 focus-within:opacity-100">
              <button type="button" className="nb-ibx-imgbtn" onClick={() => fileRef.current?.click()} aria-label="Trocar imagem">
                <ImagePlus />
              </button>
              <button type="button" className="nb-ibx-imgbtn" onClick={() => void onImage(null)} aria-label="Tirar imagem">
                <X />
              </button>
            </div>
          </div>
        ) : (
          <button type="button" className="nb-ibx-noimg" onClick={() => fileRef.current?.click()}>
            {uploading ? <Loader2 className="w-4 h-4 animate-spin" /> : <ImagePlus className="w-4 h-4" />}
            <span>Imagem</span>
          </button>
        )}
        <input
          value={caption}
          onChange={(e) => onCaption(e.target.value.slice(0, 160))}
          placeholder="Legenda"
          aria-label="Legenda da imagem"
          className="nb-ibx-caption"
        />
        <input
          ref={fileRef}
          type="file"
          accept="image/*"
          hidden
          onChange={async (e) => {
            const f = e.target.files?.[0];
            e.target.value = '';
            if (!f) return;
            setUploading(true);
            await onImage(f);
            setUploading(false);
          }}
        />
      </figure>

      {fields.length ? (
        <table className="nb-ibx-table">
          <tbody>
            {fields.map((fd) => {
              const v = values[fd.key];
              return (
                <tr key={fd.key} data-secret={v?.secret ? 'true' : undefined} className="group">
                  <th scope="row">
                    {v?.secret && <Lock className="inline w-2.5 h-2.5 mr-1 -mt-0.5" aria-label="segredo" />}
                    {fd.label}
                  </th>
                  <td>
                    <ValueEditor field={fd} value={v} onChange={(nv) => onValue(fd.key, nv)} onOpenEntry={onOpenEntry} />
                  </td>
                  <td className="nb-ibx-lock">
                    <button
                      type="button"
                      title={v?.secret ? 'Deixar de ser segredo' : 'Marcar como segredo do autor'}
                      aria-label={v?.secret ? 'Deixar de ser segredo' : 'Marcar como segredo do autor'}
                      aria-pressed={!!v?.secret}
                      onClick={() => onValue(fd.key, { ...(v || {}), secret: !v?.secret })}
                    >
                      {v?.secret ? <Lock /> : <LockOpen />}
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      ) : (
        <p className="px-3 py-4 text-[12px] text-[var(--nb-ink-3)]">Esta categoria ainda não tem campos.</p>
      )}

      <div className="nb-ibx-foot">
        <button type="button" onClick={onFields}>
          Campos da categoria
        </button>
        <label className="flex items-center gap-1.5 cursor-pointer">
          <input type="checkbox" checked={!!entry.is_secret} onChange={(e) => onSecretEntry(e.target.checked)} className="accent-[var(--nb-ink-2)]" />
          Verbete secreto
        </label>
      </div>
    </aside>
  );
}

function ValueEditor({ field, value, onChange, onOpenEntry }: { field: CodexField; value?: CodexValue; onChange: (v: CodexValue | null) => void; onOpenEntry: (id: string) => void }) {
  const secret = value?.secret ? { secret: true } : {};
  const setText = (t: string) => onChange(t || value?.secret ? { text: t, ...secret } : null);

  if (field.type === 'entry' || field.type === 'entries') {
    const refs = value?.refs || [];
    return (
      <RefList
        refs={refs.map((r) => r.entryId)}
        multi={field.type === 'entries'}
        label={field.label}
        onOpen={onOpenEntry}
        onChange={(ids) => onChange(ids.length || value?.secret ? { refs: ids.map((entryId) => ({ entryId })), ...secret } : null)}
      />
    );
  }
  if (field.type === 'select' || field.type === 'status') {
    const opts = field.options || [];
    const cur = value?.text || '';
    return (
      <select value={cur} onChange={(e) => setText(e.target.value)} aria-label={field.label} className="nb-ibx-input nb-ibx-select" data-empty={!cur || undefined}>
        <option value="">—</option>
        {cur && !opts.includes(cur) && <option value={cur}>{cur}</option>}
        {opts.map((o) => (
          <option key={o} value={o}>
            {o}
          </option>
        ))}
      </select>
    );
  }
  if (field.type === 'long') return <LongInput value={value?.text || ''} label={field.label} onChange={setText} />;
  return (
    <input
      value={value?.text || ''}
      onChange={(e) => setText(field.type === 'number' ? e.target.value.replace(/[^\d.,\s-]/g, '') : e.target.value.slice(0, 200))}
      inputMode={field.type === 'number' ? 'decimal' : undefined}
      placeholder="—"
      aria-label={field.label}
      className="nb-ibx-input"
    />
  );
}

function LongInput({ value, label, onChange }: { value: string; label: string; onChange: (v: string) => void }) {
  const ref = useRef<HTMLTextAreaElement>(null);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    el.style.height = 'auto';
    el.style.height = `${el.scrollHeight}px`;
  }, [value]);
  return <textarea ref={ref} rows={1} value={value} onChange={(e) => onChange(e.target.value.slice(0, 1200))} placeholder="—" aria-label={label} className="nb-ibx-input resize-none" />;
}

/** Lista de verbetes ligados, com busca para adicionar. */
export function RefList({ refs, multi, label, onChange, onOpen }: { refs: string[]; multi: boolean; label: string; onChange: (ids: string[]) => void; onOpen: (id: string) => void }) {
  const links = useNotebookLinks();
  const [adding, setAdding] = useState(false);
  const [q, setQ] = useState('');
  const [sel, setSel] = useState(0);
  const boxRef = useRef<HTMLDivElement>(null);

  const results = useMemo(() => {
    const t = norm(q.trim());
    return Object.values(links.entries)
      .filter((e) => e.kind === 'elemento' && !refs.includes(e.id))
      .filter((e) => !t || norm(e.title).includes(t) || e.aliases.some((a) => norm(a).includes(t)))
      .sort((a, b) => a.title.localeCompare(b.title, 'pt-BR'))
      .slice(0, 8);
  }, [links.entries, q, refs]);

  useEffect(() => {
    if (!adding) return;
    const close = (e: MouseEvent) => !boxRef.current?.contains(e.target as Node) && (setAdding(false), setQ(''));
    window.addEventListener('mousedown', close);
    return () => window.removeEventListener('mousedown', close);
  }, [adding]);

  const add = (id: string) => {
    onChange(multi ? [...refs, id] : [id]);
    setQ('');
    setSel(0);
    if (!multi) setAdding(false);
  };
  const create = async () => {
    const r = await links.requestEntry(q.trim() || label);
    if (r) add(r.id);
  };
  const canAdd = multi || !refs.length;

  return (
    <div ref={boxRef} className="relative flex flex-wrap items-center gap-x-1 gap-y-0.5 min-h-[24px]">
      {refs.map((id, i) => {
        const e = links.entries[id];
        if (!e) return null;
        return (
          <span key={id} className="nb-ibx-ref-wrap">
            <button type="button" data-ref={id} className="nb-ibx-ref" onClick={() => onOpen(id)}>
              {e.title}
            </button>
            {i < refs.length - 1 && <span className="text-[var(--nb-ink-3)]">,</span>}
            <button type="button" aria-label={`Tirar ${e.title}`} className="nb-ibx-x" onClick={() => onChange(refs.filter((x) => x !== id))}>
              <X />
            </button>
          </span>
        );
      })}
      {!refs.length && !adding && <span className="text-[var(--nb-ink-3)]">—</span>}
      {canAdd && !adding && (
        <button type="button" className="nb-ibx-add" onClick={() => setAdding(true)} aria-label={`Ligar ${label}`}>
          <Plus />
        </button>
      )}
      {adding && (
        <div className="nb-ibx-pick">
          <input
            autoFocus
            value={q}
            onChange={(e) => (setQ(e.target.value), setSel(0))}
            onKeyDown={(e) => {
              if (e.key === 'ArrowDown') (e.preventDefault(), setSel((s) => Math.min(results.length, s + 1)));
              if (e.key === 'ArrowUp') (e.preventDefault(), setSel((s) => Math.max(0, s - 1)));
              if (e.key === 'Enter') {
                e.preventDefault();
                if (results[sel]) add(results[sel].id);
                else void create();
              }
              if (e.key === 'Escape') (setAdding(false), setQ(''));
            }}
            placeholder="Buscar verbete…"
            aria-label={`Buscar verbete para ${label}`}
          />
          <div role="listbox">
            {results.map((e, i) => (
              <button key={e.id} type="button" role="option" aria-selected={i === sel} onMouseEnter={() => setSel(i)} onClick={() => add(e.id)}>
                {e.title}
              </button>
            ))}
            <button type="button" role="option" aria-selected={sel === results.length} onMouseEnter={() => setSel(results.length)} onClick={() => void create()} className="nb-ibx-pick-new">
              <Plus className="w-3 h-3" /> {q.trim() ? `Criar “${q.trim().slice(0, 30)}”` : 'Criar menção'}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

// ============================================================================
// Campos da categoria (modelo da Infobox)
// ============================================================================

const CATEGORY_GLYPHS: GlyphName[] = ['world', 'castle', 'crown', 'sparkle', 'feather', 'moon', 'gem', 'tree', 'briefcase', 'book', 'flame', 'mountain', 'anchor', 'skull', 'character', 'timeline'];

export function CategoryDialog({
  category,
  onSave,
  onDelete,
  onClose,
}: {
  category: CodexCategory;
  onSave: (patch: Partial<Pick<CodexCategory, 'name' | 'glyph' | 'kind' | 'fields'>>) => void;
  onDelete: () => void;
  onClose: () => void;
}) {
  const [name, setName] = useState(category.name);
  const [glyph, setGlyph] = useState<GlyphName>(category.glyph);
  const [kind, setKind] = useState(category.kind);
  const [fields, setFields] = useState<CodexField[]>(category.fields);

  useEffect(() => {
    const k = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', k);
    return () => window.removeEventListener('keydown', k);
  }, [onClose]);

  const setField = (i: number, patch: Partial<CodexField>) => setFields((fs) => fs.map((f, j) => (j === i ? { ...f, ...patch } : f)));
  const move = (i: number, d: -1 | 1) =>
    setFields((fs) => {
      const n = [...fs];
      const j = i + d;
      if (j < 0 || j >= n.length) return fs;
      [n[i], n[j]] = [n[j], n[i]];
      return n;
    });

  function save() {
    // chaves estáveis: campo novo ganha chave do rótulo, sem repetir
    const used = new Set<string>();
    const clean = fields
      .filter((f) => f.label.trim())
      .map((f) => {
        let key = f.key || slugKey(f.label);
        while (used.has(key)) key = `${key}_2`;
        used.add(key);
        const opts = f.type === 'select' || f.type === 'status' ? (f.options || []).map((o) => o.trim()).filter(Boolean).slice(0, 30) : undefined;
        return { key, label: f.label.trim().slice(0, 40), type: f.type, ...(opts ? { options: opts } : {}) };
      });
    onSave({ name: name.trim() || category.name, glyph, kind, fields: clean });
    onClose();
  }

  return (
    <NbPortal>
      <div className="nb-modal-back" onClick={onClose}>
        <div className="nb-modal !max-w-2xl" role="dialog" aria-label="Categoria do Codex" onClick={(e) => e.stopPropagation()}>
          <div className="px-5 pt-5 pb-4 border-b border-[var(--nb-line)] space-y-3">
            <p className="nb-world-kicker">Categoria do Codex</p>
            <input value={name} onChange={(e) => setName(e.target.value.slice(0, 60))} aria-label="Nome da categoria" className="w-full bg-transparent outline-none nb-world-serif text-[24px]" />
            <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-[12px] text-[var(--nb-ink-3)]">
              <span className="flex items-center gap-1">
                {CATEGORY_GLYPHS.map((g) => (
                  <button
                    key={g}
                    type="button"
                    aria-label={`Ícone ${g}`}
                    aria-pressed={glyph === g}
                    onClick={() => setGlyph(g)}
                    className={`w-7 h-7 grid place-items-center rounded-md text-[15px] ${glyph === g ? 'text-[var(--nb-ink)] bg-white/[0.06]' : 'hover:text-[var(--nb-ink)]'}`}
                  >
                    <Glyph name={g} />
                  </button>
                ))}
              </span>
              <label className="flex items-center gap-2">
                Menções desta categoria contam como
                <select value={kind} onChange={(e) => setKind(e.target.value as CodexCategory['kind'])} className="nb-world-select">
                  {ENTRY_CATEGORIES.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.label}
                    </option>
                  ))}
                </select>
              </label>
            </div>
          </div>

          <div className="nb-scroll flex-1 min-h-0 overflow-y-auto px-5 py-4">
            <p className="nb-world-kicker mb-2">Campos da Infobox</p>
            <ol className="divide-y divide-white/[0.06] border-y border-white/[0.06]">
              {fields.map((f, i) => (
                <li key={i} className="flex flex-wrap items-center gap-2 py-2">
                  <span className="w-5 text-right font-mono text-[11px] text-[var(--nb-ink-3)]">{i + 1}</span>
                  <input
                    value={f.label}
                    onChange={(e) => setField(i, { label: e.target.value })}
                    placeholder="Nome do campo"
                    aria-label="Nome do campo"
                    className="flex-1 min-w-[140px] h-8 px-2 rounded-md bg-transparent border border-white/[0.08] focus:border-white/25 outline-none text-[13px]"
                  />
                  <select value={f.type} onChange={(e) => setField(i, { type: e.target.value as CodexField['type'] })} aria-label="Tipo do campo" className="nb-world-select">
                    {FIELD_TYPES.map((t) => (
                      <option key={t.id} value={t.id}>
                        {t.label}
                      </option>
                    ))}
                  </select>
                  <button type="button" aria-label="Subir" onClick={() => move(i, -1)} className="p-1 text-[var(--nb-ink-3)] hover:text-[var(--nb-ink)]">
                    <ArrowUp className="w-3.5 h-3.5" />
                  </button>
                  <button type="button" aria-label="Descer" onClick={() => move(i, 1)} className="p-1 text-[var(--nb-ink-3)] hover:text-[var(--nb-ink)]">
                    <ArrowDown className="w-3.5 h-3.5" />
                  </button>
                  <button type="button" aria-label="Tirar campo" onClick={() => setFields((fs) => fs.filter((_, j) => j !== i))} className="p-1 text-[var(--nb-ink-3)] hover:text-red-400">
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                  {(f.type === 'select' || f.type === 'status') && (
                    <input
                      value={(f.options || []).join(', ')}
                      onChange={(e) => setField(i, { options: e.target.value.split(',').map((o) => o.trimStart()) })}
                      placeholder="Opções separadas por vírgula"
                      aria-label="Opções"
                      className="basis-full ml-7 h-7 px-2 rounded-md bg-transparent border border-white/[0.06] focus:border-white/20 outline-none text-[12px] text-[var(--nb-ink-2)]"
                    />
                  )}
                </li>
              ))}
            </ol>
            <button
              type="button"
              onClick={() => setFields((fs) => [...fs, { key: '', label: '', type: 'text' }])}
              className="mt-3 flex items-center gap-1.5 text-[12px] font-semibold text-[var(--nb-ink-2)] hover:text-[var(--nb-ink)]"
            >
              <Plus className="w-3.5 h-3.5" /> Adicionar campo
            </button>
            <p className="mt-3 text-[11px] text-[var(--nb-ink-3)]">Mudar o tipo de um campo não apaga o que já foi preenchido nos verbetes.</p>
          </div>

          <div className="flex items-center gap-2 px-5 py-3 border-t border-[var(--nb-line)]">
            <button
              type="button"
              onClick={() => {
                if (confirm(`Apagar a categoria “${category.name}”? Os verbetes continuam, sem categoria.`)) {
                  onDelete();
                  onClose();
                }
              }}
              className="text-[12px] text-[var(--nb-ink-3)] hover:text-red-400"
            >
              Apagar categoria
            </button>
            <div className="flex-1" />
            <button type="button" onClick={onClose} className="h-8 px-3 rounded-md text-[12px] font-semibold text-[var(--nb-ink-2)] hover:text-[var(--nb-ink)]">
              Cancelar
            </button>
            <button type="button" onClick={save} className="h-8 px-4 rounded-md bg-[var(--nb-ink)] text-[var(--nb-bg)] text-[12px] font-bold">
              Salvar
            </button>
          </div>
        </div>
      </div>
    </NbPortal>
  );
}
