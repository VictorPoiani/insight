'use client';

import { ask as confirmDialog } from '@/lib/ui/feedback';
import { notify } from '@/lib/ui/feedback';
import { kickModeration } from '@/components/moderation/ModerationHost';
import { WritingDesk } from './WritingDesk';
import { DietPlanner } from './DietPlanner';
import { usePanZoom, PanZoomControls, boundsFromPercent } from '@/components/canvas/PanZoom';
import { useState, useRef, useEffect, useMemo } from 'react';
import { createClient } from '@/lib/supabase/client';
import { uploadCompressedMediaToR2 } from '@/lib/mediaCompressor';
import {
  TopicTemplateType,
  TopicWorkspaceData,
  PostBlock,
  GoalItem,
  HabitItem,
  TaskItem,
  DietMealItem,
  AgendaEventItem,
  RoadmapStepItem,
  MindMapNodeItem,
  MindMapNodeType,
  MindMapEdgeItem,
} from '@/types/database';
import {
  Target,
  Activity,
  CheckCircle2,
  Compass,
  Network,
  Apple,
  Calendar,
  Table2,
  Plus,
  Trash2,
  Check,
  X,
  Link2,
  ImagePlus,
  Droplets,
  MapPin,
  Clock,
  Move,
  Code2,
  CheckSquare,
  FileText,
  BoxSelect,
  ZoomIn,
  ZoomOut,
  Maximize2,
  Minimize2,
  PanelLeftClose,
  RotateCcw,
  Copy,
  Kanban,
  List,
  Search,
  Download,
  ArrowRight,
  ArrowLeft,
  Feather,
} from 'lucide-react';
import { NOTEBOOK_NAME } from '@/lib/notebook/copy';

interface TopicWorkspaceViewProps {
  topicId: string;
  topicColor: string;
  templateType: TopicTemplateType;
  initialData: TopicWorkspaceData;
  descriptionBlocks?: PostBlock[] | null;
  isAdmin: boolean;
  onWorkspaceUpdated?: (nextData: TopicWorkspaceData) => void;
  /** Salva em outro lugar (ex.: My Notebook) em vez de custom_topics. */
  persistOverride?: (nextData: TopicWorkspaceData) => Promise<void> | void;
  /** Notebook: o mapa mental ocupa toda a área, com controles flutuantes no topo */
  studio?: boolean;
  /** conteúdo no início da barra flutuante (título do mapa) */
  studioLead?: React.ReactNode;
}

const NODE_COLORS = [
  '#2563eb',
  '#10b981',
  '#a855f7',
  '#f59e0b',
  '#E63946',
  '#38bdf8',
  '#71717a',
];

const CARD_WIDTH_PRESETS = [
  { label: 'P', px: 210 },
  { label: 'M', px: 270 },
  { label: 'G', px: 350 },
  { label: 'XL', px: 460 },
];

const AGENDA_CATEGORIES = ['Académico', 'Engenharia', 'Reunião', 'Pessoal'];

const VIRTUAL_BOARD_WIDTH = 1800;
const VIRTUAL_BOARD_HEIGHT = 1150;

export function TopicWorkspaceView({
  topicId,
  topicColor,
  templateType,
  initialData,
  descriptionBlocks,
  isAdmin,
  onWorkspaceUpdated,
  persistOverride,
  studio = false,
  studioLead,
}: TopicWorkspaceViewProps) {
  const studioMap = studio && templateType === 'mindmap';
  const [data, setData] = useState<TopicWorkspaceData>(initialData || {});
  const [savingStatus, setSavingStatus] = useState<'idle' | 'saving' | 'saved'>('idle');

  // Controlos Globais de Página Inteira e Modo Foco
  const [isFullScreen, setIsFullScreen] = useState<boolean>(false);
  const [sidebarsCollapsed, setSidebarsCollapsed] = useState<boolean>(false);
  const [showWorkspaceNotes, setShowWorkspaceNotes] = useState<boolean>(false);

  // Estados do Estúdio de Brainstorm 2D
  const boardRef = useRef<HTMLDivElement>(null);
  const [draggingNodeId, setDraggingNodeId] = useState<string | null>(null);
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);
  const [connectingFromId, setConnectingFromId] = useState<string | null>(null);
  const [selectedEdgeId, setSelectedEdgeId] = useState<string | null>(null);
  const [uploadingNodeMediaId, setUploadingNodeMediaId] = useState<string | null>(null);
  const boardBounds = useMemo(
    () => boundsFromPercent(initialData?.mindMapNodes || [], VIRTUAL_BOARD_WIDTH, VIRTUAL_BOARD_HEIGHT, 200, 140),
    // enquadra pelo conteúdo inicial; depois o usuário controla a câmera
    // eslint-disable-next-line react-hooks/exhaustive-deps
    []
  );
  const pz = usePanZoom({ worldWidth: VIRTUAL_BOARD_WIDTH, worldHeight: VIRTUAL_BOARD_HEIGHT, wheel: 'free', initialBounds: boardBounds });

  // Estados de Visualização e Filtros dos Demais Modelos
  const [roadmapViewMode, setRoadmapViewMode] = useState<'kanban' | 'timeline'>('kanban');
  const [tasksViewMode, setTasksViewMode] = useState<'table' | 'kanban'>('table');
  const [taskStatusFilter, setTaskStatusFilter] = useState<'all' | TaskItem['status']>('all');
  const [taskSearch, setTaskSearch] = useState<string>('');
  const [goalPriorityFilter, setGoalPriorityFilter] = useState<'all' | GoalItem['priority']>('all');
  const [agendaCategoryFilter, setAgendaCategoryFilter] = useState<string>('all');
  const [dbSearch, setDbSearch] = useState<string>('');

  const supabase = createClient();

  useEffect(() => {
    setData(initialData || {});
  }, [initialData, topicId]);

  async function persistWorkspace(nextData: TopicWorkspaceData) {
    setData(nextData);
    onWorkspaceUpdated?.(nextData);
    if (!isAdmin) return;

    setSavingStatus('saving');

    if (persistOverride) {
      await persistOverride(nextData);
      setSavingStatus('saved');
      setTimeout(() => setSavingStatus('idle'), 1800);
      return;
    }

    const updatedBlocks = Array.isArray(descriptionBlocks)
      ? descriptionBlocks.map((b, idx) =>
          idx === 0
            ? {
                ...b,
                _topicMeta: {
                  ...((b as any)._topicMeta || {}),
                  template_type: templateType,
                  workspace_data: nextData,
                },
              }
            : b
        )
      : [];

    const { error } = await supabase
      .from('custom_topics')
      .update({
        workspace_data: nextData,
        description_blocks: updatedBlocks,
      })
      .eq('id', topicId);

    if (error) {
      await supabase
        .from('custom_topics')
        .update({ description_blocks: updatedBlocks })
        .eq('id', topicId);
    }

    setSavingStatus('saved');
    setTimeout(() => setSavingStatus('idle'), 1800);
    // texto novo no tópico passa pela moderação (pós-moderação: continua no ar)
    kickModeration();
  }

  function toggleFocusSidebars() {
    const next = !sidebarsCollapsed;
    setSidebarsCollapsed(next);
    window.dispatchEvent(
      new CustomEvent('insight-toggle-focus-mode', {
        detail: { collapse: next },
      })
    );
  }

  // Arraste livre 2D dos cartões no Brainstorm
  useEffect(() => {
    if (!draggingNodeId || !isAdmin) return;

    function handleMouseMove(e: PointerEvent) {
      if (!boardRef.current || !draggingNodeId) return;
      const rect = boardRef.current.getBoundingClientRect();
      const relX = ((e.clientX - rect.left) / rect.width) * 100;
      const relY = ((e.clientY - rect.top) / rect.height) * 100;

      const clampedX = Math.max(4, Math.min(96, Math.round(relX * 10) / 10));
      const clampedY = Math.max(5, Math.min(95, Math.round(relY * 10) / 10));

      setData((prev) => ({
        ...prev,
        mindMapNodes: (prev.mindMapNodes || []).map((n) =>
          n.id === draggingNodeId ? { ...n, x: clampedX, y: clampedY } : n
        ),
      }));
    }

    function handleMouseUp() {
      setDraggingNodeId(null);
      setData((latest) => {
        persistWorkspace(latest);
        return latest;
      });
    }

    window.addEventListener('pointermove', handleMouseMove);
    window.addEventListener('pointerup', handleMouseUp);
    return () => {
      window.removeEventListener('pointermove', handleMouseMove);
      window.removeEventListener('pointerup', handleMouseUp);
    };
  }, [draggingNodeId, isAdmin]);


  function addBrainstormCard(nodeType: MindMapNodeType) {
    if (!isAdmin) return;
    const current = data.mindMapNodes || [];
    const uid = `${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
    const nextColor = NODE_COLORS[current.length % NODE_COLORS.length];

    const defaultsByType: Record<MindMapNodeType, Partial<MindMapNodeItem>> = {
      concept: {
        label: 'Novo Conceito',
        note: 'Especificação técnica ou módulo...',
        width: 240,
      },
      code: {
        label: 'Snippet / Algoritmo',
        codeLang: 'TypeScript',
        codeSnippet: 'export function execute() {\n  return true;\n}',
        width: 320,
      },
      checklist: {
        label: 'Checklist de Entregas',
        width: 270,
        checklist: [
          { id: `chk-${uid}-1`, text: 'Definir contrato de dados', done: true },
          { id: `chk-${uid}-2`, text: 'Implementar integração', done: false },
        ],
      },
      note: {
        label: 'Nota de Arquitetura',
        note: 'Documente decisões de projeto, requisitos não-funcionais ou observações deste módulo.',
        width: 320,
      },
      media: {
        label: 'Referência Visual / R2',
        note: 'Anexe diagramas, imagens ou vídeos.',
        width: 280,
      },
      zone: {
        label: 'ZONA / SUBSISTEMA',
        note: 'Agrupamento visual de componentes',
        width: 480,
        height: 300,
      },
    };

    const newNode: MindMapNodeItem = {
      id: `node-${uid}`,
      nodeType,
      label: defaultsByType[nodeType].label || 'Novo Item',
      note: defaultsByType[nodeType].note || '',
      width: defaultsByType[nodeType].width || 240,
      height: defaultsByType[nodeType].height,
      codeLang: defaultsByType[nodeType].codeLang,
      codeSnippet: defaultsByType[nodeType].codeSnippet,
      checklist: defaultsByType[nodeType].checklist,
      x: Math.min(82, 26 + ((current.length * 11) % 48)),
      y: Math.min(82, 24 + ((current.length * 13) % 50)),
      color: nextColor,
      icon: String(current.length).padStart(2, '0'),
    };

    const nextEdges = [...(data.mindMapEdges || [])];
    if (selectedNodeId && nodeType !== 'zone') {
      nextEdges.push({
        id: `edge-${uid}`,
        fromId: selectedNodeId,
        toId: newNode.id,
      });
    }

    persistWorkspace({
      ...data,
      mindMapNodes: [...current, newNode],
      mindMapEdges: nextEdges,
    });
    setSelectedNodeId(newNode.id);
  }

  function duplicateSelectedNode() {
    if (!selectedNodeId || !isAdmin) return;
    const orig = (data.mindMapNodes || []).find((n) => n.id === selectedNodeId);
    if (!orig) return;

    const copy: MindMapNodeItem = {
      ...JSON.parse(JSON.stringify(orig)),
      id: `node-${Date.now()}`,
      x: Math.min(92, orig.x + 6),
      y: Math.min(90, orig.y + 6),
      label: `${orig.label} (Cópia)`,
    };

    persistWorkspace({
      ...data,
      mindMapNodes: [...(data.mindMapNodes || []), copy],
    });
    setSelectedNodeId(copy.id);
  }

  async function handleUploadMediaToR2(
    e: React.ChangeEvent<HTMLInputElement>,
    targetType: 'mindmap_node' | 'roadmap_step',
    targetId: string
  ) {
    const file = e.target.files?.[0];
    if (!file || !isAdmin) return;

    setUploadingNodeMediaId(targetId);
    try {
      let publicUrl = '';
      let r2Key: string | null = null;

      if (file.type.startsWith('video/') || file.type === 'image/gif') {
        const res = await uploadCompressedMediaToR2(
          file,
          'admin',
          file.type === 'image/gif'
        );
        publicUrl = res.publicUrl;
        r2Key = res.r2Key;
      } else {
        const presignRes = await fetch('/api/upload/r2', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            fileName: file.name,
            contentType: file.type || 'image/jpeg',
            originalSize: file.size,
            compressedSize: file.size,
            isGif: false,
          }),
        });
        const presignData = await presignRes.json();
        if (presignRes.ok && presignData.uploadUrl) {
          await fetch(presignData.uploadUrl, {
            method: 'PUT',
            headers: { 'Content-Type': file.type || 'image/jpeg' },
            body: file,
          });
          publicUrl = presignData.publicUrl;
          r2Key = presignData.r2Key;
        }
      }

      if (publicUrl) {
        if (targetType === 'mindmap_node') {
          const nextNodes = (data.mindMapNodes || []).map((n) =>
            n.id === targetId ? { ...n, mediaUrl: publicUrl, r2Key } : n
          );
          await persistWorkspace({ ...data, mindMapNodes: nextNodes });
        } else {
          const nextSteps = (data.roadmapSteps || []).map((s) =>
            s.id === targetId ? { ...s, mediaUrl: publicUrl } : s
          );
          await persistWorkspace({ ...data, roadmapSteps: nextSteps });
        }
      }
    } catch (err: any) {
      notify(err?.message || 'Erro ao enviar mídia para Cloudflare R2');
    } finally {
      setUploadingNodeMediaId(null);
    }
  }

  function exportCustomTableToCsv() {
    const rows = data.customTable || [];
    if (rows.length === 0) return;
    const csvContent = rows
      .map((r) =>
        r.map((cell) => `"${String(cell || '').replace(/"/g, '""')}"`).join(',')
      )
      .join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `insight-dados-${topicId.slice(0, 6)}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  }

  // Cálculos de Métricas dos Workspaces
  const goalsStats = useMemo(() => {
    const list = data.goals || [];
    const total = list.length;
    const avg =
      total > 0
        ? Math.round(list.reduce((acc, g) => acc + (Number(g.progress) || 0), 0) / total)
        : 0;
    const completed = list.filter((g) => Number(g.progress) >= 100).length;
    const highPriority = list.filter((g) => g.priority === 'high').length;
    return { total, avg, completed, highPriority };
  }, [data.goals]);

  const habitsStats = useMemo(() => {
    const list = data.habits || [];
    const totalSlots = Math.max(list.length * 7, 1);
    const totalChecked = list.reduce(
      (acc, h) => acc + (Array.isArray(h.checks) ? h.checks.filter(Boolean).length : 0),
      0
    );
    const rate = list.length > 0 ? Math.round((totalChecked / totalSlots) * 100) : 0;
    return { count: list.length, totalChecked, totalSlots: list.length * 7, rate };
  }, [data.habits]);

  const tasksStats = useMemo(() => {
    const list = data.tasks || [];
    const total = list.length;
    const done = list.filter((t) => t.status === 'done').length;
    const inProgress = list.filter((t) => t.status === 'in_progress').length;
    const pct = total > 0 ? Math.round((done / total) * 100) : 0;
    return { total, done, inProgress, pct };
  }, [data.tasks]);

  const roadmapStats = useMemo(() => {
    const list = data.roadmapSteps || [];
    const total = list.length;
    const completed = list.filter((s) => s.status === 'completed').length;
    const inProgress = list.filter((s) => s.status === 'in_progress').length;
    const pct = total > 0 ? Math.round((completed / total) * 100) : 0;
    return { total, completed, inProgress, pct };
  }, [data.roadmapSteps]);

  if (templateType === 'blank_page') return null;

  const selectedNodeObj = (data.mindMapNodes || []).find(
    (n) => n.id === selectedNodeId
  );
  const selectedEdgeObj = (data.mindMapEdges || []).find(
    (ed) => ed.id === selectedEdgeId
  );

  return (
    <div
      className={
        studioMap
          ? 'absolute inset-0 flex flex-col'
          : isFullScreen
          ? 'fixed inset-0 z-50 bg-background flex flex-col p-4 sm:p-6 overflow-y-auto'
          : 'mx-4 sm:mx-6 mb-10 p-4 sm:p-6 rounded-2xl bg-surface border border-border flex flex-col gap-5 min-h-[76vh]'
      }
    >
      {/* CABEÇALHO UNIVERSAL DO WORKSPACE */}
      <div className={`flex flex-wrap items-center justify-between gap-2 border-b border-border pb-3.5 shrink-0 ${studioMap ? 'hidden' : ''}`}>
        <div className="flex items-center gap-2">
          {templateType === 'goals' && <Target className="w-4 h-4 text-accent" />}
          {templateType === 'habits' && <Activity className="w-4 h-4 text-[#10b981]" />}
          {templateType === 'tasks' && <CheckCircle2 className="w-4 h-4 text-[#10b981]" />}
          {templateType === 'roadmap' && <Compass className="w-4 h-4 text-[#38bdf8]" />}
          {templateType === 'mindmap' && <Network className="w-4 h-4 text-[#a855f7]" />}
          {templateType === 'diet' && <Apple className="w-4 h-4 text-[#f59e0b]" />}
          {templateType === 'writing' && <Feather className="w-4 h-4 text-amber-600" />}
          {templateType === 'agenda' && <Calendar className="w-4 h-4 text-[#E63946]" />}
          {templateType === 'blank_db' && <Table2 className="w-4 h-4 text-accent" />}

          <span className="text-xs font-bold text-primary uppercase tracking-wider">
            {templateType === 'goals' && 'Sistema de Metas & OKRs'}
            {templateType === 'habits' && 'Matriz de Hábitos & Consistência'}
            {templateType === 'tasks' && 'Gestão de Tarefas & Execução'}
            {templateType === 'roadmap' && 'Roadmap de Arquitetura & Entregas'}
            {templateType === 'mindmap' && 'Estúdio 2D · Arquitetura & Brainstorm'}
            {templateType === 'diet' && 'Plano Nutricional & Macronutrientes'}
            {templateType === 'writing' && `Poemas & Livros · ${NOTEBOOK_NAME}`}
            {templateType === 'agenda' && 'Agenda Técnica & Cronograma'}
            {templateType === 'blank_db' && 'Base de Dados Estruturada'}
          </span>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {isAdmin && (
            <span className="text-[10px] font-mono text-muted mr-1">
              {savingStatus === 'saving'
                ? 'A guardar no Supabase...'
                : savingStatus === 'saved'
                ? 'Sincronizado'
                : 'Supabase + R2'}
            </span>
          )}

          <button
            type="button"
            onClick={() => setShowWorkspaceNotes(!showWorkspaceNotes)}
            className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg border text-[11px] font-semibold transition-colors ${
              showWorkspaceNotes || Boolean(data.workspaceNotes?.trim())
                ? 'bg-elevated border-accent/60 text-primary'
                : 'bg-elevated border-border text-secondary hover:text-primary'
            }`}
          >
            <FileText className="w-3.5 h-3.5 text-accent" />
            <span>Documentação</span>
          </button>

          {!isFullScreen && (
            <button
              type="button"
              onClick={toggleFocusSidebars}
              title="Recolher ou expandir barras laterais"
              className={`hidden md:inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg border text-[11px] font-semibold transition-colors ${
                sidebarsCollapsed
                  ? 'bg-accent/15 border-accent text-accent'
                  : 'bg-elevated border-border text-secondary hover:text-primary'
              }`}
            >
              <PanelLeftClose className="w-3.5 h-3.5" />
              <span>{sidebarsCollapsed ? 'Mostrar Laterais' : 'Modo Foco'}</span>
            </button>
          )}

          <button
            type="button"
            onClick={() => setIsFullScreen(!isFullScreen)}
            className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-elevated border border-border hover:border-accent text-[11px] font-semibold text-primary transition-colors"
          >
            {isFullScreen ? (
              <>
                <Minimize2 className="w-3.5 h-3.5 text-accent" />
                <span>Reduzir</span>
              </>
            ) : (
              <>
                <Maximize2 className="w-3.5 h-3.5 text-accent" />
                <span>Tela Cheia</span>
              </>
            )}
          </button>
        </div>
      </div>

      {/* =====================================================================
          1. ESTÚDIO DE BRAINSTORM & ARQUITETURA 2D (MINDMAP)
         ===================================================================== */}
      {templateType === 'mindmap' && (
        <div className={studioMap ? 'relative flex-1 min-h-0' : 'flex-1 flex flex-col gap-3 min-h-0'}>
          {isAdmin && (
            <div
              data-pz-stop
              className={
                studioMap
                  ? 'nb-studio-bar absolute top-3 left-1/2 -translate-x-1/2 z-30 w-max max-w-[calc(100%-24px)] flex flex-wrap items-center justify-center gap-1.5 p-1.5 rounded-2xl bg-[#141417]/85 backdrop-blur-md border border-zinc-800 shadow-2xl text-xs'
                  : 'flex flex-wrap items-center justify-between gap-2 p-2.5 rounded-xl bg-elevated border border-border text-xs shrink-0'
              }
            >
              {studioMap && studioLead}
              <div className="flex flex-wrap items-center gap-1.5">
                <span className="text-[10px] font-mono uppercase text-muted px-1.5">
                  Inserir:
                </span>

                <button
                  type="button"
                  onClick={() => addBrainstormCard('concept')}
                  className="px-2.5 py-1.5 rounded-lg bg-accent text-white font-semibold flex items-center gap-1.5 hover:bg-accent-hover transition-colors"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>Conceito</span>
                </button>

                <button
                  type="button"
                  onClick={() => addBrainstormCard('code')}
                  className="px-2.5 py-1.5 rounded-lg bg-surface border border-border hover:border-accent text-primary font-medium flex items-center gap-1.5 transition-colors"
                >
                  <Code2 className="w-3.5 h-3.5 text-[#38bdf8]" />
                  <span>Código</span>
                </button>

                <button
                  type="button"
                  onClick={() => addBrainstormCard('checklist')}
                  className="px-2.5 py-1.5 rounded-lg bg-surface border border-border hover:border-accent text-primary font-medium flex items-center gap-1.5 transition-colors"
                >
                  <CheckSquare className="w-3.5 h-3.5 text-[#10b981]" />
                  <span>Checklist</span>
                </button>

                <button
                  type="button"
                  onClick={() => addBrainstormCard('note')}
                  className="px-2.5 py-1.5 rounded-lg bg-surface border border-border hover:border-accent text-primary font-medium flex items-center gap-1.5 transition-colors"
                >
                  <FileText className="w-3.5 h-3.5 text-[#f59e0b]" />
                  <span>Nota</span>
                </button>

                <button
                  type="button"
                  onClick={() => addBrainstormCard('media')}
                  className="px-2.5 py-1.5 rounded-lg bg-surface border border-border hover:border-accent text-primary font-medium flex items-center gap-1.5 transition-colors"
                >
                  <ImagePlus className="w-3.5 h-3.5 text-[#a855f7]" />
                  <span>Mídia R2</span>
                </button>

                <button
                  type="button"
                  onClick={() => addBrainstormCard('zone')}
                  className="px-2.5 py-1.5 rounded-lg bg-surface border border-border hover:border-accent text-secondary hover:text-primary font-medium flex items-center gap-1.5 transition-colors"
                >
                  <BoxSelect className="w-3.5 h-3.5" />
                  <span>Zona / Grupo</span>
                </button>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                {selectedNodeObj && (
                  <>
                    <div className="h-4 w-px bg-border hidden sm:block" />

                    <div className="flex items-center gap-0.5 bg-surface p-0.5 rounded-lg border border-border">
                      {CARD_WIDTH_PRESETS.map((preset) => (
                        <button
                          key={preset.label}
                          type="button"
                          onClick={() => {
                            const next = (data.mindMapNodes || []).map((n) =>
                              n.id === selectedNodeObj.id
                                ? { ...n, width: preset.px }
                                : n
                            );
                            persistWorkspace({ ...data, mindMapNodes: next });
                          }}
                          className={`px-2 py-0.5 rounded text-[10px] font-mono font-bold transition-colors ${
                            (selectedNodeObj.width || 240) === preset.px
                              ? 'bg-accent text-white'
                              : 'text-secondary hover:text-primary'
                          }`}
                        >
                          {preset.label}
                        </button>
                      ))}
                    </div>

                    <div className="flex items-center gap-1 bg-surface px-2 py-1 rounded-lg border border-border">
                      {NODE_COLORS.map((c) => (
                        <button
                          key={c}
                          type="button"
                          onClick={() => {
                            const next = (data.mindMapNodes || []).map((n) =>
                              n.id === selectedNodeObj.id ? { ...n, color: c } : n
                            );
                            persistWorkspace({ ...data, mindMapNodes: next });
                          }}
                          style={{ backgroundColor: c }}
                          className={`w-3.5 h-3.5 rounded-full border ${
                            selectedNodeObj.color === c
                              ? 'border-white scale-110'
                              : 'border-transparent opacity-70 hover:opacity-100'
                          }`}
                        />
                      ))}
                    </div>

                    <button
                      type="button"
                      onClick={() =>
                        setConnectingFromId(
                          connectingFromId === selectedNodeObj.id
                            ? null
                            : selectedNodeObj.id
                        )
                      }
                      className={`px-2.5 py-1 rounded-lg border text-[11px] font-semibold flex items-center gap-1 transition-colors ${
                        connectingFromId
                          ? 'bg-zinc-100 text-zinc-900 border-white'
                          : 'bg-surface border-border text-secondary hover:text-primary'
                      }`}
                    >
                      <Link2 className="w-3.5 h-3.5" />
                      <span>
                        {connectingFromId ? 'Clique no destino...' : 'Conectar'}
                      </span>
                    </button>

                    <button
                      type="button"
                      onClick={duplicateSelectedNode}
                      title="Duplicar cartão selecionado"
                      className="p-1.5 rounded-lg bg-surface border border-border text-secondary hover:text-primary"
                    >
                      <Copy className="w-3.5 h-3.5" />
                    </button>
                  </>
                )}

                {selectedEdgeObj && (
                  <div className="flex items-center gap-1.5 bg-surface px-2.5 py-1 rounded-lg border border-accent">
                    <span className="text-[10px] font-mono text-muted">Conexão:</span>
                    <input
                      type="text"
                      value={selectedEdgeObj.label || ''}
                      placeholder="Rótulo da seta..."
                      onChange={(e) => {
                        const nextEdges = (data.mindMapEdges || []).map((ed) =>
                          ed.id === selectedEdgeObj.id
                            ? { ...ed, label: e.target.value }
                            : ed
                        );
                        persistWorkspace({ ...data, mindMapEdges: nextEdges });
                      }}
                      className="w-28 bg-transparent text-xs text-primary focus:outline-none"
                    />
                    <button
                      type="button"
                      onClick={() => {
                        const nextEdges = (data.mindMapEdges || []).filter(
                          (ed) => ed.id !== selectedEdgeObj.id
                        );
                        persistWorkspace({ ...data, mindMapEdges: nextEdges });
                        setSelectedEdgeId(null);
                      }}
                      className="text-muted hover:text-danger p-0.5"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                )}
              </div>
            </div>
          )}

          <div
            {...pz.viewportProps}
            onPointerDownCapture={(e) => {
              const t = e.target as HTMLElement;
              if (t === e.currentTarget || t.dataset.canvasBg === 'true') {
                setSelectedNodeId(null);
                setSelectedEdgeId(null);
                setConnectingFromId(null);
              }
            }}
            style={{
              touchAction: 'none',
              backgroundImage: 'radial-gradient(rgba(161, 161, 170, 0.16) 1px, transparent 1px)',
              backgroundSize: `${22 * pz.view.k}px ${22 * pz.view.k}px`,
              backgroundPosition: `${pz.view.x}px ${pz.view.y}px`,
            }}
            className={`${
              studioMap
                ? 'absolute inset-0 bg-[#09090b]'
                : `relative w-full rounded-2xl bg-[#09090b] border border-border ${isFullScreen ? 'flex-1 min-h-[520px]' : 'h-[72vh] min-h-[560px]'}`
            } overflow-hidden select-none outline-none ${pz.panning ? 'cursor-grabbing' : 'cursor-grab'}`}
          >
            <div
              ref={boardRef}
              data-canvas-bg="true"
              style={pz.worldStyle}
              className="relative"
            >
              {/* ZONAS DE FUNDO */}
              {(data.mindMapNodes || [])
                .filter((n) => n.nodeType === 'zone')
                .map((zone) => {
                  const isSelected = selectedNodeId === zone.id;
                  return (
                    <div
                      key={zone.id}
                      onClick={(e) => {
                        e.stopPropagation();
                        setSelectedNodeId(zone.id);
                        setSelectedEdgeId(null);
                      }}
                      style={{
                        left: `${zone.x}%`,
                        top: `${zone.y}%`,
                        width: `${zone.width || 480}px`,
                        height: `${zone.height || 300}px`,
                        transform: 'translate(-50%, -50%)',
                        borderColor: isSelected ? '#ffffff' : `${zone.color}66`,
                        backgroundColor: `${zone.color}08`,
                      }}
                      className="absolute z-0 rounded-2xl border-2 border-dashed p-3 flex flex-col justify-between transition-colors"
                    >
                      <div
                        style={{ touchAction: 'none' }}
                        onPointerDown={(e) => {
                          if (!isAdmin) return;
                          e.stopPropagation();
                          setSelectedNodeId(zone.id);
                          setDraggingNodeId(zone.id);
                        }}
                        className="flex items-center justify-between gap-2 cursor-grab active:cursor-grabbing"
                      >
                        <input
                          type="text"
                          disabled={!isAdmin}
                          value={zone.label}
                          onChange={(e) => {
                            const next = (data.mindMapNodes || []).map((n) =>
                              n.id === zone.id
                                ? { ...n, label: e.target.value }
                                : n
                            );
                            persistWorkspace({ ...data, mindMapNodes: next });
                          }}
                          style={{ color: zone.color }}
                          className="bg-transparent font-mono text-xs font-extrabold uppercase tracking-wider focus:outline-none"
                        />

                        {isAdmin && (
                          <div className="flex items-center gap-1">
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                const nextH =
                                  (zone.height || 300) >= 460
                                    ? 240
                                    : (zone.height || 300) + 80;
                                const next = (data.mindMapNodes || []).map((n) =>
                                  n.id === zone.id ? { ...n, height: nextH } : n
                                );
                                persistWorkspace({ ...data, mindMapNodes: next });
                              }}
                              className="px-1.5 py-0.5 rounded bg-zinc-900/80 border border-zinc-800 text-[9px] font-mono text-zinc-400 hover:text-white"
                            >
                              Altura
                            </button>
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                persistWorkspace({
                                  ...data,
                                  mindMapNodes: (data.mindMapNodes || []).filter(
                                    (n) => n.id !== zone.id
                                  ),
                                });
                              }}
                              className="p-1 text-zinc-500 hover:text-danger"
                            >
                              <X className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        )}
                      </div>

                      <input
                        type="text"
                        disabled={!isAdmin}
                        value={zone.note || ''}
                        placeholder="Descrição da zona..."
                        onChange={(e) => {
                          const next = (data.mindMapNodes || []).map((n) =>
                            n.id === zone.id ? { ...n, note: e.target.value } : n
                          );
                          persistWorkspace({ ...data, mindMapNodes: next });
                        }}
                        className="bg-transparent text-[10px] font-mono text-zinc-500 focus:outline-none"
                      />
                    </div>
                  );
                })}

              {/* CONEXÕES BÉZIER (SVG) */}
              <svg className="absolute inset-0 w-full h-full pointer-events-none z-10">
                {(data.mindMapEdges || []).map((edge) => {
                  const fromNode = (data.mindMapNodes || []).find(
                    (n) => n.id === edge.fromId
                  );
                  const toNode = (data.mindMapNodes || []).find(
                    (n) => n.id === edge.toId
                  );
                  if (!fromNode || !toNode) return null;

                  const x1 = (fromNode.x / 100) * VIRTUAL_BOARD_WIDTH;
                  const y1 = (fromNode.y / 100) * VIRTUAL_BOARD_HEIGHT;
                  const x2 = (toNode.x / 100) * VIRTUAL_BOARD_WIDTH;
                  const y2 = (toNode.y / 100) * VIRTUAL_BOARD_HEIGHT;

                  const midX = (x1 + x2) / 2;
                  const midY = (y1 + y2) / 2;
                  const pathData = `M ${x1} ${y1} Q ${midX} ${y1}, ${midX} ${midY} T ${x2} ${y2}`;
                  const isEdgeSelected = selectedEdgeId === edge.id;

                  return (
                    <g key={edge.id} className="pointer-events-auto cursor-pointer">
                      <path
                        d={pathData}
                        fill="none"
                        stroke="transparent"
                        strokeWidth="14"
                        onClick={(e) => {
                          e.stopPropagation();
                          setSelectedEdgeId(edge.id);
                          setSelectedNodeId(null);
                        }}
                      />
                      <path
                        d={pathData}
                        fill="none"
                        stroke={
                          isEdgeSelected
                            ? '#ffffff'
                            : fromNode.color || '#52525b'
                        }
                        strokeWidth={isEdgeSelected ? '2.5' : '1.75'}
                        strokeDasharray={isEdgeSelected ? undefined : '5 4'}
                        opacity={isEdgeSelected ? '1' : '0.75'}
                        onClick={(e) => {
                          e.stopPropagation();
                          setSelectedEdgeId(edge.id);
                          setSelectedNodeId(null);
                        }}
                      />
                      {edge.label && (
                        <g
                          transform={`translate(${midX}, ${midY})`}
                          onClick={(e) => {
                            e.stopPropagation();
                            setSelectedEdgeId(edge.id);
                            setSelectedNodeId(null);
                          }}
                        >
                          <rect
                            x="-42"
                            y="-10"
                            width="84"
                            height="20"
                            rx="5"
                            fill="#121215"
                            stroke="#27272a"
                          />
                          <text
                            textAnchor="middle"
                            dy="3"
                            fill="#a1a1aa"
                            fontSize="9"
                            fontFamily="monospace"
                          >
                            {edge.label}
                          </text>
                        </g>
                      )}
                    </g>
                  );
                })}
              </svg>

              {/* CARTÕES INTERATIVOS DO BRAINSTORM */}
              {(data.mindMapNodes || [])
                .filter((n) => n.nodeType !== 'zone')
                .map((node, nodeIdx) => {
                  const isSelected = selectedNodeId === node.id;
                  const nType: MindMapNodeType = node.nodeType || 'concept';
                  const codeTag = String(nodeIdx).padStart(2, '0');

                  const typeLabelMap: Record<MindMapNodeType, string> = {
                    concept: `NÓ · ${codeTag}`,
                    code: `CÓDIGO · ${node.codeLang || 'TS'}`,
                    checklist: `CHECKLIST · ${codeTag}`,
                    note: `DOC · ${codeTag}`,
                    media: `MÍDIA R2 · ${codeTag}`,
                    zone: 'ZONA',
                  };

                  return (
                    <div
                      key={node.id}
                      onClick={(e) => {
                        e.stopPropagation();
                        setSelectedEdgeId(null);
                        if (connectingFromId && connectingFromId !== node.id) {
                          const exists = (data.mindMapEdges || []).some(
                            (ed) =>
                              (ed.fromId === connectingFromId &&
                                ed.toId === node.id) ||
                              (ed.fromId === node.id &&
                                ed.toId === connectingFromId)
                          );
                          if (!exists) {
                            const nextEdges: MindMapEdgeItem[] = [
                              ...(data.mindMapEdges || []),
                              {
                                id: `edge-${Date.now()}`,
                                fromId: connectingFromId,
                                toId: node.id,
                              },
                            ];
                            persistWorkspace({ ...data, mindMapEdges: nextEdges });
                          }
                          setConnectingFromId(null);
                          setSelectedNodeId(node.id);
                          return;
                        }
                        setSelectedNodeId(node.id);
                      }}
                      style={{
                        left: `${node.x}%`,
                        top: `${node.y}%`,
                        width: `${node.width || 240}px`,
                        transform: 'translate(-50%, -50%)',
                        borderColor: isSelected ? '#ffffff' : '#27272a',
                      }}
                      data-pz-stop
                      className={`absolute z-20 p-3.5 rounded-xl bg-[#121215]/95 backdrop-blur border shadow-2xl transition-shadow ${
                        isSelected ? 'ring-2 ring-accent/40' : ''
                      }`}
                    >
                      <div
                        style={{ touchAction: 'none' }}
                        onPointerDown={(e) => {
                          if (!isAdmin) return;
                          e.stopPropagation();
                          setSelectedNodeId(node.id);
                          setDraggingNodeId(node.id);
                        }}
                        className={`flex items-center justify-between gap-1 pb-2 mb-2 border-b border-zinc-800/90 ${
                          isAdmin ? 'cursor-grab active:cursor-grabbing' : ''
                        }`}
                      >
                        <div className="flex items-center gap-1.5">
                          <span
                            style={{ backgroundColor: node.color }}
                            className="w-2 h-2 rounded-full shrink-0"
                          />
                          <span className="text-[9px] font-mono font-semibold uppercase tracking-wider text-zinc-400">
                            {typeLabelMap[nType]}
                          </span>
                        </div>

                        {isAdmin && (
                          <div className="flex items-center gap-1">
                            <label
                              title="Anexar mídia da Cloudflare R2"
                              className="p-0.5 text-zinc-400 hover:text-accent cursor-pointer"
                            >
                              <ImagePlus className="w-3 h-3" />
                              <input
                                type="file"
                                accept="image/*,video/mp4,video/webm"
                                onChange={(e) =>
                                  handleUploadMediaToR2(
                                    e,
                                    'mindmap_node',
                                    node.id
                                  )
                                }
                                className="hidden"
                              />
                            </label>

                            {(data.mindMapNodes?.length || 0) > 1 && (
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  const nextNodes = (
                                    data.mindMapNodes || []
                                  ).filter((n) => n.id !== node.id);
                                  const nextEdges = (
                                    data.mindMapEdges || []
                                  ).filter(
                                    (ed) =>
                                      ed.fromId !== node.id &&
                                      ed.toId !== node.id
                                  );
                                  persistWorkspace({
                                    ...data,
                                    mindMapNodes: nextNodes,
                                    mindMapEdges: nextEdges,
                                  });
                                }}
                                className="p-0.5 text-zinc-500 hover:text-danger"
                              >
                                <X className="w-3 h-3" />
                              </button>
                            )}
                          </div>
                        )}
                      </div>

                      <input
                        type="text"
                        disabled={!isAdmin}
                        value={node.label}
                        onChange={(e) => {
                          const next = (data.mindMapNodes || []).map((n) =>
                            n.id === node.id
                              ? { ...n, label: e.target.value }
                              : n
                          );
                          persistWorkspace({ ...data, mindMapNodes: next });
                        }}
                        className="w-full bg-transparent text-xs font-bold text-zinc-100 focus:outline-none"
                      />

                      {nType === 'code' ? (
                        <div className="mt-2 space-y-1.5">
                          <textarea
                            rows={5}
                            disabled={!isAdmin}
                            value={node.codeSnippet || ''}
                            placeholder="// Escreva o código aqui..."
                            onChange={(e) => {
                              const next = (data.mindMapNodes || []).map((n) =>
                                n.id === node.id
                                  ? { ...n, codeSnippet: e.target.value }
                                  : n
                              );
                              persistWorkspace({ ...data, mindMapNodes: next });
                            }}
                            className="w-full p-2.5 rounded-lg bg-[#09090b] border border-zinc-800 font-mono text-[11px] text-emerald-400 resize-y focus:outline-none leading-relaxed"
                          />
                        </div>
                      ) : nType === 'checklist' ? (
                        <div className="mt-2 space-y-1.5">
                          {(node.checklist || []).map((item, cIdx) => (
                            <div
                              key={item.id}
                              className="flex items-center gap-2 text-[11px]"
                            >
                              <button
                                type="button"
                                disabled={!isAdmin}
                                onClick={() => {
                                  const nextList = [...(node.checklist || [])];
                                  nextList[cIdx] = {
                                    ...item,
                                    done: !item.done,
                                  };
                                  const nextNodes = (
                                    data.mindMapNodes || []
                                  ).map((n) =>
                                    n.id === node.id
                                      ? { ...n, checklist: nextList }
                                      : n
                                  );
                                  persistWorkspace({
                                    ...data,
                                    mindMapNodes: nextNodes,
                                  });
                                }}
                                className={`w-3.5 h-3.5 rounded border flex items-center justify-center shrink-0 ${
                                  item.done
                                    ? 'bg-emerald-500 border-emerald-500 text-white'
                                    : 'border-zinc-700 bg-zinc-900'
                                }`}
                              >
                                {item.done && <Check className="w-2.5 h-2.5" />}
                              </button>
                              <input
                                type="text"
                                disabled={!isAdmin}
                                value={item.text}
                                onChange={(e) => {
                                  const nextList = [...(node.checklist || [])];
                                  nextList[cIdx] = {
                                    ...item,
                                    text: e.target.value,
                                  };
                                  const nextNodes = (
                                    data.mindMapNodes || []
                                  ).map((n) =>
                                    n.id === node.id
                                      ? { ...n, checklist: nextList }
                                      : n
                                  );
                                  persistWorkspace({
                                    ...data,
                                    mindMapNodes: nextNodes,
                                  });
                                }}
                                className={`flex-1 bg-transparent focus:outline-none ${
                                  item.done
                                    ? 'line-through text-zinc-500'
                                    : 'text-zinc-200'
                                }`}
                              />
                              {isAdmin && (
                                <button
                                  type="button"
                                  onClick={() => {
                                    const nextList = (
                                      node.checklist || []
                                    ).filter((_, i) => i !== cIdx);
                                    const nextNodes = (
                                      data.mindMapNodes || []
                                    ).map((n) =>
                                      n.id === node.id
                                        ? { ...n, checklist: nextList }
                                        : n
                                    );
                                    persistWorkspace({
                                      ...data,
                                      mindMapNodes: nextNodes,
                                    });
                                  }}
                                  className="text-zinc-600 hover:text-danger"
                                >
                                  <X className="w-3 h-3" />
                                </button>
                              )}
                            </div>
                          ))}

                          {isAdmin && (
                            <button
                              type="button"
                              onClick={() => {
                                const nextList = [
                                  ...(node.checklist || []),
                                  {
                                    id: `chk-${Date.now()}`,
                                    text: 'Novo item',
                                    done: false,
                                  },
                                ];
                                const nextNodes = (
                                  data.mindMapNodes || []
                                ).map((n) =>
                                  n.id === node.id
                                    ? { ...n, checklist: nextList }
                                    : n
                                );
                                persistWorkspace({
                                  ...data,
                                  mindMapNodes: nextNodes,
                                });
                              }}
                              className="text-[10px] font-semibold text-accent hover:underline flex items-center gap-1 pt-1"
                            >
                              <Plus className="w-3 h-3" /> Item
                            </button>
                          )}
                        </div>
                      ) : (
                        <textarea
                          rows={nType === 'note' ? 5 : 2}
                          disabled={!isAdmin}
                          value={node.note || ''}
                          placeholder="Especificação..."
                          onChange={(e) => {
                            const next = (data.mindMapNodes || []).map((n) =>
                              n.id === node.id
                                ? { ...n, note: e.target.value }
                                : n
                            );
                            persistWorkspace({ ...data, mindMapNodes: next });
                          }}
                          className="w-full bg-transparent text-[11px] text-zinc-400 resize-y focus:outline-none mt-1.5 leading-relaxed"
                        />
                      )}

                      {node.mediaUrl ? (
                        <div className="mt-2 relative rounded-lg overflow-hidden border border-zinc-800 bg-black">
                          {/\.(mp4|webm|mov)(\?|$)/i.test(node.mediaUrl) ? (
                            <video
                              src={`${node.mediaUrl}#t=0.001`}
                              controls
                              playsInline
                              className="w-full max-h-40 object-contain"
                            />
                          ) : (
                            <img
                              src={node.mediaUrl}
                              alt={node.label}
                              className="w-full max-h-40 object-cover"
                            />
                          )}
                          {isAdmin && (
                            <button
                              type="button"
                              onClick={() => {
                                const next = (data.mindMapNodes || []).map(
                                  (n) =>
                                    n.id === node.id
                                      ? { ...n, mediaUrl: null, r2Key: null }
                                      : n
                                );
                                persistWorkspace({
                                  ...data,
                                  mindMapNodes: next,
                                });
                              }}
                              className="absolute top-1.5 right-1.5 p-1 rounded-full bg-black/75 text-white hover:bg-danger"
                            >
                              <X className="w-3 h-3" />
                            </button>
                          )}
                        </div>
                      ) : (
                        nType === 'media' &&
                        isAdmin && (
                          <label className="mt-2 flex flex-col items-center justify-center py-4 px-2 rounded-lg border border-dashed border-zinc-700 hover:border-accent cursor-pointer text-center">
                            <ImagePlus className="w-4 h-4 text-accent mb-1" />
                            <span className="text-[10px] text-zinc-400">
                              {uploadingNodeMediaId === node.id
                                ? 'A carregar para R2...'
                                : 'Selecionar imagem ou vídeo'}
                            </span>
                            <input
                              type="file"
                              accept="image/*,video/mp4,video/webm"
                              onChange={(e) =>
                                handleUploadMediaToR2(
                                  e,
                                  'mindmap_node',
                                  node.id
                                )
                              }
                              className="hidden"
                            />
                          </label>
                        )
                      )}
                    </div>
                  );
                })}
            </div>

            <PanZoomControls
              k={pz.view.k}
              onZoomIn={pz.zoomIn}
              onZoomOut={pz.zoomOut}
              onFit={() => pz.fit(boundsFromPercent(data.mindMapNodes || [], VIRTUAL_BOARD_WIDTH, VIRTUAL_BOARD_HEIGHT, 200, 140))}
              className="absolute bottom-3.5 right-3.5 z-30"
            />
          </div>
        </div>
      )}

      {/* =====================================================================
          2. PROJETOS & ROADMAPS (KANBAN + LINHA DO TEMPO + SUBTAREFAS)
         ===================================================================== */}
      {templateType === 'roadmap' && (
        <div className="flex-1 flex flex-col gap-5">
          {/* Painel de Métricas do Roadmap */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div className="p-3.5 rounded-xl bg-elevated border border-border">
              <span className="text-[10px] font-mono uppercase text-muted">
                Total de Marcos
              </span>
              <p className="text-xl font-bold font-mono text-primary mt-1">
                {roadmapStats.total}
              </p>
            </div>
            <div className="p-3.5 rounded-xl bg-elevated border border-border">
              <span className="text-[10px] font-mono uppercase text-muted">
                Em Execução
              </span>
              <p className="text-xl font-bold font-mono text-[#38bdf8] mt-1">
                {roadmapStats.inProgress}
              </p>
            </div>
            <div className="p-3.5 rounded-xl bg-elevated border border-border">
              <span className="text-[10px] font-mono uppercase text-muted">
                Concluídos
              </span>
              <p className="text-xl font-bold font-mono text-[#10b981] mt-1">
                {roadmapStats.completed}
              </p>
            </div>
            <div className="p-3.5 rounded-xl bg-elevated border border-border space-y-1.5">
              <div className="flex items-center justify-between text-[10px] font-mono">
                <span className="uppercase text-muted">Progresso Global</span>
                <span className="font-bold text-primary">{roadmapStats.pct}%</span>
              </div>
              <div className="w-full h-2 rounded-full bg-surface overflow-hidden border border-border">
                <div
                  style={{ width: `${roadmapStats.pct}%` }}
                  className="h-full bg-[#10b981] transition-all duration-300"
                />
              </div>
            </div>
          </div>

          {/* Barra de Alternância: Kanban vs Linha do Tempo */}
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center bg-elevated p-1 rounded-xl border border-border text-xs">
              <button
                type="button"
                onClick={() => setRoadmapViewMode('kanban')}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg font-semibold transition-colors ${
                  roadmapViewMode === 'kanban'
                    ? 'bg-accent text-white'
                    : 'text-secondary hover:text-primary'
                }`}
              >
                <Kanban className="w-3.5 h-3.5" />
                <span>Quadro Kanban</span>
              </button>
              <button
                type="button"
                onClick={() => setRoadmapViewMode('timeline')}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg font-semibold transition-colors ${
                  roadmapViewMode === 'timeline'
                    ? 'bg-accent text-white'
                    : 'text-secondary hover:text-primary'
                }`}
              >
                <List className="w-3.5 h-3.5" />
                <span>Linha do Tempo</span>
              </button>
            </div>

            {isAdmin && (
              <button
                type="button"
                onClick={() => {
                  const curr = data.roadmapSteps || [];
                  const next: RoadmapStepItem[] = [
                    ...curr,
                    {
                      id: `step-${Date.now()}`,
                      phase: `Fase 0${curr.length + 1}`,
                      title: 'Novo marco de arquitetura',
                      description: 'Especificar requisitos e entregáveis...',
                      status: 'planned',
                      dateLabel: new Date().toISOString().slice(0, 10),
                      checklist: [],
                    },
                  ];
                  persistWorkspace({ ...data, roadmapSteps: next });
                }}
                className="px-3.5 py-1.5 rounded-xl bg-accent text-white text-xs font-semibold flex items-center gap-1.5 hover:bg-accent-hover"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Novo Marco</span>
              </button>
            )}
          </div>

          {roadmapViewMode === 'kanban' ? (
            /* VISÃO QUADRO KANBAN (3 COLUNAS DE STATUS) */
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 flex-1">
              {(
                [
                  { key: 'planned', title: 'Planeado', dot: '#71717a' },
                  { key: 'in_progress', title: 'Em andamento', dot: '#38bdf8' },
                  { key: 'completed', title: 'Concluído', dot: '#10b981' },
                ] as const
              ).map((col) => {
                const colSteps = (data.roadmapSteps || []).filter(
                  (s) => s.status === col.key
                );

                return (
                  <div
                    key={col.key}
                    className="p-3.5 rounded-2xl bg-elevated/50 border border-border flex flex-col gap-3 min-h-[380px]"
                  >
                    <div className="flex items-center justify-between border-b border-border pb-2.5">
                      <div className="flex items-center gap-2">
                        <span
                          style={{ backgroundColor: col.dot }}
                          className="w-2 h-2 rounded-full"
                        />
                        <span className="text-xs font-bold text-primary uppercase tracking-wider">
                          {col.title}
                        </span>
                      </div>
                      <span className="px-2 py-0.5 rounded bg-surface border border-border font-mono text-[10px] text-muted">
                        {colSteps.length}
                      </span>
                    </div>

                    <div className="space-y-3 flex-1">
                      {colSteps.map((step) => (
                        <div
                          key={step.id}
                          className="p-3.5 rounded-xl bg-surface border border-border space-y-2.5 shadow-sm"
                        >
                          <div className="flex items-center justify-between gap-2">
                            <input
                              type="text"
                              disabled={!isAdmin}
                              value={step.phase}
                              onChange={(e) => {
                                const next = (data.roadmapSteps || []).map((s) =>
                                  s.id === step.id
                                    ? { ...s, phase: e.target.value }
                                    : s
                                );
                                persistWorkspace({ ...data, roadmapSteps: next });
                              }}
                              className="w-28 bg-transparent font-mono text-[10px] font-bold uppercase text-accent focus:outline-none"
                            />
                            <input
                              type="text"
                              disabled={!isAdmin}
                              value={step.dateLabel || ''}
                              placeholder="Prazo / Versão"
                              onChange={(e) => {
                                const next = (data.roadmapSteps || []).map((s) =>
                                  s.id === step.id
                                    ? { ...s, dateLabel: e.target.value }
                                    : s
                                );
                                persistWorkspace({ ...data, roadmapSteps: next });
                              }}
                              className="w-24 text-right bg-transparent font-mono text-[10px] text-muted focus:outline-none"
                            />
                          </div>

                          <input
                            type="text"
                            disabled={!isAdmin}
                            value={step.title}
                            onChange={(e) => {
                              const next = (data.roadmapSteps || []).map((s) =>
                                s.id === step.id
                                  ? { ...s, title: e.target.value }
                                  : s
                              );
                              persistWorkspace({ ...data, roadmapSteps: next });
                            }}
                            className="w-full bg-transparent text-xs sm:text-sm font-bold text-primary focus:outline-none"
                          />

                          <textarea
                            rows={2}
                            disabled={!isAdmin}
                            value={step.description}
                            onChange={(e) => {
                              const next = (data.roadmapSteps || []).map((s) =>
                                s.id === step.id
                                  ? { ...s, description: e.target.value }
                                  : s
                              );
                              persistWorkspace({ ...data, roadmapSteps: next });
                            }}
                            className="w-full bg-transparent text-xs text-secondary resize-y focus:outline-none leading-relaxed"
                          />

                          {/* Checklist interna do Marco */}
                          {Array.isArray(step.checklist) && step.checklist.length > 0 && (
                            <div className="pt-1.5 border-t border-border/60 space-y-1">
                              {step.checklist.map((chk, cIdx) => (
                                <div
                                  key={chk.id}
                                  className="flex items-center gap-2 text-[11px]"
                                >
                                  <button
                                    type="button"
                                    disabled={!isAdmin}
                                    onClick={() => {
                                      const nextChk = [...(step.checklist || [])];
                                      nextChk[cIdx] = { ...chk, done: !chk.done };
                                      const next = (data.roadmapSteps || []).map(
                                        (s) =>
                                          s.id === step.id
                                            ? { ...s, checklist: nextChk }
                                            : s
                                      );
                                      persistWorkspace({
                                        ...data,
                                        roadmapSteps: next as typeof data.roadmapSteps,
                                      });
                                    }}
                                    className={`w-3.5 h-3.5 rounded border flex items-center justify-center shrink-0 ${
                                      chk.done
                                        ? 'bg-emerald-500 border-emerald-500 text-white'
                                        : 'border-border bg-elevated'
                                    }`}
                                  >
                                    {chk.done && <Check className="w-2.5 h-2.5" />}
                                  </button>
                                  <input
                                    type="text"
                                    disabled={!isAdmin}
                                    value={chk.text}
                                    onChange={(e) => {
                                      const nextChk = [...(step.checklist || [])];
                                      nextChk[cIdx] = {
                                        ...chk,
                                        text: e.target.value,
                                      };
                                      const next = (data.roadmapSteps || []).map(
                                        (s) =>
                                          s.id === step.id
                                            ? { ...s, checklist: nextChk }
                                            : s
                                      );
                                      persistWorkspace({
                                        ...data,
                                        roadmapSteps: next as typeof data.roadmapSteps,
                                      });
                                    }}
                                    className={`flex-1 bg-transparent focus:outline-none ${
                                      chk.done
                                        ? 'line-through text-muted'
                                        : 'text-primary'
                                    }`}
                                  />
                                </div>
                              ))}
                            </div>
                          )}

                          {step.mediaUrl && (
                            <div className="relative rounded-lg overflow-hidden border border-border bg-black">
                              {/\.(mp4|webm|mov)(\?|$)/i.test(step.mediaUrl) ? (
                                <video
                                  src={`${step.mediaUrl}#t=0.001`}
                                  controls
                                  playsInline
                                  className="w-full max-h-36 object-contain"
                                />
                              ) : (
                                <img
                                  src={step.mediaUrl}
                                  alt={step.title}
                                  className="w-full max-h-36 object-cover"
                                />
                              )}
                            </div>
                          )}

                          {isAdmin && (
                            <div className="flex items-center justify-between pt-2 border-t border-border/60 text-[10px]">
                              <div className="flex items-center gap-2">
                                <button
                                  type="button"
                                  onClick={() => {
                                    const nextChk = [
                                      ...(step.checklist || []),
                                      {
                                        id: `chk-${Date.now()}`,
                                        text: 'Subtarefa',
                                        done: false,
                                      },
                                    ];
                                    const next = (data.roadmapSteps || []).map(
                                      (s) =>
                                        s.id === step.id
                                          ? { ...s, checklist: nextChk }
                                          : s
                                    );
                                    persistWorkspace({
                                      ...data,
                                      roadmapSteps: next as typeof data.roadmapSteps,
                                    });
                                  }}
                                  className="text-secondary hover:text-primary font-semibold"
                                >
                                  + Subtarefa
                                </button>

                                <label className="text-accent hover:underline cursor-pointer flex items-center gap-1 font-medium">
                                  <ImagePlus className="w-3 h-3" />
                                  <span>R2</span>
                                  <input
                                    type="file"
                                    accept="image/*,video/mp4,video/webm"
                                    onChange={(e) =>
                                      handleUploadMediaToR2(
                                        e,
                                        'roadmap_step',
                                        step.id
                                      )
                                    }
                                    className="hidden"
                                  />
                                </label>
                              </div>

                              <div className="flex items-center gap-1">
                                {col.key !== 'planned' && (
                                  <button
                                    type="button"
                                    title="Mover para coluna anterior"
                                    onClick={() => {
                                      const prevStatus =
                                        col.key === 'completed'
                                          ? 'in_progress'
                                          : 'planned';
                                      const next = (data.roadmapSteps || []).map(
                                        (s) =>
                                          s.id === step.id
                                            ? { ...s, status: prevStatus }
                                            : s
                                      );
                                      persistWorkspace({
                                        ...data,
                                        roadmapSteps: next as typeof data.roadmapSteps,
                                      });
                                    }}
                                    className="p-1 rounded bg-elevated hover:text-primary text-muted"
                                  >
                                    <ArrowLeft className="w-3 h-3" />
                                  </button>
                                )}
                                {col.key !== 'completed' && (
                                  <button
                                    type="button"
                                    title="Avançar fase"
                                    onClick={() => {
                                      const nextStatus =
                                        col.key === 'planned'
                                          ? 'in_progress'
                                          : 'completed';
                                      const next = (data.roadmapSteps || []).map(
                                        (s) =>
                                          s.id === step.id
                                            ? { ...s, status: nextStatus }
                                            : s
                                      );
                                      persistWorkspace({
                                        ...data,
                                        roadmapSteps: next as typeof data.roadmapSteps,
                                      });
                                    }}
                                    className="p-1 rounded bg-elevated hover:text-accent text-muted"
                                  >
                                    <ArrowRight className="w-3 h-3" />
                                  </button>
                                )}
                                <button
                                  type="button"
                                  onClick={() => {
                                    const next = (
                                      data.roadmapSteps || []
                                    ).filter((s) => s.id !== step.id);
                                    persistWorkspace({
                                      ...data,
                                      roadmapSteps: next as typeof data.roadmapSteps,
                                    });
                                  }}
                                  className="p-1 text-muted hover:text-danger"
                                >
                                  <Trash2 className="w-3 h-3" />
                                </button>
                              </div>
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            /* VISÃO LINHA DO TEMPO SEQUENCIAL */
            <div className="relative pl-6 border-l-2 border-border space-y-5 py-2">
              {(data.roadmapSteps || []).map((step, idx) => (
                <div
                  key={step.id}
                  className="relative p-4 rounded-2xl bg-elevated border border-border space-y-2"
                >
                  <span
                    style={{
                      backgroundColor:
                        step.status === 'completed'
                          ? '#10b981'
                          : step.status === 'in_progress'
                          ? '#38bdf8'
                          : '#52525b',
                    }}
                    className="absolute -left-[33px] top-5 w-4 h-4 rounded-full border-4 border-background"
                  />
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <span className="font-mono text-xs font-bold uppercase text-accent">
                      {String(idx + 1).padStart(2, '0')} · {step.phase}
                    </span>
                    <span className="font-mono text-[11px] text-muted">
                      {step.dateLabel || 'Sem data definida'}
                    </span>
                  </div>
                  <h4 className="text-sm font-bold text-primary">{step.title}</h4>
                  <p className="text-xs text-secondary leading-relaxed">
                    {step.description}
                  </p>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* =====================================================================
          3. CONTROLE DE METAS & OKRs (GOALS)
         ===================================================================== */}
      {templateType === 'goals' && (
        <div className="flex-1 flex flex-col gap-5">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div className="p-3.5 rounded-xl bg-elevated border border-border">
              <span className="text-[10px] font-mono uppercase text-muted">
                Progresso Médio Global
              </span>
              <p className="text-xl font-bold font-mono text-emerald-400 mt-1">
                {goalsStats.avg}%
              </p>
            </div>
            <div className="p-3.5 rounded-xl bg-elevated border border-border">
              <span className="text-[10px] font-mono uppercase text-muted">
                Metas Concluídas (100%)
              </span>
              <p className="text-xl font-bold font-mono text-primary mt-1">
                {goalsStats.completed} / {goalsStats.total}
              </p>
            </div>
            <div className="p-3.5 rounded-xl bg-elevated border border-border">
              <span className="text-[10px] font-mono uppercase text-muted">
                Prioridade Alta
              </span>
              <p className="text-xl font-bold font-mono text-rose-400 mt-1">
                {goalsStats.highPriority}
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-1.5 text-xs">
              {(
                [
                  { id: 'all', label: 'Todas' },
                  { id: 'high', label: 'Alta' },
                  { id: 'medium', label: 'Média' },
                  { id: 'low', label: 'Baixa' },
                ] as const
              ).map((f) => (
                <button
                  key={f.id}
                  type="button"
                  onClick={() => setGoalPriorityFilter(f.id)}
                  className={`px-2.5 py-1 rounded-lg border text-[11px] font-semibold transition-colors ${
                    goalPriorityFilter === f.id
                      ? 'bg-accent text-white border-accent'
                      : 'bg-elevated border-border text-secondary hover:text-primary'
                  }`}
                >
                  {f.label}
                </button>
              ))}
            </div>

            {isAdmin && (
              <button
                type="button"
                onClick={() => {
                  const next: GoalItem[] = [
                    ...(data.goals || []),
                    {
                      id: `goal-${Date.now()}`,
                      title: 'Novo objetivo estratégico',
                      targetValue: '100% concluído',
                      priority: 'high',
                      progress: 0,
                    },
                  ];
                  persistWorkspace({ ...data, goals: next });
                }}
                className="px-3.5 py-1.5 rounded-xl bg-accent text-white text-xs font-semibold flex items-center gap-1.5"
              >
                <Plus className="w-3.5 h-3.5" /> Nova Meta
              </button>
            )}
          </div>

          <div className="overflow-x-auto rounded-xl border border-border bg-elevated/30">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="border-b border-border bg-elevated text-[11px] text-muted">
                  <th className="py-3 px-4 font-medium">Objetivo</th>
                  <th className="py-3 px-3 font-medium">Indicador / Meta Final</th>
                  <th className="py-3 px-3 font-medium">Prioridade</th>
                  <th className="py-3 px-4 font-medium w-64">Progresso</th>
                  {isAdmin && <th className="py-3 px-3 w-10" />}
                </tr>
              </thead>
              <tbody className="divide-y divide-border/60">
                {(data.goals || [])
                  .filter(
                    (g) =>
                      goalPriorityFilter === 'all' ||
                      g.priority === goalPriorityFilter
                  )
                  .map((goal) => {
                    const priorityStyles = {
                      high: 'bg-rose-500/15 text-rose-400 border-rose-500/30',
                      medium: 'bg-amber-500/15 text-amber-400 border-amber-500/30',
                      low: 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30',
                    };
                    const priorityLabels = {
                      high: 'Alta',
                      medium: 'Média',
                      low: 'Baixa',
                    };

                    return (
                      <tr key={goal.id} className="group hover:bg-elevated/40">
                        <td className="py-3 px-4">
                          <input
                            type="text"
                            disabled={!isAdmin}
                            value={goal.title}
                            onChange={(e) => {
                              const next = (data.goals || []).map((g) =>
                                g.id === goal.id
                                  ? { ...g, title: e.target.value }
                                  : g
                              );
                              persistWorkspace({ ...data, goals: next });
                            }}
                            className="w-full bg-transparent font-semibold text-primary focus:outline-none"
                          />
                        </td>
                        <td className="py-3 px-3">
                          <input
                            type="text"
                            disabled={!isAdmin}
                            value={goal.targetValue}
                            onChange={(e) => {
                              const next = (data.goals || []).map((g) =>
                                g.id === goal.id
                                  ? { ...g, targetValue: e.target.value }
                                  : g
                              );
                              persistWorkspace({ ...data, goals: next });
                            }}
                            className="w-full bg-transparent text-secondary font-mono text-[11px] focus:outline-none"
                          />
                        </td>
                        <td className="py-3 px-3">
                          <button
                            type="button"
                            disabled={!isAdmin}
                            onClick={() => {
                              const order: GoalItem['priority'][] = [
                                'high',
                                'medium',
                                'low',
                              ];
                              const nextP =
                                order[
                                  (order.indexOf(goal.priority) + 1) %
                                    order.length
                                ];
                              const next = (data.goals || []).map((g) =>
                                g.id === goal.id ? { ...g, priority: nextP } : g
                              );
                              persistWorkspace({ ...data, goals: next });
                            }}
                            className={`px-2.5 py-0.5 rounded border text-[10px] font-semibold ${
                              priorityStyles[goal.priority]
                            }`}
                          >
                            {priorityLabels[goal.priority]}
                          </button>
                        </td>
                        <td className="py-3 px-4">
                          <div className="flex items-center gap-2.5">
                            <input
                              type="range"
                              min={0}
                              max={100}
                              disabled={!isAdmin}
                              value={goal.progress}
                              onChange={(e) => {
                                const val = Number(e.target.value) || 0;
                                const next = (data.goals || []).map((g) =>
                                  g.id === goal.id ? { ...g, progress: val } : g
                                );
                                persistWorkspace({ ...data, goals: next });
                              }}
                              className="flex-1 accent-emerald-500 cursor-pointer"
                            />
                            <span className="w-10 text-right font-mono text-[11px] font-bold text-primary">
                              {goal.progress}%
                            </span>
                          </div>
                        </td>
                        {isAdmin && (
                          <td className="py-3 px-3 text-right">
                            <button
                              type="button"
                              onClick={() => {
                                const next = (data.goals || []).filter(
                                  (g) => g.id !== goal.id
                                );
                                persistWorkspace({ ...data, goals: next });
                              }}
                              className="text-muted hover:text-danger"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </td>
                        )}
                      </tr>
                    );
                  })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* =====================================================================
          4. MONITORAMENTO DE HÁBITOS (HABITS)
         ===================================================================== */}
      {templateType === 'habits' && (
        <div className="flex-1 flex flex-col gap-5">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div className="p-3.5 rounded-xl bg-elevated border border-border">
              <span className="text-[10px] font-mono uppercase text-muted">
                Taxa de Consistência Semanal
              </span>
              <p className="text-xl font-bold font-mono text-emerald-400 mt-1">
                {habitsStats.rate}%
              </p>
            </div>
            <div className="p-3.5 rounded-xl bg-elevated border border-border">
              <span className="text-[10px] font-mono uppercase text-muted">
                Check-ins Realizados
              </span>
              <p className="text-xl font-bold font-mono text-primary mt-1">
                {habitsStats.totalChecked} / {habitsStats.totalSlots}
              </p>
            </div>
            <div className="p-3.5 rounded-xl bg-elevated border border-border flex items-center justify-between">
              <div>
                <span className="text-[10px] font-mono uppercase text-muted block">
                  Hábitos Ativos
                </span>
                <p className="text-xl font-bold font-mono text-accent mt-1">
                  {habitsStats.count}
                </p>
              </div>
              {isAdmin && (
                <button
                  type="button"
                  onClick={async () => {
                    if (!(await confirmDialog({ message: 'Limpar marcações para iniciar uma nova semana?', danger: true })))
                      return;
                    const next = (data.habits || []).map((h) => ({
                      ...h,
                      checks: [false, false, false, false, false, false, false],
                    }));
                    persistWorkspace({ ...data, habits: next });
                  }}
                  className="px-2.5 py-1.5 rounded-lg bg-surface border border-border hover:border-accent text-[11px] font-semibold text-secondary hover:text-primary flex items-center gap-1"
                >
                  <RotateCcw className="w-3 h-3" />
                  <span>Nova Semana</span>
                </button>
              )}
            </div>
          </div>

          <div className="overflow-x-auto rounded-xl border border-border bg-elevated/30">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="border-b border-border bg-elevated text-[11px] text-muted">
                  <th className="py-3 px-4 font-medium">Hábito / Disciplina</th>
                  {(
                    data.habitColumns || [
                      'Seg',
                      'Ter',
                      'Qua',
                      'Qui',
                      'Sex',
                      'Sáb',
                      'Dom',
                    ]
                  ).map((day, dIdx) => (
                    <th key={dIdx} className="py-3 px-2.5 text-center font-mono">
                      {day}
                    </th>
                  ))}
                  <th className="py-3 px-4 text-right font-medium w-40">
                    Desempenho
                  </th>
                  {isAdmin && <th className="py-3 px-3 w-10" />}
                </tr>
              </thead>
              <tbody className="divide-y divide-border/60">
                {(data.habits || []).map((hab) => {
                  const checks = Array.isArray(hab.checks)
                    ? hab.checks
                    : [false, false, false, false, false, false, false];
                  const doneCount = checks.filter(Boolean).length;
                  const pct = Math.round((doneCount / 7) * 100);

                  return (
                    <tr key={hab.id} className="group hover:bg-elevated/40">
                      <td className="py-3 px-4">
                        <input
                          type="text"
                          disabled={!isAdmin}
                          value={hab.name}
                          onChange={(e) => {
                            const next = (data.habits || []).map((h) =>
                              h.id === hab.id
                                ? { ...h, name: e.target.value }
                                : h
                            );
                            persistWorkspace({ ...data, habits: next });
                          }}
                          className="w-full min-w-[140px] bg-transparent font-semibold text-primary focus:outline-none"
                        />
                      </td>
                      {[0, 1, 2, 3, 4, 5, 6].map((dayIdx) => {
                        const checked = Boolean(checks[dayIdx]);
                        return (
                          <td key={dayIdx} className="py-3 px-2.5 text-center">
                            <button
                              type="button"
                              disabled={!isAdmin}
                              onClick={() => {
                                const nextChecks = [...checks];
                                nextChecks[dayIdx] = !checked;
                                const next = (data.habits || []).map((h) =>
                                  h.id === hab.id
                                    ? { ...h, checks: nextChecks }
                                    : h
                                );
                                persistWorkspace({ ...data, habits: next });
                              }}
                              className={`w-5 h-5 mx-auto rounded-md border flex items-center justify-center transition-all ${
                                checked
                                  ? 'bg-accent border-accent text-white'
                                  : 'bg-surface border-border hover:border-accent/60'
                              }`}
                            >
                              {checked && <Check className="w-3.5 h-3.5" />}
                            </button>
                          </td>
                        );
                      })}
                      <td className="py-3 px-4">
                        <div className="flex items-center justify-end gap-2">
                          <div className="w-20 h-1.5 rounded-full bg-surface overflow-hidden">
                            <div
                              style={{ width: `${pct}%` }}
                              className="h-full bg-emerald-500 transition-all"
                            />
                          </div>
                          <span className="font-mono text-[10px] text-secondary w-14 text-right">
                            {doneCount}/7 ({pct}%)
                          </span>
                        </div>
                      </td>
                      {isAdmin && (
                        <td className="py-3 px-3 text-right">
                          <button
                            type="button"
                            onClick={() => {
                              const next = (data.habits || []).filter(
                                (h) => h.id !== hab.id
                              );
                              persistWorkspace({ ...data, habits: next });
                            }}
                            className="text-muted hover:text-danger"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </td>
                      )}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {isAdmin && (
            <div>
              <button
                type="button"
                onClick={() => {
                  const next: HabitItem[] = [
                    ...(data.habits || []),
                    {
                      id: `hab-${Date.now()}`,
                      name: 'Novo hábito',
                      checks: [false, false, false, false, false, false, false],
                    },
                  ];
                  persistWorkspace({ ...data, habits: next });
                }}
                className="px-3.5 py-1.5 rounded-xl bg-accent text-white text-xs font-semibold inline-flex items-center gap-1.5"
              >
                <Plus className="w-3.5 h-3.5" /> Adicionar Hábito
              </button>
            </div>
          )}
        </div>
      )}

      {/* =====================================================================
          5. CONTROLE DE TAREFAS (TABELA TÉCNICA + KANBAN)
         ===================================================================== */}
      {templateType === 'tasks' && (
        <div className="flex-1 flex flex-col gap-5">
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div className="p-3.5 rounded-xl bg-elevated border border-border">
              <span className="text-[10px] font-mono uppercase text-muted">
                Total
              </span>
              <p className="text-xl font-bold font-mono text-primary mt-1">
                {tasksStats.total}
              </p>
            </div>
            <div className="p-3.5 rounded-xl bg-elevated border border-border">
              <span className="text-[10px] font-mono uppercase text-muted">
                Em Andamento
              </span>
              <p className="text-xl font-bold font-mono text-[#38bdf8] mt-1">
                {tasksStats.inProgress}
              </p>
            </div>
            <div className="p-3.5 rounded-xl bg-elevated border border-border">
              <span className="text-[10px] font-mono uppercase text-muted">
                Concluídas
              </span>
              <p className="text-xl font-bold font-mono text-[#10b981] mt-1">
                {tasksStats.done}
              </p>
            </div>
            <div className="p-3.5 rounded-xl bg-elevated border border-border">
              <span className="text-[10px] font-mono uppercase text-muted">
                Taxa de Conclusão
              </span>
              <p className="text-xl font-bold font-mono text-emerald-400 mt-1">
                {tasksStats.pct}%
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex flex-wrap items-center gap-2">
              <div className="flex items-center bg-elevated p-1 rounded-xl border border-border text-xs">
                <button
                  type="button"
                  onClick={() => setTasksViewMode('table')}
                  className={`flex items-center gap-1 px-2.5 py-1 rounded-lg font-semibold ${
                    tasksViewMode === 'table'
                      ? 'bg-accent text-white'
                      : 'text-secondary hover:text-primary'
                  }`}
                >
                  <List className="w-3.5 h-3.5" />
                  <span>Tabela</span>
                </button>
                <button
                  type="button"
                  onClick={() => setTasksViewMode('kanban')}
                  className={`flex items-center gap-1 px-2.5 py-1 rounded-lg font-semibold ${
                    tasksViewMode === 'kanban'
                      ? 'bg-accent text-white'
                      : 'text-secondary hover:text-primary'
                  }`}
                >
                  <Kanban className="w-3.5 h-3.5" />
                  <span>Kanban</span>
                </button>
              </div>

              <div className="relative w-48">
                <Search className="w-3.5 h-3.5 text-muted absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  value={taskSearch}
                  onChange={(e) => setTaskSearch(e.target.value)}
                  placeholder="Filtrar tarefas..."
                  className="w-full bg-elevated border border-border rounded-xl pl-8 pr-3 py-1.5 text-xs text-primary focus:outline-none focus:border-accent"
                />
              </div>
            </div>

            {isAdmin && (
              <button
                type="button"
                onClick={() => {
                  const next: TaskItem[] = [
                    ...(data.tasks || []),
                    {
                      id: `tsk-${Date.now()}`,
                      title: 'Nova tarefa',
                      status: 'not_started',
                      assignee: 'Victor Poiani',
                      priority: 'medium',
                      dueDate: new Date().toISOString().slice(0, 10),
                    },
                  ];
                  persistWorkspace({ ...data, tasks: next });
                }}
                className="px-3.5 py-1.5 rounded-xl bg-accent text-white text-xs font-semibold flex items-center gap-1.5"
              >
                <Plus className="w-3.5 h-3.5" /> Nova Tarefa
              </button>
            )}
          </div>

          {tasksViewMode === 'table' ? (
            <div className="overflow-x-auto rounded-xl border border-border bg-elevated/30">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="border-b border-border bg-elevated text-[11px] text-muted">
                    <th className="py-3 px-4 font-medium">Nome da Tarefa</th>
                    <th className="py-3 px-3 font-medium">Status</th>
                    <th className="py-3 px-3 font-medium">Prioridade</th>
                    <th className="py-3 px-3 font-medium">Prazo</th>
                    <th className="py-3 px-3 font-medium">Responsável</th>
                    {isAdmin && <th className="py-3 px-3 w-10" />}
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/60">
                  {(data.tasks || [])
                    .filter(
                      (t) =>
                        (taskStatusFilter === 'all' ||
                          t.status === taskStatusFilter) &&
                        (!taskSearch.trim() ||
                          t.title
                            .toLowerCase()
                            .includes(taskSearch.toLowerCase()))
                    )
                    .map((task) => {
                      const statusMeta = {
                        not_started: {
                          label: 'Não iniciado',
                          dot: '#71717a',
                          cls: 'bg-zinc-500/15 text-zinc-300 border-zinc-500/30',
                        },
                        in_progress: {
                          label: 'Em andamento',
                          dot: '#38bdf8',
                          cls: 'bg-blue-500/15 text-blue-400 border-blue-500/30',
                        },
                        done: {
                          label: 'Concluído',
                          dot: '#10b981',
                          cls: 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30',
                        },
                      };
                      const prioMeta = {
                        high: 'Alta',
                        medium: 'Média',
                        low: 'Baixa',
                      };

                      return (
                        <tr key={task.id} className="group hover:bg-elevated/40">
                          <td className="py-3 px-4">
                            <input
                              type="text"
                              disabled={!isAdmin}
                              value={task.title}
                              onChange={(e) => {
                                const next = (data.tasks || []).map((t) =>
                                  t.id === task.id
                                    ? { ...t, title: e.target.value }
                                    : t
                                );
                                persistWorkspace({ ...data, tasks: next });
                              }}
                              className={`w-full bg-transparent font-semibold focus:outline-none ${
                                task.status === 'done'
                                  ? 'line-through text-muted'
                                  : 'text-primary'
                              }`}
                            />
                          </td>
                          <td className="py-3 px-3">
                            <button
                              type="button"
                              disabled={!isAdmin}
                              onClick={() => {
                                const order: TaskItem['status'][] = [
                                  'not_started',
                                  'in_progress',
                                  'done',
                                ];
                                const nextSt =
                                  order[
                                    (order.indexOf(task.status) + 1) %
                                      order.length
                                  ];
                                const next = (data.tasks || []).map((t) =>
                                  t.id === task.id ? { ...t, status: nextSt } : t
                                );
                                persistWorkspace({ ...data, tasks: next });
                              }}
                              className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full border text-[10px] font-semibold whitespace-nowrap ${
                                statusMeta[task.status].cls
                              }`}
                            >
                              <span
                                style={{
                                  backgroundColor: statusMeta[task.status].dot,
                                }}
                                className="w-1.5 h-1.5 rounded-full"
                              />
                              <span>{statusMeta[task.status].label}</span>
                            </button>
                          </td>
                          <td className="py-3 px-3">
                            <button
                              type="button"
                              disabled={!isAdmin}
                              onClick={() => {
                                const order: ('high' | 'medium' | 'low')[] = [
                                  'high',
                                  'medium',
                                  'low',
                                ];
                                const curr = task.priority || 'medium';
                                const nextP =
                                  order[(order.indexOf(curr) + 1) % order.length];
                                const next = (data.tasks || []).map((t) =>
                                  t.id === task.id ? { ...t, priority: nextP } : t
                                );
                                persistWorkspace({ ...data, tasks: next });
                              }}
                              className="px-2 py-0.5 rounded bg-surface border border-border font-mono text-[10px] text-secondary"
                            >
                              {prioMeta[task.priority || 'medium']}
                            </button>
                          </td>
                          <td className="py-3 px-3 font-mono text-[11px] text-muted">
                            <input
                              type="date"
                              disabled={!isAdmin}
                              value={task.dueDate || ''}
                              onChange={(e) => {
                                const next = (data.tasks || []).map((t) =>
                                  t.id === task.id
                                    ? { ...t, dueDate: e.target.value }
                                    : t
                                );
                                persistWorkspace({ ...data, tasks: next });
                              }}
                              className="bg-transparent focus:outline-none"
                            />
                          </td>
                          <td className="py-3 px-3">
                            <input
                              type="text"
                              disabled={!isAdmin}
                              value={task.assignee}
                              onChange={(e) => {
                                const next = (data.tasks || []).map((t) =>
                                  t.id === task.id
                                    ? { ...t, assignee: e.target.value }
                                    : t
                                );
                                persistWorkspace({ ...data, tasks: next });
                              }}
                              className="w-full bg-transparent text-secondary focus:outline-none"
                            />
                          </td>
                          {isAdmin && (
                            <td className="py-3 px-3 text-right">
                              <button
                                type="button"
                                onClick={() => {
                                  const next = (data.tasks || []).filter(
                                    (t) => t.id !== task.id
                                  );
                                  persistWorkspace({ ...data, tasks: next });
                                }}
                                className="text-muted hover:text-danger"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </td>
                          )}
                        </tr>
                      );
                    })}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {(
                [
                  { key: 'not_started', label: 'Não iniciado', dot: '#71717a' },
                  { key: 'in_progress', label: 'Em andamento', dot: '#38bdf8' },
                  { key: 'done', label: 'Concluído', dot: '#10b981' },
                ] as const
              ).map((col) => {
                const items = (data.tasks || []).filter(
                  (t) => t.status === col.key
                );
                return (
                  <div
                    key={col.key}
                    className="p-3.5 rounded-2xl bg-elevated/50 border border-border space-y-2.5"
                  >
                    <div className="flex items-center justify-between border-b border-border pb-2">
                      <span className="text-xs font-bold text-primary flex items-center gap-2">
                        <span
                          style={{ backgroundColor: col.dot }}
                          className="w-2 h-2 rounded-full"
                        />
                        {col.label}
                      </span>
                      <span className="font-mono text-[10px] text-muted">
                        {items.length}
                      </span>
                    </div>
                    {items.map((item) => (
                      <div
                        key={item.id}
                        className="p-3 rounded-xl bg-surface border border-border space-y-1.5"
                      >
                        <p className="text-xs font-semibold text-primary">
                          {item.title}
                        </p>
                        <div className="flex items-center justify-between text-[10px] font-mono text-muted">
                          <span>{item.assignee}</span>
                          <span>{item.dueDate || ''}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* =====================================================================
          6. PLANO NUTRICIONAL & MACRONUTRIENTES (DIET)
         ===================================================================== */}
      {templateType === 'diet' && <DietPlanner data={data} isAdmin={isAdmin} persist={persistWorkspace} />}
      {templateType === 'writing' && <WritingDesk data={data} isAdmin={isAdmin} persist={persistWorkspace} />}

      {/* =====================================================================
          7. AGENDA TÉCNICA & CRONOGRAMA (AGENDA)
         ===================================================================== */}
      {templateType === 'agenda' && (
        <div className="flex-1 flex flex-col gap-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex flex-wrap items-center gap-1.5">
              {['all', ...AGENDA_CATEGORIES].map((cat) => (
                <button
                  key={cat}
                  type="button"
                  onClick={() => setAgendaCategoryFilter(cat)}
                  className={`px-2.5 py-1 rounded-lg border text-[11px] font-semibold transition-colors ${
                    agendaCategoryFilter === cat
                      ? 'bg-accent text-white border-accent'
                      : 'bg-elevated border-border text-secondary hover:text-primary'
                  }`}
                >
                  {cat === 'all' ? 'Todos' : cat}
                </button>
              ))}
            </div>

            {isAdmin && (
              <button
                type="button"
                onClick={() => {
                  const next: AgendaEventItem[] = [
                    ...(data.agendaEvents || []),
                    {
                      id: `evt-${Date.now()}`,
                      date: new Date().toISOString().slice(0, 10),
                      time: '19:00',
                      title: 'Novo evento ou compromisso',
                      location: 'Local',
                      category: 'Académico',
                      color: topicColor,
                    },
                  ];
                  persistWorkspace({ ...data, agendaEvents: next });
                }}
                className="px-3.5 py-1.5 rounded-xl bg-accent text-white text-xs font-semibold flex items-center gap-1.5"
              >
                <Plus className="w-3.5 h-3.5" /> Novo Evento
              </button>
            )}
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
            {(data.agendaEvents || [])
              .filter(
                (evt) =>
                  agendaCategoryFilter === 'all' ||
                  evt.category === agendaCategoryFilter
              )
              .slice()
              .sort((a, b) =>
                `${a.date} ${a.time}`.localeCompare(`${b.date} ${b.time}`)
              )
              .map((evt) => (
                <div
                  key={evt.id}
                  style={{ borderLeftColor: evt.color || topicColor }}
                  className="p-4 rounded-xl bg-elevated border border-border border-l-4 space-y-2.5 relative group"
                >
                  <div className="flex items-center justify-between gap-2 text-[11px] font-mono text-muted">
                    <div className="flex items-center gap-2">
                      <input
                        type="date"
                        disabled={!isAdmin}
                        value={evt.date}
                        onChange={(e) => {
                          const next = (data.agendaEvents || []).map((item) =>
                            item.id === evt.id
                              ? { ...item, date: e.target.value }
                              : item
                          );
                          persistWorkspace({ ...data, agendaEvents: next });
                        }}
                        className="bg-transparent text-secondary focus:outline-none"
                      />
                      <span className="flex items-center gap-1">
                        <Clock className="w-3 h-3 text-accent" />
                        <input
                          type="time"
                          disabled={!isAdmin}
                          value={evt.time}
                          onChange={(e) => {
                            const next = (data.agendaEvents || []).map((item) =>
                              item.id === evt.id
                                ? { ...item, time: e.target.value }
                                : item
                            );
                            persistWorkspace({ ...data, agendaEvents: next });
                          }}
                          className="bg-transparent text-secondary focus:outline-none"
                        />
                      </span>
                    </div>

                    <div className="flex items-center gap-1.5">
                      <select
                        disabled={!isAdmin}
                        value={evt.category || 'Académico'}
                        onChange={(e) => {
                          const next = (data.agendaEvents || []).map((item) =>
                            item.id === evt.id
                              ? { ...item, category: e.target.value }
                              : item
                          );
                          persistWorkspace({ ...data, agendaEvents: next });
                        }}
                        className="bg-surface border border-border rounded px-2 py-0.5 text-[10px] text-secondary focus:outline-none"
                      >
                        {AGENDA_CATEGORIES.map((c) => (
                          <option key={c} value={c}>
                            {c}
                          </option>
                        ))}
                      </select>

                      {isAdmin && (
                        <button
                          type="button"
                          onClick={() => {
                            const next = (data.agendaEvents || []).filter(
                              (item) => item.id !== evt.id
                            );
                            persistWorkspace({ ...data, agendaEvents: next });
                          }}
                          className="text-muted hover:text-danger"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>
                  </div>

                  <input
                    type="text"
                    disabled={!isAdmin}
                    value={evt.title}
                    onChange={(e) => {
                      const next = (data.agendaEvents || []).map((item) =>
                        item.id === evt.id
                          ? { ...item, title: e.target.value }
                          : item
                      );
                      persistWorkspace({ ...data, agendaEvents: next });
                    }}
                    className="w-full bg-transparent text-sm font-bold text-primary focus:outline-none"
                  />

                  <div className="flex items-center gap-1.5 text-xs text-secondary">
                    <MapPin className="w-3.5 h-3.5 text-muted shrink-0" />
                    <input
                      type="text"
                      disabled={!isAdmin}
                      value={evt.location || ''}
                      placeholder="Localização..."
                      onChange={(e) => {
                        const next = (data.agendaEvents || []).map((item) =>
                          item.id === evt.id
                            ? { ...item, location: e.target.value }
                            : item
                        );
                        persistWorkspace({ ...data, agendaEvents: next });
                      }}
                      className="w-full bg-transparent text-xs text-secondary focus:outline-none"
                    />
                  </div>
                </div>
              ))}
          </div>
        </div>
      )}

      {/* =====================================================================
          8. BASE DE DADOS ESTRUTURADA (BLANK_DB)
         ===================================================================== */}
      {templateType === 'blank_db' && (
        <div className="flex-1 flex flex-col gap-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="relative w-64">
              <Search className="w-3.5 h-3.5 text-muted absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={dbSearch}
                onChange={(e) => setDbSearch(e.target.value)}
                placeholder="Pesquisar registos na base..."
                className="w-full bg-elevated border border-border rounded-xl pl-8 pr-3 py-1.5 text-xs text-primary focus:outline-none focus:border-accent"
              />
            </div>

            <div className="flex items-center gap-2">
              {isAdmin && (
                <>
                  <button
                    type="button"
                    onClick={() => {
                      const curr = data.customTable || [['Col 1', 'Col 2']];
                      const cols = curr[0]?.length || 2;
                      persistWorkspace({
                        ...data,
                        customTable: [...curr, Array(cols).fill('')],
                      });
                    }}
                    className="px-3 py-1.5 rounded-xl bg-elevated border border-border text-xs font-semibold text-secondary hover:text-primary"
                  >
                    + Linha
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      const curr = data.customTable || [['Col 1', 'Col 2']];
                      persistWorkspace({
                        ...data,
                        customTable: curr.map((r, i) => [
                          ...r,
                          i === 0 ? `Coluna ${r.length + 1}` : '',
                        ]),
                      });
                    }}
                    className="px-3 py-1.5 rounded-xl bg-elevated border border-border text-xs font-semibold text-secondary hover:text-primary"
                  >
                    + Coluna
                  </button>
                </>
              )}

              <button
                type="button"
                onClick={exportCustomTableToCsv}
                className="px-3 py-1.5 rounded-xl bg-accent text-white text-xs font-semibold flex items-center gap-1.5"
              >
                <Download className="w-3.5 h-3.5" />
                <span>Exportar CSV</span>
              </button>
            </div>
          </div>

          <div className="overflow-x-auto rounded-xl border border-border">
            <table className="w-full border-collapse text-xs">
              <tbody>
                {(
                  data.customTable || [
                    ['Item', 'Categoria', 'Status'],
                    ['', '', ''],
                  ]
                )
                  .filter(
                    (row, rIdx) =>
                      rIdx === 0 ||
                      !dbSearch.trim() ||
                      row.some((c) =>
                        String(c).toLowerCase().includes(dbSearch.toLowerCase())
                      )
                  )
                  .map((row, rIdx) => (
                    <tr key={rIdx}>
                      <td className="w-9 border border-border bg-elevated text-center font-mono text-[10px] text-muted">
                        {rIdx === 0 ? '#' : rIdx}
                      </td>
                      {row.map((cell, cIdx) => (
                        <td
                          key={cIdx}
                          className="border border-border bg-elevated/40 p-0"
                        >
                          <input
                            type="text"
                            disabled={!isAdmin}
                            value={cell}
                            onChange={(e) => {
                              const base =
                                data.customTable || [
                                  ['Item', 'Categoria', 'Status'],
                                  ['', '', ''],
                                ];
                              const copy = base.map((r) => [...r]);
                              copy[rIdx][cIdx] = e.target.value;
                              persistWorkspace({ ...data, customTable: copy });
                            }}
                            className={`w-full px-3 py-2 bg-transparent focus:outline-none ${
                              rIdx === 0
                                ? 'font-bold text-primary bg-surface'
                                : 'text-secondary'
                            }`}
                          />
                        </td>
                      ))}
                    </tr>
                  ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {studioMap && (
        <button
          type="button"
          data-pz-stop
          onClick={() => setShowWorkspaceNotes(!showWorkspaceNotes)}
          title="Documentação do mapa"
          className={`absolute bottom-3.5 left-3.5 z-30 inline-flex items-center gap-1.5 h-8 px-3 rounded-xl border text-[11px] font-semibold backdrop-blur ${
            showWorkspaceNotes ? 'bg-accent/20 border-accent text-primary' : 'bg-[#141417]/85 border-zinc-800 text-zinc-300 hover:text-white'
          }`}
        >
          <FileText className="w-3.5 h-3.5" /> Documentação
        </button>
      )}

      {(studioMap ? showWorkspaceNotes : showWorkspaceNotes || Boolean(data.workspaceNotes?.trim())) && (
        <div
          data-pz-stop
          className={
            studioMap
              ? 'absolute bottom-14 left-3.5 z-30 w-[min(380px,calc(100%-28px))] p-3 rounded-2xl bg-[#141417]/95 backdrop-blur border border-zinc-800 shadow-2xl space-y-2'
              : 'pt-4 border-t border-border space-y-2 shrink-0'
          }
        >
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-mono font-bold uppercase tracking-wider text-muted flex items-center gap-1.5">
              <FileText className="w-3.5 h-3.5 text-accent" />
              <span>Documentação & Notas Técnicas do Workspace</span>
            </span>
          </div>
          <textarea
            rows={4}
            disabled={!isAdmin}
            value={data.workspaceNotes || ''}
            placeholder="Registe diretrizes, observações arquiteturais, links ou especificações deste workspace..."
            onChange={(e) =>
              persistWorkspace({ ...data, workspaceNotes: e.target.value })
            }
            className="w-full p-3.5 rounded-xl bg-elevated border border-border font-mono text-xs text-primary placeholder:text-muted resize-y focus:outline-none focus:border-accent leading-relaxed"
          />
        </div>
      )}
    </div>
  );
}