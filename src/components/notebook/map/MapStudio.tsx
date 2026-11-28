'use client';

import { notify } from '@/lib/ui/feedback';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ChevronRight, CornerDownRight, Eye, EyeOff, Hand, ImagePlus, Layers, Loader2, Maximize, MapPin, Minus, Pentagon, Plus, Route as RouteIcon, Trash2, X } from 'lucide-react';
import { useContext } from 'react';
import { WorldContext } from '../world/WorldContext';
import { projectOf } from '../entries/MentionContext';
import type { NotebookItem } from '@/lib/notebook/types';
import type { NotebookApi } from '@/lib/notebook/useNotebook';
import type { GlyphName } from '@/lib/notebook/glyphs';
import { ENTRY_CATEGORIES, entryLook } from '@/lib/notebook/entries';
import { uploadMediaToInsight } from '@/lib/mediaCompressor';
import { getUserUploadLimitBytes } from '@/lib/contributorLevels';
import { Glyph } from '../icons/Glyph';
import { useNotebookLinks } from '../editor/linkContext';
import { useNotebookMenu } from '../menu/ContextMenu';
import { Copy, Maximize as Fit, Pencil } from 'lucide-react';

// ------------------------------------------------------------------ dados
export interface MapMarker {
  id: string;
  x: number;
  y: number;
  label: string;
  icon: GlyphName;
  entryId?: string | null;
  /** camada (null = sempre visível) */
  layer?: string | null;
  /** mapa detalhado deste lugar */
  submapId?: string | null;
}
export interface MapRoute {
  id: string;
  from: string;
  to: string;
  label: string;
  style: 'estrada' | 'mar' | 'trilha';
  layer?: string | null;
}
export interface MapRegion {
  id: string;
  points: [number, number][];
  label: string;
  color: string;
  entryId?: string | null;
  layer?: string | null;
  submapId?: string | null;
}
export interface MapLayer {
  id: string;
  name: string;
  visible: boolean;
}
export interface MapData {
  image: string | null;
  w: number;
  h: number;
  markers: MapMarker[];
  routes: MapRoute[];
  regions: MapRegion[];
  layers: MapLayer[];
  /** mapa de cima (quando este é um sub-mapa) */
  parent?: string | null;
}

const SUGGESTED_LAYERS = ['Cidades', 'Rotas comerciais', 'Territórios', 'Ruínas'];

const MARKER_ICONS: GlyphName[] = ['castle', 'tower', 'house', 'anchor', 'mountain', 'tree', 'skull', 'star', 'flame', 'gem', 'crown', 'roadmap'];
const REGION_COLORS = ['#a78bfa', '#34d399', '#f59e0b', '#f87171', '#38bdf8', '#f472b6', '#94a3b8'];
const ROUTE_STYLES: { id: MapRoute['style']; label: string; dash: string; color: string }[] = [
  { id: 'estrada', label: 'Estrada', dash: '10 8', color: '#fef3c7' },
  { id: 'mar', label: 'Rota marítima', dash: '2 9', color: '#bae6fd' },
  { id: 'trilha', label: 'Trilha', dash: '4 5', color: '#d9f99d' },
];
const uid = () => Math.random().toString(36).slice(2, 10);

function normalize(raw: unknown): MapData {
  const m = (raw || {}) as Partial<MapData>;
  return {
    image: typeof m.image === 'string' ? m.image : null,
    w: Number(m.w) || 1600,
    h: Number(m.h) || 1000,
    markers: Array.isArray(m.markers) ? m.markers : [],
    routes: Array.isArray(m.routes) ? m.routes : [],
    regions: Array.isArray(m.regions) ? m.regions : [],
    layers: Array.isArray(m.layers) ? m.layers : [],
    parent: typeof m.parent === 'string' ? m.parent : null,
  };
}

/** Pedido para abrir um mapa já focado num verbete (vindo do Codex). */
const FOCUS_KEY = 'insight-nb-map-focus';
export function focusOnMap(mapId: string, entryId: string) {
  try {
    sessionStorage.setItem(FOCUS_KEY, JSON.stringify({ mapId, entryId }));
  } catch {
    /* ignora */
  }
}

type Mode = 'select' | 'marker' | 'route' | 'region';
type Sel = { type: 'marker' | 'route' | 'region'; id: string } | null;

const HELP: Record<Mode, string> = {
  select: 'Arraste para mover o mapa. Clique num marcador, rota ou região para editar.',
  marker: 'Clique no mapa para pôr um marcador.',
  route: 'Clique em dois marcadores para traçar uma rota entre eles.',
  region: 'Clique para marcar os cantos da região. Clique no primeiro ponto (ou Enter) para fechar.',
};

/** Cartografia: mapa do mundo com marcadores, rotas e regiões ligados às menções. */
export function MapStudio({
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
  const links = useNotebookLinks();
  const menu = useNotebookMenu();
  const [map, setMap] = useState<MapData>(() => normalize((item.data as Record<string, unknown>)?.map));
  const mapRef = useRef(map);
  const itemRef = useRef(item);
  itemRef.current = item;
  const [mode, setMode] = useState<Mode>('select');
  const [sel, setSel] = useState<Sel>(null);
  const [routeFrom, setRouteFrom] = useState<string | null>(null);
  const [draft, setDraft] = useState<[number, number][]>([]);
  const [title, setTitle] = useState(item.title);
  const [uploading, setUploading] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const boxRef = useRef<HTMLDivElement>(null);
  const [view, setView] = useState({ x: 0, y: 0, k: 0.6 });
  const [layersOpen, setLayersOpen] = useState(false);
  const world = useContext(WorldContext);
  const pan = useRef<{ x: number; y: number; vx: number; vy: number; moved: boolean } | null>(null);
  const dragMarker = useRef<{ id: string; sx: number; sy: number; mx: number; my: number; moved: boolean } | null>(null);

  const save = useCallback(
    (next: MapData, debounce = 500) => {
      mapRef.current = next;
      setMap(next);
      api.update(itemRef.current.id, { data: { ...(itemRef.current.data || {}), map: next } }, { debounce });
    },
    [api]
  );

  const fit = useCallback(() => {
    const box = boxRef.current?.getBoundingClientRect();
    if (!box) return;
    const k = Math.min(box.width / mapRef.current.w, box.height / mapRef.current.h) * 0.94;
    setView({ k, x: (box.width - mapRef.current.w * k) / 2, y: (box.height - mapRef.current.h * k) / 2 });
  }, []);
  useEffect(() => {
    fit();
    const ro = new ResizeObserver(() => fit());
    if (boxRef.current) ro.observe(boxRef.current);
    return () => ro.disconnect();
  }, [fit]);

  // veio do Codex ("No mundo"): seleciona e centraliza o verbete
  useEffect(() => {
    let req: { mapId: string; entryId: string } | null = null;
    try {
      req = JSON.parse(sessionStorage.getItem(FOCUS_KEY) || 'null');
    } catch {
      /* ignora */
    }
    if (!req || req.mapId !== item.id) return;
    sessionStorage.removeItem(FOCUS_KEY);
    const m = mapRef.current;
    const mk = m.markers.find((x) => x.entryId === req!.entryId);
    const rg = m.regions.find((x) => x.entryId === req!.entryId);
    const pt = mk ? [mk.x, mk.y] : rg ? [rg.points.reduce((a, p) => a + p[0], 0) / rg.points.length, rg.points.reduce((a, p) => a + p[1], 0) / rg.points.length] : null;
    if (!pt) return;
    setSel(mk ? { type: 'marker', id: mk.id } : { type: 'region', id: rg!.id });
    // mostra a camada dele se estiver oculta
    const layer = (mk || rg)!.layer;
    if (layer && m.layers.some((l) => l.id === layer && !l.visible)) save({ ...m, layers: m.layers.map((l) => (l.id === layer ? { ...l, visible: true } : l)) }, 0);
    setTimeout(() => {
      const box = boxRef.current?.getBoundingClientRect();
      if (!box) return;
      const k = 1;
      setView({ k, x: box.width / 2 - pt![0] * k, y: box.height / 2 - pt![1] * k });
    }, 80);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [item.id]);

  // trilha dos mapas de cima (sub-mapas)
  const [trail, setTrail] = useState<NotebookItem[]>([]);
  useEffect(() => {
    let alive = true;
    void (async () => {
      const out: NotebookItem[] = [];
      let pid = map.parent;
      const seen = new Set([item.id]);
      while (pid && !seen.has(pid) && out.length < 5) {
        seen.add(pid);
        const p = api.items[pid]?._full ? api.items[pid] : await api.loadFull(pid);
        if (!p || p.archived_at || p.template !== 'map') break;
        out.unshift(p);
        pid = normalize((p.data as Record<string, unknown>)?.map).parent;
      }
      if (alive) setTrail(out);
    })();
    return () => {
      alive = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [map.parent, item.id]);

  const hidden = useMemo(() => new Set(map.layers.filter((l) => !l.visible).map((l) => l.id)), [map.layers]);
  const shown = <T extends { layer?: string | null }>(x: T) => !x.layer || !hidden.has(x.layer);
  const otherMaps = useMemo(
    () => Object.values(api.items).filter((i) => i.template === 'map' && !i.archived_at && i.id !== item.id).sort((a, b) => a.title.localeCompare(b.title, 'pt-BR')),
    [api.items, item.id]
  );

  /** liga um sub-mapa e marca este como o mapa de cima dele */
  async function linkSubmap(kind: 'marker' | 'region', id: string, submapId: string | null) {
    const m = mapRef.current;
    if (kind === 'marker') save({ ...m, markers: m.markers.map((x) => (x.id === id ? { ...x, submapId } : x)) }, 0);
    else save({ ...m, regions: m.regions.map((x) => (x.id === id ? { ...x, submapId } : x)) }, 0);
    if (!submapId) return;
    const sub = await api.loadFull(submapId);
    if (!sub) return;
    const sm = normalize((sub.data as Record<string, unknown>)?.map);
    if (sm.parent !== item.id) api.update(submapId, { data: { ...(sub.data || {}), map: { ...sm, parent: item.id } } });
  }
  async function createSubmap(kind: 'marker' | 'region', id: string, label: string) {
    const sub = await api.create({ template: 'map', parentId: item.parent_id, title: label || 'Sub-mapa' });
    if (!sub) return;
    api.update(sub.id, { data: { ...(sub.data || {}), map: { ...normalize(null), parent: item.id } } });
    await linkSubmap(kind, id, sub.id);
    onOpen(sub.id);
  }
  /** cria o verbete do lugar no Codex do mundo e liga ao marcador/região */
  const worldProject = world ? projectOf(api.items, item) : null;
  async function createVerbete(kind: 'marker' | 'region', id: string, label: string) {
    if (!world || !worldProject) return;
    const cat = world.codex.ofProject(worldProject).find((c) => !c.parent_id && c.kind === 'lugar') || null;
    const it = await world.newVerbete(worldProject, cat?.id ?? null, label || 'Novo lugar');
    const entryId = (it?.data as { codex?: { entry: string } })?.codex?.entry;
    if (!entryId) return;
    const m = mapRef.current;
    if (kind === 'marker') save({ ...m, markers: m.markers.map((x) => (x.id === id ? { ...x, entryId } : x)) }, 0);
    else save({ ...m, regions: m.regions.map((x) => (x.id === id ? { ...x, entryId } : x)) }, 0);
  }

  const toWorld = (cx: number, cy: number): [number, number] => {
    const r = boxRef.current!.getBoundingClientRect();
    return [Math.round((cx - r.left - view.x) / view.k), Math.round((cy - r.top - view.y) / view.k)];
  };

  // Enter fecha a região; Esc cancela
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.target as HTMLElement)?.closest?.('input,textarea,select')) return;
      if (e.key === 'Escape') {
        setDraft([]);
        setRouteFrom(null);
        setSel(null);
      }
      if (e.key === 'Enter' && draft.length >= 3) closeRegion();
      if ((e.key === 'Delete' || e.key === 'Backspace') && sel) removeSel();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  });

  function closeRegion() {
    if (draft.length < 3) return;
    const r: MapRegion = { id: uid(), points: draft, label: 'Nova região', color: REGION_COLORS[map.regions.length % REGION_COLORS.length] };
    save({ ...mapRef.current, regions: [...mapRef.current.regions, r] }, 0);
    setDraft([]);
    setSel({ type: 'region', id: r.id });
    setMode('select');
  }

  function removeSel() {
    if (!sel) return;
    const m = mapRef.current;
    if (sel.type === 'marker') save({ ...m, markers: m.markers.filter((x) => x.id !== sel.id), routes: m.routes.filter((r) => r.from !== sel.id && r.to !== sel.id) }, 0);
    if (sel.type === 'route') save({ ...m, routes: m.routes.filter((x) => x.id !== sel.id) }, 0);
    if (sel.type === 'region') save({ ...m, regions: m.regions.filter((x) => x.id !== sel.id) }, 0);
    setSel(null);
  }

  async function uploadImage(f: File) {
    setUploading(true);
    try {
      const res = await uploadMediaToInsight(f, { budgetBytes: getUserUploadLimitBytes(level ?? 0, role ?? undefined), asImage: true, scope: 'notebook' });
      await api.registerAsset(item.id, res.r2Key, res.publicUrl);
      const img = new Image();
      img.src = res.publicUrl;
      await img.decode().catch(() => {});
      const scale = img.naturalWidth ? Math.min(1, 2400 / img.naturalWidth) : 1;
      const w = img.naturalWidth ? Math.round(img.naturalWidth * scale) : mapRef.current.w;
      const h = img.naturalHeight ? Math.round(img.naturalHeight * scale) : mapRef.current.h;
      // reposiciona o que já existia na nova proporção
      const sx = w / mapRef.current.w;
      const sy = h / mapRef.current.h;
      const m = mapRef.current;
      save(
        {
          ...m,
          image: res.publicUrl,
          w,
          h,
          markers: m.markers.map((k) => ({ ...k, x: Math.round(k.x * sx), y: Math.round(k.y * sy) })),
          regions: m.regions.map((r) => ({ ...r, points: r.points.map(([x, y]) => [Math.round(x * sx), Math.round(y * sy)] as [number, number]) })),
        },
        0
      );
      setTimeout(fit, 50);
    } catch (err) {
      notify(err instanceof Error ? err.message : 'Falha no envio da imagem.');
    }
    setUploading(false);
  }

  const markerById = useMemo(() => new Map(map.markers.map((m) => [m.id, m])), [map.markers]);
  const parent = path[path.length - 1];
  const selMarker = sel?.type === 'marker' ? map.markers.find((m) => m.id === sel.id) : null;
  const selRoute = sel?.type === 'route' ? map.routes.find((m) => m.id === sel.id) : null;
  const selRegion = sel?.type === 'region' ? map.regions.find((m) => m.id === sel.id) : null;

  const tool = (m: Mode, label: string, icon: React.ReactNode) => (
    <button
      type="button"
      title={label}
      aria-label={label}
      aria-pressed={mode === m}
      onClick={() => {
        setMode(m);
        setDraft([]);
        setRouteFrom(null);
      }}
      className={`flex items-center gap-1.5 h-8 px-2.5 rounded-lg text-[12px] font-semibold [&>svg]:w-3.5 [&>svg]:h-3.5 ${
        mode === m ? 'bg-[var(--nb-hl)] text-white' : 'text-zinc-300 hover:text-white hover:bg-white/10'
      }`}
    >
      {icon}
      <span className="nb-map-tool-label">{label}</span>
    </button>
  );

  return (
    <div className="absolute inset-0 nb-map">
      {/* barra flutuante */}
      <div className="nb-map-bar">
        <div className="flex items-center gap-1.5 h-8 pl-1.5 pr-2 mr-1 border-r border-zinc-700 max-w-[260px]">
          <Glyph name="map" className="text-[15px] text-[#2dd4bf] shrink-0" />
          {trail.length
            ? trail.map((t) => (
                <span key={t.id} className="flex items-center gap-1.5 min-w-0">
                  <button type="button" onClick={() => onOpen(t.id)} className="text-[11px] text-zinc-400 hover:text-white truncate max-w-[110px]" title={`Voltar para ${t.title}`}>
                    {t.title}
                  </button>
                  <ChevronRight className="w-3 h-3 text-zinc-600 shrink-0" />
                </span>
              ))
            : parent && (
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
        </div>
        {tool('select', 'Mover', <Hand />)}
        {tool('marker', 'Marcador', <MapPin />)}
        {tool('route', 'Rota', <RouteIcon />)}
        {tool('region', 'Região', <Pentagon />)}
        <span className="w-px h-5 bg-zinc-700 mx-1" />
        <button
          type="button"
          aria-pressed={layersOpen}
          onClick={() => setLayersOpen((v) => !v)}
          className={`flex items-center gap-1.5 h-8 px-2.5 rounded-lg text-[12px] font-semibold ${layersOpen ? 'bg-white/10 text-white' : 'text-zinc-300 hover:text-white hover:bg-white/10'}`}
        >
          <Layers className="w-3.5 h-3.5" />
          <span className="nb-map-tool-label">Camadas{hidden.size ? ` · ${hidden.size} oculta${hidden.size > 1 ? 's' : ''}` : ''}</span>
        </button>
        <button
          type="button"
          onClick={() => fileRef.current?.click()}
          className="flex items-center gap-1.5 h-8 px-2.5 rounded-lg text-[12px] font-semibold text-zinc-300 hover:text-white hover:bg-white/10"
        >
          {uploading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <ImagePlus className="w-3.5 h-3.5" />}
          <span className="nb-map-tool-label">{map.image ? 'Trocar imagem' : 'Imagem do mapa'}</span>
        </button>
        {map.image && (
          <button type="button" title="Voltar ao pergaminho" onClick={() => save({ ...mapRef.current, image: null }, 0)} className="p-1.5 rounded-lg text-zinc-400 hover:text-white">
            <X className="w-3.5 h-3.5" />
          </button>
        )}
        <input
          ref={fileRef}
          type="file"
          accept="image/*"
          hidden
          onChange={(e) => {
            const f = e.target.files?.[0];
            e.target.value = '';
            if (f) void uploadImage(f);
          }}
        />
      </div>
      <p className="nb-map-help">{routeFrom ? 'Agora clique no marcador de destino.' : HELP[mode]}</p>

      {/* mapa */}
      <div
        ref={boxRef}
        className={`nb-map-view ${mode === 'select' ? 'cursor-grab' : 'cursor-crosshair'}`}
        onContextMenu={(e) => {
          if ((e.target as HTMLElement).closest('[data-map-el],[data-pz-stop]')) return;
          const [x, y] = toWorld(e.clientX, e.clientY);
          const inside = x >= 0 && y >= 0 && x <= map.w && y <= map.h;
          menu.open(
            e,
            [
              ...(inside
                ? [
                    {
                      label: 'Marcador aqui',
                      icon: <MapPin className="w-3.5 h-3.5" />,
                      run: () => {
                        const mk: MapMarker = { id: uid(), x, y, label: 'Novo lugar', icon: 'castle', entryId: null };
                        save({ ...mapRef.current, markers: [...mapRef.current.markers, mk] }, 0);
                        setSel({ type: 'marker', id: mk.id });
                      },
                    },
                    {
                      label: 'Começar região aqui',
                      icon: <Pentagon className="w-3.5 h-3.5" />,
                      run: () => {
                        setMode('region');
                        setDraft([[x, y]]);
                      },
                    },
                    'sep' as const,
                  ]
                : []),
              { label: 'Enquadrar o mapa', icon: <Fit className="w-3.5 h-3.5" />, run: fit },
              { label: map.image ? 'Trocar imagem do mapa' : 'Usar imagem própria', icon: <ImagePlus className="w-3.5 h-3.5" />, run: () => fileRef.current?.click() },
              ...(map.image ? [{ label: 'Voltar ao pergaminho', icon: <X className="w-3.5 h-3.5" />, run: () => save({ ...mapRef.current, image: null }, 0) }] : []),
            ],
            'Mapa'
          );
        }}
        onWheel={(e) => {
          const r = boxRef.current!.getBoundingClientRect();
          const mx = e.clientX - r.left;
          const my = e.clientY - r.top;
          setView((v) => {
            const k = Math.min(3, Math.max(0.12, v.k * (e.deltaY < 0 ? 1.12 : 1 / 1.12)));
            return { k, x: mx - ((mx - v.x) / v.k) * k, y: my - ((my - v.y) / v.k) * k };
          });
        }}
        onPointerDown={(e) => {
          if ((e.target as HTMLElement).closest('[data-map-el],[data-pz-stop]')) return;
          pan.current = { x: e.clientX, y: e.clientY, vx: view.x, vy: view.y, moved: false };
          (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
        }}
        onPointerMove={(e) => {
          if (dragMarker.current) return;
          const p = pan.current;
          if (!p) return;
          if (Math.abs(e.clientX - p.x) + Math.abs(e.clientY - p.y) > 4) p.moved = true;
          if (p.moved) setView((v) => ({ ...v, x: p.vx + e.clientX - p.x, y: p.vy + e.clientY - p.y }));
        }}
        onPointerUp={(e) => {
          const p = pan.current;
          pan.current = null;
          if (!p || p.moved) return;
          const [x, y] = toWorld(e.clientX, e.clientY);
          if (x < 0 || y < 0 || x > map.w || y > map.h) return;
          if (mode === 'marker') {
            const mk: MapMarker = { id: uid(), x, y, label: 'Novo lugar', icon: 'castle', entryId: null };
            save({ ...mapRef.current, markers: [...mapRef.current.markers, mk] }, 0);
            setSel({ type: 'marker', id: mk.id });
            setMode('select');
          } else if (mode === 'region') {
            setDraft((d) => [...d, [x, y]]);
          } else {
            setSel(null);
          }
        }}
      >
        <div className="absolute left-0 top-0" style={{ width: map.w, height: map.h, transform: `translate(${view.x}px, ${view.y}px) scale(${view.k})`, transformOrigin: '0 0' }}>
          {map.image ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={map.image} alt="" draggable={false} className="absolute inset-0 w-full h-full object-cover rounded-[10px] select-none pointer-events-none" />
          ) : (
            <Parchment w={map.w} h={map.h} />
          )}

          <svg className="absolute inset-0 overflow-visible" width={map.w} height={map.h}>
            {/* regiões */}
            {map.regions.filter(shown).map((r) => {
              const cx = r.points.reduce((s, p) => s + p[0], 0) / r.points.length;
              const cy = r.points.reduce((s, p) => s + p[1], 0) / r.points.length;
              const on = sel?.type === 'region' && sel.id === r.id;
              return (
                <g
                  key={r.id}
                  data-map-el
                  data-ref={r.entryId || undefined}
                  onPointerDown={(e) => e.stopPropagation()}
                  onClick={() => mode === 'select' && setSel({ type: 'region', id: r.id })}
                  onDoubleClick={() => (r.submapId ? onOpen(r.submapId) : r.entryId && links.readMore?.(r.entryId))}
                  onContextMenu={(e) =>
                    menu.open(
                      e,
                      [
                        ...(r.submapId ? [{ label: 'Entrar no mapa detalhado', icon: <CornerDownRight className="w-3.5 h-3.5" />, run: () => onOpen(r.submapId!) }] : []),
                        ...(r.entryId ? [{ label: 'Abrir o verbete', icon: <Glyph name="sparkle" />, run: () => links.readMore?.(r.entryId!) }] : []),
                        { label: 'Editar região', icon: <Pencil className="w-3.5 h-3.5" />, run: () => setSel({ type: 'region', id: r.id }) },
                        'sep',
                        { label: 'Apagar região', icon: <Trash2 className="w-3.5 h-3.5" />, danger: true, run: () => save({ ...mapRef.current, regions: mapRef.current.regions.filter((x) => x.id !== r.id) }, 0) },
                      ],
                      r.label
                    )
                  }
                  style={{ cursor: 'pointer' }}
                >
                  <polygon points={r.points.map((p) => p.join(',')).join(' ')} fill={r.color} fillOpacity={on ? 0.32 : 0.2} stroke={r.color} strokeWidth={on ? 3 : 2} strokeDasharray="7 5" />
                  <text x={cx} y={cy} textAnchor="middle" className="nb-map-region-label" fill="#fff">
                    {r.label}
                    {r.submapId ? ' ›' : ''}
                  </text>
                </g>
              );
            })}
            {/* rotas */}
            {map.routes.filter(shown).map((rt) => {
              const a = markerById.get(rt.from);
              const b = markerById.get(rt.to);
              if (!a || !b || !shown(a) || !shown(b)) return null;
              const st = ROUTE_STYLES.find((s) => s.id === rt.style) || ROUTE_STYLES[0];
              const mx = (a.x + b.x) / 2;
              const my = (a.y + b.y) / 2 - Math.hypot(b.x - a.x, b.y - a.y) * 0.12;
              const on = sel?.type === 'route' && sel.id === rt.id;
              return (
                <g
                  key={rt.id}
                  data-map-el
                  onPointerDown={(e) => e.stopPropagation()}
                  onClick={() => mode === 'select' && setSel({ type: 'route', id: rt.id })}
                  onContextMenu={(e) =>
                    menu.open(
                      e,
                      [
                        { label: 'Editar rota', icon: <Pencil className="w-3.5 h-3.5" />, run: () => setSel({ type: 'route', id: rt.id }) },
                        'sep',
                        { label: 'Apagar rota', icon: <Trash2 className="w-3.5 h-3.5" />, danger: true, run: () => save({ ...mapRef.current, routes: mapRef.current.routes.filter((x) => x.id !== rt.id) }, 0) },
                      ],
                      rt.label || 'Rota'
                    )
                  }
                  style={{ cursor: 'pointer' }}
                >
                  <path d={`M${a.x} ${a.y} Q${mx} ${my} ${b.x} ${b.y}`} fill="none" stroke="transparent" strokeWidth={18} />
                  <path d={`M${a.x} ${a.y} Q${mx} ${my} ${b.x} ${b.y}`} fill="none" stroke={on ? '#fff' : st.color} strokeWidth={on ? 4 : 3} strokeDasharray={st.dash} strokeLinecap="round" />
                  {rt.label && (
                    <foreignObject x={(a.x + 2 * mx + b.x) / 4 - 170} y={(a.y + 2 * my + b.y) / 4 - 16} width={340} height={32} style={{ overflow: 'visible' }}>
                      <div className="nb-map-route-label">{rt.label}</div>
                    </foreignObject>
                  )}
                </g>
              );
            })}
            {/* região sendo desenhada */}
            {draft.length > 0 && (
              <g>
                <polyline points={draft.map((p) => p.join(',')).join(' ')} fill="none" stroke="#fff" strokeWidth={2} strokeDasharray="5 5" />
                {draft.map((p, i) => (
                  <circle
                    key={i}
                    cx={p[0]}
                    cy={p[1]}
                    r={i === 0 ? 9 : 5}
                    fill={i === 0 ? 'var(--nb-hl)' : '#fff'}
                    data-map-el
                    onPointerDown={(e) => e.stopPropagation()}
                    onClick={() => i === 0 && closeRegion()}
                    style={{ cursor: i === 0 ? 'pointer' : 'default' }}
                  />
                ))}
              </g>
            )}
          </svg>

          {/* marcadores */}
          {map.markers.filter(shown).map((m) => {
            const e = m.entryId ? links.entries[m.entryId] : null;
            const on = sel?.type === 'marker' && sel.id === m.id;
            const color = e ? entryLook(e).color : '#2dd4bf';
            return (
              <div
                key={m.id}
                data-map-el
                data-ref={m.entryId || undefined}
                className={`nb-map-marker ${on ? 'is-selected' : ''} ${routeFrom === m.id ? 'is-from' : ''}`}
                onDoubleClick={() => mode === 'select' && (m.submapId ? onOpen(m.submapId) : e && links.readMore?.(e.id))}
                style={{ left: m.x, top: m.y, ['--mk' as string]: color }}
                onContextMenu={(ev) =>
                  menu.open(
                    ev,
                    [
                      ...(m.submapId ? [{ label: 'Entrar no mapa detalhado', icon: <CornerDownRight className="w-3.5 h-3.5" />, run: () => onOpen(m.submapId!) }] : []),
                      ...(e ? [{ label: `Abrir “${e.title.slice(0, 24)}”`, icon: <Glyph name="sparkle" />, run: () => links.readMore?.(e.id) }] : []),
                      ...(m.submapId || e ? ['sep' as const] : []),
                      { label: 'Editar marcador', icon: <Pencil className="w-3.5 h-3.5" />, run: () => setSel({ type: 'marker', id: m.id }) },
                      {
                        label: 'Rota a partir daqui',
                        icon: <RouteIcon className="w-3.5 h-3.5" />,
                        run: () => {
                          setMode('route');
                          setRouteFrom(m.id);
                        },
                      },
                      {
                        label: 'Duplicar',
                        icon: <Copy className="w-3.5 h-3.5" />,
                        run: () => save({ ...mapRef.current, markers: [...mapRef.current.markers, { ...m, id: uid(), x: m.x + 40, y: m.y + 40 }] }, 0),
                      },
                      'sep',
                      {
                        label: 'Apagar marcador',
                        icon: <Trash2 className="w-3.5 h-3.5" />,
                        danger: true,
                        run: () => save({ ...mapRef.current, markers: mapRef.current.markers.filter((x) => x.id !== m.id), routes: mapRef.current.routes.filter((r) => r.from !== m.id && r.to !== m.id) }, 0),
                      },
                    ],
                    e ? e.title : m.label
                  )
                }
                onPointerDown={(ev) => {
                  ev.stopPropagation();
                  if (mode !== 'select') return;
                  (ev.currentTarget as HTMLElement).setPointerCapture(ev.pointerId);
                  dragMarker.current = { id: m.id, sx: ev.clientX, sy: ev.clientY, mx: m.x, my: m.y, moved: false };
                }}
                onPointerMove={(ev) => {
                  const d = dragMarker.current;
                  if (!d || d.id !== m.id) return;
                  const dx = (ev.clientX - d.sx) / view.k;
                  const dy = (ev.clientY - d.sy) / view.k;
                  if (Math.abs(dx) + Math.abs(dy) > 2) d.moved = true;
                  if (d.moved) {
                    const next = { ...mapRef.current, markers: mapRef.current.markers.map((k) => (k.id === d.id ? { ...k, x: Math.round(d.mx + dx), y: Math.round(d.my + dy) } : k)) };
                    mapRef.current = next;
                    setMap(next);
                  }
                }}
                onPointerUp={() => {
                  const d = dragMarker.current;
                  dragMarker.current = null;
                  if (d?.moved) return save(mapRef.current, 0);
                  if (mode === 'route') {
                    if (!routeFrom) setRouteFrom(m.id);
                    else if (routeFrom !== m.id) {
                      const rt: MapRoute = { id: uid(), from: routeFrom, to: m.id, label: '', style: 'estrada' };
                      save({ ...mapRef.current, routes: [...mapRef.current.routes, rt] }, 0);
                      setRouteFrom(null);
                      setSel({ type: 'route', id: rt.id });
                      setMode('select');
                    }
                  } else setSel({ type: 'marker', id: m.id });
                }}
              >
                <span className="nb-map-pin">
                  <Glyph name={m.icon} />
                </span>
                <span className="nb-map-label">
                  {e ? e.title : m.label}
                  {m.submapId && <CornerDownRight className="inline w-3 h-3 ml-1 -mt-0.5 opacity-70" aria-label="tem mapa detalhado" />}
                </span>
              </div>
            );
          })}
        </div>

        <div data-pz-stop className="absolute bottom-3 right-3 z-20 flex items-center gap-0.5 p-1 rounded-xl bg-[#141417]/90 backdrop-blur border border-zinc-800">
          <button type="button" aria-label="Afastar" onClick={() => setView((v) => ({ ...v, k: Math.max(0.12, v.k / 1.2) }))} className="p-1.5 rounded-lg text-zinc-300 hover:text-white">
            <Minus className="w-3.5 h-3.5" />
          </button>
          <span className="w-10 text-center text-[10px] font-bold tabular-nums text-zinc-200">{Math.round(view.k * 100)}%</span>
          <button type="button" aria-label="Aproximar" onClick={() => setView((v) => ({ ...v, k: Math.min(3, v.k * 1.2) }))} className="p-1.5 rounded-lg text-zinc-300 hover:text-white">
            <Plus className="w-3.5 h-3.5" />
          </button>
          <button type="button" aria-label="Enquadrar" onClick={fit} className="p-1.5 rounded-lg text-zinc-300 hover:text-white">
            <Maximize className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* camadas */}
      {layersOpen && (
        <LayersPanel
          map={map}
          onClose={() => setLayersOpen(false)}
          onChange={(layers) => save({ ...mapRef.current, layers }, 0)}
          onDelete={(id) => {
            const m = mapRef.current;
            const clear = <T extends { layer?: string | null }>(x: T) => (x.layer === id ? { ...x, layer: null } : x);
            save({ ...m, layers: m.layers.filter((l) => l.id !== id), markers: m.markers.map(clear), routes: m.routes.map(clear), regions: m.regions.map(clear) }, 0);
          }}
        />
      )}

      {/* painel do item selecionado */}
      {(selMarker || selRoute || selRegion) && (
        <div className="nb-mention-panel" data-pz-stop>
          <div className="flex items-center justify-between mb-2">
            <p className="text-[10px] font-black uppercase tracking-wider text-[var(--nb-hl)]">{selMarker ? 'Marcador' : selRoute ? 'Rota' : 'Região'}</p>
            <div className="flex items-center gap-1">
              <button type="button" aria-label="Apagar" onClick={removeSel} className="p-1.5 rounded-md text-[var(--nb-ink-3)] hover:text-red-400">
                <Trash2 className="w-3.5 h-3.5" />
              </button>
              <button type="button" aria-label="Fechar" onClick={() => setSel(null)} className="p-1.5 rounded-md text-[var(--nb-ink-3)] hover:text-[var(--nb-ink)]">
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>

          {selMarker && (
            <MarkerEditor
              marker={selMarker}
              onChange={(patch) => save({ ...mapRef.current, markers: mapRef.current.markers.map((k) => (k.id === selMarker.id ? { ...k, ...patch } : k)) })}
            />
          )}
          {(selMarker || selRegion) && (
            <WorldLinks
              layer={(selMarker || selRegion)!.layer || null}
              layers={map.layers}
              onLayer={(layer) =>
                selMarker
                  ? save({ ...mapRef.current, markers: mapRef.current.markers.map((k) => (k.id === selMarker.id ? { ...k, layer } : k)) }, 0)
                  : save({ ...mapRef.current, regions: mapRef.current.regions.map((k) => (k.id === selRegion!.id ? { ...k, layer } : k)) }, 0)
              }
              submapId={(selMarker || selRegion)!.submapId || null}
              maps={otherMaps}
              onSubmap={(id) => void linkSubmap(selMarker ? 'marker' : 'region', (selMarker || selRegion)!.id, id)}
              onNewSubmap={() => void createSubmap(selMarker ? 'marker' : 'region', (selMarker || selRegion)!.id, (selMarker || selRegion)!.label)}
              onEnter={(id) => onOpen(id)}
              canVerbete={!!worldProject && !(selMarker || selRegion)!.entryId}
              onVerbete={() => void createVerbete(selMarker ? 'marker' : 'region', (selMarker || selRegion)!.id, (selMarker || selRegion)!.label)}
            />
          )}
          {selRoute && (
            <div className="space-y-2.5">
              <input
                value={selRoute.label}
                onChange={(e) => save({ ...mapRef.current, routes: mapRef.current.routes.map((k) => (k.id === selRoute.id ? { ...k, label: e.target.value.slice(0, 60) } : k)) })}
                placeholder="Nome e distância (ex.: Estrada do Norte · 12 dias)"
                className="w-full h-8 px-2 rounded-lg bg-[var(--nb-bg)] border border-[var(--nb-line)] text-[13px] outline-none"
              />
              <div className="flex flex-wrap gap-1.5">
                {ROUTE_STYLES.map((s) => (
                  <button
                    key={s.id}
                    type="button"
                    onClick={() => save({ ...mapRef.current, routes: mapRef.current.routes.map((k) => (k.id === selRoute.id ? { ...k, style: s.id } : k)) }, 0)}
                    className={`h-7 px-2.5 rounded-full border text-[11px] font-bold ${selRoute.style === s.id ? 'border-[var(--nb-hl)] text-[var(--nb-ink)] bg-[var(--nb-hl-soft)]' : 'border-[var(--nb-line)] text-[var(--nb-ink-3)]'}`}
                  >
                    {s.label}
                  </button>
                ))}
              </div>
              <p className="text-[12px] text-[var(--nb-ink-3)]">
                {markerById.get(selRoute.from)?.label} → {markerById.get(selRoute.to)?.label}
              </p>
              <LayerSelect
                value={selRoute.layer || null}
                layers={map.layers}
                onChange={(layer) => save({ ...mapRef.current, routes: mapRef.current.routes.map((k) => (k.id === selRoute.id ? { ...k, layer } : k)) }, 0)}
              />
            </div>
          )}
          {selRegion && (
            <div className="space-y-2.5">
              <input
                value={selRegion.label}
                onChange={(e) => save({ ...mapRef.current, regions: mapRef.current.regions.map((k) => (k.id === selRegion.id ? { ...k, label: e.target.value.slice(0, 60) } : k)) })}
                placeholder="Nome da região"
                className="w-full h-8 px-2 rounded-lg bg-[var(--nb-bg)] border border-[var(--nb-line)] text-[13px] outline-none"
              />
              <div className="flex gap-1.5">
                {REGION_COLORS.map((c) => (
                  <button
                    key={c}
                    type="button"
                    aria-label={`Cor ${c}`}
                    onClick={() => save({ ...mapRef.current, regions: mapRef.current.regions.map((k) => (k.id === selRegion.id ? { ...k, color: c } : k)) }, 0)}
                    className={`w-6 h-6 rounded-full border-2 ${selRegion.color === c ? 'border-white' : 'border-transparent'}`}
                    style={{ background: c }}
                  />
                ))}
              </div>
              <MentionPicker
                value={selRegion.entryId || null}
                label={selRegion.label}
                onChange={(id) => save({ ...mapRef.current, regions: mapRef.current.regions.map((k) => (k.id === selRegion.id ? { ...k, entryId: id } : k)) }, 0)}
              />
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function MarkerEditor({ marker, onChange }: { marker: MapMarker; onChange: (p: Partial<MapMarker>) => void }) {
  return (
    <div className="space-y-2.5">
      <input
        value={marker.label}
        onChange={(e) => onChange({ label: e.target.value.slice(0, 60) })}
        placeholder="Nome do lugar"
        className="w-full h-8 px-2 rounded-lg bg-[var(--nb-bg)] border border-[var(--nb-line)] text-[13px] font-semibold outline-none"
      />
      <div className="grid grid-cols-6 gap-1">
        {MARKER_ICONS.map((ic) => (
          <button
            key={ic}
            type="button"
            aria-label={`Ícone ${ic}`}
            onClick={() => onChange({ icon: ic })}
            className={`h-8 grid place-items-center rounded-lg text-[16px] ${marker.icon === ic ? 'bg-[var(--nb-hl-soft)] text-[var(--nb-hl)] ring-1 ring-[var(--nb-hl)]' : 'text-[var(--nb-ink-2)] hover:bg-[var(--nb-pane-2)]'}`}
          >
            <Glyph name={ic} />
          </button>
        ))}
      </div>
      <MentionPicker value={marker.entryId || null} label={marker.label} onChange={(id) => onChange({ entryId: id })} />
    </div>
  );
}

/** Liga o marcador/região a uma menção (mostra a prévia ao passar o mouse). */
export function MentionPicker({ value, label, onChange }: { value: string | null; label: string; onChange: (id: string | null) => void }) {
  const links = useNotebookLinks();
  const all = Object.values(links.entries)
    .filter((e) => e.kind === 'elemento')
    .sort((a, b) => Number(b.category === 'lugar') - Number(a.category === 'lugar') || a.title.localeCompare(b.title, 'pt-BR'));
  const current = value ? links.entries[value] : null;
  return (
    <div className="space-y-1.5">
      <span className="block text-[10px] font-bold uppercase tracking-wider text-[var(--nb-ink-3)]">Menção ligada</span>
      <select
        value={value || ''}
        onChange={(e) => onChange(e.target.value || null)}
        className="w-full h-8 px-1.5 rounded-lg bg-[var(--nb-bg)] border border-[var(--nb-line)] text-[12px] outline-none"
      >
        <option value="">nenhuma</option>
        {ENTRY_CATEGORIES.map((c) => {
          const group = all.filter((e) => (e.category || 'conceito') === c.id);
          return group.length ? (
            <optgroup key={c.id} label={c.label}>
              {group.map((e) => (
                <option key={e.id} value={e.id}>
                  {e.title}
                </option>
              ))}
            </optgroup>
          ) : null;
        })}
      </select>
      {!current && (
        <button
          type="button"
          onClick={async () => {
            const r = await links.requestEntry(label);
            if (r) onChange(r.id);
          }}
          className="flex items-center gap-1 h-7 px-2.5 rounded-lg bg-[var(--nb-pane-2)] text-[11px] font-bold hover:text-[var(--nb-hl)]"
        >
          <Plus className="w-3 h-3" /> Criar menção “{label.slice(0, 24)}”
        </button>
      )}
      {current && <p className="text-[11px] text-[var(--nb-ink-3)]">Passe o mouse para ver a prévia de {current.title}.</p>}
    </div>
  );
}

/** Pergaminho autoral (sem imagem): papel envelhecido, grade e rosa dos ventos. */
function Parchment({ w, h }: { w: number; h: number }) {
  return (
    <svg className="absolute inset-0 rounded-[10px]" width={w} height={h} viewBox={`0 0 ${w} ${h}`} aria-hidden>
      <defs>
        <radialGradient id="nb-parch" cx="50%" cy="45%" r="75%">
          <stop offset="0%" stopColor="#efe2c4" />
          <stop offset="70%" stopColor="#dcc79c" />
          <stop offset="100%" stopColor="#b99a63" />
        </radialGradient>
        <filter id="nb-paper-noise">
          <feTurbulence type="fractalNoise" baseFrequency="0.9" numOctaves="2" seed="7" />
          <feColorMatrix values="0 0 0 0 0.35  0 0 0 0 0.27  0 0 0 0 0.15  0 0 0 0.22 0" />
          <feComposite in2="SourceGraphic" operator="in" />
        </filter>
      </defs>
      <rect width={w} height={h} fill="url(#nb-parch)" />
      <rect width={w} height={h} filter="url(#nb-paper-noise)" />
      <g stroke="#7a5c2e" strokeOpacity="0.16" strokeWidth="1">
        {Array.from({ length: Math.floor(w / 200) }, (_, i) => (
          <line key={`v${i}`} x1={(i + 1) * 200} y1={0} x2={(i + 1) * 200} y2={h} />
        ))}
        {Array.from({ length: Math.floor(h / 200) }, (_, i) => (
          <line key={`h${i}`} x1={0} y1={(i + 1) * 200} x2={w} y2={(i + 1) * 200} />
        ))}
      </g>
      <rect x={14} y={14} width={w - 28} height={h - 28} fill="none" stroke="#7a5c2e" strokeOpacity="0.4" strokeWidth="3" />
      <rect x={24} y={24} width={w - 48} height={h - 48} fill="none" stroke="#7a5c2e" strokeOpacity="0.25" strokeWidth="1" />
      {/* rosa dos ventos */}
      <g transform={`translate(${w - 130} ${h - 130})`} stroke="#7a5c2e" strokeOpacity="0.55" fill="none">
        <circle r="64" />
        <circle r="48" strokeDasharray="2 6" />
        <path d="M0 -78 L10 0 L0 78 L-10 0 Z" fill="#7a5c2e" fillOpacity="0.25" />
        <path d="M-78 0 L0 10 L78 0 L0 -10 Z" fill="#7a5c2e" fillOpacity="0.15" />
        <text y="-86" textAnchor="middle" fontSize="16" fill="#7a5c2e" stroke="none" style={{ fontFamily: 'Georgia, serif', fontWeight: 700 }}>
          N
        </text>
      </g>
    </svg>
  );
}

// ============================================================================
// Camadas e ligações com o mundo
// ============================================================================

function LayersPanel({ map, onChange, onDelete, onClose }: { map: MapData; onChange: (l: MapLayer[]) => void; onDelete: (id: string) => void; onClose: () => void }) {
  const count = (id: string) => map.markers.filter((m) => m.layer === id).length + map.routes.filter((m) => m.layer === id).length + map.regions.filter((m) => m.layer === id).length;
  const loose = map.markers.filter((m) => !m.layer).length + map.routes.filter((m) => !m.layer).length + map.regions.filter((m) => !m.layer).length;
  return (
    <div className="nb-map-layers" data-pz-stop>
      <div className="flex items-center justify-between mb-1">
        <p className="nb-world-kicker">Camadas</p>
        <button type="button" aria-label="Fechar camadas" onClick={onClose} className="p-1 rounded text-[var(--nb-ink-3)] hover:text-[var(--nb-ink)]">
          <X className="w-3.5 h-3.5" />
        </button>
      </div>
      <ul>
        {map.layers.map((l) => (
          <li key={l.id} className="group">
            <button
              type="button"
              aria-label={l.visible ? `Ocultar ${l.name}` : `Mostrar ${l.name}`}
              aria-pressed={!l.visible}
              onClick={() => onChange(map.layers.map((x) => (x.id === l.id ? { ...x, visible: !x.visible } : x)))}
              className="nb-map-layer-eye"
            >
              {l.visible ? <Eye /> : <EyeOff />}
            </button>
            <input
              value={l.name}
              onChange={(e) => onChange(map.layers.map((x) => (x.id === l.id ? { ...x, name: e.target.value.slice(0, 40) } : x)))}
              aria-label="Nome da camada"
              className={!l.visible ? 'opacity-50' : ''}
            />
            <span className="nb-world-count">{count(l.id)}</span>
            <button type="button" aria-label={`Apagar camada ${l.name}`} onClick={() => onDelete(l.id)} className="nb-map-layer-del">
              <Trash2 />
            </button>
          </li>
        ))}
        <li className="text-[var(--nb-ink-3)]">
          <span className="nb-map-layer-eye opacity-40">
            <Eye />
          </span>
          <span className="flex-1 text-[12px]">Sem camada (sempre visível)</span>
          <span className="nb-world-count">{loose}</span>
        </li>
      </ul>
      <div className="flex flex-wrap gap-x-3 gap-y-1 mt-2">
        <button type="button" onClick={() => onChange([...map.layers, { id: uid(), name: 'Nova camada', visible: true }])} className="text-[12px] font-semibold text-[var(--nb-ink-2)] hover:text-[var(--nb-ink)]">
          + Camada
        </button>
        {!map.layers.length && (
          <button type="button" onClick={() => onChange(SUGGESTED_LAYERS.map((name) => ({ id: uid(), name, visible: true })))} className="text-[12px] text-[var(--nb-ink-3)] hover:text-[var(--nb-ink)]">
            Usar sugeridas ({SUGGESTED_LAYERS.join(', ')})
          </button>
        )}
      </div>
    </div>
  );
}

function LayerSelect({ value, layers, onChange }: { value: string | null; layers: MapLayer[]; onChange: (id: string | null) => void }) {
  if (!layers.length) return null;
  return (
    <label className="flex items-center justify-between gap-2 text-[12px] text-[var(--nb-ink-3)]">
      Camada
      <select value={value || ''} onChange={(e) => onChange(e.target.value || null)} className="nb-world-select flex-1 max-w-[180px]">
        <option value="">sem camada</option>
        {layers.map((l) => (
          <option key={l.id} value={l.id}>
            {l.name}
          </option>
        ))}
      </select>
    </label>
  );
}

function WorldLinks({
  layer,
  layers,
  onLayer,
  submapId,
  maps,
  onSubmap,
  onNewSubmap,
  onEnter,
  canVerbete,
  onVerbete,
}: {
  layer: string | null;
  layers: MapLayer[];
  onLayer: (id: string | null) => void;
  submapId: string | null;
  maps: NotebookItem[];
  onSubmap: (id: string | null) => void;
  onNewSubmap: () => void;
  onEnter: (id: string) => void;
  canVerbete: boolean;
  onVerbete: () => void;
}) {
  return (
    <div className="mt-3 pt-3 border-t border-[var(--nb-line)] space-y-2.5">
      {canVerbete && (
        <button type="button" onClick={onVerbete} className="flex items-center gap-1.5 text-[12px] font-semibold text-[var(--nb-ink-2)] hover:text-[var(--nb-ink)]">
          <Plus className="w-3 h-3" /> Criar verbete no Codex com este nome
        </button>
      )}
      <LayerSelect value={layer} layers={layers} onChange={onLayer} />
      <label className="flex items-center justify-between gap-2 text-[12px] text-[var(--nb-ink-3)]">
        Mapa detalhado
        <select value={submapId || ''} onChange={(e) => onSubmap(e.target.value || null)} className="nb-world-select flex-1 max-w-[180px]">
          <option value="">nenhum</option>
          {maps.map((m) => (
            <option key={m.id} value={m.id}>
              {m.title}
            </option>
          ))}
        </select>
      </label>
      {submapId ? (
        <button type="button" onClick={() => onEnter(submapId)} className="flex items-center gap-1.5 text-[12px] font-semibold text-[var(--nb-ink)] hover:underline">
          <CornerDownRight className="w-3.5 h-3.5" /> Entrar no mapa detalhado
        </button>
      ) : (
        <button type="button" onClick={onNewSubmap} className="flex items-center gap-1.5 text-[12px] text-[var(--nb-ink-3)] hover:text-[var(--nb-ink)]">
          <Plus className="w-3 h-3" /> Criar mapa detalhado deste lugar
        </button>
      )}
    </div>
  );
}
