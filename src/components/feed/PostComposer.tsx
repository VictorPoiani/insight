'use client';

import { useAutoFocusMode } from '@/lib/useAutoFocusMode';
import { PanZoomSurface, boundsFromPercent } from '@/components/canvas/PanZoom';
import { MINDMAP_WORLD } from '@/components/canvas/MindMapViewer';
import { useState, useRef, useEffect, useCallback } from 'react';
import { createClient } from '@/lib/supabase/client';
import { gridCellStyle, normalizeGridStart, normalizeGridSpan } from '@/lib/grid';
import { uploadMediaToInsight, MediaQuotaError, type UploadR2Result } from '@/lib/mediaCompressor';
import { formatBytes, getTierByLevel, getUserUploadLimitBytes } from '@/lib/contributorLevels';
import { useNitro } from '@/components/nitro/NitroProvider';
import { draftStatusLabel, useCloudDraft } from '@/lib/drafts/useCloudDraft';
import { DEFAULT_TABS, renderTopicVectorIcon } from './TopicTabsManager';
import { CustomSpotifyPlayer } from './CustomSpotifyPlayer';
import { SpotifySearchModal } from './SpotifySearchModal';
import {
  Post,
  PostBlock,
  PostBlockType,
  FontStyleType,
  ImageWidthType,
  ImageAlignType,
  PostVisibility,
  CustomTopic,
  RoadmapStepItem,
  MindMapNodeItem,
} from '@/types/database';
import {
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
  Image as ImageIcon,
  Film,
  Clapperboard,
  Search,
  Music,
  Heading1,
  Heading2,
  Quote,
  Sparkles,
  Code,
  List,
  Minus,
  Pin,
  Send,
  Hash,
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
  SpellCheck,
  Check,
  EyeOff,
  MoreHorizontal,
  Move,
  Globe,
  Lock,
  FolderPlus,
  Compass,
  Network,
  Link2,
  ImagePlus,
} from 'lucide-react';

interface PostComposerProps {
  authorId: string;
  isAdmin?: boolean;
  onPostCreated?: () => void;
  defaultTag?: string | null;
  editingPost?: Post | null;
  onCancelEdit?: () => void;
  onPostUpdated?: (updatedPost: Post) => void;
  /**
   * My Notebook: o compositor vira editor de blocos de uma nota (sem tópicos,
   * tags, visibilidade nem botão de publicar). Cada mudança chama onBlocksChange.
   */
  embedded?: { initialBlocks: PostBlock[]; onBlocksChange: (blocks: PostBlock[]) => void };
  /** Abre o compositor já preenchido (ex.: publicar um capítulo do notebook). */
  prefillBlocks?: PostBlock[] | null;
  /** Escopo próprio do rascunho na nuvem (evita misturar com o rascunho do feed). */
  draftScopeOverride?: string;
  /** Chamado com o id do post criado. */
  onPublished?: (postId: string) => void;
}

interface WritingIssue {
  id: string;
  blockId: string;
  wrongText: string;
  message: string;
  replacements: string[];
  category: 'ortografia' | 'sintaxe';
}

interface GiphyItem {
  id: string;
  title: string;
  previewUrl: string;
  fullUrl: string;
  mp4Url?: string | null;
}

interface AvailableTopicOption {
  id: string;
  label: string;
  tag: string;
  color: string;
  icon?: string | null;
}

/**
 * Peso final (R2, pós-compressão) de todas as mídias do post. Só conta blocos
 * cuja mídia ainda está anexada. É a mesma soma que o banco faz ao salvar.
 */
function sumPostMediaBytes(blocks: PostBlock[]): number {
  let total = 0;
  for (const b of blocks) {
    if (b.imageUrl || b.videoUrl || b.fileUrl) total += b.mediaBytes || 0;
    for (const n of b.mindMapNodes || []) if (n.mediaUrl) total += n.mediaBytes || 0;
    for (const st of b.roadmapSteps || []) if (st.mediaUrl) total += st.mediaBytes || 0;
  }
  return total;
}

function uploadErrorMessage(err: unknown, fallback: string): string {
  if (err instanceof MediaQuotaError) return err.message;
  return err instanceof Error ? err.message : fallback;
}

function compressionBadge(r: UploadR2Result): string {
  if (r.savedPercent > 0) return `${formatBytes(r.originalSize)} → ${formatBytes(r.compressedSize)} (-${r.savedPercent}%)`;
  if (r.note) return `${formatBytes(r.compressedSize)} · ${r.note}`;
  return `${formatBytes(r.compressedSize)} (otimizado)`;
}

const GIPHY_QUICK_TAGS = [
  { label: 'Em Alta', query: '' },
  { label: 'Dev & Code', query: 'coding developer' },
  { label: 'Rock & Música', query: 'rock guitar' },
  { label: 'Reações', query: 'reaction meme' },
  { label: 'Cinema & Sci-Fi', query: 'sci fi cinema' },
  { label: 'Celebração', query: 'celebration win' },
];

const HIGHLIGHT_COLORS = [
  { name: 'Azul Metálico', color: 'rgba(37, 99, 235, 0.42)' },
  { name: 'Amarelo', color: 'rgba(250, 204, 21, 0.35)' },
  { name: 'Verde', color: 'rgba(29, 185, 84, 0.35)' },
  { name: 'Roxo', color: 'rgba(168, 85, 247, 0.40)' },
  { name: 'Vermelho', color: 'rgba(239, 68, 68, 0.38)' },
];

const CHART_PALETTE = ['#2563eb', '#10b981', '#f59e0b', '#8b5cf6', '#ec4899', '#06b6d4'];
const NODE_COLORS = ['#2563eb', '#10b981', '#a855f7', '#f59e0b', '#E63946', '#38bdf8'];

const CELL_SIZES = [
  { cols: 3, label: '25%' },
  { cols: 4, label: '33%' },
  { cols: 6, label: '50%' },
  { cols: 8, label: '66%' },
  { cols: 12, label: '100%' },
];

const LOCAL_PT_RULES: {
  pattern: RegExp;
  message: string;
  replacements: string[];
  category: 'ortografia' | 'sintaxe';
}[] = [
  {
    pattern: /\bsujest(ão|ões)\b/gi,
    message: 'Ortografia: "sugestão" escreve-se com "g".',
    replacements: ['sugestão', 'sugestões'],
    category: 'ortografia',
  },
  {
    pattern: /\badcion(ar|ado|ou|a|ando)\b/gi,
    message: 'Ortografia: falta a vogal "i" em "adicionar".',
    replacements: ['adicionar', 'adicionado', 'adicionou', 'adiciona'],
    category: 'ortografia',
  },
  {
    pattern: /\btamamnho\b/gi,
    message: 'Erro de digitação na palavra "tamanho".',
    replacements: ['tamanho'],
    category: 'ortografia',
  },
  {
    pattern: /\bmelhorara-la\b/gi,
    message: 'Acentuação e conjugação: o correto no infinitivo com pronome é "melhorá-la".',
    replacements: ['melhorá-la'],
    category: 'sintaxe',
  },
  {
    pattern: /\barrastalo\b/gi,
    message: 'Sintaxe pronominal: exige hífen e acento ("arrastá-lo").',
    replacements: ['arrastá-lo'],
    category: 'sintaxe',
  },
  {
    pattern: /\ba onde\b/gi,
    message: 'Sintaxe: utilize "onde" (lugar fixo) ou "aonde" (movimento).',
    replacements: ['onde', 'aonde'],
    category: 'sintaxe',
  },
  {
    pattern: /\bconcerteza\b/gi,
    message: 'Ortografia: a expressão "com certeza" escreve-se separada.',
    replacements: ['com certeza'],
    category: 'ortografia',
  },
  {
    pattern: /\bderrepente\b/gi,
    message: 'Ortografia: "de repente" escreve-se separado.',
    replacements: ['de repente'],
    category: 'ortografia',
  },
  {
    pattern: /\bporisso\b/gi,
    message: 'Ortografia: "por isso" escreve-se separado.',
    replacements: ['por isso'],
    category: 'ortografia',
  },
  {
    pattern: /\ba gente (fomos|vamos ir|estávamos)\b/gi,
    message: 'Sintaxe de concordância: "a gente" concorda na 3.ª pessoa do singular.',
    replacements: ['a gente foi', 'a gente vai', 'a gente estava'],
    category: 'sintaxe',
  },
  {
    pattern: /\bhaviam (muitos|muitas|vários|várias|alguns|algumas)\b/gi,
    message: 'Sintaxe: o verbo "haver" no sentido de existir é impessoal (use "havia").',
    replacements: ['havia muitos', 'havia muitas', 'havia vários'],
    category: 'sintaxe',
  },
  {
    pattern: /\bfazem (\d+) (anos|meses|dias|horas)\b/gi,
    message: 'Sintaxe: o verbo "fazer" indicando tempo decorrido fica no singular ("faz").',
    replacements: ['faz'],
    category: 'sintaxe',
  },
  {
    pattern: /\bpara mim (fazer|ver|criar|ir|escrever|ler|postar)\b/gi,
    message: 'Sintaxe: antes de verbo no infinitivo, usa-se o pronome reto "eu".',
    replacements: ['para eu fazer', 'para eu ver', 'para eu criar', 'para eu escrever'],
    category: 'sintaxe',
  },
];

const BLOCK_MENU_ITEMS: {
  type: PostBlockType;
  label: string;
  desc: string;
  icon: React.ComponentType<{ className?: string }>;
}[] = [
  { type: 'paragraph', label: 'Texto', desc: 'Parágrafo', icon: AlignLeft },
  { type: 'h1', label: 'Título H1', desc: 'Cabeçalho principal', icon: Heading1 },
  { type: 'h2', label: 'Subtítulo H2', desc: 'Secção média', icon: Heading2 },
  { type: 'quote', label: 'Citação', desc: 'Barra lateral', icon: Quote },
  { type: 'callout', label: 'Nota Técnica', desc: 'Caixa de destaque', icon: Sparkles },
  { type: 'bullet', label: 'Lista', desc: 'Marcador em tópico', icon: List },
  { type: 'code', label: 'Código', desc: 'Bloco monoespaçado', icon: Code },
  { type: 'image', label: 'Imagem', desc: 'Lateral ou centro', icon: ImageIcon },
  { type: 'video', label: 'Vídeo', desc: 'Compactado · R2', icon: Film },
  { type: 'gif', label: 'GIF (GIPHY)', desc: 'Catálogo GIPHY', icon: Clapperboard },
  { type: 'mindmap', label: 'Mapa Mental 2D', desc: 'Quadro de brainstorm', icon: Network },
  { type: 'roadmap', label: 'Roadmap', desc: 'Fases e entregas', icon: Compass },
  { type: 'chart', label: 'Gráfico', desc: 'Barras ou Rosca', icon: BarChart3 },
  { type: 'poll', label: 'Enquete', desc: 'Votação interativa', icon: CheckSquare },
  { type: 'table', label: 'Tabela', desc: 'Linhas e colunas', icon: Table },
  { type: 'file', label: 'Arquivo', desc: 'Anexo na cota do post', icon: Paperclip },
  { type: 'spotify', label: 'Spotify', desc: 'Player de áudio', icon: Music },
  { type: 'divider', label: 'Divisória', desc: 'Linha separadora', icon: Minus },
];

export function extractSpotifyTrackId(urlOrId: string): string | null {
  if (!urlOrId) return null;
  const trimmed = urlOrId.trim();
  if (trimmed.includes('open.spotify.com/track/')) {
    return trimmed.split('track/')[1]?.split('?')[0] || null;
  }
  if (trimmed.includes('spotify:track:')) {
    return trimmed.split('spotify:track:')[1] || null;
  }
  return trimmed.length >= 2 ? trimmed : null;
}

function getSpanLabel(span?: number) {
  const s = span || 12;
  const found = CELL_SIZES.find((c) => c.cols === s);
  if (found) return found.label;
  return `${Math.round((s / 12) * 100)}%`;
}

function resolveInitialVisibility(post?: Post | null): PostVisibility {
  if (!post) return 'public';
  if (post.visibility === 'private') return 'private';
  if (Array.isArray(post.blocks) && post.blocks[0]?.postVisibility === 'private') {
    return 'private';
  }
  return 'public';
}

/** Mídia nova entra com metade da largura no desktop (evita fotos gigantes no feed); dá para ampliar até 100%. */
function defaultMediaWidth(): ImageWidthType {
  if (typeof window === 'undefined') return '100%';
  return window.matchMedia('(min-width: 768px)').matches ? '50%' : '100%';
}

function createNewBlock(type: PostBlockType = 'paragraph'): PostBlock {
  const mediaWidth = type === 'image' || type === 'video' || type === 'gif' ? defaultMediaWidth() : '100%';
  const uid = `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
  const cId = `node-c-${uid}`;
  const n1Id = `node-1-${uid}`;
  const n2Id = `node-2-${uid}`;

  return {
    id: `blk-${uid}`,
    type,
    html: '',
    fontStyle: type === 'code' ? 'mono' : 'sans',
    align: 'left',
    calloutIcon: '—',
    gridSpan: 12,
    gridStart: 0,
    imageUrl: null,
    imageCaption: '',
    imageWidth: mediaWidth,
    imageAlign: 'center',
    videoUrl: null,
    r2Key: null,
    videoCaption: '',
    videoWidth: mediaWidth,
    videoAlign: 'center',
    isGif: type === 'gif',
    spotifyTrackId: null,
    chartType: 'vertical',
    chartTitle: '',
    chartData: [
      { label: 'Item A', value: 45, color: '#2563eb' },
      { label: 'Item B', value: 80, color: '#10b981' },
      { label: 'Item C', value: 30, color: '#f59e0b' },
    ],
    pollQuestion: '',
    pollMultiple: false,
    pollOptions: [
      { id: `opt-${uid}-1`, text: 'Opção A', votes: 0 },
      { id: `opt-${uid}-2`, text: 'Opção B', votes: 0 },
    ],
    fileUrl: null,
    fileName: '',
    fileSize: 0,
    fileType: '',
    tableData: [
      ['Coluna 1', 'Coluna 2', 'Coluna 3'],
      ['', '', ''],
      ['', '', ''],
    ],
    roadmapSteps: [
      {
        id: `step-${uid}-1`,
        phase: 'Fase 01',
        title: 'Arquitetura & Planeamento',
        description: 'Especificação inicial e modelagem.',
        status: 'completed',
      },
      {
        id: `step-${uid}-2`,
        phase: 'Fase 02',
        title: 'Implementação & Testes',
        description: 'Desenvolvimento dos módulos principais.',
        status: 'in_progress',
      },
    ],
    mindMapNodes: [
      {
        id: cId,
        label: 'Conceito Central',
        note: 'Núcleo da arquitetura',
        x: 50,
        y: 48,
        color: '#2563eb',
        icon: '00',
      },
      {
        id: n1Id,
        label: 'Módulo A',
        note: 'Estrutura técnica',
        x: 22,
        y: 25,
        color: '#10b981',
        icon: '01',
      },
      {
        id: n2Id,
        label: 'Módulo B',
        note: 'Integração e entrega',
        x: 78,
        y: 28,
        color: '#a855f7',
        icon: '02',
      },
    ],
    mindMapEdges: [
      { id: `edge-${uid}-1`, fromId: cId, toId: n1Id },
      { id: `edge-${uid}-2`, fromId: cId, toId: n2Id },
    ],
  };
}

function buildInitialBlocksFromPost(post?: Post | null): PostBlock[] {
  if (!post) return [createNewBlock('paragraph')];

  if (Array.isArray(post.blocks) && post.blocks.length > 0) {
    return JSON.parse(JSON.stringify(post.blocks));
  }

  const converted: PostBlock[] = [];
  if (post.content && post.content.trim()) {
    const pBlock = createNewBlock('paragraph');
    pBlock.html = post.content.replace(/\n/g, '<br>');
    converted.push(pBlock);
  }
  if (post.image_url) {
    const imgBlock = createNewBlock('image');
    imgBlock.imageUrl = post.image_url;
    imgBlock.imageWidth = '100%'; // post antigo: mantém como era
    converted.push(imgBlock);
  }
  if (post.spotify_track_id) {
    const spBlock = createNewBlock('spotify');
    spBlock.spotifyTrackId = post.spotify_track_id;
    converted.push(spBlock);
  }

  return converted.length > 0 ? converted : [createNewBlock('paragraph')];
}

interface RichBlockEditableProps {
  block: PostBlock;
  placeholder: string;
  className: string;
  spellCheckEnabled: boolean;
  onFocus: () => void;
  onChangeHtml: (html: string) => void;
  onSlashTriggered: () => void;
  onEnterPressed: () => void;
  onBackspaceEmpty: () => void;
}

function RichBlockEditable({
  block,
  placeholder,
  className,
  spellCheckEnabled,
  onFocus,
  onChangeHtml,
  onSlashTriggered,
  onEnterPressed,
  onBackspaceEmpty,
}: RichBlockEditableProps) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!ref.current) return;
    if (document.activeElement !== ref.current && ref.current.innerHTML !== (block.html || '')) {
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
    if (e.key === 'Enter' && block.type !== 'code') {
      // Ctrl/Cmd+Enter cria outro bloco; Enter só pula linha (títulos continuam criando bloco)
      const newBlock = e.ctrlKey || e.metaKey || ((block.type === 'h1' || block.type === 'h2') && !e.shiftKey);
      e.preventDefault();
      if (newBlock) {
        onEnterPressed();
      } else if (!document.execCommand('insertLineBreak')) {
        document.execCommand('insertHTML', false, '<br><br>');
      }
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
      spellCheck={spellCheckEnabled && block.type !== 'code'}
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

export function PostComposer({
  authorId,
  isAdmin = true,
  onPostCreated,
  defaultTag,
  editingPost = null,
  onCancelEdit,
  onPostUpdated,
  embedded,
  prefillBlocks,
  draftScopeOverride,
  onPublished,
}: PostComposerProps) {
  const isEditMode = Boolean(editingPost);
  const isEmbedded = Boolean(embedded);
  // Notebook já tem tela cheia própria; no feed e na edição o foco é automático
  const autoFocus = useAutoFocusMode(!isEmbedded);
  const uploadScope: 'posts' | 'notebook' = isEmbedded ? 'notebook' : 'posts';

  const [blocks, setBlocks] = useState<PostBlock[]>(() =>
    embedded?.initialBlocks?.length
      ? embedded.initialBlocks
      : prefillBlocks?.length
        ? prefillBlocks
        : buildInitialBlocksFromPost(editingPost)
  );

  // modo notebook: repassa cada mudança para a nota
  const embeddedChangeRef = useRef(embedded?.onBlocksChange);
  embeddedChangeRef.current = embedded?.onBlocksChange;
  const embeddedFirst = useRef(true);
  useEffect(() => {
    if (!isEmbedded) return;
    if (embeddedFirst.current) {
      embeddedFirst.current = false;
      return;
    }
    embeddedChangeRef.current?.(blocks);
  }, [blocks, isEmbedded]);
  const [activeBlockId, setActiveBlockId] = useState<string>('');
  const [menuOpenForBlockId, setMenuOpenForBlockId] = useState<string | null>(null);
  const [cellConfigOpenForId, setCellConfigOpenForId] = useState<string | null>(null);
  const [showHighlighterMenu, setShowHighlighterMenu] = useState(false);
  const [showGridLines, setShowGridLines] = useState(true);
  const [spotifySearchForBlockId, setSpotifySearchForBlockId] = useState<string | null>(null);
  const [spotifyInitialQuery, setSpotifyInitialQuery] = useState('');

  const gridContainerRef = useRef<HTMLDivElement>(null);
  const [draggedBlockId, setDraggedBlockId] = useState<string | null>(null);
  const [dragOverBlockId, setDragOverBlockId] = useState<string | null>(null);
  // soltar na borda esquerda/direita de outro bloco = ficar lado a lado
  const [dragSide, setDragSide] = useState<'left' | 'right' | null>(null);
  const [dragHoverCol, setDragHoverCol] = useState<number | null>(null);
  const [resizingState, setResizingState] = useState<{
    blockId: string;
    startX: number;
    initialSpan: number;
    startCol: number;
  } | null>(null);

  const mindMapCanvasRefs = useRef<Record<string, HTMLDivElement | null>>({});
  const [blockMoreMenuId, setBlockMoreMenuId] = useState<string | null>(null);
  const [resizingImageId, setResizingImageId] = useState<string | null>(null);
  const imageFrameRefs = useRef<Record<string, HTMLDivElement | null>>({});
  const [draggingMindNode, setDraggingMindNode] = useState<{
    blockId: string;
    nodeId: string;
  } | null>(null);
  const [selectedMindNode, setSelectedMindNode] = useState<{
    blockId: string;
    nodeId: string;
  } | null>(null);
  const [connectingMindNodeFrom, setConnectingMindNodeFrom] = useState<{
    blockId: string;
    nodeId: string;
  } | null>(null);

  const [spellCheckEnabled, setSpellCheckEnabled] = useState(true);
  const [writingIssues, setWritingIssues] = useState<WritingIssue[]>([]);
  const [ignoredIssues, setIgnoredIssues] = useState<Set<string>>(new Set());
  const [checkingGrammar, setCheckingGrammar] = useState(false);

  const [availableTopics, setAvailableTopics] = useState<AvailableTopicOption[]>(() =>
    DEFAULT_TABS.filter((t) => Boolean(t.tag) && !(t as any).inDevelopment).map((t) => ({
      id: t.id,
      label: t.label,
      tag: t.tag!.toLowerCase(),
      color: t.color,
      icon: 'file',
    }))
  );

  const [selectedTopicTags, setSelectedTopicTags] = useState<string[]>(() => {
    if (editingPost && Array.isArray(editingPost.tags)) {
      return editingPost.tags.map((t) => t.toLowerCase());
    }
    return defaultTag ? [defaultTag.toLowerCase()] : [];
  });

  const [visibility, setVisibility] = useState<PostVisibility>(() =>
    resolveInitialVisibility(editingPost)
  );

  const [tagsInput, setTagsInput] = useState(
    editingPost ? (editingPost.tags || []).join(', ') : ''
  );
  const [isPinned, setIsPinned] = useState(
    editingPost ? Boolean(editingPost.is_pinned) : false
  );
  const [uploadingBlockId, setUploadingBlockId] = useState<string | null>(null);
  const [uploadProgressText, setUploadProgressText] = useState<string>('');
  const [uploadProgressPct, setUploadProgressPct] = useState<number>(0);
  const [compressionBadges, setCompressionBadges] = useState<Record<string, string>>({});
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Cota de anexos do Nível de Contribuinte (tamanho comprimido no R2, por post)
  const { viewer } = useNitro();
  const viewerTier = getTierByLevel(viewer?.contributor_level ?? 0);
  const uploadLimit = getUserUploadLimitBytes(viewer?.contributor_level ?? 0, viewer?.role);
  const usedBytes = sumPostMediaBytes(blocks);
  const remainingBytes = Math.max(0, uploadLimit - usedBytes);
  const quotaPct = Math.min(100, (usedBytes / uploadLimit) * 100);
  const overQuota = usedBytes > uploadLimit;

  // ---------------------------------------------------- rascunho automático (nuvem)
  type PostDraft = {
    blocks: PostBlock[];
    tagsInput: string;
    selectedTopicTags: string[];
    visibility: PostVisibility;
    isPinned: boolean;
  };
  const draftScope = draftScopeOverride
    ? draftScopeOverride
    : editingPost
      ? `post:edit:${editingPost.id}`
      : `post:new${defaultTag ? `:${defaultTag}` : ''}`;
  const draft = useCloudDraft<PostDraft>(isAdmin && !isEmbedded ? draftScope : null, authorId, (d) =>
    !d.blocks.some(
      (b) =>
        (b.html && b.html.replace(/<[^>]*>|&nbsp;/g, '').trim()) ||
        b.imageUrl ||
        b.videoUrl ||
        b.fileUrl ||
        b.spotifyTrackId ||
        b.type === 'chart' ||
        b.type === 'poll' ||
        b.type === 'table' ||
        (b.mindMapNodes && b.mindMapNodes.length > 0) ||
        (b.roadmapSteps && b.roadmapSteps.length > 0)
    )
  );
  const [draftRestoredAt, setDraftRestoredAt] = useState<number | null>(null);
  const initialSnapshot = useRef<PostDraft | null>(null);
  const restoredOnce = useRef(false);

  useEffect(() => {
    if (!draft.ready || restoredOnce.current) return;
    restoredOnce.current = true;
    initialSnapshot.current = { blocks, tagsInput, selectedTopicTags, visibility, isPinned };
    const saved = draft.loaded;
    // na edição, só restaura se o rascunho é mais novo que o post salvo
    const postTime = editingPost ? new Date(editingPost.updated_at || editingPost.created_at).getTime() : 0;
    if (saved && saved.at > postTime) {
      setBlocks(saved.v.blocks);
      setTagsInput(saved.v.tagsInput);
      setSelectedTopicTags(saved.v.selectedTopicTags);
      setVisibility(saved.v.visibility);
      setIsPinned(saved.v.isPinned);
      setDraftRestoredAt(saved.at);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [draft.ready]);

  useEffect(() => {
    if (!restoredOnce.current) return;
    draft.save({ blocks, tagsInput, selectedTopicTags, visibility, isPinned });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [blocks, tagsInput, selectedTopicTags, visibility, isPinned]);

  function discardDraft() {
    const init = initialSnapshot.current;
    void draft.clear();
    setDraftRestoredAt(null);
    if (init) {
      setBlocks(init.blocks.length ? init.blocks : [createNewBlock('paragraph')]);
      setTagsInput(init.tagsInput);
      setSelectedTopicTags(init.selectedTopicTags);
      setVisibility(init.visibility);
      setIsPinned(init.isPinned);
    }
  }

  const [giphyQuery, setGiphyQuery] = useState<string>('');
  const [giphyMediaType, setGiphyMediaType] = useState<'gifs' | 'stickers'>('gifs');
  const [giphyResults, setGiphyResults] = useState<GiphyItem[]>([]);
  const [giphyOffset, setGiphyOffset] = useState<number>(0);
  const [loadingGiphy, setLoadingGiphy] = useState<boolean>(false);
  const [loadingMoreGiphy, setLoadingMoreGiphy] = useState<boolean>(false);

  const supabase = createClient();

  useEffect(() => {
    async function fetchProfileTopics() {
      // só os tópicos do próprio autor
      const { data } = await supabase
        .from('custom_topics')
        .select('*')
        .eq('profile_id', authorId)
        .order('created_at', { ascending: true });

      const baseTopics: AvailableTopicOption[] = DEFAULT_TABS.filter(
        (t) => Boolean(t.tag) && !(t as any).inDevelopment
      ).map((t) => ({
        id: t.id,
        label: t.label,
        tag: t.tag!.toLowerCase(),
        color: t.color,
        icon: 'file',
      }));

      if (Array.isArray(data)) {
        const customMapped: AvailableTopicOption[] = (data as CustomTopic[]).map(
          (ct) => {
            const fallbackIcon = (ct.description_blocks?.[0] as any)?._topicMeta?.icon;
            return {
              id: ct.id,
              label: ct.name,
              tag: ct.tag.toLowerCase(),
              color: ct.color || '#2563eb',
              icon: ct.icon || fallbackIcon || 'file',
            };
          }
        );

        const merged = [...baseTopics];
        for (const item of customMapped) {
          if (!merged.some((m) => m.tag === item.tag)) {
            merged.push(item);
          }
        }
        setAvailableTopics(merged);
      }
    }

    fetchProfileTopics();
  }, [supabase, authorId]);

  useEffect(() => {
    if (!editingPost) {
      if (defaultTag) {
        const clean = defaultTag.toLowerCase();
        setSelectedTopicTags((prev) =>
          prev.includes(clean) ? prev : [...prev, clean]
        );
      } else {
        setSelectedTopicTags([]);
      }
    }
  }, [defaultTag, editingPost]);

  useEffect(() => {
    if (!draggingMindNode) return;

    function handleMouseMove(e: PointerEvent) {
      if (!draggingMindNode) return;
      const canvasEl = mindMapCanvasRefs.current[draggingMindNode.blockId];
      if (!canvasEl) return;

      const rect = canvasEl.getBoundingClientRect();
      const relX = ((e.clientX - rect.left) / rect.width) * 100;
      const relY = ((e.clientY - rect.top) / rect.height) * 100;

      const clampedX = Math.max(4, Math.min(96, Math.round(relX * 10) / 10));
      const clampedY = Math.max(5, Math.min(95, Math.round(relY * 10) / 10));

      setBlocks((prev) =>
        prev.map((blk) => {
          if (blk.id !== draggingMindNode.blockId) return blk;
          return {
            ...blk,
            mindMapNodes: (blk.mindMapNodes || []).map((n) =>
              n.id === draggingMindNode.nodeId
                ? { ...n, x: clampedX, y: clampedY }
                : n
            ),
          };
        })
      );
    }

    function handleMouseUp() {
      setDraggingMindNode(null);
    }

    window.addEventListener('pointermove', handleMouseMove);
    window.addEventListener('pointerup', handleMouseUp);
    window.addEventListener('pointercancel', handleMouseUp);
    return () => {
      window.removeEventListener('pointermove', handleMouseMove);
      window.removeEventListener('pointerup', handleMouseUp);
      window.removeEventListener('pointercancel', handleMouseUp);
    };
  }, [draggingMindNode]);

  function toggleSelectedTopicTag(topicTag: string) {
    const clean = topicTag.toLowerCase();
    setSelectedTopicTags((prev) =>
      prev.includes(clean) ? prev.filter((t) => t !== clean) : [...prev, clean]
    );
  }

  const fetchGiphyFromApi = useCallback(
    async (searchQuery: string, mediaType: 'gifs' | 'stickers', nextOffset = 0) => {
      if (nextOffset === 0) {
        setLoadingGiphy(true);
      } else {
        setLoadingMoreGiphy(true);
      }

      try {
        const params = new URLSearchParams({
          q: searchQuery.trim(),
          type: mediaType,
          limit: '18',
          offset: String(nextOffset),
        });

        const res = await fetch(`/api/giphy?${params.toString()}`);
        if (res.ok) {
          const data = await res.json();
          const list: GiphyItem[] = Array.isArray(data.items) ? data.items : [];
          if (nextOffset === 0) {
            setGiphyResults(list);
          } else {
            setGiphyResults((prev) => [...prev, ...list]);
          }
          setGiphyOffset(nextOffset);
        }
      } catch {
        // Ignora falha de rede
      } finally {
        setLoadingGiphy(false);
        setLoadingMoreGiphy(false);
      }
    },
    []
  );

  const hasEmptyGifBlock = blocks.some((b) => b.type === 'gif' && !b.videoUrl);

  useEffect(() => {
    if (!hasEmptyGifBlock) return;
    const timer = setTimeout(() => {
      fetchGiphyFromApi(giphyQuery, giphyMediaType, 0);
    }, 300);
    return () => clearTimeout(timer);
  }, [giphyQuery, giphyMediaType, hasEmptyGifBlock, fetchGiphyFromApi]);

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

  const runWritingCheck = useCallback(async () => {
    if (!spellCheckEnabled) {
      setWritingIssues([]);
      return;
    }

    const textBlocks = blocks.filter(
      (b) =>
        (b.type === 'paragraph' ||
          b.type === 'h1' ||
          b.type === 'h2' ||
          b.type === 'quote' ||
          b.type === 'callout' ||
          b.type === 'bullet') &&
        b.html
    );

    if (textBlocks.length === 0) {
      setWritingIssues([]);
      return;
    }

    const detected: WritingIssue[] = [];

    for (const blk of textBlocks) {
      const plain = (blk.html || '')
        .replace(/<br\s*\/?>/gi, ' ')
        .replace(/<[^>]*>/g, '')
        .trim();
      if (!plain) continue;

      for (const rule of LOCAL_PT_RULES) {
        if (!rule.message) continue;
        const matches = plain.matchAll(rule.pattern);
        for (const match of matches) {
          const wrongText = match[0];
          const issueKey = `${blk.id}:${wrongText.toLowerCase()}`;
          if (!ignoredIssues.has(issueKey)) {
            detected.push({
              id: issueKey,
              blockId: blk.id,
              wrongText,
              message: rule.message,
              replacements: rule.replacements,
              category: rule.category,
            });
          }
        }
      }
    }

    try {
      setCheckingGrammar(true);
      for (const blk of textBlocks) {
        const plain = (blk.html || '')
          .replace(/<br\s*\/?>/gi, '\n')
          .replace(/<[^>]*>/g, '')
          .trim();

        if (plain.length < 3) continue;

        const params = new URLSearchParams();
        params.append('text', plain);
        params.append('language', 'pt-BR');

        const res = await fetch('https://api.languagetool.org/v2/check', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/x-www-form-urlencoded',
            Accept: 'application/json',
          },
          body: params.toString(),
        });

        if (!res.ok) continue;
        const data = await res.json();

        for (const match of data.matches || []) {
          const wrongText = plain.slice(match.offset, match.offset + match.length);
          if (!wrongText || wrongText.length < 2) continue;

          const issueKey = `${blk.id}:${wrongText.toLowerCase()}`;
          if (
            ignoredIssues.has(issueKey) ||
            detected.some((d) => d.id === issueKey)
          ) {
            continue;
          }

          const replacements = (match.replacements || [])
            .slice(0, 4)
            .map((r: { value: string }) => r.value)
            .filter(Boolean);

          if (replacements.length === 0) continue;

          const isSpelling =
            match.rule?.issueType === 'misspelling' ||
            match.rule?.category?.id === 'TYPOS';

          detected.push({
            id: issueKey,
            blockId: blk.id,
            wrongText,
            message: match.message || 'Sugestão de melhoria na escrita.',
            replacements,
            category: isSpelling ? 'ortografia' : 'sintaxe',
          });
        }
      }
    } catch {
      // Mantém regras locais
    } finally {
      setCheckingGrammar(false);
    }

    setWritingIssues(detected);
  }, [blocks, spellCheckEnabled, ignoredIssues]);

  useEffect(() => {
    const timer = setTimeout(() => {
      runWritingCheck();
    }, 850);
    return () => clearTimeout(timer);
  }, [runWritingCheck]);

  if (!isAdmin) return null;

  const activeBlock = blocks.find((b) => b.id === activeBlockId) || blocks[0];

  function applyCorrection(issue: WritingIssue, replacement: string) {
    setBlocks((prev) =>
      prev.map((b) => {
        if (b.id !== issue.blockId || !b.html) return b;
        const escaped = issue.wrongText.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        const regex = new RegExp(escaped, 'i');
        return {
          ...b,
          html: b.html.replace(regex, replacement),
        };
      })
    );
    setWritingIssues((prev) => prev.filter((i) => i.id !== issue.id));
  }

  function ignoreCorrection(issueId: string) {
    setIgnoredIssues((prev) => new Set(prev).add(issueId));
    setWritingIssues((prev) => prev.filter((i) => i.id !== issueId));
  }

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
      if (prev.length <= 1) {
        return [createNewBlock('paragraph')];
      }
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
    const col = computeTargetColumn(e.clientX, span);
    setDragHoverCol(col);
  }

  function handleBlockDragOver(e: React.DragEvent, targetId: string) {
    e.preventDefault();
    if (draggedBlockId && draggedBlockId !== targetId) {
      setDragOverBlockId(targetId);
      const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
      const x = (e.clientX - rect.left) / Math.max(1, rect.width);
      setDragSide(x < 0.28 ? 'left' : x > 0.72 ? 'right' : null);
    }
  }

  function handleGridDrop(e: React.DragEvent, targetId?: string) {
    e.preventDefault();
    e.stopPropagation();

    if (!draggedBlockId) return;
    const draggedBlk = blocks.find((b) => b.id === draggedBlockId);
    const span = draggedBlk?.gridSpan || 12;
    const newCol = computeTargetColumn(e.clientX, span);
    const side = targetId && targetId !== draggedBlockId ? dragSide : null;

    if (side && targetId) {
      // lado a lado: divide a linha entre o bloco alvo e o arrastado
      setBlocks((prev) => {
        const target = prev.find((b) => b.id === targetId);
        if (!target) return prev;
        const targetSpan = normalizeGridSpan(target.gridSpan);
        const nextTargetSpan = targetSpan >= 9 ? 6 : targetSpan;
        const draggedSpan = Math.max(3, Math.min(12 - nextTargetSpan, normalizeGridSpan(draggedBlk?.gridSpan)));
        const rest = prev.filter((b) => b.id !== draggedBlockId);
        const moved = { ...(draggedBlk as PostBlock), gridSpan: draggedSpan, gridStart: 0 };
        const out = rest.map((b) => (b.id === targetId ? { ...b, gridSpan: nextTargetSpan, gridStart: 0 } : b));
        const at = out.findIndex((b) => b.id === targetId);
        out.splice(side === 'left' ? at : at + 1, 0, moved);
        return out;
      });
      setDraggedBlockId(null);
      setDragOverBlockId(null);
      setDragSide(null);
      setDragHoverCol(null);
      return;
    }

    setBlocks((prev) => {
      const updated = prev.map((b) =>
        b.id === draggedBlockId
          ? {
              ...b,
              // Soltou sobre outra célula: entra no fluxo ao lado dela.
              // Soltou numa área vazia: fixa na coluna sob o cursor.
              gridStart: targetId ? 0 : normalizeGridStart(newCol, span),
            }
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

  /** Progresso compartilhado pelos uploads (barra no bloco). */
  function startUpload(blockId: string, label: string) {
    setUploadingBlockId(blockId);
    setUploadProgressText(label);
    setUploadProgressPct(3);
  }

  function endUpload() {
    setUploadingBlockId(null);
    setUploadProgressText('');
    setUploadProgressPct(0);
  }

  const onUploadStatus = (label: string, pct: number) => {
    setUploadProgressText(label);
    setUploadProgressPct(pct);
  };

  async function handleBlockImageUpload(
    e: React.ChangeEvent<HTMLInputElement>,
    blockId: string
  ) {
    if (!isAdmin) return;
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      alert('Selecione um arquivo de imagem válido.');
      return;
    }

    startUpload(blockId, 'Otimizando imagem...');
    try {
      const result = await uploadMediaToInsight(file, {
        budgetBytes: remainingBytes,
        scope: uploadScope,
        asImage: true,
        onStatus: onUploadStatus,
      });
      updateBlock(blockId, {
        imageUrl: result.publicUrl,
        r2Key: result.r2Key,
        mediaBytes: result.compressedSize,
      });
      setCompressionBadges((prev) => ({ ...prev, [blockId]: compressionBadge(result) }));
    } catch (err) {
      alert(uploadErrorMessage(err, 'Erro ao enviar imagem.'));
    } finally {
      endUpload();
    }
  }

  async function handleBlockVideoUpload(
    e: React.ChangeEvent<HTMLInputElement>,
    blockId: string,
    isGifBlock: boolean
  ) {
    if (!isAdmin) return;
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;

    const isVideo = file.type.startsWith('video/');
    const isGif = file.type === 'image/gif' || file.name.toLowerCase().endsWith('.gif');

    if (!isVideo && !isGif) {
      alert('Selecione um arquivo de vídeo (MP4/WebM/MOV) ou GIF válido.');
      return;
    }

    startUpload(blockId, 'Preparando compactação...');
    try {
      const result = await uploadMediaToInsight(file, {
        budgetBytes: remainingBytes,
        scope: uploadScope,
        forceGifLoop: isGifBlock,
        onStatus: onUploadStatus,
      });
      updateBlock(blockId, {
        videoUrl: result.publicUrl,
        r2Key: result.r2Key,
        isGif: result.isGif,
        mediaBytes: result.compressedSize,
      });
      setCompressionBadges((prev) => ({ ...prev, [blockId]: compressionBadge(result) }));
    } catch (err) {
      alert(uploadErrorMessage(err, 'Erro ao processar vídeo/GIF.'));
    } finally {
      endUpload();
    }
  }

  async function handleUploadBrainstormMediaToR2(
    e: React.ChangeEvent<HTMLInputElement>,
    blockId: string,
    targetType: 'mindmap_node' | 'roadmap_step',
    itemId: string
  ) {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file || !isAdmin) return;

    startUpload(blockId, 'Preparando mídia...');
    try {
      const isMotion = file.type.startsWith('video/') || file.type === 'image/gif';
      const res = await uploadMediaToInsight(file, {
        budgetBytes: remainingBytes,
        scope: uploadScope,
        forceGifLoop: file.type === 'image/gif',
        asImage: !isMotion,
        onStatus: onUploadStatus,
      });
      const publicUrl = res.publicUrl;
      const r2Key = res.r2Key;
      const mediaBytes = res.compressedSize;

      setBlocks((prev) =>
        prev.map((b) => {
          if (b.id !== blockId) return b;
          if (targetType === 'mindmap_node') {
            return {
              ...b,
              mindMapNodes: (b.mindMapNodes || []).map((n) =>
                n.id === itemId ? { ...n, mediaUrl: publicUrl, r2Key, mediaBytes } : n
              ),
            };
          }
          return {
            ...b,
            roadmapSteps: (b.roadmapSteps || []).map((st) =>
              st.id === itemId ? { ...st, mediaUrl: publicUrl, mediaBytes } : st
            ),
          };
        })
      );
    } catch (err) {
      alert(uploadErrorMessage(err, 'Erro ao carregar mídia na Cloudflare R2'));
    } finally {
      endUpload();
    }
  }

  async function handleBlockFileUpload(
    e: React.ChangeEvent<HTMLInputElement>,
    blockId: string
  ) {
    if (!isAdmin) return;
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;

    if (file.size > remainingBytes) {
      alert(
        `O arquivo tem ${formatBytes(file.size)} e restam ${formatBytes(remainingBytes)} de anexos neste post (${viewerTier.name}).`
      );
      return;
    }

    startUpload(blockId, 'Enviando arquivo...');
    try {
      const res = await uploadMediaToInsight(file, {
        budgetBytes: remainingBytes,
        scope: uploadScope,
        asFile: true,
        onStatus: onUploadStatus,
      });
      const ext = file.name.split('.').pop() || 'bin';
      updateBlock(blockId, {
        fileUrl: res.publicUrl,
        r2Key: res.r2Key,
        fileName: file.name,
        fileSize: res.compressedSize,
        fileType: ext.toUpperCase(),
        mediaBytes: res.compressedSize,
      });
    } catch (err) {
      alert(uploadErrorMessage(err, 'Erro ao anexar arquivo.'));
    } finally {
      endUpload();
    }
  }

  function normalizeBlocksForSave(
    rawBlocks: PostBlock[],
    targetVisibility: PostVisibility
  ): PostBlock[] {
    return rawBlocks
      .filter((b) => {
        if (b.type === 'divider') return true;
        if (b.type === 'image') return Boolean(b.imageUrl);
        if (b.type === 'video' || b.type === 'gif') return Boolean(b.videoUrl);
        if (b.type === 'spotify') return Boolean(b.spotifyTrackId);
        if (b.type === 'file') return Boolean(b.fileUrl);
        if (b.type === 'chart')
          return Array.isArray(b.chartData) && b.chartData.length > 0;
        if (b.type === 'poll')
          return (
            Boolean(b.pollQuestion?.trim()) ||
            (Array.isArray(b.pollOptions) &&
              b.pollOptions.some((o) => Boolean(o.text?.trim())))
          );
        if (b.type === 'table')
          return Array.isArray(b.tableData) && b.tableData.length > 0;
        if (b.type === 'roadmap')
          return Array.isArray(b.roadmapSteps) && b.roadmapSteps.length > 0;
        if (b.type === 'mindmap')
          return Array.isArray(b.mindMapNodes) && b.mindMapNodes.length > 0;
        const plain = (b.html || '').replace(/<[^>]*>/g, '').trim();
        return plain.length > 0;
      })
      .map((b, idx) => {
        const blockId = b.id || `blk-${Date.now()}-${idx}`;
        const span = normalizeGridSpan(b.gridSpan);
        const start = normalizeGridStart(b.gridStart, span);

        const normalized: PostBlock = {
          ...b,
          id: blockId,
          gridSpan: span,
          gridStart: start,
          fontStyle: b.fontStyle || (b.type === 'code' ? 'mono' : 'sans'),
          align: b.align || 'left',
          postVisibility: targetVisibility,
        };

        if (b.type === 'image') {
          normalized.imageWidth = b.imageWidth || '100%';
          normalized.imageAlign = b.imageAlign || 'center';
          normalized.imageCaption = (b.imageCaption || '').trim();
        }

        if (b.type === 'video' || b.type === 'gif') {
          normalized.videoWidth = b.videoWidth || '100%';
          normalized.videoAlign = b.videoAlign || 'center';
          normalized.videoCaption = (b.videoCaption || '').trim();
          normalized.isGif = b.type === 'gif' || Boolean(b.isGif);
        }

        if (b.type === 'chart') {
          normalized.chartType = b.chartType || 'vertical';
          normalized.chartTitle = (b.chartTitle || '').trim();
          normalized.chartData = (b.chartData || []).map((item, i) => ({
            label: (item.label || `Item ${i + 1}`).trim(),
            value: Math.max(0, Number(item.value) || 0),
            color: item.color || CHART_PALETTE[i % CHART_PALETTE.length],
          }));
        }

        if (b.type === 'poll') {
          normalized.pollQuestion = (b.pollQuestion || 'Enquete').trim();
          normalized.pollMultiple = Boolean(b.pollMultiple);
          normalized.pollOptions = (b.pollOptions || [])
            .filter((o) => Boolean(o.text?.trim()))
            .map((opt, i) => ({
              id: opt.id || `opt-${blockId}-${i}`,
              text: opt.text.trim(),
              votes: Math.max(0, Number(opt.votes) || 0),
            }));
        }

        if (b.type === 'table') {
          const rows =
            Array.isArray(b.tableData) && b.tableData.length > 0
              ? b.tableData
              : [
                  ['Coluna 1', 'Coluna 2'],
                  ['', ''],
                ];
          const colCount = Math.max(
            ...rows.map((r) => (Array.isArray(r) ? r.length : 1)),
            1
          );
          normalized.tableData = rows.map((r) => {
            const safeRow = Array.isArray(r) ? r.map((c) => String(c ?? '')) : [];
            while (safeRow.length < colCount) safeRow.push('');
            return safeRow.slice(0, colCount);
          });
        }

        if (b.type === 'file') {
          normalized.fileUrl = b.fileUrl || null;
          normalized.fileName = b.fileName || 'arquivo';
          normalized.fileSize = Number(b.fileSize) || 0;
          normalized.fileType = b.fileType || 'ARQUIVO';
        }

        return normalized;
      });
  }

  async function handleSubmit(e: React.FormEvent) {
    if (isEmbedded) {
      e.preventDefault();
      return;
    }
    e.preventDefault();
    if (!isAdmin || isSubmitting) return;
    if (overQuota) {
      alert(
        `Os anexos deste post somam ${formatBytes(usedBytes)} e o limite do seu nível (${viewerTier.name}) é ${formatBytes(uploadLimit)}. Remova alguma mídia para publicar.`
      );
      return;
    }

    const validBlocks = normalizeBlocksForSave(blocks, visibility);
    if (validBlocks.length === 0) return;

    setIsSubmitting(true);

    const plainTextSummary = validBlocks
      .map((b) => {
        if (b.type === 'video') return `[Vídeo] ${b.videoCaption || ''}`.trim();
        if (b.type === 'gif') return `[GIF] ${b.videoCaption || ''}`.trim();
        if (b.type === 'mindmap')
          return `[Mapa Mental] ${
            b.mindMapNodes?.map((n) => n.label).join(' · ') || ''
          }`.trim();
        if (b.type === 'roadmap')
          return `[Roadmap] ${
            b.roadmapSteps?.map((s) => s.title).join(' → ') || ''
          }`.trim();
        if (b.type === 'poll') return `[Enquete] ${b.pollQuestion || ''}`.trim();
        if (b.type === 'chart') return `[Gráfico] ${b.chartTitle || 'Dados'}`;
        if (b.type === 'file') return `[Anexo] ${b.fileName || ''}`.trim();
        if (b.type === 'table')
          return `[Tabela] ${b.tableData?.[0]?.join(' | ') || ''}`;
        return (b.html || '')
          .replace(/<br\s*\/?>/gi, '\n')
          .replace(/<[^>]*>/g, '')
          .trim();
      })
      .filter(Boolean)
      .join('\n\n');

    const firstImageBlock = validBlocks.find((b) => b.type === 'image' && b.imageUrl);
    const firstSpotifyBlock = validBlocks.find(
      (b) => b.type === 'spotify' && b.spotifyTrackId
    );

    const typedTags = tagsInput
      .split(',')
      .map((t) => t.trim().replace(/^#/, '').toLowerCase())
      .filter((t) => t.length > 0);

    const combinedTags = Array.from(new Set([...selectedTopicTags, ...typedTags]));

    const basePayload = {
      content: plainTextSummary || 'Publicação multimídia',
      image_url: firstImageBlock?.imageUrl || null,
      spotify_track_id: firstSpotifyBlock?.spotifyTrackId || null,
      blocks: validBlocks,
      tags: combinedTags,
      is_pinned: isPinned,
    };

    if (isEditMode && editingPost) {
      let { data: updatedData, error } = await supabase
        .from('posts')
        .update({ ...basePayload, visibility })
        .eq('id', editingPost.id)
        .select()
        .single();

      if (error && error.message?.includes('visibility')) {
        const retry = await supabase
          .from('posts')
          .update(basePayload)
          .eq('id', editingPost.id)
          .select()
          .single();
        updatedData = retry.data;
        error = retry.error;
      }

      setIsSubmitting(false);

      if (!error && updatedData) {
        void draft.clear();
        onPostUpdated?.({ ...(updatedData as Post), visibility });
      } else {
        alert(
          error?.message?.includes('post_media_quota_exceeded')
            ? `Os anexos passam do limite de ${formatBytes(uploadLimit)} por post do seu nível.`
            : 'Erro ao guardar alterações: ' + (error?.message || 'Erro desconhecido')
        );
      }
      return;
    }

    let { data: createdPost, error } = await supabase
      .from('posts')
      .insert({
        author_id: authorId,
        profile_id: authorId,
        ...basePayload,
        visibility,
      })
      .select('id')
      .single();

    if (error && error.message?.includes('visibility')) {
      const retry = await supabase
        .from('posts')
        .insert({
          author_id: authorId,
          profile_id: authorId,
          ...basePayload,
        })
        .select('id')
        .single();
      createdPost = retry.data;
      error = retry.error;
    }

    setIsSubmitting(false);

    if (!error) {
      if (visibility === 'public' && createdPost?.id) {
        // Avisa só quem segue o autor (o servidor carrega o post do banco e
        // confere a autoria; o e-mail sai em nome do autor).
        const notifyBody = JSON.stringify({ action: 'new_post', postId: createdPost.id });
        fetch('/api/push', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: notifyBody }).catch(() => {});
        fetch('/api/newsletter', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: notifyBody }).catch(() => {});
      }

      void draft.clear();
      setDraftRestoredAt(null);
      setBlocks([createNewBlock('paragraph')]);
      setTagsInput('');
      setSelectedTopicTags(defaultTag ? [defaultTag.toLowerCase()] : []);
      setVisibility('public');
      setIsPinned(false);
      setWritingIssues([]);
      setCompressionBadges({});
      if (createdPost?.id) onPublished?.(createdPost.id);
      onPostCreated?.();
    } else {
      alert('Erro ao publicar insight: ' + error.message);
    }
  }

  function getFontClass(font?: FontStyleType) {
    if (font === 'serif') return 'font-serif tracking-normal';
    if (font === 'mono') return 'font-mono text-[0.92em]';
    return 'font-sans';
  }

  function getBlockTypographyClass(type: PostBlockType) {
    switch (type) {
      case 'h1':
        return 'text-2xl font-extrabold text-primary leading-tight';
      case 'h2':
        return 'text-lg font-bold text-primary leading-snug';
      case 'quote':
        return 'border-l-4 border-accent pl-4 italic text-secondary text-base';
      case 'code':
        return 'p-3.5 rounded-xl bg-elevated border border-border font-mono text-xs text-primary whitespace-pre-wrap';
      default:
        return 'text-sm sm:text-base text-primary leading-relaxed';
    }
  }

  function getImageAlignClass(align?: ImageAlignType) {
    if (align === 'left') return 'mr-auto';
    if (align === 'right') return 'ml-auto';
    return 'mx-auto';
  }

  return (
    <form
      onSubmit={handleSubmit}
      onInput={autoFocus.onInput}
      onFocusCapture={autoFocus.onFocusCapture}
      onBlurCapture={autoFocus.onBlurCapture}
      className={`${
        isEmbedded
          ? 'nb-blocks-editor space-y-4'
          : isEditMode
          ? 'p-4 rounded-2xl bg-surface/80 border border-accent/40 space-y-4'
          : 'border-b border-border bg-surface/40 p-5 sm:p-6 space-y-4'
      }`}
    >
      {/* BARRA DE FERRAMENTAS */}
      <div className="sticky top-2 z-30 flex flex-wrap items-center justify-between gap-2 p-2 rounded-xl bg-elevated/95 backdrop-blur border border-border shadow-lg">
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
                if (activeBlock) updateBlock(activeBlock.id, { fontStyle: f.key });
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
                  title="Remover realce"
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
            title="Ativar/Desativar Corretor Ortográfico e de Sintaxe"
            onClick={() => setSpellCheckEnabled(!spellCheckEnabled)}
            className={`px-2 py-1 rounded-md text-[11px] font-semibold flex items-center gap-1 transition-colors mr-1 ${
              spellCheckEnabled
                ? writingIssues.length > 0
                  ? 'bg-amber-500/15 text-amber-500 border border-amber-500/30'
                  : 'text-accent bg-surface'
                : 'text-muted hover:text-primary hover:bg-surface'
            }`}
          >
            <SpellCheck className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">
              {checkingGrammar
                ? 'A rever...'
                : writingIssues.length > 0
                ? `${writingIssues.length} ${
                    writingIssues.length === 1 ? 'sugestão' : 'sugestões'
                  }`
                : 'Corretor'}
            </span>
          </button>

          <button
            type="button"
            title="Mostrar/Ocultar grade de células"
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
              { align: 'left', icon: AlignLeft, title: 'Alinhar à esquerda' },
              { align: 'center', icon: AlignCenter, title: 'Centrar' },
              { align: 'right', icon: AlignRight, title: 'Alinhar à direita' },
            ] as const
          ).map((item) => {
            const Icon = item.icon;
            return (
              <button
                key={item.align}
                type="button"
                title={item.title}
                onMouseDown={(e) => {
                  e.preventDefault();
                  if (activeBlock) updateBlock(activeBlock.id, { align: item.align });
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

      {/* INDICADOR DE ARRASTE HORIZONTAL */}
      {draggedBlockId && dragHoverCol !== null && (
        <div className="flex items-center justify-between px-3 py-1.5 rounded-lg bg-accent/10 border border-accent/30 text-[11px] text-accent font-semibold">
          <span className="flex items-center gap-1.5">
            <Move className="w-3.5 h-3.5" />
            Arrastando na grade: largue para posicionar na{' '}
            <strong>Coluna {dragHoverCol}</strong> (de 12)
          </span>
        </div>
      )}

      {/* ZONA DE ESCRITA EM GRADE DE CÉLULAS (12 COLUNAS) */}
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
        className="grid grid-cols-12 gap-2.5 min-h-[150px] p-2 rounded-xl border border-transparent transition-all relative"
      >
        {blocks.map((block, index) => {
          const isDragOver = dragOverBlockId === block.id;
          const span = normalizeGridSpan(block.gridSpan);
          const start = normalizeGridStart(block.gridStart, span);
          const isConfigOpen = cellConfigOpenForId === block.id;
          const blockIssues = writingIssues.filter((iss) => iss.blockId === block.id);

          return (
            <div
              key={block.id}
              draggable={!draggingMindNode}
              onDragStart={(e) => handleDragStart(e, block.id)}
              onDragOver={(e) => handleBlockDragOver(e, block.id)}
              onDragLeave={() => {
                setDragOverBlockId(null);
                setDragSide(null);
              }}
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
              {isDragOver && dragSide && (
                <div
                  aria-hidden
                  className={`absolute top-1 bottom-1 w-1 rounded-full bg-accent shadow-[0_0_12px_var(--accent)] z-30 pointer-events-none ${
                    dragSide === 'left' ? '-left-1.5' : '-right-1.5'
                  }`}
                />
              )}

              {/* ALÇA LATERAL DIREITA PARA REDIMENSIONAR ARRASTANDO */}
              <div
                title="Arraste para os lados para ajustar a largura da célula"
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

              {/* CABEÇALHO COMPACTO DA CÉLULA */}
              <div className="flex items-center justify-between gap-1 opacity-0 group-hover:opacity-100 focus-within:opacity-100 transition-opacity text-[10px] text-muted select-none min-w-0">
                <div className="flex items-center gap-0.5 min-w-0">
                  <button
                    type="button"
                    title="Adicionar ou trocar tipo de bloco"
                    onClick={() => {
                      setCellConfigOpenForId(null);
                      setMenuOpenForBlockId(
                        menuOpenForBlockId === block.id ? null : block.id
                      );
                    }}
                    className="p-1 rounded hover:bg-elevated text-secondary hover:text-accent shrink-0"
                  >
                    <Plus className="w-3.5 h-3.5" />
                  </button>

                  <div
                    title="Arraste para reordenar · solte na borda esquerda ou direita de outro bloco para ficarem lado a lado"
                    className="p-1 rounded cursor-grab active:cursor-grabbing hover:bg-elevated text-secondary hover:text-primary shrink-0"
                  >
                    <GripVertical className="w-3.5 h-3.5" />
                  </div>

                  <button
                    type="button"
                    title="Ajustar tamanho e posição horizontal da célula"
                    onClick={() => {
                      setMenuOpenForBlockId(null);
                      setCellConfigOpenForId(isConfigOpen ? null : block.id);
                    }}
                    className={`flex items-center gap-1 px-1.5 py-0.5 rounded border text-[9px] font-bold transition-colors truncate ${
                      isConfigOpen
                        ? 'bg-accent text-white border-accent'
                        : 'bg-elevated border-border text-secondary hover:text-primary'
                    }`}
                  >
                    <SlidersHorizontal className="w-2.5 h-2.5 shrink-0" />
                    <span className="truncate">
                      {getSpanLabel(span)}
                      {start > 0 ? ` · Col ${start}` : ''}
                    </span>
                  </button>
                </div>

                <div className="flex items-center gap-0.5 shrink-0">
                  {block.spoiler && (
                    <span className="mr-1 inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full bg-amber-500/15 text-amber-400 text-[9px] font-bold">
                      <EyeOff className="w-2.5 h-2.5" /> Spoiler
                    </span>
                  )}
                  <div className="relative">
                    <button
                      type="button"
                      onClick={() => setBlockMoreMenuId(blockMoreMenuId === block.id ? null : block.id)}
                      title="Mais opções do bloco"
                      aria-label="Mais opções do bloco"
                      aria-expanded={blockMoreMenuId === block.id}
                      className="p-1 rounded hover:bg-elevated text-muted hover:text-primary"
                    >
                      <MoreHorizontal className="w-3.5 h-3.5" />
                    </button>
                    {blockMoreMenuId === block.id && (
                      <>
                        <div className="fixed inset-0 z-40" onClick={() => setBlockMoreMenuId(null)} />
                        <div role="menu" className="absolute right-0 top-full mt-1 z-50 w-56 py-1 rounded-xl bg-surface border border-border shadow-2xl text-xs normal-case">
                          <button
                            type="button"
                            role="menuitemcheckbox"
                            aria-checked={Boolean(block.spoiler)}
                            onClick={() => {
                              updateBlock(block.id, { spoiler: !block.spoiler });
                              setBlockMoreMenuId(null);
                            }}
                            className="w-full flex items-center justify-between gap-2 px-3 py-2 text-left text-primary hover:bg-elevated"
                          >
                            <span className="flex items-center gap-2">
                              <EyeOff className="w-3.5 h-3.5 text-amber-400" />
                              <span>
                                <span className="block font-semibold">Contém spoiler</span>
                                <span className="block text-[10px] text-muted">Desfoca este bloco para os leitores</span>
                              </span>
                            </span>
                            {block.spoiler && <Check className="w-3.5 h-3.5 text-accent shrink-0" />}
                          </button>
                        </div>
                      </>
                    )}
                  </div>
                  <button
                    type="button"
                    onClick={() => moveBlockStep(block.id, 'up')}
                    disabled={index === 0}
                    title="Mover para trás/cima"
                    className="p-1 rounded hover:bg-elevated text-muted hover:text-primary disabled:opacity-20"
                  >
                    <ArrowUp className="w-3 h-3" />
                  </button>
                  <button
                    type="button"
                    onClick={() => moveBlockStep(block.id, 'down')}
                    disabled={index === blocks.length - 1}
                    title="Mover para a frente/baixo"
                    className="p-1 rounded hover:bg-elevated text-muted hover:text-primary disabled:opacity-20"
                  >
                    <ArrowDown className="w-3 h-3" />
                  </button>
                  <button
                    type="button"
                    onClick={() => removeBlock(block.id)}
                    title="Remover célula"
                    className="p-1 rounded hover:bg-elevated text-muted hover:text-danger"
                  >
                    <Trash2 className="w-3 h-3" />
                  </button>
                </div>
              </div>

              {/* POPOVER DE TAMANHO E POSIÇÃO DA CÉLULA */}
              {isConfigOpen && (
                <div className="absolute left-2 top-8 z-30 w-60 p-3 rounded-xl bg-surface border border-border shadow-2xl space-y-2.5">
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] font-bold text-primary uppercase tracking-wider">
                      Dimensão da Célula
                    </span>
                    <button
                      type="button"
                      onClick={() => setCellConfigOpenForId(null)}
                      className="text-muted hover:text-primary"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  </div>

                  <div className="space-y-1">
                    <span className="text-[10px] text-muted block">Largura na grade:</span>
                    <div className="grid grid-cols-5 gap-1">
                      {CELL_SIZES.map((c) => (
                        <button
                          key={c.cols}
                          type="button"
                          onClick={() =>
                            updateBlock(block.id, {
                              gridSpan: c.cols,
                              // Mantém o fluxo automático para permitir lado a lado
                              gridStart: normalizeGridStart(start, c.cols),
                            })
                          }
                          className={`py-1 rounded text-[10px] font-bold border transition-colors ${
                            span === c.cols
                              ? 'bg-accent text-white border-accent'
                              : 'bg-elevated border-border text-secondary hover:text-primary'
                          }`}
                        >
                          {c.label}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div className="space-y-1">
                    <span className="text-[10px] text-muted block">
                      Coluna inicial:
                    </span>
                    <select
                      value={start}
                      onChange={(e) =>
                        updateBlock(block.id, { gridStart: Number(e.target.value) })
                      }
                      className="w-full bg-elevated border border-border rounded-lg px-2 py-1 text-xs text-primary focus:outline-none focus:border-accent"
                    >
                      <option value={0}>Automático (Fluxo lado a lado)</option>
                      {Array.from({ length: 12 - span }, (_, i) => i + 2).map((col) => (
                        <option key={col} value={col}>
                          Coluna {col}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
              )}

              {/* CONTEÚDO DO BLOCO */}
              <div className="flex-1 min-w-0">
                {(block.type === 'paragraph' ||
                  block.type === 'h1' ||
                  block.type === 'h2' ||
                  block.type === 'quote' ||
                  block.type === 'code') && (
                  <RichBlockEditable
                    block={block}
                    spellCheckEnabled={spellCheckEnabled}
                    placeholder={
                      index === 0 && block.type === 'paragraph' && span === 12
                        ? "Compartilhe seu Insight... (Digite '/' para inserir blocos ou selecione o texto para realçar)"
                        : block.type === 'h1'
                        ? 'Título...'
                        : block.type === 'h2'
                        ? 'Subtítulo...'
                        : block.type === 'quote'
                        ? 'Citação...'
                        : block.type === 'code'
                        ? '// Código...'
                        : "Digite '/'..."
                    }
                    className={`${getFontClass(block.fontStyle)} ${getBlockTypographyClass(
                      block.type
                    )}`}
                    onFocus={() => setActiveBlockId(block.id)}
                    onChangeHtml={(html) => updateBlock(block.id, { html })}
                    onSlashTriggered={() => setMenuOpenForBlockId(block.id)}
                    onEnterPressed={() => insertBlockAfter(block.id, 'paragraph')}
                    onBackspaceEmpty={() => removeBlock(block.id)}
                  />
                )}

                {block.type === 'bullet' && (
                  <div className="flex items-start gap-2">
                    <span className="text-accent font-bold mt-1">•</span>
                    <RichBlockEditable
                      block={block}
                      spellCheckEnabled={spellCheckEnabled}
                      placeholder="Item..."
                      className={`${getFontClass(
                        block.fontStyle
                      )} text-sm sm:text-base text-primary leading-relaxed`}
                      onFocus={() => setActiveBlockId(block.id)}
                      onChangeHtml={(html) => updateBlock(block.id, { html })}
                      onSlashTriggered={() => setMenuOpenForBlockId(block.id)}
                      onEnterPressed={() => insertBlockAfter(block.id, 'bullet')}
                      onBackspaceEmpty={() => removeBlock(block.id)}
                    />
                  </div>
                )}

                {block.type === 'callout' && (
                  <div className="p-3 rounded-xl bg-elevated border border-accent/40 flex items-start gap-2.5 min-w-0">
                    <Sparkles className="w-4 h-4 text-accent shrink-0 mt-1" />
                    <RichBlockEditable
                      block={block}
                      spellCheckEnabled={spellCheckEnabled}
                      placeholder="Nota de destaque..."
                      className={`${getFontClass(
                        block.fontStyle
                      )} text-sm text-primary leading-relaxed`}
                      onFocus={() => setActiveBlockId(block.id)}
                      onChangeHtml={(html) => updateBlock(block.id, { html })}
                      onSlashTriggered={() => setMenuOpenForBlockId(block.id)}
                      onEnterPressed={() => insertBlockAfter(block.id, 'paragraph')}
                      onBackspaceEmpty={() => removeBlock(block.id)}
                    />
                  </div>
                )}

                {/* PAINEL DE SUGESTÕES DE ORTOGRAFIA E SINTAXE */}
                {spellCheckEnabled && blockIssues.length > 0 && (
                  <div className="mt-2 p-2.5 rounded-xl bg-elevated/90 border border-amber-500/30 space-y-2">
                    <div className="flex items-center gap-1.5 text-[10px] font-bold text-amber-500">
                      <SpellCheck className="w-3.5 h-3.5 shrink-0" />
                      <span>Sugestões de Escrita e Sintaxe ({blockIssues.length})</span>
                    </div>

                    <div className="space-y-1.5">
                      {blockIssues.map((issue) => (
                        <div
                          key={issue.id}
                          className="flex flex-wrap items-center justify-between gap-2 p-2 rounded-lg bg-surface border border-border text-xs"
                        >
                          <div className="min-w-0 flex-1">
                            <div className="flex items-center gap-1.5 flex-wrap">
                              <span className="px-1.5 py-0.5 rounded bg-danger/15 text-danger line-through font-semibold text-[11px]">
                                {issue.wrongText}
                              </span>
                              <span className="text-[10px] uppercase px-1.5 py-0.5 rounded bg-elevated text-muted font-bold">
                                {issue.category}
                              </span>
                            </div>
                            <p className="text-[11px] text-secondary mt-0.5">
                              {issue.message}
                            </p>
                          </div>

                          <div className="flex items-center gap-1 flex-wrap">
                            {issue.replacements.map((rep) => (
                              <button
                                key={rep}
                                type="button"
                                onClick={() => applyCorrection(issue, rep)}
                                className="flex items-center gap-1 px-2 py-1 rounded-lg bg-accent text-white text-[11px] font-bold hover:bg-accent-hover transition-colors"
                              >
                                <Check className="w-3 h-3" />
                                <span>{rep}</span>
                              </button>
                            ))}
                            <button
                              type="button"
                              onClick={() => ignoreCorrection(issue.id)}
                              title="Ignorar sugestão"
                              className="p-1 text-muted hover:text-primary"
                            >
                              <X className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {block.type === 'divider' && (
                  <div className="py-3">
                    <hr className="border-border" />
                  </div>
                )}

                {/* BLOCO DE IMAGEM */}
                {block.type === 'image' && (
                  <div className="p-2.5 rounded-xl bg-elevated border border-border space-y-2.5 overflow-hidden min-w-0">
                    {!block.imageUrl ? (
                      <label className="flex flex-col items-center justify-center py-5 px-2 border border-dashed border-border rounded-xl cursor-pointer hover:border-accent transition-colors text-center">
                        <ImageIcon className="w-5 h-5 text-accent mb-1" />
                        <span className="text-[11px] font-semibold text-primary">
                          {uploadingBlockId === block.id
                            ? uploadProgressText || 'A enviar...'
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
                      <div className="space-y-2 min-w-0">
                        <div className="flex flex-wrap items-center justify-between gap-1.5 text-[10px]">
                          <div className="flex flex-wrap items-center gap-1 bg-surface p-1 rounded-lg border border-border">
                            {(['25%', '50%', '75%', '100%'] as ImageWidthType[]).map((w) => (
                              <button
                                key={w}
                                type="button"
                                onClick={() => updateBlock(block.id, { imageWidth: w })}
                                className={`px-1.5 py-0.5 rounded font-bold text-[10px] transition-colors ${
                                  (block.imageWidth || '100%') === w
                                    ? 'bg-accent text-white'
                                    : 'text-secondary hover:text-primary'
                                }`}
                              >
                                {w}
                              </button>
                            ))}
                          </div>

                          <div className="flex items-center gap-1">
                            <div className="flex items-center gap-0.5 bg-surface p-1 rounded-lg border border-border">
                              {(
                                [
                                  { id: 'left', label: 'Esquerda', icon: AlignLeft },
                                  { id: 'center', label: 'Centro', icon: AlignCenter },
                                  { id: 'right', label: 'Direita', icon: AlignRight },
                                ] as const
                              ).map((pos) => {
                                const Icon = pos.icon;
                                return (
                                  <button
                                    key={pos.id}
                                    type="button"
                                    title={pos.label}
                                    onClick={() =>
                                      updateBlock(block.id, { imageAlign: pos.id })
                                    }
                                    className={`p-1 rounded transition-colors ${
                                      (block.imageAlign || 'center') === pos.id
                                        ? 'bg-accent text-white'
                                        : 'text-secondary hover:text-primary'
                                    }`}
                                  >
                                    <Icon className="w-3 h-3" />
                                  </button>
                                );
                              })}
                            </div>

                            <button
                              type="button"
                              title="Trocar imagem"
                              onClick={() => updateBlock(block.id, { imageUrl: null })}
                              className="p-1.5 rounded-lg bg-surface border border-border text-muted hover:text-danger transition-colors"
                            >
                              <X className="w-3 h-3" />
                            </button>
                          </div>
                        </div>

                        <div className="flex items-center gap-2 px-0.5">
                          <span className="text-[10px] font-semibold text-muted shrink-0">Tamanho</span>
                          <input
                            type="range"
                            min={15}
                            max={100}
                            step={5}
                            value={parseInt(block.imageWidth || '100%', 10) || 100}
                            onChange={(e) => updateBlock(block.id, { imageWidth: `${Number(e.target.value)}%` })}
                            aria-label="Largura da imagem no card"
                            className="flex-1 min-w-0 accent-[var(--accent)] h-1 cursor-pointer"
                          />
                          <span className="w-9 text-right text-[10px] font-mono font-bold text-primary tabular-nums">
                            {block.imageWidth || '100%'}
                          </span>
                        </div>

                        <div
                          ref={(el) => {
                            imageFrameRefs.current[block.id] = el;
                          }}
                          className="w-full"
                        >
                        <div
                          style={{ width: block.imageWidth || '100%' }}
                          className={`${getImageAlignClass(
                            block.imageAlign
                          )} ${resizingImageId === block.id ? '' : 'transition-[width] duration-200'} space-y-1 max-w-full relative group/img`}
                        >
                          <div className="relative">
                          <img
                            src={block.imageUrl}
                            alt={block.imageCaption || 'Imagem do post'}
                            draggable={false}
                            className="w-full h-auto rounded-xl border border-border object-cover"
                          />
                          {/* alça de redimensionar (arraste o canto) */}
                          <span
                            role="slider"
                            aria-label="Arraste para redimensionar a imagem"
                            aria-valuenow={parseInt(block.imageWidth || '100%', 10) || 100}
                            aria-valuemin={15}
                            aria-valuemax={100}
                            title="Arraste para redimensionar"
                            style={{ touchAction: 'none' }}
                            onPointerDown={(e) => {
                              e.preventDefault();
                              e.stopPropagation();
                              (e.target as HTMLElement).setPointerCapture?.(e.pointerId);
                              setResizingImageId(block.id);
                            }}
                            onPointerMove={(e) => {
                              if (resizingImageId !== block.id) return;
                              const frame = imageFrameRefs.current[block.id];
                              if (!frame) return;
                              const r = frame.getBoundingClientRect();
                              const align = block.imageAlign || 'center';
                              // largura em px a partir da borda fixa (esq., dir. ou centro)
                              const px =
                                align === 'left'
                                  ? e.clientX - r.left
                                  : align === 'right'
                                    ? r.right - e.clientX
                                    : Math.abs(e.clientX - (r.left + r.width / 2)) * 2;
                              const pct = Math.max(15, Math.min(100, Math.round(((px / r.width) * 100) / 5) * 5));
                              if (`${pct}%` !== block.imageWidth) updateBlock(block.id, { imageWidth: `${pct}%` });
                            }}
                            onPointerUp={() => setResizingImageId(null)}
                            onPointerCancel={() => setResizingImageId(null)}
                            className={`absolute ${
                              (block.imageAlign || 'center') === 'right' ? 'left-1 cursor-nesw-resize' : 'right-1 cursor-nwse-resize'
                            } bottom-1 w-6 h-6 rounded-full bg-accent text-white shadow-lg ring-2 ring-white/80 grid place-items-center opacity-90 sm:opacity-0 sm:group-hover/img:opacity-100 transition-opacity`}
                          >
                            <svg viewBox="0 0 10 10" className="w-3 h-3" aria-hidden>
                              <path d="M9 1 1 9M9 5 5 9" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
                            </svg>
                          </span>
                          </div>
                          <input
                            type="text"
                            value={block.imageCaption || ''}
                            onChange={(e) =>
                              updateBlock(block.id, { imageCaption: e.target.value })
                            }
                            placeholder="Legenda (opcional)..."
                            className="w-full bg-transparent text-center text-[11px] text-secondary placeholder:text-muted focus:outline-none truncate"
                          />
                        </div>
                        </div>
                      </div>
                    )}
                  </div>
                )}

                {/* BLOCO DE VÍDEO E GIF */}
                {(block.type === 'video' || block.type === 'gif') && (
                  <div className="p-2.5 rounded-xl bg-elevated border border-border space-y-2.5 overflow-hidden min-w-0">
                    {!block.videoUrl ? (
                      uploadingBlockId === block.id ? (
                        <div className="py-5 px-3 border border-dashed border-accent/60 rounded-xl flex flex-col items-center justify-center gap-2 text-center bg-surface/50">
                          <div className="w-5 h-5 rounded-full border-2 border-accent border-t-transparent animate-spin" />
                          <span className="text-[11px] font-bold text-primary">
                            {uploadProgressText || 'Processando mídia...'}
                          </span>
                          <div className="w-44 h-1.5 rounded-full bg-surface overflow-hidden border border-border">
                            <div
                              style={{ width: `${uploadProgressPct}%` }}
                              className="h-full bg-accent transition-all duration-300"
                            />
                          </div>
                        </div>
                      ) : block.type === 'gif' ? (
                        <div className="space-y-2.5">
                          <div className="flex flex-wrap items-center justify-between gap-2">
                            <div className="flex items-center gap-1.5">
                              <span className="px-2 py-0.5 rounded bg-accent text-white text-[10px] font-mono font-bold tracking-wider uppercase">
                                GIPHY
                              </span>
                              <div className="flex items-center bg-surface p-0.5 rounded-lg border border-border text-[10px] font-semibold">
                                <button
                                  type="button"
                                  onClick={() => setGiphyMediaType('gifs')}
                                  className={`px-2 py-0.5 rounded-md transition-colors ${
                                    giphyMediaType === 'gifs'
                                      ? 'bg-accent text-white'
                                      : 'text-secondary hover:text-primary'
                                  }`}
                                >
                                  GIFs
                                </button>
                                <button
                                  type="button"
                                  onClick={() => setGiphyMediaType('stickers')}
                                  className={`px-2 py-0.5 rounded-md transition-colors ${
                                    giphyMediaType === 'stickers'
                                      ? 'bg-accent text-white'
                                      : 'text-secondary hover:text-primary'
                                  }`}
                                >
                                  Stickers
                                </button>
                              </div>
                            </div>

                            <label className="text-[10px] font-semibold text-accent hover:underline cursor-pointer flex items-center gap-1">
                              <span>Enviar arquivo local</span>
                              <input
                                type="file"
                                accept="image/gif,video/mp4,video/webm"
                                onChange={(e) => handleBlockVideoUpload(e, block.id, true)}
                                className="hidden"
                              />
                            </label>
                          </div>

                          <div className="relative">
                            <Search className="w-3.5 h-3.5 text-muted absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                            <input
                              type="text"
                              value={giphyQuery}
                              onChange={(e) => setGiphyQuery(e.target.value)}
                              onKeyDown={(e) => {
                                if (e.key === 'Enter') {
                                  e.preventDefault();
                                  fetchGiphyFromApi(giphyQuery, giphyMediaType, 0);
                                }
                              }}
                              placeholder={
                                giphyMediaType === 'stickers'
                                  ? 'Pesquisar Stickers no GIPHY...'
                                  : 'Pesquisar GIFs no GIPHY...'
                              }
                              className="w-full bg-surface border border-border rounded-xl pl-8 pr-8 py-1.5 text-xs text-primary placeholder:text-muted focus:outline-none focus:border-accent"
                            />
                            {giphyQuery && (
                              <button
                                type="button"
                                onClick={() => setGiphyQuery('')}
                                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted hover:text-primary"
                              >
                                <X className="w-3.5 h-3.5" />
                              </button>
                            )}
                          </div>

                          <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar pb-0.5">
                            {GIPHY_QUICK_TAGS.map((tag) => {
                              const isSelected = giphyQuery === tag.query;
                              return (
                                <button
                                  key={tag.label}
                                  type="button"
                                  onClick={() => setGiphyQuery(tag.query)}
                                  className={`px-2.5 py-1 rounded-full text-[10px] font-semibold border whitespace-nowrap transition-colors ${
                                    isSelected
                                      ? 'bg-accent text-white border-accent'
                                      : 'bg-surface border-border text-secondary hover:text-primary'
                                  }`}
                                >
                                  {tag.label}
                                </button>
                              );
                            })}
                          </div>

                          {loadingGiphy ? (
                            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 py-2">
                              {[1, 2, 3, 4, 5, 6].map((n) => (
                                <div
                                  key={n}
                                  className="h-24 rounded-lg bg-surface animate-pulse border border-border"
                                />
                              ))}
                            </div>
                          ) : giphyResults.length === 0 ? (
                            <p className="text-xs text-muted text-center py-6">
                              Nenhum resultado encontrado.
                            </p>
                          ) : (
                            <div className="space-y-2 max-h-64 overflow-y-auto pr-1">
                              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                                {giphyResults.map((gif) => (
                                  <button
                                    key={gif.id}
                                    type="button"
                                    onClick={() =>
                                      updateBlock(block.id, {
                                        videoUrl: gif.fullUrl,
                                        isGif: true,
                                        r2Key: null,
                                      })
                                    }
                                    title={gif.title}
                                    className="group/gif relative h-24 sm:h-28 rounded-lg overflow-hidden bg-black/80 border border-border hover:border-accent transition-all"
                                  >
                                    <img
                                      src={gif.previewUrl}
                                      alt={gif.title}
                                      loading="lazy"
                                      className={`w-full h-full ${
                                        giphyMediaType === 'stickers'
                                          ? 'object-contain p-1'
                                          : 'object-cover'
                                      } group-hover/gif:scale-105 transition-transform duration-200`}
                                    />
                                    <div className="absolute inset-0 bg-accent/0 group-hover/gif:bg-accent/15 transition-colors" />
                                  </button>
                                ))}
                              </div>

                              <button
                                type="button"
                                disabled={loadingMoreGiphy}
                                onClick={() =>
                                  fetchGiphyFromApi(
                                    giphyQuery,
                                    giphyMediaType,
                                    giphyOffset + 18
                                  )
                                }
                                className="w-full py-1.5 rounded-lg bg-surface border border-border hover:border-accent text-[11px] font-semibold text-secondary hover:text-primary transition-colors disabled:opacity-50"
                              >
                                {loadingMoreGiphy
                                  ? 'A carregar...'
                                  : 'Carregar mais resultados'}
                              </button>
                            </div>
                          )}
                        </div>
                      ) : (
                        <label className="flex flex-col items-center justify-center py-5 px-2 border border-dashed border-border rounded-xl cursor-pointer hover:border-accent transition-colors text-center">
                          <Film className="w-5 h-5 text-accent mb-1" />
                          <span className="text-[11px] font-semibold text-primary">
                            Selecionar vídeo (MP4 / WebM / MOV)
                          </span>
                          <span className="text-[9px] text-muted mt-0.5 font-mono">
                            Compressão H.264 · Cloudflare R2
                          </span>
                          <input
                            type="file"
                            accept="video/mp4,video/webm,video/quicktime"
                            onChange={(e) => handleBlockVideoUpload(e, block.id, false)}
                            className="hidden"
                          />
                        </label>
                      )
                    ) : (
                      <div className="space-y-2 min-w-0">
                        <div className="flex flex-wrap items-center justify-between gap-1.5 text-[10px]">
                          <div className="flex flex-wrap items-center gap-1 bg-surface p-1 rounded-lg border border-border">
                            {(['25%', '50%', '75%', '100%'] as ImageWidthType[]).map((w) => (
                              <button
                                key={w}
                                type="button"
                                onClick={() => updateBlock(block.id, { videoWidth: w })}
                                className={`px-1.5 py-0.5 rounded font-bold text-[10px] transition-colors ${
                                  (block.videoWidth || '100%') === w
                                    ? 'bg-accent text-white'
                                    : 'text-secondary hover:text-primary'
                                }`}
                              >
                                {w}
                              </button>
                            ))}
                          </div>

                          <div className="flex items-center gap-1 flex-wrap">
                            {compressionBadges[block.id] && (
                              <span className="px-2 py-0.5 rounded bg-[#10b981]/15 border border-[#10b981]/40 text-[#10b981] font-mono text-[9px] font-semibold">
                                {compressionBadges[block.id]}
                              </span>
                            )}

                            {block.type === 'video' && (
                              <button
                                type="button"
                                onClick={() =>
                                  updateBlock(block.id, { isGif: !block.isGif })
                                }
                                className={`px-2 py-1 rounded-lg border text-[10px] font-semibold transition-colors ${
                                  block.isGif
                                    ? 'bg-accent/15 border-accent text-accent'
                                    : 'bg-surface border-border text-secondary hover:text-primary'
                                }`}
                              >
                                {block.isGif ? 'Loop Contínuo' : 'Player Padrão'}
                              </button>
                            )}

                            <div className="flex items-center gap-0.5 bg-surface p-1 rounded-lg border border-border">
                              {(
                                [
                                  { id: 'left', label: 'Esquerda', icon: AlignLeft },
                                  { id: 'center', label: 'Centro', icon: AlignCenter },
                                  { id: 'right', label: 'Direita', icon: AlignRight },
                                ] as const
                              ).map((pos) => {
                                const Icon = pos.icon;
                                return (
                                  <button
                                    key={pos.id}
                                    type="button"
                                    title={pos.label}
                                    onClick={() =>
                                      updateBlock(block.id, { videoAlign: pos.id })
                                    }
                                    className={`p-1 rounded transition-colors ${
                                      (block.videoAlign || 'center') === pos.id
                                        ? 'bg-accent text-white'
                                        : 'text-secondary hover:text-primary'
                                    }`}
                                  >
                                    <Icon className="w-3 h-3" />
                                  </button>
                                );
                              })}
                            </div>

                            <button
                              type="button"
                              onClick={() => {
                                if (block.r2Key) {
                                  fetch('/api/upload/r2', {
                                    method: 'DELETE',
                                    headers: { 'Content-Type': 'application/json' },
                                    body: JSON.stringify({ r2Key: block.r2Key }),
                                  }).catch(() => {});
                                }
                                updateBlock(block.id, { videoUrl: null, r2Key: null });
                              }}
                              className="px-2 py-1 rounded-lg bg-surface border border-border text-muted hover:text-danger transition-colors flex items-center gap-1"
                            >
                              <X className="w-3 h-3" />
                              <span>{block.type === 'gif' ? 'Trocar' : ''}</span>
                            </button>
                          </div>
                        </div>

                        <div
                          style={{ width: block.videoWidth || '100%' }}
                          className={`${getImageAlignClass(
                            block.videoAlign
                          )} transition-all duration-200 space-y-1 max-w-full`}
                        >
                          {/\.(gif|webp)(\?|$)/i.test(block.videoUrl) ||
                          block.videoUrl.includes('giphy.com') ||
                          block.videoUrl.includes('tenor.com') ? (
                            <img
                              src={block.videoUrl}
                              alt={block.videoCaption || 'GIF do post'}
                              className="w-full h-auto rounded-xl border border-border object-contain bg-black/90"
                            />
                          ) : (
                            <video
                              src={`${block.videoUrl}#t=0.001`}
                              controls={!(block.isGif || block.type === 'gif')}
                              autoPlay={Boolean(block.isGif || block.type === 'gif')}
                              loop={Boolean(block.isGif || block.type === 'gif')}
                              muted={Boolean(block.isGif || block.type === 'gif')}
                              playsInline
                              className="w-full h-auto rounded-xl border border-border object-contain bg-black/90"
                            />
                          )}
                          <input
                            type="text"
                            value={block.videoCaption || ''}
                            onChange={(e) =>
                              updateBlock(block.id, { videoCaption: e.target.value })
                            }
                            placeholder="Legenda (opcional)..."
                            className="w-full bg-transparent text-center text-[11px] text-secondary placeholder:text-muted focus:outline-none truncate"
                          />
                        </div>
                      </div>
                    )}
                  </div>
                )}

                {/* BLOCO DE MAPA MENTAL 2D */}
                {block.type === 'mindmap' && (
                  <div className="p-3 rounded-xl bg-elevated border border-border space-y-2.5 overflow-hidden min-w-0">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div className="flex items-center gap-2">
                        <Network className="w-3.5 h-3.5 text-[#a855f7]" />
                        <span className="text-[11px] font-bold text-primary uppercase tracking-wider">
                          Mapa Mental 2D · Brainstorm
                        </span>
                      </div>

                      <div className="flex flex-wrap items-center gap-1.5">
                        <button
                          type="button"
                          onClick={() => {
                            const current = block.mindMapNodes || [];
                            const newNode: MindMapNodeItem = {
                              id: `node-${Date.now()}`,
                              label: 'Novo Conceito',
                              note: 'Especificação...',
                              x: Math.min(82, 24 + ((current.length * 19) % 55)),
                              y: Math.min(82, 24 + ((current.length * 23) % 55)),
                              color: NODE_COLORS[current.length % NODE_COLORS.length],
                              icon: String(current.length).padStart(2, '0'),
                            };
                            const nextEdges = [...(block.mindMapEdges || [])];
                            if (
                              selectedMindNode &&
                              selectedMindNode.blockId === block.id
                            ) {
                              nextEdges.push({
                                id: `edge-${Date.now()}`,
                                fromId: selectedMindNode.nodeId,
                                toId: newNode.id,
                              });
                            }
                            updateBlock(block.id, {
                              mindMapNodes: [...current, newNode],
                              mindMapEdges: nextEdges,
                            });
                            setSelectedMindNode({ blockId: block.id, nodeId: newNode.id });
                          }}
                          className="px-2.5 py-1 rounded-lg bg-accent text-white text-[10px] font-semibold flex items-center gap-1"
                        >
                          <Plus className="w-3 h-3" />
                          <span>Adicionar Nó</span>
                        </button>

                        {selectedMindNode && selectedMindNode.blockId === block.id && (
                          <button
                            type="button"
                            onClick={() =>
                              setConnectingMindNodeFrom(
                                connectingMindNodeFrom?.nodeId === selectedMindNode.nodeId
                                  ? null
                                  : selectedMindNode
                              )
                            }
                            className={`px-2.5 py-1 rounded-lg border text-[10px] font-semibold flex items-center gap-1 ${
                              connectingMindNodeFrom?.blockId === block.id
                                ? 'bg-zinc-100 text-zinc-900 border-white'
                                : 'bg-surface border-border text-secondary hover:text-primary'
                            }`}
                          >
                            <Link2 className="w-3 h-3" />
                            <span>
                              {connectingMindNodeFrom?.blockId === block.id
                                ? 'Selecione destino...'
                                : 'Conectar'}
                            </span>
                          </button>
                        )}
                      </div>
                    </div>

                    <PanZoomSurface
                      worldWidth={MINDMAP_WORLD.width}
                      worldHeight={MINDMAP_WORLD.height}
                      bounds={boundsFromPercent(block.mindMapNodes || [], MINDMAP_WORLD.width, MINDMAP_WORLD.height)}
                      heightClass="h-[360px] sm:h-[420px]"
                      worldRef={(el) => {
                        mindMapCanvasRefs.current[block.id] = el;
                      }}
                      onBackgroundClick={() => {
                        setSelectedMindNode(null);
                        setConnectingMindNodeFrom(null);
                      }}
                    >
                      <svg className="absolute inset-0 w-full h-full pointer-events-none">
                        {(block.mindMapEdges || []).map((edge) => {
                          const fromNode = (block.mindMapNodes || []).find(
                            (n) => n.id === edge.fromId
                          );
                          const toNode = (block.mindMapNodes || []).find(
                            (n) => n.id === edge.toId
                          );
                          if (!fromNode || !toNode) return null;

                          return (
                            <line
                              key={edge.id}
                              x1={`${fromNode.x}%`}
                              y1={`${fromNode.y}%`}
                              x2={`${toNode.x}%`}
                              y2={`${toNode.y}%`}
                              stroke={fromNode.color || '#52525b'}
                              strokeWidth="1.5"
                              strokeDasharray="4 3"
                              opacity="0.75"
                            />
                          );
                        })}
                      </svg>

                      {(block.mindMapNodes || []).map((node, nIdx) => {
                        const isSelected =
                          selectedMindNode?.blockId === block.id &&
                          selectedMindNode?.nodeId === node.id;

                        return (
                          <div
                            key={node.id}
                            onClick={(e) => {
                              e.stopPropagation();
                              if (
                                connectingMindNodeFrom &&
                                connectingMindNodeFrom.blockId === block.id &&
                                connectingMindNodeFrom.nodeId !== node.id
                              ) {
                                const exists = (block.mindMapEdges || []).some(
                                  (ed) =>
                                    (ed.fromId === connectingMindNodeFrom.nodeId &&
                                      ed.toId === node.id) ||
                                    (ed.fromId === node.id &&
                                      ed.toId === connectingMindNodeFrom.nodeId)
                                );
                                if (!exists) {
                                  updateBlock(block.id, {
                                    mindMapEdges: [
                                      ...(block.mindMapEdges || []),
                                      {
                                        id: `edge-${Date.now()}`,
                                        fromId: connectingMindNodeFrom.nodeId,
                                        toId: node.id,
                                      },
                                    ],
                                  });
                                }
                                setConnectingMindNodeFrom(null);
                                setSelectedMindNode({
                                  blockId: block.id,
                                  nodeId: node.id,
                                });
                                return;
                              }
                              setSelectedMindNode({
                                blockId: block.id,
                                nodeId: node.id,
                              });
                            }}
                            style={{
                              left: `${node.x}%`,
                              top: `${node.y}%`,
                              transform: 'translate(-50%, -50%)',
                              borderColor: isSelected ? '#ffffff' : '#27272a',
                            }}
                            data-pz-stop
                            className={`absolute z-10 w-40 sm:w-48 p-2.5 rounded-xl bg-[#121215]/95 backdrop-blur border shadow-xl ${
                              isSelected ? 'ring-2 ring-accent/40' : ''
                            }`}
                          >
                            <div
                              style={{ touchAction: 'none' }}
                              onPointerDown={(e) => {
                                e.stopPropagation();
                                setSelectedMindNode({
                                  blockId: block.id,
                                  nodeId: node.id,
                                });
                                setDraggingMindNode({
                                  blockId: block.id,
                                  nodeId: node.id,
                                });
                              }}
                              className="flex items-center justify-between gap-1 pb-1 mb-1 border-b border-zinc-800/80 cursor-grab active:cursor-grabbing"
                            >
                              <div className="flex items-center gap-1.5">
                                <span
                                  style={{ backgroundColor: node.color }}
                                  className="w-2 h-2 rounded-full shrink-0"
                                />
                                <span className="text-[9px] font-mono font-semibold text-zinc-400">
                                  NÓ · {String(nIdx).padStart(2, '0')}
                                </span>
                              </div>

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
                                      handleUploadBrainstormMediaToR2(
                                        e,
                                        block.id,
                                        'mindmap_node',
                                        node.id
                                      )
                                    }
                                    className="hidden"
                                  />
                                </label>
                                {(block.mindMapNodes?.length || 0) > 1 && (
                                  <button
                                    type="button"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      updateBlock(block.id, {
                                        mindMapNodes: (block.mindMapNodes || []).filter(
                                          (n) => n.id !== node.id
                                        ),
                                        mindMapEdges: (block.mindMapEdges || []).filter(
                                          (ed) =>
                                            ed.fromId !== node.id && ed.toId !== node.id
                                        ),
                                      });
                                    }}
                                    className="p-0.5 text-zinc-500 hover:text-danger"
                                  >
                                    <X className="w-3 h-3" />
                                  </button>
                                )}
                              </div>
                            </div>

                            <input
                              type="text"
                              value={node.label}
                              onChange={(e) => {
                                const next = (block.mindMapNodes || []).map((n) =>
                                  n.id === node.id
                                    ? { ...n, label: e.target.value }
                                    : n
                                );
                                updateBlock(block.id, { mindMapNodes: next });
                              }}
                              className="w-full bg-transparent text-xs font-bold text-zinc-100 focus:outline-none"
                            />

                            <textarea
                              rows={2}
                              value={node.note || ''}
                              placeholder="Especificação..."
                              onChange={(e) => {
                                const next = (block.mindMapNodes || []).map((n) =>
                                  n.id === node.id
                                    ? { ...n, note: e.target.value }
                                    : n
                                );
                                updateBlock(block.id, { mindMapNodes: next });
                              }}
                              className="w-full bg-transparent text-[10px] text-zinc-400 resize-none focus:outline-none mt-0.5 leading-tight"
                            />

                            {node.mediaUrl && (
                              <div className="mt-1 rounded-lg overflow-hidden border border-zinc-800 bg-black">
                                {/\.(mp4|webm|mov)(\?|$)/i.test(node.mediaUrl) ? (
                                  <video
                                    src={node.mediaUrl}
                                    controls
                                    playsInline
                                    className="w-full max-h-20 object-contain"
                                  />
                                ) : (
                                  <img
                                    src={node.mediaUrl}
                                    alt={node.label}
                                    className="w-full max-h-20 object-cover"
                                  />
                                )}
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </PanZoomSurface>
                  </div>
                )}

                {/* BLOCO DE ROADMAPS */}
                {block.type === 'roadmap' && (
                  <div className="p-3 rounded-xl bg-elevated border border-border space-y-3 overflow-hidden min-w-0">
                    <div className="flex items-center justify-between">
                      <span className="text-[11px] font-bold text-primary uppercase tracking-wider flex items-center gap-1.5">
                        <Compass className="w-3.5 h-3.5 text-[#38bdf8]" />
                        <span>Roadmap & Marcos</span>
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
                              description: 'Descrição da entrega...',
                              status: 'planned',
                            },
                          ];
                          updateBlock(block.id, { roadmapSteps: next });
                        }}
                        className="text-[10px] font-semibold text-accent hover:underline flex items-center gap-1"
                      >
                        <Plus className="w-3 h-3" /> Adicionar etapa
                      </button>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                      {(block.roadmapSteps || []).map((step) => {
                        const statusMeta = {
                          planned: {
                            label: 'Planeado',
                            dot: '#71717a',
                            cls: 'bg-zinc-500/15 text-zinc-300 border-zinc-500/30',
                          },
                          in_progress: {
                            label: 'Em andamento',
                            dot: '#38bdf8',
                            cls: 'bg-blue-500/15 text-blue-400 border-blue-500/30',
                          },
                          completed: {
                            label: 'Concluído',
                            dot: '#10b981',
                            cls: 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30',
                          },
                        };

                        return (
                          <div
                            key={step.id}
                            className="p-3 rounded-xl bg-surface border border-border space-y-2 flex flex-col justify-between"
                          >
                            <div className="space-y-1.5">
                              <div className="flex items-center justify-between gap-2">
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
                                  className="w-24 bg-transparent font-mono text-[10px] font-bold uppercase text-accent focus:outline-none"
                                />

                                <button
                                  type="button"
                                  onClick={() => {
                                    const order: RoadmapStepItem['status'][] = [
                                      'planned',
                                      'in_progress',
                                      'completed',
                                    ];
                                    const nextSt =
                                      order[(order.indexOf(step.status) + 1) % order.length];
                                    const next = (block.roadmapSteps || []).map((s) =>
                                      s.id === step.id ? { ...s, status: nextSt } : s
                                    );
                                    updateBlock(block.id, { roadmapSteps: next });
                                  }}
                                  className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full border text-[9px] font-semibold ${
                                    statusMeta[step.status].cls
                                  }`}
                                >
                                  <span
                                    style={{
                                      backgroundColor: statusMeta[step.status].dot,
                                    }}
                                    className="w-1.5 h-1.5 rounded-full"
                                  />
                                  <span>{statusMeta[step.status].label}</span>
                                </button>
                              </div>

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
                                className="w-full bg-transparent text-[11px] text-secondary resize-none focus:outline-none leading-snug"
                              />
                            </div>

                            <div className="flex items-center justify-between pt-1.5 border-t border-border/60 text-[10px]">
                              <label className="text-accent hover:underline cursor-pointer flex items-center gap-1">
                                <ImagePlus className="w-3 h-3" />
                                <span>Mídia R2</span>
                                <input
                                  type="file"
                                  accept="image/*,video/mp4,video/webm"
                                  onChange={(e) =>
                                    handleUploadBrainstormMediaToR2(
                                      e,
                                      block.id,
                                      'roadmap_step',
                                      step.id
                                    )
                                  }
                                  className="hidden"
                                />
                              </label>

                              {(block.roadmapSteps?.length || 0) > 1 && (
                                <button
                                  type="button"
                                  onClick={() => {
                                    const next = (block.roadmapSteps || []).filter(
                                      (s) => s.id !== step.id
                                    );
                                    updateBlock(block.id, { roadmapSteps: next });
                                  }}
                                  className="text-muted hover:text-danger"
                                >
                                  Remover
                                </button>
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}

                {/* BLOCO DE GRÁFICOS */}
                {block.type === 'chart' && (
                  <div className="p-3 rounded-xl bg-elevated border border-border space-y-3 overflow-hidden min-w-0">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <input
                        type="text"
                        value={block.chartTitle || ''}
                        onChange={(e) =>
                          updateBlock(block.id, { chartTitle: e.target.value })
                        }
                        placeholder="Título do gráfico..."
                        className="flex-1 min-w-[100px] bg-transparent text-xs font-bold text-primary placeholder:text-muted focus:outline-none"
                      />
                      <div className="flex items-center gap-1 bg-surface p-1 rounded-lg border border-border">
                        <button
                          type="button"
                          onClick={() => updateBlock(block.id, { chartType: 'vertical' })}
                          className={`flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-semibold ${
                            (block.chartType || 'vertical') === 'vertical'
                              ? 'bg-accent text-white'
                              : 'text-secondary hover:text-primary'
                          }`}
                        >
                          <BarChart3 className="w-3 h-3" />
                          <span>Barras</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => updateBlock(block.id, { chartType: 'donut' })}
                          className={`flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-semibold ${
                            block.chartType === 'donut'
                              ? 'bg-accent text-white'
                              : 'text-secondary hover:text-primary'
                          }`}
                        >
                          <PieChart className="w-3 h-3" />
                          <span>Rosca</span>
                        </button>
                      </div>
                    </div>

                    {(() => {
                      const data = block.chartData || [];
                      const maxVal = Math.max(...data.map((d) => d.value), 1);
                      const total = Math.max(
                        data.reduce((acc, d) => acc + d.value, 0),
                        1
                      );

                      return (block.chartType || 'vertical') === 'vertical' ? (
                        <div className="h-36 pt-4 px-1 flex items-end justify-around gap-2 border-b border-border">
                          {data.map((item, i) => (
                            <div
                              key={i}
                              className="flex-1 flex flex-col items-center gap-1 h-full justify-end min-w-0"
                            >
                              <span className="text-[9px] font-mono font-bold text-primary">
                                {item.value}
                              </span>
                              <div
                                style={{
                                  height: `${Math.max((item.value / maxVal) * 100, 6)}%`,
                                  backgroundColor: item.color,
                                }}
                                className="w-full max-w-[36px] rounded-t-md transition-all duration-300"
                              />
                              <span className="text-[9px] text-muted truncate w-full text-center">
                                {item.label}
                              </span>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <div className="flex flex-wrap items-center justify-center gap-4 py-2">
                          <svg viewBox="0 0 36 36" className="w-24 h-24 -rotate-90 shrink-0">
                            {(() => {
                              let accum = 0;
                              return data.map((item, i) => {
                                const pct = (item.value / total) * 100;
                                const dash = `${pct} ${100 - pct}`;
                                const offset = 100 - accum;
                                accum += pct;
                                return (
                                  <circle
                                    key={i}
                                    cx="18"
                                    cy="18"
                                    r="15.915"
                                    fill="transparent"
                                    stroke={item.color}
                                    strokeWidth="4.2"
                                    strokeDasharray={dash}
                                    strokeDashoffset={offset}
                                  />
                                );
                              });
                            })()}
                          </svg>
                          <div className="space-y-1 min-w-0">
                            {data.map((item, i) => (
                              <div key={i} className="flex items-center gap-1.5 text-[11px]">
                                <span
                                  style={{ backgroundColor: item.color }}
                                  className="w-2 h-2 rounded-full shrink-0"
                                />
                                <span className="text-primary font-medium truncate">
                                  {item.label}:
                                </span>
                                <span className="text-muted font-mono shrink-0">
                                  {item.value} ({Math.round((item.value / total) * 100)}%)
                                </span>
                              </div>
                            ))}
                          </div>
                        </div>
                      );
                    })()}

                    <div className="space-y-1.5 pt-1">
                      {(block.chartData || []).map((item, idx) => (
                        <div key={idx} className="flex items-center gap-1.5 min-w-0">
                          <input
                            type="color"
                            value={item.color}
                            onChange={(e) => {
                              const next = [...(block.chartData || [])];
                              next[idx] = { ...item, color: e.target.value };
                              updateBlock(block.id, { chartData: next });
                            }}
                            className="w-5 h-5 rounded bg-transparent cursor-pointer border-0 shrink-0"
                          />
                          <input
                            type="text"
                            value={item.label}
                            onChange={(e) => {
                              const next = [...(block.chartData || [])];
                              next[idx] = { ...item, label: e.target.value };
                              updateBlock(block.id, { chartData: next });
                            }}
                            placeholder="Rótulo"
                            className="flex-1 min-w-0 bg-surface border border-border rounded-lg px-2 py-1 text-[11px] text-primary"
                          />
                          <input
                            type="number"
                            value={item.value}
                            onChange={(e) => {
                              const next = [...(block.chartData || [])];
                              next[idx] = {
                                ...item,
                                value: Math.max(0, Number(e.target.value)),
                              };
                              updateBlock(block.id, { chartData: next });
                            }}
                            className="w-16 bg-surface border border-border rounded-lg px-2 py-1 text-[11px] font-mono text-primary shrink-0"
                          />
                          <button
                            type="button"
                            onClick={() => {
                              const next = (block.chartData || []).filter(
                                (_, i) => i !== idx
                              );
                              updateBlock(block.id, { chartData: next });
                            }}
                            className="text-muted hover:text-danger p-1 shrink-0"
                          >
                            <X className="w-3 h-3" />
                          </button>
                        </div>
                      ))}
                      <button
                        type="button"
                        onClick={() => {
                          const current = block.chartData || [];
                          const nextColor =
                            CHART_PALETTE[current.length % CHART_PALETTE.length];
                          updateBlock(block.id, {
                            chartData: [
                              ...current,
                              {
                                label: `Item ${current.length + 1}`,
                                value: 25,
                                color: nextColor,
                              },
                            ],
                          });
                        }}
                        className="text-[10px] font-semibold text-accent hover:underline flex items-center gap-1 pt-1"
                      >
                        <Plus className="w-3 h-3" /> Adicionar item
                      </button>
                    </div>
                  </div>
                )}

                {/* BLOCO DE ENQUETE */}
                {block.type === 'poll' && (
                  <div className="p-3 rounded-xl bg-elevated border border-border space-y-2.5 overflow-hidden min-w-0">
                    <div className="flex flex-wrap items-center justify-between gap-1">
                      <span className="text-[10px] font-bold text-accent uppercase tracking-wider">
                        Enquete
                      </span>
                      <label className="flex items-center gap-1 text-[10px] text-secondary cursor-pointer">
                        <input
                          type="checkbox"
                          checked={Boolean(block.pollMultiple)}
                          onChange={(e) =>
                            updateBlock(block.id, { pollMultiple: e.target.checked })
                          }
                          className="accent-accent rounded"
                        />
                        <span>Múltipla escolha</span>
                      </label>
                    </div>

                    <input
                      type="text"
                      value={block.pollQuestion || ''}
                      onChange={(e) =>
                        updateBlock(block.id, { pollQuestion: e.target.value })
                      }
                      placeholder="Pergunta da enquete..."
                      className="w-full bg-surface border border-border rounded-lg px-2.5 py-1.5 text-xs font-bold text-primary placeholder:text-muted focus:outline-none focus:border-accent"
                    />

                    <div className="space-y-1.5">
                      {(block.pollOptions || []).map((opt, idx) => (
                        <div key={opt.id} className="flex items-center gap-1.5 min-w-0">
                          <input
                            type="text"
                            value={opt.text}
                            onChange={(e) => {
                              const next = [...(block.pollOptions || [])];
                              next[idx] = { ...opt, text: e.target.value };
                              updateBlock(block.id, { pollOptions: next });
                            }}
                            placeholder={`Opção ${idx + 1}`}
                            className="flex-1 min-w-0 bg-surface border border-border rounded-lg px-2 py-1 text-xs text-primary focus:outline-none focus:border-accent"
                          />
                          {(block.pollOptions?.length || 0) > 2 && (
                            <button
                              type="button"
                              onClick={() => {
                                const next = (block.pollOptions || []).filter(
                                  (_, i) => i !== idx
                                );
                                updateBlock(block.id, { pollOptions: next });
                              }}
                              className="text-muted hover:text-danger p-1 shrink-0"
                            >
                              <X className="w-3 h-3" />
                            </button>
                          )}
                        </div>
                      ))}
                      <button
                        type="button"
                        onClick={() => {
                          const current = block.pollOptions || [];
                          updateBlock(block.id, {
                            pollOptions: [
                              ...current,
                              {
                                id: `opt-${block.id}-${Date.now()}-${current.length}`,
                                text: `Opção ${current.length + 1}`,
                                votes: 0,
                              },
                            ],
                          });
                        }}
                        className="text-[10px] font-semibold text-accent hover:underline flex items-center gap-1 pt-1"
                      >
                        <Plus className="w-3 h-3" /> Adicionar opção
                      </button>
                    </div>
                  </div>
                )}

                {/* BLOCO DE ARQUIVO */}
                {block.type === 'file' && (
                  <div className="p-2.5 rounded-xl bg-elevated border border-border overflow-hidden min-w-0">
                    {!block.fileUrl ? (
                      <label className="flex flex-col items-center justify-center py-4 px-2 border border-dashed border-border rounded-xl cursor-pointer hover:border-accent transition-colors text-center">
                        <Paperclip className="w-4 h-4 text-accent mb-1" />
                        <span className="text-[11px] font-semibold text-primary">
                          {uploadingBlockId === block.id
                            ? uploadProgressText || 'A enviar...'
                            : 'Anexar arquivo'}
                        </span>
                        <span className="text-[9px] text-muted mt-0.5 font-mono">
                          Restam {formatBytes(remainingBytes)} neste post
                        </span>
                        <input
                          type="file"
                          accept=".pdf,.doc,.docx,.txt,.csv,.xls,.xlsx,.ppt,.pptx,.zip,.rar,.7z,.png,.jpg,.jpeg,.webp,.mp3,.wav"
                          onChange={(e) => handleBlockFileUpload(e, block.id)}
                          className="hidden"
                        />
                      </label>
                    ) : (
                      <div className="flex items-center justify-between gap-2 p-2 rounded-lg bg-surface border border-border min-w-0">
                        <div className="flex items-center gap-2 min-w-0">
                          <div className="p-1.5 rounded-lg bg-accent/10 text-accent shrink-0">
                            <FileText className="w-3.5 h-3.5" />
                          </div>
                          <div className="truncate">
                            <p className="text-[11px] font-bold text-primary truncate">
                              {block.fileName}
                            </p>
                            <p className="text-[9px] text-muted font-mono">
                              {block.fileType} · {formatBytes(block.fileSize)}
                            </p>
                          </div>
                        </div>
                        <button
                          type="button"
                          onClick={() =>
                            updateBlock(block.id, {
                              fileUrl: null,
                              fileName: '',
                              fileSize: 0,
                            })
                          }
                          className="text-muted hover:text-danger p-1 shrink-0"
                        >
                          <X className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    )}
                  </div>
                )}

                {/* BLOCO DE TABELA */}
                {block.type === 'table' && (
                  <div className="p-2.5 rounded-xl bg-elevated border border-border space-y-2 overflow-x-auto min-w-0">
                    <div className="flex flex-wrap items-center justify-between gap-1.5 text-[10px]">
                      <span className="font-bold text-accent flex items-center gap-1">
                        <Table className="w-3 h-3" /> Tabela
                      </span>
                      <div className="flex flex-wrap items-center gap-1">
                        <button
                          type="button"
                          onClick={() => {
                            const curr = block.tableData || [['']];
                            const cols = curr[0]?.length || 1;
                            updateBlock(block.id, {
                              tableData: [...curr, Array(cols).fill('')],
                            });
                          }}
                          className="px-1.5 py-0.5 rounded bg-surface border border-border text-secondary hover:text-primary"
                        >
                          +Linha
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            const curr = block.tableData || [['']];
                            if (curr.length <= 1) return;
                            updateBlock(block.id, { tableData: curr.slice(0, -1) });
                          }}
                          className="px-1.5 py-0.5 rounded bg-surface border border-border text-secondary hover:text-danger"
                        >
                          -Linha
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            const curr = block.tableData || [['']];
                            updateBlock(block.id, {
                              tableData: curr.map((row, rIdx) => [
                                ...row,
                                rIdx === 0 ? `Col ${row.length + 1}` : '',
                              ]),
                            });
                          }}
                          className="px-1.5 py-0.5 rounded bg-surface border border-border text-secondary hover:text-primary"
                        >
                          +Col
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            const curr = block.tableData || [['']];
                            if ((curr[0]?.length || 1) <= 1) return;
                            updateBlock(block.id, {
                              tableData: curr.map((row) => row.slice(0, -1)),
                            });
                          }}
                          className="px-1.5 py-0.5 rounded bg-surface border border-border text-secondary hover:text-danger"
                        >
                          -Col
                        </button>
                      </div>
                    </div>

                    <table className="w-full border-collapse text-xs">
                      <thead>
                        <tr>
                          <th className="w-6 bg-surface border border-border text-[9px] text-muted py-1 text-center font-mono">
                            #
                          </th>
                          {(block.tableData?.[0] || []).map((_, cIdx) => (
                            <th
                              key={cIdx}
                              className="bg-surface border border-border text-[9px] text-muted py-1 px-1.5 text-center font-mono"
                            >
                              {String.fromCharCode(65 + cIdx)}
                            </th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {(block.tableData || []).map((row, rIdx) => (
                          <tr key={rIdx}>
                            <td className="bg-surface border border-border text-[9px] text-muted text-center font-mono">
                              {rIdx + 1}
                            </td>
                            {row.map((cell, cIdx) => (
                              <td key={cIdx} className="border border-border bg-background p-0">
                                <input
                                  type="text"
                                  value={cell}
                                  onChange={(e) => {
                                    const copy = (block.tableData || []).map((r) => [...r]);
                                    copy[rIdx][cIdx] = e.target.value;
                                    updateBlock(block.id, { tableData: copy });
                                  }}
                                  className={`w-full min-w-[60px] px-1.5 py-1 bg-transparent text-[11px] focus:outline-none focus:bg-accent/10 ${
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

                {/* BLOCO DO SPOTIFY COM PLAYER CUSTOMIZADO E PESQUISA DIRETA */}
                {block.type === 'spotify' && (
                  <div className="p-2.5 rounded-xl bg-elevated border border-border space-y-2 overflow-hidden min-w-0">
                    {!block.spotifyTrackId ? (
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <div className="flex items-center gap-2 flex-1 min-w-[180px]">
                          <Music className="w-4 h-4 text-[#1DB954] shrink-0" />
                          <input
                            type="text"
                            placeholder="Digite o nome da música ou cole o link e pressione Enter..."
                            onKeyDown={(e) => {
                              if (e.key === 'Enter') {
                                e.preventDefault();
                                const value = e.currentTarget.value.trim();
                                const id = /spotify/i.test(value) ? extractSpotifyTrackId(value) : null;
                                if (id) {
                                  updateBlock(block.id, { spotifyTrackId: id });
                                } else if (value) {
                                  // nome da música: abre a pesquisa já com o texto
                                  setSpotifyInitialQuery(value);
                                  setSpotifySearchForBlockId(block.id);
                                }
                              }
                            }}
                            className="flex-1 min-w-0 bg-transparent text-xs text-primary placeholder:text-muted focus:outline-none"
                          />
                        </div>
                        <button
                          type="button"
                          onClick={() => setSpotifySearchForBlockId(block.id)}
                          className="px-3 py-1.5 rounded-lg bg-surface border border-border hover:border-[#1DB954] text-xs font-semibold text-primary flex items-center gap-1.5 transition-colors"
                        >
                          <Search className="w-3.5 h-3.5 text-[#1DB954]" />
                          <span>Pesquisar Música</span>
                        </button>
                      </div>
                    ) : (
                      <div className="flex items-center gap-2">
                        <div className="flex-1 min-w-0">
                          <CustomSpotifyPlayer
                            trackId={block.spotifyTrackId}
                            onEdit={() => setSpotifySearchForBlockId(block.id)}
                          />
                        </div>
                        <button
                          type="button"
                          onClick={() => updateBlock(block.id, { spotifyTrackId: null })}
                          className="p-1.5 rounded-lg bg-surface border border-border text-muted hover:text-danger shrink-0"
                        >
                          <X className="w-4 h-4" />
                        </button>
                      </div>
                    )}
                  </div>
                )}

                {/* MENU DE SELEÇÃO DE BLOCO */}
                {menuOpenForBlockId === block.id && (
                  <div className="absolute left-0 top-9 z-30 w-72 sm:w-[440px] p-2 rounded-2xl bg-surface border border-border shadow-2xl grid grid-cols-2 sm:grid-cols-3 gap-1">
                    {BLOCK_MENU_ITEMS.map((item) => {
                      const Icon = item.icon;
                      return (
                        <button
                          key={item.type}
                          type="button"
                          onClick={() => {
                            const isCurrentEmpty =
                              !(block.html || '').replace(/<[^>]*>/g, '').trim() &&
                              !block.imageUrl &&
                              !block.videoUrl &&
                              !block.spotifyTrackId &&
                              !block.fileUrl;

                            if (isCurrentEmpty) {
                              updateBlock(block.id, {
                                type: item.type,
                                isGif: item.type === 'gif',
                                fontStyle: item.type === 'code' ? 'mono' : block.fontStyle,
                              });
                              setMenuOpenForBlockId(null);
                            } else {
                              insertBlockAfter(block.id, item.type);
                            }
                          }}
                          className="flex items-center gap-2 px-2 py-1.5 rounded-xl hover:bg-elevated text-left transition-colors"
                        >
                          <div className="p-1.5 rounded-lg bg-elevated border border-border text-accent shrink-0">
                            <Icon className="w-3.5 h-3.5" />
                          </div>
                          <div className="min-w-0">
                            <p className="text-[11px] font-bold text-primary truncate">
                              {item.label}
                            </p>
                            <p className="text-[9px] text-muted truncate">{item.desc}</p>
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

      {/* ATALHOS RÁPIDOS DE INSERÇÃO */}
      <div className="flex flex-wrap items-center gap-2 pt-1">
        <button
          type="button"
          title="Adicionar texto"
          aria-label="Adicionar texto"
          onClick={() => insertBlockAfter(blocks[blocks.length - 1].id, 'paragraph')}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-elevated border border-border text-xs font-semibold text-secondary hover:text-primary hover:border-accent transition-colors"
        >
          <Plus className="w-3.5 h-3.5 text-accent" />
        </button>

        <button
          type="button"
          title="Adicionar imagem"
          aria-label="Adicionar imagem"
          onClick={() => insertBlockAfter(blocks[blocks.length - 1].id, 'image')}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-elevated border border-border text-xs font-semibold text-secondary hover:text-primary hover:border-accent transition-colors"
        >
          <ImageIcon className="w-3.5 h-3.5 text-accent" />
        </button>

        <button
          type="button"
          title="Adicionar vídeo"
          aria-label="Adicionar vídeo"
          onClick={() => insertBlockAfter(blocks[blocks.length - 1].id, 'video')}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-elevated border border-border text-xs font-semibold text-secondary hover:text-primary hover:border-accent transition-colors"
        >
          <Film className="w-3.5 h-3.5 text-accent" />
        </button>

        <button
          type="button"
          title="Adicionar GIF"
          aria-label="Adicionar GIF"
          onClick={() => insertBlockAfter(blocks[blocks.length - 1].id, 'gif')}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-elevated border border-border text-xs font-semibold text-secondary hover:text-primary hover:border-accent transition-colors"
        >
          <Clapperboard className="w-3.5 h-3.5 text-accent" />
        </button>

        <button
          type="button"
          title="Adicionar mapa mental 2D"
          aria-label="Adicionar mapa mental 2D"
          onClick={() => insertBlockAfter(blocks[blocks.length - 1].id, 'mindmap')}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-elevated border border-border text-xs font-semibold text-secondary hover:text-primary hover:border-accent transition-colors"
        >
          <Network className="w-3.5 h-3.5 text-accent" />
        </button>

        <button
          type="button"
          title="Adicionar roadmap"
          aria-label="Adicionar roadmap"
          onClick={() => insertBlockAfter(blocks[blocks.length - 1].id, 'roadmap')}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-elevated border border-border text-xs font-semibold text-secondary hover:text-primary hover:border-accent transition-colors"
        >
          <Compass className="w-3.5 h-3.5 text-accent" />
        </button>

        <button
          type="button"
          title="Adicionar gráfico"
          aria-label="Adicionar gráfico"
          onClick={() => insertBlockAfter(blocks[blocks.length - 1].id, 'chart')}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-elevated border border-border text-xs font-semibold text-secondary hover:text-primary hover:border-accent transition-colors"
        >
          <BarChart3 className="w-3.5 h-3.5 text-accent" />
        </button>

        <button
          type="button"
          title="Adicionar enquete"
          aria-label="Adicionar enquete"
          onClick={() => insertBlockAfter(blocks[blocks.length - 1].id, 'poll')}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-elevated border border-border text-xs font-semibold text-secondary hover:text-primary hover:border-accent transition-colors"
        >
          <CheckSquare className="w-3.5 h-3.5 text-accent" />
        </button>

        <button
          type="button"
          title="Adicionar tabela"
          aria-label="Adicionar tabela"
          onClick={() => insertBlockAfter(blocks[blocks.length - 1].id, 'table')}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-elevated border border-border text-xs font-semibold text-secondary hover:text-primary hover:border-accent transition-colors"
        >
          <Table className="w-3.5 h-3.5 text-accent" />
        </button>
      </div>

      {!isEmbedded && (<>
      {/* SELETOR DE TÓPICOS */}
      <div className="p-3 rounded-xl bg-elevated/60 border border-border space-y-2">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <span className="text-[11px] font-semibold text-primary flex items-center gap-1.5">
            <FolderPlus className="w-3.5 h-3.5 text-accent" />
            <span>Publicar também nos Tópicos:</span>
          </span>
          <span className="text-[10px] font-mono text-muted">
            {selectedTopicTags.length === 0
              ? 'Apenas no feed Principal'
              : `Principal + ${selectedTopicTags.length}`}
          </span>
        </div>

        <div className="flex flex-wrap items-center gap-1.5">
          {availableTopics.map((topic) => {
            const isSelected = selectedTopicTags.includes(topic.tag);
            return (
              <button
                key={topic.id}
                type="button"
                onClick={() => toggleSelectedTopicTag(topic.tag)}
                style={
                  isSelected
                    ? {
                        backgroundColor: `${topic.color}20`,
                        borderColor: topic.color,
                      }
                    : undefined
                }
                className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-medium border transition-all ${
                  isSelected
                    ? 'text-primary shadow-sm'
                    : 'bg-surface border-border text-secondary hover:text-primary'
                }`}
              >
                {renderTopicVectorIcon(topic.icon, 'w-3 h-3 shrink-0', topic.color)}
                <span>{topic.label}</span>
                {isSelected && (
                  <Check
                    className="w-3 h-3 shrink-0"
                    style={{ color: topic.color }}
                  />
                )}
              </button>
            );
          })}
        </div>
      </div>

      {/* RASCUNHO AUTOMÁTICO */}
      {draftRestoredAt && (
        <div className="flex flex-wrap items-center justify-between gap-2 px-3 py-2 rounded-xl border border-accent/40 bg-accent/10 text-xs">
          <span className="text-primary">
            Rascunho restaurado ·{' '}
            {new Date(draftRestoredAt).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })}
          </span>
          <button type="button" onClick={discardDraft} className="font-semibold text-secondary hover:text-danger">
            Descartar rascunho
          </button>
        </div>
      )}
      {draftStatusLabel(draft.status, draft.savedAt) && (
        <p className="text-[10px] text-muted font-mono" aria-live="polite">
          {draftStatusLabel(draft.status, draft.savedAt)}
        </p>
      )}

      </>)}

      {/* COTA DE ANEXOS DO POST (peso comprimido no R2) */}
      {usedBytes > 0 && (
        <div className="space-y-1" aria-live="polite">
          <div className="flex items-center justify-between gap-2 text-[11px] font-mono">
            <span className={overQuota ? 'text-red-500 font-bold' : 'text-secondary'}>
              {formatBytes(usedBytes)} / {formatBytes(uploadLimit)} usados neste post
            </span>
            <span className="text-muted">Nível {viewerTier.level} · {viewerTier.name}</span>
          </div>
          <div
            className="h-1.5 rounded-full bg-elevated border border-border overflow-hidden"
            role="progressbar"
            aria-valuemin={0}
            aria-valuemax={100}
            aria-valuenow={Math.round(quotaPct)}
            aria-label="Cota de anexos do post"
          >
            <div
              className={`h-full rounded-full transition-[width] duration-300 ${
                overQuota ? 'bg-red-500' : quotaPct > 85 ? 'bg-amber-500' : 'bg-accent'
              }`}
              style={{ width: `${quotaPct}%` }}
            />
          </div>
        </div>
      )}

      {!isEmbedded && (<>
      {/* RODAPÉ DO COMPOSITOR */}
      <div className="flex flex-wrap items-center justify-between gap-3 pt-3 border-t border-border">
        <div className="flex items-center gap-2 flex-1 min-w-[180px]">
          <Hash className="w-4 h-4 text-muted shrink-0" />
          <input
            type="text"
            value={tagsInput}
            onChange={(e) => setTagsInput(e.target.value)}
            placeholder="Tags adicionais (ex: dev, arquitetura, notas)"
            className="w-full bg-transparent text-xs text-secondary placeholder:text-muted focus:outline-none"
          />
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <div className="flex items-center bg-elevated p-0.5 rounded-lg border border-border">
            <button
              type="button"
              onClick={() => setVisibility('public')}
              title="Visível para todo o público"
              className={`flex items-center gap-1 px-2.5 py-1.5 rounded-md text-[11px] font-semibold transition-colors ${
                visibility === 'public'
                  ? 'bg-accent text-white shadow-sm'
                  : 'text-secondary hover:text-primary'
              }`}
            >
              <Globe className="w-3.5 h-3.5" />
              <span>Público</span>
            </button>

            <button
              type="button"
              onClick={() => setVisibility('private')}
              title="Privado: visível apenas para o autor"
              className={`flex items-center gap-1 px-2.5 py-1.5 rounded-md text-[11px] font-semibold transition-colors ${
                visibility === 'private'
                  ? 'bg-zinc-200 text-zinc-950 shadow-sm'
                  : 'text-secondary hover:text-primary'
              }`}
            >
              <Lock className="w-3.5 h-3.5" />
              <span>Só para mim</span>
            </button>
          </div>

          <button
            type="button"
            onClick={() => setIsPinned(!isPinned)}
            title="Fixar no topo"
            className={`p-2 rounded-lg border transition-colors ${
              isPinned
                ? 'border-accent text-accent bg-accent/10'
                : 'border-border text-secondary hover:text-primary bg-elevated'
            }`}
          >
            <Pin className="w-4 h-4" />
          </button>

          {isEditMode && onCancelEdit && (
            <button
              type="button"
              onClick={onCancelEdit}
              className="px-4 py-2 rounded-lg bg-elevated border border-border text-xs font-semibold text-secondary hover:text-primary transition-colors"
            >
              Cancelar
            </button>
          )}

          <button
            type="submit"
            disabled={isSubmitting}
            className="flex items-center gap-2 px-5 py-2 rounded-lg bg-accent text-white text-xs font-bold hover:bg-accent-hover disabled:opacity-50 transition-colors"
          >
            <Send className="w-3.5 h-3.5" />
            <span>
              {isSubmitting
                ? isEditMode
                  ? 'A guardar...'
                  : 'A publicar...'
                : isEditMode
                ? 'Guardar Alterações'
                : visibility === 'private'
                ? 'Guardar Privado'
                : 'Publicar Insight'}
            </span>
          </button>
        </div>
      </div>
      </>)}

      {/* MODAL DE PESQUISA DE MÚSICAS PARA O BLOCO SPOTIFY DO POST */}
      <SpotifySearchModal
        isOpen={Boolean(spotifySearchForBlockId)}
        initialQuery={spotifyInitialQuery}
        onClose={() => {
          setSpotifySearchForBlockId(null);
          setSpotifyInitialQuery('');
        }}
        onSelectTrack={(trackQuery) => {
          if (spotifySearchForBlockId) {
            updateBlock(spotifySearchForBlockId, { spotifyTrackId: trackQuery });
          }
          setSpotifySearchForBlockId(null);
        }}
      />
    </form>
  );
}