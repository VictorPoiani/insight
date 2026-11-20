'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import { createClient } from '@/lib/supabase/client';
import { draftStatusLabel, useCloudDraft } from '@/lib/drafts/useCloudDraft';
import { gridCellStyle, normalizeGridStart, normalizeGridSpan } from '@/lib/grid';
import { uploadCompressedMediaToR2 } from '@/lib/mediaCompressor';
import { CustomSpotifyPlayer } from '@/components/feed/CustomSpotifyPlayer';
import {
  PostBlock,
  PostBlockType,
  FontStyleType,
  ImageWidthType,
  ImageAlignType,
  RoadmapStepItem,
} from '@/types/database';
import {
  Megaphone,
  Lock,
  Bold,
  Italic,
  Underline,
  Strikethrough,
  Highlighter,
  Type,
  AlignLeft,
  AlignCenter,
  AlignRight,
  GripVertical,
  Plus,
  Trash2,
  Pencil,
  Image as ImageIcon,
  Film,
  Music,
  Heading1,
  Heading2,
  Quote,
  Sparkles,
  Code,
  List,
  Minus,
  Send,
  X,
  ArrowUp,
  ArrowDown,
  BarChart3,
  PieChart,
  CheckSquare,
  Paperclip,
  Table,
  Grid,
  FileText,
  SlidersHorizontal,
  Check,
  Move,
  Compass,
  Download,
} from 'lucide-react';

interface OfficialUpdateRecord {
  id: string;
  content: string;
  blocks: PostBlock[];
  author_name: string;
  created_at: string;
  sourceTable: 'updates' | 'official_updates' | 'notifications' | 'posts';
}

const MAX_FILE_SIZE_MB = 5;
const MAX_FILE_SIZE_BYTES = MAX_FILE_SIZE_MB * 1024 * 1024;

const HIGHLIGHT_COLORS = [
  { name: 'Amarelo', color: 'rgba(250, 204, 21, 0.35)' },
  { name: 'Azul Metálico', color: 'rgba(37, 99, 235, 0.42)' },
  { name: 'Verde', color: 'rgba(29, 185, 84, 0.35)' },
  { name: 'Roxo', color: 'rgba(168, 85, 247, 0.40)' },
  { name: 'Vermelho', color: 'rgba(239, 68, 68, 0.38)' },
];

const CHART_PALETTE = ['#2563eb', '#10b981', '#f59e0b', '#8b5cf6', '#ec4899', '#06b6d4'];

const CELL_SIZES = [
  { cols: 3, label: '25%' },
  { cols: 4, label: '33%' },
  { cols: 6, label: '50%' },
  { cols: 8, label: '66%' },
  { cols: 12, label: '100%' },
];

const BLOCK_MENU_ITEMS: {
  type: PostBlockType;
  label: string;
  desc: string;
  icon: React.ComponentType<{ className?: string }>;
}[] = [
  { type: 'paragraph', label: 'Texto', desc: 'Parágrafo', icon: AlignLeft },
  { type: 'h1', label: 'Título H1', desc: 'Cabeçalho grande', icon: Heading1 },
  { type: 'h2', label: 'Subtítulo H2', desc: 'Secção média', icon: Heading2 },
  { type: 'quote', label: 'Citação', desc: 'Barra lateral', icon: Quote },
  { type: 'callout', label: 'Destaque', desc: 'Caixa de nota', icon: Sparkles },
  { type: 'bullet', label: 'Lista', desc: 'Item em tópico', icon: List },
  { type: 'code', label: 'Código', desc: 'Bloco monoespaçado', icon: Code },
  { type: 'divider', label: 'Divisória', desc: 'Linha separadora', icon: Minus },
  { type: 'image', label: 'Imagem', desc: 'Lateral ou centro', icon: ImageIcon },
  { type: 'video', label: 'Vídeo R2', desc: 'Compactado · R2', icon: Film },
  { type: 'roadmap', label: 'Roadmap', desc: 'Fases e entregas', icon: Compass },
  { type: 'table', label: 'Tabela', desc: 'Linhas e colunas', icon: Table },
  { type: 'chart', label: 'Gráfico', desc: 'Barras ou Rosca', icon: BarChart3 },
  { type: 'poll', label: 'Enquete', desc: 'Votação interativa', icon: CheckSquare },
  { type: 'file', label: 'Arquivo', desc: `Anexo até ${MAX_FILE_SIZE_MB}MB`, icon: Paperclip },
  { type: 'spotify', label: 'Spotify', desc: 'Player de áudio', icon: Music },
];

function createNewBlock(type: PostBlockType = 'paragraph'): PostBlock {
  const uid = `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
  return {
    id: `ublk-${uid}`,
    type,
    html: '',
    fontStyle: type === 'code' ? 'mono' : 'sans',
    align: 'left',
    gridSpan: 12,
    gridStart: 0,
    imageUrl: null,
    imageCaption: '',
    imageWidth: '100%',
    imageAlign: 'center',
    videoUrl: null,
    r2Key: null,
    videoCaption: '',
    videoWidth: '100%',
    videoAlign: 'center',
    isGif: false,
    spotifyTrackId: null,
    chartType: 'vertical',
    chartTitle: '',
    chartData: [
      { label: 'Item A', value: 45, color: '#2563eb' },
      { label: 'Item B', value: 80, color: '#10b981' },
    ],
    pollQuestion: '',
    pollMultiple: false,
    pollOptions: [
      { id: `opt-${uid}-1`, text: 'Opção 1', votes: 0 },
      { id: `opt-${uid}-2`, text: 'Opção 2', votes: 0 },
    ],
    fileUrl: null,
    fileName: '',
    fileSize: 0,
    fileType: '',
    tableData: [
      ['Coluna 1', 'Coluna 2', 'Coluna 3'],
      ['', '', ''],
    ],
    roadmapSteps: [
      {
        id: `step-${uid}-1`,
        phase: 'Fase 01',
        title: 'Marco da atualização',
        description: 'Detalhes da implementação...',
        status: 'completed',
      },
    ],
  };
}

function getSpanLabel(span?: number) {
  const s = span || 12;
  const found = CELL_SIZES.find((c) => c.cols === s);
  return found ? found.label : `${Math.round((s / 12) * 100)}%`;
}

function getFontClass(font?: FontStyleType) {
  if (font === 'serif') return 'font-serif tracking-normal';
  if (font === 'mono') return 'font-mono text-[0.92em]';
  return 'font-sans';
}

function getImageAlignClass(align?: ImageAlignType) {
  if (align === 'left') return 'mr-auto';
  if (align === 'right') return 'ml-auto';
  return 'mx-auto';
}

function formatBytes(bytes?: number) {
  if (!bytes) return '';
  const kb = bytes / 1024;
  if (kb < 1024) return `${kb.toFixed(1)} KB`;
  return `${(kb / 1024).toFixed(2)} MB`;
}

/**
 * Converte qualquer registo antigo ou novo vindo do Supabase
 * preservando 100% dos blocos, formatações, grifos e textos originais.
 */
function normalizeRowToOfficialUpdate(
  row: any,
  sourceTable: OfficialUpdateRecord['sourceTable']
): OfficialUpdateRecord | null {
  if (!row || !row.id) return null;

  let extractedBlocks: PostBlock[] = [];
  let rawText = String(row.content || row.message || row.title || '').trim();

  // 1. Verifica se a linha já possui a coluna `blocks` (Array ou JSON string)
  if (Array.isArray(row.blocks) && row.blocks.length > 0) {
    extractedBlocks = row.blocks;
  } else if (typeof row.blocks === 'string' && row.blocks.trim().startsWith('[')) {
    try {
      extractedBlocks = JSON.parse(row.blocks);
    } catch {
      // Continua para os próximos formatos
    }
  }

  // 2. Verifica se `content` ou `message` guarda um JSON de blocos
  if (
    extractedBlocks.length === 0 &&
    (rawText.startsWith('[') || rawText.startsWith('{'))
  ) {
    try {
      const parsed = JSON.parse(rawText);
      if (Array.isArray(parsed)) {
        extractedBlocks = parsed;
        rawText = '';
      } else if (parsed && Array.isArray(parsed.blocks)) {
        extractedBlocks = parsed.blocks;
        rawText = String(parsed.content || parsed.text || parsed.message || '');
      }
    } catch {
      // Trata como texto/HTML normal
    }
  }

  // 3. Normaliza cada bloco (garantindo compatibilidade com blocos da v1.0)
  if (extractedBlocks.length > 0) {
    extractedBlocks = extractedBlocks.map((b: any, i: number) => ({
      ...b,
      id: b.id || `legacy-blk-${row.id}-${i}`,
      type: (b.type || 'paragraph') as PostBlockType,
      html: b.html ?? b.content ?? b.text ?? '',
      fontStyle: b.fontStyle || (b.type === 'code' ? 'mono' : 'sans'),
      align: b.align || 'left',
      gridSpan: Number(b.gridSpan) || 12,
      gridStart: normalizeGridStart(b.gridStart, b.gridSpan),
    }));
  } else if (rawText) {
    extractedBlocks = [
      {
        id: `legacy-text-${row.id}`,
        type: 'paragraph',
        html: rawText.includes('<') ? rawText : rawText.replace(/\n/g, '<br>'),
        fontStyle: 'sans',
        align: 'left',
        gridSpan: 12,
        gridStart: 0,
      },
    ];
  } else {
    return null;
  }

  return {
    id: String(row.id),
    content: rawText,
    blocks: extractedBlocks,
    author_name: row.author_name || 'Victor Poiani',
    created_at: row.created_at || new Date().toISOString(),
    sourceTable,
  };
}

interface RichEditableCellProps {
  block: PostBlock;
  placeholder: string;
  className: string;
  onFocus: () => void;
  onChangeHtml: (html: string) => void;
  onSlashTriggered: () => void;
  onEnterPressed: () => void;
  onBackspaceEmpty: () => void;
}

function RichEditableCell({
  block,
  placeholder,
  className,
  onFocus,
  onChangeHtml,
  onSlashTriggered,
  onEnterPressed,
  onBackspaceEmpty,
}: RichEditableCellProps) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!ref.current) return;
    if (
      document.activeElement !== ref.current &&
      ref.current.innerHTML !== (block.html || '')
    ) {
      ref.current.innerHTML = block.html || '';
    }
  }, [block.html, block.type]);

  function handleInput(e: React.FormEvent<HTMLDivElement>) {
    const html = e.currentTarget.innerHTML;
    const plain = e.currentTarget.innerText.trim();
    if (plain === '/') {
      e.currentTarget.innerHTML = '';
      onChangeHtml('');
      onSlashTriggered();
      return;
    }
    onChangeHtml(html === '<br>' ? '' : html);
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLDivElement>) {
    if (e.key === 'Enter' && !e.shiftKey && block.type !== 'code') {
      e.preventDefault();
      onEnterPressed();
    } else if (e.key === 'Backspace') {
      const plain = e.currentTarget.innerText.replace(/\n/g, '').trim();
      if (plain.length === 0) {
        e.preventDefault();
        onBackspaceEmpty();
      }
    }
  }

  return (
    <div
      ref={ref}
      contentEditable
      suppressContentEditableWarning
      spellCheck={block.type !== 'code'}
      lang="pt-BR"
      data-placeholder={placeholder}
      onFocus={onFocus}
      onInput={handleInput}
      onKeyDown={handleKeyDown}
      style={{ textAlign: block.align || 'left' }}
      className={`notion-editable w-full focus:outline-none break-words ${className}`}
    />
  );
}

export default function NotificacoesPage() {
  const [updates, setUpdates] = useState<OfficialUpdateRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [isAdmin, setIsAdmin] = useState(false);
  const [authorId, setAuthorId] = useState<string>(
    process.env.NEXT_PUBLIC_DEFAULT_PROFILE_ID ||
      '96d271a9-9102-49b1-b593-9279c5dfe3f4'
  );
  const [preferredTable, setPreferredTable] = useState<
    'updates' | 'official_updates' | 'notifications'
  >('updates');

  // Estados do Editor de Blocos em Grade de 12 Colunas (Topo ou Edição)
  const [blocks, setBlocks] = useState<PostBlock[]>(() => [
    createNewBlock('h1'),
    createNewBlock('paragraph'),
  ]);
  const [editingUpdate, setEditingUpdate] = useState<OfficialUpdateRecord | null>(
    null
  );

  // Rascunho automático na nuvem (novo ou edição)
  const updateDraft = useCloudDraft<PostBlock[]>(
    isAdmin ? (editingUpdate ? `update:edit:${editingUpdate.id}` : 'update:new') : null,
    isAdmin ? authorId : null,
    (bs) => !bs.some((b) => (b.html || '').replace(/<[^>]*>|&nbsp;/g, '').trim() || b.imageUrl || b.videoUrl || b.fileUrl)
  );
  const restoredScope = useRef<string | null>(null);
  const [updateDraftAt, setUpdateDraftAt] = useState<number | null>(null);
  const currentDraftScope = editingUpdate ? `update:edit:${editingUpdate.id}` : 'update:new';

  useEffect(() => {
    if (!isAdmin || !updateDraft.ready || restoredScope.current === currentDraftScope) return;
    restoredScope.current = currentDraftScope;
    const saved = updateDraft.loaded;
    const base = editingUpdate ? new Date(editingUpdate.created_at).getTime() : 0;
    if (saved && saved.at > base) {
      setBlocks(saved.v);
      setUpdateDraftAt(saved.at);
    } else {
      setUpdateDraftAt(null);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isAdmin, updateDraft.ready, currentDraftScope]);

  useEffect(() => {
    if (restoredScope.current !== currentDraftScope) return;
    updateDraft.save(blocks);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [blocks]);

  const [activeBlockId, setActiveBlockId] = useState<string>('');
  const [menuOpenForBlockId, setMenuOpenForBlockId] = useState<string | null>(null);
  const [cellConfigOpenForId, setCellConfigOpenForId] = useState<string | null>(null);
  const [showHighlighterMenu, setShowHighlighterMenu] = useState(false);
  const [showGridLines, setShowGridLines] = useState(true);
  const [uploadingBlockId, setUploadingBlockId] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Estados de Arraste e Redimensionamento de Células (12 Colunas)
  const gridContainerRef = useRef<HTMLDivElement>(null);
  const [draggedBlockId, setDraggedBlockId] = useState<string | null>(null);
  const [dragOverBlockId, setDragOverBlockId] = useState<string | null>(null);
  const [dragHoverCol, setDragHoverCol] = useState<number | null>(null);
  const [resizingState, setResizingState] = useState<{
    blockId: string;
    startX: number;
    initialSpan: number;
    startCol: number;
  } | null>(null);

  const supabase = createClient();

  const loadOfficialUpdates = useCallback(async () => {
    setLoading(true);

    const {
      data: { session },
    } = await supabase.auth.getSession();
    // Só a conta admin publica atualizações oficiais (o banco exige o mesmo)
    let viewerIsAdmin = false;
    if (session?.user?.id) {
      setAuthorId(session.user.id);
      const { data: viewerProfile } = await supabase
        .from('profiles')
        .select('role')
        .or(`user_id.eq.${session.user.id},id.eq.${session.user.id}`)
        .maybeSingle();
      viewerIsAdmin = viewerProfile?.role === 'admin';
    }
    setIsAdmin(viewerIsAdmin);

    const collected: OfficialUpdateRecord[] = [];
    let detectedTable: 'updates' | 'official_updates' | 'notifications' = 'updates';

    // 1. Busca na tabela principal `updates`
    const { data: updatesData, error: updatesErr } = await supabase
      .from('updates')
      .select('*')
      .order('created_at', { ascending: false });

    if (!updatesErr && Array.isArray(updatesData)) {
      detectedTable = 'updates';
      for (const row of updatesData) {
        const norm = normalizeRowToOfficialUpdate(row, 'updates');
        if (norm) collected.push(norm);
      }
    }

    // 2. Busca complementar em `official_updates` (caso exista no schema)
    const { data: offData, error: offErr } = await supabase
      .from('official_updates')
      .select('*')
      .order('created_at', { ascending: false });

    if (!offErr && Array.isArray(offData)) {
      if (updatesErr) detectedTable = 'official_updates';
      for (const row of offData) {
        const norm = normalizeRowToOfficialUpdate(row, 'official_updates');
        if (norm && !collected.some((c) => c.id === norm.id)) {
          collected.push(norm);
        }
      }
    }

    // 3. Busca complementar em `notifications` (registos de sistema/mural)
    const { data: notifData, error: notifErr } = await supabase
      .from('notifications')
      .select('*')
      .order('created_at', { ascending: false });

    if (!notifErr && Array.isArray(notifData)) {
      if (updatesErr && offErr) detectedTable = 'notifications';
      for (const row of notifData) {
        if (!row.type || row.type === 'system' || row.blocks) {
          const norm = normalizeRowToOfficialUpdate(row, 'notifications');
          if (norm && !collected.some((c) => c.id === norm.id)) {
            collected.push(norm);
          }
        }
      }
    }

    // 4. Inclui também eventuais posts publicados com a tag #atualizacoes
    const { data: taggedPosts } = await supabase
      .from('posts')
      .select('*')
      .contains('tags', ['atualizacoes'])
      .order('created_at', { ascending: false });

    if (Array.isArray(taggedPosts)) {
      for (const row of taggedPosts) {
        const norm = normalizeRowToOfficialUpdate(row, 'posts');
        if (norm && !collected.some((c) => c.id === norm.id)) {
          collected.push(norm);
        }
      }
    }

    collected.sort(
      (a, b) =>
        new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
    );

    setPreferredTable(detectedTable);
    setUpdates(collected);
    setLoading(false);
  }, [supabase]);

  useEffect(() => {
    loadOfficialUpdates();

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(() => {
      // recarrega e reavalia o cargo (não basta estar logado para ser admin)
      loadOfficialUpdates();
    });

    return () => {
      subscription.unsubscribe();
    };
  }, [loadOfficialUpdates, supabase]);

  // Redimensionamento lateral das células (12 Colunas)
  useEffect(() => {
    if (!resizingState) return;

    function handleMouseMove(e: MouseEvent) {
      if (!resizingState || !gridContainerRef.current) return;
      const rect = gridContainerRef.current.getBoundingClientRect();
      const colWidth = rect.width / 12;
      const deltaX = e.clientX - resizingState.startX;
      const deltaCols = Math.round(deltaX / colWidth);
      const maxAllowedSpan =
        resizingState.startCol > 0 ? 13 - resizingState.startCol : 12;
      const nextSpan = Math.max(
        3,
        Math.min(maxAllowedSpan, resizingState.initialSpan + deltaCols)
      );

      setBlocks((prev) =>
        prev.map((b) =>
          b.id === resizingState.blockId ? { ...b, gridSpan: nextSpan } : b
        )
      );
    }

    function handleMouseUp() {
      setResizingState(null);
    }

    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);
    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, [resizingState]);

  const activeBlock = blocks.find((b) => b.id === activeBlockId) || blocks[0];

  function applyInlineFormat(command: string, value?: string) {
    document.execCommand('styleWithCSS', false, 'true');
    document.execCommand(command, false, value);
  }

  function applyHighlightColor(color: string | null) {
    document.execCommand('styleWithCSS', false, 'true');
    if (!color) {
      document.execCommand('hiliteColor', false, 'transparent');
    } else {
      document.execCommand('hiliteColor', false, color);
    }
    setShowHighlighterMenu(false);
  }

  function updateBlock(id: string, patch: Partial<PostBlock>) {
    setBlocks((prev) => prev.map((b) => (b.id === id ? { ...b, ...patch } : b)));
  }

  function insertBlockAfter(targetId: string, type: PostBlockType = 'paragraph') {
    const newBlk = createNewBlock(type);
    setBlocks((prev) => {
      const idx = prev.findIndex((b) => b.id === targetId);
      if (idx === -1) return [...prev, newBlk];
      const copy = [...prev];
      copy.splice(idx + 1, 0, newBlk);
      return copy;
    });
    setActiveBlockId(newBlk.id);
    setMenuOpenForBlockId(null);
    setCellConfigOpenForId(null);
  }

  function removeBlock(id: string) {
    setBlocks((prev) => {
      if (prev.length <= 1) return [createNewBlock('paragraph')];
      return prev.filter((b) => b.id !== id);
    });
  }

  function moveBlockStep(id: string, direction: 'up' | 'down') {
    setBlocks((prev) => {
      const index = prev.findIndex((b) => b.id === id);
      if (index === -1) return prev;
      const targetIndex = direction === 'up' ? index - 1 : index + 1;
      if (targetIndex < 0 || targetIndex >= prev.length) return prev;
      const copy = [...prev];
      const [moved] = copy.splice(index, 1);
      copy.splice(targetIndex, 0, moved);
      return copy;
    });
  }

  function computeTargetColumn(clientX: number, blockSpan: number): number {
    if (!gridContainerRef.current) return 1;
    const rect = gridContainerRef.current.getBoundingClientRect();
    const relX = Math.max(0, clientX - rect.left);
    const colWidth = rect.width / 12;
    const rawCol = Math.floor(relX / colWidth) + 1;
    const maxStartCol = Math.max(1, 13 - blockSpan);
    return Math.max(1, Math.min(maxStartCol, rawCol));
  }

  function handleDragStart(e: React.DragEvent, id: string) {
    setDraggedBlockId(id);
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/plain', id);
  }

  function handleGridDragOver(e: React.DragEvent) {
    e.preventDefault();
    if (!draggedBlockId) return;
    const draggedBlk = blocks.find((b) => b.id === draggedBlockId);
    const span = draggedBlk?.gridSpan || 12;
    setDragHoverCol(computeTargetColumn(e.clientX, span));
  }

  function handleGridDrop(e: React.DragEvent, targetId?: string) {
    e.preventDefault();
    e.stopPropagation();
    if (!draggedBlockId) return;

    const draggedBlk = blocks.find((b) => b.id === draggedBlockId);
    const span = draggedBlk?.gridSpan || 12;
    const newCol = computeTargetColumn(e.clientX, span);

    setBlocks((prev) => {
      const updated = prev.map((b) =>
        b.id === draggedBlockId
          ? { ...b, gridStart: targetId ? 0 : normalizeGridStart(newCol, span) }
          : b
      );

      if (targetId && targetId !== draggedBlockId) {
        const fromIndex = updated.findIndex((b) => b.id === draggedBlockId);
        const toIndex = updated.findIndex((b) => b.id === targetId);
        if (fromIndex !== -1 && toIndex !== -1) {
          const [moved] = updated.splice(fromIndex, 1);
          updated.splice(toIndex, 0, moved);
        }
      }
      return updated;
    });

    setDraggedBlockId(null);
    setDragOverBlockId(null);
    setDragHoverCol(null);
  }

  async function handleBlockImageUpload(
    e: React.ChangeEvent<HTMLInputElement>,
    blockId: string
  ) {
    const file = e.target.files?.[0];
    if (!file || !isAdmin) return;
    if (file.size > MAX_FILE_SIZE_BYTES) {
      alert(`A imagem deve ter no máximo ${MAX_FILE_SIZE_MB}MB.`);
      return;
    }

    setUploadingBlockId(blockId);
    const ext = file.name.split('.').pop();
    const fileName = `updates/${Date.now()}-${Math.random().toString(36).slice(2, 6)}.${ext}`;
    const { error } = await supabase.storage.from('posts').upload(fileName, file);
    setUploadingBlockId(null);

    if (error) {
      alert('Erro ao enviar imagem: ' + error.message);
      return;
    }

    const { data: pubData } = supabase.storage.from('posts').getPublicUrl(fileName);
    updateBlock(blockId, { imageUrl: pubData.publicUrl });
  }

  async function handleBlockVideoUpload(
    e: React.ChangeEvent<HTMLInputElement>,
    blockId: string
  ) {
    const file = e.target.files?.[0];
    if (!file || !isAdmin) return;

    setUploadingBlockId(blockId);
    try {
      const result = await uploadCompressedMediaToR2(
        file,
        authorId,
        file.type === 'image/gif'
      );
      updateBlock(blockId, {
        videoUrl: result.publicUrl,
        r2Key: result.r2Key,
        isGif: result.isGif,
      });
    } catch (err: any) {
      alert(err?.message || 'Erro ao enviar mídia para Cloudflare R2');
    } finally {
      setUploadingBlockId(null);
    }
  }

  async function handleBlockFileUpload(
    e: React.ChangeEvent<HTMLInputElement>,
    blockId: string
  ) {
    const file = e.target.files?.[0];
    if (!file || !isAdmin) return;
    if (file.size > MAX_FILE_SIZE_BYTES) {
      alert(`O arquivo excede o limite de ${MAX_FILE_SIZE_MB}MB.`);
      return;
    }

    setUploadingBlockId(blockId);
    const ext = file.name.split('.').pop() || 'bin';
    const safeStorageName = `updates/files/${Date.now()}.${ext}`;
    const { error } = await supabase.storage
      .from('posts')
      .upload(safeStorageName, file);
    setUploadingBlockId(null);

    if (error) {
      alert('Erro ao anexar arquivo: ' + error.message);
      return;
    }

    const { data: pubData } = supabase.storage
      .from('posts')
      .getPublicUrl(safeStorageName);
    updateBlock(blockId, {
      fileUrl: pubData.publicUrl,
      fileName: file.name,
      fileSize: file.size,
      fileType: ext.toUpperCase(),
    });
  }

  async function handleSaveUpdate(e: React.FormEvent) {
    e.preventDefault();
    if (!isAdmin || isSubmitting) return;

    const validBlocks = blocks.filter((b) => {
      if (b.type === 'divider') return true;
      if (b.type === 'image') return Boolean(b.imageUrl);
      if (b.type === 'video' || b.type === 'gif') return Boolean(b.videoUrl);
      if (b.type === 'spotify') return Boolean(b.spotifyTrackId);
      if (b.type === 'file') return Boolean(b.fileUrl);
      if (b.type === 'chart')
        return Array.isArray(b.chartData) && b.chartData.length > 0;
      if (b.type === 'poll') return Boolean(b.pollQuestion?.trim());
      if (b.type === 'table')
        return Array.isArray(b.tableData) && b.tableData.length > 0;
      if (b.type === 'roadmap')
        return Array.isArray(b.roadmapSteps) && b.roadmapSteps.length > 0;
      const plain = (b.html || '').replace(/<[^>]*>/g, '').trim();
      return plain.length > 0;
    });

    if (validBlocks.length === 0) return;

    setIsSubmitting(true);

    const plainTextSummary = validBlocks
      .map((b) =>
        (b.html || '')
          .replace(/<br\s*\/?>/gi, '\n')
          .replace(/<[^>]*>/g, '')
          .trim()
      )
      .filter(Boolean)
      .join('\n\n');

    const targetTable = editingUpdate ? editingUpdate.sourceTable : preferredTable;

    try {
      if (editingUpdate) {
        if (targetTable === 'notifications') {
          const { error } = await supabase
            .from('notifications')
            .update({
              message: JSON.stringify({
                content: plainTextSummary,
                blocks: validBlocks,
              }),
            })
            .eq('id', editingUpdate.id);
          if (error) throw error;
        } else {
          let { error } = await supabase
            .from(targetTable)
            .update({
              content: plainTextSummary || 'Atualização oficial',
              blocks: validBlocks,
            })
            .eq('id', editingUpdate.id);

          if (error && error.message?.includes('blocks')) {
            const fallback = await supabase
              .from(targetTable)
              .update({
                content: JSON.stringify({
                  content: plainTextSummary,
                  blocks: validBlocks,
                }),
              })
              .eq('id', editingUpdate.id);
            error = fallback.error;
          }
          if (error) throw error;
        }

        setEditingUpdate(null);
      } else {
        // Criação de nova atualização oficial
        if (targetTable === 'notifications') {
          const { error } = await supabase.from('notifications').insert({
            user_id: authorId,
            type: 'system',
            message: JSON.stringify({
              content: plainTextSummary,
              blocks: validBlocks,
            }),
            is_read: false,
          });
          if (error) throw error;
        } else {
          let { error } = await supabase.from(targetTable).insert({
            content: plainTextSummary || 'Atualização oficial',
            blocks: validBlocks,
          });

          if (error && error.message?.includes('blocks')) {
            const retry = await supabase.from(targetTable).insert({
              content: JSON.stringify({
                content: plainTextSummary,
                blocks: validBlocks,
              }),
            });
            error = retry.error;
          }
          if (error) throw error;
        }

        // Dispara e-mail de Atualização Oficial para os inscritos
        fetch('/api/newsletter', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            action: 'official_update',
            postContent: plainTextSummary || 'Nova atualização oficial no Insight*',
            postBlocks: validBlocks,
          }),
        }).catch(() => {});
      }

      void updateDraft.clear();
      setUpdateDraftAt(null);
      setBlocks([createNewBlock('h1'), createNewBlock('paragraph')]);
      await loadOfficialUpdates();
    } catch (err: any) {
      alert('Erro ao guardar atualização: ' + (err?.message || 'Erro desconhecido'));
    } finally {
      setIsSubmitting(false);
    }
  }

  async function handleDeleteUpdate(item: OfficialUpdateRecord) {
    if (!isAdmin) return;
    if (!confirm('Excluir esta atualização oficial da linha do tempo?')) return;

    const { error } = await supabase
      .from(item.sourceTable)
      .delete()
      .eq('id', item.id);

    if (!error) {
      setUpdates((prev) => prev.filter((u) => u.id !== item.id));
    } else {
      alert('Erro ao excluir atualização: ' + error.message);
    }
  }

  function startEditingUpdate(item: OfficialUpdateRecord) {
    setEditingUpdate(item);
    setBlocks(JSON.parse(JSON.stringify(item.blocks)));
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  function getBlockTypographyClass(type: PostBlockType) {
    switch (type) {
      case 'h1':
        return 'text-xl sm:text-2xl font-extrabold text-primary leading-tight';
      case 'h2':
        return 'text-base sm:text-lg font-bold text-primary leading-snug';
      case 'quote':
        return 'border-l-4 border-accent pl-4 italic text-secondary text-sm sm:text-base';
      case 'code':
        return 'p-3.5 rounded-xl bg-elevated border border-border font-mono text-xs text-primary whitespace-pre-wrap';
      default:
        return 'text-sm sm:text-base text-primary leading-relaxed';
    }
  }

  return (
    <div className="w-full min-h-screen p-6 space-y-6">
      {/* 1. TOPO: EDITOR EM GRADE (PARA ADMIN) OU AVISO DE RESTRIÇÃO (PARA VISITANTES) */}
      {!isAdmin ? (
        <div className="p-4 rounded-xl bg-surface border border-border flex items-center gap-2.5 text-xs text-secondary">
          <Lock className="w-4 h-4 text-accent shrink-0" />
          <span>
            Somente o criador do Insight pode publicar atualizações neste mural.
          </span>
        </div>
      ) : (
        <form
          onSubmit={handleSaveUpdate}
          className="p-5 rounded-2xl bg-surface border border-border space-y-4 shadow-sm"
        >
          {updateDraftAt && (
            <div className="flex flex-wrap items-center justify-between gap-2 px-3 py-2 rounded-xl border border-accent/40 bg-accent/10 text-xs">
              <span className="text-primary">
                Rascunho restaurado · {new Date(updateDraftAt).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })}
              </span>
              <button
                type="button"
                onClick={() => {
                  void updateDraft.clear();
                  setUpdateDraftAt(null);
                  setBlocks(editingUpdate ? JSON.parse(JSON.stringify(editingUpdate.blocks)) : [createNewBlock('h1'), createNewBlock('paragraph')]);
                }}
                className="font-semibold text-secondary hover:text-danger"
              >
                Descartar rascunho
              </button>
            </div>
          )}
          {draftStatusLabel(updateDraft.status, updateDraft.savedAt) && (
            <p className="text-[10px] text-muted font-mono">{draftStatusLabel(updateDraft.status, updateDraft.savedAt)}</p>
          )}
          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border pb-3">
            <div className="flex items-center gap-2 text-xs font-bold text-accent">
              <Megaphone className="w-4 h-4" />
              <span>
                {editingUpdate
                  ? 'Editando Atualização Oficial'
                  : 'Publicar Nova Atualização Oficial'}
              </span>
            </div>

            {editingUpdate && (
              <button
                type="button"
                onClick={() => {
                  setEditingUpdate(null);
                  setBlocks([createNewBlock('h1'), createNewBlock('paragraph')]);
                }}
                className="text-xs font-semibold text-muted hover:text-primary flex items-center gap-1"
              >
                <X className="w-3.5 h-3.5" />
                <span>Cancelar edição</span>
              </button>
            )}
          </div>

          {/* Barra de Ferramentas de Formatação e Grade */}
          <div className="sticky top-2 z-30 flex flex-wrap items-center justify-between gap-2 p-2 rounded-xl bg-elevated/95 backdrop-blur border border-border">
            <div className="flex items-center gap-1 pr-2 border-r border-border">
              <Type className="w-3.5 h-3.5 text-accent ml-1 mr-0.5" />
              {(
                [
                  { key: 'sans', label: 'Sans' },
                  { key: 'serif', label: 'Serif' },
                  { key: 'mono', label: 'Mono' },
                ] as { key: FontStyleType; label: string }[]
              ).map((f) => (
                <button
                  key={f.key}
                  type="button"
                  onMouseDown={(e) => {
                    e.preventDefault();
                    if (activeBlock)
                      updateBlock(activeBlock.id, { fontStyle: f.key });
                  }}
                  className={`px-2 py-1 rounded-md text-xs font-semibold transition-colors ${
                    (activeBlock?.fontStyle || 'sans') === f.key
                      ? 'bg-accent text-white'
                      : 'text-secondary hover:text-primary hover:bg-surface'
                  }`}
                >
                  {f.label}
                </button>
              ))}
            </div>

            <div className="flex items-center gap-1 pr-2 border-r border-border relative">
              <button
                type="button"
                title="Negrito (Ctrl+B)"
                onMouseDown={(e) => {
                  e.preventDefault();
                  applyInlineFormat('bold');
                }}
                className="p-1.5 rounded-md text-secondary hover:text-primary hover:bg-surface"
              >
                <Bold className="w-4 h-4" />
              </button>
              <button
                type="button"
                title="Itálico (Ctrl+I)"
                onMouseDown={(e) => {
                  e.preventDefault();
                  applyInlineFormat('italic');
                }}
                className="p-1.5 rounded-md text-secondary hover:text-primary hover:bg-surface"
              >
                <Italic className="w-4 h-4" />
              </button>
              <button
                type="button"
                title="Sublinhar (Ctrl+U)"
                onMouseDown={(e) => {
                  e.preventDefault();
                  applyInlineFormat('underline');
                }}
                className="p-1.5 rounded-md text-secondary hover:text-primary hover:bg-surface"
              >
                <Underline className="w-4 h-4" />
              </button>
              <button
                type="button"
                title="Rasurado"
                onMouseDown={(e) => {
                  e.preventDefault();
                  applyInlineFormat('strikeThrough');
                }}
                className="p-1.5 rounded-md text-secondary hover:text-primary hover:bg-surface"
              >
                <Strikethrough className="w-4 h-4" />
              </button>

              <div className="relative">
                <button
                  type="button"
                  title="Realçar texto selecionado"
                  onMouseDown={(e) => {
                    e.preventDefault();
                    setShowHighlighterMenu((prev) => !prev);
                  }}
                  className={`p-1.5 rounded-md flex items-center gap-1 transition-colors ${
                    showHighlighterMenu
                      ? 'bg-accent text-white'
                      : 'text-secondary hover:text-primary hover:bg-surface'
                  }`}
                >
                  <Highlighter className="w-4 h-4" />
                </button>

                {showHighlighterMenu && (
                  <div className="absolute left-0 top-full mt-2 p-2 rounded-xl bg-surface border border-border shadow-xl flex items-center gap-1.5 z-40">
                    {HIGHLIGHT_COLORS.map((item) => (
                      <button
                        key={item.name}
                        type="button"
                        title={`Realçar: ${item.name}`}
                        onMouseDown={(e) => {
                          e.preventDefault();
                          applyHighlightColor(item.color);
                        }}
                        style={{ backgroundColor: item.color }}
                        className="w-6 h-6 rounded-full border border-white/20 hover:scale-110 transition-transform"
                      />
                    ))}
                    <button
                      type="button"
                      onMouseDown={(e) => {
                        e.preventDefault();
                        applyHighlightColor(null);
                      }}
                      className="px-2 py-1 rounded bg-elevated text-[10px] text-secondary hover:text-primary"
                    >
                      Limpar
                    </button>
                  </div>
                )}
              </div>
            </div>

            <div className="flex items-center gap-1">
              <button
                type="button"
                title="Mostrar/Ocultar grade de 12 colunas"
                onClick={() => setShowGridLines(!showGridLines)}
                className={`p-1.5 rounded-md transition-colors mr-1 ${
                  showGridLines
                    ? 'text-accent bg-surface'
                    : 'text-secondary hover:text-primary hover:bg-surface'
                }`}
              >
                <Grid className="w-3.5 h-3.5" />
              </button>

              {(
                [
                  { align: 'left', icon: AlignLeft },
                  { align: 'center', icon: AlignCenter },
                  { align: 'right', icon: AlignRight },
                ] as const
              ).map((item) => {
                const Icon = item.icon;
                return (
                  <button
                    key={item.align}
                    type="button"
                    onMouseDown={(e) => {
                      e.preventDefault();
                      if (activeBlock)
                        updateBlock(activeBlock.id, { align: item.align });
                    }}
                    className={`p-1.5 rounded-md transition-colors ${
                      (activeBlock?.align || 'left') === item.align
                        ? 'text-accent bg-surface'
                        : 'text-secondary hover:text-primary hover:bg-surface'
                    }`}
                  >
                    <Icon className="w-3.5 h-3.5" />
                  </button>
                );
              })}
            </div>
          </div>

          {draggedBlockId && dragHoverCol !== null && (
            <div className="flex items-center px-3 py-1.5 rounded-lg bg-accent/10 border border-accent/30 text-[11px] text-accent font-semibold">
              <Move className="w-3.5 h-3.5 mr-1.5" />
              <span>
                Largue para posicionar na <strong>Coluna {dragHoverCol}</strong> (de 12)
              </span>
            </div>
          )}

          {/* Zona de Escrita em Grade de 12 Colunas */}
          <div
            ref={gridContainerRef}
            onDragOver={handleGridDragOver}
            onDrop={(e) => handleGridDrop(e)}
            style={
              showGridLines
                ? {
                    backgroundImage:
                      'linear-gradient(to right, rgba(113,113,122,0.08) 1px, transparent 1px), linear-gradient(to bottom, rgba(113,113,122,0.08) 1px, transparent 1px)',
                    backgroundSize: 'calc(100% / 12) 24px',
                  }
                : undefined
            }
            className="grid grid-cols-12 gap-2.5 min-h-[140px] p-2 rounded-xl border border-transparent relative"
          >
            {blocks.map((block, index) => {
              const span = normalizeGridSpan(block.gridSpan);
              const start = normalizeGridStart(block.gridStart, span);
              const isConfigOpen = cellConfigOpenForId === block.id;
              const isDragOver = dragOverBlockId === block.id;

              return (
                <div
                  key={block.id}
                  draggable
                  onDragStart={(e) => handleDragStart(e, block.id)}
                  onDragOver={(e) => {
                    e.preventDefault();
                    if (draggedBlockId && draggedBlockId !== block.id) {
                      setDragOverBlockId(block.id);
                    }
                  }}
                  onDragLeave={() => setDragOverBlockId(null)}
                  onDrop={(e) => handleGridDrop(e, block.id)}
                  style={gridCellStyle(span, start)}
                  className={`group relative flex flex-col gap-1.5 rounded-xl p-2 transition-all border min-w-0 ${
                    isDragOver
                      ? 'border-accent bg-accent/5'
                      : showGridLines
                      ? 'border-border/50 bg-surface/60 hover:border-border'
                      : 'border-transparent hover:bg-elevated/40'
                  }`}
                >
                  {/* Alça Direita de Redimensionamento */}
                  <div
                    title="Arraste para ajustar a largura da célula"
                    onMouseDown={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      setResizingState({
                        blockId: block.id,
                        startX: e.clientX,
                        initialSpan: span,
                        startCol: start,
                      });
                    }}
                    className="absolute right-0 top-2 bottom-2 w-2 cursor-ew-resize opacity-0 group-hover:opacity-100 hover:bg-accent/40 rounded-r-xl transition-opacity flex items-center justify-center z-20"
                  >
                    <div className="w-0.5 h-6 bg-border group-hover:bg-accent rounded-full" />
                  </div>

                  {/* Cabeçalho da Célula */}
                  <div className="flex items-center justify-between gap-1 opacity-0 group-hover:opacity-100 focus-within:opacity-100 transition-opacity text-[10px] text-muted select-none">
                    <div className="flex items-center gap-0.5">
                      <button
                        type="button"
                        onClick={() => {
                          setCellConfigOpenForId(null);
                          setMenuOpenForBlockId(
                            menuOpenForBlockId === block.id ? null : block.id
                          );
                        }}
                        className="p-1 rounded hover:bg-elevated text-secondary hover:text-accent"
                      >
                        <Plus className="w-3.5 h-3.5" />
                      </button>

                      <div className="p-1 rounded cursor-grab active:cursor-grabbing hover:bg-elevated text-secondary">
                        <GripVertical className="w-3.5 h-3.5" />
                      </div>

                      <button
                        type="button"
                        onClick={() => {
                          setMenuOpenForBlockId(null);
                          setCellConfigOpenForId(isConfigOpen ? null : block.id);
                        }}
                        className="flex items-center gap-1 px-1.5 py-0.5 rounded border bg-elevated border-border text-[9px] font-bold text-secondary hover:text-primary"
                      >
                        <SlidersHorizontal className="w-2.5 h-2.5" />
                        <span>
                          {getSpanLabel(span)}
                          {start > 0 ? ` · Col ${start}` : ''}
                        </span>
                      </button>
                    </div>

                    <div className="flex items-center gap-0.5">
                      <button
                        type="button"
                        onClick={() => moveBlockStep(block.id, 'up')}
                        disabled={index === 0}
                        className="p-1 rounded hover:bg-elevated text-muted hover:text-primary disabled:opacity-20"
                      >
                        <ArrowUp className="w-3 h-3" />
                      </button>
                      <button
                        type="button"
                        onClick={() => moveBlockStep(block.id, 'down')}
                        disabled={index === blocks.length - 1}
                        className="p-1 rounded hover:bg-elevated text-muted hover:text-primary disabled:opacity-20"
                      >
                        <ArrowDown className="w-3 h-3" />
                      </button>
                      <button
                        type="button"
                        onClick={() => removeBlock(block.id)}
                        className="p-1 rounded hover:bg-elevated text-muted hover:text-danger"
                      >
                        <Trash2 className="w-3 h-3" />
                      </button>
                    </div>
                  </div>

                  {isConfigOpen && (
                    <div className="absolute left-2 top-8 z-30 w-56 p-3 rounded-xl bg-surface border border-border shadow-2xl space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="text-[10px] font-bold text-primary uppercase">
                          Largura da Célula
                        </span>
                        <button
                          type="button"
                          onClick={() => setCellConfigOpenForId(null)}
                          className="text-muted hover:text-primary"
                        >
                          <X className="w-3.5 h-3.5" />
                        </button>
                      </div>
                      <div className="grid grid-cols-5 gap-1">
                        {CELL_SIZES.map((c) => (
                          <button
                            key={c.cols}
                            type="button"
                            onClick={() =>
                              updateBlock(block.id, {
                                gridSpan: c.cols,
                                gridStart: normalizeGridStart(start, c.cols),
                              })
                            }
                            className={`py-1 rounded text-[10px] font-bold border ${
                              span === c.cols
                                ? 'bg-accent text-white border-accent'
                                : 'bg-elevated border-border text-secondary'
                            }`}
                          >
                            {c.label}
                          </button>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Conteúdo Editável do Bloco */}
                  <div className="flex-1 min-w-0">
                    {(block.type === 'paragraph' ||
                      block.type === 'h1' ||
                      block.type === 'h2' ||
                      block.type === 'quote' ||
                      block.type === 'code') && (
                      <RichEditableCell
                        block={block}
                        placeholder={
                          block.type === 'h1'
                            ? 'Título da Atualização (ex: Notas de Atualização — Insight v1.5)...'
                            : block.type === 'h2'
                            ? 'Subtítulo da secção...'
                            : block.type === 'quote'
                            ? 'Citação...'
                            : block.type === 'code'
                            ? '// Código...'
                            : "Escreva os detalhes da atualização ou digite '/' para blocos..."
                        }
                        className={`${getFontClass(
                          block.fontStyle
                        )} ${getBlockTypographyClass(block.type)}`}
                        onFocus={() => setActiveBlockId(block.id)}
                        onChangeHtml={(html) => updateBlock(block.id, { html })}
                        onSlashTriggered={() => setMenuOpenForBlockId(block.id)}
                        onEnterPressed={() =>
                          insertBlockAfter(block.id, 'paragraph')
                        }
                        onBackspaceEmpty={() => removeBlock(block.id)}
                      />
                    )}

                    {block.type === 'bullet' && (
                      <div className="flex items-start gap-2">
                        <span className="text-accent font-bold mt-1">•</span>
                        <RichEditableCell
                          block={block}
                          placeholder="Item da atualização..."
                          className={`${getFontClass(
                            block.fontStyle
                          )} text-sm sm:text-base text-primary leading-relaxed`}
                          onFocus={() => setActiveBlockId(block.id)}
                          onChangeHtml={(html) => updateBlock(block.id, { html })}
                          onSlashTriggered={() => setMenuOpenForBlockId(block.id)}
                          onEnterPressed={() =>
                            insertBlockAfter(block.id, 'bullet')
                          }
                          onBackspaceEmpty={() => removeBlock(block.id)}
                        />
                      </div>
                    )}

                    {block.type === 'callout' && (
                      <div className="p-3 rounded-xl bg-elevated border border-accent/40 flex items-start gap-2.5">
                        <Sparkles className="w-4 h-4 text-accent shrink-0 mt-1" />
                        <RichEditableCell
                          block={block}
                          placeholder="Destaque da versão..."
                          className={`${getFontClass(
                            block.fontStyle
                          )} text-sm text-primary leading-relaxed`}
                          onFocus={() => setActiveBlockId(block.id)}
                          onChangeHtml={(html) => updateBlock(block.id, { html })}
                          onSlashTriggered={() => setMenuOpenForBlockId(block.id)}
                          onEnterPressed={() =>
                            insertBlockAfter(block.id, 'paragraph')
                          }
                          onBackspaceEmpty={() => removeBlock(block.id)}
                        />
                      </div>
                    )}

                    {block.type === 'divider' && (
                      <div className="py-3">
                        <hr className="border-border" />
                      </div>
                    )}

                    {block.type === 'image' && (
                      <div className="p-2.5 rounded-xl bg-elevated border border-border space-y-2">
                        {!block.imageUrl ? (
                          <label className="flex flex-col items-center justify-center py-5 px-2 border border-dashed border-border rounded-xl cursor-pointer hover:border-accent text-center">
                            <ImageIcon className="w-5 h-5 text-accent mb-1" />
                            <span className="text-[11px] font-semibold text-primary">
                              {uploadingBlockId === block.id
                                ? 'A enviar...'
                                : 'Selecionar imagem'}
                            </span>
                            <input
                              type="file"
                              accept="image/*"
                              onChange={(e) => handleBlockImageUpload(e, block.id)}
                              className="hidden"
                            />
                          </label>
                        ) : (
                          <div className="space-y-2">
                            <div className="flex items-center justify-between text-[10px]">
                              <div className="flex items-center gap-1 bg-surface p-1 rounded-lg border border-border">
                                {(
                                  ['25%', '50%', '75%', '100%'] as ImageWidthType[]
                                ).map((w) => (
                                  <button
                                    key={w}
                                    type="button"
                                    onClick={() =>
                                      updateBlock(block.id, { imageWidth: w })
                                    }
                                    className={`px-1.5 py-0.5 rounded font-bold ${
                                      (block.imageWidth || '100%') === w
                                        ? 'bg-accent text-white'
                                        : 'text-secondary'
                                    }`}
                                  >
                                    {w}
                                  </button>
                                ))}
                              </div>
                              <button
                                type="button"
                                onClick={() =>
                                  updateBlock(block.id, { imageUrl: null })
                                }
                                className="p-1 text-muted hover:text-danger"
                              >
                                <X className="w-3.5 h-3.5" />
                              </button>
                            </div>
                            <img
                              src={block.imageUrl}
                              alt="Preview"
                              style={{ width: block.imageWidth || '100%' }}
                              className="rounded-xl border border-border mx-auto"
                            />
                          </div>
                        )}
                      </div>
                    )}

                    {block.type === 'video' && (
                      <div className="p-2.5 rounded-xl bg-elevated border border-border space-y-2">
                        {!block.videoUrl ? (
                          <label className="flex flex-col items-center justify-center py-5 px-2 border border-dashed border-border rounded-xl cursor-pointer hover:border-accent text-center">
                            <Film className="w-5 h-5 text-accent mb-1" />
                            <span className="text-[11px] font-semibold text-primary">
                              {uploadingBlockId === block.id
                                ? 'A compactar e enviar para R2...'
                                : 'Selecionar vídeo (Cloudflare R2)'}
                            </span>
                            <input
                              type="file"
                              accept="video/mp4,video/webm,image/gif"
                              onChange={(e) => handleBlockVideoUpload(e, block.id)}
                              className="hidden"
                            />
                          </label>
                        ) : (
                          <div className="space-y-2">
                            <div className="flex justify-end">
                              <button
                                type="button"
                                onClick={() =>
                                  updateBlock(block.id, { videoUrl: null })
                                }
                                className="text-xs text-muted hover:text-danger"
                              >
                                Remover vídeo
                              </button>
                            </div>
                            <video
                              src={block.videoUrl}
                              controls
                              playsInline
                              className="w-full max-h-80 rounded-xl bg-black"
                            />
                          </div>
                        )}
                      </div>
                    )}

                    {block.type === 'table' && (
                      <div className="p-2.5 rounded-xl bg-elevated border border-border space-y-2 overflow-x-auto">
                        <div className="flex items-center justify-between text-[10px]">
                          <span className="font-bold text-accent">Tabela</span>
                          <div className="flex items-center gap-1">
                            <button
                              type="button"
                              onClick={() => {
                                const curr = block.tableData || [['']];
                                const cols = curr[0]?.length || 1;
                                updateBlock(block.id, {
                                  tableData: [...curr, Array(cols).fill('')],
                                });
                              }}
                              className="px-1.5 py-0.5 rounded bg-surface border border-border text-secondary"
                            >
                              +Linha
                            </button>
                            <button
                              type="button"
                              onClick={() => {
                                const curr = block.tableData || [['']];
                                updateBlock(block.id, {
                                  tableData: curr.map((r, i) => [
                                    ...r,
                                    i === 0 ? `Col ${r.length + 1}` : '',
                                  ]),
                                });
                              }}
                              className="px-1.5 py-0.5 rounded bg-surface border border-border text-secondary"
                            >
                              +Col
                            </button>
                          </div>
                        </div>
                        <table className="w-full border-collapse text-xs">
                          <tbody>
                            {(block.tableData || []).map((row, rIdx) => (
                              <tr key={rIdx}>
                                {row.map((cell, cIdx) => (
                                  <td
                                    key={cIdx}
                                    className="border border-border bg-background p-0"
                                  >
                                    <input
                                      type="text"
                                      value={cell}
                                      onChange={(e) => {
                                        const copy = (block.tableData || []).map(
                                          (r) => [...r]
                                        );
                                        copy[rIdx][cIdx] = e.target.value;
                                        updateBlock(block.id, { tableData: copy });
                                      }}
                                      className={`w-full px-2 py-1 bg-transparent text-[11px] focus:outline-none ${
                                        rIdx === 0
                                          ? 'font-bold text-primary'
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
                    )}

                    {block.type === 'roadmap' && (
                      <div className="p-3 rounded-xl bg-elevated border border-border space-y-2.5">
                        <div className="flex items-center justify-between">
                          <span className="text-[11px] font-bold text-primary flex items-center gap-1.5">
                            <Compass className="w-3.5 h-3.5 text-accent" />
                            <span>Roadmap</span>
                          </span>
                          <button
                            type="button"
                            onClick={() => {
                              const curr = block.roadmapSteps || [];
                              const next: RoadmapStepItem[] = [
                                ...curr,
                                {
                                  id: `step-${Date.now()}`,
                                  phase: `Fase 0${curr.length + 1}`,
                                  title: 'Novo marco',
                                  description: 'Descrição...',
                                  status: 'planned',
                                },
                              ];
                              updateBlock(block.id, { roadmapSteps: next });
                            }}
                            className="text-[10px] font-semibold text-accent hover:underline"
                          >
                            + Adicionar etapa
                          </button>
                        </div>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                          {(block.roadmapSteps || []).map((step) => (
                            <div
                              key={step.id}
                              className="p-2.5 rounded-xl bg-surface border border-border space-y-1"
                            >
                              <input
                                type="text"
                                value={step.phase}
                                onChange={(e) => {
                                  const next = (block.roadmapSteps || []).map((s) =>
                                    s.id === step.id
                                      ? { ...s, phase: e.target.value }
                                      : s
                                  );
                                  updateBlock(block.id, { roadmapSteps: next });
                                }}
                                className="w-full bg-transparent font-mono text-[10px] font-bold uppercase text-accent focus:outline-none"
                              />
                              <input
                                type="text"
                                value={step.title}
                                onChange={(e) => {
                                  const next = (block.roadmapSteps || []).map((s) =>
                                    s.id === step.id
                                      ? { ...s, title: e.target.value }
                                      : s
                                  );
                                  updateBlock(block.id, { roadmapSteps: next });
                                }}
                                className="w-full bg-transparent text-xs font-bold text-primary focus:outline-none"
                              />
                              <textarea
                                rows={2}
                                value={step.description}
                                onChange={(e) => {
                                  const next = (block.roadmapSteps || []).map((s) =>
                                    s.id === step.id
                                      ? { ...s, description: e.target.value }
                                      : s
                                  );
                                  updateBlock(block.id, { roadmapSteps: next });
                                }}
                                className="w-full bg-transparent text-[11px] text-secondary resize-none focus:outline-none"
                              />
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {block.type === 'chart' && (
                      <div className="p-3 rounded-xl bg-elevated border border-border space-y-2">
                        <input
                          type="text"
                          value={block.chartTitle || ''}
                          onChange={(e) =>
                            updateBlock(block.id, { chartTitle: e.target.value })
                          }
                          placeholder="Título do gráfico..."
                          className="w-full bg-transparent text-xs font-bold text-primary focus:outline-none"
                        />
                        {(block.chartData || []).map((item, idx) => (
                          <div key={idx} className="flex items-center gap-1.5">
                            <input
                              type="color"
                              value={item.color}
                              onChange={(e) => {
                                const next = [...(block.chartData || [])];
                                next[idx] = { ...item, color: e.target.value };
                                updateBlock(block.id, { chartData: next });
                              }}
                              className="w-5 h-5 rounded cursor-pointer border-0"
                            />
                            <input
                              type="text"
                              value={item.label}
                              onChange={(e) => {
                                const next = [...(block.chartData || [])];
                                next[idx] = { ...item, label: e.target.value };
                                updateBlock(block.id, { chartData: next });
                              }}
                              className="flex-1 bg-surface border border-border rounded px-2 py-1 text-[11px] text-primary"
                            />
                            <input
                              type="number"
                              value={item.value}
                              onChange={(e) => {
                                const next = [...(block.chartData || [])];
                                next[idx] = {
                                  ...item,
                                  value: Number(e.target.value) || 0,
                                };
                                updateBlock(block.id, { chartData: next });
                              }}
                              className="w-16 bg-surface border border-border rounded px-2 py-1 text-[11px] font-mono text-primary"
                            />
                          </div>
                        ))}
                      </div>
                    )}

                    {block.type === 'poll' && (
                      <div className="p-3 rounded-xl bg-elevated border border-border space-y-2">
                        <input
                          type="text"
                          value={block.pollQuestion || ''}
                          onChange={(e) =>
                            updateBlock(block.id, { pollQuestion: e.target.value })
                          }
                          placeholder="Pergunta da enquete..."
                          className="w-full bg-surface border border-border rounded-lg px-2.5 py-1.5 text-xs font-bold text-primary"
                        />
                        {(block.pollOptions || []).map((opt, idx) => (
                          <input
                            key={opt.id}
                            type="text"
                            value={opt.text}
                            onChange={(e) => {
                              const next = [...(block.pollOptions || [])];
                              next[idx] = { ...opt, text: e.target.value };
                              updateBlock(block.id, { pollOptions: next });
                            }}
                            className="w-full bg-surface border border-border rounded-lg px-2 py-1 text-xs text-primary"
                          />
                        ))}
                      </div>
                    )}

                    {block.type === 'file' && (
                      <div className="p-2.5 rounded-xl bg-elevated border border-border">
                        {!block.fileUrl ? (
                          <label className="flex flex-col items-center justify-center py-4 px-2 border border-dashed border-border rounded-xl cursor-pointer hover:border-accent text-center">
                            <Paperclip className="w-4 h-4 text-accent mb-1" />
                            <span className="text-[11px] font-semibold text-primary">
                              Anexar arquivo
                            </span>
                            <input
                              type="file"
                              onChange={(e) => handleBlockFileUpload(e, block.id)}
                              className="hidden"
                            />
                          </label>
                        ) : (
                          <div className="flex items-center justify-between text-xs">
                            <span className="font-bold text-primary truncate">
                              {block.fileName}
                            </span>
                            <button
                              type="button"
                              onClick={() =>
                                updateBlock(block.id, { fileUrl: null })
                              }
                              className="text-muted hover:text-danger"
                            >
                              <X className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        )}
                      </div>
                    )}

                    {block.type === 'spotify' && (
                      <div className="p-2.5 rounded-xl bg-elevated border border-border">
                        {!block.spotifyTrackId ? (
                          <div className="flex items-center gap-2">
                            <Music className="w-4 h-4 text-[#1DB954]" />
                            <input
                              type="text"
                              placeholder="Digite o nome da música ou cole o link do Spotify e pressione Enter..."
                              onKeyDown={(e) => {
                                if (e.key === 'Enter') {
                                  e.preventDefault();
                                  const val = e.currentTarget.value.trim();
                                  if (val)
                                    updateBlock(block.id, { spotifyTrackId: val });
                                }
                              }}
                              className="flex-1 bg-transparent text-xs text-primary focus:outline-none"
                            />
                          </div>
                        ) : (
                          <div className="flex items-center gap-2">
                            <CustomSpotifyPlayer trackId={block.spotifyTrackId} />
                            <button
                              type="button"
                              onClick={() =>
                                updateBlock(block.id, { spotifyTrackId: null })
                              }
                              className="text-muted hover:text-danger"
                            >
                              <X className="w-4 h-4" />
                            </button>
                          </div>
                        )}
                      </div>
                    )}

                    {/* Menu Flutuante de Blocos */}
                    {menuOpenForBlockId === block.id && (
                      <div className="absolute left-0 top-9 z-30 w-72 sm:w-96 p-2 rounded-2xl bg-surface border border-border shadow-2xl grid grid-cols-2 gap-1">
                        {BLOCK_MENU_ITEMS.map((item) => {
                          const Icon = item.icon;
                          return (
                            <button
                              key={item.type}
                              type="button"
                              onClick={() => {
                                const isCurrentEmpty = !(block.html || '')
                                  .replace(/<[^>]*>/g, '')
                                  .trim();
                                if (isCurrentEmpty) {
                                  updateBlock(block.id, {
                                    type: item.type,
                                    fontStyle:
                                      item.type === 'code'
                                        ? 'mono'
                                        : block.fontStyle,
                                  });
                                  setMenuOpenForBlockId(null);
                                } else {
                                  insertBlockAfter(block.id, item.type);
                                }
                              }}
                              className="flex items-center gap-2 px-2 py-1.5 rounded-xl hover:bg-elevated text-left"
                            >
                              <div className="p-1.5 rounded-lg bg-elevated border border-border text-accent shrink-0">
                                <Icon className="w-3.5 h-3.5" />
                              </div>
                              <div className="min-w-0">
                                <p className="text-[11px] font-bold text-primary truncate">
                                  {item.label}
                                </p>
                                <p className="text-[9px] text-muted truncate">
                                  {item.desc}
                                </p>
                              </div>
                            </button>
                          );
                        })}
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>

          <div className="flex items-center justify-between pt-2 border-t border-border">
            <div className="flex flex-wrap items-center gap-1.5">
              <button
                type="button"
                onClick={() =>
                  insertBlockAfter(blocks[blocks.length - 1].id, 'paragraph')
                }
                className="px-2.5 py-1 rounded-lg bg-elevated border border-border text-xs font-semibold text-secondary hover:text-primary"
              >
                + Texto
              </button>
              <button
                type="button"
                onClick={() =>
                  insertBlockAfter(blocks[blocks.length - 1].id, 'h2')
                }
                className="px-2.5 py-1 rounded-lg bg-elevated border border-border text-xs font-semibold text-secondary hover:text-primary"
              >
                + Subtítulo H2
              </button>
              <button
                type="button"
                onClick={() =>
                  insertBlockAfter(blocks[blocks.length - 1].id, 'bullet')
                }
                className="px-2.5 py-1 rounded-lg bg-elevated border border-border text-xs font-semibold text-secondary hover:text-primary"
              >
                + Lista
              </button>
              <button
                type="button"
                onClick={() =>
                  insertBlockAfter(blocks[blocks.length - 1].id, 'divider')
                }
                className="px-2.5 py-1 rounded-lg bg-elevated border border-border text-xs font-semibold text-secondary hover:text-primary"
              >
                + Divisória
              </button>
              <button
                type="button"
                onClick={() =>
                  insertBlockAfter(blocks[blocks.length - 1].id, 'table')
                }
                className="px-2.5 py-1 rounded-lg bg-elevated border border-border text-xs font-semibold text-secondary hover:text-primary"
              >
                + Tabela
              </button>
            </div>

            <button
              type="submit"
              disabled={isSubmitting}
              className="px-5 py-2 rounded-xl bg-accent text-white text-xs font-bold flex items-center gap-2 hover:bg-accent-hover disabled:opacity-50"
            >
              <Send className="w-3.5 h-3.5" />
              <span>
                {isSubmitting
                  ? 'Salvando...'
                  : editingUpdate
                  ? 'Salvar Alterações'
                  : 'Publicar Atualização'}
              </span>
            </button>
          </div>
        </form>
      )}

      {/* 2. DIVISOR "LINHA DO TEMPO" (FIEL AO LAYOUT ORIGINAL) */}
      <div className="flex items-center gap-3 text-xs font-semibold text-secondary">
        <span>Linha do tempo</span>
        <div className="flex-1 h-px bg-border" />
      </div>

      {/* 3. LISTA CRONOLÓGICA DAS SUAS ATUALIZAÇÕES OFICIAIS */}
      {loading ? (
        <p className="text-xs text-muted text-center py-12">
          Carregando linha do tempo...
        </p>
      ) : updates.length === 0 ? (
        <div className="p-8 rounded-2xl bg-surface border border-border text-center space-y-1">
          <p className="text-sm font-bold text-primary">
            Nenhuma atualização encontrada.
          </p>
          <p className="text-xs text-muted">
            As notas oficiais publicadas aparecerão nesta linha do tempo.
          </p>
        </div>
      ) : (
        <div className="space-y-5">
          {updates.map((update) => {
            const formattedDate = new Date(update.created_at).toLocaleDateString(
              'pt-BR',
              {
                day: '2-digit',
                month: 'short',
                year: 'numeric',
              }
            );

            return (
              <article
                key={update.id}
                className="p-6 rounded-2xl bg-surface border border-border space-y-4 shadow-sm"
              >
                {/* Cabeçalho do Card: "📣 Atualização oficial" | "Victor Poiani · Data" */}
                <div className="flex items-center justify-between gap-3">
                  <div className="flex items-center gap-2 text-xs font-bold text-accent">
                    <Megaphone className="w-4 h-4 shrink-0" />
                    <span>Atualização oficial</span>
                  </div>

                  <div className="flex items-center gap-2 text-xs text-muted">
                    <span>
                      {update.author_name || 'Victor Poiani'} · {formattedDate}
                    </span>

                    {isAdmin && (
                      <div className="flex items-center gap-1 ml-1">
                        <button
                          type="button"
                          onClick={() => startEditingUpdate(update)}
                          title="Editar atualização com o editor em grade"
                          className="p-1 rounded-lg text-muted hover:text-accent hover:bg-elevated transition-colors"
                        >
                          <Pencil className="w-3.5 h-3.5" />
                        </button>
                        <button
                          type="button"
                          onClick={() => handleDeleteUpdate(update)}
                          title="Excluir atualização"
                          className="p-1 rounded-lg text-muted hover:text-danger hover:bg-elevated transition-colors"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    )}
                  </div>
                </div>

                {/* Corpo Renderizado com suporte à Grade de 12 Colunas e a todos os blocos antigos e novos */}
                <div className="notion-content grid grid-cols-12 gap-3 text-sm sm:text-base text-primary leading-relaxed items-start">
                  {update.blocks.map((b, idx) => {
                    const fontCls = getFontClass(b.fontStyle);
                    const alignStyle = { textAlign: b.align || 'left' } as const;
                    const cellStyle = gridCellStyle(b.gridSpan, b.gridStart);

                    if (b.type === 'divider') {
                      return (
                        <div key={b.id || idx} style={cellStyle}>
                          <hr className="border-border my-2" />
                        </div>
                      );
                    }

                    if (b.type === 'h1') {
                      return (
                        <h2
                          key={b.id || idx}
                          style={{ ...cellStyle, ...alignStyle }}
                          className={`${fontCls} text-xl sm:text-2xl font-extrabold text-primary leading-tight pt-1`}
                          dangerouslySetInnerHTML={{ __html: b.html || '' }}
                        />
                      );
                    }

                    if (b.type === 'h2') {
                      return (
                        <h3
                          key={b.id || idx}
                          style={{ ...cellStyle, ...alignStyle }}
                          className={`${fontCls} text-base sm:text-lg font-bold text-primary leading-snug pt-1`}
                          dangerouslySetInnerHTML={{ __html: b.html || '' }}
                        />
                      );
                    }

                    if (b.type === 'quote') {
                      return (
                        <blockquote
                          key={b.id || idx}
                          style={{ ...cellStyle, ...alignStyle }}
                          className={`${fontCls} border-l-4 border-accent pl-4 italic text-secondary`}
                          dangerouslySetInnerHTML={{ __html: b.html || '' }}
                        />
                      );
                    }

                    if (b.type === 'callout') {
                      return (
                        <div
                          key={b.id || idx}
                          style={cellStyle}
                          className="p-3.5 rounded-xl bg-elevated border border-accent/40 flex items-start gap-3"
                        >
                          <Sparkles className="w-4 h-4 text-accent shrink-0 mt-1" />
                          <div
                            style={alignStyle}
                            className={`${fontCls} text-sm text-primary flex-1`}
                            dangerouslySetInnerHTML={{ __html: b.html || '' }}
                          />
                        </div>
                      );
                    }

                    if (b.type === 'code') {
                      return (
                        <pre
                          key={b.id || idx}
                          style={cellStyle}
                          className="p-3.5 rounded-xl bg-elevated border border-border font-mono text-xs text-primary overflow-x-auto whitespace-pre-wrap"
                          dangerouslySetInnerHTML={{ __html: b.html || '' }}
                        />
                      );
                    }

                    if (b.type === 'bullet') {
                      return (
                        <div
                          key={b.id || idx}
                          style={cellStyle}
                          className="flex items-start gap-2.5 pl-1"
                        >
                          <span className="text-primary font-bold">•</span>
                          <div
                            style={alignStyle}
                            className={`${fontCls} flex-1`}
                            dangerouslySetInnerHTML={{ __html: b.html || '' }}
                          />
                        </div>
                      );
                    }

                    if (b.type === 'image' && b.imageUrl) {
                      return (
                        <div key={b.id || idx} style={cellStyle} className="w-full py-1">
                          <figure
                            style={{ width: b.imageWidth || '100%' }}
                            className={`${getImageAlignClass(b.imageAlign)} space-y-1.5`}
                          >
                            <img
                              src={b.imageUrl}
                              alt={b.imageCaption || 'Imagem da atualização'}
                              className="w-full h-auto rounded-xl border border-border object-cover"
                              loading="lazy"
                            />
                            {b.imageCaption && (
                              <figcaption className="text-xs text-muted text-center">
                                {b.imageCaption}
                              </figcaption>
                            )}
                          </figure>
                        </div>
                      );
                    }

                    if ((b.type === 'video' || b.type === 'gif') && b.videoUrl) {
                      return (
                        <div key={b.id || idx} style={cellStyle} className="w-full py-1">
                          <video
                            src={`${b.videoUrl}#t=0.001`}
                            controls={!b.isGif}
                            autoPlay={Boolean(b.isGif)}
                            loop={Boolean(b.isGif)}
                            muted={Boolean(b.isGif)}
                            playsInline
                            className="w-full max-h-[480px] rounded-xl border border-border bg-black object-contain"
                          />
                        </div>
                      );
                    }

                    if (b.type === 'table' && Array.isArray(b.tableData)) {
                      return (
                        <div
                          key={b.id || idx}
                          style={cellStyle}
                          className="rounded-xl border border-border overflow-x-auto"
                        >
                          <table className="w-full border-collapse text-xs">
                            <tbody>
                              {b.tableData.map((row, rIdx) => (
                                <tr
                                  key={rIdx}
                                  className={
                                    rIdx === 0
                                      ? 'bg-elevated font-bold text-primary'
                                      : 'bg-surface text-secondary'
                                  }
                                >
                                  {(Array.isArray(row) ? row : []).map(
                                    (cell, cIdx) => (
                                      <td
                                        key={cIdx}
                                        className="border border-border px-3 py-2 text-left"
                                      >
                                        {cell}
                                      </td>
                                    )
                                  )}
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      );
                    }

                    if (b.type === 'roadmap' && Array.isArray(b.roadmapSteps)) {
                      return (
                        <div
                          key={b.id || idx}
                          style={cellStyle}
                          className="p-4 rounded-xl bg-elevated border border-border space-y-2.5"
                        >
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                            {b.roadmapSteps.map((step) => (
                              <div
                                key={step.id}
                                className="p-3 rounded-xl bg-surface border border-border space-y-1"
                              >
                                <span className="font-mono text-[10px] font-bold uppercase text-accent">
                                  {step.phase}
                                </span>
                                <p className="text-xs font-bold text-primary">
                                  {step.title}
                                </p>
                                <p className="text-[11px] text-secondary">
                                  {step.description}
                                </p>
                              </div>
                            ))}
                          </div>
                        </div>
                      );
                    }

                    if (b.type === 'file' && b.fileUrl) {
                      return (
                        <a
                          key={b.id || idx}
                          style={cellStyle}
                          href={b.fileUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="flex items-center justify-between gap-3 p-3 rounded-xl bg-elevated border border-border hover:border-accent"
                        >
                          <div className="flex items-center gap-2.5 min-w-0">
                            <FileText className="w-4 h-4 text-accent shrink-0" />
                            <div className="truncate">
                              <p className="text-xs font-bold text-primary truncate">
                                {b.fileName || 'Anexo'}
                              </p>
                              <p className="text-[10px] font-mono text-muted">
                                {formatBytes(b.fileSize)}
                              </p>
                            </div>
                          </div>
                          <Download className="w-4 h-4 text-accent shrink-0" />
                        </a>
                      );
                    }

                    if (b.type === 'spotify' && b.spotifyTrackId) {
                      return (
                        <div key={b.id || idx} style={cellStyle} className="py-1">
                          <CustomSpotifyPlayer trackId={b.spotifyTrackId} />
                        </div>
                      );
                    }

                    return (
                      <div
                        key={b.id || idx}
                        style={{ ...cellStyle, ...alignStyle }}
                        className={`${fontCls} leading-relaxed`}
                        dangerouslySetInnerHTML={{ __html: b.html || '' }}
                      />
                    );
                  })}
                </div>
              </article>
            );
          })}
        </div>
      )}
    </div>
  );
}