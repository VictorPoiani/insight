'use client';

/**
 * Canvas (como o do Obsidian), versão profissional:
 * - seleção em área, Shift+clique, Espaço/botão do meio para mover a vista,
 *   zoom no cursor (Ctrl+roda ou pinça);
 * - guias magnéticas (bordas, centros, espaços iguais) ao mover e redimensionar;
 * - alinhar, distribuir, grade, grupos, camadas e travar;
 * - desfazer/refazer, menus por alvo, barra flutuante da seleção;
 * - imagens enviadas sem perda para o R2 (aparecem na hora, sobem por trás).
 */
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { BookMarked, BringToFront, ChevronRight, ClipboardPaste, Copy, ExternalLink, FileText, Focus, Globe, Group, ImagePlus, LayoutGrid, LayoutTemplate, Lock, LockOpen, Maximize, Paperclip, Scissors, SendToBack, StickyNote, Trash2, Ungroup } from 'lucide-react';
import type { NotebookItem } from '@/lib/notebook/types';
import type { NotebookApi } from '@/lib/notebook/useNotebook';
import type { EntriesApi } from '@/lib/notebook/useEntries';
import type { NotebookEntry } from '@/lib/notebook/entries';
import { getUserUploadLimitBytes } from '@/lib/contributorLevels';
import { CANVAS_COLORS, autoSides, cuid, edgePath, sidePoint, toJsonCanvas, canvasColor, type CanvasData, type CanvasEdge, type CanvasNode, type CanvasSide } from '@/lib/notebook/canvas';
import {
  SpatialGrid,
  alignNodes,
  arrangeGrid,
  bboxOf,
  cloneNodes,
  contains,
  distributeNodes,
  groupChildren,
  intersects,
  reorder,
  resizeBox,
  snapMove,
  snapResize,
  snapToGrid,
  type AlignKind,
  type Box,
  type Guide,
} from '@/lib/notebook/canvasGeom';
import { useCanvasDoc } from '@/lib/notebook/useCanvasDoc';
import { CANVAS_FILE, CANVAS_TEXT, formatSize, imageSize, uploadCanvasFile, uploadCanvasImage } from '@/lib/notebook/canvasMedia';
import { clipPage, fetchExternalImage, trackStockDownload, type PluginResult } from '@/lib/notebook/canvasPlugins';
import { CANVAS_TEMPLATES } from '@/lib/notebook/canvasTemplates';
import { PluginPanel, PLUGIN_DRAG } from './CanvasPlugins';
import { Glyph } from '../icons/Glyph';
import { useNotebookMenu, type MenuEntry } from '../menu/ContextMenu';
import { CanvasNodeView, type NodeCtx } from './CanvasNodeView';
import { EntryPicker, HelpPanel, NotePicker, RightRail, SelectionBar, TemplateMenu, type CanvasPrefs } from './CanvasChrome';

type View = { x: number; y: number; k: number };
type Gesture =
  | { kind: 'pan'; sx: number; sy: number; vx: number; vy: number }
  | { kind: 'move'; sx: number; sy: number; base: CanvasData; ids: Set<string>; bb0: Box; others: Box[]; moved: boolean }
  | { kind: 'resize'; id: string; dir: string; sx: number; sy: number; base: CanvasData; start: Box; others: Box[]; ratio: number }
  | { kind: 'marquee'; sx: number; sy: number; x: number; y: number; add: Set<string>; moved: boolean }
  | { kind: 'connect'; from: string; side: CanvasSide; x: number; y: number }
  | { kind: 'pinch'; d0: number; k0: number; wx: number; wy: number };

const SIDES: CanvasSide[] = ['top', 'right', 'bottom', 'left'];
const MIN_K = 0.05;
const MAX_K = 4;
const GRID = 20;
const CLIP_MARK = 'insight-canvas/v1:';
const PREFS_KEY = 'nb-canvas-prefs';
const IMG_W = 400;
const ENTRY_DRAG = 'application/x-insight-entry';
/** Pedido vindo de fora (paleta de comandos): { id do canvas, comando }. */
export const CANVAS_CMD_EVENT = 'nb-canvas-cmd';

const clampK = (k: number) => Math.min(MAX_K, Math.max(MIN_K, k));
const isField = (t: EventTarget | null) => !!(t as HTMLElement | null)?.closest?.('input,textarea,select,[contenteditable="true"]');

export function CanvasStudio({
  item,
  api,
  path,
  onOpen,
  onRename,
  role,
  level,
  entriesApi,
  onOpenEntry,
}: {
  item: NotebookItem;
  api: NotebookApi;
  path: NotebookItem[];
  onOpen: (id: string) => void;
  onRename: (t: string) => void;
  role?: string | null;
  level?: number | null;
  entriesApi?: EntriesApi;
  onOpenEntry?: (e: NotebookEntry) => void;
}) {
  const menu = useNotebookMenu();
  const entries = entriesApi?.entries || {};
  const doc = useCanvasDoc(item, api, (id) => entriesApi?.entries[id]?.title || null);
  const { data, dataRef, commit, live, silent } = doc;

  const [view, setView] = useState<View>({ x: 0, y: 0, k: 1 });
  const viewRef = useRef(view);
  viewRef.current = view;
  const [size, setSize] = useState({ w: 0, h: 0 });
  const [sel, setSelState] = useState<Set<string>>(new Set());
  const selRef = useRef(sel);
  const setSel = useCallback((s: Set<string>) => {
    selRef.current = s;
    setSelState(s);
  }, []);
  const [selEdge, setSelEdge] = useState<string | null>(null);
  const [editing, setEditing] = useState<string | null>(null);
  const [edgeLabel, setEdgeLabel] = useState<string | null>(null);
  const [gesture, setGesture] = useState<Gesture | null>(null);
  const gRef = useRef<Gesture | null>(null);
  const [guides, setGuides] = useState<Guide[]>([]);
  const [space, setSpace] = useState(false);
  const spaceRef = useRef(false);
  const [picker, setPicker] = useState<{ x: number; y: number } | null>(null);
  const [entryPicker, setEntryPicker] = useState<{ x: number; y: number } | null>(null);
  const [templates, setTemplates] = useState(false);
  const [plugins, setPlugins] = useState<string | null>(null);
  const [help, setHelp] = useState(false);
  const [uploads, setUploads] = useState(0);
  const [title, setTitle] = useState(item.title);
  const [prefs, setPrefsState] = useState<CanvasPrefs>(() => {
    try {
      return { snap: true, grid: false, ...JSON.parse(localStorage.getItem(PREFS_KEY) || '{}') };
    } catch {
      return { snap: true, grid: false };
    }
  });
  const prefsRef = useRef(prefs);
  prefsRef.current = prefs;
  const setPrefs = (p: CanvasPrefs) => {
    setPrefsState(p);
    try {
      localStorage.setItem(PREFS_KEY, JSON.stringify(p));
    } catch {
      /* sem armazenamento */
    }
  };
  const boxRef = useRef<HTMLDivElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const filePoint = useRef<[number, number] | null>(null);
  const pointer = useRef<[number, number] | null>(null);
  const touches = useRef(new Map<number, [number, number]>());
  const nudge = useRef<{ t: number; base: CanvasData } | null>(null);

  // ------------------------------------------------------------ coordenadas
  const toWorld = useCallback((cx: number, cy: number): [number, number] => {
    const r = boxRef.current?.getBoundingClientRect();
    const v = viewRef.current;
    return r ? [(cx - r.left - v.x) / v.k, (cy - r.top - v.y) / v.k] : [0, 0];
  }, []);
  const center = useCallback((): [number, number] => {
    const r = boxRef.current?.getBoundingClientRect();
    return r ? toWorld(r.left + r.width / 2, r.top + r.height / 2) : [0, 0];
  }, [toWorld]);
  /** onde colar: no cursor, se ele estiver sobre o quadro */
  const dropPoint = (): [number, number] => pointer.current || center();

  const zoomTo = useCallback((b: Box | null, max = 1.2) => {
    const box = boxRef.current?.getBoundingClientRect();
    if (!box) return;
    if (!b) return setView({ x: box.width / 2, y: box.height / 2, k: 1 });
    const k = clampK(Math.min(max, (box.width - 160) / (b.width || 1), (box.height - 180) / (b.height || 1)));
    setView({ k, x: box.width / 2 - (b.x + b.width / 2) * k - 20, y: box.height / 2 - (b.y + b.height / 2) * k + 10 });
  }, []);
  const fit = useCallback(() => zoomTo(bboxOf(dataRef.current.nodes)), [zoomTo, dataRef]);
  const zoomSel = useCallback(() => zoomTo(bboxOf(dataRef.current.nodes.filter((n) => selRef.current.has(n.id))), 2), [zoomTo, dataRef]);
  const zoomAt = (factor: number, cx?: number, cy?: number) => {
    const r = boxRef.current?.getBoundingClientRect();
    if (!r) return;
    const mx = cx ?? r.width / 2;
    const my = cy ?? r.height / 2;
    setView((v) => {
      const k = clampK(v.k * factor);
      return { k, x: mx - ((mx - v.x) / v.k) * k, y: my - ((my - v.y) / v.k) * k };
    });
  };

  // enquadra quando termina de carregar
  const fitted = useRef(false);
  useEffect(() => {
    if (doc.loaded && !fitted.current) {
      fitted.current = true;
      fit();
    }
  }, [doc.loaded, fit]);

  // tamanho da área (para desenhar só o que aparece)
  useEffect(() => {
    const el = boxRef.current;
    if (!el) return;
    const ro = new ResizeObserver(() => setSize({ w: el.clientWidth, h: el.clientHeight }));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  // roda: rola; Ctrl/pinça do trackpad: zoom no cursor
  useEffect(() => {
    const el = boxRef.current;
    if (!el) return;
    const onWheel = (e: WheelEvent) => {
      if ((e.target as HTMLElement).closest('.nb-cv-scroll') && !e.ctrlKey && !e.metaKey) return;
      if ((e.target as HTMLElement).closest('[data-cv-ui]')) return;
      e.preventDefault();
      const r = el.getBoundingClientRect();
      if (e.ctrlKey || e.metaKey) zoomAt(Math.exp(-e.deltaY * (e.deltaMode === 1 ? 0.05 : 0.0022)), e.clientX - r.left, e.clientY - r.top);
      else setView((v) => ({ ...v, x: v.x - (e.shiftKey && !e.deltaX ? e.deltaY : e.deltaX), y: v.y - (e.shiftKey && !e.deltaX ? 0 : e.deltaY) }));
    };
    el.addEventListener('wheel', onWheel, { passive: false });
    return () => el.removeEventListener('wheel', onWheel);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ------------------------------------------------------------ ajudantes de dados
  const nodesById = useMemo(() => new Map(data.nodes.map((n) => [n.id, n])), [data.nodes]);
  const grid = useMemo(() => new SpatialGrid(data.nodes), [data.nodes]);
  const gridRef = useRef(grid);
  gridRef.current = grid;

  const mapNodes = (ids: Set<string>, fn: (n: CanvasNode) => CanvasNode) => commit({ ...dataRef.current, nodes: dataRef.current.nodes.map((n) => (ids.has(n.id) ? fn(n) : n)) });
  const addNodes = (nodes: CanvasNode[], edit = false) => {
    commit({ ...dataRef.current, nodes: [...dataRef.current.nodes, ...nodes] }, undefined, 200);
    setSel(new Set(nodes.map((n) => n.id)));
    setSelEdge(null);
    if (edit && nodes[0]) setEditing(nodes[0].id);
  };
  const removeNodes = (ids: Set<string>, edgeId: string | null = null) => {
    const d = dataRef.current;
    const kill = new Set(Array.from(ids).filter((id) => !nodesById.get(id)?.locked));
    if (!kill.size && !edgeId) return;
    commit({ nodes: d.nodes.filter((n) => !kill.has(n.id)), edges: d.edges.filter((e) => e.id !== edgeId && !kill.has(e.fromNode) && !kill.has(e.toNode)) }, undefined, 200);
    setSel(new Set());
    setSelEdge(null);
  };
  const duplicate = (ids: Set<string>) => {
    const c = cloneNodes(dataRef.current, ids, 40, 40);
    commit({ nodes: [...dataRef.current.nodes, ...c.nodes], edges: [...dataRef.current.edges, ...c.edges] }, undefined, 200);
    setSel(new Set(c.nodes.map((n) => n.id)));
  };
  const setColor = (ids: Set<string>, color: string | null) => mapNodes(ids, (n) => ({ ...n, color }));
  const toggleLock = (ids: Set<string>) => {
    const all = Array.from(ids).every((id) => nodesById.get(id)?.locked);
    mapNodes(ids, (n) => ({ ...n, locked: all ? undefined : true }));
  };
  const doAlign = (k: AlignKind) => commit({ ...dataRef.current, nodes: alignNodes(dataRef.current.nodes, selRef.current, k) });
  const doDistribute = (axis: 'x' | 'y') => commit({ ...dataRef.current, nodes: distributeNodes(dataRef.current.nodes, selRef.current, axis) });
  const doGrid = () => commit({ ...dataRef.current, nodes: arrangeGrid(dataRef.current.nodes, selRef.current) });
  const doOrder = (how: 'front' | 'back' | 'forward' | 'backward', ids = selRef.current) => commit({ ...dataRef.current, nodes: reorder(dataRef.current.nodes, ids, how) });

  /** Grupo: com seleção, abraça os itens escolhidos; sem, cria um vazio. */
  const addGroup = (x: number, y: number, ids = selRef.current) => {
    const chosen = dataRef.current.nodes.filter((n) => ids.has(n.id));
    const pad = 40;
    const bb = bboxOf(chosen);
    const g: CanvasNode = bb
      ? { id: cuid(), type: 'group', x: bb.x - pad, y: bb.y - pad - 10, width: bb.width + pad * 2, height: bb.height + pad * 2 + 10, label: 'Grupo' }
      : { id: cuid(), type: 'group', x: x - 240, y: y - 160, width: 480, height: 320, label: 'Grupo' };
    commit({ ...dataRef.current, nodes: [g, ...dataRef.current.nodes] }, undefined, 200);
    setSel(new Set([g.id]));
    setEditing(g.id);
  };
  const ungroup = (ids: Set<string>) => {
    const groups = dataRef.current.nodes.filter((n) => ids.has(n.id) && n.type === 'group');
    if (!groups.length) return;
    const inside = new Set(groups.flatMap((g) => groupChildren(dataRef.current.nodes, g).map((c) => c.id)));
    const gone = new Set(groups.map((g) => g.id));
    commit({ nodes: dataRef.current.nodes.filter((n) => !gone.has(n.id)), edges: dataRef.current.edges.filter((e) => !gone.has(e.fromNode) && !gone.has(e.toNode)) });
    setSel(inside);
  };

  // ------------------------------------------------------------ copiar e colar
  const clipText = (ids: Set<string>) => {
    const c = cloneNodes(dataRef.current, ids, 0, 0);
    return CLIP_MARK + JSON.stringify(c);
  };
  const pasteClip = (text: string, at: [number, number]) => {
    try {
      const raw = JSON.parse(text.slice(CLIP_MARK.length)) as CanvasData;
      const bb = bboxOf(raw.nodes);
      if (!bb) return;
      const c = cloneNodes(raw, new Set(raw.nodes.map((n) => n.id)), at[0] - (bb.x + bb.width / 2), at[1] - (bb.y + bb.height / 2));
      // notas de outro caderno não existem aqui
      c.nodes = c.nodes.filter((n) => n.type !== 'note' || (n.itemId && api.items[n.itemId]));
      commit({ nodes: [...dataRef.current.nodes, ...c.nodes], edges: [...dataRef.current.edges, ...c.edges] }, undefined, 200);
      setSel(new Set(c.nodes.map((n) => n.id)));
    } catch {
      /* texto inválido */
    }
  };
  const pasteText = (text: string, at: [number, number]) => {
    const t = text.trim();
    if (!t) return;
    if (t.startsWith(CLIP_MARK)) return pasteClip(t, at);
    if (/^https?:\/\/\S+$/.test(t)) addLink(t, at);
    else addNodes([{ id: cuid(), type: 'text', x: Math.round(at[0] - 150), y: Math.round(at[1] - 60), width: 300, height: Math.min(400, 80 + Math.ceil(t.length / 40) * 22), text: t.slice(0, 20000) }]);
  };
  const copySel = async (cut = false) => {
    const ids = selRef.current;
    if (!ids.size) return;
    try {
      await navigator.clipboard.writeText(clipText(ids));
    } catch {
      /* sem permissão */
    }
    if (cut) removeNodes(ids);
  };
  const pasteFromMenu = async (at: [number, number]) => {
    try {
      const items = await navigator.clipboard.read();
      const files: File[] = [];
      for (const it of items) {
        const type = it.types.find((t) => t.startsWith('image/'));
        if (type) files.push(new File([await it.getType(type)], `Imagem colada ${stamp()}.${type.split('/')[1]}`, { type }));
      }
      if (files.length) return void addImages(files, at[0], at[1]);
    } catch {
      /* o navegador não deixa ler imagens */
    }
    try {
      pasteText(await navigator.clipboard.readText(), at);
    } catch {
      alert('O navegador não liberou a área de transferência. Use Ctrl+V.');
    }
  };

  // ------------------------------------------------------------ mídia (R2, sem perda)
  /** Qualquer arquivo: imagem, PDF/áudio/vídeo ou texto (vira cartão). */
  async function addFiles(files: File[], x: number, y: number) {
    const imgs = files.filter((f) => f.type.startsWith('image/'));
    const media = files.filter((f) => CANVAS_FILE.test(f.type));
    const texts = files.filter((f) => !f.type.startsWith('image/') && !CANVAS_FILE.test(f.type) && (CANVAS_TEXT.test(f.type) || CANVAS_TEXT.test(f.name)));
    const other = files.filter((f) => !imgs.includes(f) && !media.includes(f) && !texts.includes(f));
    if (other.length) alert(`Este tipo de arquivo ainda não entra no canvas: ${other.map((f) => f.name).join(', ')}.`);
    let dy = 0;
    if (texts.length) {
      const made: CanvasNode[] = [];
      for (const [i, f] of texts.slice(0, 20).entries()) {
        if (f.size > 2_000_000) {
          alert(`${f.name}: texto grande demais para um cartão.`);
          continue;
        }
        const body = (await f.text()).replace(/\r\n/g, '\n').slice(0, 20000);
        const title = f.name.replace(/\.(md|markdown|txt)$/i, '');
        made.push({ id: cuid(), type: 'text', x: Math.round(x - 170 + i * 30), y: Math.round(y - 120 + i * 30), width: 340, height: 260, text: /^#\s/.test(body) ? body : `# ${title}\n\n${body}` });
      }
      if (made.length) addNodes(made);
      dy += 300;
    }
    if (media.length) void addMedia(media, x, y + dy), (dy += 380);
    if (imgs.length) void addImages(imgs, x, y + dy);
  }

  async function addMedia(files: File[], x: number, y: number) {
    const budget = getUserUploadLimitBytes(level ?? 0, role ?? undefined);
    const made = files.slice(0, 12).map((f, i) => {
      const kind = f.type === 'application/pdf' ? 'pdf' : f.type.startsWith('audio/') ? 'audio' : 'video';
      const [w, h] = kind === 'pdf' ? [420, 560] : kind === 'audio' ? [360, 110] : [480, 310];
      const node: CanvasNode = { id: cuid(), type: 'file', x: Math.round(x - w / 2 + i * 40), y: Math.round(y - h / 2 + i * 40), width: w, height: h, url: URL.createObjectURL(f), label: f.name, mime: f.type, bytes: f.size, pending: true };
      return { node, file: f };
    });
    addNodes(made.map((m) => m.node));
    setUploads((u) => u + made.length);
    await Promise.all(
      made.map(async ({ node, file }) => {
        try {
          const up = await uploadCanvasFile(file, { itemId: item.id, profileId: item.profile_id, budgetBytes: budget });
          silent((d) => ({ ...d, nodes: d.nodes.map((n) => (n.id === node.id ? { ...n, url: up.url, assetId: up.assetId, bytes: up.bytes, pending: undefined } : n)) }));
          setTimeout(() => URL.revokeObjectURL(node.url!), 4000);
        } catch (err) {
          silent((d) => ({ nodes: d.nodes.filter((n) => n.id !== node.id), edges: d.edges.filter((e) => e.fromNode !== node.id && e.toNode !== node.id) }));
          URL.revokeObjectURL(node.url!);
          alert(`${file.name}: ${err instanceof Error ? err.message : 'falha no envio.'}`);
        } finally {
          setUploads((u) => u - 1);
        }
      })
    );
  }

  /** Cartão de link: aparece na hora e ganha a prévia (título, imagem) do servidor. */
  const addLink = (url: string, at: [number, number], meta?: CanvasNode['meta']) => {
    const id = cuid();
    const rich = !!(meta && (meta.title || meta.image));
    addNodes([{ id, type: 'link', x: Math.round(at[0] - 180), y: Math.round(at[1] - (rich ? 150 : 45)), width: 360, height: rich ? (meta?.image ? 300 : 150) : 90, url: url.slice(0, 2000), meta: meta || undefined }]);
    if (meta) return;
    clipPage(url)
      .then((m) => {
        if (m.isImage) return;
        if (!m.title && !m.image) return;
        silent((d) => ({
          ...d,
          nodes: d.nodes.map((n) => (n.id === id ? { ...n, meta: { title: m.title, description: m.description, image: m.image, site: m.site }, height: Math.max(n.height, m.image ? 300 : 150) } : n)),
        }));
      })
      .catch(() => {
        /* fica o link simples */
      });
  };

  const addEntry = (e: NotebookEntry, at: [number, number]) =>
    addNodes([{ id: cuid(), type: 'entry', x: Math.round(at[0] - 170), y: Math.round(at[1] - 110), width: 340, height: e.image_url ? 300 : 200, entryId: e.id, label: e.title }]);

  const addTemplate = (id: string) => {
    const t = CANVAS_TEMPLATES.find((x) => x.id === id);
    if (!t) return;
    const [cx, cy] = center();
    let built = t.build(cx, cy);
    // não cobre o que já existe: vai para o espaço livre à direita
    const bb = bboxOf(built.nodes);
    const taken = bboxOf(dataRef.current.nodes);
    if (bb && taken && intersects({ x: bb.x - 80, y: bb.y - 80, width: bb.width + 160, height: bb.height + 160 }, taken)) {
      const dx = taken.x + taken.width + 200 - bb.x;
      const dy = taken.y - bb.y;
      built = { ...built, nodes: built.nodes.map((n) => ({ ...n, x: n.x + dx, y: n.y + dy })) };
    }
    const groupsFirst = [...built.nodes.filter((n) => n.type === 'group'), ...built.nodes.filter((n) => n.type !== 'group')];
    commit({ nodes: [...dataRef.current.nodes, ...groupsFirst], edges: [...dataRef.current.edges, ...built.edges] }, undefined, 200);
    setSel(new Set(built.nodes.map((n) => n.id)));
    setTimeout(() => zoomTo(bboxOf(built.nodes), 1), 30);
  };

  /** Resultado de um plugin entra no canvas. */
  const insertResult = async (r: PluginResult, at: [number, number] = center()) => {
    if (r.kind === 'text') {
      addNodes([{ id: cuid(), type: 'text', x: Math.round(at[0] - 180), y: Math.round(at[1] - 140), width: 360, height: 280, text: `## ${r.title}\n\n${r.text}\n\n[Wikipedia](${r.url})` }]);
      return;
    }
    if (r.kind === 'link') return addLink(r.url, at, { title: r.title, description: r.description, image: r.image, site: r.site });
    if (r.hotlink) {
      // Unsplash: exibe pelo endereço deles e avisa o download
      const w = IMG_W;
      const h = r.width && r.height ? Math.round((w * r.height) / r.width) : 280;
      addNodes([{ id: cuid(), type: 'image', x: Math.round(at[0] - w / 2), y: Math.round(at[1] - h / 2), width: w, height: h, url: r.full, label: r.title, natW: r.width, natH: r.height, credit: r.credit, creditUrl: r.creditUrl }]);
      trackStockDownload('unsplash', r.track);
      return;
    }
    try {
      setUploads((u) => u + 1);
      const f = await fetchExternalImage(r.full, r.title);
      await addImages([f], at[0], at[1], r.credit, r.creditUrl);
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Não foi possível trazer a imagem.');
    } finally {
      setUploads((u) => u - 1);
    }
  };

  async function addImages(files: File[], x: number, y: number, credit?: string, creditUrl?: string) {
    const list = files.filter((f) => f.type.startsWith('image/')).slice(0, 30);
    if (!list.length) return;
    const budget = getUserUploadLimitBytes(level ?? 0, role ?? undefined);
    // 1) aparece na hora, com o arquivo local
    const made: { node: CanvasNode; file: File; size: { width: number; height: number } | null }[] = [];
    let ox = 0;
    for (const f of list) {
      const s = await imageSize(f);
      const w = s ? Math.min(IMG_W, s.width) : IMG_W;
      const h = s ? Math.round((w * s.height) / s.width) : 300;
      made.push({
        file: f,
        size: s,
        node: {
          id: cuid(),
          type: 'image',
          x: Math.round(x - w / 2 + ox),
          y: Math.round(y - h / 2),
          width: w,
          height: h,
          url: URL.createObjectURL(f),
          label: f.name || `Imagem ${stamp()}`,
          mime: f.type,
          bytes: f.size,
          natW: s?.width,
          natH: s?.height,
          credit,
          creditUrl,
          pending: true,
        },
      });
      ox += w + 40;
    }
    addNodes(made.map((m) => m.node));
    // 2) sobe o original por trás e troca o endereço quando terminar
    setUploads((u) => u + made.length);
    await Promise.all(
      made.map(async ({ node, file, size }) => {
        try {
          const up = await uploadCanvasImage(file, { itemId: item.id, profileId: item.profile_id, budgetBytes: budget, size });
          silent((d) => ({ ...d, nodes: d.nodes.map((n) => (n.id === node.id ? { ...n, url: up.url, assetId: up.assetId, mime: up.mime, bytes: up.bytes, pending: undefined } : n)) }));
          setTimeout(() => URL.revokeObjectURL(node.url!), 4000);
        } catch (err) {
          silent((d) => ({ nodes: d.nodes.filter((n) => n.id !== node.id), edges: d.edges.filter((e) => e.fromNode !== node.id && e.toNode !== node.id) }));
          URL.revokeObjectURL(node.url!);
          alert(`${file.name}: ${err instanceof Error ? err.message : 'falha no envio.'}`);
        } finally {
          setUploads((u) => u - 1);
        }
      })
    );
  }

  // notas incorporadas: carrega o texto
  const noteKey = data.nodes
    .filter((n) => n.type === 'note' && n.itemId)
    .map((n) => n.itemId)
    .join(',');
  useEffect(() => {
    noteKey
      .split(',')
      .filter(Boolean)
      .forEach((id) => api.items[id] && !api.items[id]._full && void api.loadFull(id));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [noteKey]);

  // ------------------------------------------------------------ gestos
  const endGesture = () => {
    gRef.current = null;
    setGesture(null);
    setGuides([]);
  };
  const begin = (g: Gesture) => {
    gRef.current = g;
    setGesture(g);
    const move = (e: PointerEvent) => onMove(e);
    const up = (e: PointerEvent) => {
      if (e.pointerType === 'touch') touches.current.delete(e.pointerId);
      if (gRef.current?.kind === 'pinch' && touches.current.size) return;
      window.removeEventListener('pointermove', move);
      window.removeEventListener('pointerup', up);
      window.removeEventListener('pointercancel', up);
      onUp(e);
    };
    window.addEventListener('pointermove', move);
    window.addEventListener('pointerup', up);
    window.addEventListener('pointercancel', up);
  };

  /** Caixas vizinhas para as guias (perto da vista, fora do que se move). */
  const neighbours = (skip: Set<string>): Box[] => {
    const r = boxRef.current?.getBoundingClientRect();
    const v = viewRef.current;
    const area = r ? { x: -v.x / v.k - 200, y: -v.y / v.k - 200, width: r.width / v.k + 400, height: r.height / v.k + 400 } : { x: -1e6, y: -1e6, width: 2e6, height: 2e6 };
    return gridRef.current
      .query(area)
      .filter((n) => !skip.has(n.id))
      .slice(0, 400);
  };

  function onMove(e: PointerEvent) {
    const g = gRef.current;
    if (!g) return;
    if (e.pointerType === 'touch') touches.current.set(e.pointerId, [e.clientX, e.clientY]);
    const k = viewRef.current.k;
    if (g.kind === 'pinch') {
      const pts = Array.from(touches.current.values());
      if (pts.length < 2) return;
      const d = Math.hypot(pts[0][0] - pts[1][0], pts[0][1] - pts[1][1]);
      const r = boxRef.current!.getBoundingClientRect();
      const mx = (pts[0][0] + pts[1][0]) / 2 - r.left;
      const my = (pts[0][1] + pts[1][1]) / 2 - r.top;
      const nk = clampK((g.k0 * d) / g.d0);
      setView({ k: nk, x: mx - g.wx * nk, y: my - g.wy * nk });
      return;
    }
    if (g.kind === 'pan') {
      setView((v) => ({ ...v, x: g.vx + e.clientX - g.sx, y: g.vy + e.clientY - g.sy }));
      return;
    }
    if (g.kind === 'move') {
      let dx = (e.clientX - g.sx) / k;
      let dy = (e.clientY - g.sy) / k;
      if (!g.moved && Math.hypot(e.clientX - g.sx, e.clientY - g.sy) < 3) return;
      g.moved = true;
      let gl: Guide[] = [];
      const p = prefsRef.current;
      if (p.snap && !e.altKey) {
        const r = snapMove({ ...g.bb0, x: g.bb0.x + dx, y: g.bb0.y + dy }, g.others, 6 / k);
        dx += r.dx;
        dy += r.dy;
        gl = r.guides;
      }
      if (p.grid && !e.altKey && !gl.length) {
        dx = snapToGrid(g.bb0.x + dx, GRID) - g.bb0.x;
        dy = snapToGrid(g.bb0.y + dy, GRID) - g.bb0.y;
      }
      setGuides(gl);
      live({ ...g.base, nodes: g.base.nodes.map((n) => (g.ids.has(n.id) ? { ...n, x: Math.round(n.x + dx), y: Math.round(n.y + dy) } : n)) });
      return;
    }
    if (g.kind === 'resize') {
      const dx = (e.clientX - g.sx) / k;
      const dy = (e.clientY - g.sy) / k;
      const n0 = g.base.nodes.find((n) => n.id === g.id);
      if (!n0) return;
      const keep = n0.type === 'image' ? !e.shiftKey : e.shiftKey;
      const min = n0.type === 'group' ? 120 : n0.type === 'image' ? 40 : 100;
      let b = resizeBox(g.start, g.dir, dx, dy, { minW: min, minH: n0.type === 'image' ? 30 : 50, ratio: keep ? g.ratio : null });
      let gl: Guide[] = [];
      if (prefsRef.current.snap && !e.altKey && !keep) {
        const r = snapResize(b, g.dir, g.others, 6 / k);
        b = r.box;
        gl = r.guides;
      } else if (prefsRef.current.grid && !e.altKey && !keep) {
        const x2 = snapToGrid(b.x + b.width, GRID);
        const y2 = snapToGrid(b.y + b.height, GRID);
        if (g.dir.includes('e')) b.width = x2 - b.x;
        if (g.dir.includes('s')) b.height = y2 - b.y;
      }
      setGuides(gl);
      live({ ...g.base, nodes: g.base.nodes.map((n) => (n.id === g.id ? { ...n, x: Math.round(b.x), y: Math.round(b.y), width: Math.round(b.width), height: Math.round(b.height) } : n)) });
      return;
    }
    if (g.kind === 'marquee' || g.kind === 'connect') {
      const [x, y] = toWorld(e.clientX, e.clientY);
      const ng = { ...g, x, y } as Gesture;
      if (ng.kind === 'marquee') {
        if (!ng.moved && Math.hypot((x - ng.sx) * k, (y - ng.sy) * k) > 3) ng.moved = true;
        if (ng.moved) {
          const area = { x: Math.min(ng.sx, x), y: Math.min(ng.sy, y), width: Math.abs(x - ng.sx), height: Math.abs(y - ng.sy) };
          // grupos só entram inteiros; cartões entram ao encostar
          const hit = gridRef.current.query(area).filter((n) => (n.type === 'group' ? contains(area, n) : intersects(area, n)));
          setSel(new Set([...ng.add, ...hit.map((n) => n.id)]));
        }
      }
      gRef.current = ng;
      setGesture(ng);
    }
  }

  function onUp(e: PointerEvent) {
    const g = gRef.current;
    endGesture();
    if (!g) return;
    if (g.kind === 'move') {
      if (g.moved) commit(dataRef.current, g.base);
      return;
    }
    if (g.kind === 'resize') {
      if (dataRef.current !== g.base) commit(dataRef.current, g.base);
      return;
    }
    if (g.kind === 'marquee') {
      if (!g.moved && !g.add.size) {
        setSel(new Set());
        setSelEdge(null);
      }
      return;
    }
    if (g.kind === 'connect') {
      const el = document.elementFromPoint(e.clientX, e.clientY)?.closest('[data-cnode]') as HTMLElement | null;
      const to = el?.dataset.cnode;
      const a = dataRef.current.nodes.find((n) => n.id === g.from);
      const b = to ? dataRef.current.nodes.find((n) => n.id === to) : null;
      if (a && b && a.id !== b.id && b.type !== 'group') {
        const toSide = SIDES.map((s) => ({ s, dist: Math.hypot(sidePoint(b, s)[0] - g.x, sidePoint(b, s)[1] - g.y) })).sort((p, q) => p.dist - q.dist)[0].s;
        const edge: CanvasEdge = { id: cuid(), fromNode: a.id, toNode: b.id, fromSide: g.side, toSide };
        commit({ ...dataRef.current, edges: [...dataRef.current.edges, edge] }, undefined, 200);
        setSelEdge(edge.id);
        setSel(new Set());
      } else if (a && !b && Math.hypot(...(sidePoint(a, g.side).map((v, i) => v - [g.x, g.y][i]) as [number, number])) > 30) {
        // soltou no vazio: cria um cartão ligado
        const n: CanvasNode = { id: cuid(), type: 'text', x: Math.round(g.x - 130), y: Math.round(g.y - 50), width: 260, height: 120, text: '' };
        const [, ts] = autoSides(a, n);
        commit({ nodes: [...dataRef.current.nodes, n], edges: [...dataRef.current.edges, { id: cuid(), fromNode: a.id, toNode: n.id, fromSide: g.side, toSide: ts }] }, undefined, 200);
        setSel(new Set([n.id]));
        setEditing(n.id);
      }
    }
  }

  const startPan = (e: React.PointerEvent | PointerEvent) => begin({ kind: 'pan', sx: e.clientX, sy: e.clientY, vx: viewRef.current.x, vy: viewRef.current.y });

  /** Dois dedos: troca qualquer gesto pela pinça. */
  const maybePinch = (e: React.PointerEvent) => {
    if (e.pointerType !== 'touch') return false;
    touches.current.set(e.pointerId, [e.clientX, e.clientY]);
    if (touches.current.size !== 2) return false;
    const g = gRef.current;
    if (g?.kind === 'move' || g?.kind === 'resize') live(g.base);
    const pts = Array.from(touches.current.values());
    const r = boxRef.current!.getBoundingClientRect();
    const v = viewRef.current;
    const mx = (pts[0][0] + pts[1][0]) / 2 - r.left;
    const my = (pts[0][1] + pts[1][1]) / 2 - r.top;
    const ng: Gesture = { kind: 'pinch', d0: Math.max(10, Math.hypot(pts[0][0] - pts[1][0], pts[0][1] - pts[1][1])), k0: v.k, wx: (mx - v.x) / v.k, wy: (my - v.y) / v.k };
    if (g) {
      gRef.current = ng;
      setGesture(ng);
    } else begin(ng);
    setGuides([]);
    return true;
  };

  const blurEditing = () => {
    if (editing) (document.activeElement as HTMLElement | null)?.blur?.();
  };

  // ------------------------------------------------------------ cartões (ações estáveis)
  const ctxRef = useRef<NodeCtx>(null as unknown as NodeCtx);
  ctxRef.current = {
    down: (e, n) => {
      if (maybePinch(e)) return;
      if (e.button === 1 || (e.button === 0 && spaceRef.current)) {
        e.preventDefault();
        e.stopPropagation();
        return startPan(e);
      }
      if (e.button !== 0) return;
      e.stopPropagation();
      if (editing && editing !== n.id) blurEditing();
      let ids = selRef.current;
      if (e.shiftKey || e.metaKey || e.ctrlKey) {
        ids = new Set(ids);
        if (ids.has(n.id)) ids.delete(n.id);
        else ids.add(n.id);
        setSel(ids);
        return;
      }
      if (!ids.has(n.id)) {
        ids = new Set([n.id]);
        setSel(ids);
      }
      setSelEdge(null);
      const base = dataRef.current;
      // mover um grupo leva junto o que está dentro dele; travados ficam
      const moving = new Set(Array.from(ids).filter((id) => !nodesById.get(id)?.locked));
      base.nodes.filter((g) => g.type === 'group' && moving.has(g.id)).forEach((g) => groupChildren(base.nodes, g).forEach((c) => !c.locked && moving.add(c.id)));
      if (!moving.size) return;
      const bb0 = bboxOf(base.nodes.filter((x) => moving.has(x.id)))!;
      begin({ kind: 'move', sx: e.clientX, sy: e.clientY, base, ids: moving, bb0, others: neighbours(moving), moved: false });
    },
    dbl: (e, n) => {
      e.stopPropagation();
      if (n.type === 'text' || n.type === 'group') setEditing(n.id);
      else if (n.type === 'note' && n.itemId) onOpen(n.itemId);
      else if ((n.type === 'link' || n.type === 'image' || n.type === 'file') && n.url && !n.pending) window.open(n.url, '_blank', 'noopener,noreferrer');
      else if (n.type === 'entry' && n.entryId && entries[n.entryId]) onOpenEntry?.(entries[n.entryId]);
    },
    menu: (e, n) => nodeMenu(e, n),
    resize: (e, n, dir) => {
      if (e.button !== 0) return;
      const base = dataRef.current;
      begin({ kind: 'resize', id: n.id, dir, sx: e.clientX, sy: e.clientY, base, start: { x: n.x, y: n.y, width: n.width, height: n.height }, others: neighbours(new Set([n.id])), ratio: n.width / n.height });
    },
    connect: (e, n, side) => {
      const [x, y] = toWorld(e.clientX, e.clientY);
      begin({ kind: 'connect', from: n.id, side, x, y });
    },
    finishText: (n, text) => {
      setEditing(null);
      const cur = dataRef.current.nodes.find((x) => x.id === n.id);
      if (cur && (cur.text || '') !== text) mapNodes(new Set([n.id]), (x) => ({ ...x, text }));
    },
    finishLabel: (n, label) => {
      setEditing(null);
      const cur = dataRef.current.nodes.find((x) => x.id === n.id);
      if (cur && (cur.label || '') !== label) mapNodes(new Set([n.id]), (x) => ({ ...x, label }));
    },
    openNote: (id) => onOpen(id),
    openEntry: (id) => entries[id] && onOpenEntry?.(entries[id]),
    linkClick: (e) => {
      const a = (e.target as HTMLElement).closest('[data-wikilink]') as HTMLElement | null;
      if (!a) return;
      e.preventDefault();
      const t = (a.dataset.wikilink || '').split('#')[0].trim().toLowerCase();
      const it = Object.values(api.items).find((i) => !i.archived_at && i.title.toLowerCase() === t);
      if (it) onOpen(it.id);
    },
    titleExists: (t) => Object.values(api.items).some((i) => !i.archived_at && i.title.toLowerCase() === t.toLowerCase()),
  };
  const ctx = useMemo<NodeCtx>(
    () => ({
      down: (e, n) => ctxRef.current.down(e, n),
      dbl: (e, n) => ctxRef.current.dbl(e, n),
      menu: (e, n) => ctxRef.current.menu(e, n),
      resize: (e, n, d) => ctxRef.current.resize(e, n, d),
      connect: (e, n, s) => ctxRef.current.connect(e, n, s),
      finishText: (n, t) => ctxRef.current.finishText(n, t),
      finishLabel: (n, t) => ctxRef.current.finishLabel(n, t),
      openNote: (id) => ctxRef.current.openNote(id),
      openEntry: (id) => ctxRef.current.openEntry(id),
      linkClick: (e) => ctxRef.current.linkClick(e),
      titleExists: (t) => ctxRef.current.titleExists(t),
    }),
    []
  );

  // ------------------------------------------------------------ teclado, copiar, colar
  useEffect(() => {
    const alive = () => !!boxRef.current?.isConnected && !document.querySelector('.nb-modal-back');
    const onKey = (e: KeyboardEvent) => {
      handleKey(e);
      // o que o canvas tratou não chega aos atalhos do app (Ctrl+G, Ctrl+Shift+L…)
      if (e.defaultPrevented && alive()) e.stopPropagation();
    };
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === ' ' && !isField(e.target) && alive()) {
        if (!spaceRef.current) (spaceRef.current = true), setSpace(true);
        e.preventDefault();
        return;
      }
      if (isField(e.target) || !alive()) return;
      const mod = e.ctrlKey || e.metaKey;
      const key = e.key.toLowerCase();
      const s = selRef.current;
      if (mod && key === 'z') {
        e.preventDefault();
        if (e.shiftKey) doc.redo();
        else doc.undo();
        setSel(new Set([...s].filter((id) => dataRef.current.nodes.some((n) => n.id === id))));
      } else if (mod && key === 'y') {
        e.preventDefault();
        doc.redo();
      } else if ((e.key === 'Delete' || e.key === 'Backspace') && (s.size || selEdge)) {
        e.preventDefault();
        removeNodes(s, selEdge);
      } else if (e.key === 'Escape') {
        setSel(new Set());
        setSelEdge(null);
      } else if (mod && key === 'a') {
        e.preventDefault();
        setSel(new Set(dataRef.current.nodes.map((n) => n.id)));
      } else if (mod && key === 'd' && s.size) {
        e.preventDefault();
        duplicate(s);
      } else if (mod && key === 'g') {
        e.preventDefault();
        if (e.shiftKey) ungroup(s);
        else if (s.size) addGroup(0, 0, s);
      } else if (mod && e.shiftKey && key === 'l' && s.size) {
        e.preventDefault();
        toggleLock(s);
      } else if (e.shiftKey && e.code === 'Digit1') {
        e.preventDefault();
        fit();
      } else if (e.shiftKey && e.code === 'Digit2' && s.size) {
        e.preventDefault();
        zoomSel();
      } else if (e.shiftKey && e.code === 'Digit0') {
        e.preventDefault();
        zoomAt(1 / viewRef.current.k);
      } else if (e.key === '?') {
        e.preventDefault();
        setHelp(true);
      } else if ((e.code === 'BracketRight' || e.code === 'BracketLeft') && s.size && !mod) {
        e.preventDefault();
        const up = e.code === 'BracketRight';
        doOrder(e.shiftKey ? (up ? 'front' : 'back') : up ? 'forward' : 'backward');
      } else if (e.key.startsWith('Arrow') && s.size) {
        e.preventDefault();
        const step = e.shiftKey ? 10 : 1;
        const dx = e.key === 'ArrowLeft' ? -step : e.key === 'ArrowRight' ? step : 0;
        const dy = e.key === 'ArrowUp' ? -step : e.key === 'ArrowDown' ? step : 0;
        // toques seguidos viram um passo só no histórico
        const now = Date.now();
        const merge = !!nudge.current && now - nudge.current.t < 800;
        nudge.current = { t: now, base: dataRef.current };
        commit({ ...dataRef.current, nodes: dataRef.current.nodes.map((n) => (s.has(n.id) && !n.locked ? { ...n, x: n.x + dx, y: n.y + dy } : n)) }, undefined, 500, merge);
      } else if (e.key === 'Enter' && s.size === 1) {
        const n = dataRef.current.nodes.find((x) => s.has(x.id));
        if (n?.type === 'text' || n?.type === 'group') {
          e.preventDefault();
          setEditing(n.id);
        }
      }
    };
    const onKeyUp = (e: KeyboardEvent) => {
      if (e.key === ' ') (spaceRef.current = false), setSpace(false);
    };
    const onBlur = () => ((spaceRef.current = false), setSpace(false));
    const onCopy = (e: ClipboardEvent) => {
      if (isField(e.target) || !alive() || !selRef.current.size) return;
      if (window.getSelection()?.toString()) return;
      e.preventDefault();
      e.clipboardData?.setData('text/plain', clipText(selRef.current));
      if (e.type === 'cut') removeNodes(selRef.current);
    };
    const onPaste = (e: ClipboardEvent) => {
      if (isField(e.target) || !alive()) return;
      const at = dropPoint();
      const all = Array.from(e.clipboardData?.files || []);
      const files = all.filter((f) => f.type.startsWith('image/'));
      if (all.length > files.length) {
        e.preventDefault();
        void addFiles(all, at[0], at[1]);
        return;
      }
      if (files.length) {
        e.preventDefault();
        void addImages(
          files.map((f) => (f.name && f.name !== 'image.png' ? f : new File([f], `Imagem colada ${stamp()}.${f.type.split('/')[1] || 'png'}`, { type: f.type }))),
          at[0],
          at[1]
        );
        return;
      }
      const text = e.clipboardData?.getData('text/plain');
      if (!text?.trim()) return;
      e.preventDefault();
      pasteText(text, at);
    };
    window.addEventListener('keydown', onKey, true);
    window.addEventListener('keyup', onKeyUp);
    window.addEventListener('blur', onBlur);
    window.addEventListener('copy', onCopy);
    window.addEventListener('cut', onCopy);
    window.addEventListener('paste', onPaste);
    return () => {
      window.removeEventListener('keydown', onKey, true);
      window.removeEventListener('keyup', onKeyUp);
      window.removeEventListener('blur', onBlur);
      window.removeEventListener('copy', onCopy);
      window.removeEventListener('cut', onCopy);
      window.removeEventListener('paste', onPaste);
    };
  });

  // ------------------------------------------------------------ comandos da paleta (Ctrl+P)
  const cmdRef = useRef<(cmd: string) => void>(() => {});
  cmdRef.current = (cmd: string) => {
    const [x, y] = center();
    if (cmd === 'text') addNodes([{ id: cuid(), type: 'text', x: Math.round(x - 130), y: Math.round(y - 60), width: 260, height: 120, text: '' }], true);
    else if (cmd === 'note') setPicker({ x, y });
    else if (cmd === 'file') ((filePoint.current = [x, y]), fileRef.current?.click());
    else if (cmd === 'entry') setEntryPicker({ x, y });
    else if (cmd === 'templates') setTemplates(true);
    else if (cmd.startsWith('template:')) addTemplate(cmd.slice(9));
    else if (cmd.startsWith('plugin:')) setPlugins(cmd.slice(7));
    else if (cmd === 'fit') fit();
    else if (cmd === 'zoomSel') zoomSel();
    else if (cmd === 'selectAll') setSel(new Set(dataRef.current.nodes.map((n) => n.id)));
    else if (cmd === 'snap') setPrefs({ ...prefsRef.current, snap: !prefsRef.current.snap });
    else if (cmd === 'grid') setPrefs({ ...prefsRef.current, grid: !prefsRef.current.grid });
    else if (cmd === 'help') setHelp(true);
    else if (cmd === 'download') download();
    else if (cmd === 'group') addGroup(x, y, selRef.current);
    else if (cmd === 'arrange' && selRef.current.size > 1) doGrid();
  };
  useEffect(() => {
    const h = (e: Event) => {
      const d = (e as CustomEvent<{ id: string; cmd: string }>).detail;
      if (d?.id === item.id && boxRef.current?.isConnected) cmdRef.current(d.cmd);
    };
    window.addEventListener(CANVAS_CMD_EVENT, h);
    return () => window.removeEventListener(CANVAS_CMD_EVENT, h);
  }, [item.id]);

  // ------------------------------------------------------------ menus por alvo
  function nodeMenu(e: React.MouseEvent, n: CanvasNode) {
    e.stopPropagation();
    let ids = selRef.current;
    if (!ids.has(n.id)) {
      ids = new Set([n.id]);
      setSel(ids);
    }
    setSelEdge(null);
    const multi = ids.size > 1;
    const chosen = dataRef.current.nodes.filter((x) => ids.has(x.id));
    const allLocked = chosen.every((x) => x.locked);
    const hasGroup = chosen.some((x) => x.type === 'group');
    const colorMenu: MenuEntry = {
      label: 'Cor',
      submenu: [
        { label: 'Sem cor', run: () => setColor(ids, null) },
        ...CANVAS_COLORS.map((c) => ({ label: c.label, icon: <span className="w-2.5 h-2.5 rounded-full" style={{ background: c.css }} />, run: () => setColor(ids, c.id) })),
      ],
    };
    const orderMenu: MenuEntry = {
      label: 'Camada',
      submenu: [
        { label: 'Para a frente de tudo', shortcut: 'Shift+]', icon: <BringToFront className="w-3.5 h-3.5" />, run: () => doOrder('front', ids) },
        { label: 'Avançar uma', shortcut: ']', run: () => doOrder('forward', ids) },
        { label: 'Recuar uma', shortcut: '[', run: () => doOrder('backward', ids) },
        { label: 'Para trás de tudo', shortcut: 'Shift+[', icon: <SendToBack className="w-3.5 h-3.5" />, run: () => doOrder('back', ids) },
      ],
    };
    const common: MenuEntry[] = [
      { label: 'Recortar', shortcut: 'Ctrl+X', icon: <Scissors className="w-3.5 h-3.5" />, run: () => void copySel(true) },
      { label: 'Copiar', shortcut: 'Ctrl+C', icon: <Copy className="w-3.5 h-3.5" />, run: () => void copySel() },
      { label: 'Duplicar', shortcut: 'Ctrl+D', run: () => duplicate(ids) },
      'sep',
      { label: allLocked ? 'Destravar' : 'Travar posição', shortcut: 'Ctrl+Shift+L', icon: allLocked ? <LockOpen className="w-3.5 h-3.5" /> : <Lock className="w-3.5 h-3.5" />, run: () => toggleLock(ids) },
      'sep',
      { label: multi ? `Apagar ${ids.size} itens` : 'Apagar', icon: <Trash2 className="w-3.5 h-3.5" />, shortcut: 'Del', danger: true, disabled: allLocked, run: () => removeNodes(ids) },
    ];
    if (multi) {
      menu.open(
        e,
        [
          { label: 'Ampliar na seleção', shortcut: 'Shift+2', icon: <Focus className="w-3.5 h-3.5" />, run: zoomSel },
          { label: 'Criar grupo', shortcut: 'Ctrl+G', icon: <Group className="w-3.5 h-3.5" />, run: () => addGroup(0, 0, ids) },
          ...(hasGroup ? [{ label: 'Desfazer grupos', shortcut: 'Ctrl+Shift+G', icon: <Ungroup className="w-3.5 h-3.5" />, run: () => ungroup(ids) }] : []),
          {
            label: 'Alinhar',
            submenu: [
              { label: 'À esquerda', run: () => doAlign('left') },
              { label: 'Ao centro', run: () => doAlign('hcenter') },
              { label: 'À direita', run: () => doAlign('right') },
              'sep',
              { label: 'Em cima', run: () => doAlign('top') },
              { label: 'Ao meio', run: () => doAlign('vcenter') },
              { label: 'Embaixo', run: () => doAlign('bottom') },
            ],
          },
          {
            label: 'Distribuir',
            submenu: [
              { label: 'Espaços iguais na horizontal', disabled: ids.size < 3, run: () => doDistribute('x') },
              { label: 'Espaços iguais na vertical', disabled: ids.size < 3, run: () => doDistribute('y') },
              { label: 'Organizar em grade', icon: <LayoutGrid className="w-3.5 h-3.5" />, run: doGrid },
            ],
          },
          colorMenu,
          orderMenu,
          'sep',
          ...common,
        ],
        `${ids.size} itens`
      );
      return;
    }
    const specific: MenuEntry[] = [];
    if (n.type === 'text') specific.push({ label: 'Editar', shortcut: 'Enter', run: () => setEditing(n.id) });
    if (n.type === 'note' && n.itemId) specific.push({ label: 'Abrir a nota', icon: <FileText className="w-3.5 h-3.5" />, run: () => onOpen(n.itemId!) });
    if (n.type === 'link' && n.url) specific.push({ label: 'Abrir o endereço', icon: <ExternalLink className="w-3.5 h-3.5" />, run: () => window.open(n.url, '_blank', 'noopener,noreferrer') });
    if (n.type === 'group')
      specific.push(
        { label: 'Renomear grupo', run: () => setEditing(n.id) },
        { label: 'Selecionar o conteúdo', run: () => setSel(new Set(groupChildren(dataRef.current.nodes, n).map((c) => c.id))) },
        { label: 'Desfazer o grupo', shortcut: 'Ctrl+Shift+G', icon: <Ungroup className="w-3.5 h-3.5" />, run: () => ungroup(new Set([n.id])) }
      );
    if (n.type === 'image' && n.url && !n.pending)
      specific.push(
        { label: 'Abrir o original', icon: <ExternalLink className="w-3.5 h-3.5" />, run: () => window.open(n.url, '_blank', 'noopener,noreferrer') },
        { label: 'Copiar o endereço', run: () => void navigator.clipboard?.writeText(n.url!) },
        ...(n.natW && n.natH
          ? [
              {
                label: `Tamanho original (${n.natW} × ${n.natH})`,
                run: () => {
                  const s = Math.min(1, 2400 / Math.max(n.natW!, n.natH!));
                  mapNodes(new Set([n.id]), (x) => ({ ...x, width: Math.round(n.natW! * s), height: Math.round(n.natH! * s) }));
                },
              },
              { label: 'Corrigir a proporção', run: () => mapNodes(new Set([n.id]), (x) => ({ ...x, height: Math.round((x.width * n.natH!) / n.natW!) })) },
            ]
          : [])
      );
    if (n.type === 'file' && n.url && !n.pending)
      specific.push(
        { label: 'Abrir o original', icon: <ExternalLink className="w-3.5 h-3.5" />, run: () => window.open(n.url, '_blank', 'noopener,noreferrer') },
        { label: 'Copiar o endereço', run: () => void navigator.clipboard?.writeText(n.url!) }
      );
    if (n.type === 'entry' && n.entryId && entries[n.entryId]) specific.push({ label: 'Abrir o verbete', icon: <BookMarked className="w-3.5 h-3.5" />, run: () => onOpenEntry?.(entries[n.entryId!]) });
    if (n.type === 'link' && n.url) specific.push({ label: n.meta ? 'Atualizar a prévia' : 'Buscar a prévia', run: () => {
      clipPage(n.url!).then((m) => mapNodes(new Set([n.id]), (x) => ({ ...x, meta: { title: m.title, description: m.description, image: m.image, site: m.site }, height: Math.max(x.height, m.image ? 300 : 150) }))).catch((err) => alert(err instanceof Error ? err.message : 'Falhou.'));
    } });
    const info = n.type === 'image' ? [n.mime?.replace('image/', '').toUpperCase(), formatSize(n.bytes), n.natW && `${n.natW} × ${n.natH}`].filter(Boolean).join(' · ') : '';
    menu.open(
      e,
      [
        ...specific,
        ...(specific.length ? ['sep' as const] : []),
        { label: 'Ampliar na seleção', shortcut: 'Shift+2', icon: <Focus className="w-3.5 h-3.5" />, run: zoomSel },
        ...(n.type !== 'group' ? [{ label: 'Criar grupo', shortcut: 'Ctrl+G', icon: <Group className="w-3.5 h-3.5" />, run: () => addGroup(0, 0, ids) }] : []),
        colorMenu,
        orderMenu,
        'sep',
        ...common,
      ],
      n.type === 'group' ? n.label || 'Grupo' : n.type === 'image' ? info || n.label : undefined
    );
  }

  const emptyMenu = (e: React.MouseEvent) => {
    if ((e.target as HTMLElement).closest('[data-cnode],[data-cedge],[data-cv-ui]')) return;
    const [x, y] = toWorld(e.clientX, e.clientY);
    menu.open(
      e,
      [
        { label: 'Cartão de texto aqui', icon: <StickyNote className="w-3.5 h-3.5" />, run: () => addNodes([{ id: cuid(), type: 'text', x: Math.round(x - 130), y: Math.round(y - 60), width: 260, height: 120, text: '' }], true) },
        { label: 'Nota do Notebook…', icon: <FileText className="w-3.5 h-3.5" />, run: () => setPicker({ x, y }) },
        { label: 'Imagem, PDF, áudio ou vídeo…', icon: <Paperclip className="w-3.5 h-3.5" />, run: () => ((filePoint.current = [x, y]), fileRef.current?.click()) },
        ...(entriesApi && Object.keys(entries).length ? [{ label: 'Verbete do Codex…', icon: <BookMarked className="w-3.5 h-3.5" />, run: () => setEntryPicker({ x, y }) }] : []),
        { label: 'Modelo…', icon: <LayoutTemplate className="w-3.5 h-3.5" />, run: () => setTemplates(true) },
        { label: 'Fontes externas…', icon: <Globe className="w-3.5 h-3.5" />, run: () => setPlugins('wikimedia') },
        { label: 'Grupo aqui', icon: <Group className="w-3.5 h-3.5" />, run: () => addGroup(x, y, new Set()) },
        'sep',
        { label: 'Colar aqui', shortcut: 'Ctrl+V', icon: <ClipboardPaste className="w-3.5 h-3.5" />, run: () => void pasteFromMenu([x, y]) },
        { label: 'Selecionar tudo', shortcut: 'Ctrl+A', run: () => setSel(new Set(dataRef.current.nodes.map((n) => n.id))) },
        { label: 'Enquadrar tudo', shortcut: 'Shift+1', icon: <Maximize className="w-3.5 h-3.5" />, run: fit },
        'sep',
        { label: 'Desfazer', shortcut: 'Ctrl+Z', disabled: !doc.canUndo, run: () => doc.undo() },
        { label: 'Refazer', shortcut: 'Ctrl+Shift+Z', disabled: !doc.canRedo, run: () => doc.redo() },
      ],
      'Canvas'
    );
  };

  const edgeMenu = (ev: React.MouseEvent, e: CanvasEdge) => {
    ev.stopPropagation();
    setSelEdge(e.id);
    setSel(new Set());
    const patch = (p: Partial<CanvasEdge>) => commit({ ...dataRef.current, edges: dataRef.current.edges.map((x) => (x.id === e.id ? { ...x, ...p } : x)) });
    menu.open(
      ev,
      [
        { label: e.label ? 'Editar rótulo' : 'Dar um rótulo', run: () => setEdgeLabel(e.id) },
        {
          label: 'Cor',
          submenu: [
            { label: 'Sem cor', run: () => patch({ color: null }) },
            ...CANVAS_COLORS.map((c) => ({ label: c.label, icon: <span className="w-2.5 h-2.5 rounded-full" style={{ background: c.css }} />, run: () => patch({ color: c.id }) })),
          ],
        },
        { label: 'Inverter o sentido', run: () => patch({ fromNode: e.toNode, toNode: e.fromNode, fromSide: e.toSide, toSide: e.fromSide }) },
        { label: 'Ampliar na ligação', icon: <Focus className="w-3.5 h-3.5" />, run: () => zoomTo(bboxOf(dataRef.current.nodes.filter((n) => n.id === e.fromNode || n.id === e.toNode)), 1.5) },
        'sep',
        { label: 'Apagar ligação', danger: true, icon: <Trash2 className="w-3.5 h-3.5" />, run: () => removeNodes(new Set(), e.id) },
      ],
      'Ligação'
    );
  };

  // ------------------------------------------------------------ desenho
  const v = view;
  const viewport: Box = { x: -v.x / v.k, y: -v.y / v.k, width: (size.w || 1600) / v.k, height: (size.h || 1000) / v.k };
  const margin = 300 / v.k;
  const area = { x: viewport.x - margin, y: viewport.y - margin, width: viewport.width + margin * 2, height: viewport.height + margin * 2 };
  const visibleIds = new Set(grid.query(area).map((n) => n.id));
  sel.forEach((id) => visibleIds.add(id));
  if (editing) visibleIds.add(editing);
  const shown = data.nodes.filter((n) => visibleIds.has(n.id));
  const groups = shown.filter((n) => n.type === 'group');
  const cards = shown.filter((n) => n.type !== 'group');
  const parent = path[path.length - 1];
  const single = sel.size === 1 ? nodesById.get(Array.from(sel)[0]) || null : null;
  const selNodes = sel.size ? data.nodes.filter((n) => sel.has(n.id)) : [];
  const selBox = bboxOf(selNodes);
  const busy = gesture && gesture.kind !== 'pan' && gesture.kind !== 'pinch';
  const marquee = gesture?.kind === 'marquee' && gesture.moved ? gesture : null;
  const connect = gesture?.kind === 'connect' ? gesture : null;

  // barra da seleção: centrada acima da caixa (ou abaixo, sem espaço em cima)
  let bar: { x: number; y: number; below: boolean } | null = null;
  if (selBox && !busy && !editing) {
    const sx = selBox.x * v.k + v.x + (selBox.width * v.k) / 2;
    const top = selBox.y * v.k + v.y;
    const bottomY = (selBox.y + selBox.height) * v.k + v.y;
    const x = Math.min(Math.max(sx, 150), (size.w || 800) - 150);
    const lift = single?.type === 'image' || single?.type === 'group' ? 40 : 14;
    // acima da seleção; sem espaço, abaixo; sem espaço nenhum, no alto da tela
    if (top - lift > 100) bar = { x, y: top - lift, below: false };
    else if (bottomY + 70 < (size.h || 600) - 80) bar = { x, y: bottomY + 14, below: true };
    else bar = { x, y: 60, below: true };
  }

  function download() {
    const blob = new Blob([JSON.stringify(toJsonCanvas(dataRef.current, (id) => api.items[id]?.title || null), null, 2)], { type: 'application/json' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `${item.title || 'canvas'}.canvas`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 2000);
  }

  const status = doc.status === 'error' ? 'Não salvou — tentando de novo' : uploads ? `Enviando ${uploads} ${uploads === 1 ? 'arquivo' : 'arquivos'}…` : doc.status === 'saving' ? 'Salvando…' : doc.status === 'loading' ? 'Abrindo…' : 'Salvo';

  return (
    <div className="absolute inset-0 nb-cv">
      {/* barra do título */}
      <div className="nb-cv-title" data-cv-ui>
        <Glyph name="canvas" className="text-[14px] text-[var(--nb-ink-3)] shrink-0" />
        {parent && (
          <>
            <button type="button" onClick={() => onOpen(parent.id)} className="text-[12px] text-[var(--nb-ink-3)] hover:text-[var(--nb-ink)] truncate max-w-[140px]">
              {parent.title}
            </button>
            <ChevronRight className="w-3 h-3 text-[var(--nb-ink-3)] shrink-0" />
          </>
        )}
        <input
          value={title}
          onChange={(e) => setTitle(e.target.value.slice(0, 200))}
          onBlur={() => title.trim() && title !== item.title && onRename(title.trim())}
          onKeyDown={(e) => e.key === 'Enter' && (e.target as HTMLInputElement).blur()}
          aria-label="Título do canvas"
          className="min-w-0 w-48 bg-transparent outline-none text-[14px] font-semibold text-[var(--nb-ink)]"
        />
        <span className="nb-cv-status" data-state={doc.status === 'error' ? 'error' : undefined} aria-live="polite">
          {status}
        </span>
      </div>

      <div
        ref={boxRef}
        className="nb-cv-board"
        data-panning={gesture?.kind === 'pan' || undefined}
        data-space={space || undefined}
        data-gesture={busy || undefined}
        style={{ backgroundSize: `${22 * v.k}px ${22 * v.k}px`, backgroundPosition: `${v.x}px ${v.y}px` }}
        onPointerMove={(e) => {
          if (e.pointerType === 'mouse') pointer.current = toWorld(e.clientX, e.clientY);
        }}
        onPointerLeave={() => (pointer.current = null)}
        onPointerDown={(e) => {
          if ((e.target as HTMLElement).closest('[data-cnode],[data-cedge],[data-cv-ui]')) return;
          if (maybePinch(e)) return;
          if (e.button !== 0 && e.button !== 1) return;
          blurEditing();
          if (e.button === 1 || spaceRef.current || e.pointerType === 'touch') {
            e.preventDefault();
            if (e.pointerType === 'touch' && !gRef.current) {
              setSel(new Set());
              setSelEdge(null);
            }
            return startPan(e);
          }
          e.preventDefault(); // sem seleção de texto durante a seleção em área
          const [x, y] = toWorld(e.clientX, e.clientY);
          setSelEdge(null);
          const add = e.shiftKey || e.metaKey || e.ctrlKey ? new Set(selRef.current) : new Set<string>();
          if (!add.size) setSel(new Set());
          begin({ kind: 'marquee', sx: x, sy: y, x, y, add, moved: false });
        }}
        onDoubleClick={(e) => {
          if ((e.target as HTMLElement).closest('[data-cnode],[data-cedge],[data-cv-ui]')) return;
          const [x, y] = toWorld(e.clientX, e.clientY);
          addNodes([{ id: cuid(), type: 'text', x: Math.round(x - 130), y: Math.round(y - 50), width: 260, height: 120, text: '' }], true);
        }}
        onContextMenu={emptyMenu}
        onDragOver={(e) => {
          const t = e.dataTransfer.types;
          if (t.includes('Files') || t.includes(ENTRY_DRAG) || t.includes(PLUGIN_DRAG) || t.includes('text/plain') || t.includes('text/uri-list')) {
            e.preventDefault();
            e.dataTransfer.dropEffect = 'copy';
          }
        }}
        onDrop={(e) => {
          const at = toWorld(e.clientX, e.clientY);
          const dt = e.dataTransfer;
          const files = Array.from(dt.files);
          e.preventDefault();
          if (files.length) return void addFiles(files, at[0], at[1]);
          const ent = dt.getData(ENTRY_DRAG);
          if (ent && entries[ent]) return addEntry(entries[ent], at);
          const plug = dt.getData(PLUGIN_DRAG);
          if (plug) {
            try {
              return void insertResult(JSON.parse(plug) as PluginResult, at);
            } catch {
              return;
            }
          }
          const text = (dt.getData('text/uri-list') || dt.getData('text/plain') || '').trim();
          // nota arrastada do explorador
          const it = api.items[text];
          if (it) {
            if (it.id === item.id || it.kind !== 'note') return;
            return addNodes([{ id: cuid(), type: 'note', x: Math.round(at[0] - 200), y: Math.round(at[1] - 150), width: 400, height: 300, itemId: it.id }]);
          }
          if (text) pasteText(text.split('\n')[0].startsWith('http') ? text.split('\n')[0] : text, at);
        }}
      >
        <div className="nb-cv-world" style={{ transform: `translate3d(${v.x}px, ${v.y}px, 0) scale(${v.k})`, ['--k' as string]: v.k }}>
          {groups.map((g) => (
            <CanvasNodeView key={g.id} n={g} selected={sel.has(g.id)} handles={single?.id === g.id && !busy} editing={editing === g.id} note={null} ctx={ctx} />
          ))}

          {/* ligações */}
          <svg className="nb-cv-edges" width="1" height="1">
            <defs>
              <marker id="nb-cv-arrow" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse">
                <path d="M0 0 L10 5 L0 10 z" fill="context-stroke" />
              </marker>
            </defs>
            {data.edges.map((e) => {
              const a = nodesById.get(e.fromNode);
              const b = nodesById.get(e.toNode);
              if (!a || !b) return null;
              if (!visibleIds.has(a.id) && !visibleIds.has(b.id) && !intersects(bboxOf([a, b])!, area)) return null;
              const [as, bs] = autoSides(a, b);
              const s1 = e.fromSide || as;
              const s2 = e.toSide || bs;
              const { d, mid } = edgePath(sidePoint(a, s1), s1, sidePoint(b, s2), s2);
              const on = selEdge === e.id;
              const color = canvasColor(e.color) || (on ? 'var(--cv-acc)' : 'rgba(255,255,255,0.38)');
              return (
                <g
                  key={e.id}
                  data-cedge={e.id}
                  onPointerDown={(ev) => {
                    if (ev.button !== 0) return;
                    ev.stopPropagation();
                    blurEditing();
                    setSelEdge(e.id);
                    setSel(new Set());
                  }}
                  onDoubleClick={(ev) => {
                    ev.stopPropagation();
                    setEdgeLabel(e.id);
                  }}
                  onContextMenu={(ev) => edgeMenu(ev, e)}
                  style={{ cursor: 'pointer' }}
                >
                  <path d={d} fill="none" stroke="transparent" strokeWidth={16 / v.k} />
                  <path d={d} fill="none" stroke={on && e.color ? 'var(--cv-acc)' : color} strokeWidth={on ? 2.5 : 1.75} markerEnd="url(#nb-cv-arrow)" />
                  {(e.label || edgeLabel === e.id) && (
                    <foreignObject x={mid[0] - 110} y={mid[1] - 14} width={220} height={28} style={{ overflow: 'visible' }}>
                      {edgeLabel === e.id ? (
                        <input
                          autoFocus
                          defaultValue={e.label || ''}
                          onPointerDown={(ev) => ev.stopPropagation()}
                          onBlur={(ev) => {
                            const label = ev.target.value.slice(0, 80);
                            setEdgeLabel(null);
                            if (label !== (e.label || '')) commit({ ...dataRef.current, edges: dataRef.current.edges.map((x) => (x.id === e.id ? { ...x, label } : x)) });
                          }}
                          onKeyDown={(ev) => (ev.key === 'Enter' || ev.key === 'Escape') && (ev.target as HTMLInputElement).blur()}
                          className="nb-cv-edge-label nb-cv-edge-input"
                          aria-label="Rótulo da ligação"
                        />
                      ) : (
                        <div className="nb-cv-edge-label">{e.label}</div>
                      )}
                    </foreignObject>
                  )}
                </g>
              );
            })}
            {connect &&
              (() => {
                const a = nodesById.get(connect.from);
                if (!a) return null;
                const p1 = sidePoint(a, connect.side);
                const opp: Record<CanvasSide, CanvasSide> = { left: 'right', right: 'left', top: 'bottom', bottom: 'top' };
                return <path d={edgePath(p1, connect.side, [connect.x, connect.y], opp[connect.side]).d} fill="none" stroke="var(--cv-acc)" strokeWidth={1.75} strokeDasharray="6 5" />;
              })()}
          </svg>

          {cards.map((n) => (
            <CanvasNodeView
              key={n.id}
              n={n}
              selected={sel.has(n.id)}
              handles={single?.id === n.id && !busy}
              editing={editing === n.id}
              note={n.type === 'note' && n.itemId ? api.items[n.itemId] || null : null}
              entry={n.type === 'entry' && n.entryId ? entries[n.entryId] || null : null}
              ctx={ctx}
            />
          ))}

          {/* caixa da seleção múltipla */}
          {selBox && sel.size > 1 && <div className="nb-cv-selbox" style={{ transform: `translate3d(${selBox.x - 6 / v.k}px, ${selBox.y - 6 / v.k}px, 0)`, width: selBox.width + 12 / v.k, height: selBox.height + 12 / v.k }} />}

          {/* guias magnéticas */}
          {guides.length > 0 && (
            <svg className="nb-cv-guides" width="1" height="1">
              {guides.map((g, i) =>
                g.kind === 'line' ? (
                  g.axis === 'x' ? (
                    <line key={i} x1={g.at} x2={g.at} y1={g.from - 20 / v.k} y2={g.to + 20 / v.k} strokeWidth={1 / v.k} />
                  ) : (
                    <line key={i} y1={g.at} y2={g.at} x1={g.from - 20 / v.k} x2={g.to + 20 / v.k} strokeWidth={1 / v.k} />
                  )
                ) : (
                  <g key={i}>
                    {g.segs.map(([a, b], j) =>
                      g.axis === 'x' ? (
                        <g key={j}>
                          <line x1={a} x2={b} y1={g.at} y2={g.at} strokeWidth={1 / v.k} />
                          <line x1={a} x2={a} y1={g.at - 5 / v.k} y2={g.at + 5 / v.k} strokeWidth={1 / v.k} />
                          <line x1={b} x2={b} y1={g.at - 5 / v.k} y2={g.at + 5 / v.k} strokeWidth={1 / v.k} />
                        </g>
                      ) : (
                        <g key={j}>
                          <line y1={a} y2={b} x1={g.at} x2={g.at} strokeWidth={1 / v.k} />
                          <line y1={a} y2={a} x1={g.at - 5 / v.k} x2={g.at + 5 / v.k} strokeWidth={1 / v.k} />
                          <line y1={b} y2={b} x1={g.at - 5 / v.k} x2={g.at + 5 / v.k} strokeWidth={1 / v.k} />
                        </g>
                      )
                    )}
                  </g>
                )
              )}
            </svg>
          )}

          {marquee && (
            <div
              className="nb-cv-marquee"
              style={{ transform: `translate3d(${Math.min(marquee.sx, marquee.x)}px, ${Math.min(marquee.sy, marquee.y)}px, 0)`, width: Math.abs(marquee.x - marquee.sx), height: Math.abs(marquee.y - marquee.sy) }}
            />
          )}
        </div>

        {bar && (
          <SelectionBar
            x={bar.x}
            y={bar.y}
            below={bar.below}
            count={sel.size}
            kind={single?.type || null}
            locked={selNodes.length > 0 && selNodes.every((n) => n.locked)}
            onDelete={() => removeNodes(sel)}
            onColor={(c) => setColor(sel, c)}
            onZoom={zoomSel}
            onEdit={single && (single.type === 'text' || single.type === 'group') ? () => setEditing(single.id) : undefined}
            onOpen={
              single?.type === 'note' && single.itemId
                ? () => onOpen(single.itemId!)
                : single?.type === 'entry' && single.entryId && entries[single.entryId]
                  ? () => onOpenEntry?.(entries[single.entryId!])
                  : (single?.type === 'image' || single?.type === 'link' || single?.type === 'file') && single.url && !single.pending
                  ? () => window.open(single.url, '_blank', 'noopener,noreferrer')
                  : undefined
            }
            onAlign={doAlign}
            onDistribute={doDistribute}
            onGrid={doGrid}
            onGroup={() => addGroup(0, 0, sel)}
            onLock={() => toggleLock(sel)}
          />
        )}

        {doc.loaded && !data.nodes.length && (
          <div className="nb-cv-hint" data-cv-ui>
            <p>Clique duas vezes para criar um cartão.</p>
            <p>Cole ou arraste imagens: elas sobem sem perda de qualidade.</p>
            <p>Arraste a borda de um cartão para ligar. Aperte ? para ver os atalhos.</p>
          </div>
        )}
      </div>

      {/* inserir (embaixo) */}
      <div className="nb-cv-dock" data-cv-ui>
        <button
          type="button"
          title="Cartão de texto"
          aria-label="Cartão de texto"
          onClick={() => {
            const [x, y] = center();
            addNodes([{ id: cuid(), type: 'text', x: Math.round(x - 130), y: Math.round(y - 60), width: 260, height: 120, text: '' }], true);
          }}
        >
          <StickyNote />
        </button>
        <button type="button" title="Nota do Notebook" aria-label="Nota do Notebook" onClick={() => setPicker({ x: center()[0], y: center()[1] })}>
          <FileText />
        </button>
        <button type="button" title="Imagem, PDF, áudio ou vídeo (sem perda de qualidade)" aria-label="Arquivo" onClick={() => ((filePoint.current = center()), fileRef.current?.click())}>
          <ImagePlus />
        </button>
        {entriesApi && (
          <button type="button" title="Verbete do Codex" aria-label="Verbete do Codex" onClick={() => setEntryPicker({ x: center()[0], y: center()[1] })}>
            <BookMarked />
          </button>
        )}
        <button type="button" title={sel.size ? 'Agrupar a seleção' : 'Grupo'} aria-label="Grupo" onClick={() => addGroup(...center())}>
          <Group />
        </button>
        <span className="nb-cv-dock-sep" />
        <button type="button" title="Modelos" aria-label="Modelos" data-on={templates || undefined} onClick={() => setTemplates((t) => !t)}>
          <LayoutTemplate />
        </button>
        <button type="button" title="Fontes externas (imagens livres, Wikipedia, páginas)" aria-label="Fontes externas" data-on={!!plugins || undefined} onClick={() => setPlugins((p) => (p ? null : 'wikimedia'))}>
          <Globe />
        </button>
        {templates && <TemplateMenu onPick={(id) => (setTemplates(false), addTemplate(id))} onClose={() => setTemplates(false)} />}
      </div>

      {plugins && <PluginPanel tab={plugins} setTab={setPlugins} onInsert={(r) => void insertResult(r)} onClose={() => setPlugins(null)} />}

      <RightRail
        zoom={v.k}
        canUndo={doc.canUndo}
        canRedo={doc.canRedo}
        prefs={prefs}
        setPrefs={setPrefs}
        onZoomIn={() => zoomAt(1.25)}
        onZoomOut={() => zoomAt(1 / 1.25)}
        onReset={() => zoomAt(1 / v.k)}
        onFit={fit}
        onUndo={() => doc.undo()}
        onRedo={() => doc.redo()}
        onHelp={() => setHelp(true)}
        onDownload={download}
      />

      <input
        ref={fileRef}
        type="file"
        accept="image/*,application/pdf,audio/*,video/mp4,video/webm,video/quicktime,.md,.markdown,.txt,text/plain,text/markdown"
        multiple
        hidden
        onChange={(e) => {
          const files = Array.from(e.target.files || []);
          e.target.value = '';
          const [x, y] = filePoint.current || center();
          if (files.length) void addFiles(files, x, y);
        }}
      />

      {picker && (
        <NotePicker
          items={Object.values(api.items).filter((i) => !i.archived_at && i.kind === 'note' && i.id !== item.id)}
          onClose={() => setPicker(null)}
          onPick={(it) => {
            const p = picker;
            setPicker(null);
            addNodes([{ id: cuid(), type: 'note', x: Math.round(p.x - 200), y: Math.round(p.y - 150), width: 400, height: 300, itemId: it.id }]);
          }}
        />
      )}
      {help && <HelpPanel onClose={() => setHelp(false)} />}
      {entryPicker && (
        <EntryPicker
          entries={Object.values(entries)}
          onClose={() => setEntryPicker(null)}
          onPick={(e) => {
            const p = entryPicker;
            setEntryPicker(null);
            addEntry(e, [p.x, p.y]);
          }}
        />
      )}
    </div>
  );
}

function stamp() {
  const d = new Date();
  const p = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}${p(d.getMonth() + 1)}${p(d.getDate())}${p(d.getHours())}${p(d.getMinutes())}${p(d.getSeconds())}`;
}
