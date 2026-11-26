'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ChevronRight, Download, FileText, Group, ImagePlus, Link2, Loader2, Maximize, Minus, Plus, StickyNote, Trash2, X } from 'lucide-react';
import type { NotebookItem } from '@/lib/notebook/types';
import type { NotebookApi } from '@/lib/notebook/useNotebook';
import { renderMarkdown } from '@/lib/notebook/markdown';
import { sanitizeUserHtml } from '@/lib/security/sanitizeHtml';
import { uploadMediaToInsight } from '@/lib/mediaCompressor';
import { getUserUploadLimitBytes } from '@/lib/contributorLevels';
import {
  CANVAS_COLORS,
  autoSides,
  canvasColor,
  canvasToContent,
  cuid,
  edgePath,
  normalizeCanvas,
  sidePoint,
  toJsonCanvas,
  type CanvasData,
  type CanvasEdge,
  type CanvasNode,
  type CanvasSide,
} from '@/lib/notebook/canvas';
import { sanitizeWriterHtml } from '../WriterMode';
import { itemIcon } from '../FileExplorer';
import { Glyph } from '../icons/Glyph';
import { useNotebookMenu, type MenuEntry } from '../menu/ContextMenu';
import { NbPortal } from '../history/VersionHistory';

type View = { x: number; y: number; k: number };
type Drag =
  | { kind: 'pan'; sx: number; sy: number; vx: number; vy: number; moved: boolean }
  | { kind: 'move'; sx: number; sy: number; start: Map<string, [number, number]>; moved: boolean }
  | { kind: 'resize'; id: string; sx: number; sy: number; w: number; h: number }
  | { kind: 'marquee'; sx: number; sy: number; x: number; y: number; add: Set<string> }
  | { kind: 'connect'; from: string; side: CanvasSide; x: number; y: number };

const SIDES: CanvasSide[] = ['top', 'right', 'bottom', 'left'];
const NOTE_TEXT = new Set(['markdown', 'journal', 'screenplay', 'study', 'idea', 'world', 'meeting', 'poem', 'article', 'character', 'codex']);

/** Canvas (como o do Obsidian): quadro infinito com cartões, notas, imagens, grupos e ligações. */
export function CanvasStudio({
  item,
  api,
  path,
  onOpen,
  onRename,
  role,
  level,
}: {
  item: NotebookItem;
  api: NotebookApi;
  path: NotebookItem[];
  onOpen: (id: string) => void;
  onRename: (t: string) => void;
  role?: string | null;
  level?: number | null;
}) {
  const menu = useNotebookMenu();
  const [data, setData] = useState<CanvasData>(() => normalizeCanvas((item.data as Record<string, unknown>)?.canvas));
  const dataRef = useRef(data);
  dataRef.current = data;
  const itemRef = useRef(item);
  itemRef.current = item;
  const [view, setView] = useState<View>({ x: 0, y: 0, k: 1 });
  const viewRef = useRef(view);
  viewRef.current = view;
  const [sel, setSel] = useState<Set<string>>(new Set());
  const [selEdge, setSelEdge] = useState<string | null>(null);
  const [editing, setEditing] = useState<string | null>(null);
  const [edgeLabel, setEdgeLabel] = useState<string | null>(null);
  const [drag, setDrag] = useState<Drag | null>(null);
  const dragRef = useRef<Drag | null>(null);
  const [picker, setPicker] = useState<{ x: number; y: number } | null>(null);
  const [uploading, setUploading] = useState(false);
  const [title, setTitle] = useState(item.title);
  const boxRef = useRef<HTMLDivElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const filePoint = useRef<[number, number] | null>(null);

  // ------------------------------------------------------------ salvar
  const save = useCallback(
    (next: CanvasData, debounce = 400) => {
      dataRef.current = next;
      setData(next);
      const titleOf = (id: string) => api.items[id]?.title || null;
      api.update(itemRef.current.id, { data: { ...(itemRef.current.data || {}), canvas: next }, content: canvasToContent(next, titleOf) }, { debounce });
    },
    [api]
  );
  const patchNode = (id: string, patch: Partial<CanvasNode>, d = 400) => save({ ...dataRef.current, nodes: dataRef.current.nodes.map((n) => (n.id === id ? { ...n, ...patch } : n)) }, d);
  const addNodes = (nodes: CanvasNode[], edit = false) => {
    save({ ...dataRef.current, nodes: [...dataRef.current.nodes, ...nodes] }, 0);
    setSel(new Set(nodes.map((n) => n.id)));
    setSelEdge(null);
    if (edit && nodes[0]) setEditing(nodes[0].id);
  };
  const removeNodes = (ids: Set<string>, edgeId: string | null = null) => {
    const d = dataRef.current;
    save({ nodes: d.nodes.filter((n) => !ids.has(n.id)), edges: d.edges.filter((e) => e.id !== edgeId && !ids.has(e.fromNode) && !ids.has(e.toNode)) }, 0);
    setSel(new Set());
    setSelEdge(null);
  };
  const removeSelection = () => removeNodes(sel, selEdge);
  const duplicate = (ids: Set<string>) => {
    const map = new Map<string, string>();
    const copies = dataRef.current.nodes.filter((n) => ids.has(n.id)).map((n) => {
      const id = cuid();
      map.set(n.id, id);
      return { ...n, id, x: n.x + 40, y: n.y + 40 };
    });
    const edges = dataRef.current.edges.filter((e) => map.has(e.fromNode) && map.has(e.toNode)).map((e) => ({ ...e, id: cuid(), fromNode: map.get(e.fromNode)!, toNode: map.get(e.toNode)! }));
    save({ nodes: [...dataRef.current.nodes, ...copies], edges: [...dataRef.current.edges, ...edges] }, 0);
    setSel(new Set(copies.map((c) => c.id)));
  };

  // ------------------------------------------------------------ coordenadas
  const toWorld = (cx: number, cy: number): [number, number] => {
    const r = boxRef.current!.getBoundingClientRect();
    const v = viewRef.current;
    return [(cx - r.left - v.x) / v.k, (cy - r.top - v.y) / v.k];
  };
  const center = (): [number, number] => {
    const r = boxRef.current?.getBoundingClientRect();
    return r ? toWorld(r.left + r.width / 2, r.top + r.height / 2) : [0, 0];
  };

  const fit = useCallback(() => {
    const box = boxRef.current?.getBoundingClientRect();
    const ns = dataRef.current.nodes;
    if (!box) return;
    if (!ns.length) return setView({ x: box.width / 2, y: box.height / 2, k: 1 });
    const minX = Math.min(...ns.map((n) => n.x));
    const minY = Math.min(...ns.map((n) => n.y));
    const maxX = Math.max(...ns.map((n) => n.x + n.width));
    const maxY = Math.max(...ns.map((n) => n.y + n.height));
    const k = Math.min(1.2, Math.max(0.1, Math.min((box.width - 120) / (maxX - minX || 1), (box.height - 160) / (maxY - minY || 1))));
    setView({ k, x: box.width / 2 - ((minX + maxX) / 2) * k, y: box.height / 2 - ((minY + maxY) / 2) * k + 10 });
  }, []);
  useEffect(() => {
    fit();
  }, [fit]);

  // roda do mouse: arrasta; Ctrl/pinça: zoom
  useEffect(() => {
    const el = boxRef.current;
    if (!el) return;
    const onWheel = (e: WheelEvent) => {
      if ((e.target as HTMLElement).closest('.nb-cv-scroll') && !e.ctrlKey && !e.metaKey) return;
      e.preventDefault();
      const r = el.getBoundingClientRect();
      if (e.ctrlKey || e.metaKey) {
        const mx = e.clientX - r.left;
        const my = e.clientY - r.top;
        setView((v) => {
          const k = Math.min(3, Math.max(0.08, v.k * Math.exp(-e.deltaY * 0.0022)));
          return { k, x: mx - ((mx - v.x) / v.k) * k, y: my - ((my - v.y) / v.k) * k };
        });
      } else setView((v) => ({ ...v, x: v.x - e.deltaX, y: v.y - e.deltaY }));
    };
    el.addEventListener('wheel', onWheel, { passive: false });
    return () => el.removeEventListener('wheel', onWheel);
  }, []);

  // ------------------------------------------------------------ arrastos (janela inteira)
  const startDrag = (d: Drag) => {
    dragRef.current = d;
    setDrag(d);
  };
  useEffect(() => {
    if (!drag) return;
    const move = (e: PointerEvent) => {
      const d = dragRef.current;
      if (!d) return;
      const k = viewRef.current.k;
      if (d.kind === 'pan') {
        if (Math.abs(e.clientX - d.sx) + Math.abs(e.clientY - d.sy) > 3) d.moved = true;
        setView((v) => ({ ...v, x: d.vx + e.clientX - d.sx, y: d.vy + e.clientY - d.sy }));
      } else if (d.kind === 'move') {
        const dx = (e.clientX - d.sx) / k;
        const dy = (e.clientY - d.sy) / k;
        if (Math.abs(dx) + Math.abs(dy) > 1) d.moved = true;
        const next = { ...dataRef.current, nodes: dataRef.current.nodes.map((n) => (d.start.has(n.id) ? { ...n, x: Math.round(d.start.get(n.id)![0] + dx), y: Math.round(d.start.get(n.id)![1] + dy) } : n)) };
        dataRef.current = next;
        setData(next);
      } else if (d.kind === 'resize') {
        const w = Math.max(120, Math.round(d.w + (e.clientX - d.sx) / k));
        const h = Math.max(60, Math.round(d.h + (e.clientY - d.sy) / k));
        const next = { ...dataRef.current, nodes: dataRef.current.nodes.map((n) => (n.id === d.id ? { ...n, width: w, height: h } : n)) };
        dataRef.current = next;
        setData(next);
      } else if (d.kind === 'marquee' || d.kind === 'connect') {
        const [x, y] = toWorld(e.clientX, e.clientY);
        const nd = { ...d, x, y };
        dragRef.current = nd;
        setDrag(nd);
      }
    };
    const up = (e: PointerEvent) => {
      const d = dragRef.current;
      dragRef.current = null;
      setDrag(null);
      if (!d) return;
      if (d.kind === 'pan' && !d.moved) {
        setSel(new Set());
        setSelEdge(null);
        setEditing(null);
      }
      if ((d.kind === 'move' && d.moved) || d.kind === 'resize') save(dataRef.current, 0);
      if (d.kind === 'marquee') {
        const [x1, x2] = [Math.min(d.sx, d.x), Math.max(d.sx, d.x)];
        const [y1, y2] = [Math.min(d.sy, d.y), Math.max(d.sy, d.y)];
        const inside = dataRef.current.nodes.filter((n) => n.x >= x1 && n.y >= y1 && n.x + n.width <= x2 && n.y + n.height <= y2).map((n) => n.id);
        setSel(new Set([...d.add, ...inside]));
      }
      if (d.kind === 'connect') {
        const el = document.elementFromPoint(e.clientX, e.clientY)?.closest('[data-cnode]') as HTMLElement | null;
        const to = el?.dataset.cnode;
        const a = dataRef.current.nodes.find((n) => n.id === d.from);
        const b = to ? dataRef.current.nodes.find((n) => n.id === to) : null;
        if (a && b && a.id !== b.id) {
          // lado de chegada: o mais perto de onde soltou
          const toSide = SIDES.map((s) => ({ s, dist: Math.hypot(sidePoint(b, s)[0] - d.x, sidePoint(b, s)[1] - d.y) })).sort((p, q) => p.dist - q.dist)[0].s;
          const edge: CanvasEdge = { id: cuid(), fromNode: a.id, toNode: b.id, fromSide: d.side, toSide };
          save({ ...dataRef.current, edges: [...dataRef.current.edges, edge] }, 0);
          setSelEdge(edge.id);
          setSel(new Set());
        } else if (a && !b) {
          // soltou no vazio: cria um cartão ligado
          const n: CanvasNode = { id: cuid(), type: 'text', x: Math.round(d.x - 130), y: Math.round(d.y - 30), width: 260, height: 120, text: '' };
          const [fs, ts] = autoSides(a, n);
          save({ nodes: [...dataRef.current.nodes, n], edges: [...dataRef.current.edges, { id: cuid(), fromNode: a.id, toNode: n.id, fromSide: d.side || fs, toSide: ts }] }, 0);
          setSel(new Set([n.id]));
          setEditing(n.id);
        }
      }
    };
    window.addEventListener('pointermove', move);
    window.addEventListener('pointerup', up);
    return () => {
      window.removeEventListener('pointermove', move);
      window.removeEventListener('pointerup', up);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [drag?.kind]);

  // ------------------------------------------------------------ teclado e colar
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.target as HTMLElement)?.closest?.('input,textarea,select,[contenteditable="true"]')) return;
      if (!boxRef.current?.isConnected) return;
      const mod = e.ctrlKey || e.metaKey;
      if ((e.key === 'Delete' || e.key === 'Backspace') && (sel.size || selEdge)) {
        e.preventDefault();
        removeSelection();
      } else if (e.key === 'Escape') {
        setSel(new Set());
        setSelEdge(null);
      } else if (mod && e.key.toLowerCase() === 'a') {
        e.preventDefault();
        setSel(new Set(dataRef.current.nodes.map((n) => n.id)));
      } else if (mod && e.key.toLowerCase() === 'd' && sel.size) {
        e.preventDefault();
        duplicate(sel);
      } else if (e.key === 'Enter' && sel.size === 1) {
        const n = dataRef.current.nodes.find((x) => sel.has(x.id));
        if (n?.type === 'text') {
          e.preventDefault();
          setEditing(n.id);
        }
      }
    };
    const onPaste = (e: ClipboardEvent) => {
      if ((e.target as HTMLElement)?.closest?.('input,textarea,[contenteditable="true"]')) return;
      if (!boxRef.current?.isConnected) return;
      const files = Array.from(e.clipboardData?.files || []).filter((f) => f.type.startsWith('image/'));
      const [cx, cy] = center();
      if (files.length) {
        e.preventDefault();
        void addImages(files, cx, cy);
        return;
      }
      const text = e.clipboardData?.getData('text/plain')?.trim();
      if (!text) return;
      e.preventDefault();
      if (/^https?:\/\/\S+$/.test(text)) addNodes([{ id: cuid(), type: 'link', x: cx - 160, y: cy - 40, width: 320, height: 90, url: text }]);
      else addNodes([{ id: cuid(), type: 'text', x: cx - 150, y: cy - 60, width: 300, height: Math.min(400, 80 + Math.ceil(text.length / 40) * 22), text: text.slice(0, 20000) }]);
    };
    window.addEventListener('keydown', onKey);
    window.addEventListener('paste', onPaste);
    return () => {
      window.removeEventListener('keydown', onKey);
      window.removeEventListener('paste', onPaste);
    };
  });

  // ------------------------------------------------------------ mídia
  async function addImages(files: File[], x: number, y: number) {
    setUploading(true);
    const made: CanvasNode[] = [];
    for (const [i, f] of files.slice(0, 12).entries()) {
      try {
        const res = await uploadMediaToInsight(f, { budgetBytes: getUserUploadLimitBytes(level ?? 0, role ?? undefined), asImage: true, scope: 'notebook' });
        await api.registerAsset(item.id, res.r2Key, res.publicUrl);
        const img = new Image();
        img.src = res.publicUrl;
        await img.decode().catch(() => {});
        const w = 360;
        const h = img.naturalWidth ? Math.round((w * img.naturalHeight) / img.naturalWidth) : 240;
        made.push({ id: cuid(), type: 'image', x: Math.round(x - w / 2 + i * 30), y: Math.round(y - h / 2 + i * 30), width: w, height: h, url: res.publicUrl, label: f.name || 'imagem' });
      } catch (err) {
        alert(err instanceof Error ? err.message : 'Falha no envio da imagem.');
      }
    }
    setUploading(false);
    if (made.length) addNodes(made);
  }

  // notas incorporadas: carrega o texto
  const noteIds = data.nodes.filter((n) => n.type === 'note' && n.itemId).map((n) => n.itemId!);
  const noteKey = noteIds.join(',');
  useEffect(() => {
    noteIds.forEach((id) => api.items[id] && !api.items[id]._full && void api.loadFull(id));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [noteKey]);

  // ------------------------------------------------------------ menus
  const nodeMenu = (e: React.MouseEvent, n: CanvasNode) => {
    e.stopPropagation();
    if (!sel.has(n.id)) setSel(new Set([n.id]));
    const ids = sel.has(n.id) ? sel : new Set([n.id]);
    const items: MenuEntry[] = [
      ...(n.type === 'text' ? [{ label: 'Editar', run: () => setEditing(n.id) }] : []),
      ...(n.type === 'note' && n.itemId ? [{ label: 'Abrir a nota', run: () => onOpen(n.itemId!) }] : []),
      ...(n.type === 'link' && n.url ? [{ label: 'Abrir o endereço', run: () => window.open(n.url, '_blank', 'noopener,noreferrer') }] : []),
      ...(n.type === 'group' ? [{ label: 'Renomear grupo', run: () => setEditing(n.id) }] : []),
      {
        label: 'Cor',
        submenu: [
          { label: 'Sem cor', run: () => ids.forEach((id) => patchNode(id, { color: null }, 0)) },
          ...CANVAS_COLORS.map((c) => ({ label: c.label, icon: <span className="w-2.5 h-2.5 rounded-full" style={{ background: c.css }} />, run: () => ids.forEach((id) => patchNode(id, { color: c.id }, 0)) })),
        ],
      },
      {
        label: 'Trazer para frente',
        run: () => save({ ...dataRef.current, nodes: [...dataRef.current.nodes.filter((x) => !ids.has(x.id)), ...dataRef.current.nodes.filter((x) => ids.has(x.id))] }, 0),
      },
      { label: 'Duplicar', shortcut: 'Ctrl+D', run: () => duplicate(ids) },
      'sep',
      { label: ids.size > 1 ? `Apagar ${ids.size} itens` : 'Apagar', icon: <Trash2 className="w-3.5 h-3.5" />, shortcut: 'Del', danger: true, run: () => removeNodes(ids) },
    ];
    menu.open(e, items, n.type === 'group' ? n.label || 'Grupo' : undefined);
  };
  const emptyMenu = (e: React.MouseEvent) => {
    if ((e.target as HTMLElement).closest('[data-cnode],[data-cedge],[data-cv-ui]')) return;
    const [x, y] = toWorld(e.clientX, e.clientY);
    menu.open(
      e,
      [
        { label: 'Cartão de texto aqui', icon: <StickyNote className="w-3.5 h-3.5" />, run: () => addNodes([{ id: cuid(), type: 'text', x: x - 130, y: y - 60, width: 260, height: 120, text: '' }], true) },
        { label: 'Nota do Notebook…', icon: <FileText className="w-3.5 h-3.5" />, run: () => setPicker({ x, y }) },
        { label: 'Imagem…', icon: <ImagePlus className="w-3.5 h-3.5" />, run: () => ((filePoint.current = [x, y]), fileRef.current?.click()) },
        { label: 'Grupo aqui', icon: <Group className="w-3.5 h-3.5" />, run: () => addGroup(x, y) },
        'sep',
        { label: 'Selecionar tudo', shortcut: 'Ctrl+A', run: () => setSel(new Set(dataRef.current.nodes.map((n) => n.id))) },
        { label: 'Enquadrar tudo', icon: <Maximize className="w-3.5 h-3.5" />, run: fit },
      ],
      'Canvas'
    );
  };
  const addGroup = (x: number, y: number) => {
    // com seleção: o grupo abraça os itens escolhidos
    const chosen = dataRef.current.nodes.filter((n) => sel.has(n.id));
    if (chosen.length) {
      const pad = 40;
      const minX = Math.min(...chosen.map((n) => n.x)) - pad;
      const minY = Math.min(...chosen.map((n) => n.y)) - pad;
      const maxX = Math.max(...chosen.map((n) => n.x + n.width)) + pad;
      const maxY = Math.max(...chosen.map((n) => n.y + n.height)) + pad;
      const g: CanvasNode = { id: cuid(), type: 'group', x: minX, y: minY, width: maxX - minX, height: maxY - minY, label: 'Grupo' };
      save({ ...dataRef.current, nodes: [g, ...dataRef.current.nodes] }, 0);
      setSel(new Set([g.id]));
      setEditing(g.id);
      return;
    }
    const g: CanvasNode = { id: cuid(), type: 'group', x: x - 240, y: y - 160, width: 480, height: 320, label: 'Grupo' };
    save({ ...dataRef.current, nodes: [g, ...dataRef.current.nodes] }, 0);
    setSel(new Set([g.id]));
    setEditing(g.id);
  };

  // ------------------------------------------------------------ desenho
  const byId = useMemo(() => new Map(data.nodes.map((n) => [n.id, n])), [data.nodes]);
  const groups = data.nodes.filter((n) => n.type === 'group');
  const cards = data.nodes.filter((n) => n.type !== 'group');
  const parent = path[path.length - 1];

  const startMove = (e: React.PointerEvent, n: CanvasNode) => {
    if (e.button !== 0) return;
    e.stopPropagation();
    let ids = sel;
    if (e.shiftKey) {
      ids = new Set(sel);
      if (ids.has(n.id)) ids.delete(n.id);
      else ids.add(n.id);
      setSel(ids);
      return;
    }
    if (!sel.has(n.id)) {
      ids = new Set([n.id]);
      setSel(ids);
    }
    setSelEdge(null);
    if (editing && editing !== n.id) (document.activeElement as HTMLElement | null)?.blur?.();
    // mover um grupo leva junto o que está dentro dele
    const moving = new Set(ids);
    dataRef.current.nodes
      .filter((g) => g.type === 'group' && moving.has(g.id))
      .forEach((g) => dataRef.current.nodes.forEach((c) => c.x >= g.x && c.y >= g.y && c.x + c.width <= g.x + g.width && c.y + c.height <= g.y + g.height && moving.add(c.id)));
    const start = new Map(dataRef.current.nodes.filter((x) => moving.has(x.id)).map((x) => [x.id, [x.x, x.y] as [number, number]]));
    startDrag({ kind: 'move', sx: e.clientX, sy: e.clientY, start, moved: false });
  };

  const nodeFrame = (n: CanvasNode, children: React.ReactNode) => {
    const on = sel.has(n.id);
    const color = canvasColor(n.color);
    return (
      <div
        key={n.id}
        data-cnode={n.id}
        className={`nb-cv-node nb-cv-${n.type}`}
        data-selected={on || undefined}
        data-editing={editing === n.id || undefined}
        style={{ left: n.x, top: n.y, width: n.width, height: n.height, ['--cv' as string]: color || undefined }}
        onPointerDown={(e) => editing !== n.id && startMove(e, n)}
        onDoubleClick={(e) => {
          e.stopPropagation();
          if (n.type === 'text' || n.type === 'group') setEditing(n.id);
          else if (n.type === 'note' && n.itemId) onOpen(n.itemId);
          else if (n.type === 'link' && n.url) window.open(n.url, '_blank', 'noopener,noreferrer');
        }}
        onContextMenu={(e) => nodeMenu(e, n)}
      >
        {children}
        {on && sel.size === 1 && editing !== n.id && (
          <>
            {SIDES.map((s) => (
              <span
                key={s}
                className={`nb-cv-handle nb-cv-handle--${s}`}
                title="Arraste para ligar"
                onPointerDown={(e) => {
                  e.stopPropagation();
                  const [x, y] = toWorld(e.clientX, e.clientY);
                  startDrag({ kind: 'connect', from: n.id, side: s, x, y });
                }}
              />
            ))}
            <span
              className="nb-cv-resize"
              title="Redimensionar"
              onPointerDown={(e) => {
                e.stopPropagation();
                startDrag({ kind: 'resize', id: n.id, sx: e.clientX, sy: e.clientY, w: n.width, h: n.height });
              }}
            />
          </>
        )}
      </div>
    );
  };

  const renderCard = (n: CanvasNode) => {
    if (n.type === 'text')
      return nodeFrame(
        n,
        editing === n.id ? (
          <textarea
            autoFocus
            defaultValue={n.text || ''}
            onPointerDown={(e) => e.stopPropagation()}
            onBlur={(e) => {
              patchNode(n.id, { text: e.target.value.slice(0, 20000) }, 0);
              setEditing(null);
            }}
            onKeyDown={(e) => {
              if (e.key === 'Escape') (e.target as HTMLTextAreaElement).blur();
            }}
            placeholder="Escreva em markdown…"
            className="nb-cv-textarea"
          />
        ) : n.text?.trim() ? (
          <div className="nb-cv-scroll nb-md nb-cv-md" onClick={(e) => linkClick(e)} dangerouslySetInnerHTML={{ __html: renderMarkdown(n.text, { titleExists: (t) => Object.values(api.items).some((i) => !i.archived_at && i.title.toLowerCase() === t.toLowerCase()) }) }} />
        ) : (
          <p className="nb-cv-empty">Clique duas vezes para escrever</p>
        )
      );
    if (n.type === 'note') {
      const it = n.itemId ? api.items[n.itemId] : null;
      return nodeFrame(
        n,
        <>
          <button type="button" className="nb-cv-note-head" onPointerDown={(e) => e.stopPropagation()} onClick={() => it && onOpen(it.id)} title="Abrir a nota">
            <span className="text-[13px]">{it ? itemIcon(it) : null}</span>
            <span className="truncate">{it?.title || 'Nota removida'}</span>
          </button>
          <div className="nb-cv-scroll nb-cv-note-body" onClick={(e) => linkClick(e)}>
            {!it ? null : !it._full ? (
              <Loader2 className="w-4 h-4 animate-spin text-[var(--nb-ink-3)]" />
            ) : it.template === 'chapter' ? (
              <div className="nb-md nb-cv-md" dangerouslySetInnerHTML={{ __html: sanitizeUserHtml(sanitizeWriterHtml(String(it.data?.html || ''))) }} />
            ) : NOTE_TEXT.has(it.template) ? (
              <div className="nb-md nb-cv-md" dangerouslySetInnerHTML={{ __html: renderMarkdown((it.content || '').replace(/^---\n[\s\S]*?\n---\n?/, '')) }} />
            ) : (
              <p className="nb-cv-empty">Abra a nota para ver este conteúdo.</p>
            )}
          </div>
        </>
      );
    }
    if (n.type === 'image')
      return nodeFrame(
        n,
        <>
          <span className="nb-cv-caption">{n.label}</span>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={n.url} alt={n.label || ''} draggable={false} />
        </>
      );
    // link
    let host = n.url || '';
    try {
      host = new URL(n.url || '').hostname;
    } catch {
      /* ignora */
    }
    return nodeFrame(
      n,
      <div className="nb-cv-link">
        <Link2 className="w-4 h-4 shrink-0 text-[var(--nb-ink-3)]" />
        <span className="min-w-0">
          <span className="block truncate font-semibold text-[13px]">{host}</span>
          <span className="block truncate text-[11px] text-[var(--nb-ink-3)]">{n.url}</span>
        </span>
      </div>
    );
  };

  /** [[links]] dentro dos cartões abrem a nota */
  const linkClick = (e: React.MouseEvent) => {
    const a = (e.target as HTMLElement).closest('[data-wikilink]') as HTMLElement | null;
    if (!a) return;
    e.preventDefault();
    const t = (a.dataset.wikilink || '').split('#')[0].trim().toLowerCase();
    const it = Object.values(api.items).find((i) => !i.archived_at && i.title.toLowerCase() === t);
    if (it) onOpen(it.id);
  };

  const v = view;
  const marquee = drag?.kind === 'marquee' ? drag : null;
  const connect = drag?.kind === 'connect' ? drag : null;

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
      </div>

      <div
        ref={boxRef}
        className="nb-cv-board"
        data-panning={drag?.kind === 'pan' || undefined}
        style={{ backgroundSize: `${22 * v.k}px ${22 * v.k}px`, backgroundPosition: `${v.x}px ${v.y}px` }}
        onPointerDown={(e) => {
          if (e.button !== 0 && e.button !== 1) return;
          if ((e.target as HTMLElement).closest('[data-cnode],[data-cedge],[data-cv-ui]')) return;
          // salva o cartão em edição (o blur grava o texto) antes de fechar
          if (editing) (document.activeElement as HTMLElement | null)?.blur?.();
          if (e.shiftKey && e.button === 0) {
            const [x, y] = toWorld(e.clientX, e.clientY);
            startDrag({ kind: 'marquee', sx: x, sy: y, x, y, add: new Set(sel) });
          } else startDrag({ kind: 'pan', sx: e.clientX, sy: e.clientY, vx: v.x, vy: v.y, moved: false });
        }}
        onDoubleClick={(e) => {
          if ((e.target as HTMLElement).closest('[data-cnode],[data-cedge],[data-cv-ui]')) return;
          const [x, y] = toWorld(e.clientX, e.clientY);
          addNodes([{ id: cuid(), type: 'text', x: Math.round(x - 130), y: Math.round(y - 50), width: 260, height: 120, text: '' }], true);
        }}
        onContextMenu={emptyMenu}
        onDragOver={(e) => e.dataTransfer.types.includes('Files') && e.preventDefault()}
        onDrop={(e) => {
          const files = Array.from(e.dataTransfer.files).filter((f) => f.type.startsWith('image/'));
          if (!files.length) return;
          e.preventDefault();
          const [x, y] = toWorld(e.clientX, e.clientY);
          void addImages(files, x, y);
        }}
      >
        <div className="nb-cv-world" style={{ transform: `translate(${v.x}px, ${v.y}px) scale(${v.k})` }}>
          {/* grupos (atrás) */}
          {groups.map((g) =>
            nodeFrame(
              g,
              editing === g.id ? (
                <input
                  autoFocus
                  defaultValue={g.label || ''}
                  onPointerDown={(e) => e.stopPropagation()}
                  onBlur={(e) => {
                    patchNode(g.id, { label: e.target.value.slice(0, 80) }, 0);
                    setEditing(null);
                  }}
                  onKeyDown={(e) => (e.key === 'Enter' || e.key === 'Escape') && (e.target as HTMLInputElement).blur()}
                  className="nb-cv-group-label nb-cv-group-input"
                  aria-label="Nome do grupo"
                />
              ) : (
                <span className="nb-cv-group-label">{g.label || 'Grupo'}</span>
              )
            )
          )}

          {/* ligações */}
          <svg className="nb-cv-edges" width="1" height="1">
            <defs>
              <marker id="nb-cv-arrow" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse">
                <path d="M0 0 L10 5 L0 10 z" fill="context-stroke" />
              </marker>
            </defs>
            {data.edges.map((e) => {
              const a = byId.get(e.fromNode);
              const b = byId.get(e.toNode);
              if (!a || !b) return null;
              const [as, bs] = autoSides(a, b);
              const s1 = e.fromSide || as;
              const s2 = e.toSide || bs;
              const { d, mid } = edgePath(sidePoint(a, s1), s1, sidePoint(b, s2), s2);
              const on = selEdge === e.id;
              const color = canvasColor(e.color) || (on ? 'var(--nb-ink)' : 'rgba(255,255,255,0.38)');
              return (
                <g
                  key={e.id}
                  data-cedge={e.id}
                  onPointerDown={(ev) => {
                    ev.stopPropagation();
                    setSelEdge(e.id);
                    setSel(new Set());
                  }}
                  onDoubleClick={(ev) => {
                    ev.stopPropagation();
                    setEdgeLabel(e.id);
                  }}
                  onContextMenu={(ev) => {
                    ev.stopPropagation();
                    setSelEdge(e.id);
                    menu.open(
                      ev,
                      [
                        { label: e.label ? 'Editar rótulo' : 'Dar um rótulo', run: () => setEdgeLabel(e.id) },
                        {
                          label: 'Cor',
                          submenu: [
                            { label: 'Sem cor', run: () => save({ ...dataRef.current, edges: dataRef.current.edges.map((x) => (x.id === e.id ? { ...x, color: null } : x)) }, 0) },
                            ...CANVAS_COLORS.map((c) => ({
                              label: c.label,
                              icon: <span className="w-2.5 h-2.5 rounded-full" style={{ background: c.css }} />,
                              run: () => save({ ...dataRef.current, edges: dataRef.current.edges.map((x) => (x.id === e.id ? { ...x, color: c.id } : x)) }, 0),
                            })),
                          ],
                        },
                        'sep',
                        { label: 'Apagar ligação', danger: true, icon: <Trash2 className="w-3.5 h-3.5" />, run: () => save({ ...dataRef.current, edges: dataRef.current.edges.filter((x) => x.id !== e.id) }, 0) },
                      ],
                      'Ligação'
                    );
                  }}
                  style={{ cursor: 'pointer' }}
                >
                  <path d={d} fill="none" stroke="transparent" strokeWidth={16 / v.k} />
                  <path d={d} fill="none" stroke={color} strokeWidth={on ? 2.5 : 1.75} markerEnd="url(#nb-cv-arrow)" />
                  {(e.label || edgeLabel === e.id) && (
                    <foreignObject x={mid[0] - 110} y={mid[1] - 14} width={220} height={28} style={{ overflow: 'visible' }}>
                      {edgeLabel === e.id ? (
                        <input
                          autoFocus
                          defaultValue={e.label || ''}
                          onPointerDown={(ev) => ev.stopPropagation()}
                          onBlur={(ev) => {
                            const label = ev.target.value.slice(0, 80);
                            save({ ...dataRef.current, edges: dataRef.current.edges.map((x) => (x.id === e.id ? { ...x, label } : x)) }, 0);
                            setEdgeLabel(null);
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
                const a = byId.get(connect.from);
                if (!a) return null;
                const p1 = sidePoint(a, connect.side);
                return <path d={edgePath(p1, connect.side, [connect.x, connect.y], connect.side === 'left' ? 'right' : connect.side === 'right' ? 'left' : connect.side === 'top' ? 'bottom' : 'top').d} fill="none" stroke="var(--nb-ink-2)" strokeWidth={1.75} strokeDasharray="6 5" />;
              })()}
          </svg>

          {/* cartões */}
          {cards.map(renderCard)}

          {marquee && (
            <div
              className="nb-cv-marquee"
              style={{ left: Math.min(marquee.sx, marquee.x), top: Math.min(marquee.sy, marquee.y), width: Math.abs(marquee.x - marquee.sx), height: Math.abs(marquee.y - marquee.sy) }}
            />
          )}
        </div>

        {!data.nodes.length && (
          <div className="nb-cv-hint" data-cv-ui>
            <p>Clique duas vezes para criar um cartão.</p>
            <p>Cole ou arraste imagens. Arraste a borda de um cartão para ligar.</p>
          </div>
        )}
      </div>

      {/* barra de inserir (embaixo) */}
      <div className="nb-cv-dock" data-cv-ui>
        <button type="button" title="Cartão de texto" aria-label="Cartão de texto" onClick={() => {
          const [x, y] = center();
          addNodes([{ id: cuid(), type: 'text', x: x - 130, y: y - 60, width: 260, height: 120, text: '' }], true);
        }}>
          <StickyNote />
        </button>
        <button type="button" title="Nota do Notebook" aria-label="Nota do Notebook" onClick={() => setPicker({ x: center()[0], y: center()[1] })}>
          <FileText />
        </button>
        <button type="button" title="Imagem" aria-label="Imagem" onClick={() => ((filePoint.current = center()), fileRef.current?.click())}>
          {uploading ? <Loader2 className="animate-spin" /> : <ImagePlus />}
        </button>
        <button type="button" title={sel.size ? 'Agrupar a seleção' : 'Grupo'} aria-label="Grupo" onClick={() => addGroup(...center())}>
          <Group />
        </button>
      </div>

      {/* zoom */}
      <div className="nb-cv-zoom" data-cv-ui>
        <button type="button" aria-label="Afastar" onClick={() => setView((x) => ({ ...x, k: Math.max(0.08, x.k / 1.2) }))}>
          <Minus />
        </button>
        <span>{Math.round(v.k * 100)}%</span>
        <button type="button" aria-label="Aproximar" onClick={() => setView((x) => ({ ...x, k: Math.min(3, x.k * 1.2) }))}>
          <Plus />
        </button>
        <button type="button" aria-label="Enquadrar tudo" title="Enquadrar tudo" onClick={fit}>
          <Maximize />
        </button>
        <button
          type="button"
          aria-label="Baixar .canvas"
          title="Baixar no formato JSON Canvas (abre no Obsidian)"
          onClick={() => {
            const blob = new Blob([JSON.stringify(toJsonCanvas(dataRef.current, (id) => api.items[id]?.title || null), null, 2)], { type: 'application/json' });
            const a = document.createElement('a');
            a.href = URL.createObjectURL(blob);
            a.download = `${item.title || 'canvas'}.canvas`;
            a.click();
            setTimeout(() => URL.revokeObjectURL(a.href), 2000);
          }}
        >
          <Download />
        </button>
      </div>

      <input
        ref={fileRef}
        type="file"
        accept="image/*"
        multiple
        hidden
        onChange={(e) => {
          const files = Array.from(e.target.files || []);
          e.target.value = '';
          const [x, y] = filePoint.current || center();
          if (files.length) void addImages(files, x, y);
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
    </div>
  );
}

function NotePicker({ items, onPick, onClose }: { items: NotebookItem[]; onPick: (i: NotebookItem) => void; onClose: () => void }) {
  const [q, setQ] = useState('');
  const [sel, setSel] = useState(0);
  const list = useMemo(() => {
    const t = q.trim().toLowerCase();
    return items
      .filter((i) => !t || i.title.toLowerCase().includes(t))
      .sort((a, b) => b.updated_at.localeCompare(a.updated_at))
      .slice(0, 40);
  }, [items, q]);
  return (
    <NbPortal>
      <div className="nb-modal-back" onClick={onClose}>
        <div className="nb-modal !max-w-lg" role="dialog" aria-label="Escolher nota" onClick={(e) => e.stopPropagation()}>
          <label className="flex items-center gap-3 px-4 h-14 border-b border-[var(--nb-line)]">
            <FileText className="w-4 h-4 text-[var(--nb-ink-3)]" />
            <input
              autoFocus
              value={q}
              onChange={(e) => (setQ(e.target.value), setSel(0))}
              onKeyDown={(e) => {
                if (e.key === 'ArrowDown') (e.preventDefault(), setSel((s) => Math.min(list.length - 1, s + 1)));
                if (e.key === 'ArrowUp') (e.preventDefault(), setSel((s) => Math.max(0, s - 1)));
                if (e.key === 'Enter' && list[sel]) onPick(list[sel]);
                if (e.key === 'Escape') onClose();
              }}
              placeholder="Nota para pôr no canvas…"
              aria-label="Buscar nota"
              className="flex-1 bg-transparent outline-none text-[15px]"
            />
            <button type="button" onClick={onClose} aria-label="Fechar" className="p-1 text-[var(--nb-ink-3)]">
              <X className="w-4 h-4" />
            </button>
          </label>
          <div className="nb-scroll overflow-y-auto py-1.5">
            {list.map((i, k) => (
              <button
                key={i.id}
                type="button"
                onMouseMove={() => sel !== k && setSel(k)}
                onClick={() => onPick(i)}
                className={`w-full flex items-center gap-3 px-4 py-2 text-left ${k === sel ? 'bg-white/[0.05]' : ''}`}
              >
                <span className="w-5 text-center">{itemIcon(i)}</span>
                <span className="flex-1 truncate text-sm">{i.title}</span>
              </button>
            ))}
            {!list.length && <p className="px-4 py-8 text-center text-sm text-[var(--nb-ink-3)]">Nenhuma nota encontrada.</p>}
          </div>
        </div>
      </div>
    </NbPortal>
  );
}
