'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { Eye, EyeOff, Lock, Plus, Search } from 'lucide-react';
import type { NotebookItem } from '@/lib/notebook/types';
import { codexData, type CodexCategory } from '@/lib/notebook/codex';
import type { NotebookEntry } from '@/lib/notebook/entries';
import { PROJECT_TYPES, projectData, type ProjectType } from '@/lib/notebook/projects';
import { useWorld, useSecrets } from './WorldContext';
import { CategoryDialog } from './Infobox';
import { CodexArticle } from './CodexArticle';
import { convertWorldNote } from './convertWorld';
import { Hierarchy, treeToMindmap } from './Hierarchy';
import { useNotebookMenu } from '../menu/ContextMenu';
import { Glyph } from '../icons/Glyph';
import { itemIcon } from '../FileExplorer';

export type WorldTab = 'visao' | 'codex' | 'mapas' | 'cronologia' | 'relacoes';
const TABS: { id: WorldTab; label: string }[] = [
  { id: 'visao', label: 'Visão geral' },
  { id: 'codex', label: 'Codex' },
  { id: 'mapas', label: 'Mapas' },
  { id: 'cronologia', label: 'Cronologia' },
  { id: 'relacoes', label: 'Relações' },
];

type Nav = { tab: WorldTab; cat: string | null };
const NAV_KEY = (id: string) => `insight-nb-world:${id}`;
function readNav(id: string): Nav {
  try {
    const n = JSON.parse(sessionStorage.getItem(NAV_KEY(id)) || 'null');
    if (n && TABS.some((t) => t.id === n.tab)) return { tab: n.tab, cat: n.cat ?? null };
  } catch {
    /* ignora */
  }
  return { tab: 'visao', cat: null };
}
export function writeNav(id: string, nav: Nav) {
  try {
    sessionStorage.setItem(NAV_KEY(id), JSON.stringify(nav));
  } catch {
    /* ignora */
  }
}

const norm = (s: string) =>
  s
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '');

/** Tudo o que está dentro de um projeto. */
function insideOf(items: Record<string, NotebookItem>, projectId: string) {
  const all = Object.values(items).filter((i) => !i.archived_at);
  const out: NotebookItem[] = [];
  const walk = (pid: string) => {
    for (const k of all.filter((i) => i.parent_id === pid)) {
      out.push(k);
      walk(k.id);
    }
  };
  walk(projectId);
  return out;
}

/**
 * Mundo: Visão geral, Codex, Mapas, Cronologia e Relações de um projeto.
 * Com `article`, mostra o verbete aberto dentro do Codex.
 */
export function WorldHub({ project, article, body }: { project: NotebookItem; article?: NotebookItem; body?: React.ReactNode }) {
  const w = useWorld();
  const [secrets, setSecrets] = useSecrets();
  const [nav, setNavState] = useState<Nav>(() => (article ? { ...readNav(project.id), tab: 'codex' } : readNav(project.id)));
  const setNav = (n: Nav) => {
    setNavState(n);
    writeNav(project.id, n);
  };
  const tab = article ? 'codex' : nav.tab;

  const cats = w.codex.ofProject(project.id);
  // mundo novo: cria as categorias iniciais uma vez
  const seeded = useRef(false);
  useEffect(() => {
    if (!w.codex.loaded || seeded.current || cats.length) return;
    seeded.current = true;
    void w.codex.seed(project.id);
  }, [w.codex, cats.length, project.id]);

  const entries = useMemo(() => Object.values(w.entriesApi.entries).filter((e) => e.project_id === project.id), [w.entriesApi.entries, project.id]);
  const inside = useMemo(() => insideOf(w.api.items, project.id), [w.api.items, project.id]);

  const go = (t: WorldTab) => {
    setNav({ ...nav, tab: t });
    if (article) w.open(project.id);
  };

  return (
    <div className="nb-world">
      <header className="nb-world-head">
        <nav className="nb-world-tabs" aria-label="Seções do mundo">
          {TABS.map((t) => (
            <button key={t.id} type="button" aria-current={tab === t.id ? 'page' : undefined} onClick={() => go(t.id)}>
              {t.label}
            </button>
          ))}
        </nav>
        <button
          type="button"
          onClick={() => setSecrets(!secrets)}
          aria-pressed={!secrets}
          title={secrets ? 'Esconder segredos do autor (ver como o leitor)' : 'Mostrar segredos do autor'}
          className="nb-world-secret-toggle"
        >
          {secrets ? <Eye className="w-3.5 h-3.5" /> : <EyeOff className="w-3.5 h-3.5" />}
          {secrets ? 'Segredos visíveis' : 'Segredos ocultos'}
        </button>
      </header>

      {tab === 'visao' && <Overview project={project} entries={entries} inside={inside} cats={cats} onTab={go} onCat={(c) => setNav({ tab: 'codex', cat: c })} />}
      {tab === 'codex' && (
        <Codex
          project={project}
          cats={cats}
          entries={entries}
          cat={nav.cat}
          onCat={(c) => {
            setNav({ tab: 'codex', cat: c });
            if (article) w.open(project.id);
          }}
          article={article}
          body={body}
        />
      )}
      {tab === 'mapas' && (
        <IndexOf
          title="Mapas"
          lead="Mapas do mundo, de continentes a cidades. Marcadores e regiões ligados a verbetes mostram a prévia ao passar o mouse."
          items={inside.filter((i) => i.template === 'map')}
          create={[{ label: 'Novo mapa', template: 'map' }]}
          project={project}
        />
      )}
      {tab === 'cronologia' && (
        <IndexOf
          title="Cronologia"
          lead="Linhas do tempo com eras próprias e calendários do mundo, com meses, semanas e luas."
          items={inside.filter((i) => i.template === 'timeline' || i.template === 'calendar')}
          create={[
            { label: 'Nova linha do tempo', template: 'timeline' },
            { label: 'Novo calendário', template: 'calendar' },
          ]}
          project={project}
        />
      )}
      {tab === 'relacoes' && (
        <IndexOf
          title="Relações"
          lead="O grafo de conexões e a genealogia são montados a partir das relações de cada verbete. Para hierarquias e fluxos livres, use o Estúdio 2D."
          items={inside.filter((i) => i.template === 'mindmap')}
          create={[{ label: 'Novo diagrama no Estúdio 2D', template: 'mindmap' }]}
          project={project}
          extra={
            <>
              <section className="mb-10">
                <h3 className="nb-world-h3">Hierarquia</h3>
                <Hierarchy
                  entries={entries}
                  links={w.entriesApi.links}
                  onOpen={(e) => w.readMore(e)}
                  onStudio={async (rootId, tree) => {
                    const { nodes, edges } = treeToMindmap(rootId, tree, w.entriesApi.entries);
                    const title = `Hierarquia · ${w.entriesApi.entries[rootId]?.title || 'Mundo'}`;
                    const it = await w.api.create({ template: 'mindmap', parentId: project.id, title });
                    if (!it) return;
                    w.api.update(it.id, { data: { ...(it.data || {}), mindMapNodes: nodes, mindMapEdges: edges } });
                    w.open(it.id);
                  }}
                />
              </section>
              <h3 className="nb-world-h3">Grafo e genealogia</h3>
              <div className="nb-world-rows mb-10">
                <button type="button" className="nb-world-row" onClick={() => w.openSummary(project.id)}>
                  <span className="nb-world-row-title">Grafo de conexões e genealogia</span>
                  <span className="nb-world-row-meta">{w.entriesApi.links.filter((l) => entries.some((e) => e.id === l.from_id)).length} relações</span>
                </button>
              </div>
              <h3 className="nb-world-h3">Diagramas no Estúdio 2D</h3>
            </>
          }
        />
      )}
    </div>
  );
}

// ============================================================================
// Visão geral
// ============================================================================

function Overview({
  project,
  entries,
  inside,
  cats,
  onTab,
  onCat,
}: {
  project: NotebookItem;
  entries: NotebookEntry[];
  inside: NotebookItem[];
  cats: CodexCategory[];
  onTab: (t: WorldTab) => void;
  onCat: (id: string) => void;
}) {
  const w = useWorld();
  const [desc, setDesc] = useState(projectData(project).description || '');
  const [converting, setConverting] = useState<string | null>(null);
  const descRef = useRef<HTMLTextAreaElement>(null);
  useEffect(() => {
    const el = descRef.current;
    if (!el) return;
    el.style.height = 'auto';
    el.style.height = `${el.scrollHeight}px`;
  }, [desc]);

  const verbetes = entries.filter((e) => e.codex_category_id || (e.target_id && w.api.items[e.target_id]?.template === 'codex'));
  const recent = [...verbetes].sort((a, b) => b.updated_at.localeCompare(a.updated_at)).slice(0, 6);
  const empty = verbetes.filter((e) => e.target_id && (w.api.items[e.target_id]?.word_count ?? 0) === 0 && !e.summary).slice(0, 6);
  const maps = inside.filter((i) => i.template === 'map').length;
  const times = inside.filter((i) => i.template === 'timeline' || i.template === 'calendar').length;
  const oldWorld = inside.filter((i) => i.template === 'world');
  const roots = cats.filter((c) => !c.parent_id);
  const countIn = (c: CodexCategory) => {
    const ids = new Set([c.id, ...cats.filter((x) => x.parent_id === c.id).map((x) => x.id)]);
    return entries.filter((e) => e.codex_category_id && ids.has(e.codex_category_id)).length;
  };

  return (
    <div className="nb-world-overview">
      <section className="space-y-3">
        <textarea
          ref={descRef}
          value={desc}
          rows={1}
          onChange={(e) => {
            setDesc(e.target.value.slice(0, 2000));
            w.api.update(project.id, { data: { ...(project.data || {}), project: { ...projectData(project), description: e.target.value.slice(0, 2000) } } }, { debounce: 700 });
          }}
          placeholder="Sobre este mundo: o tom, a premissa, o que o torna diferente."
          aria-label="Sobre este mundo"
          className="nb-world-lede"
        />
        <p className="text-[13px] text-[var(--nb-ink-3)]">
          {verbetes.length} {verbetes.length === 1 ? 'verbete' : 'verbetes'} · {maps} {maps === 1 ? 'mapa' : 'mapas'} · {times} {times === 1 ? 'linha do tempo' : 'linhas do tempo'} ·{' '}
          {w.entriesApi.links.filter((l) => entries.some((e) => e.id === l.from_id)).length} relações
        </p>
      </section>

      <div className="grid gap-x-12 gap-y-10 md:grid-cols-2">
        <section>
          <h3 className="nb-world-h3">Codex</h3>
          <ul className="nb-world-toc">
            {roots.map((c) => (
              <li key={c.id}>
                <button type="button" onClick={() => onCat(c.id)}>
                  <Glyph name={c.glyph} className="text-[14px] text-[var(--nb-ink-3)]" />
                  <span className="flex-1 truncate">{c.name}</span>
                  <span className="nb-world-count">{countIn(c)}</span>
                </button>
              </li>
            ))}
          </ul>
        </section>

        <section>
          <h3 className="nb-world-h3">Editados por último</h3>
          {recent.length ? (
            <ul className="nb-world-toc">
              {recent.map((e) => (
                <li key={e.id}>
                  <button type="button" data-ref={e.id} onClick={() => e.target_id && w.open(e.target_id)}>
                    <span className="flex-1 truncate">{e.title}</span>
                    <span className="nb-world-count">{new Date(e.updated_at).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' })}</span>
                  </button>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-[13px] text-[var(--nb-ink-3)]">
              Nenhum verbete ainda.{' '}
              <button type="button" className="underline underline-offset-2 hover:text-[var(--nb-ink)]" onClick={() => onTab('codex')}>
                Abrir o Codex
              </button>
            </p>
          )}
          {empty.length > 0 && (
            <>
              <h3 className="nb-world-h3 mt-8">Esperando texto</h3>
              <ul className="nb-world-toc">
                {empty.map((e) => (
                  <li key={e.id}>
                    <button type="button" onClick={() => e.target_id && w.open(e.target_id)}>
                      <span className="flex-1 truncate">{e.title}</span>
                    </button>
                  </li>
                ))}
              </ul>
            </>
          )}
        </section>
      </div>

      {oldWorld.length > 0 && (
        <section className="border-t border-white/[0.07] pt-6">
          <h3 className="nb-world-h3">Notas de worldbuilding antigas</h3>
          <p className="text-[13px] text-[var(--nb-ink-3)] mb-3">Os itens em lista dessas notas (“**Nome** — descrição”) podem virar verbetes do Codex. A nota original continua igual.</p>
          <ul className="nb-world-toc">
            {oldWorld.map((n) => (
              <li key={n.id}>
                <span className="flex items-center gap-3 py-2">
                  <button type="button" className="flex-1 truncate text-left hover:text-[var(--nb-ink)]" onClick={() => w.open(n.id)}>
                    {n.title}
                  </button>
                  <button
                    type="button"
                    disabled={!!converting}
                    onClick={async () => {
                      setConverting(n.id);
                      const made = await convertWorldNote(w, project, n);
                      setConverting(null);
                      alert(made ? `${made} ${made === 1 ? 'verbete criado' : 'verbetes criados'} no Codex.` : 'Nenhum item em lista com nome em negrito foi encontrado.');
                    }}
                    className="text-[12px] font-semibold text-[var(--nb-ink-2)] hover:text-[var(--nb-ink)] disabled:opacity-50"
                  >
                    {converting === n.id ? 'Convertendo…' : 'Converter em verbetes'}
                  </button>
                </span>
              </li>
            ))}
          </ul>
        </section>
      )}

      <section className="border-t border-white/[0.07] pt-6">
        <h3 className="nb-world-h3">Arquivos do projeto</h3>
        <ul className="nb-world-toc">
          {inside
            .filter((i) => i.parent_id === project.id && !(i.kind === 'folder' && i.data?.codexFolder))
            .sort((a, b) => (a.kind === b.kind ? a.position - b.position : a.kind === 'folder' ? -1 : 1))
            .map((i) => (
              <li key={i.id}>
                <button type="button" data-item-id={i.id} onClick={() => w.open(i.id)}>
                  <span className="text-[13px] text-[var(--nb-ink-3)]">{itemIcon(i)}</span>
                  <span className="flex-1 truncate">{i.title}</span>
                  <span className="nb-world-count">{i.kind === 'folder' ? 'seção' : `${i.word_count} palavras`}</span>
                </button>
              </li>
            ))}
        </ul>
        <button type="button" onClick={() => w.onNew({ parentId: project.id })} className="mt-2 flex items-center gap-1.5 text-[12px] font-semibold text-[var(--nb-ink-3)] hover:text-[var(--nb-ink)]">
          <Plus className="w-3.5 h-3.5" /> Nova nota no projeto
        </button>
      </section>

      <p className="flex flex-wrap items-center gap-2 text-[12px] text-[var(--nb-ink-3)]">
        Tipo do projeto
        <select
          value={projectData(project).type}
          onChange={(e) => {
            const type = e.target.value as ProjectType;
            const def = PROJECT_TYPES.find((t) => t.id === type)!;
            // mudar o tipo mantém a área Mundo ligada (dá para desligar ao lado)
            w.api.update(project.id, { icon: def.glyph, data: { ...(project.data || {}), project: { ...projectData(project), type, world: true } } });
          }}
          className="nb-world-select"
          aria-label="Tipo do projeto"
        >
          {PROJECT_TYPES.map((t) => (
            <option key={t.id} value={t.id}>
              {t.label}
            </option>
          ))}
        </select>
        {projectData(project).type !== 'mundo' && (
          <button
            type="button"
            onClick={() => w.api.update(project.id, { data: { ...(project.data || {}), project: { ...projectData(project), world: false } } })}
            className="underline underline-offset-2 hover:text-[var(--nb-ink)]"
          >
            Desligar a área Mundo
          </button>
        )}
        <span>· os verbetes continuam no Sumário.</span>
      </p>
    </div>
  );
}

// ============================================================================
// Codex
// ============================================================================

function Codex({
  project,
  cats,
  entries,
  cat,
  onCat,
  article,
  body,
}: {
  project: NotebookItem;
  cats: CodexCategory[];
  entries: NotebookEntry[];
  cat: string | null;
  onCat: (id: string | null) => void;
  article?: NotebookItem;
  body?: React.ReactNode;
}) {
  const w = useWorld();
  const menu = useNotebookMenu();
  const [editing, setEditing] = useState<string | null>(null);
  const [q, setQ] = useState('');
  const roots = cats.filter((c) => !c.parent_id);
  const kids = (id: string) => cats.filter((c) => c.parent_id === id);
  const articleEntry = article ? w.entriesApi.entries[codexData(article.data)?.entry || ''] : null;
  const activeCat = article ? articleEntry?.codex_category_id ?? null : cat;

  const idsOf = (id: string) => new Set([id, ...kids(id).map((k) => k.id)]);
  const countIn = (id: string) => {
    const ids = idsOf(id);
    return entries.filter((e) => e.codex_category_id && ids.has(e.codex_category_id)).length;
  };
  const loose = entries.filter((e) => !e.codex_category_id && e.kind === 'elemento');

  const list = useMemo(() => {
    const t = norm(q.trim());
    let base: NotebookEntry[];
    if (t) base = entries.filter((e) => norm(e.title).includes(t) || e.aliases.some((a) => norm(a).includes(t)) || norm(e.summary).includes(t));
    else if (cat === '__loose') base = loose;
    else if (cat && w.codex.cats[cat]) {
      const ids = idsOf(cat);
      base = entries.filter((e) => e.codex_category_id && ids.has(e.codex_category_id));
    } else base = entries.filter((e) => e.codex_category_id);
    return base.sort((a, b) => a.title.localeCompare(b.title, 'pt-BR'));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [entries, cat, q, cats]);

  const current = cat && w.codex.cats[cat] ? w.codex.cats[cat] : null;
  const editingCat = editing ? w.codex.cats[editing] : null;

  async function newIn(catId: string | null) {
    const it = await w.newVerbete(project.id, catId);
    if (it) w.open(it.id);
  }

  const catMenu = (e: React.MouseEvent, c: CodexCategory) =>
    menu.open(
      e,
      [
        { label: 'Novo verbete aqui', run: () => void newIn(c.id) },
        ...(!c.parent_id
          ? [
              {
                label: 'Nova subcategoria',
                run: async () => {
                  const name = prompt('Nome da subcategoria');
                  if (name?.trim()) await w.codex.create({ project_id: project.id, parent_id: c.id, name, glyph: c.glyph, kind: c.kind, fields: c.fields });
                },
              },
            ]
          : []),
        { label: 'Editar categoria e campos', run: () => setEditing(c.id) },
      ],
      c.name
    );

  return (
    <div className="nb-codex">
      {/* índice de categorias */}
      <aside className="nb-codex-nav" aria-label="Categorias do Codex">
        <label className="nb-codex-search">
          <Search className="w-3.5 h-3.5" />
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Buscar no Codex" aria-label="Buscar no Codex" />
        </label>
        <ul>
          <li>
            <button type="button" aria-current={!activeCat && !article && cat !== '__loose' ? 'true' : undefined} onClick={() => onCat(null)}>
              <span className="flex-1">Todos os verbetes</span>
              <span className="nb-world-count">{entries.filter((e) => e.codex_category_id).length}</span>
            </button>
          </li>
          {roots.map((c) => (
            <li key={c.id}>
              <button type="button" aria-current={activeCat === c.id ? 'true' : undefined} onClick={() => onCat(c.id)} onContextMenu={(e) => catMenu(e, c)}>
                <Glyph name={c.glyph} className="text-[13px] text-[var(--nb-ink-3)]" />
                <span className="flex-1 truncate">{c.name}</span>
                <span className="nb-world-count">{countIn(c.id)}</span>
              </button>
              {kids(c.id).length > 0 && (
                <ul className="nb-codex-sub">
                  {kids(c.id).map((k) => (
                    <li key={k.id}>
                      <button type="button" aria-current={activeCat === k.id ? 'true' : undefined} onClick={() => onCat(k.id)} onContextMenu={(e) => catMenu(e, k)}>
                        <span className="flex-1 truncate">{k.name}</span>
                        <span className="nb-world-count">{countIn(k.id)}</span>
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </li>
          ))}
          {loose.length > 0 && (
            <li className="mt-2 pt-2 border-t border-white/[0.06]">
              <button type="button" aria-current={cat === '__loose' && !article ? 'true' : undefined} onClick={() => onCat('__loose')}>
                <span className="flex-1">Menções fora do Codex</span>
                <span className="nb-world-count">{loose.length}</span>
              </button>
            </li>
          )}
        </ul>
        <button
          type="button"
          className="nb-codex-addcat"
          onClick={async () => {
            const name = prompt('Nome da nova categoria');
            if (name?.trim()) {
              const c = await w.codex.create({ project_id: project.id, name, glyph: 'book', kind: 'conceito', fields: [{ key: 'tipo', label: 'Tipo', type: 'text' }] });
              if (c) onCat(c.id);
            }
          }}
        >
          <Plus className="w-3.5 h-3.5" /> Categoria
        </button>
      </aside>

      {/* verbete aberto ou lista */}
      <div className="nb-codex-main">
        {article && articleEntry ? (
          <CodexArticle item={article} entry={articleEntry} project={project} cats={cats} body={body} onCat={onCat} onEditCat={setEditing} />
        ) : article ? (
          <p className="py-10 text-sm text-[var(--nb-ink-3)]">Este verbete perdeu a menção do Sumário.</p>
        ) : (
          <>
            <div className="nb-codex-listhead">
              <div className="min-w-0">
                <p className="nb-world-kicker">{q.trim() ? 'Busca' : current?.parent_id ? w.codex.cats[current.parent_id]?.name : 'Codex'}</p>
                <h2 className="nb-world-serif text-[30px] leading-tight sm:truncate">{q.trim() ? `“${q.trim()}”` : cat === '__loose' ? 'Menções fora do Codex' : current?.name || 'Todos os verbetes'}</h2>
              </div>
              <div className="flex items-center gap-3 shrink-0">
                {current && (
                  <button type="button" onClick={() => setEditing(current.id)} className="text-[12px] text-[var(--nb-ink-3)] hover:text-[var(--nb-ink)]">
                    Campos
                  </button>
                )}
                {cat !== '__loose' && (
                  <button type="button" onClick={() => void newIn(current?.id ?? roots[0]?.id ?? null)} className="nb-world-btn">
                    <Plus className="w-3.5 h-3.5" /> Novo verbete
                  </button>
                )}
              </div>
            </div>
            {cat === '__loose' && !q.trim() && (
              <p className="mb-4 text-[13px] text-[var(--nb-ink-3)]">Menções do projeto criadas no texto que ainda não têm página no Codex. Escolha a categoria para criar o verbete com Infobox.</p>
            )}
            {list.length ? (
              <ul className="nb-world-rows">
                {list.map((e) => {
                  const c = e.codex_category_id ? w.codex.cats[e.codex_category_id] : null;
                  return (
                    <li key={e.id}>
                      {cat === '__loose' && !e.codex_category_id ? (
                        <div className="nb-world-row">
                          <span className="min-w-0 flex-1">
                            <span className="nb-world-row-title" data-ref={e.id}>
                              {e.title}
                            </span>
                            {e.summary && <span className="nb-world-row-sum">{e.summary}</span>}
                          </span>
                          <select
                            defaultValue=""
                            aria-label={`Categoria para ${e.title}`}
                            onChange={async (ev) => {
                              if (!ev.target.value) return;
                              const it = await w.promoteEntry(e, ev.target.value);
                              if (it) w.open(it.id);
                            }}
                            className="nb-world-select"
                          >
                            <option value="">Adicionar ao Codex…</option>
                            {cats.map((x) => (
                              <option key={x.id} value={x.id}>
                                {x.parent_id ? `   ${x.name}` : x.name}
                              </option>
                            ))}
                          </select>
                        </div>
                      ) : (
                        <button type="button" className="nb-world-row" data-item-id={e.target_id || undefined} onClick={() => (e.target_id ? w.open(e.target_id) : w.readMore(e))}>
                          <span className="min-w-0 flex-1">
                            <span className="nb-world-row-title">
                              {e.is_secret && <Lock className="inline w-3 h-3 mr-1.5 -mt-0.5 text-[var(--nb-ink-3)]" aria-label="verbete secreto" />}
                              {e.title}
                            </span>
                            {e.summary && <span className="nb-world-row-sum">{e.summary}</span>}
                          </span>
                          {c && (q.trim() || !cat || c.id !== cat) && <span className="nb-world-row-meta">{c.name}</span>}
                        </button>
                      )}
                    </li>
                  );
                })}
              </ul>
            ) : (
              <p className="py-10 text-[14px] text-[var(--nb-ink-3)] border-t border-white/[0.07]">
                {q.trim() ? 'Nada encontrado.' : 'Nenhum verbete nesta categoria. Crie o primeiro e preencha a Infobox ao lado do texto.'}
              </p>
            )}
          </>
        )}
      </div>

      {editingCat && (
        <CategoryDialog
          category={editingCat}
          onClose={() => setEditing(null)}
          onSave={(patch) => void w.codex.update(editingCat.id, patch)}
          onDelete={() => {
            const ids = idsOf(editingCat.id);
            // os verbetes ficam sem categoria (o banco faz o mesmo)
            entries.filter((e) => e.codex_category_id && ids.has(e.codex_category_id)).forEach((e) => void w.entriesApi.update(e.id, { codex_category_id: null }));
            void w.codex.remove(editingCat.id);
            onCat(null);
          }}
        />
      )}
    </div>
  );
}

// ============================================================================
// Mapas / Cronologia / Relações (índices; o aprofundamento vem nas próximas fases)
// ============================================================================

function IndexOf({
  title,
  lead,
  items,
  create,
  project,
  extra,
}: {
  title: string;
  lead: string;
  items: NotebookItem[];
  create: { label: string; template: string }[];
  project: NotebookItem;
  extra?: React.ReactNode;
}) {
  const w = useWorld();
  return (
    <div className="nb-world-index">
      <h2 className="nb-world-serif text-[30px] leading-tight">{title}</h2>
      <p className="mt-1 mb-8 max-w-xl text-[14px] leading-relaxed text-[var(--nb-ink-3)]">{lead}</p>
      {extra}
      {items.length ? (
        <ul className="nb-world-rows">
          {items
            .sort((a, b) => b.updated_at.localeCompare(a.updated_at))
            .map((i) => (
              <li key={i.id}>
                <button type="button" className="nb-world-row" data-item-id={i.id} onClick={() => w.open(i.id)}>
                  <span className="text-[14px] text-[var(--nb-ink-3)]">{itemIcon(i)}</span>
                  <span className="nb-world-row-title flex-1 truncate">{i.title}</span>
                  <span className="nb-world-row-meta">editado em {new Date(i.updated_at).toLocaleDateString('pt-BR')}</span>
                </button>
              </li>
            ))}
        </ul>
      ) : (
        <p className="py-6 text-[14px] text-[var(--nb-ink-3)] border-t border-white/[0.07]">Nada aqui ainda.</p>
      )}
      <div className="mt-4 flex flex-wrap gap-4">
        {create.map((c) => (
          <button key={c.template} type="button" onClick={() => w.onNew({ parentId: project.id, template: c.template })} className="flex items-center gap-1.5 text-[13px] font-semibold text-[var(--nb-ink-2)] hover:text-[var(--nb-ink)]">
            <Plus className="w-3.5 h-3.5" /> {c.label}
          </button>
        ))}
      </div>
    </div>
  );
}
