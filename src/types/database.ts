import type { NitroCosmetics } from '@/lib/nitro/catalog';

export interface CustomSocialLink {
  id: string;
  url: string;
  label?: string;
}


export interface SocialLinks {
  instagram?: string;
  spotify?: string;
  steam?: string;
  tiktok?: string;
  github?: string;
  status_id?: string;
  status_detail?: string;
  custom_links?: CustomSocialLink[];
}

export interface Profile {
  id: string;
  user_id?: string | null;
  username: string;
  full_name: string;
  display_name?: string | null;
  nickname?: string | null;
  nickname_color?: string | null;
  location?: string | null;
  /** dia/mês público 'MM-DD' (a data completa fica em profile_birthdays) */
  birthday_md?: string | null;
  bio: string | null;
  avatar_url: string | null;
  banner_url: string | null;
  cover_url?: string | null;
  spotify_track_id?: string | null;
  tags?: string[] | null;
  followers_count?: number | null;
  posts_count?: number | null;
  social_links: SocialLinks;
  role?: 'admin' | 'moderator' | 'user';
  status?: 'active' | 'suspended' | 'banned';
  onboarding_completed?: boolean;
  created_at: string;
  total_donated?: number | null;
  contributor_points?: number | null;
  contributor_level?: number | null;
  /** Insight Nitro — assinatura (R$ 3,99/mês) ou vitalício no Nível 5. */
  nitro_status?: 'none' | 'active' | 'past_due' | 'canceled' | 'expired' | null;
  nitro_expires_at?: string | null;
  has_lifetime_nitro?: boolean | null;
  /** E-mail confirmado pelo link enviado pelo app. */
  email_verified_at?: string | null;
  /** Insight Nitro: itens equipados (snapshot gravado via RPC set_my_cosmetics). */
  cosmetics?: NitroCosmetics | null;
  /** Status online automático */
  last_seen_at?: string | null;
  presence_visible?: boolean;
}

export type PostBlockType =
  | 'paragraph'
  | 'h1'
  | 'h2'
  | 'quote'
  | 'callout'
  | 'code'
  | 'bullet'
  | 'divider'
  | 'image'
  | 'video'
  | 'gif'
  | 'spotify'
  | 'chart'
  | 'poll'
  | 'file'
  | 'table'
  | 'mindmap'
  | 'roadmap';

export type FontStyleType = 'sans' | 'serif' | 'mono';
/** Largura da imagem no card, em % (atalhos 25/50/75/100 ou valor livre). */
export type ImageWidthType = `${number}%`;
export type ImageAlignType = 'left' | 'center' | 'right';
export type PostVisibility = 'public' | 'private';
export type PostVisibilityType = PostVisibility;

// ============================================================================
// TIPOS DOS MODELOS DE TÓPICOS ESTILO NOTION & WORKSPACES DE PÁGINA INTEIRA
// ============================================================================

export type TopicTemplateType =
  | 'blank_page'
  | 'blank_db'
  | 'goals'
  | 'habits'
  | 'tasks'
  | 'diet'
  | 'agenda'
  | 'roadmap'
  | 'mindmap'
  | 'writing';

export interface MindMapChecklistItem {
  id: string;
  text: string;
  done: boolean;
}

export interface GoalItem {
  id: string;
  title: string;
  targetValue: string;
  priority: 'high' | 'medium' | 'low';
  progress: number;
}

export interface HabitItem {
  id: string;
  name: string;
  checks: boolean[];
}

export interface TaskItem {
  id: string;
  title: string;
  status: 'not_started' | 'in_progress' | 'done';
  assignee: string;
  dueDate?: string;
  priority?: 'high' | 'medium' | 'low';
}

export interface DietMealItem {
  id: string;
  time: string;
  foods: string;
  calories: number;
  proteinGrams: number;
  completed: boolean;
  /** Horário na agenda (HH:MM) */
  at?: string;
  /** Dias da semana (0 = domingo); vazio = todos os dias */
  days?: number[];
}

/** Registro de um dia do plano nutricional (chave AAAA-MM-DD). */
export interface DietDayLog {
  done: string[];
  water: number;
  weight?: number;
  note?: string;
}

export interface AgendaEventItem {
  id: string;
  date: string;
  time: string;
  title: string;
  location?: string;
  category: string;
  color: string;
}

export interface RoadmapStepItem {
  id: string;
  phase: string;
  title: string;
  description: string;
  status: 'planned' | 'in_progress' | 'completed';
  dateLabel?: string;
  mediaUrl?: string | null;
  mediaBytes?: number;
  checklist?: MindMapChecklistItem[];
}

export type interfaceRoadmapStepItem = RoadmapStepItem;

export type MindMapNodeType =
  | 'concept'
  | 'code'
  | 'checklist'
  | 'note'
  | 'media'
  | 'zone';

export interface MindMapNodeItem {
  id: string;
  nodeType?: MindMapNodeType;
  label: string;
  note?: string;
  x: number;
  y: number;
  width?: number;
  height?: number;
  color: string;
  icon?: string;
  codeSnippet?: string;
  codeLang?: string;
  checklist?: MindMapChecklistItem[];
  mediaUrl?: string | null;
  r2Key?: string | null;
  mediaBytes?: number;
}

export interface MindMapEdgeItem {
  id: string;
  fromId: string;
  toId: string;
  label?: string;
}

/** Escrito do modelo "Poemas & Livros" (texto puro; pode vir do My Notebook). */
export interface WritingPiece {
  id: string;
  kind: 'poem' | 'chapter' | 'text';
  title: string;
  body: string;
  notebookId?: string;
  updatedAt: string;
}

export interface TopicWorkspaceData {
  writings?: WritingPiece[];
  goals?: GoalItem[];
  habits?: HabitItem[];
  habitColumns?: string[];
  tasks?: TaskItem[];
  dietMeals?: DietMealItem[];
  dietLog?: Record<string, DietDayLog>;
  waterGlasses?: number;
  waterGoal?: number;
  calorieGoal?: number;
  proteinGoal?: number;
  agendaEvents?: AgendaEventItem[];
  roadmapSteps?: RoadmapStepItem[];
  mindMapNodes?: MindMapNodeItem[];
  mindMapEdges?: MindMapEdgeItem[];
  customTable?: string[][];
  workspaceNotes?: string;
}

// ============================================================================
// TIPOS DOS BLOCOS DE POSTAGEM (GRADE 12 COLUNAS)
// ============================================================================

export interface ChartDataItem {
  label: string;
  value: number;
  color: string;
}

export interface PollOptionItem {
  id: string;
  text: string;
  votes: number;
}

export interface PostBlock {
  id: string;
  type: PostBlockType;
  html?: string;
  fontStyle?: FontStyleType;
  align?: 'left' | 'center' | 'right';
  calloutIcon?: string;
  postVisibility?: PostVisibility;

  gridSpan?: number;
  gridStart?: number;
  /** Quadros do vídeo (URLs de imagem) usados pela moderação automática. */
  videoFrames?: string[];
  /** Altura mínima da célula em px (alça inferior do editor); vazio = automática. */
  blockHeight?: number;

  imageUrl?: string | null;
  imageCaption?: string;
  imageWidth?: ImageWidthType;
  imageAlign?: ImageAlignType;

  videoUrl?: string | null;
  r2Key?: string | null;
  videoCaption?: string;
  videoWidth?: ImageWidthType;
  videoAlign?: ImageAlignType;
  isGif?: boolean;

  spotifyTrackId?: string | null;

  chartType?: 'vertical' | 'donut';
  chartTitle?: string;
  chartData?: ChartDataItem[];

  pollQuestion?: string;
  pollMultiple?: boolean;
  pollOptions?: PollOptionItem[];

  fileUrl?: string | null;
  fileName?: string;
  fileSize?: number;
  fileType?: string;

  /** Peso final no R2 (pós-compressão) da mídia deste bloco — entra na cota do post. */
  mediaBytes?: number;

  tableData?: string[][];

  mindMapNodes?: MindMapNodeItem[];
  mindMapEdges?: MindMapEdgeItem[];
  roadmapSteps?: RoadmapStepItem[];
  /** Marcado pelo autor: aparece desfocado até o leitor tocar. */
  spoiler?: boolean;
}

export interface Post {
  id: string;
  author_id: string;
  profile_id?: string;
  parent_id: string | null;
  content: string;
  image_url: string | null;
  spotify_track_id?: string | null;
  blocks?: PostBlock[] | null;
  tags: string[];
  target_topics?: string[] | null;
  visibility?: PostVisibility;
  is_draft?: boolean;
  is_pinned: boolean;
  likes_count: number;
  reposts_count?: number;
  views_count: number;
  created_at: string;
  updated_at?: string;
  profiles?: Profile;
  replies_count?: number;
  /** Repost com comentário: Insight citado. */
  quoted_post_id?: string | null;
  /** Moderação (o autor vê os próprios itens retidos; os outros só veem 'approved'). */
  moderation_status?: 'pending' | 'approved' | 'review' | 'blocked' | 'appealed';
  is_nsfw?: boolean;
  moderation_reason?: string | null;
}

export interface Reply {
  id: string;
  post_id: string;
  profile_id: string | null;
  author_name: string | null;
  author_handle: string | null;
  avatar_url: string | null;
  content: string;
  image_url: string | null;
  spotify_track_id: string | null;
  created_at: string;
  /** Resposta a que esta resposta responde (null = resposta direta ao post). */
  parent_reply_id?: string | null;
  likes_count?: number | null;
  /** Corpo em blocos (texto, citação, código, lista, imagem, Spotify). */
  blocks?: ReplyBlock[] | null;
  moderation_status?: 'pending' | 'approved' | 'review' | 'blocked' | 'appealed';
  is_nsfw?: boolean;
  moderation_reason?: string | null;
}

export type ReplyBlockType = 'paragraph' | 'quote' | 'code' | 'bullet' | 'image' | 'spotify' | 'gif' | 'video';

export interface ReplyBlock {
  id: string;
  type: ReplyBlockType;
  text?: string;
  url?: string;
  trackId?: string;
  bytes?: number;
  /** GIF: miniatura leve para o compositor */
  previewUrl?: string;
}

export interface NotificationItem {
  id: string;
  user_id: string;
  type: 'like' | 'reply' | 'subscribe' | 'system';
  message: string;
  post_id: string | null;
  is_read: boolean;
  created_at: string;
}

export interface CustomTopic {
  id: string;
  profile_id?: string | null;
  name: string;
  tag: string;
  color: string;
  icon?: string | null;
  visibility?: PostVisibility;
  template_type?: TopicTemplateType;
  banner_url: string | null;
  banner_r2_key?: string | null;
  description_blocks?: PostBlock[] | null;
  workspace_data?: TopicWorkspaceData | null;
  created_at: string;
  moderation_status?: 'pending' | 'approved' | 'review' | 'blocked' | 'appealed';
  is_nsfw?: boolean;
  moderation_reason?: string | null;
}