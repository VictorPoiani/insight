'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { Columns2, Lock, MoreHorizontal, Trash2 } from 'lucide-react';
import type { NotebookItem } from '@/lib/notebook/types';
import { codexData, type CodexCategory, type CodexData, type CodexValue } from '@/lib/notebook/codex';
import type { NotebookEntry } from '@/lib/notebook/entries';
import { useWorld } from './WorldContext';
import { Infobox } from './Infobox';
import { EntryAppearances } from '../entries/MentionContext';
import { useNotebookMenu } from '../menu/ContextMenu';
import { itemIcon } from '../FileExplorer';

const WORLD_TEMPLATES = new Set(['map', 'timeline', 'calendar', 'mindmap']);

/** Página de um verbete: texto à esquerda, Infobox à direita, aparições embaixo. */
export function CodexArticle({
  item,
  entry,
  project,
  cats,
  body,
  onCat,
  onEditCat,
}: {
  item: NotebookItem;
  entry: NotebookEntry;
  project: NotebookItem;
  cats: CodexCategory[];
  body?: React.ReactNode;
  onCat: (id: string | null) => void;
  onEditCat: (id: string) => void;
}) {
  const w = useWorld();
  const menu = useNotebookMenu();
  const cx: CodexData = codexData(item.data) || { entry: entry.id, infobox: {} };
  const cat = entry.codex_category_id ? w.codex.cats[entry.codex_category_id] : null;
  const parent = cat?.parent_id ? w.codex.cats[cat.parent_id] : null;
  // subcategoria sem campos próprios usa os da categoria de cima
  const fields = cat?.fields?.length ? cat.fields : parent?.fields || [];

  const [title, setTitle] = useState(entry.title);
  const [summary, setSummary] = useState(entry.summary);
  const focusRef = useRef<string | null>(null);
  useEffect(() => {
    if (focusRef.current !== 'title') setTitle(entry.title);
  }, [entry.title]);
  useEffect(() => {
    if (focusRef.current !== 'summary') setSummary(entry.summary);
  }, [entry.summary]);

  // grava a menção com calma (o texto da nota tem o próprio salvamento)
  const timer = useRef<number | null>(null);
  const pending = useRef<Partial<NotebookEntry>>({});
  const saveEntry = (patch: Partial<Pick<NotebookEntry, 'title' | 'summary'>>) => {
    pending.current = { ...pending.current, ...patch };
    if (timer.current) window.clearTimeout(timer.current);
    timer.current = window.setTimeout(() => {
      const p = pending.current;
      pending.current = {};
      void w.entriesApi.update(entry.id, p);
    }, 700);
  };
  useEffect(
    () => () => {
      if (timer.current && Object.keys(pending.current).length) void w.entriesApi.update(entry.id, pending.current);
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [entry.id]
  );

  const live = w.api.items[item.id] || item;
  const saveCodex = (next: CodexData, debounce = 500) => w.api.update(item.id, { data: { ...live.data, codex: next } }, { debounce });
  const setValue = (key: string, v: CodexValue | null) => {
    const infobox = { ...cx.infobox };
    if (v) infobox[key] = v;
    else delete infobox[key];
    saveCodex({ ...cx, entry: entry.id, infobox });
  };

  const usedIn = useMemo(
    () => Object.values(w.api.items).filter((i) => !i.archived_at && i.id !== item.id && (i.entry_refs || []).includes(entry.id)),
    [w.api.items, item.id, entry.id]
  );
  const inWorld = usedIn.filter((i) => WORLD_TEMPLATES.has(i.template));
  const inText = usedIn.filter((i) => !WORLD_TEMPLATES.has(i.template));

  const moreMenu = (e: React.MouseEvent) =>
    menu.open(
      e,
      [
        { label: 'Abrir ao lado', icon: <Columns2 className="w-3.5 h-3.5" />, run: () => w.openAside(item.id) },
        { label: 'Ver no Sumário', run: () => w.openSummary(project.id, entry.id) },
        'sep',
        {
          label: 'Apagar verbete',
          icon: <Trash2 className="w-3.5 h-3.5" />,
          danger: true,
          run: () => {
            const n = inText.length + inWorld.length;
            if (confirm(n ? `“${entry.title}” é citado em ${n} ${n === 1 ? 'lugar' : 'lugares'}. Os trechos continuam, sem o balão. Apagar o verbete?` : `Apagar o verbete “${entry.title}”?`)) {
              void w.removeVerbete(entry).then(() => onCat(entry.codex_category_id ?? null));
            }
          },
        },
      ],
      entry.title
    );

  return (
    <article className="nb-art" data-secret={entry.is_secret ? 'entry' : undefined}>
      <div className="nb-art-crumbs">
        <button type="button" onClick={() => onCat(null)}>
          Codex
        </button>
        {parent && (
          <>
            <span>/</span>
            <button type="button" onClick={() => onCat(parent.id)}>
              {parent.name}
            </button>
          </>
        )}
        {cat && (
          <>
            <span>/</span>
            <button type="button" onClick={() => onCat(cat.id)}>
              {cat.name}
            </button>
          </>
        )}
        <select
          value={entry.codex_category_id || ''}
          onChange={(e) => {
            const c = e.target.value ? w.codex.cats[e.target.value] : null;
            void w.entriesApi.update(entry.id, { codex_category_id: c?.id ?? null, ...(c ? { category: c.kind } : {}) });
          }}
          aria-label="Mover para a categoria"
          title="Mover para outra categoria"
          className="nb-art-move"
        >
          <option value="">sem categoria</option>
          {cats.map((c) => (
            <option key={c.id} value={c.id}>
              {c.parent_id ? `   ${c.name}` : c.name}
            </option>
          ))}
        </select>
        <span className="flex-1" />
        <button type="button" onClick={moreMenu} aria-label="Mais ações do verbete" className="nb-art-more">
          <MoreHorizontal className="w-4 h-4" />
        </button>
      </div>

      <header className="nb-art-head">
      {entry.is_secret && (
        <p className="nb-art-secret">
          <Lock className="w-3 h-3" /> Verbete secreto: não aparece em publicações
        </p>
      )}
      <input
        value={title}
        onFocus={() => (focusRef.current = 'title')}
        onBlur={() => (focusRef.current = null)}
        onChange={(e) => {
          const v = e.target.value.slice(0, 160);
          setTitle(v);
          if (v.trim()) {
            saveEntry({ title: v.trim() });
            w.api.update(item.id, { title: v.trim().slice(0, 200) }, { debounce: 700 });
          }
        }}
        aria-label="Nome do verbete"
        placeholder="Nome do verbete"
        className="nb-art-title"
      />
      <textarea
        value={summary}
        rows={1}
        onFocus={() => (focusRef.current = 'summary')}
        onBlur={() => (focusRef.current = null)}
        onChange={(e) => {
          const v = e.target.value.replace(/\n/g, ' ').slice(0, 300);
          setSummary(v);
          saveEntry({ summary: v });
        }}
        ref={(el) => {
          if (!el) return;
          el.style.height = 'auto';
          el.style.height = `${el.scrollHeight}px`;
        }}
        aria-label="Resumo"
        placeholder="Resumo em uma frase. É o que aparece ao passar o mouse sobre a menção."
        className="nb-art-summary"
      />
      </header>

      <div className="nb-art-grid">
        <div className="min-w-0">
          <div className="nb-art-body">{body}</div>

          <section className="nb-art-section">
            <h3 className="nb-world-h3">Aparições</h3>
            {inText.length === 0 && <p className="mb-3 text-[13px] text-[var(--nb-ink-3)]">Ainda não citado em nenhum texto. Digite + num capítulo ou nota para mencionar “{entry.title}”.</p>}
            <EntryAppearances entry={entry} usedIn={inText} api={w.api} onOpen={w.open} />
          </section>
        </div>

        <div className="nb-art-side">
          <Infobox
            entry={{ ...entry, title: title || entry.title }}
            fields={fields}
            values={cx.infobox}
            caption={cx.caption || ''}
            onValue={setValue}
            onCaption={(c) => saveCodex({ ...cx, entry: entry.id, caption: c }, 700)}
            onImage={async (f) => {
              if (!f) return void w.entriesApi.update(entry.id, { image_url: null });
              const url = await w.uploadImage(f);
              if (url) await w.entriesApi.update(entry.id, { image_url: url });
            }}
            onFields={() => cat && onEditCat(cat.parent_id && !cat.fields.length ? cat.parent_id : cat.id)}
            onSecretEntry={(v) => void w.entriesApi.update(entry.id, { is_secret: v })}
            onOpenEntry={(id) => {
              const e = w.entriesApi.entries[id];
              if (e) w.readMore(e);
            }}
          />
          {inWorld.length > 0 && (
            <div className="nb-art-inworld">
              <p className="nb-world-kicker mb-1.5">No mundo</p>
              <ul>
                {inWorld.map((i) => (
                  <li key={i.id}>
                    <button type="button" data-item-id={i.id} onClick={() => w.open(i.id)}>
                      <span className="text-[12px] text-[var(--nb-ink-3)]">{itemIcon(i)}</span>
                      <span className="truncate">{i.title}</span>
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      </div>
    </article>
  );
}
