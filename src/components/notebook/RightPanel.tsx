'use client';

import { useEffect, useMemo, useState } from 'react';
import { ListTree, Link2, Info, History, X, ArrowUpRight } from 'lucide-react';
import type { NotebookItem } from '@/lib/notebook/types';
import type { NotebookApi } from '@/lib/notebook/useNotebook';
import { extractHeadings, htmlToText, countWords } from '@/lib/notebook/markdown';
import { getTemplate } from '@/lib/notebook/templates';
import { GraphView } from './GraphView';
import { itemGlyph, itemIcon } from './FileExplorer';
import { Glyph } from './icons/Glyph';
import { ICON_CHOICES } from '@/lib/notebook/glyphs';
import { VersionHistory } from './history/VersionHistory';
import { NoteMentions } from './entries/MentionContext';
import { useNotebookLinks } from './editor/linkContext';

export type RightTab = 'outline' | 'links' | 'info' | 'history';
type Tab = RightTab;

const COLORS = ['#64748b', '#2563eb', '#7c3aed', '#db2777', '#dc2626', '#d97706', '#ca8a04', '#16a34a', '#0d9488', '#0284c7'];

interface Props {
  item: NotebookItem | null;
  api: NotebookApi;
  onOpen: (id: string) => void;
  onJump: (line: number) => void;
  onClose?: () => void;
  /** pedido externo para trocar de aba (paleta de comandos, menus) */
  tabRequest?: { tab: Tab; at: number } | null;
}

export function RightPanel({ item, api, onOpen, onJump, onClose, tabRequest }: Props) {
  const [tab, setTab] = useState<Tab>('outline');
  const links = useNotebookLinks();
  useEffect(() => {
    if (tabRequest) setTab(tabRequest.tab);
  }, [tabRequest]);

  const headings = useMemo(() => {
    if (!item) return [];
    if (item.template === 'chapter') {
      const html = String(item.data?.html || '');
      return Array.from(html.matchAll(/<h([23])[^>]*>([\s\S]*?)<\/h\1>/gi)).map((m, i) => ({
        level: Number(m[1]),
        text: htmlToText(m[2]),
        line: i,
        slug: String(i),
      }));
    }
    return extractHeadings(item.content || '');
  }, [item]);

  const backlinks = useMemo(() => {
    if (!item) return [];
    const t = item.title.toLowerCase();
    return Object.values(api.items).filter((i) => i.id !== item.id && !i.archived_at && i.links.some((l) => l.toLowerCase() === t));
  }, [api.items, item]);

  const outgoing = useMemo(() => {
    if (!item) return [];
    const byTitle = new Map(Object.values(api.items).filter((i) => !i.archived_at).map((i) => [i.title.toLowerCase(), i]));
    return item.links.map((l) => ({ title: l, target: byTitle.get(l.toLowerCase()) || null }));
  }, [api.items, item]);

  const tabs: { id: Tab; icon: React.ReactElement; label: string }[] = [
    { id: 'outline', icon: <ListTree />, label: 'Estrutura' },
    { id: 'links', icon: <Link2 />, label: `Conexões${backlinks.length ? ` · ${backlinks.length}` : ''}` },
    { id: 'info', icon: <Info />, label: 'Informações' },
    { id: 'history', icon: <History />, label: 'Histórico' },
  ];

  return (
    <div className="flex flex-col h-full min-h-0">
      <div className="flex items-center gap-0.5 px-2 pt-2 pb-1 border-b border-[var(--nb-line)]">
        {tabs.map((t) => (
          <button
            key={t.id}
            type="button"
            title={t.label}
            aria-label={t.label}
            aria-pressed={tab === t.id}
            onClick={() => setTab(t.id)}
            className={`flex-1 flex items-center justify-center h-8 rounded-lg [&>svg]:w-4 [&>svg]:h-4 ${
              tab === t.id ? 'bg-[var(--nb-hl-soft)] text-[var(--nb-hl)]' : 'text-[var(--nb-ink-3)] hover:text-[var(--nb-ink)]'
            }`}
          >
            {t.icon}
          </button>
        ))}
        {onClose && (
          <button type="button" onClick={onClose} aria-label="Fechar painel" className="p-1.5 text-[var(--nb-ink-3)]">
            <X className="w-4 h-4" />
          </button>
        )}
      </div>
      <p className="nb-pane-title px-4 pt-3 pb-1">{tabs.find((t) => t.id === tab)!.label}</p>

      <div className="nb-scroll flex-1 min-h-0 overflow-y-auto px-2 pb-4">
        {!item && <p className="px-3 py-6 text-xs text-[var(--nb-ink-3)]">Abra uma nota para ver detalhes.</p>}

        {item && tab === 'outline' && (
          <div className="py-1">
            {headings.length ? (
              headings.map((h, i) => (
                <button
                  key={`${h.slug}-${i}`}
                  type="button"
                  onClick={() => onJump(h.line)}
                  className="w-full text-left px-2 py-1 rounded-md text-[13px] text-[var(--nb-ink-2)] hover:bg-[var(--nb-pane-2)] hover:text-[var(--nb-ink)] truncate"
                  style={{ paddingLeft: 8 + (h.level - 1) * 12 }}
                >
                  {h.text}
                </button>
              ))
            ) : (
              <p className="px-2 py-4 text-xs text-[var(--nb-ink-3)]">
                {item.template === 'chapter' ? 'Use “Título de cena” para marcar cenas.' : 'Use # Títulos para montar a estrutura.'}
              </p>
            )}
          </div>
        )}

        {item && tab === 'links' && (
          <div className="space-y-4 py-1">
            <div className="h-52 rounded-xl border border-[var(--nb-line)] bg-[var(--nb-bg)] overflow-hidden">
              <GraphView items={Object.values(api.items)} activeId={item.id} onOpen={onOpen} local compact />
            </div>
            <NoteMentions item={item} api={api} entries={links.entries} onReadMore={links.readMore} />
            <LinkList
              title={`Mencionam esta nota (${backlinks.length})`}
              empty="Nenhuma nota aponta para cá ainda."
              rows={backlinks.map((b) => ({ key: b.id, icon: itemIcon(b), label: b.title, onClick: () => onOpen(b.id) }))}
            />
            <LinkList
              title={`Links desta nota (${outgoing.length})`}
              empty="Escreva [[Nome da nota]] para criar links."
              rows={outgoing.map((o, i) => ({
                key: `${o.title}-${i}`,
                icon: o.target ? itemIcon(o.target) : '＋',
                label: o.title,
                muted: !o.target,
                onClick: () => (o.target ? onOpen(o.target.id) : undefined),
              }))}
            />
          </div>
        )}

        {item && tab === 'info' && <InfoTab item={item} api={api} />}
        {item && tab === 'history' && <VersionHistory key={item.id} item={item} api={api} />}
      </div>
    </div>
  );
}

function LinkList({ title, rows, empty }: { title: string; empty: string; rows: { key: string; icon: React.ReactNode; label: string; muted?: boolean; onClick: () => void }[] }) {
  return (
    <div>
      <p className="px-2 pb-1 text-[11px] font-semibold text-[var(--nb-ink-3)]">{title}</p>
      {rows.length ? (
        rows.map((r) => (
          <button
            key={r.key}
            type="button"
            onClick={r.onClick}
            className={`w-full flex items-center gap-2 px-2 py-1.5 rounded-md text-[13px] hover:bg-[var(--nb-pane-2)] ${r.muted ? 'opacity-55' : ''}`}
          >
            <span className="w-4 text-center">{r.icon}</span>
            <span className="truncate">{r.label}</span>
          </button>
        ))
      ) : (
        <p className="px-2 text-[11px] text-[var(--nb-ink-3)]">{empty}</p>
      )}
    </div>
  );
}

function InfoTab({ item, api }: { item: NotebookItem; api: NotebookApi }) {
  const def = getTemplate(item.template);
  const text = item.template === 'chapter' ? htmlToText(String(item.data?.html || '')) : item.content || '';
  const chars = text.length;
  const words = item.word_count || countWords(text);
  const row = (k: string, v: React.ReactNode) => (
    <div className="flex justify-between gap-3 py-1.5 border-b border-[var(--nb-line)] text-[12px]">
      <span className="text-[var(--nb-ink-3)]">{k}</span>
      <span className="text-right font-medium truncate">{v}</span>
    </div>
  );
  return (
    <div className="px-2 py-1 space-y-4">
      <div>
        {row(
          'Tipo',
          <span className="inline-flex items-center gap-1.5">
            <Glyph name={def.icon} /> {def.name}
          </span>
        )}
        {item.kind === 'note' && row('Palavras', words.toLocaleString('pt-BR'))}
        {item.kind === 'note' && row('Caracteres', chars.toLocaleString('pt-BR'))}
        {item.kind === 'note' && row('Leitura', `${Math.max(1, Math.round(words / 220))} min`)}
        {row('Criado', new Date(item.created_at).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' }))}
        {row('Editado', new Date(item.updated_at).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' }))}
        {item.published_post_id &&
          row(
            'Publicado',
            <a href={`/post/${item.published_post_id}`} target="_blank" className="inline-flex items-center gap-1 text-[var(--nb-hl)]">
              ver post <ArrowUpRight className="w-3 h-3" />
            </a>
          )}
      </div>
      {item.tags.length > 0 && (
        <div className="flex flex-wrap gap-1">
          {item.tags.map((t) => (
            <span key={t} className="nb-tag !text-[11px]">
              #{t}
            </span>
          ))}
        </div>
      )}
      <div>
        <p className="nb-pane-title mb-2">Ícone</p>
        <div className="grid grid-cols-8 gap-1">
          {ICON_CHOICES.map((ic) => (
            <button
              key={ic}
              type="button"
              title={ic}
              aria-label={`Ícone ${ic}`}
              aria-pressed={itemGlyph(item) === ic}
              onClick={() => api.update(item.id, { icon: ic })}
              className={`h-8 grid place-items-center rounded-lg text-[17px] text-[var(--nb-ink-2)] hover:text-[var(--nb-ink)] hover:bg-[var(--nb-pane-2)] ${
                itemGlyph(item) === ic ? 'bg-[var(--nb-hl-soft)] text-[var(--nb-hl)] ring-1 ring-[var(--nb-hl)]' : ''
              }`}
            >
              <Glyph name={ic} />
            </button>
          ))}
        </div>
      </div>
      <div>
        <p className="nb-pane-title mb-2">Cor do nome</p>
        <div className="flex flex-wrap gap-1.5">
          <button
            type="button"
            onClick={() => api.update(item.id, { color: null })}
            className={`w-6 h-6 rounded-full border border-[var(--nb-line)] text-[10px] ${!item.color ? 'ring-2 ring-[var(--nb-hl)]' : ''}`}
            aria-label="Sem cor"
          >
            ∅
          </button>
          {COLORS.map((c) => (
            <button
              key={c}
              type="button"
              aria-label={`Cor ${c}`}
              onClick={() => api.update(item.id, { color: c })}
              className={`w-6 h-6 rounded-full ${item.color === c ? 'ring-2 ring-offset-2 ring-offset-[var(--nb-pane)] ring-[var(--nb-hl)]' : ''}`}
              style={{ background: c }}
            />
          ))}
        </div>
      </div>
      {item.kind === 'note' && (
        <label className="flex items-center justify-between gap-3 text-[12px] cursor-pointer">
          <span>
            <b className="block">Usar como modelo</b>
            <span className="text-[var(--nb-ink-3)]">aparece em “Novo a partir de modelo”</span>
          </span>
          <input type="checkbox" checked={item.is_template} onChange={(e) => api.update(item.id, { is_template: e.target.checked })} className="w-4 h-4 accent-[var(--nb-hl)]" />
        </label>
      )}
    </div>
  );
}
