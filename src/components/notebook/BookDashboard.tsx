'use client';

import { sanitizeUserHtml } from '@/lib/security/sanitizeHtml';
import { useEffect, useMemo, useRef, useState } from 'react';
import {
  PenLine,
  Plus,
  ImagePlus,
  Download,
  BookOpenText,
  ArrowUp,
  ArrowDown,
  UserRound,
  Map as MapIcon,
  Loader2,
  X,
  Flame,
  List,
  LayoutGrid,
} from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import { uploadMediaToInsight } from '@/lib/mediaCompressor';
import { getUserUploadLimitBytes } from '@/lib/contributorLevels';
import { htmlToText } from '@/lib/notebook/markdown';
import type { BookData, ChapterStatus, NotebookItem } from '@/lib/notebook/types';
import type { NotebookApi } from '@/lib/notebook/useNotebook';
import { CHAPTER_STATUS, sanitizeWriterHtml } from './WriterMode';
import { itemIcon } from './FileExplorer';
import { Glyph } from './icons/Glyph';
import { Corkboard, type ChapterMeta } from './book/Corkboard';

interface Props {
  book: NotebookItem;
  api: NotebookApi;
  onOpen: (id: string) => void;
  onNew: (opts: { parentId: string | null; template?: string; title?: string }) => void;
  onExport?: () => void;
  role?: string | null;
  level?: number | null;
}

const BOOK_STATUS: { id: NonNullable<BookData['bookStatus']>; label: string }[] = [
  { id: 'planejando', label: 'Planejando' },
  { id: 'escrevendo', label: 'Escrevendo' },
  { id: 'revisando', label: 'Revisando' },
  { id: 'concluido', label: 'Concluído' },
];

const GENRES = ['Romance', 'Fantasia', 'Ficção científica', 'Suspense', 'Terror', 'Drama', 'Aventura', 'Poesia', 'Fanfic', 'Não ficção', 'Infantojuvenil', 'Outro'];

export function BookDashboard({ book, api, onOpen, onNew, onExport, role, level }: Props) {
  const supabase = useMemo(() => createClient(), []);
  const [metaMap, setMetaMap] = useState<Record<string, ChapterMeta>>({});
  const [layout, setLayout] = useState<'lista' | 'quadro'>(() => {
    try {
      return (localStorage.getItem('insight-notebook-chapters-view') as 'lista' | 'quadro') || 'lista';
    } catch {
      return 'lista';
    }
  });
  useEffect(() => {
    try {
      localStorage.setItem('insight-notebook-chapters-view', layout);
    } catch {
      /* ignora */
    }
  }, [layout]);
  const [uploading, setUploading] = useState(false);
  const [reading, setReading] = useState<{ title: string; html: string }[] | null>(null);
  const [loadingRead, setLoadingRead] = useState(false);
  const coverRef = useRef<HTMLInputElement>(null);
  const data = book.data as BookData;
  const dataRef = useRef(book.data);
  dataRef.current = book.data;

  const children = useMemo(
    () =>
      Object.values(api.items)
        .filter((i) => i.parent_id === book.id && !i.archived_at)
        .sort((a, b) => a.position - b.position || a.title.localeCompare(b.title, 'pt-BR', { numeric: true })),
    [api.items, book.id]
  );
  const chapters = children.filter((c) => c.template === 'chapter');
  const extras = children.filter((c) => c.template !== 'chapter');
  const chapterKey = chapters.map((c) => c.id).join(',');

  // status de cada capítulo (só a chave, sem baixar o texto)
  useEffect(() => {
    if (!chapters.length) return;
    let alive = true;
    supabase
      .from('notebook_items')
      .select('id, status:data->>status, synopsis:data->>synopsis, pov:data->>pov')
      .in('id', chapters.map((c) => c.id))
      .then(({ data: rows }) => {
        if (!alive || !rows) return;
        const m: Record<string, ChapterMeta> = {};
        rows.forEach((r: any) => (m[r.id] = { status: (r.status as ChapterStatus) || 'rascunho', synopsis: r.synopsis || '', pov: r.pov || null }));
        setMetaMap((prev) => ({ ...m, ...Object.fromEntries(Object.entries(prev).filter(([id]) => touched.current.has(id))) }));
      });
    return () => {
      alive = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [chapterKey, supabase]);

  // dados de capítulos abertos nesta sessão (mais recentes que o banco)
  const touched = useRef<Set<string>>(new Set());
  const metaOf = (c: NotebookItem): ChapterMeta =>
    touched.current.has(c.id) && metaMap[c.id]
      ? metaMap[c.id]
      : c._full
        ? { status: (c.data?.status as ChapterStatus) || 'rascunho', synopsis: String(c.data?.synopsis || ''), pov: (c.data?.pov as string) || null }
        : metaMap[c.id] || { status: 'rascunho', synopsis: '', pov: null };
  const statusOf = (c: NotebookItem): ChapterStatus => metaOf(c).status;

  /** grava sinopse/status/ponto de vista sem perder o resto dos dados do capítulo */
  const saveMeta = async (id: string, patch: Partial<ChapterMeta>) => {
    const c = api.items[id];
    if (!c) return;
    touched.current.add(id);
    setMetaMap((m) => ({ ...m, [id]: { ...metaOf(c), ...patch } }));
    const full = c._full ? api.items[id] : await api.loadFull(id);
    if (!full) return;
    const cur = api.items[id] || full;
    api.update(id, { data: { ...cur.data, ...patch } }, { debounce: 'synopsis' in patch ? 800 : 0 });
  };

  const total = chapters.reduce((n, c) => n + c.word_count, 0);
  const goal = Number(data.wordGoal) || 50000;
  const pct = Math.min(1, total / goal);
  const ready = chapters.filter((c) => ['pronto', 'publicado'].includes(statusOf(c))).length;
  const lastEdited = [...chapters].sort((a, b) => b.updated_at.localeCompare(a.updated_at))[0];

  // heatmap das últimas 12 semanas
  const history = data.history || {};
  const days = useMemo(() => {
    const out: { key: string; n: number; date: Date }[] = [];
    const end = new Date();
    end.setHours(0, 0, 0, 0);
    const start = new Date(end);
    start.setDate(end.getDate() - 7 * 12 + 1 - end.getDay());
    for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
      out.push({ key, n: history[key] || 0, date: new Date(d) });
    }
    return out;
  }, [history]);
  const streak = useMemo(() => {
    let s = 0;
    for (let i = days.length - 1; i >= 0; i--) {
      if (days[i].n > 0) s++;
      else if (i === days.length - 1) continue; // hoje ainda não escreveu
      else break;
    }
    return s;
  }, [days]);
  const daily = Number(data.dailyGoal) || 500;
  const today = days[days.length - 1]?.n || 0;

  const setData = (patch: Partial<BookData>, debounce = 600) => api.update(book.id, { data: { ...dataRef.current, ...patch } }, { debounce });

  async function uploadCover(f: File) {
    setUploading(true);
    try {
      const res = await uploadMediaToInsight(f, {
        budgetBytes: getUserUploadLimitBytes(level ?? 0, role ?? undefined),
        asImage: true,
        scope: 'notebook',
      });
      await api.registerAsset(book.id, res.r2Key, res.publicUrl);
      setData({ coverUrl: res.publicUrl, coverR2Key: res.r2Key }, 0);
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Falha no envio da capa.');
    }
    setUploading(false);
  }

  function reorder(id: string, dir: -1 | 1) {
    const i = chapters.findIndex((c) => c.id === id);
    const j = i + dir;
    if (i < 0 || j < 0 || j >= chapters.length) return;
    const a = chapters[i];
    const b = chapters[j];
    api.update(a.id, { position: b.position });
    api.update(b.id, { position: a.position === b.position ? a.position + dir : a.position });
  }

  async function loadAllChapters() {
    setLoadingRead(true);
    const { data: rows } = await supabase
      .from('notebook_items')
      .select('id, title, html:data->>html')
      .in('id', chapters.map((c) => c.id));
    const byId = new Map((rows || []).map((r: any) => [r.id, r]));
    // capítulos abertos nesta sessão podem estar mais novos que o banco
    const out = chapters.map((c) => {
      const html = c._full ? String(c.data?.html || '') : String((byId.get(c.id) as any)?.html || '');
      return { title: c.title, html: sanitizeWriterHtml(html) };
    });
    setLoadingRead(false);
    return out;
  }

  async function exportMarkdown() {
    const all = await loadAllChapters();
    const md = [
      `# ${book.title}`,
      data.synopsis ? `\n> ${data.synopsis.replace(/\n/g, '\n> ')}\n` : '',
      ...all.map((c, i) => `\n\n## ${i + 1}. ${c.title}\n\n${htmlToText(c.html.replace(/<hr\s*\/?>/g, '\n\n* * *\n\n'))}`),
    ].join('\n');
    const blob = new Blob([md], { type: 'text/markdown;charset=utf-8' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `${book.title.replace(/[^\p{L}\p{N} _-]/gu, '').trim() || 'livro'}.md`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 1000);
  }

  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-8 py-8 space-y-10">
      {/* cabeçalho */}
      <div className="grid sm:grid-cols-[200px_1fr] gap-6 sm:gap-10 items-start">
        <div className="mx-auto w-44 sm:w-full">
          <button
            type="button"
            onClick={() => coverRef.current?.click()}
            className="nb-cover w-full group block"
            style={{
              background: data.coverUrl
                ? `center/cover no-repeat url("${encodeURI(data.coverUrl)}")`
                : `linear-gradient(150deg, ${book.color || '#b45309'}, #1c1917)`,
            }}
            aria-label="Trocar capa"
          >
            {!data.coverUrl && (
              <span className="absolute inset-0 flex flex-col items-center justify-center p-4 text-center text-white">
                <span className="text-[10px] tracking-[0.3em] opacity-70">INSIGHT*</span>
                <span className="mt-6 font-serif text-xl font-bold leading-tight break-words">{book.title}</span>
              </span>
            )}
            <span className="absolute inset-0 grid place-items-center bg-black/50 text-white opacity-0 group-hover:opacity-100 transition-opacity">
              {uploading ? <Loader2 className="w-6 h-6 animate-spin" /> : <ImagePlus className="w-6 h-6" />}
            </span>
          </button>
          {data.coverUrl && (
            <button type="button" onClick={() => setData({ coverUrl: null, coverR2Key: null }, 0)} className="mt-2 w-full text-[11px] text-[var(--nb-ink-3)] hover:text-red-400">
              remover capa
            </button>
          )}
          <input
            ref={coverRef}
            type="file"
            accept="image/*"
            hidden
            onChange={(e) => {
              const f = e.target.files?.[0];
              e.target.value = '';
              if (f) void uploadCover(f);
            }}
          />
        </div>

        <div className="space-y-4 min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <select
              value={data.bookStatus || 'planejando'}
              onChange={(e) => setData({ bookStatus: e.target.value as BookData['bookStatus'] }, 0)}
              className="h-7 px-2 rounded-full bg-[var(--nb-hl-soft)] text-[var(--nb-hl)] text-[11px] font-bold outline-none border-0"
              aria-label="Status do livro"
            >
              {BOOK_STATUS.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.label}
                </option>
              ))}
            </select>
            <select
              value={data.genre || ''}
              onChange={(e) => setData({ genre: e.target.value }, 0)}
              className="h-7 px-2 rounded-full bg-[var(--nb-pane)] border border-[var(--nb-line)] text-[11px] outline-none"
              aria-label="Gênero"
            >
              <option value="">Gênero…</option>
              {GENRES.map((g) => (
                <option key={g}>{g}</option>
              ))}
            </select>
          </div>
          <input
            value={book.title}
            onChange={(e) => api.update(book.id, { title: e.target.value.slice(0, 200) || 'Sem título' }, { debounce: 700 })}
            className="w-full bg-transparent text-3xl sm:text-4xl font-black tracking-tight outline-none font-serif"
            aria-label="Título do livro"
          />
          <textarea
            key={`syn-${book.id}`}
            defaultValue={data.synopsis || ''}
            onChange={(e) => setData({ synopsis: e.target.value.slice(0, 6000) }, 900)}
            rows={4}
            placeholder="Sinopse: em poucas linhas, do que trata a história?"
            className="w-full resize-y rounded-2xl bg-[var(--nb-pane)] border border-[var(--nb-line)] p-4 text-[15px] leading-relaxed outline-none focus:border-[var(--nb-hl)] font-serif"
          />
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => (lastEdited ? onOpen(lastEdited.id) : onNew({ parentId: book.id, template: 'chapter' }))}
              className="flex items-center gap-2 h-10 px-4 rounded-xl bg-[var(--nb-hl)] text-white text-sm font-bold hover:opacity-90"
            >
              <PenLine className="w-4 h-4" />
              {lastEdited ? 'Continuar escrevendo' : 'Escrever o capítulo 1'}
            </button>
            <button
              type="button"
              disabled={!chapters.length || loadingRead}
              onClick={async () => setReading(await loadAllChapters())}
              className="flex items-center gap-2 h-10 px-4 rounded-xl border border-[var(--nb-line)] text-sm font-semibold hover:bg-[var(--nb-pane-2)] disabled:opacity-40"
            >
              {loadingRead ? <Loader2 className="w-4 h-4 animate-spin" /> : <BookOpenText className="w-4 h-4" />}
              Ler como livro
            </button>
            <button
              type="button"
              disabled={!chapters.length}
              onClick={() => void exportMarkdown()}
              className="flex items-center gap-2 h-10 px-4 rounded-xl border border-[var(--nb-line)] text-sm font-semibold hover:bg-[var(--nb-pane-2)] disabled:opacity-40"
            >
              <Download className="w-4 h-4" /> Exportar .md
            </button>
          </div>
        </div>
      </div>

      {/* números */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <Stat label="Palavras" value={total.toLocaleString('pt-BR')} hint={`meta ${goal.toLocaleString('pt-BR')}`}>
          <div className="mt-2 h-1.5 rounded-full bg-[var(--nb-line)] overflow-hidden">
            <div className="h-full rounded-full bg-[var(--nb-hl)] transition-[width]" style={{ width: `${pct * 100}%` }} />
          </div>
        </Stat>
        <Stat label="Capítulos" value={String(chapters.length)} hint={`${ready} prontos`} />
        <Stat label="Páginas" value={`~${Math.max(0, Math.round(total / 250))}`} hint={`${Math.max(0, Math.round(total / 220))} min de leitura`} />
        <Stat label="Sequência" value={`${streak} ${streak === 1 ? 'dia' : 'dias'}`} hint={`hoje ${today}/${daily}`} icon={<Flame className={`w-4 h-4 ${streak ? 'text-orange-400' : ''}`} />} />
      </div>

      {/* metas + heatmap */}
      <div className="rounded-2xl border border-[var(--nb-line)] bg-[var(--nb-pane)] p-4 sm:p-5 space-y-4">
        <div className="flex flex-wrap items-center gap-4 text-[12px]">
          <label className="flex items-center gap-2">
            <span className="text-[var(--nb-ink-3)]">Meta do livro</span>
            <input
              type="number"
              min={1000}
              step={1000}
              defaultValue={goal}
              key={`g-${book.id}`}
              onChange={(e) => setData({ wordGoal: Math.max(1000, Number(e.target.value) || 0) }, 800)}
              className="w-24 h-7 px-2 rounded-lg bg-[var(--nb-bg)] border border-[var(--nb-line)] outline-none font-mono"
            />
          </label>
          <label className="flex items-center gap-2">
            <span className="text-[var(--nb-ink-3)]">Meta diária</span>
            <input
              type="number"
              min={50}
              step={50}
              defaultValue={daily}
              key={`d-${book.id}`}
              onChange={(e) => setData({ dailyGoal: Math.max(50, Number(e.target.value) || 0) }, 800)}
              className="w-20 h-7 px-2 rounded-lg bg-[var(--nb-bg)] border border-[var(--nb-line)] outline-none font-mono"
            />
          </label>
          <span className="text-[var(--nb-ink-3)]">palavras escritas por dia · últimas 12 semanas</span>
        </div>
        <div className="overflow-x-auto" style={{ scrollbarWidth: 'thin' }}>
          <div className="grid grid-flow-col grid-rows-7 gap-[3px] w-max">
            {days.map((d) => {
              const lvl = d.n === 0 ? 0 : d.n < daily * 0.34 ? 1 : d.n < daily * 0.67 ? 2 : d.n < daily ? 3 : 4;
              return (
                <span
                  key={d.key}
                  title={`${d.date.toLocaleDateString('pt-BR')}: ${d.n} palavras`}
                  className="w-3 h-3 rounded-[3px]"
                  style={{
                    background: lvl ? `color-mix(in srgb, var(--nb-hl) ${[0, 30, 55, 80, 100][lvl]}%, var(--nb-pane-2))` : 'var(--nb-pane-2)',
                  }}
                />
              );
            })}
          </div>
        </div>
      </div>

      {/* capítulos */}
      <section className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-black">Capítulos</h2>
          <div className="flex-1" />
          <div className="flex items-center gap-0.5 mr-2 p-0.5 rounded-lg border border-[var(--nb-line)]" role="group" aria-label="Visualização dos capítulos">
            <button
              type="button"
              title="Lista"
              aria-label="Lista"
              aria-pressed={layout === 'lista'}
              onClick={() => setLayout('lista')}
              className={`p-1.5 rounded-md ${layout === 'lista' ? 'bg-[var(--nb-pane-2)] text-[var(--nb-ink)]' : 'text-[var(--nb-ink-3)] hover:text-[var(--nb-ink)]'}`}
            >
              <List className="w-3.5 h-3.5" />
            </button>
            <button
              type="button"
              title="Quadro de cenas"
              aria-label="Quadro de cenas"
              aria-pressed={layout === 'quadro'}
              onClick={() => setLayout('quadro')}
              className={`p-1.5 rounded-md ${layout === 'quadro' ? 'bg-[var(--nb-pane-2)] text-[var(--nb-ink)]' : 'text-[var(--nb-ink-3)] hover:text-[var(--nb-ink)]'}`}
            >
              <LayoutGrid className="w-3.5 h-3.5" />
            </button>
          </div>
          <button
            type="button"
            onClick={() => onNew({ parentId: book.id, template: 'chapter' })}
            className="flex items-center gap-1.5 h-8 px-3 rounded-lg bg-[var(--nb-pane-2)] text-xs font-bold hover:text-[var(--nb-hl)]"
          >
            <Plus className="w-3.5 h-3.5" /> Novo capítulo
          </button>
        </div>
        {chapters.length === 0 ? (
          <p className="py-10 text-center text-sm text-[var(--nb-ink-3)] rounded-2xl border border-dashed border-[var(--nb-line)]">
            Nenhum capítulo ainda. Toda grande história começa com uma página em branco.
          </p>
        ) : layout === 'quadro' ? (
          <Corkboard chapters={chapters} meta={metaOf} api={api} onMeta={(id, p) => void saveMeta(id, p)} onOpen={onOpen} />
        ) : (
          <ol className="rounded-2xl border border-[var(--nb-line)] overflow-hidden divide-y divide-[var(--nb-line)]">
            {chapters.map((c, i) => {
              const st = CHAPTER_STATUS.find((s) => s.id === statusOf(c))!;
              return (
                <li key={c.id} data-item-id={c.id} className="group flex items-center gap-3 px-3 sm:px-4 py-3 bg-[var(--nb-pane)] hover:bg-[var(--nb-pane-2)]">
                  <span className="w-7 text-right font-mono text-xs text-[var(--nb-ink-3)]">{i + 1}</span>
                  <button type="button" onClick={() => onOpen(c.id)} className="flex-1 min-w-0 text-left">
                    <span className="block truncate font-semibold font-serif text-[15px]">{c.title}</span>
                    <span className="text-[11px] text-[var(--nb-ink-3)]">
                      {c.word_count.toLocaleString('pt-BR')} palavras · editado {new Date(c.updated_at).toLocaleDateString('pt-BR')}
                    </span>
                  </button>
                  <span
                    className="hidden sm:inline-flex px-2 py-0.5 rounded-full text-[10px] font-bold"
                    style={{ color: st.color, background: `color-mix(in srgb, ${st.color} 15%, transparent)` }}
                  >
                    {st.label}
                  </span>
                  <div className="flex flex-col opacity-40 group-hover:opacity-100">
                    <button type="button" aria-label="Subir" onClick={() => reorder(c.id, -1)} className="hover:text-[var(--nb-hl)]">
                      <ArrowUp className="w-3.5 h-3.5" />
                    </button>
                    <button type="button" aria-label="Descer" onClick={() => reorder(c.id, 1)} className="hover:text-[var(--nb-hl)]">
                      <ArrowDown className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </li>
              );
            })}
          </ol>
        )}
      </section>

      {/* material de apoio */}
      <section className="space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="text-lg font-black">Material de apoio</h2>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => onNew({ parentId: book.id, template: 'character' })}
              className="flex items-center gap-1.5 h-8 px-3 rounded-lg bg-[var(--nb-pane-2)] text-xs font-bold hover:text-[var(--nb-hl)]"
            >
              <UserRound className="w-3.5 h-3.5" /> Personagem
            </button>
            <button
              type="button"
              onClick={() => onNew({ parentId: book.id, template: 'world' })}
              className="flex items-center gap-1.5 h-8 px-3 rounded-lg bg-[var(--nb-pane-2)] text-xs font-bold hover:text-[var(--nb-hl)]"
            >
              <MapIcon className="w-3.5 h-3.5" /> Mundo
            </button>
            <button
              type="button"
              onClick={() => onNew({ parentId: book.id, template: 'mindmap' })}
              className="flex items-center gap-1.5 h-8 px-3 rounded-lg bg-[var(--nb-pane-2)] text-xs font-bold hover:text-[var(--nb-hl)]"
            >
              <Glyph name="mindmap" className="text-[14px]" /> Mapa da trama
            </button>
            {onExport && (
              <button
                type="button"
                onClick={onExport}
                className="flex items-center gap-1.5 h-8 px-3 rounded-lg bg-[var(--nb-pane-2)] text-xs font-bold hover:text-[var(--nb-hl)]"
              >
                <Download className="w-3.5 h-3.5" /> Exportar livro
              </button>
            )}
          </div>
        </div>
        {extras.length > 0 ? (
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-2">
            {extras.map((x) => (
              <button
                key={x.id}
                type="button"
                data-item-id={x.id}
                  onClick={() => onOpen(x.id)}
                className="flex items-center gap-3 p-3 rounded-xl border border-[var(--nb-line)] bg-[var(--nb-pane)] hover:border-[var(--nb-hl)] text-left"
              >
                <span className="text-xl">{itemIcon(x)}</span>
                <span className="min-w-0">
                  <span className="block truncate text-sm font-semibold">{x.title}</span>
                  <span className="text-[11px] text-[var(--nb-ink-3)]">{x.word_count} palavras</span>
                </span>
              </button>
            ))}
          </div>
        ) : (
          <p className="text-xs text-[var(--nb-ink-3)]">Fichas de personagens, mapas do mundo e da trama ficam aqui, ao lado dos capítulos.</p>
        )}
      </section>

      {/* leitura contínua */}
      {reading && (
        <div className="nb-modal-back !p-0 sm:!p-6 !items-stretch" onClick={() => setReading(null)}>
          <div
            className="nb-writer relative w-full max-w-3xl mx-auto overflow-y-auto nb-scroll rounded-none sm:rounded-2xl"
            data-paper="sepia"
            onClick={(e) => e.stopPropagation()}
            style={{ ['--paper-font' as string]: "var(--nb-literata), Georgia, serif" }}
          >
            <button
              type="button"
              onClick={() => setReading(null)}
              className="sticky top-3 float-right mr-3 z-10 p-2 rounded-full bg-black/40 text-white"
              aria-label="Fechar leitura"
            >
              <X className="w-4 h-4" />
            </button>
            <article className="nb-paper-sheet nb-book-read px-8 sm:px-16 py-16 text-[18px] leading-[1.85]" style={{ fontFamily: 'var(--paper-font)' }}>
              <h1 className="text-center text-4xl font-bold mb-2">{book.title}</h1>
              {data.synopsis && <p className="!indent-0 text-center italic opacity-70 mb-10">{data.synopsis}</p>}
              {reading.map((c, i) => (
                <section key={i}>
                  <h2>
                    <span className="block text-[12px] tracking-[0.3em] opacity-60 mb-2">CAPÍTULO {i + 1}</span>
                    {c.title}
                  </h2>
                  {/* HTML passou pela lista branca sanitizeWriterHtml */}
                  <div dangerouslySetInnerHTML={{ __html: sanitizeUserHtml(c.html) }} />
                </section>
              ))}
              <p className="!indent-0 text-center mt-16 opacity-50 tracking-[0.4em] text-xs">FIM</p>
            </article>
          </div>
        </div>
      )}
    </div>
  );
}

function Stat({ label, value, hint, children, icon }: { label: string; value: string; hint?: string; children?: React.ReactNode; icon?: React.ReactNode }) {
  return (
    <div className="rounded-2xl border border-[var(--nb-line)] bg-[var(--nb-pane)] p-4">
      <p className="nb-pane-title flex items-center gap-1.5">
        {icon}
        {label}
      </p>
      <p className="mt-1 text-2xl font-black tracking-tight">{value}</p>
      {hint && <p className="text-[11px] text-[var(--nb-ink-3)]">{hint}</p>}
      {children}
    </div>
  );
}
