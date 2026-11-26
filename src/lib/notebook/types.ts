import type { PostBlock, TopicWorkspaceData } from '@/types/database';

/** Tipo de editor/modelo de cada item do My Notebook. */
export type NotebookTemplate =
  // escrita livre
  | 'markdown'
  | 'blocks'
  | 'canvas'
  // modo escritor
  | 'book'
  | 'chapter'
  | 'character'
  | 'world'
  | 'codex'
  // modelos de texto
  | 'journal'
  | 'screenplay'
  | 'study'
  | 'meeting'
  | 'idea'
  | 'poem'
  | 'map'
  | 'calendar'
  | 'timeline'
  | 'article'
  // modelos dos tópicos (workspace interativo)
  | 'goals'
  | 'habits'
  | 'tasks'
  | 'roadmap'
  | 'mindmap'
  | 'diet'
  | 'agenda'
  // pasta comum
  | 'folder';

export type ChapterStatus = 'ideia' | 'rascunho' | 'revisao' | 'pronto' | 'publicado';

export interface BookData {
  synopsis?: string;
  genre?: string;
  audience?: string;
  coverUrl?: string | null;
  coverR2Key?: string | null;
  wordGoal?: number;
  dailyGoal?: number;
  /** palavras escritas por dia: { '2026-11-23': 812 } */
  history?: Record<string, number>;
  bookStatus?: 'planejando' | 'escrevendo' | 'revisando' | 'concluido';
}

export interface ChapterData {
  status?: ChapterStatus;
  authorNote?: string;
  /** HTML do capítulo (modo escritor) */
  html?: string;
  wordGoal?: number;
  /** sinopse da cena/capítulo (quadro de cenas) */
  synopsis?: string;
  /** menção (personagem) do ponto de vista */
  pov?: string | null;
}

export interface WriterPrefs {
  paper: 'claro' | 'sepia' | 'noite';
  font: 'literata' | 'serif' | 'sans' | 'mono';
  size: number;
  width: 'estreita' | 'normal' | 'larga';
  typewriter: boolean;
  focus: boolean;
}

export type NotebookItemData = BookData & ChapterData & TopicWorkspaceData & Record<string, unknown>;

export interface NotebookItem {
  id: string;
  profile_id: string;
  parent_id: string | null;
  kind: 'folder' | 'note';
  template: NotebookTemplate;
  title: string;
  icon: string | null;
  color: string | null;
  content: string;
  blocks: PostBlock[] | null;
  data: NotebookItemData;
  tags: string[];
  links: string[];
  /** entradas do Sumário citadas no texto */
  entry_refs?: string[];
  /** fontes (bibliografia) citadas no texto */
  source_refs?: string[];
  word_count: number;
  position: number;
  pinned: boolean;
  is_template: boolean;
  published_post_id: string | null;
  archived_at: string | null;
  created_at: string;
  updated_at: string;
  /** true quando content/blocks/data já foram carregados do banco */
  _full?: boolean;
}

/** Colunas leves (árvore, busca de títulos, grafo). */
export const NOTEBOOK_META_COLUMNS =
  'id, profile_id, parent_id, kind, template, title, icon, color, tags, links, entry_refs, source_refs, word_count, position, pinned, is_template, published_post_id, archived_at, created_at, updated_at';

export const NOTEBOOK_FULL_COLUMNS = `${NOTEBOOK_META_COLUMNS}, content, blocks, data`;
