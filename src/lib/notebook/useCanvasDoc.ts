'use client';

/**
 * Documento do Canvas: carrega os cartões e as ligações das tabelas próprias,
 * guarda o histórico (desfazer/refazer) e grava só o que mudou.
 *
 * - `live(next)`: mudança contínua (arrastar, redimensionar), sem histórico.
 * - `commit(next, from?)`: entra no histórico; `from` é o estado antes do gesto.
 * - Gravação com atraso curto; linhas iguais às já gravadas não saem do navegador.
 */
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import type { NotebookItem } from './types';
import type { NotebookApi } from './useNotebook';
import { canvasToContent, normalizeCanvas, type CanvasData, type CanvasEdge, type CanvasNode } from './canvas';

const NODE_COLS = 'id, type, x, y, width, height, z, color, text, item_id, url, label, asset_id, entry_id, locked, extra';
const EDGE_COLS = 'id, from_node, to_node, from_side, to_side, label, color, extra';
const HISTORY = 150;

type NodeRow = {
  id: string;
  type: CanvasNode['type'];
  x: number;
  y: number;
  width: number;
  height: number;
  z: number;
  color: string | null;
  text: string | null;
  item_id: string | null;
  url: string | null;
  label: string | null;
  asset_id: string | null;
  entry_id: string | null;
  locked: boolean;
  extra: Record<string, unknown>;
};
type EdgeRow = {
  id: string;
  from_node: string;
  to_node: string;
  from_side: string | null;
  to_side: string | null;
  label: string | null;
  color: string | null;
  extra: Record<string, unknown>;
};

const round = (v: number) => Math.round(v * 100) / 100;

function nodeRow(n: CanvasNode, z: number): NodeRow {
  const extra: Record<string, unknown> = {};
  if (n.mime) extra.mime = n.mime;
  if (n.bytes) extra.bytes = n.bytes;
  if (n.natW) extra.natW = n.natW;
  if (n.natH) extra.natH = n.natH;
  if (n.meta) extra.meta = n.meta;
  if (n.credit) extra.credit = n.credit.slice(0, 500);
  return {
    id: n.id,
    type: n.type,
    x: round(n.x),
    y: round(n.y),
    width: round(Math.max(20, n.width)),
    height: round(Math.max(20, n.height)),
    z,
    color: n.color || null,
    text: n.type === 'text' ? (n.text || '').slice(0, 20000) : null,
    item_id: n.itemId || null,
    url: n.url && /^https?:\/\//i.test(n.url) ? n.url.slice(0, 2000) : null,
    label: n.label ? n.label.slice(0, 300) : null,
    asset_id: n.assetId || null,
    entry_id: n.type === 'entry' ? n.entryId || null : null,
    locked: !!n.locked,
    extra,
  };
}
function fromNodeRow(r: NodeRow): CanvasNode {
  const e = (r.extra || {}) as Record<string, unknown>;
  return {
    id: r.id,
    type: r.type,
    x: Number(r.x),
    y: Number(r.y),
    width: Number(r.width),
    height: Number(r.height),
    color: r.color,
    text: r.text ?? undefined,
    itemId: r.item_id ?? undefined,
    url: r.url ?? undefined,
    label: r.label ?? undefined,
    assetId: r.asset_id,
    entryId: r.entry_id ?? undefined,
    meta: e.meta && typeof e.meta === 'object' ? (e.meta as CanvasNode['meta']) : undefined,
    credit: typeof e.credit === 'string' ? e.credit : undefined,
    locked: r.locked || undefined,
    mime: typeof e.mime === 'string' ? e.mime : undefined,
    bytes: typeof e.bytes === 'number' ? e.bytes : undefined,
    natW: typeof e.natW === 'number' ? e.natW : undefined,
    natH: typeof e.natH === 'number' ? e.natH : undefined,
  };
}
function edgeRow(e: CanvasEdge): EdgeRow {
  return {
    id: e.id,
    from_node: e.fromNode,
    to_node: e.toNode,
    from_side: e.fromSide || null,
    to_side: e.toSide || null,
    label: e.label ? e.label.slice(0, 300) : null,
    color: e.color || null,
    extra: {},
  };
}
function fromEdgeRow(r: EdgeRow): CanvasEdge {
  return {
    id: r.id,
    fromNode: r.from_node,
    toNode: r.to_node,
    fromSide: (r.from_side as CanvasEdge['fromSide']) || undefined,
    toSide: (r.to_side as CanvasEdge['toSide']) || undefined,
    label: r.label ?? undefined,
    color: r.color,
  };
}

/** Só o que pode ir para o banco: nada em envio (blob:) ou sem endereço. */
const persistable = (n: CanvasNode) => !n.pending && !(n.url && n.url.startsWith('blob:'));

export type CanvasStatus = 'loading' | 'saved' | 'saving' | 'error';

export function useCanvasDoc(item: NotebookItem, api: NotebookApi, entryTitle: (id: string) => string | null = () => null) {
  const supabase = useMemo(() => createClient(), []);
  const [data, setData] = useState<CanvasData>({ nodes: [], edges: [] });
  const [status, setStatus] = useState<CanvasStatus>('loading');
  const [hist, setHist] = useState({ undo: 0, redo: 0 });
  const dataRef = useRef(data);
  const itemRef = useRef(item);
  itemRef.current = item;
  const apiRef = useRef(api);
  apiRef.current = api;
  const entryTitleRef = useRef(entryTitle);
  entryTitleRef.current = entryTitle;
  const saved = useRef({ nodes: new Map<string, string>(), edges: new Map<string, string>() });
  const undoStack = useRef<CanvasData[]>([]);
  const redoStack = useRef<CanvasData[]>([]);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const busy = useRef(false);
  const dirty = useRef(false);
  const loaded = useRef(false);
  const canvasId = item.id;
  const profileId = item.profile_id;

  const apply = (next: CanvasData) => {
    dataRef.current = next;
    setData(next);
  };

  // ------------------------------------------------------------ gravar
  const flush = useCallback(async (): Promise<void> => {
    if (!loaded.current) return;
    if (busy.current) {
      dirty.current = true;
      return;
    }
    busy.current = true;
    dirty.current = false;
    const cur = dataRef.current;
    const nodes = cur.nodes.filter(persistable);
    const ids = new Set(nodes.map((n) => n.id));
    const edges = cur.edges.filter((e) => ids.has(e.fromNode) && ids.has(e.toNode));
    const nodeJson = new Map(nodes.map((n, z) => [n.id, JSON.stringify(nodeRow(n, z))]));
    const edgeJson = new Map(edges.map((e) => [e.id, JSON.stringify(edgeRow(e))]));
    const s = saved.current;
    const upN = nodes.filter((n) => s.nodes.get(n.id) !== nodeJson.get(n.id)).map((n) => ({ ...(JSON.parse(nodeJson.get(n.id)!) as NodeRow), canvas_id: canvasId, profile_id: profileId }));
    // um nó em envio ainda não existe no banco, mas também não foi apagado
    const pendingIds = new Set(cur.nodes.filter((n) => !persistable(n)).map((n) => n.id));
    const delN = Array.from(s.nodes.keys()).filter((id) => !nodeJson.has(id) && !pendingIds.has(id));
    const upE = edges.filter((e) => s.edges.get(e.id) !== edgeJson.get(e.id)).map((e) => ({ ...(JSON.parse(edgeJson.get(e.id)!) as EdgeRow), canvas_id: canvasId, profile_id: profileId }));
    const delE = Array.from(s.edges.keys()).filter((id) => !edgeJson.has(id));
    if (!upN.length && !delN.length && !upE.length && !delE.length) {
      busy.current = false;
      setStatus('saved');
      return;
    }
    setStatus('saving');
    try {
      // ordem: apaga ligações, grava nós, grava ligações, apaga nós
      for (let i = 0; i < delE.length; i += 200) {
        const { error } = await supabase.from('notebook_canvas_edges').delete().eq('canvas_id', canvasId).in('id', delE.slice(i, i + 200));
        if (error) throw error;
      }
      for (let i = 0; i < upN.length; i += 300) {
        const { error } = await supabase.from('notebook_canvas_nodes').upsert(upN.slice(i, i + 300), { onConflict: 'canvas_id,id' });
        if (error) throw error;
      }
      for (let i = 0; i < upE.length; i += 300) {
        const { error } = await supabase.from('notebook_canvas_edges').upsert(upE.slice(i, i + 300), { onConflict: 'canvas_id,id' });
        if (error) throw error;
      }
      for (let i = 0; i < delN.length; i += 200) {
        const { error } = await supabase.from('notebook_canvas_nodes').delete().eq('canvas_id', canvasId).in('id', delN.slice(i, i + 200));
        if (error) throw error;
      }
      saved.current = { nodes: nodeJson, edges: edgeJson };
      // texto do canvas para busca, [[links]] e #tags; o JSON antigo sai do item
      const it = itemRef.current;
      const a = apiRef.current;
      const content = canvasToContent(cur, (id) => a.items[id]?.title || null, (id) => entryTitleRef.current(id));
      const d = (it.data || {}) as Record<string, unknown>;
      if (content !== it.content || d.canvasV !== 2 || 'canvas' in d) {
        const rest = { ...d };
        delete rest.canvas;
        a.update(it.id, { content, data: { ...rest, canvasV: 2 } }, { debounce: 300 });
      }
      setStatus('saved');
    } catch (err) {
      console.error('[canvas] falha ao gravar', err);
      setStatus('error');
      // tenta de novo depois
      if (timer.current) clearTimeout(timer.current);
      timer.current = setTimeout(() => void flush(), 5000);
    } finally {
      busy.current = false;
    }
    if (dirty.current) void flush();
  }, [supabase, canvasId, profileId]);

  const schedule = useCallback(
    (ms = 500) => {
      if (timer.current) clearTimeout(timer.current);
      setStatus((s) => (s === 'loading' ? s : 'saving'));
      timer.current = setTimeout(() => void flush(), ms);
    },
    [flush]
  );

  // ------------------------------------------------------------ carregar
  useEffect(() => {
    let alive = true;
    void Promise.all([
      supabase.from('notebook_canvas_nodes').select(NODE_COLS).eq('canvas_id', canvasId).order('z').limit(20000),
      supabase.from('notebook_canvas_edges').select(EDGE_COLS).eq('canvas_id', canvasId).limit(40000),
    ]).then(([nr, er]) => {
      if (!alive) return;
      if (nr.error || er.error) {
        setStatus('error');
        return;
      }
      const rows = (nr.data || []) as NodeRow[];
      const erows = (er.data || []) as EdgeRow[];
      saved.current = {
        nodes: new Map(rows.map((r) => [r.id, JSON.stringify(nodeRow(fromNodeRow(r), r.z))])),
        edges: new Map(erows.map((r) => [r.id, JSON.stringify(edgeRow(fromEdgeRow(r)))])),
      };
      const d = (itemRef.current.data || {}) as Record<string, unknown>;
      const legacy = normalizeCanvas(d.canvas);
      loaded.current = true;
      if (d.canvasV !== 2 && legacy.nodes.length) {
        // o JSON antigo ainda é a versão válida: passa para as tabelas
        apply(legacy);
        setStatus('saving');
        void flush();
      } else {
        const sorted = [...rows].sort((a, b) => a.z - b.z);
        apply(normalizeCanvas({ nodes: sorted.map(fromNodeRow), edges: erows.map(fromEdgeRow) }));
        setStatus('saved');
      }
    });
    return () => {
      alive = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [canvasId]);

  // grava ao sair (troca de nota, fechar a aba)
  useEffect(() => {
    const onHide = () => document.visibilityState === 'hidden' && void flush();
    const onUnload = (e: BeforeUnloadEvent) => {
      if (timer.current || busy.current) {
        void flush();
        e.preventDefault();
      }
    };
    document.addEventListener('visibilitychange', onHide);
    window.addEventListener('beforeunload', onUnload);
    return () => {
      document.removeEventListener('visibilitychange', onHide);
      window.removeEventListener('beforeunload', onUnload);
      if (timer.current) {
        clearTimeout(timer.current);
        void flush();
      }
    };
  }, [flush]);

  // ------------------------------------------------------------ mudar
  const syncHist = () => setHist({ undo: undoStack.current.length, redo: redoStack.current.length });

  /** Mudança durante um gesto: aparece na tela, sem histórico nem gravação. */
  const live = useCallback((next: CanvasData) => apply(next), []);

  /** Mudança confirmada: entra no histórico e é gravada. */
  const commit = useCallback(
    (next: CanvasData, from?: CanvasData, delay = 500, merge = false) => {
      const before = from || dataRef.current;
      // merge: continua o último passo do histórico (ex.: setas seguidas)
      if (!merge && before !== next) {
        undoStack.current.push(before);
        if (undoStack.current.length > HISTORY) undoStack.current.shift();
        redoStack.current = [];
        syncHist();
      }
      apply(next);
      schedule(delay);
    },
    [schedule]
  );

  /** Troca sem histórico (ex.: o endereço final de uma imagem que terminou de subir). */
  const silent = useCallback(
    (fn: (d: CanvasData) => CanvasData) => {
      const next = fn(dataRef.current);
      apply(next);
      // o mesmo ajuste vale para o histórico (não volta para o blob:)
      undoStack.current = undoStack.current.map(fn);
      redoStack.current = redoStack.current.map(fn);
      schedule(200);
    },
    [schedule]
  );

  const undo = useCallback(() => {
    const prev = undoStack.current.pop();
    if (!prev) return false;
    redoStack.current.push(dataRef.current);
    apply(prev);
    syncHist();
    schedule(400);
    return true;
  }, [schedule]);

  const redo = useCallback(() => {
    const next = redoStack.current.pop();
    if (!next) return false;
    undoStack.current.push(dataRef.current);
    apply(next);
    syncHist();
    schedule(400);
    return true;
  }, [schedule]);

  return { data, dataRef, status, live, commit, silent, undo, redo, canUndo: hist.undo > 0, canRedo: hist.redo > 0, flush, loaded: status !== 'loading' };
}

export type CanvasDoc = ReturnType<typeof useCanvasDoc>;
