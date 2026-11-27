'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import {
  Files,
  Eye,
  Images,
  Inbox,
  ListTodo,
  Search,
  Network,
  CalendarDays,
  BookPlus,
  LayoutTemplate,
  Command,
  ArrowLeft,
  PanelRight,
  X,
  Check,
  CloudOff,
  Loader2,
  AlertTriangle,
  Send,
  MoreHorizontal,
  Copy,
  Trash2,
  Pin,
  Home,
  ChevronRight,
  FilePlus2,
  FolderPlus,
  Lock,
  Sparkles,
  PenLine,
  Brain,
  Layers,
  PanelLeftOpen,
  PanelLeftClose,
  Maximize2,
  Minimize2,
  BookMarked,
  Download,
  Upload,
  Columns2,
  Timer,
  Camera,
  GitCompareArrows,
  LayoutGrid,
  Hash,
  Shuffle,
} from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import { InsightAsterisk } from '@/components/brand/InsightAsterisk';
import { PostComposer } from '@/components/feed/PostComposer';
import { TopicWorkspaceView } from '@/components/feed/TopicWorkspaceView';
import { useNotebook, type NotebookApi } from '@/lib/notebook/useNotebook';
import { getTemplate, WORKSPACE_TEMPLATES, type NotebookTemplateDef } from '@/lib/notebook/templates';
import { htmlToPostBlocks, itemToPostBlocks } from '@/lib/notebook/toPostBlocks';
import { articleData } from '@/lib/notebook/article';
import { buildArticle, referenceHtml } from '@/lib/notebook/articleRender';
import type { Source } from '@/lib/notebook/sources';
import type { NotebookItem, NotebookTemplate } from '@/lib/notebook/types';
import type { PostBlock, TopicTemplateType, TopicWorkspaceData } from '@/types/database';
import { FileExplorer, itemIcon } from './FileExplorer';
import { Glyph } from './icons/Glyph';
import { NotebookSplash, NotebookSplashExit } from './NotebookSplash';
import type { GlyphName } from '@/lib/notebook/glyphs';
import { MarkdownEditor } from './MarkdownEditor';
import { WriterMode } from './WriterMode';
import { BookDashboard } from './BookDashboard';
import { CharacterSheet } from './character/CharacterSheet';
import { NoteEditor } from './editor/NoteEditor';
import { ProjectHome } from './projects/ProjectHome';
import { MapStudio } from './map/MapStudio';
import { CANVAS_CMD_EVENT, CANVAS_FRAMES_EVENT, CanvasStudio } from './canvas/CanvasStudio';
import { TrashDialog } from './trash/TrashDialog';
import { AssetLibrary } from './assets/AssetLibrary';
import { BackupDialog } from './backup/BackupDialog';
import { ProofReader } from './publication/ProofReader';
import { TodoPanel } from './todos/TodoPanel';
import { QUICK_CAPTURE_EVENT, QUICK_CAPTURED_EVENT } from './QuickCapture';
import { CANVAS_TEMPLATES } from '@/lib/notebook/canvasTemplates';
import { ArticleMode } from './article/ArticleMode';
import { ContextMenuProvider } from './menu/ContextMenu';
import { GlobalContextMenus, type GlobalMenuActions } from './menu/GlobalMenus';
import { WorldCalendar } from './worldtime/WorldCalendar';
import { Chronos } from './worldtime/Chronos';
import { ExportDialog, ImportResultDialog } from './interop/InteropDialogs';
import { IMPORT_ACCEPT, importFiles, type ImportResult } from '@/lib/notebook/interop';
import { EntryDialog } from './entries/EntryDialog';
import { EntryPopover } from './entries/EntryPopover';
import { SummaryView } from './entries/SummaryView';
import { useEntries } from '@/lib/notebook/useEntries';
import { entryLook, type EntryKind, type NotebookEntry } from '@/lib/notebook/entries';
import { NewProjectDialog, type NewProjectInput } from './projects/NewProjectDialog';
import { isProject, projectType } from '@/lib/notebook/projects';
import { NotebookLinksContext } from './editor/linkContext';
import { convertCharacterItem } from './character/convert';
import { NOTEBOOK_FEATURES } from '@/lib/notebook/copy';
import { uploadMediaToInsight } from '@/lib/mediaCompressor';
import { getUserUploadLimitBytes } from '@/lib/contributorLevels';
import { GraphView } from './GraphView';
import { RightPanel } from './RightPanel';
import { SearchPanel, TemplatePicker } from './Pickers';
import { CommandPalette, type PaletteCommand, type PaletteHeading, type PaletteMode } from './palette/CommandPalette';
import { SplitPane, SPLIT_MIN, type SplitTarget } from './split/SplitPane';
import { SessionPill, SessionStartDialog, SessionSummaryDialog, useWritingSession } from './session/WritingSession';
import type { RightTab } from './RightPanel';
import { extractHeadings } from '@/lib/notebook/markdown';
import { useCodex } from '@/lib/notebook/useCodex';
import { codexData, isEmptyValue, valueText } from '@/lib/notebook/codex';
import { isWorld } from '@/lib/notebook/projects';
import { WorldContext, useSecrets, type WorldTools } from './world/WorldContext';
import { WorldHub } from './world/WorldHub';
import { projectOf } from './entries/MentionContext';
import { StudioVerbetesDialog, useStudioTagger } from './world/StudioLinks';
import type { EntriesApi } from '@/lib/notebook/useEntries';
import './notebook.css';
import { NOTEBOOK_NAME } from '@/lib/notebook/copy';

interface Viewer {
  id: string;
  username: string;
  display_name: string | null;
  full_name: string | null;
  avatar_url: string | null;
  role: string | null;
  contributor_level: number | null;
}

type LeftMode = 'files' | 'search' | 'todos' | null;
type MainView = 'home' | 'note' | 'graph' | 'summary';

const TABS_KEY = 'insight-notebook-tabs';
const LAYOUT_KEY = 'insight-notebook-layout';

const isoToday = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};
const escRe = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

// ============================================================================
// Porta de entrada: confere sessão e acesso (beta fechada)
// ============================================================================

export function NotebookApp() {
  const supabase = useMemo(() => createClient(), []);
  const [viewer, setViewer] = useState<Viewer | null>(null);
  const [access, setAccess] = useState<'loading' | 'ok' | 'locked' | 'anon'>('loading');

  useEffect(() => {
    let alive = true;
    (async () => {
      const {
        data: { session },
      } = await supabase.auth.getSession();
      if (!session?.user) {
        if (alive) setAccess('anon');
        return;
      }
      const [{ data: prof }, { data: allowed }] = await Promise.all([
        supabase
          .from('profiles')
          .select('id, username, display_name, full_name, avatar_url, role, contributor_level')
          .or(`user_id.eq.${session.user.id},id.eq.${session.user.id}`)
          .maybeSingle(),
        supabase.rpc('notebook_has_access'),
      ]);
      if (!alive) return;
      setViewer((prof as Viewer) || null);
      setAccess(prof && allowed ? 'ok' : 'locked');
    })();
    return () => {
      alive = false;
    };
  }, [supabase]);

  if (access === 'loading') {
    return (
      <div className="nb-app">
        <NotebookSplash />
      </div>
    );
  }
  if (access !== 'ok' || !viewer) return <NotebookLocked anon={access === 'anon'} />;
  return <NotebookWorkspace viewer={viewer} />;
}

// ============================================================================
// Tela bloqueada
// ============================================================================

function NotebookLocked({ anon }: { anon: boolean }) {
  const features = [
    { icon: <Brain className="w-5 h-5" />, t: 'Segundo cérebro', d: 'Notas ligadas por [[links]], tags, grafo de ideias e busca instantânea.' },
    { icon: <PenLine className="w-5 h-5" />, t: 'Modo escritor', d: 'Escreva seu livro capítulo a capítulo, com metas, foco e publicação no Insight.' },
    { icon: <Layers className="w-5 h-5" />, t: 'Modelos', d: 'Diário, roteiro, estudos, metas, hábitos, mapas mentais e os seus próprios.' },
  ];
  return (
    <div className="nb-app overflow-y-auto">
      <div className="nb-locked-glow absolute inset-0 pointer-events-none" />
      <div className="relative min-h-full flex flex-col items-center justify-center px-6 py-16 text-center">
        <div className="w-16 h-16 rounded-2xl grid place-items-center bg-[var(--nb-pane)] border border-[var(--nb-line)] shadow-2xl">
          <Lock className="w-7 h-7 text-[var(--nb-hl)]" />
        </div>
        <p className="mt-6 text-[11px] font-black tracking-[0.3em] text-[var(--nb-hl)]">EM BREVE</p>
        <h1 className="mt-2 text-4xl sm:text-5xl font-black tracking-tight">{NOTEBOOK_NAME}</h1>
        <p className="mt-4 max-w-lg text-[var(--nb-ink-2)]">
          Um espaço livre de criação dentro do Insight: escreva, organize, conecte ideias e publique quando estiver pronto.
          {anon ? ' Entre na sua conta para acompanhar a liberação.' : ' Estamos em testes fechados — logo chega para você.'}
        </p>
        <div className="mt-10 grid sm:grid-cols-3 gap-3 max-w-3xl w-full">
          {features.map((f) => (
            <div key={f.t} className="text-left p-4 rounded-2xl bg-[var(--nb-pane)]/80 border border-[var(--nb-line)] backdrop-blur">
              <span className="text-[var(--nb-hl)]">{f.icon}</span>
              <p className="mt-2 font-bold">{f.t}</p>
              <p className="text-[13px] text-[var(--nb-ink-3)] leading-snug">{f.d}</p>
            </div>
          ))}
        </div>
        <div className="mt-10 flex gap-3">
          <Link href="/" className="flex items-center gap-2 h-10 px-4 rounded-xl border border-[var(--nb-line)] text-sm font-semibold hover:bg-[var(--nb-pane)]">
            <ArrowLeft className="w-4 h-4" /> Voltar ao Insight
          </Link>
          {anon && (
            <Link href="/login" className="flex items-center h-10 px-4 rounded-xl bg-[var(--nb-hl)] text-white text-sm font-bold">
              Entrar
            </Link>
          )}
        </div>
      </div>
    </div>
  );
}

// ============================================================================
// Área de trabalho
// ============================================================================

function NotebookWorkspace({ viewer }: { viewer: Viewer }) {
  const api = useNotebook(viewer.id);
  const entriesApi = useEntries(viewer.id);

  // Preview: converte de uma vez todas as fichas de personagem antigas (texto)
  const swept = useRef(false);
  useEffect(() => {
    if (swept.current || api.loading || !NOTEBOOK_FEATURES.characterSheet) return;
    swept.current = true;
    const ids = Object.values(api.items)
      .filter((i) => i.template === 'character' && !i.archived_at)
      .map((i) => i.id);
    void (async () => {
      for (const id of ids) await convertCharacterItem(api, id);
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [api.loading]);
  const [tabs, setTabs] = useState<string[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [view, setView] = useState<MainView>('home');
  const [left, setLeft] = useState<LeftMode>('files');
  const [right, setRight] = useState(false);
  const [picker, setPicker] = useState<{ parentId: string | null } | null>(null);
  const [publishing, setPublishing] = useState<{ item: NotebookItem; blocks: PostBlock[]; publicationId?: string } | null>(null);
  const [proof, setProof] = useState<string | null>(null);
  const [immersive, setImmersive] = useState(false);
  const [sideHidden, setSideHidden] = useState(false);
  const [projectDialog, setProjectDialog] = useState(false);
  const [exporting, setExporting] = useState<NotebookItem | null>(null);
  const [importResult, setImportResult] = useState<ImportResult | 'busy' | null>(null);
  const [exportingAll] = useState(false);
  const importTarget = useRef<string | null>(null);
  const importInput = useRef<HTMLInputElement>(null);
  const [summaryProject, setSummaryProject] = useState<string | null | undefined>(undefined);
  const [summaryFocus, setSummaryFocus] = useState<string | null>(null);
  const [entryReq, setEntryReq] = useState<{ text: string; resolve: (v: { id: string; kind: EntryKind } | null) => void } | null>(null);
  const [searchSeed, setSearchSeed] = useState<string | undefined>();
  const [jump, setJump] = useState<{ line: number; at: number } | null>(null);
  const [reloadKey, setReloadKey] = useState(0);
  const [menuOpen, setMenuOpen] = useState(false);
  const [recent, setRecent] = useState<string[]>([]);
  const [palette, setPalette] = useState<{ mode: PaletteMode; aside: boolean } | null>(null);
  const [split, setSplit] = useState<SplitTarget | null>(null);
  const [splitW, setSplitW] = useState(440);
  const [rightTabReq, setRightTabReq] = useState<{ tab: RightTab; at: number } | null>(null);
  const [sessionDialog, setSessionDialog] = useState(false);
  const session = useWritingSession(api, viewer.id);
  const codex = useCodex(viewer.id);
  const [trashOpen, setTrashOpen] = useState(false);
  const [libOpen, setLibOpen] = useState(false);
  // quadros do canvas aberto (âncoras da paleta)
  const [canvasFrames, setCanvasFrames] = useState<{ id: string; frames: { id: string; label: string }[] }>({ id: '', frames: [] });
  useEffect(() => {
    const h = (e: Event) => setCanvasFrames((e as CustomEvent<{ id: string; frames: { id: string; label: string }[] }>).detail);
    window.addEventListener(CANVAS_FRAMES_EVENT, h);
    return () => window.removeEventListener(CANVAS_FRAMES_EVENT, h);
  }, []);
  // ideia capturada (Ctrl+Alt+N) com o Notebook aberto: aparece na hora na Caixa de entrada
  useEffect(() => {
    const h = () => void api.reload();
    window.addEventListener(QUICK_CAPTURED_EVENT, h);
    return () => window.removeEventListener(QUICK_CAPTURED_EVENT, h);
  }, [api]);
  /** leva até a n-ésima pendência da nota (rola o editor e pisca o trecho) */
  const goTodo = (id: string, index: number, text: string) => {
    open(id);
    if (typeof window !== 'undefined' && window.innerWidth < 1024) setLeft(null);
    if (api.items[id]?.template === 'canvas') {
      setTimeout(() => window.dispatchEvent(new CustomEvent(CANVAS_CMD_EVENT, { detail: { id, cmd: `focusText:${text}` } })), 600);
      return;
    }
    let tries = 0;
    const t = setInterval(() => {
      const els = document.querySelectorAll<HTMLElement>('main [data-todo]');
      const el = els[index] || Array.from(els).find((e) => e.textContent?.trim() === text.trim());
      if (el || ++tries > 25) {
        clearInterval(t);
        if (!el) return;
        el.scrollIntoView({ block: 'center', behavior: 'smooth' });
        el.classList.add('nb-flash');
        setTimeout(() => el.classList.remove('nb-flash'), 1400);
      }
    }, 120);
  };
  const [secretsShown, setSecretsShown] = useSecrets();
  const restored = useRef(false);

  // ------------------------------------------------------------ layout salvo
  useEffect(() => {
    try {
      const l = JSON.parse(localStorage.getItem(LAYOUT_KEY) || 'null');
      const small = window.innerWidth < 1024;
      if (l) {
        setLeft(small ? null : l.left ?? 'files');
        setRight(small ? false : !!l.right);
        setSideHidden(!!l.sideHidden);
        if (!small && l.split && (l.split.kind === 'item' || l.split.kind === 'entry') && typeof l.split.id === 'string') setSplit(l.split);
        if (typeof l.splitW === 'number') setSplitW(Math.max(SPLIT_MIN, Math.min(1400, l.splitW)));
      } else if (small) setLeft(null);
    } catch {
      /* ignora */
    }
  }, []);
  useEffect(() => {
    if (typeof window === 'undefined' || window.innerWidth < 1024) return;
    try {
      localStorage.setItem(LAYOUT_KEY, JSON.stringify({ left, right, sideHidden, split, splitW }));
    } catch {
      /* ignora */
    }
  }, [left, right, sideHidden, split, splitW]);

  // abas + nota da URL
  useEffect(() => {
    if (restored.current || api.loading) return;
    restored.current = true;
    try {
      const saved = JSON.parse(localStorage.getItem(TABS_KEY) || 'null');
      const fromUrl = new URLSearchParams(window.location.search).get('n');
      const valid = (id: string) => !!api.items[id] && !api.items[id].archived_at;
      const t: string[] = (saved?.tabs || []).filter(valid);
      const act = fromUrl && valid(fromUrl) ? fromUrl : saved?.active && valid(saved.active) ? saved.active : null;
      if (act && !t.includes(act)) t.push(act);
      setTabs(t);
      setRecent((saved?.recent || []).filter(valid));
      if (act) {
        setActiveId(act);
        setView('note');
      }
    } catch {
      /* ignora */
    }
  }, [api.loading, api.items]);

  useEffect(() => {
    if (!restored.current) return;
    try {
      localStorage.setItem(TABS_KEY, JSON.stringify({ tabs, active: activeId, recent }));
    } catch {
      /* ignora */
    }
    const url = new URL(window.location.href);
    if (view === 'note' && activeId) url.searchParams.set('n', activeId);
    else url.searchParams.delete('n');
    window.history.replaceState(window.history.state, '', url.toString());
  }, [tabs, activeId, recent, view]);

  // itens apagados / na lixeira somem das abas (derivado, sem efeito com setState)
  const isLive = (id: string | null) => !!id && !!api.items[id] && !api.items[id].archived_at;
  const liveTabs = tabs.filter(isLive);
  const active = isLive(activeId) ? api.items[activeId!] : null;
  // nota ativa foi para a lixeira/apagada: mostra o início
  const shown: MainView = view === 'note' && !active ? 'home' : view;

  // carrega conteúdo completo da nota ativa
  useEffect(() => {
    if (activeId && api.items[activeId] && !api.items[activeId]._full) void api.loadFull(activeId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeId, api.items[activeId || '']?._full]);

  // recarregar editor (ex.: versão restaurada)
  useEffect(() => {
    const on = () => setReloadKey((k) => k + 1);
    window.addEventListener('insight-notebook-reload', on);
    return () => window.removeEventListener('insight-notebook-reload', on);
  }, []);

  const open = useCallback(
    (id: string) => {
      // (item recém-criado pode ainda não estar no estado: abas ignoram ids inexistentes)
      if (!id) return;
      setTabs((t) => (t.includes(id) ? t : [...t, id].slice(-12)));
      setActiveId(id);
      setView('note');
      setRecent((r) => [id, ...r.filter((x) => x !== id)].slice(0, 15));
      setMenuOpen(false);
      if (window.innerWidth < 1024) setLeft(null);
    },
    [api.items]
  );

  const closeTab = (id: string) => {
    setTabs((t) => {
      const i = t.indexOf(id);
      const n = t.filter((x) => x !== id);
      if (id === activeId) {
        const next = n[Math.min(i, n.length - 1)] || null;
        setActiveId(next);
        setView(next ? 'note' : 'home');
      }
      return n;
    });
  };

  const titles = useMemo(
    () => Object.values(api.items).filter((i) => !i.archived_at && i.kind === 'note').map((i) => i.title),
    [api.items]
  );
  const titleIndex = useMemo(() => {
    const m = new Map<string, string>();
    Object.values(api.items)
      .filter((i) => !i.archived_at)
      .sort((a, b) => (a.kind === 'note' ? -1 : 1) - (b.kind === 'note' ? -1 : 1))
      .forEach((i) => {
        const k = i.title.toLowerCase();
        if (!m.has(k)) m.set(k, i.id);
      });
    return m;
  }, [api.items]);
  const titleExists = useCallback((t: string) => titleIndex.has(t.toLowerCase()), [titleIndex]);

  // ------------------------------------------------------------ criar
  const createAndOpen = useCallback(
    async (opts: { template?: string; parentId?: string | null; title?: string; from?: NotebookItem }) => {
      const template = (opts.template || 'markdown') as NotebookTemplate;
      // pasta no primeiro nível = projeto: abre a criação guiada
      if (template === 'folder' && !opts.parentId && !opts.from && !opts.title) {
        setProjectDialog(true);
        return null;
      }
      const item = await api.create({ template, parentId: opts.parentId ?? null, title: opts.title, from: opts.from });
      if (item) {
        open(item.id);
        // livro novo já ganha o capítulo 1
        if (item.template === 'book' && !opts.from) {
          await api.create({ template: 'chapter', parentId: item.id, title: 'Capítulo 1' });
        }
      }
      return item;
    },
    [api, open]
  );

  const startImport = useCallback((parentId: string | null) => {
    importTarget.current = parentId;
    importInput.current?.click();
  }, []);
  const [backupOpen, setBackupOpen] = useState(false);
  const runExportAll = useCallback(async () => setBackupOpen(true), []);

  const createProject = useCallback(
    async (p: NewProjectInput) => {
      const def = projectType(p.type);
      const proj = await api.create({ template: 'folder', parentId: null, title: p.name });
      if (!proj) return;
      api.update(proj.id, { icon: def.glyph, data: { ...(proj.data || {}), project: { type: p.type, description: p.description } } });
      if (p.starter) {
        for (const st of def.starter) {
          const child = await api.create({ template: st.template, parentId: proj.id, title: st.title || p.name });
          if (child?.template === 'book') await api.create({ template: 'chapter', parentId: child.id, title: 'Capítulo 1' });
        }
      }
      open(proj.id);
    },
    [api, open]
  );

  const newInContext = useCallback(
    (template = 'markdown') => {
      const cur = activeId ? api.items[activeId] : null;
      const parentId = cur ? (cur.kind === 'folder' ? cur.id : cur.parent_id) : null;
      const parent = parentId ? api.items[parentId] : null;
      const t = template === 'markdown' && parent?.template === 'book' ? 'chapter' : template;
      return createAndOpen({ template: t, parentId });
    },
    [activeId, api.items, createAndOpen]
  );

  const openOrCreateLink = useCallback(
    async (title: string) => {
      const clean = title.split('#')[0].trim();
      if (!clean) return;
      const id = titleIndex.get(clean.toLowerCase());
      if (id) return open(id);
      const cur = activeId ? api.items[activeId] : null;
      await createAndOpen({ template: 'markdown', parentId: cur?.kind === 'folder' ? cur.id : cur?.parent_id ?? null, title: clean });
    },
    [activeId, api.items, createAndOpen, open, titleIndex]
  );

  const openDaily = useCallback(async () => {
    const today = isoToday();
    const existing = Object.values(api.items).find((i) => !i.archived_at && i.template === 'journal' && i.title === today);
    if (existing) return open(existing.id);
    let folder = Object.values(api.items).find((i) => !i.archived_at && i.kind === 'folder' && !i.parent_id && i.title === 'Diário');
    if (!folder) folder = (await api.create({ template: 'folder', parentId: null, title: 'Diário' })) || undefined;
    if (folder && !folder.icon) api.update(folder.id, { icon: 'journal' });
    await createAndOpen({ template: 'journal', parentId: folder?.id ?? null, title: today });
  }, [api, createAndOpen, open]);

  // renomear atualiza [[links]] das outras notas
  const rename = useCallback(
    async (id: string, title: string) => {
      const cur = api.items[id];
      if (!cur) return;
      const old = cur.title;
      const nextTitle = title.slice(0, 200).trim() || 'Sem título';
      api.update(id, { title: nextTitle });
      if (old.toLowerCase() === nextTitle.toLowerCase()) return;
      const refs = Object.values(api.items).filter(
        (i) => i.id !== id && !i.archived_at && i.links.some((l) => l.toLowerCase() === old.toLowerCase())
      );
      const re = new RegExp(`(!?\\[\\[)${escRe(old)}(?=(\\]\\]|\\||#))`, 'gi');
      for (const r of refs) {
        const full = await api.loadFull(r.id);
        if (!full || full.template === 'chapter' || full.template === 'blocks' || full.template === 'book') continue;
        const content = full.content.replace(re, `$1${nextTitle}`);
        if (content !== full.content) api.update(r.id, { content });
      }
      if (refs.length) setReloadKey((k) => k + 1);
    },
    [api]
  );

  // ------------------------------------------------------------ atalhos
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !e.defaultPrevented) {
        setImmersive((v) => (v ? false : v));
        return;
      }
      const mod = e.ctrlKey || e.metaKey;
      if (!mod) return;
      const k = e.key.toLowerCase();
      if (e.code === 'Backslash' && e.shiftKey) {
        e.preventDefault();
        setSideHidden((v) => !v);
        return;
      }
      if (k === '.') {
        e.preventDefault();
        setImmersive((v) => !v);
        return;
      }
      if (k === 'p' && e.shiftKey) {
        e.preventDefault();
        setPalette({ mode: '>', aside: false });
      } else if (k === 'o' || (k === 'k' && !(e.target as HTMLElement)?.closest?.('textarea'))) {
        e.preventDefault();
        setPalette({ mode: '', aside: false });
      } else if (k === 'r' && e.altKey && activeId && view === 'note') {
        e.preventDefault();
        setProof(activeId);
      } else if (k === 'n' && !e.shiftKey && !e.altKey) {
        e.preventDefault();
        void newInContext();
      } else if (k === 'f' && e.shiftKey) {
        e.preventDefault();
        setLeft('search');
      } else if (k === 'g' && !e.shiftKey) {
        e.preventDefault();
        setView((v) => (v === 'graph' ? (activeId ? 'note' : 'home') : 'graph'));
      } else if (k === 's') {
        e.preventDefault();
        void api.flushAll();
      } else if (k === '\\') {
        e.preventDefault();
        setLeft((l) => (l ? null : 'files'));
      } else if (k === 'w' && activeId && view === 'note') {
        e.preventDefault();
        closeTab(activeId);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeId, view, newInContext, api]);

  // ------------------------------------------------------------ publicar
  const startPublish = useCallback(
    async (item: NotebookItem) => {
      await api.flushAll();
      const full = item._full ? item : await api.loadFull(item.id);
      if (!full) return;
      const book = full.parent_id && api.items[full.parent_id]?.template === 'book' ? api.items[full.parent_id] : null;
      if (full.template === 'blocks') {
        setPublishing({ item: full, blocks: itemToPostBlocks(full, book, entriesApi.entries) });
        return;
      }
      // montado no SERVIDOR: segredos do autor, verbetes não públicos e pendências saem lá
      let pub: { publicationId: string; title: string; html: string; entries: Record<string, NotebookEntry> } | null = null;
      try {
        const r = await fetch('/api/notebook/publish', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ itemId: full.id, mode: 'prepare' }) });
        const d = await r.json().catch(() => ({}));
        if (!r.ok) return void alert(d?.error || 'Não foi possível preparar a publicação.');
        pub = d;
      } catch {
        return void alert('Sem conexão: a publicação é preparada no servidor.');
      }
      if (!pub) return;
      const uid = () => Math.random().toString(36).slice(2);
      const escH = (t: string) => t.replace(/&/g, '&amp;').replace(/</g, '&lt;');
      const chapter = full.template === 'chapter';
      const head: PostBlock[] = [];
      if (chapter && book) head.push({ id: uid(), type: 'callout', html: escH(book.title), calloutIcon: '📖', fontStyle: 'serif' } as PostBlock);
      head.push({ id: uid(), type: 'h1', html: escH(full.title), fontStyle: chapter ? 'serif' : 'sans', ...(chapter ? { align: 'center' } : {}) } as PostBlock);
      const note = chapter ? String(full.data?.authorNote || '').trim() : '';
      const blocks: PostBlock[] = [
        ...head,
        ...htmlToPostBlocks(pub.html, { font: chapter ? 'serif' : 'sans', entries: pub.entries }),
        ...(note ? [{ id: uid(), type: 'divider' } as PostBlock, { id: uid(), type: 'quote', html: `<strong>Nota do autor:</strong> ${escH(note)}`, fontStyle: 'sans' } as PostBlock] : []),
        ...(Object.keys(pub.entries).length
          ? [{ id: uid(), type: 'paragraph', html: `<a href="/n/${pub.publicationId}">Ler com o Sumário interativo</a>`, fontStyle: 'sans' } as PostBlock]
          : []),
      ];
      setPublishing({ item: full, blocks, publicationId: pub.publicationId });
    },
    [api, entriesApi.entries, codex.cats]
  );

  const path = useMemo(() => {
    const out: NotebookItem[] = [];
    let cur = active?.parent_id ? api.items[active.parent_id] : null;
    while (cur) {
      out.unshift(cur);
      cur = cur.parent_id ? api.items[cur.parent_id] : null;
    }
    return out;
  }, [active, api.items]);

  const book = path.slice().reverse().find((p) => p.template === 'book') || null;
  const chapters = useMemo(
    () =>
      book
        ? Object.values(api.items)
            .filter((i) => i.parent_id === book.id && i.template === 'chapter' && !i.archived_at)
            .sort((a, b) => a.position - b.position || a.title.localeCompare(b.title, 'pt-BR', { numeric: true }))
        : [],
    [api.items, book]
  );

  const isWriter = active?.template === 'chapter' && view === 'note';
  // modo foco: some tudo menos o conteúdo (vale para qualquer nota)
  const showChrome = !immersive;

  // projeto da nota aberta (para onde vai a nova menção)
  const currentProjectId = useMemo(() => {
    if (active && isProject(active)) return active.id;
    const root = path[0];
    return root && isProject(root) ? root.id : null;
  }, [active, path]);
  const requestEntry = useCallback(
    (text: string) => new Promise<{ id: string; kind: EntryKind } | null>((resolve) => setEntryReq({ text: text.trim().slice(0, 160), resolve })),
    []
  );
  const openSummary = useCallback((projectId: string | null | undefined, focus: string | null = null) => {
    setSummaryProject(projectId);
    setSummaryFocus(focus);
    setView('summary');
  }, []);
  const readMoreRef = useRef<(e: NotebookEntry) => void>(() => {});
  const linkCtx = useMemo(
    () => ({
      titles,
      exists: titleExists,
      open: (t: string) => void openOrCreateLink(t),
      entries: entriesApi.entries,
      requestEntry,
      readMore: (id: string) => entriesApi.entries[id] && readMoreRef.current(entriesApi.entries[id]),
    }),
    [titles, titleExists, openOrCreateLink, entriesApi.entries, requestEntry]
  );
  const readMore = useCallback(
    (e: NotebookEntry) => (e.target_id && api.items[e.target_id] ? open(e.target_id) : openSummary(e.project_id ?? undefined, e.id)),
    [api.items, open, openSummary]
  );
  readMoreRef.current = readMore;
  const uploadEntryImage = useCallback(
    async (f: File) => {
      try {
        const res = await uploadMediaToInsight(f, {
          budgetBytes: getUserUploadLimitBytes(viewer.contributor_level ?? 0, viewer.role ?? undefined),
          asImage: true,
          scope: 'notebook',
        });
        await api.registerAsset(null, res.r2Key, res.publicUrl);
        return res.publicUrl;
      } catch (err) {
        alert(err instanceof Error ? err.message : 'Falha no envio da imagem.');
        return null;
      }
    },
    [api, viewer.contributor_level, viewer.role]
  );
  // ------------------------------------------------------------ mundo (Codex)
  const codexFolders = useRef<Map<string, string>>(new Map());
  const ensureCodexFolder = useCallback(
    async (projectId: string) => {
      const known = codexFolders.current.get(projectId);
      if (known && api.items[known] && !api.items[known].archived_at) return known;
      const found = Object.values(api.items).find((i) => i.parent_id === projectId && i.kind === 'folder' && !i.archived_at && i.data?.codexFolder);
      if (found) {
        codexFolders.current.set(projectId, found.id);
        return found.id;
      }
      const f = await api.create({ template: 'folder', parentId: projectId, title: 'Codex' });
      if (!f) return null;
      api.update(f.id, { icon: 'codex', data: { ...(f.data || {}), codexFolder: true } });
      codexFolders.current.set(projectId, f.id);
      return f.id;
    },
    [api]
  );
  const worldTools: WorldTools = {
    api,
    entriesApi,
    codex,
    open,
    openAside: (id) => setSplit({ kind: 'item', id }),
    readMore,
    openSummary: (pid, focus = null) => openSummary(pid, focus),
    onNew: ({ parentId, template, title }) => void createAndOpen({ parentId, template, title }),
    uploadImage: uploadEntryImage,
    newVerbete: async (projectId, categoryId, title = 'Novo verbete') => {
      const folder = await ensureCodexFolder(projectId);
      if (!folder) return null;
      const cat = categoryId ? codex.cats[categoryId] : null;
      const it = await api.create({ template: 'codex', parentId: folder, title });
      if (!it) return null;
      const e = await entriesApi.create({
        kind: 'elemento',
        title: it.title,
        summary: '',
        target_id: it.id,
        project_id: projectId,
        category: cat?.kind ?? null,
        // (categoria recém-criada pode ainda não estar no estado: usa o id)
        codex_category_id: categoryId,
      });
      if (!e) {
        void api.trash(it.id);
        return null;
      }
      const data = { ...(it.data || {}), codex: { entry: e.id, infobox: {} } };
      api.update(it.id, { data });
      return { ...it, data };
    },
    promoteEntry: async (entry, categoryId) => {
      const cat = categoryId ? codex.cats[categoryId] : null;
      const target = entry.target_id ? api.items[entry.target_id] : null;
      // já tem página (ficha, nota…): só entra no Codex
      if (target && !target.archived_at) {
        await entriesApi.update(entry.id, { codex_category_id: cat?.id ?? null, ...(cat ? { category: cat.kind } : {}) });
        return target;
      }
      const folder = await ensureCodexFolder(entry.project_id || '');
      if (!folder) return null;
      const it = await api.create({ template: 'codex', parentId: folder, title: entry.title });
      if (!it) return null;
      const data = { ...(it.data || {}), codex: { entry: entry.id, infobox: {} } };
      api.update(it.id, { data });
      await entriesApi.update(entry.id, { target_id: it.id, codex_category_id: cat?.id ?? null, ...(cat ? { category: cat.kind } : {}) });
      return { ...it, data };
    },
    rename: (id, t) => void rename(id, t),
    removeVerbete: async (entry) => {
      const t = entry.target_id ? api.items[entry.target_id] : null;
      if (t?.template === 'codex') {
        closeTab(t.id);
        await api.trash(t.id);
      }
      await entriesApi.remove(entry.id);
    },
  };

  // ------------------------------------------------------------ tela dividida
  const promoteSplit = useCallback(() => {
    if (!split) return;
    if (split.kind === 'item') open(split.id);
    else if (entriesApi.entries[split.id]) readMore(entriesApi.entries[split.id]);
    setSplit(null);
  }, [split, open, readMore, entriesApi.entries]);
  const swapSplit = useCallback(() => {
    if (!split || split.kind !== 'item' || !activeId) return;
    const prev = activeId;
    open(split.id);
    setSplit({ kind: 'item', id: prev });
  }, [split, activeId, open]);
  const renderSplitItem = (it: NotebookItem) => {
    if (it.template === 'canvas')
      return <CanvasStudio key={`split-${it.id}-${reloadKey}`} item={it} api={api} path={[]} onOpen={open} onRename={(t) => void rename(it.id, t)} role={viewer.role} level={viewer.contributor_level} entriesApi={entriesApi} onOpenEntry={readMore} />;
    if (it.template === 'map')
      return <MapStudio key={`split-${it.id}-${reloadKey}`} item={it} api={api} path={[]} onOpen={open} onRename={(t) => void rename(it.id, t)} role={viewer.role} level={viewer.contributor_level} />;
    if (it.template === 'mindmap' && NOTEBOOK_FEATURES.studio)
      return <MindmapStudio key={`split-${it.id}-${reloadKey}`} item={it} api={api} entriesApi={entriesApi} path={[]} onOpen={open} onRename={(t) => void rename(it.id, t)} />;
    if (it.template === 'book')
      return (
        <BookDashboard
          book={it}
          api={api}
          onOpen={open}
          onNew={({ parentId, template, title }) => void createAndOpen({ parentId, template, title })}
          role={viewer.role}
          level={viewer.contributor_level}
        />
      );
    return (
      <NoteBody
        key={`split-${it.id}-${reloadKey}`}
        item={it}
        api={api}
        viewer={viewer}
        titles={titles}
        titleExists={titleExists}
        onOpenLink={(t) => void openOrCreateLink(t)}
        onTag={(t) => {
          setSearchSeed(`#${t}`);
          setLeft('search');
        }}
        onOpen={open}
        onNew={({ parentId, template, title }) => void createAndOpen({ parentId, template, title })}
        onSummary={(pid) => openSummary(pid)}
        onImport={(pid) => startImport(pid)}
        jump={null}
      />
    );
  };

  // Alt+clique em menção, cartão ou aba: abre ao lado
  const altRef = useRef({ entries: entriesApi.entries, items: api.items });
  altRef.current = { entries: entriesApi.entries, items: api.items };
  useEffect(() => {
    const onClick = (e: MouseEvent) => {
      if (!e.altKey || e.button !== 0) return;
      const t = e.target as HTMLElement | null;
      if (!t?.closest?.('.nb-app')) return;
      const ref = t.closest('[data-ref]') as HTMLElement | null;
      if (ref?.dataset.ref && altRef.current.entries[ref.dataset.ref]) {
        e.preventDefault();
        e.stopPropagation();
        setSplit({ kind: 'entry', id: ref.dataset.ref });
        return;
      }
      const card = t.closest('[data-item-id], [data-tab-id]') as HTMLElement | null;
      const id = card?.dataset.itemId || card?.dataset.tabId;
      if (id && altRef.current.items[id]) {
        e.preventDefault();
        e.stopPropagation();
        setSplit({ kind: 'item', id });
      }
    };
    document.addEventListener('click', onClick, true);
    return () => document.removeEventListener('click', onClick, true);
  }, []);

  // ------------------------------------------------------------ paleta de comandos
  const openSnapshot = useCallback(() => {
    setRight(true);
    setRightTabReq({ tab: 'history', at: Date.now() });
    setTimeout(() => (document.querySelector('input[aria-label="Nome do instantâneo"]') as HTMLInputElement | null)?.focus(), 120);
  }, []);

  const paletteHeadings = useCallback((): PaletteHeading[] => {
    // canvas: os quadros (grupos com nome) são os "títulos"
    if (active?.template === 'canvas' && canvasFrames.id === active.id && canvasFrames.frames.length)
      return canvasFrames.frames.map((f) => ({ text: f.label, level: 2, go: () => window.dispatchEvent(new CustomEvent(CANVAS_CMD_EVENT, { detail: { id: active.id, cmd: `focus:${f.id}` } })) }));
    const root = document.querySelector('.nb-main-body');
    const els = root ? (Array.from(root.querySelectorAll('.ProseMirror h1, .ProseMirror h2, .ProseMirror h3, .ProseMirror h4')) as HTMLElement[]) : [];
    const fromDom = els
      .filter((el) => (el.textContent || '').trim())
      .map((el) => ({
        text: (el.textContent || '').trim(),
        level: Number(el.tagName[1]) || 2,
        go: () => {
          el.scrollIntoView({ block: 'start', behavior: 'smooth' });
          el.classList.add('nb-flash');
          setTimeout(() => el.classList.remove('nb-flash'), 1200);
        },
      }));
    if (fromDom.length) return fromDom;
    if (active?._full && active.template !== 'chapter' && shown === 'note')
      return extractHeadings(active.content || '').map((h) => ({ text: h.text, level: h.level, go: () => setJump({ line: h.line, at: Date.now() }) }));
    return [];
  }, [active, shown, canvasFrames]);

  const ic = (C: React.ElementType) => <C />;
  const noteOpen = shown === 'note' && !!active;
  const commands: PaletteCommand[] = [
    { id: 'new', group: 'Criar', label: 'Nova nota', icon: ic(FilePlus2), shortcut: 'Ctrl+N', run: () => void newInContext() },
    { id: 'project', group: 'Criar', label: 'Novo projeto', icon: ic(FolderPlus), run: () => setProjectDialog(true) },
    { id: 'template', group: 'Criar', label: 'Novo a partir de modelo', icon: ic(LayoutTemplate), run: () => setPicker({ parentId: null }) },
    { id: 'canvas', group: 'Criar', label: 'Novo canvas', icon: <Glyph name="canvas" />, keywords: 'quadro obsidian cartoes', run: () => void newInContext('canvas') },
    { id: 'capture', group: 'Criar', label: 'Capturar ideia na Caixa de entrada', icon: ic(Inbox), shortcut: 'Ctrl+Alt+N', keywords: 'inbox rapida quick', run: () => window.dispatchEvent(new Event(QUICK_CAPTURE_EVENT)) },
    ...(noteOpen && active!.kind === 'note' ? [{ id: 'proof', group: 'Nota atual', label: 'Prova final (como o leitor vai ver)', icon: ic(Eye), shortcut: 'Ctrl+Alt+R', keywords: 'leitura preview previa diagramacao', run: () => setProof(active!.id) }] : []),
    { id: 'library', group: 'Notebook', label: 'Biblioteca de mídias', icon: ic(Images), keywords: 'imagens arquivos r2 midia orfas assets', run: () => setLibOpen(true) },
    { id: 'trash-open', group: 'Notebook', label: 'Abrir a lixeira', icon: ic(Trash2), keywords: 'apagados restaurar excluidos', run: () => setTrashOpen(true) },
    { id: 'book', group: 'Criar', label: 'Novo livro', icon: ic(BookPlus), run: () => void createAndOpen({ template: 'book' }) },
    { id: 'daily', group: 'Criar', label: 'Nota de hoje', icon: ic(CalendarDays), keywords: 'diario diário', run: () => void openDaily() },
    session.state
      ? { id: 'session', group: 'Escrita', label: 'Encerrar sessão de escrita', icon: ic(Timer), keywords: 'meta cronometro', run: () => session.end(true) }
      : { id: 'session', group: 'Escrita', label: 'Iniciar sessão de escrita', icon: ic(Timer), keywords: 'meta cronometro pomodoro', run: () => setSessionDialog(true) },
    ...(currentProjectId && isWorld(api.items[currentProjectId])
      ? [
          {
            id: 'verbete',
            group: 'Criar',
            label: 'Novo verbete no Codex',
            icon: ic(BookMarked),
            keywords: 'worldbuilding mundo codex',
            run: async () => {
              const it = await worldTools.newVerbete(currentProjectId, null);
              if (it) open(it.id);
            },
          },
        ]
      : []),
    {
      id: 'secrets',
      group: 'Escrita',
      label: secretsShown ? 'Esconder segredos do autor' : 'Mostrar segredos do autor',
      icon: ic(Lock),
      keywords: 'spoiler segredo',
      run: () => setSecretsShown(!secretsShown),
    },
    ...(book
      ? [
          {
            id: 'cork',
            group: 'Escrita',
            label: `Quadro de cenas de “${book.title}”`,
            icon: ic(LayoutGrid),
            keywords: 'corkboard capitulos fichas',
            run: () => {
              try {
                localStorage.setItem('insight-notebook-chapters-view', 'quadro');
              } catch {
                /* ignora */
              }
              open(book.id);
            },
          },
        ]
      : []),
    ...(noteOpen && active!.template === 'canvas'
      ? (() => {
          const fire = (cmd: string) => () => window.dispatchEvent(new CustomEvent(CANVAS_CMD_EVENT, { detail: { id: active!.id, cmd } }));
          const C = (id: string, label: string, cmd: string, keywords = '', shortcut?: string): PaletteCommand => ({ id: `cv-${id}`, group: 'Canvas', label, icon: <Glyph name="canvas" />, keywords: `canvas ${keywords}`, shortcut, run: fire(cmd) });
          return [
            C('text', 'Canvas: novo cartão de texto', 'text', 'cartao nota'),
            C('note', 'Canvas: pôr uma nota', 'note', 'incorporar'),
            C('file', 'Canvas: inserir imagem, PDF, áudio ou vídeo', 'file', 'arquivo upload midia'),
            C('entry', 'Canvas: pôr um verbete do Codex', 'entry', 'worldbuilding personagem'),
            C('lib', 'Canvas: inserir da biblioteca de mídias', 'library', 'imagem arquivo reaproveitar'),
            C('templates', 'Canvas: inserir modelo…', 'templates', 'tres atos jornada kanban linha do tempo'),
            ...CANVAS_TEMPLATES.map((t) => C(`tpl-${t.id}`, `Canvas: modelo “${t.label}”`, `template:${t.id}`, t.description)),
            C('wm', 'Canvas: buscar imagens livres (Wikimedia)', 'plugin:wikimedia', 'foto imagem commons'),
            C('ov', 'Canvas: buscar no Openverse', 'plugin:openverse', 'foto imagem creative commons'),
            C('wp', 'Canvas: buscar na Wikipedia', 'plugin:wikipedia', 'artigo resumo'),
            C('clip', 'Canvas: recortar uma página da web', 'plugin:clipper', 'link url site'),
            C('px', 'Canvas: buscar no Pixabay', 'plugin:pixabay', 'foto imagem'),
            C('us', 'Canvas: buscar no Unsplash', 'plugin:unsplash', 'foto imagem'),
            C('gd', 'Canvas: trazer do Google Drive', 'plugin:gdrive', 'drive arquivo google'),
            ...(canvasFrames.id === active!.id
              ? canvasFrames.frames.map((f) => ({ id: `cv-frame-${f.id}`, group: 'Quadros do canvas', label: `Quadro: ${f.label}`, icon: <Glyph name="canvas" />, keywords: `ir ${f.label}`, run: fire(`focus:${f.id}`) }))
              : []),
            C('fit', 'Canvas: enquadrar tudo', 'fit', 'zoom', 'Shift+1'),
            C('zsel', 'Canvas: ampliar na seleção', 'zoomSel', 'zoom', 'Shift+2'),
            C('arrange', 'Canvas: organizar a seleção em grade', 'arrange', 'alinhar'),
            C('group', 'Canvas: criar grupo', 'group', '', 'Ctrl+G'),
            C('snap', 'Canvas: ligar ou desligar as guias magnéticas', 'snap', 'ima alinhamento'),
            C('grid', 'Canvas: ligar ou desligar o encaixe na grade', 'grid', 'ima'),
            C('help', 'Canvas: atalhos de teclado', 'help', 'ajuda', '?'),
            C('dl', 'Canvas: baixar .canvas (Obsidian)', 'download', 'exportar json'),
          ];
        })()
      : []),
    ...(noteOpen && active!.kind === 'note'
      ? [
          { id: 'snap', group: 'Nota atual', label: 'Salvar instantâneo…', icon: ic(Camera), keywords: 'versao snapshot historico', run: openSnapshot },
          {
            id: 'compare',
            group: 'Nota atual',
            label: 'Comparar versões',
            icon: ic(GitCompareArrows),
            keywords: 'historico diff revisao',
            run: () => {
              setRight(true);
              setRightTabReq({ tab: 'history', at: Date.now() });
            },
          },
          {
            id: 'unlinked',
            group: 'Nota atual',
            label: 'Menções sem marcação nesta nota',
            icon: ic(Sparkles),
            keywords: 'conexoes backlinks',
            run: () => {
              setRight(true);
              setRightTabReq({ tab: 'links', at: Date.now() });
            },
          },
          { id: 'heading', group: 'Nota atual', label: 'Ir para um título…', icon: ic(Hash), run: () => setTimeout(() => setPalette({ mode: '#', aside: false }), 0) },
          { id: 'pin', group: 'Nota atual', label: active!.pinned ? 'Desafixar nota' : 'Fixar nota', icon: ic(Pin), run: () => api.update(active!.id, { pinned: !active!.pinned }) },
          { id: 'dup', group: 'Nota atual', label: 'Duplicar nota', icon: ic(Copy), run: () => void api.duplicate(active!.id) },
          { id: 'export', group: 'Nota atual', label: 'Exportar nota…', icon: ic(Download), run: () => setExporting(active) },
          { id: 'trash', group: 'Nota atual', label: 'Mover nota para a lixeira', icon: ic(Trash2), run: () => void api.trash(active!.id) },
        ]
      : []),
    { id: 'aside', group: 'Tela', label: 'Abrir ao lado…', icon: ic(Columns2), keywords: 'dividir tela split', run: () => setTimeout(() => setPalette({ mode: '', aside: true }), 0) },
    ...(split
      ? [
          { id: 'split-close', group: 'Tela', label: 'Fechar tela dividida', icon: ic(X), run: () => setSplit(null) },
          ...(split.kind === 'item' && noteOpen ? [{ id: 'split-swap', group: 'Tela', label: 'Trocar os lados', icon: ic(Shuffle), run: swapSplit }] : []),
        ]
      : []),
    { id: 'focus', group: 'Tela', label: immersive ? 'Sair do modo foco' : 'Modo foco', icon: ic(Maximize2), shortcut: 'Ctrl+.', run: () => setImmersive((v) => !v) },
    { id: 'side', group: 'Tela', label: sideHidden ? 'Mostrar barra lateral' : 'Ocultar barra lateral', icon: ic(PanelLeftClose), shortcut: 'Ctrl+Shift+\\', run: () => setSideHidden((v) => !v) },
    { id: 'right', group: 'Tela', label: right ? 'Fechar painel de detalhes' : 'Painel de detalhes', icon: ic(PanelRight), run: () => setRight((r) => !r) },
    { id: 'home', group: 'Navegar', label: 'Início', icon: ic(Home), run: () => setView('home') },
    {
      id: 'search',
      group: 'Navegar',
      label: 'Buscar no texto das notas',
      icon: ic(Search),
      shortcut: 'Ctrl+Shift+F',
      run: () => {
        setSearchSeed(undefined);
        setLeft('search');
        setSideHidden(false);
      },
    },
    { id: 'summary', group: 'Navegar', label: 'Sumário (menções)', icon: ic(BookMarked), run: () => openSummary(currentProjectId ?? undefined) },
    { id: 'mentions', group: 'Navegar', label: 'Buscar menção…', icon: ic(Sparkles), run: () => setTimeout(() => setPalette({ mode: '+', aside: false }), 0) },
    { id: 'graph', group: 'Navegar', label: 'Grafo de notas', icon: ic(Network), shortcut: 'Ctrl+G', run: () => setView('graph') },
    { id: 'import', group: 'Arquivo', label: 'Importar arquivos', icon: ic(Upload), run: () => startImport(currentProjectId) },
    { id: 'export-all', group: 'Arquivo', label: 'Backup do Notebook ou do projeto (.zip)', icon: ic(Download), run: () => void runExportAll() },
  ];

  // botão direito: ações gerais do Notebook
  const menuActions: GlobalMenuActions = {
    entries: entriesApi.entries,
    requestEntry,
    readMore,
    openSummary: (id) => openSummary(id ? entriesApi.entries[id]?.project_id ?? undefined : currentProjectId ?? undefined, id),
    search: (q) => {
      setSearchSeed(q || undefined);
      setLeft('search');
      setSideHidden(false);
    },
    newNote: () => void newInContext(),
    newProject: () => setProjectDialog(true),
    picker: () => setPicker({ parentId: null }),
    importFiles: () => startImport(currentProjectId),
    exportAll: () => void runExportAll(),
    exportActive: active && shown === 'note' ? () => setExporting(active) : null,
    quickOpen: () => setPalette({ mode: '', aside: false }),
    openAside: (id) => setSplit({ kind: 'item', id }),
    entryAside: (id) => setSplit({ kind: 'entry', id }),
    session: { active: !!session.state, start: () => setSessionDialog(true), end: () => session.end(true) },
    snapshot: active && shown === 'note' && active.kind === 'note' ? () => openSnapshot() : null,
    graph: () => setView('graph'),
    home: () => setView('home'),
    toggleFocus: () => setImmersive((v) => !v),
    toggleSide: () => setSideHidden((v) => !v),
    toggleRight: () => setRight((r) => !r),
    sideHidden,
    openItem: open,
    tab: {
      close: closeTab,
      closeOthers: (id) => {
        setTabs([id]);
        setActiveId(id);
        setView('note');
      },
      closeAll: () => {
        setTabs([]);
        setActiveId(null);
        setView('home');
      },
      pin: (id) => api.update(id, { pinned: !api.items[id]?.pinned }),
      isPinned: (id) => !!api.items[id]?.pinned,
      trash: (id) => {
        closeTab(id);
        void api.trash(id);
      },
      exportItem: (id) => api.items[id] && setExporting(api.items[id]),
    },
  };

  const mentionStyles = useMemo(
    () =>
      Object.values(entriesApi.entries)
        .map((e) => `[data-ref="${e.id}"]{--mc:${entryLook(e).color}}`)
        .join(''),
    [entriesApi.entries]
  );
  const liveItems = useMemo(() => Object.values(api.items).filter((i) => !i.archived_at), [api.items]);
  const projectList = useMemo(() => liveItems.filter((i) => isProject(i)).sort((a, b) => a.title.localeCompare(b.title, 'pt-BR')), [liveItems]);

  // ------------------------------------------------------------ render
  return (
    <NotebookLinksContext.Provider value={linkCtx}>
    <ContextMenuProvider>
    <GlobalContextMenus actions={menuActions} />
    <WorldContext.Provider value={worldTools}>
    <div className="nb-app" data-immersive={immersive} data-side-hidden={sideHidden} data-secrets={secretsShown ? 'shown' : 'hidden'} data-enter="true">
      <NotebookSplashExit />
      <div className="flex flex-1 min-h-0 flex-col md:flex-row relative">
        {/* RIBBON */}
        {showChrome && (
          <nav className="nb-ribbon" aria-label="Ferramentas do notebook">
            <Link href="/" title="Voltar ao Insight" className="nb-ribbon-btn nb-ribbon-desktop mb-2">
              <InsightAsterisk fill="solid" className="w-5 h-5 text-[var(--nb-hl)]" />
            </Link>
            <RibbonBtn label="Início do notebook" active={shown === 'home'} onClick={() => setView('home')}>
              <Home />
            </RibbonBtn>
            <RibbonBtn label="Arquivos (Ctrl+\)" active={left === 'files'} onClick={() => setLeft((l) => (l === 'files' ? null : 'files'))}>
              <Files />
            </RibbonBtn>
            <RibbonBtn label="Buscar (Ctrl+Shift+F)" active={left === 'search'} onClick={() => setLeft((l) => (l === 'search' ? null : 'search'))}>
              <Search />
            </RibbonBtn>
<RibbonBtn label="Biblioteca de mídias" active={libOpen} onClick={() => setLibOpen(true)}>
              <Images />
            </RibbonBtn>
            <RibbonBtn label="Pendências" active={left === 'todos'} onClick={() => setLeft((l) => (l === 'todos' ? null : 'todos'))}>
              <ListTodo />
            </RibbonBtn>
            <RibbonBtn label="Grafo (Ctrl+G)" active={shown === 'graph'} onClick={() => setView((v) => (v === 'graph' ? (activeId ? 'note' : 'home') : 'graph'))}>
              <Network />
            </RibbonBtn>
            <RibbonBtn label="Sumário" active={shown === 'summary'} onClick={() => (shown === 'summary' ? setView(activeId ? 'note' : 'home') : openSummary(currentProjectId ?? undefined))}>
              <BookMarked />
            </RibbonBtn>
            <RibbonBtn label="Nota de hoje" onClick={() => void openDaily()}>
              <CalendarDays />
            </RibbonBtn>
            <span className="nb-ribbon-desktop flex flex-col items-center gap-1">
              <RibbonBtn label="Novo livro" onClick={() => void createAndOpen({ template: 'book' })}>
                <BookPlus />
              </RibbonBtn>
              <RibbonBtn label="Novo a partir de modelo" onClick={() => setPicker({ parentId: null })}>
                <LayoutTemplate />
              </RibbonBtn>
              <RibbonBtn label="Paleta de comandos (Ctrl+K)" onClick={() => setPalette({ mode: '', aside: false })}>
                <Command />
              </RibbonBtn>
            </span>
            <span className="md:hidden">
              <RibbonBtn label="Novo" onClick={() => setPicker({ parentId: null })}>
                <FilePlus2 />
              </RibbonBtn>
            </span>
            <div className="flex-1 nb-ribbon-desktop" />
            <Link href={`/u/${encodeURIComponent(viewer.username)}`} title="Seu perfil" className="nb-ribbon-desktop">
              {viewer.avatar_url ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={viewer.avatar_url} alt="" className="w-8 h-8 rounded-full object-cover border border-[var(--nb-line)]" />
              ) : (
                <span className="w-8 h-8 rounded-full grid place-items-center bg-[var(--nb-pane-2)] text-xs font-bold">
                  {(viewer.display_name || viewer.username || '?')[0].toUpperCase()}
                </span>
              )}
            </Link>
            <span className="md:hidden">
              <Link href="/" title="Voltar ao Insight" className="nb-ribbon-btn [&>svg]:w-[18px] [&>svg]:h-[18px]">
                <ArrowLeft />
              </Link>
            </span>
          </nav>
        )}

        {/* PAINEL ESQUERDO */}
        {showChrome && left && (
          <>
            <div className="nb-scrim" onClick={() => setLeft(null)} />
            <aside className="nb-side nb-side--left w-[280px]">
              {left === 'files' ? (
                <FileExplorer
                  api={api}
                  activeId={shown === 'note' ? activeId : null}
                  onOpen={open}
                  onNew={({ parentId, template, title }) => void createAndOpen({ parentId, template, title })}
                  onPickTemplate={(parentId) => setPicker({ parentId })}
                  onRename={(id, t) => void rename(id, t)}
                  onImport={(pid) => startImport(pid)}
                  onOpenTrash={() => setTrashOpen(true)}
                  onClose={typeof window !== 'undefined' && window.innerWidth < 1024 ? () => setLeft(null) : undefined}
                />
              ) : left === 'todos' ? (
                <TodoPanel api={api} projectId={currentProjectId ?? null} onGo={goTodo} />
              ) : (
                <SearchPanel api={api} onOpen={open} initial={searchSeed} entriesApi={entriesApi} projectId={currentProjectId ?? null} />
              )}
            </aside>
          </>
        )}

        {/* CENTRO */}
        <main className="flex-1 min-w-0 min-h-0 flex flex-col">
          {showChrome && (
            <div className="nb-tabs" role="tablist">
              <button
                type="button"
                title={sideHidden ? 'Mostrar barra lateral (Ctrl+Shift+\\)' : 'Ocultar barra lateral (Ctrl+Shift+\\)'}
                aria-label={sideHidden ? 'Mostrar barra lateral' : 'Ocultar barra lateral'}
                aria-pressed={sideHidden}
                onClick={() => setSideHidden((v) => !v)}
                className="hidden md:grid self-center place-items-center mr-1 p-1.5 rounded-md text-[var(--nb-ink-3)] hover:text-[var(--nb-ink)] hover:bg-[var(--nb-pane-2)]"
              >
                {sideHidden ? <PanelLeftOpen className="w-4 h-4" /> : <PanelLeftClose className="w-4 h-4" />}
              </button>
              {liveTabs.map((id) => {
                const it = api.items[id];
                if (!it) return null;
                return (
                  <div
                    key={id}
                    role="tab"
                    aria-selected={shown === 'note' && id === activeId}
                    className="nb-tab group"
                    data-tab-id={id}
                    data-active={shown === 'note' && id === activeId}
                    onClick={() => open(id)}
                    onAuxClick={(e) => e.button === 1 && closeTab(id)}
                    title={it.title}
                  >
                    <span className="text-[12px]">{itemIcon(it)}</span>
                    <span className="truncate">{it.title}</span>
                    <button
                      type="button"
                      aria-label={`Fechar ${it.title}`}
                      onClick={(e) => {
                        e.stopPropagation();
                        closeTab(id);
                      }}
                      className="p-0.5 rounded opacity-0 group-hover:opacity-100 group-data-[active=true]:opacity-60 hover:!opacity-100 hover:bg-[var(--nb-pane-2)]"
                    >
                      <X className="w-3 h-3" />
                    </button>
                  </div>
                );
              })}
              <button
                type="button"
                title="Nova nota (Ctrl+N)"
                aria-label="Nova nota"
                onClick={() => void newInContext()}
                className="self-center ml-1 p-1.5 rounded-md text-[var(--nb-ink-3)] hover:text-[var(--nb-ink)] hover:bg-[var(--nb-pane-2)]"
              >
                <FilePlus2 className="w-3.5 h-3.5" />
              </button>
              <div className="flex-1" />
              <SaveBadge state={api.saveState} pending={api.pendingSync} />
              <button
                type="button"
                title="Modo foco (Ctrl+.)"
                aria-label="Entrar no modo foco"
                onClick={() => setImmersive(true)}
                className="self-center p-1.5 rounded-md text-[var(--nb-ink-3)] hover:text-[var(--nb-ink)]"
              >
                <Maximize2 className="w-4 h-4" />
              </button>
              <button
                type="button"
                title="Painel de detalhes"
                aria-pressed={right}
                onClick={() => setRight((r) => !r)}
                className={`self-center p-1.5 rounded-md ${right ? 'text-[var(--nb-hl)]' : 'text-[var(--nb-ink-3)] hover:text-[var(--nb-ink)]'}`}
              >
                <PanelRight className="w-4 h-4" />
              </button>
            </div>
          )}

          {api.error && (
            <div className="flex items-center gap-2 px-4 py-2 text-[12px] bg-red-500/10 text-red-300 border-b border-red-500/30">
              <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
              <span className="flex-1 truncate">Não foi possível salvar agora — suas alterações estão guardadas neste aparelho e serão reenviadas. ({api.error})</span>
              <button type="button" onClick={() => api.setError(null)} aria-label="Dispensar">
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          )}

          <div className="flex-1 min-h-0 flex relative">
          <div className="nb-main-body flex-1 min-w-0 min-h-0 relative">
            {immersive && !isWriter && (
              <button
                type="button"
                onClick={() => setImmersive(false)}
                className="nb-focus-exit flex items-center gap-1.5 h-8 px-3 rounded-full border border-[var(--nb-line)] bg-[var(--nb-pane)] text-[11px] font-bold text-[var(--nb-ink-2)]"
              >
                <Minimize2 className="w-3.5 h-3.5" /> Sair do foco · Esc
              </button>
            )}
            {shown === 'summary' && (
              <SummaryView
                items={liveItems}
                projects={projectList}
                entriesApi={entriesApi}
                api={api}
                projectId={summaryProject}
                focusId={summaryFocus}
                onProject={(p) => {
                  setSummaryProject(p);
                  setSummaryFocus(null);
                }}
                onOpen={open}
                onReadMore={readMore}
                onUploadImage={uploadEntryImage}
              />
            )}

            {shown === 'graph' && (
              <div className="absolute inset-0">
                <GraphView items={Object.values(api.items)} activeId={activeId} onOpen={open} />
              </div>
            )}

            {shown === 'home' && (
              <HomeView
                api={api}
                viewer={viewer}
                onOpen={open}
                onCreate={(t) => void createAndOpen({ template: t })}
                onDaily={() => void openDaily()}
                onPicker={() => setPicker({ parentId: null })}
                onImport={() => startImport(null)}
                onExportAll={() => void runExportAll()}
                exportingAll={exportingAll}
              />
            )}

            {shown === 'note' && active && !active._full && (
              <div className="absolute inset-0 grid place-items-center">
                <Loader2 className="w-6 h-6 animate-spin text-[var(--nb-ink-3)]" />
              </div>
            )}

            {shown === 'note' && active?._full && active.template === 'chapter' && (
              <div className="absolute inset-0">
                <WriterMode
                  key={`${active.id}-${reloadKey}`}
                  item={active}
                  api={api}
                  book={book}
                  chapters={chapters}
                  onOpen={open}
                  onPublish={(it) => void startPublish(it)}
                  immersive={immersive}
                  onImmersive={setImmersive}
                  role={viewer.role}
                  level={viewer.contributor_level}
                />
              </div>
            )}

            {shown === 'note' && active?._full && active.template === 'mindmap' && NOTEBOOK_FEATURES.studio && (
              <MindmapStudio key={`${active.id}-${reloadKey}`} item={active} api={api} entriesApi={entriesApi} path={path} onOpen={open} onRename={(t) => void rename(active.id, t)} />
            )}

            {shown === 'note' && active?._full && active.template === 'map' && (
              <MapStudio
                key={`${active.id}-${reloadKey}`}
                item={active}
                api={api}
                path={path}
                onOpen={open}
                onRename={(t) => void rename(active.id, t)}
                role={viewer.role}
                level={viewer.contributor_level}
              />
            )}

            {shown === 'note' && active?._full && active.template === 'canvas' && (
              <CanvasStudio
                key={`${active.id}-${reloadKey}`}
                item={active}
                api={api}
                path={path}
                onOpen={open}
                onRename={(t) => void rename(active.id, t)}
                role={viewer.role}
                level={viewer.contributor_level}
                entriesApi={entriesApi}
                onOpenEntry={(e) => setSplit({ kind: 'entry', id: e.id })}
              />
            )}

            {shown === 'note' && active?._full && active.template !== 'chapter' && active.template !== 'map' && active.template !== 'canvas' && !(active.template === 'mindmap' && NOTEBOOK_FEATURES.studio) && (
              <div className="nb-scroll absolute inset-0 overflow-y-auto">
                {active.template === 'book' ? (
                  <BookDashboard
                    book={active}
                    api={api}
                    onOpen={open}
                    onNew={({ parentId, template, title }) => void createAndOpen({ parentId, template, title })}
                    onExport={() => setExporting(active)}
                    role={viewer.role}
                    level={viewer.contributor_level}
                  />
                ) : (
                  <div className={`mx-auto px-4 sm:px-8 py-6 sm:py-10 ${WORKSPACE_TEMPLATES.has(active.template) || active.template === 'calendar' || active.template === 'timeline' || active.template === 'codex' || isWorld(active) ? 'max-w-6xl' : active.template === 'article' ? 'max-w-[1480px]' : 'max-w-3xl'}`}>
                    {/* trilha + ações */}
                    <div className="flex items-center gap-2 mb-4 min-h-[28px]">
                      <nav className="flex items-center gap-1 text-[12px] text-[var(--nb-ink-3)] min-w-0 flex-1" aria-label="Caminho">
                        {path.map((p) => (
                          <span key={p.id} className="flex items-center gap-1 min-w-0">
                            <button type="button" onClick={() => open(p.id)} className="truncate hover:text-[var(--nb-ink)] max-w-[140px]">
                              {p.title}
                            </button>
                            <ChevronRight className="w-3 h-3 shrink-0" />
                          </span>
                        ))}
                        <span className="truncate text-[var(--nb-ink-2)]">{active.kind === 'folder' ? (isProject(active) ? 'Projeto' : 'Seção') : getTemplate(active.template).name}</span>
                      </nav>
                      {(active.template === 'markdown' || active.template === 'blocks' || ['journal', 'screenplay', 'study', 'idea', 'character', 'world', 'meeting', 'poem', 'article', 'codex'].includes(active.template)) && (
                        <button
                          type="button"
                          onClick={() => void startPublish(active)}
                          className="flex items-center gap-1.5 h-7 px-2.5 rounded-lg bg-[var(--nb-hl-soft)] text-[var(--nb-hl)] text-[11px] font-bold hover:bg-[var(--nb-hl)] hover:text-white"
                        >
                          <Send className="w-3 h-3" /> Publicar
                        </button>
                      )}
                      {active.kind === 'note' && !['blocks', 'canvas', 'map', 'mindmap', 'calendar', 'timeline'].includes(active.template) && !getTemplate(active.template).workspace && (
                        <button
                          type="button"
                          onClick={() => setProof(active.id)}
                          title="Prova final: como o leitor vai ver (Ctrl+Alt+R)"
                          className="flex items-center gap-1.5 h-7 px-2.5 rounded-lg border border-[var(--nb-line)] text-[var(--nb-ink-2)] text-[11px] font-bold hover:text-[var(--nb-ink)]"
                        >
                          <Eye className="w-3 h-3" /> Prova final
                        </button>
                      )}
                      <div className="relative">
                        <button
                          type="button"
                          aria-label="Mais ações"
                          onClick={() => setMenuOpen((v) => !v)}
                          className="p-1.5 rounded-md text-[var(--nb-ink-3)] hover:text-[var(--nb-ink)] hover:bg-[var(--nb-pane-2)]"
                        >
                          <MoreHorizontal className="w-4 h-4" />
                        </button>
                        {menuOpen && (
                          <div className="absolute right-0 top-full mt-1 z-30 w-52 py-1.5 rounded-xl bg-[var(--nb-pane)] border border-[var(--nb-line)] shadow-2xl text-[13px]">
                            <MenuRow icon={<Pin />} onClick={() => (api.update(active.id, { pinned: !active.pinned }), setMenuOpen(false))}>
                              {active.pinned ? 'Desafixar' : 'Fixar'}
                            </MenuRow>
                            <MenuRow icon={<Copy />} onClick={async () => (setMenuOpen(false), (await api.duplicate(active.id)) && null)}>
                              Duplicar
                            </MenuRow>
                            <MenuRow icon={<LayoutTemplate />} onClick={() => (api.update(active.id, { is_template: !active.is_template }), setMenuOpen(false))}>
                              {active.is_template ? 'Deixar de ser modelo' : 'Usar como modelo'}
                            </MenuRow>
                            <MenuRow icon={<Download />} onClick={() => (setExporting(active), setMenuOpen(false))}>
                              Exportar…
                            </MenuRow>
                            <MenuRow icon={<Trash2 />} danger onClick={() => (api.trash(active.id), setMenuOpen(false))}>
                              Mover para a lixeira
                            </MenuRow>
                          </div>
                        )}
                      </div>
                    </div>

                    {/* título */}
                    {active.template !== 'codex' && active.template !== 'article' && <TitleInput key={`t-${active.id}-${reloadKey}`} item={active} onRename={(t) => void rename(active.id, t)} />}
                    {active.published_post_id && (
                      <a href={`/post/${active.published_post_id}`} target="_blank" className="inline-flex items-center gap-1 mb-4 text-[11px] font-semibold text-purple-400 hover:underline">
                        <Sparkles className="w-3 h-3" /> publicado no Insight
                      </a>
                    )}

                    <NoteBody
                      key={`${active.id}-${reloadKey}`}
                      item={active}
                      api={api}
                      viewer={viewer}
                      titles={titles}
                      titleExists={titleExists}
                      onOpenLink={(t) => void openOrCreateLink(t)}
                      onTag={(t) => {
                        setSearchSeed(`#${t}`);
                        setLeft('search');
                      }}
                      onOpen={open}
                      onNew={({ parentId, template, title }) => void createAndOpen({ parentId, template, title })}
                      onSummary={(pid) => openSummary(pid)}
                      onImport={(pid) => startImport(pid)}
                      jump={jump}
                    />
                  </div>
                )}
              </div>
            )}
          </div>
          {split && showChrome && (
            <SplitPane
              target={split}
              width={splitW}
              onWidth={setSplitW}
              api={api}
              entriesApi={entriesApi}
              activeId={shown === 'note' ? activeId : null}
              onClose={() => setSplit(null)}
              onPromote={promoteSplit}
              onSwap={split.kind === 'item' && shown === 'note' && active ? swapSplit : null}
              onTarget={setSplit}
              onOpen={open}
              onSummary={(id) => openSummary(entriesApi.entries[id]?.project_id ?? undefined, id)}
              renderItem={renderSplitItem}
            />
          )}
          </div>
        </main>

        {/* PAINEL DIREITO */}
        {showChrome && right && (
          <>
            <div className="nb-scrim" onClick={() => setRight(false)} />
            <aside className="nb-side nb-side--right w-[290px]">
              <RightPanel
                item={shown === 'note' ? active : null}
                api={api}
                onOpen={open}
                onJump={(line) => setJump({ line, at: Date.now() })}
                tabRequest={rightTabReq}
                onClose={typeof window !== 'undefined' && window.innerWidth < 1024 ? () => setRight(false) : undefined}
              />
            </aside>
          </>
        )}
      </div>

      {palette && (
        <CommandPalette
          api={api}
          entries={entriesApi.entries}
          recent={recent}
          commands={commands}
          headings={paletteHeadings}
          initialMode={palette.mode}
          asideDefault={palette.aside}
          onOpen={(id, aside) => (aside ? setSplit({ kind: 'item', id }) : open(id))}
          onEntry={(e, aside) => (aside ? setSplit({ kind: 'entry', id: e.id }) : readMore(e))}
          onCreate={(title) => void createAndOpen({ title, parentId: null })}
          onClose={() => setPalette(null)}
        />
      )}

      {/* sessão de escrita */}
      <SessionPill s={session} dim={immersive} />
      {sessionDialog && (
        <SessionStartDialog
          streak={session.streak()}
          onClose={() => setSessionDialog(false)}
          onStart={(t, g) => {
            setSessionDialog(false);
            session.start(t, g);
          }}
        />
      )}
      {session.summary && (
        <SessionSummaryDialog
          summary={session.summary}
          onClose={session.closeSummary}
          onOpen={open}
          onAgain={() => {
            session.closeSummary();
            setSessionDialog(true);
          }}
        />
      )}

      <input
        ref={importInput}
        type="file"
        multiple
        hidden
        accept={IMPORT_ACCEPT}
        onChange={async (e) => {
          const files = Array.from(e.target.files || []);
          e.target.value = '';
          if (!files.length) return;
          setImportResult('busy');
          const res = await importFiles(files, importTarget.current, api, entriesApi);
          setImportResult(res);
        }}
      />
      {proof && <ProofReader itemId={proof} onClose={() => setProof(null)} />}
      {backupOpen && <BackupDialog api={api} entries={entriesApi.entries} projectId={currentProjectId ?? null} onClose={() => setBackupOpen(false)} />}
      {libOpen && viewer.id && <AssetLibrary api={api} profileId={viewer.id} entries={entriesApi.entries} projectId={currentProjectId ?? null} onOpen={open} onClose={() => setLibOpen(false)} />}
      {trashOpen && viewer.id && (
        <TrashDialog api={api} profileId={viewer.id} onRestoredEntries={entriesApi.reload} onRestoredCodex={codex.reload} onClose={() => setTrashOpen(false)} />
      )}
      {exporting && <ExportDialog item={exporting} api={api} onClose={() => setExporting(null)} />}
      {importResult && <ImportResultDialog result={importResult} onOpen={open} onClose={() => setImportResult(null)} />}

      {/* cor de cada menção (pela categoria), aplicada onde quer que ela apareça */}
      <style>{mentionStyles}</style>

      <EntryPopover
        entries={entriesApi.entries}
        targetTitle={(id) => api.items[id]?.title || null}
        onReadMore={readMore}
        onOpenSummary={(id) => openSummary(entriesApi.entries[id]?.project_id ?? undefined, id)}
        onAside={(e) => setSplit({ kind: 'entry', id: e.id })}
      />

      {entryReq && (
        <EntryDialog
          text={entryReq.text}
          projectId={currentProjectId}
          entriesApi={entriesApi}
          notes={liveItems}
          onCancel={() => {
            entryReq.resolve(null);
            setEntryReq(null);
          }}
          onDone={(e) => {
            entryReq.resolve({ id: e.id, kind: e.kind });
            setEntryReq(null);
          }}
        />
      )}

      {projectDialog && (
        <NewProjectDialog
          onClose={() => setProjectDialog(false)}
          onCreate={(p) => {
            setProjectDialog(false);
            void createProject(p);
          }}
        />
      )}

      {picker && (
        <TemplatePicker
          api={api}
          parentTitle={picker.parentId ? api.items[picker.parentId]?.title : null}
          onClose={() => setPicker(null)}
          onPick={(t: NotebookTemplateDef | null, from?: NotebookItem) => {
            const parentId = picker.parentId;
            setPicker(null);
            void createAndOpen({ template: from ? from.template : t?.id, parentId, from });
          }}
        />
      )}

      {publishing && (
        <div className="nb-modal-back !pt-6 !items-start overflow-y-auto" onClick={() => setPublishing(null)}>
          <div className="w-full max-w-2xl rounded-2xl bg-[var(--nb-pane)] border border-[var(--nb-line)] shadow-2xl" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center gap-3 px-5 py-4 border-b border-[var(--nb-line)]">
              <Send className="w-4 h-4 text-[var(--nb-hl)]" />
              <div className="flex-1 min-w-0">
                <p className="font-black">Publicar no Insight</p>
                <p className="text-[12px] text-[var(--nb-ink-3)] truncate">
                  “{publishing.item.title}” vira um post. Revise, escolha os tópicos e publique — a nota original continua no notebook.
                </p>
              </div>
              <button type="button" onClick={() => setPublishing(null)} aria-label="Fechar" className="p-1.5 rounded-md hover:bg-[var(--nb-pane-2)]">
                <X className="w-4 h-4" />
              </button>
            </div>
            <PostComposer
              authorId={viewer.id}
              isAdmin
              prefillBlocks={publishing.blocks}
              draftScopeOverride={`notebook:publish:${publishing.item.id}`}
              onPublished={(postId) => {
                const it = publishing.item;
                // a cópia montada no servidor fica pública e ligada ao post
                if (publishing.publicationId)
                  void fetch('/api/notebook/publish/confirm', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ publicationId: publishing.publicationId, postId }) });
                api.update(it.id, {
                  published_post_id: postId,
                  ...(it.template === 'chapter' ? { data: { ...(api.items[it.id]?.data || it.data), status: 'publicado' } } : {}),
                });
                setPublishing(null);
              }}
            />
          </div>
        </div>
      )}
    </div>
    </WorldContext.Provider>
    </ContextMenuProvider>
    </NotebookLinksContext.Provider>
  );
}

// ============================================================================
// Corpo da nota conforme o modelo
// ============================================================================

function NoteBody({
  item,
  api,
  viewer,
  titles,
  titleExists,
  onOpenLink,
  onTag,
  onOpen,
  onNew,
  onSummary,
  onImport,
  jump,
}: {
  item: NotebookItem;
  api: NotebookApi;
  viewer: Viewer;
  titles: string[];
  titleExists: (t: string) => boolean;
  onOpenLink: (t: string) => void;
  onTag: (t: string) => void;
  onOpen: (id: string) => void;
  onNew: (o: { parentId: string | null; template?: string; title?: string }) => void;
  onSummary: (projectId: string) => void;
  onImport: (parentId: string | null) => void;
  jump: { line: number; at: number } | null;
}) {
  const onBlocks = useCallback((blocks: PostBlock[]) => api.update(item.id, { blocks }, { debounce: 1000 }), [api, item.id]);
  const persistWorkspace = useCallback(
    (data: TopicWorkspaceData) => {
      api.update(item.id, { data: data as NotebookItem['data'] }, { debounce: 400 });
    },
    [api, item.id]
  );

  if (item.kind === 'folder' && isWorld(item)) return <WorldHub project={item} />;

  if (item.kind === 'folder' && isProject(item)) {
    return <ProjectHome item={item} api={api} onOpen={onOpen} onNew={onNew} onSummary={onSummary} onImport={onImport} />;
  }

  if (item.kind === 'folder') {
    const kids = Object.values(api.items)
      .filter((i) => i.parent_id === item.id && !i.archived_at)
      .sort((a, b) => (a.kind === b.kind ? a.position - b.position : a.kind === 'folder' ? -1 : 1));
    return (
      <div className="space-y-4">
        <div className="flex gap-2">
          <button type="button" onClick={() => onNew({ parentId: item.id })} className="flex items-center gap-1.5 h-8 px-3 rounded-lg bg-[var(--nb-pane-2)] text-xs font-bold">
            <FilePlus2 className="w-3.5 h-3.5" /> Nota
          </button>
          <button type="button" onClick={() => onNew({ parentId: item.id, template: 'folder' })} className="flex items-center gap-1.5 h-8 px-3 rounded-lg bg-[var(--nb-pane-2)] text-xs font-bold">
            <FolderPlus className="w-3.5 h-3.5" /> Seção
          </button>
        </div>
        {kids.length ? (
          <div className="grid sm:grid-cols-2 gap-2">
            {kids.map((k) => (
              <button
                key={k.id}
                type="button"
                data-item-id={k.id}
                  onClick={() => onOpen(k.id)}
                className="flex items-center gap-3 p-3 rounded-xl border border-[var(--nb-line)] bg-[var(--nb-pane)] hover:border-[var(--nb-hl)] text-left"
              >
                <span className="text-xl">{itemIcon(k)}</span>
                <span className="min-w-0">
                  <span className="block truncate text-sm font-semibold">{k.title}</span>
                  <span className="text-[11px] text-[var(--nb-ink-3)]">
                    {k.kind === 'folder' ? 'seção' : `${k.word_count} palavras`} · {new Date(k.updated_at).toLocaleDateString('pt-BR')}
                  </span>
                </span>
              </button>
            ))}
          </div>
        ) : (
          <p className="text-sm text-[var(--nb-ink-3)]">Seção vazia.</p>
        )}
      </div>
    );
  }

  if (item.template === 'blocks') {
    return (
      <div className="nb-blocks-host">
        <PostComposer
          authorId={viewer.id}
          isAdmin
          embedded={{ initialBlocks: item.blocks || [], onBlocksChange: onBlocks }}
        />
      </div>
    );
  }

  if (WORKSPACE_TEMPLATES.has(item.template)) {
    return (
      <TopicWorkspaceView
        topicId={item.id}
        topicColor={item.color || getTemplate(item.template).color}
        templateType={item.template as TopicTemplateType}
        initialData={(item.data || {}) as TopicWorkspaceData}
        isAdmin
        persistOverride={persistWorkspace}
      />
    );
  }

  if (item.template === 'calendar') return <WorldCalendar item={item} api={api} />;
  if (item.template === 'timeline') return <Chronos item={item} api={api} />;

  if (item.template === 'character' && NOTEBOOK_FEATURES.characterSheet) {
    return <CharacterSheet item={item} api={api} role={viewer.role} level={viewer.contributor_level} />;
  }

  const EditorCmp = NOTEBOOK_FEATURES.richEditor ? NoteEditor : MarkdownEditor;
  const editor = (
    <EditorCmp
      item={item}
      titles={titles}
      titleExists={titleExists}
      onChange={(content) => api.update(item.id, { content }, { debounce: 900 })}
      onOpenLink={onOpenLink}
      onTag={onTag}
      onAsset={(key, url) => void api.registerAsset(item.id, key, url)}
      role={viewer.role}
      level={viewer.contributor_level}
      jumpTo={jump}
    />
  );
  // artigo profissional: estrutura, folha, fontes e referências
  if (item.template === 'article') return <ArticleMode item={item} api={api} body={editor} />;
  // verbete do Codex: o texto entra na página do verbete, dentro do Mundo
  if (item.template === 'codex') {
    const pid = projectOf(api.items, item);
    const project = pid ? api.items[pid] : null;
    if (project && codexData(item.data)) return <WorldHub project={project} article={item} body={editor} />;
  }
  return editor;
}

/** Estúdio 2D: o mapa mental ocupa toda a área da direita. */
function MindmapStudio({
  item,
  api,
  entriesApi,
  path,
  onOpen,
  onRename,
}: {
  item: NotebookItem;
  api: NotebookApi;
  entriesApi: EntriesApi;
  path: NotebookItem[];
  onOpen: (id: string) => void;
  onRename: (t: string) => void;
}) {
  const [title, setTitle] = useState(item.title);
  const [bring, setBring] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  useStudioTagger(rootRef, entriesApi.entries);
  useEffect(() => setTitle(item.title), [item.title]);
  const persist = useCallback(
    (data: TopicWorkspaceData) => {
      api.update(item.id, { data: data as NotebookItem['data'] }, { debounce: 400 });
    },
    [api, item.id]
  );
  const parent = path[path.length - 1];
  return (
    <div ref={rootRef} className="absolute inset-0 nb-studio">
      {bring && <StudioVerbetesDialog item={api.items[item.id] || item} api={api} entriesApi={entriesApi} projectId={projectOf(api.items, item)} onClose={() => setBring(false)} />}
      <TopicWorkspaceView
        topicId={item.id}
        topicColor={item.color || getTemplate(item.template).color}
        templateType="mindmap"
        initialData={(item.data || {}) as TopicWorkspaceData}
        isAdmin
        persistOverride={persist}
        studio
        studioLead={
          <div className="flex items-center gap-1.5 h-8 pl-1.5 pr-2 mr-1 border-r border-zinc-700 max-w-[360px]">
            <Glyph name="mindmap" className="text-[15px] text-[#a855f7] shrink-0" />
            {parent && (
              <>
                <button type="button" onClick={() => onOpen(parent.id)} className="text-[11px] text-zinc-400 hover:text-white truncate max-w-[110px]">
                  {parent.title}
                </button>
                <ChevronRight className="w-3 h-3 text-zinc-600 shrink-0" />
              </>
            )}
            <input
              value={title}
              onChange={(e) => setTitle(e.target.value.slice(0, 200))}
              onBlur={() => title.trim() && title !== item.title && onRename(title.trim())}
              onKeyDown={(e) => e.key === 'Enter' && (e.target as HTMLInputElement).blur()}
              aria-label="Título do mapa"
              className="min-w-0 w-36 bg-transparent outline-none text-[13px] font-bold text-white"
            />
            <button
              type="button"
              onClick={() => setBring(true)}
              title="Trazer verbetes do mundo, com as relações entre eles"
              className="ml-1 shrink-0 h-6 px-2 rounded-md border border-zinc-700 text-[11px] font-semibold text-zinc-300 hover:text-white hover:border-zinc-500"
            >
              Verbetes
            </button>
          </div>
        }
      />
    </div>
  );
}

function TitleInput({ item, onRename }: { item: NotebookItem; onRename: (t: string) => void }) {
  const [v, setV] = useState(item.title);
  useEffect(() => setV(item.title), [item.title]);
  return (
    <input
      value={v}
      onChange={(e) => setV(e.target.value.slice(0, 200))}
      onBlur={() => v.trim() && v !== item.title && onRename(v.trim())}
      onKeyDown={(e) => {
        if (e.key === 'Enter') (e.target as HTMLInputElement).blur();
        if (e.key === 'Escape') {
          setV(item.title);
          (e.target as HTMLInputElement).blur();
        }
      }}
      placeholder="Sem título"
      aria-label="Título"
      className="w-full mb-4 bg-transparent text-3xl sm:text-4xl font-black tracking-tight outline-none placeholder:text-[var(--nb-ink-3)]"
    />
  );
}

// ============================================================================
// Início do notebook
// ============================================================================

function HomeView({
  api,
  viewer,
  onOpen,
  onCreate,
  onDaily,
  onPicker,
  onImport,
  onExportAll,
  exportingAll,
}: {
  api: NotebookApi;
  viewer: Viewer;
  onOpen: (id: string) => void;
  onCreate: (t: string) => void;
  onDaily: () => void;
  onPicker: () => void;
  onImport: () => void;
  onExportAll: () => void;
  exportingAll: boolean;
}) {
  const live = Object.values(api.items).filter((i) => !i.archived_at);
  const recent = live.filter((i) => i.kind === 'note').sort((a, b) => b.updated_at.localeCompare(a.updated_at)).slice(0, 8);
  const books = live.filter((i) => i.template === 'book');
  const projects = live.filter((i) => isProject(i)).sort((a, b) => b.updated_at.localeCompare(a.updated_at));
  const words = live.reduce((n, i) => n + (i.word_count || 0), 0);
  const links = live.reduce((n, i) => n + i.links.length, 0);
  const hour = new Date().getHours();
  const hello = hour < 5 ? 'Boa madrugada' : hour < 12 ? 'Bom dia' : hour < 18 ? 'Boa tarde' : 'Boa noite';
  const name = viewer.display_name || viewer.full_name || viewer.username;

  const quick = [
    { t: 'markdown', icon: 'note' as GlyphName, label: 'Nota livre', sub: 'markdown + [[links]]' },
    { t: 'book', icon: 'book' as GlyphName, label: 'Novo livro', sub: 'modo escritor' },
    { t: 'daily', icon: 'journal' as GlyphName, label: 'Nota de hoje', sub: new Date().toLocaleDateString('pt-BR') },
    { t: 'folder', icon: 'folder' as GlyphName, label: 'Novo projeto', sub: 'livro, poesia, mundo, artigos…' },
    { t: 'mindmap', icon: 'mindmap' as GlyphName, label: 'Mapa mental', sub: 'ideias conectadas' },
    { t: 'picker', icon: 'sparkle' as GlyphName, label: 'Mais modelos', sub: 'roteiro, estudo, metas…' },
  ];

  return (
    <div className="nb-scroll absolute inset-0 overflow-y-auto">
      <div className="max-w-5xl mx-auto px-4 sm:px-8 py-10 space-y-10">
        <header>
          <p className="text-[11px] font-black tracking-[0.3em] text-[var(--nb-hl)]">{NOTEBOOK_NAME.toUpperCase()} · PREVIEW</p>
          <h1 className="mt-2 text-3xl sm:text-4xl font-black tracking-tight">
            {hello}, {name.split(' ')[0]}.
          </h1>
          <p className="mt-2 text-[var(--nb-ink-3)] text-sm">
            {live.length ? `${live.length} itens · ${words.toLocaleString('pt-BR')} palavras · ${links} conexões` : 'Seu espaço livre de criação. Comece por onde quiser.'}
          </p>
        </header>

        <section className="grid grid-cols-2 lg:grid-cols-3 gap-3">
          {quick.map((q) => (
            <button
              key={q.t}
              type="button"
              onClick={() => (q.t === 'daily' ? onDaily() : q.t === 'picker' ? onPicker() : onCreate(q.t))}
              className="group flex items-center gap-3 p-4 rounded-2xl border border-[var(--nb-line)] bg-[var(--nb-pane)] hover:border-[var(--nb-hl)] text-left transition-colors"
            >
              <span className="w-11 h-11 shrink-0 grid place-items-center rounded-xl bg-[var(--nb-pane-2)] text-[22px] text-[var(--nb-ink-2)] transition-all group-hover:text-[var(--nb-hl)] group-hover:bg-[var(--nb-hl-soft)] group-hover:scale-105">
                <Glyph name={q.icon} />
              </span>
              <span className="min-w-0">
                <span className="block font-bold text-sm">{q.label}</span>
                <span className="block text-[12px] text-[var(--nb-ink-3)] truncate">{q.sub}</span>
              </span>
            </button>
          ))}
        </section>

        {projects.length > 0 && (
          <section>
            <h2 className="nb-pane-title mb-3">Projetos</h2>
            <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-2.5">
              {projects.map((pr) => {
                const n = live.filter((i) => i.parent_id === pr.id).length;
                return (
                  <button
                    key={pr.id}
                    type="button"
                    data-item-id={pr.id}
                  onClick={() => onOpen(pr.id)}
                    className="group flex items-center gap-3 p-3.5 rounded-2xl border border-[var(--nb-line)] bg-[var(--nb-pane)] hover:border-[var(--nb-hl)] text-left transition-colors"
                  >
                    <span className="w-10 h-10 shrink-0 grid place-items-center rounded-xl bg-[var(--nb-pane-2)] text-[19px] text-[var(--nb-ink-2)] group-hover:text-[var(--nb-hl)]">
                      {itemIcon(pr)}
                    </span>
                    <span className="min-w-0">
                      <span className="block truncate font-bold text-sm">{pr.title}</span>
                      <span className="block text-[11px] text-[var(--nb-ink-3)]">
                        {n} {n === 1 ? 'item' : 'itens'} · {new Date(pr.updated_at).toLocaleDateString('pt-BR')}
                      </span>
                    </span>
                  </button>
                );
              })}
            </div>
          </section>
        )}

        {books.length > 0 && (
          <section>
            <h2 className="nb-pane-title mb-3">Estante</h2>
            <div className="flex gap-4 overflow-x-auto pb-2" style={{ scrollbarWidth: 'thin' }}>
              {books.map((b) => {
                const chapterWords = live.filter((c) => c.parent_id === b.id && c.template === 'chapter').reduce((n, c) => n + c.word_count, 0);
                return (
                  <button key={b.id} type="button" data-item-id={b.id} onClick={() => onOpen(b.id)} className="shrink-0 w-28 text-left group">
                    <span
                      className="nb-cover block w-full transition-transform group-hover:-translate-y-1"
                      style={{ background: `linear-gradient(150deg, ${b.color || '#b45309'}, #1c1917)` }}
                    >
                      <span className="absolute inset-0 flex items-end p-2.5 text-white font-serif font-bold text-[13px] leading-tight">{b.title}</span>
                    </span>
                    <span className="block mt-2 text-[11px] text-[var(--nb-ink-3)]">{chapterWords.toLocaleString('pt-BR')} palavras</span>
                  </button>
                );
              })}
            </div>
          </section>
        )}

        {recent.length > 0 && (
          <section>
            <h2 className="nb-pane-title mb-3">Editados recentemente</h2>
            <div className="grid sm:grid-cols-2 gap-2">
              {recent.map((r) => (
                <button
                  key={r.id}
                  type="button"
                  data-item-id={r.id}
                  onClick={() => onOpen(r.id)}
                  className="flex items-center gap-3 p-3 rounded-xl hover:bg-[var(--nb-pane)] text-left border border-transparent hover:border-[var(--nb-line)]"
                >
                  <span className="text-lg">{itemIcon(r)}</span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-semibold">{r.title}</span>
                    <span className="text-[11px] text-[var(--nb-ink-3)]">
                      {getTemplate(r.template).name} · {new Date(r.updated_at).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' })}
                    </span>
                  </span>
                </button>
              ))}
            </div>
          </section>
        )}

        <section className="rounded-2xl border border-[var(--nb-line)] bg-[var(--nb-pane)] p-5">
          <h2 className="nb-pane-title mb-1">Seus dados</h2>
          <p className="text-[13px] text-[var(--nb-ink-3)] mb-3">
            Traga textos de outros programas ou leve tudo com você: nada fica preso aqui.
          </p>
          <div className="grid sm:grid-cols-2 gap-2.5">
            <button
              type="button"
              onClick={onImport}
              className="group flex items-center gap-3 p-3 rounded-xl border border-[var(--nb-line)] hover:border-[var(--nb-hl)] text-left"
            >
              <span className="w-10 h-10 shrink-0 grid place-items-center rounded-xl bg-[var(--nb-pane-2)] text-[var(--nb-ink-2)] group-hover:text-[var(--nb-hl)]">
                <Upload className="w-4 h-4" />
              </span>
              <span className="min-w-0">
                <span className="block text-[13px] font-bold">Importar arquivos</span>
                <span className="block text-[11px] text-[var(--nb-ink-3)]">Word, Markdown, HTML, CSV, Excel, agenda (.ics) e backup</span>
              </span>
            </button>
            <button
              type="button"
              onClick={onExportAll}
              disabled={exportingAll}
              className="group flex items-center gap-3 p-3 rounded-xl border border-[var(--nb-line)] hover:border-[var(--nb-hl)] text-left disabled:opacity-60"
            >
              <span className="w-10 h-10 shrink-0 grid place-items-center rounded-xl bg-[var(--nb-pane-2)] text-[var(--nb-ink-2)] group-hover:text-[var(--nb-hl)]">
                {exportingAll ? <Loader2 className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />}
              </span>
              <span className="min-w-0">
                <span className="block text-[13px] font-bold">{exportingAll ? 'Preparando…' : 'Exportar tudo (.zip)'}</span>
                <span className="block text-[11px] text-[var(--nb-ink-3)]">Markdown de tudo + backup completo para reimportar</span>
              </span>
            </button>
          </div>
        </section>

        <section className="rounded-2xl border border-[var(--nb-line)] bg-[var(--nb-pane)] p-5">
          <h2 className="nb-pane-title mb-3">Atalhos</h2>
          <div className="grid sm:grid-cols-2 gap-x-8 gap-y-2 text-[13px] text-[var(--nb-ink-2)]">
            {[
              ['Ctrl O', 'abrir rápido / criar'],
              ['Ctrl N', 'nova nota'],
              ['Ctrl Shift F', 'buscar no texto'],
              ['Ctrl G', 'grafo'],
              ['Ctrl E', 'ler / editar markdown'],
              ['Ctrl \\', 'mostrar arquivos'],
              ['[[', 'link para outra nota'],
              ['Ctrl Enter', 'marcar tarefa'],
              ['Ctrl .', 'modo foco (Esc sai)'],
              ['Ctrl Shift \\', 'ocultar barra lateral'],
            ].map(([k, d]) => (
              <div key={k} className="flex items-center justify-between gap-3">
                <span>{d}</span>
                <span className="flex gap-1">
                  {k.split(' ').map((p) => (
                    <span key={p} className="nb-kbd">
                      {p}
                    </span>
                  ))}
                </span>
              </div>
            ))}
          </div>
        </section>
      </div>
    </div>
  );
}

// ============================================================================
// Peças pequenas
// ============================================================================

function RibbonBtn({ label, active, onClick, children }: { label: string; active?: boolean; onClick: () => void; children: React.ReactElement }) {
  return (
    <button type="button" title={label} aria-label={label} data-active={!!active} onClick={onClick} className="nb-ribbon-btn [&>svg]:w-[18px] [&>svg]:h-[18px]">
      {children}
    </button>
  );
}

function MenuRow({ icon, children, onClick, danger }: { icon: React.ReactElement; children: React.ReactNode; onClick: () => void; danger?: boolean }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`w-full flex items-center gap-2.5 px-3 py-1.5 text-left hover:bg-[var(--nb-pane-2)] [&>svg]:w-4 [&>svg]:h-4 ${danger ? 'text-red-400' : 'text-[var(--nb-ink-2)]'}`}
    >
      {icon}
      {children}
    </button>
  );
}

function SaveBadge({ state, pending }: { state: NotebookApi['saveState']; pending: number }) {
  if (state === 'idle' && !pending) return null;
  // indicador mínimo: Salvo, Salvando… ou Offline (com o que ficou guardado no aparelho)
  const offline = state === 'offline';
  const label = offline ? (pending ? `offline · ${pending} ${pending === 1 ? 'alteração guardada' : 'alterações guardadas'}` : 'offline') : state === 'saving' ? 'salvando' : state === 'error' ? 'erro ao salvar' : pending ? `${pending} na fila` : 'salvo';
  const icon = offline ? <CloudOff className="w-3 h-3" /> : state === 'saving' ? <Loader2 className="w-3 h-3 animate-spin" /> : state === 'error' ? <AlertTriangle className="w-3 h-3" /> : <Check className="w-3 h-3" />;
  return (
    <span
      className={`self-center flex items-center gap-1 px-2 text-[11px] ${state === 'error' || offline ? 'text-amber-400' : 'text-[var(--nb-ink-3)]'}`}
      aria-live="polite"
      title={offline ? 'Sem conexão. Tudo fica guardado neste aparelho e sobe sozinho quando a internet voltar.' : undefined}
    >
      {icon}
      <span className="hidden sm:inline">{label}</span>
    </span>
  );
}
