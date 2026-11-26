'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { BookMarked, Copy, ListTree, MoreHorizontal, PanelRight, Pencil, Plus, Search, Sparkles, Trash2, X } from 'lucide-react';
import type { NotebookItem } from '@/lib/notebook/types';
import type { NotebookApi } from '@/lib/notebook/useNotebook';
import { NORMS, articleData, countWords, preWarnings, splitKeywords, type ArticleData } from '@/lib/notebook/article';
import { formatCitation, formatReference, readability, shortLabel, sortReferences, type CitationNorm, type Source } from '@/lib/notebook/sources';
import { useSources } from '@/lib/notebook/useSources';
import { mdToText } from '@/lib/notebook/diff';
import { useNotebookLinks } from '../editor/linkContext';
import { useWorld } from '../world/WorldContext';
import { useNotebookMenu } from '../menu/ContextMenu';
import { projectOf } from '../entries/MentionContext';
import { EntryAvatar } from '../entries/MentionViews';
import { SourceDialog } from './SourceDialog';
import { RefText } from './RefText';
import { CitationContext, insertCitation, type CitationTools } from '../editor/academic';
import type { Editor } from '@tiptap/core';
import 'katex/dist/katex.min.css';
import { ArticleSheet } from './ArticleSheet';
import { exportArticleDocx, exportArticleMarkdown } from './exportArticle';
import { Download, FileText, PenLine } from 'lucide-react';

type Heading = { el: HTMLElement; level: number; text: string; num: string };
type Caption = { kind: 'figura' | 'tabela' | 'quadro' | 'grafico'; text: string; el: HTMLElement };
type PanelTab = 'fontes' | 'trechos' | 'sumario';

const PANELS_KEY = 'insight-notebook-article-panels';
const norm = (s: string) =>
  s
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '');

/**
 * Modo Artigo: estrutura numerada à esquerda, a folha no centro (elementos
 * pré-textuais, texto e referências) e fontes/trechos/sumário à direita.
 */
export function ArticleMode({ item, api, body }: { item: NotebookItem; api: NotebookApi; body: React.ReactNode }) {
  const w = useWorld();
  const links = useNotebookLinks();
  const menu = useNotebookMenu();
  const sourcesApi = useSources(item.profile_id);
  const live = api.items[item.id] || item;
  const a = articleData(live.data);
  const projectId = projectOf(api.items, live);

  const [panels, setPanels] = useState<{ outline: boolean; side: boolean }>(() => {
    try {
      return { outline: true, side: true, ...JSON.parse(localStorage.getItem(PANELS_KEY) || '{}') };
    } catch {
      return { outline: true, side: true };
    }
  });
  useEffect(() => {
    try {
      localStorage.setItem(PANELS_KEY, JSON.stringify(panels));
    } catch {
      /* ignora */
    }
  }, [panels]);
  const [tab, setTab] = useState<PanelTab>('fontes');
  const [view, setView] = useState<'escrita' | 'folha'>('escrita');
  const [exporting, setExporting] = useState(false);
  const [dialog, setDialog] = useState<{ source: Source | null; title?: string } | null>(null);
  const [title, setTitle] = useState(live.title);
  useEffect(() => setTitle(live.title), [live.title]);

  const save = (patch: Partial<ArticleData>, debounce = 500) => {
    const cur = api.items[item.id] || item;
    api.update(item.id, { data: { ...(cur.data || {}), article: { ...articleData(cur.data), ...patch } } }, { debounce });
  };
  const savePre = (patch: Partial<ArticleData['pre']>) => save({ pre: { ...a.pre, ...patch } }, 700);

  // ------------------------------------------------------------ estrutura (a partir do editor)
  const paperRef = useRef<HTMLDivElement>(null);
  const [heads, setHeads] = useState<Heading[]>([]);
  const [caps, setCaps] = useState<Caption[]>([]);
  const [top, setTop] = useState<1 | 2>(2);
  const [notes, setNotes] = useState<{ text: string; el: HTMLElement }[]>([]);
  useEffect(() => {
    const root = paperRef.current;
    if (!root) return;
    let t: number | null = null;
    const scan = () => {
      const doc = root.querySelector('.ProseMirror');
      if (!doc) return;
      const hs = Array.from(doc.querySelectorAll('h1, h2, h3, h4')) as HTMLElement[];
      const topLevel = hs.some((h) => h.tagName === 'H1') ? 1 : 2;
      const count = [0, 0, 0];
      const out: Heading[] = [];
      for (const h of hs) {
        const lv = Math.min(3, Math.max(1, Number(h.tagName[1]) - topLevel + 1));
        count[lv - 1]++;
        for (let k = lv; k < 3; k++) count[k] = 0;
        out.push({ el: h, level: lv, text: (h.textContent || '').trim(), num: count.slice(0, lv).join('.') });
      }
      setTop(topLevel as 1 | 2);
      setHeads(out);
      const c: Caption[] = [];
      doc.querySelectorAll('figure, p[data-caption]').forEach((el) => {
        if (el.tagName === 'FIGURE') return void c.push({ kind: 'figura', text: (el.querySelector('figcaption')?.textContent || '').trim(), el: el as HTMLElement });
        const k = el.getAttribute('data-caption');
        if (k === 'figura' || k === 'tabela' || k === 'quadro' || k === 'grafico') c.push({ kind: k, text: (el.textContent || '').trim(), el: el as HTMLElement });
      });
      setCaps(c);
      setNotes(Array.from(doc.querySelectorAll('sup[data-fn]')).map((el) => ({ text: el.getAttribute('data-fn') || '', el: el as HTMLElement })));
    };
    const later = () => {
      if (t) window.clearTimeout(t);
      t = window.setTimeout(scan, 250);
    };
    scan();
    const mo = new MutationObserver(later);
    mo.observe(root, { childList: true, subtree: true, characterData: true });
    return () => {
      mo.disconnect();
      if (t) window.clearTimeout(t);
    };
  }, [item.id]);

  const go = (el: HTMLElement) => {
    el.scrollIntoView({ block: 'start', behavior: 'smooth' });
    el.classList.add('nb-flash');
    setTimeout(() => el.classList.remove('nb-flash'), 1200);
  };

  // ------------------------------------------------------------ fontes do artigo
  const cited = live.source_refs || [];
  const linkedIds = Array.from(new Set([...a.sources, ...cited]));
  const linked = linkedIds.map((id) => sourcesApi.sources[id]).filter((s): s is Source => !!s);
  const citedSources = linked.filter((s) => cited.includes(s.id));
  const references = sortReferences(a.onlyCited ? citedSources : linked, a.norm);
  const uncited = linked.length - citedSources.length;
  const citeCount = (id: string) => (live.content.match(new RegExp(`\\]\\(cite:${id}`, 'g')) || []).length;

  const [q, setQ] = useState('');
  const library = useMemo(() => {
    const t = norm(q.trim());
    if (!t) return [];
    return Object.values(sourcesApi.sources)
      .filter((s) => !linkedIds.includes(s.id))
      .filter((s) => norm(`${s.title} ${s.subtitle || ''} ${s.authors.map((x) => `${x.family} ${x.given || ''}`).join(' ')} ${s.year || ''}`).includes(t))
      .slice(0, 8);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [q, sourcesApi.sources, linkedIds.join(',')]);
  const link = (id: string) => !a.sources.includes(id) && save({ sources: [...a.sources, id] }, 0);
  const unlink = (id: string) => save({ sources: a.sources.filter((x) => x !== id) }, 0);

  // ------------------------------------------------------------ editor (inserir citação, trecho)
  const editorOf = (): Editor | null => ((paperRef.current?.querySelector('.ProseMirror') as (HTMLElement & { editor?: Editor }) | null)?.editor as Editor) || null;
  const citeNow = (id: string, page = '') => {
    const ed = editorOf();
    if (!ed) return;
    link(id);
    insertCitation(ed, id, page);
  };
  const quoteHtml = (x: { text: string; page: string | null; source_id: string }) => {
    const esc = (t: string) => t.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
    const cite = `<span data-cite="${x.source_id}"${x.page ? ` data-page="${esc(x.page)}"` : ''}></span>`;
    return x.text.length > 240 ? `<div data-callout="longa" data-title=""><p>${esc(x.text)} ${cite}</p></div><p></p>` : `<span>“${esc(x.text)}” </span>${cite}<span> </span>`;
  };
  const insertQuote = (x: { text: string; page: string | null; source_id: string }) => {
    const ed = editorOf();
    if (!ed) return;
    link(x.source_id);
    ed.chain().focus().insertContent(quoteHtml(x)).run();
  };

  // ------------------------------------------------------------ cadastro de fonte pedido de dentro do editor
  const pending = useRef<((s: Source | null) => void) | null>(null);
  const citeTools: CitationTools = {
    sources: sourcesApi.sources,
    linked: linkedIds,
    norm: a.norm,
    upperCase: a.upperCase,
    requestSource: (t) =>
      new Promise((resolve) => {
        pending.current = resolve;
        setDialog({ source: null, title: t });
      }),
  };

  const copy = (text: string) => void navigator.clipboard?.writeText(text).catch(() => alert('Não foi possível copiar.'));

  // ------------------------------------------------------------ métricas
  const text = useMemo(() => mdToText(live.content || ''), [live.content]);
  const preWords = a.showPre ? countWords(`${a.pre.subtitle} ${a.pre.abstract}`) : 0;
  const words = countWords(text) + preWords;
  const chars = text.replace(/\s/g, '').length;
  const read = readability(text);
  const warnings = preWarnings(a);

  const sourceMenu = (e: React.MouseEvent, s: Source) =>
    menu.open(
      e,
      [
        { label: 'Citar no ponto do cursor', icon: <Plus className="w-3.5 h-3.5" />, run: () => citeNow(s.id) },
        { label: 'Editar fonte', icon: <Pencil className="w-3.5 h-3.5" />, run: () => setDialog({ source: s }) },
        { label: `Copiar ${formatCitation(s, a.norm, { upperCase: a.upperCase })}`, icon: <Copy className="w-3.5 h-3.5" />, run: () => copy(formatCitation(s, a.norm, { upperCase: a.upperCase })) },
        { label: 'Copiar referência', icon: <Copy className="w-3.5 h-3.5" />, run: () => copy(formatReference(s, a.norm).map((x) => x.t).join('')) },
        'sep',
        ...(a.sources.includes(s.id) ? [{ label: 'Tirar deste artigo', icon: <X className="w-3.5 h-3.5" />, run: () => unlink(s.id) }] : []),
      ],
      shortLabel(s)
    );

  const quotes = sourcesApi.quotes.filter((x) => linkedIds.includes(x.source_id));
  const projectEntries = Object.values(links.entries)
    .filter((e) => !projectId || !e.project_id || e.project_id === projectId)
    .sort((x, y) => x.title.localeCompare(y.title, 'pt-BR'));

  return (
    <div className="nb-art2" data-norm={a.norm} data-numbered={a.numbered || undefined} data-top={top} data-outline={panels.outline || undefined} data-side={panels.side || undefined}>
      {/* barra do artigo */}
      <div className="nb-art2-bar">
        <select value={a.norm} onChange={(e) => save({ norm: e.target.value as CitationNorm, ...(e.target.value === 'editorial' ? { numbered: false, showPre: false } : {}) }, 0)} aria-label="Norma do documento" className="nb-world-select">
          {NORMS.map((n) => (
            <option key={n.id} value={n.id}>
              {n.label}
            </option>
          ))}
        </select>
        <label className="nb-art2-check">
          <input type="checkbox" checked={a.numbered} onChange={(e) => save({ numbered: e.target.checked }, 0)} />
          Numerar seções
        </label>
        <label className="nb-art2-check">
          <input type="checkbox" checked={a.showPre} onChange={(e) => save({ showPre: e.target.checked }, 0)} />
          Elementos pré-textuais
        </label>
        <label className="nb-art2-check" title="A NBR 6023 pede nas referências só os documentos citados no texto">
          <input type="checkbox" checked={a.onlyCited} onChange={(e) => save({ onlyCited: e.target.checked }, 0)} />
          Referências só das citadas
        </label>
        {a.norm === 'abnt' && (
          <label className="nb-art2-check" title="Tradicional: (SILVA, 2025). A NBR 10520:2023 também aceita (Silva, 2025)">
            <input type="checkbox" checked={a.upperCase} onChange={(e) => save({ upperCase: e.target.checked }, 0)} />
            Autor em maiúsculas
          </label>
        )}
        <span className="flex-1" />
        <div className="nb-art2-views" role="radiogroup" aria-label="Visualização">
          <button type="button" role="radio" aria-checked={view === 'escrita'} onClick={() => setView('escrita')}>
            <PenLine className="w-3.5 h-3.5" /> Escrita
          </button>
          <button type="button" role="radio" aria-checked={view === 'folha'} onClick={() => setView('folha')}>
            <FileText className="w-3.5 h-3.5" /> Folha
          </button>
        </div>
        <button
          type="button"
          disabled={exporting}
          onClick={(e) =>
            menu.open(
              e,
              [
                { label: 'PDF diagramado (pela Folha)', icon: <FileText className="w-3.5 h-3.5" />, run: () => setView('folha') },
                {
                  label: 'Word (.docx) com notas de rodapé',
                  icon: <Download className="w-3.5 h-3.5" />,
                  run: async () => {
                    setExporting(true);
                    try {
                      await api.flushAll();
                      const cur = api.items[item.id] || live;
                      await exportArticleDocx(cur.title, cur.content, sourcesApi.sources, articleData(cur.data), cur.source_refs || []);
                    } catch (err) {
                      alert(err instanceof Error ? `Não foi possível gerar o Word: ${err.message}` : 'Não foi possível gerar o Word.');
                    }
                    setExporting(false);
                  },
                },
                {
                  label: 'Markdown (.md)',
                  icon: <Download className="w-3.5 h-3.5" />,
                  run: () => {
                    const cur = api.items[item.id] || live;
                    exportArticleMarkdown(cur.title, cur.content, sourcesApi.sources, articleData(cur.data), cur.source_refs || []);
                  },
                },
              ],
              'Exportar artigo'
            )
          }
          className="nb-world-btn"
        >
          <Download className="w-3.5 h-3.5" /> {exporting ? 'Gerando…' : 'Exportar'}
        </button>
        <button type="button" aria-pressed={panels.outline} title="Estrutura" aria-label="Estrutura" onClick={() => setPanels((p) => ({ ...p, outline: !p.outline }))} className="nb-art2-toggle">
          <ListTree />
        </button>
        <button type="button" aria-pressed={panels.side} title="Fontes, trechos e sumário" aria-label="Fontes, trechos e sumário" onClick={() => setPanels((p) => ({ ...p, side: !p.side }))} className="nb-art2-toggle">
          <PanelRight />
        </button>
      </div>

      <div className="nb-art2-grid">
        {/* estrutura */}
        {panels.outline && (
          <aside className="nb-art2-outline" aria-label="Estrutura do artigo">
            <p className="nb-world-kicker mb-2">Estrutura</p>
            {heads.length ? (
              <ol>
                {heads.map((h, i) => (
                  <li key={i} style={{ paddingLeft: (h.level - 1) * 12 }}>
                    <button type="button" onClick={() => go(h.el)} data-level={h.level}>
                      {a.numbered && <span className="nb-art2-num">{h.num}</span>}
                      <span className="truncate">{h.text || 'Sem título'}</span>
                    </button>
                  </li>
                ))}
                {references.length > 0 && (
                  <li>
                    <button type="button" onClick={() => document.getElementById(`refs-${item.id}`)?.scrollIntoView({ behavior: 'smooth' })} data-level={1}>
                      <span className="truncate">Referências</span>
                    </button>
                  </li>
                )}
              </ol>
            ) : (
              <p className="text-[12px] text-[var(--nb-ink-3)]">Use títulos (menu / ou ##) para montar as seções.</p>
            )}
            {caps.length > 0 && (
              <>
                {(['figura', 'tabela', 'quadro', 'grafico'] as const).map((k) => {
                  const list = caps.filter((c) => c.kind === k);
                  if (!list.length) return null;
                  return (
                    <div key={k} className="mt-5">
                      <p className="nb-world-kicker mb-1.5">{k === 'figura' ? 'Figuras' : k === 'tabela' ? 'Tabelas' : k === 'quadro' ? 'Quadros' : 'Gráficos'}</p>
                      <ol>
                        {list.map((c, i) => (
                          <li key={i}>
                            <button type="button" onClick={() => go(c.el)}>
                              <span className="nb-art2-num">{i + 1}</span>
                              <span className="truncate">{c.text || 'Sem legenda'}</span>
                            </button>
                          </li>
                        ))}
                      </ol>
                    </div>
                  );
                })}
              </>
            )}
          </aside>
        )}

        {/* folha */}
        {view === 'folha' && (
          <div className="nb-art2-folha">
            <ArticleSheet title={live.title} md={live.content} sources={sourcesApi.sources} a={a} cited={cited} />
          </div>
        )}
        <div className="nb-art2-paper" ref={paperRef} style={view === 'folha' ? { display: 'none' } : undefined}>
          <input
            value={title}
            onChange={(e) => setTitle(e.target.value.slice(0, 200))}
            onBlur={() => title.trim() && title !== live.title && w.rename(item.id, title.trim())}
            onKeyDown={(e) => e.key === 'Enter' && (e.target as HTMLInputElement).blur()}
            aria-label="Título do artigo"
            placeholder="Título do artigo"
            className="nb-art2-title"
          />
          {a.showPre && (
            <div className="nb-art2-pre">
              <input value={a.pre.subtitle} onChange={(e) => savePre({ subtitle: e.target.value.slice(0, 300) })} placeholder="Subtítulo (opcional)" aria-label="Subtítulo" className="nb-art2-subtitle" />
              <textarea
                value={a.pre.authors}
                onChange={(e) => savePre({ authors: e.target.value.slice(0, 2000) })}
                placeholder={'Autor (um por linha)\nex.: Maria Souza — Universidade Federal de Minas Gerais'}
                aria-label="Autores"
                rows={Math.max(1, a.pre.authors.split('\n').length)}
                className="nb-art2-authors"
              />
              <PreBlock
                label="Resumo"
                value={a.pre.abstract}
                keywords={a.pre.keywords}
                kwLabel="Palavras-chave"
                onText={(v) => savePre({ abstract: v })}
                onKw={(v) => savePre({ keywords: v })}
                limits={a.norm === 'abnt' ? '100 a 250 palavras' : undefined}
              />
              {a.pre.showForeign ? (
                <PreBlock
                  label="Abstract"
                  value={a.pre.abstractForeign}
                  keywords={a.pre.keywordsForeign}
                  kwLabel="Keywords"
                  onText={(v) => savePre({ abstractForeign: v })}
                  onKw={(v) => savePre({ keywordsForeign: v })}
                  onRemove={() => savePre({ showForeign: false })}
                />
              ) : (
                <button type="button" onClick={() => savePre({ showForeign: true })} className="text-[12px] text-[var(--nb-ink-3)] hover:text-[var(--nb-ink)]">
                  + Resumo em língua estrangeira
                </button>
              )}
              {warnings.length > 0 && (
                <ul className="nb-art2-warn">
                  {warnings.map((wn) => (
                    <li key={wn}>{wn}</li>
                  ))}
                </ul>
              )}
            </div>
          )}

          <div className="nb-art2-body">
            <CitationContext.Provider value={citeTools}>{body}</CitationContext.Provider>
          </div>

          {notes.length > 0 && (
            <section className="nb-art2-notes">
              <h2>Notas</h2>
              <ol>
                {notes.map((n, i) => (
                  <li key={i}>
                    <button type="button" onClick={() => go(n.el)} className="nb-art2-num">
                      {i + 1}
                    </button>
                    <span>{n.text}</span>
                  </li>
                ))}
              </ol>
            </section>
          )}

          {a.onlyCited && uncited > 0 && !references.length && (
            <p className="nb-art2-refs-hint">
              As referências aparecem aqui assim que você citar as fontes no texto (digite ^ ou use “Citar” no painel ao lado).
            </p>
          )}
          {references.length > 0 && (
            <section className="nb-art2-refs" id={`refs-${item.id}`}>
              <h2>{a.norm === 'editorial' ? 'Leituras e fontes' : a.norm === 'apa' ? 'Referências' : 'REFERÊNCIAS'}</h2>
              <ul>
                {references.map((s) => (
                  <li key={s.id} onContextMenu={(e) => sourceMenu(e, s)}>
                    <RefText segs={formatReference(s, a.norm)} />
                  </li>
                ))}
              </ul>
            </section>
          )}
        </div>

        {/* fontes, trechos e sumário */}
        {panels.side && (
          <aside className="nb-art2-side" aria-label="Fontes, trechos e sumário">
            <div className="nb-art2-tabs" role="tablist">
              {(
                [
                  ['fontes', `Fontes${linked.length ? ` · ${linked.length}` : ''}`],
                  ['trechos', `Trechos${quotes.length ? ` · ${quotes.length}` : ''}`],
                  ['sumario', 'Sumário'],
                ] as const
              ).map(([id, label]) => (
                <button key={id} type="button" role="tab" aria-selected={tab === id} onClick={() => setTab(id)}>
                  {label}
                </button>
              ))}
            </div>

            {tab === 'fontes' && (
              <div className="space-y-3">
                <label className="nb-codex-search">
                  <Search className="w-3.5 h-3.5" />
                  <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Buscar na sua biblioteca" aria-label="Buscar fonte" />
                </label>
                {library.length > 0 && (
                  <div>
                    <p className="nb-world-kicker mb-1">Da sua biblioteca</p>
                    <ul className="nb-art2-list">
                      {library.map((s) => (
                        <li key={s.id}>
                          <button type="button" onClick={() => (link(s.id), setQ(''))} title="Adicionar a este artigo">
                            <span className="nb-art2-src-label">{shortLabel(s)}</span>
                            <span className="nb-art2-src-title">{s.title}</span>
                            <Plus className="w-3.5 h-3.5 shrink-0 text-[var(--nb-ink-3)]" />
                          </button>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
                {linked.length ? (
                  <ul className="nb-art2-list">
                    {references.map((s) => {
                      const n = citeCount(s.id);
                      return (
                        <li key={s.id} onContextMenu={(e) => sourceMenu(e, s)}>
                          <button type="button" onClick={() => setDialog({ source: s })} title="Editar fonte">
                            <span className="nb-art2-src-label">{shortLabel(s)}</span>
                            <span className="nb-art2-src-title">{s.title}</span>
                            <span className="nb-art2-src-meta">{n ? `citada ${n}×` : 'não citada'}</span>
                          </button>
                          <button type="button" className="nb-art2-cite" onClick={() => citeNow(s.id)} title="Citar no ponto do cursor">
                            Citar
                          </button>
                          <button type="button" aria-label="Mais" className="nb-art2-more" onClick={(e) => sourceMenu(e, s)}>
                            <MoreHorizontal className="w-3.5 h-3.5" />
                          </button>
                        </li>
                      );
                    })}
                  </ul>
                ) : (
                  <p className="text-[12px] leading-relaxed text-[var(--nb-ink-3)]">Cadastre livros, artigos, sites e documentos. Eles entram nas referências no fim do artigo, já formatados pela norma.</p>
                )}
                <button type="button" onClick={() => setDialog({ source: null })} className="nb-world-btn w-full justify-center">
                  <Plus className="w-3.5 h-3.5" /> Nova fonte
                </button>
              </div>
            )}

            {tab === 'trechos' && (
              <div className="space-y-3">
                {quotes.length ? (
                  <ul className="space-y-3">
                    {quotes.map((x) => {
                      const s = sourcesApi.sources[x.source_id];
                      if (!s) return null;
                      const cite = formatCitation(s, a.norm, { page: x.page || undefined, upperCase: a.upperCase });
                      return (
                        <li
                          key={x.id}
                          className="group nb-art2-quote"
                          draggable
                          onDragStart={(e) => {
                            e.dataTransfer.setData('text/html', quoteHtml(x));
                            e.dataTransfer.setData('text/plain', `“${x.text}” ${cite}`);
                            e.dataTransfer.effectAllowed = 'copy';
                          }}
                          title="Arraste para o texto ou use Inserir"
                        >
                          <p>“{x.text}”</p>
                          <div className="flex items-center gap-2 mt-1">
                            <span className="flex-1 text-[11px] text-[var(--nb-ink-3)]">{cite}</span>
                            <button type="button" onClick={() => insertQuote(x)} className="nb-art2-cite !static" title={x.text.length > 240 ? 'Inserir como citação longa' : 'Inserir entre aspas com a citação'}>
                              Inserir
                            </button>
                            <button type="button" title="Copiar com a citação" aria-label="Copiar com a citação" onClick={() => copy(`“${x.text}” ${cite}`)} className="p-1 text-[var(--nb-ink-3)] hover:text-[var(--nb-ink)]">
                              <Copy className="w-3.5 h-3.5" />
                            </button>
                            <button type="button" aria-label="Apagar trecho" onClick={() => void sourcesApi.removeQuote(x.id)} className="p-1 text-[var(--nb-ink-3)] hover:text-red-400 opacity-0 group-hover:opacity-100">
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </li>
                      );
                    })}
                  </ul>
                ) : (
                  <p className="text-[12px] leading-relaxed text-[var(--nb-ink-3)]">Salve trechos das fontes (com a página) ao editar cada fonte. Arraste um trecho para o texto: os curtos entram entre aspas e os longos como citação longa, já com a chamada.</p>
                )}
              </div>
            )}

            {tab === 'sumario' && (
              <div className="space-y-2">
                {projectEntries.length ? (
                  <ul className="nb-art2-list">
                    {projectEntries.map((e) => (
                      <li key={e.id}>
                        <button type="button" data-ref={e.id} onClick={() => w.readMore(e)}>
                          <EntryAvatar entry={e} size={18} ring={false} />
                          <span className="min-w-0 flex-1">
                            <span className="block truncate text-[13px] text-[var(--nb-ink)]">{e.title}</span>
                            {e.summary && <span className="block truncate text-[11px] text-[var(--nb-ink-3)]">{e.summary}</span>}
                          </span>
                        </button>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="text-[12px] leading-relaxed text-[var(--nb-ink-3)]">Termos técnicos, siglas e notas do autor marcados no texto (digite +) aparecem aqui, com a explicação que o leitor verá.</p>
                )}
                <button type="button" onClick={() => w.openSummary(projectId || '', null)} className="flex items-center gap-1.5 text-[12px] text-[var(--nb-ink-3)] hover:text-[var(--nb-ink)]">
                  <BookMarked className="w-3.5 h-3.5" /> Abrir o Sumário
                </button>
              </div>
            )}
          </aside>
        )}
      </div>

      {/* métricas */}
      <div className="nb-art2-metrics" aria-label="Métricas do texto">
        <span>{words.toLocaleString('pt-BR')} palavras</span>
        <span>{chars.toLocaleString('pt-BR')} caracteres</span>
        <span>{Math.max(1, Math.round(words / 220))} min de leitura</span>
        {read && <span title={`Índice de Flesch adaptado ao português: ${read.score}`}>legibilidade: {read.label}</span>}
        <span>
          {linked.length} {linked.length === 1 ? 'fonte' : 'fontes'}
          {uncited > 0 ? ` · ${uncited} sem citação` : ''}
          {notes.length > 0 ? ` · ${notes.length} ${notes.length === 1 ? 'nota' : 'notas'}` : ''}
        </span>
        <span className="flex-1" />
        <button type="button" disabled title="Chega com o assistente de IA: coesão, clareza, tom formal e argumentação" className="nb-art2-ai">
          <Sparkles className="w-3 h-3" /> Revisar com IA
        </button>
      </div>

      {dialog && (
        <SourceDialog
          source={dialog.source}
          initialTitle={dialog.title}
          projectId={projectId}
          sourcesApi={sourcesApi}
          onClose={() => {
            setDialog(null);
            pending.current?.(null);
            pending.current = null;
          }}
          onSaved={(s) => {
            if (!dialog.source) link(s.id);
            pending.current?.(s);
            pending.current = null;
          }}
        />
      )}
    </div>
  );
}

function PreBlock({
  label,
  value,
  keywords,
  kwLabel,
  onText,
  onKw,
  limits,
  onRemove,
}: {
  label: string;
  value: string;
  keywords: string;
  kwLabel: string;
  onText: (v: string) => void;
  onKw: (v: string) => void;
  limits?: string;
  onRemove?: () => void;
}) {
  const [v, setV] = useState(value);
  const [k, setK] = useState(keywords);
  const ref = useRef<HTMLTextAreaElement>(null);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    el.style.height = 'auto';
    el.style.height = `${el.scrollHeight}px`;
  }, [v]);
  const n = countWords(v);
  return (
    <div className="nb-art2-abstract">
      <div className="flex items-baseline gap-2">
        <span className="nb-art2-pre-label">{label}</span>
        <span className="text-[11px] text-[var(--nb-ink-3)]">
          {n} palavras{limits ? ` · ${limits}` : ''}
        </span>
        {onRemove && (
          <button type="button" onClick={onRemove} className="ml-auto text-[11px] text-[var(--nb-ink-3)] hover:text-[var(--nb-ink)]">
            tirar
          </button>
        )}
      </div>
      <textarea
        ref={ref}
        rows={2}
        value={v}
        onChange={(e) => {
          setV(e.target.value.slice(0, 5000));
          onText(e.target.value.slice(0, 5000));
        }}
        placeholder="Objetivo, método, resultados e conclusões, em um parágrafo."
        aria-label={label}
      />
      <div className="flex items-baseline gap-2">
        <span className="nb-art2-pre-label">{kwLabel}:</span>
        <input
          value={k}
          onChange={(e) => {
            setK(e.target.value.slice(0, 400));
            onKw(e.target.value.slice(0, 400));
          }}
          placeholder="separadas por ponto e vírgula"
          aria-label={kwLabel}
        />
        <span className="text-[11px] text-[var(--nb-ink-3)] whitespace-nowrap">{splitKeywords(k).length}</span>
      </div>
    </div>
  );
}
