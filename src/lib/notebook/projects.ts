/**
 * Projetos do Notebook: as pastas do primeiro nível viram Projetos (com tipo,
 * descrição e sugestões de modelos); pastas dentro de um projeto são Seções.
 * Os dados ficam em item.data.project; o ícone do projeto vai em item.icon.
 */
import type { GlyphName } from './glyphs';
import type { NotebookItem, NotebookTemplate } from './types';

export type ProjectType = 'livro' | 'poesia' | 'mundo' | 'artigos' | 'estudos' | 'livre';

export interface ProjectData {
  type: ProjectType;
  description?: string;
}

export interface ProjectSuggestion {
  template: NotebookTemplate;
  label: string;
  hint: string;
  title?: string;
}

export interface ProjectTypeDef {
  id: ProjectType;
  label: string;
  glyph: GlyphName;
  color: string;
  pitch: string;
  suggestions: ProjectSuggestion[];
  /** estrutura criada junto com o projeto (opcional) */
  starter: { template: NotebookTemplate; title: string }[];
}

export const PROJECT_TYPES: ProjectTypeDef[] = [
  {
    id: 'livro',
    label: 'Livro',
    glyph: 'book',
    color: '#d97706',
    pitch: 'Romance, conto ou novela: capítulos, personagens e o mundo da história.',
    suggestions: [
      { template: 'book', label: 'Livro', hint: 'capítulos, metas e estante' },
      { template: 'character', label: 'Ficha de personagem', hint: 'perfis, trajetória e entrevista' },
      { template: 'world', label: 'Worldbuilding', hint: 'lugares, regras e glossário' },
      { template: 'mindmap', label: 'Mapa da trama', hint: 'conexões entre cenas', title: 'Mapa da trama' },
      { template: 'roadmap', label: 'Linha do tempo', hint: 'eventos em ordem', title: 'Linha do tempo' },
      { template: 'idea', label: 'Banco de ideias', hint: 'cenas e diálogos soltos', title: 'Banco de ideias' },
    ],
    starter: [
      { template: 'book', title: '' },
      { template: 'folder', title: 'Personagens' },
      { template: 'folder', title: 'Mundo' },
    ],
  },
  {
    id: 'poesia',
    label: 'Poesia',
    glyph: 'feather',
    color: '#db2777',
    pitch: 'Poemas, rascunhos e coletâneas, com espaço para forma e imagens.',
    suggestions: [
      { template: 'poem', label: 'Poema', hint: 'versos e estrofes' },
      { template: 'idea', label: 'Imagens e temas', hint: 'o que te move a escrever', title: 'Imagens e temas' },
      { template: 'markdown', label: 'Caderno de rascunhos', hint: 'versos soltos', title: 'Rascunhos' },
      { template: 'book', label: 'Coletânea', hint: 'reúna poemas em um livro', title: 'Coletânea' },
    ],
    starter: [
      { template: 'poem', title: 'Primeiro poema' },
      { template: 'idea', title: 'Imagens e temas' },
    ],
  },
  {
    id: 'mundo',
    label: 'Mundo',
    glyph: 'world',
    color: '#0d9488',
    pitch: 'Um universo inteiro: lugares, povos, história e regras.',
    suggestions: [
      { template: 'world', label: 'Lugar ou região', hint: 'geografia e cultura' },
      { template: 'character', label: 'Ficha de personagem', hint: 'quem vive nesse mundo' },
      { template: 'mindmap', label: 'Mapa de relações', hint: 'facções e alianças', title: 'Mapa de relações' },
      { template: 'roadmap', label: 'Linha do tempo', hint: 'eras e eventos', title: 'Linha do tempo' },
      { template: 'markdown', label: 'Glossário', hint: 'termos do mundo', title: 'Glossário' },
    ],
    starter: [
      { template: 'world', title: 'Visão geral' },
      { template: 'folder', title: 'Lugares' },
      { template: 'folder', title: 'Povos' },
    ],
  },
  {
    id: 'artigos',
    label: 'Artigos',
    glyph: 'pen',
    color: '#2563eb',
    pitch: 'Textos de não ficção: pautas, pesquisa e artigos prontos para publicar.',
    suggestions: [
      { template: 'article', label: 'Artigo', hint: 'resumo, desenvolvimento, conclusão' },
      { template: 'study', label: 'Pesquisa', hint: 'fontes e anotações' },
      { template: 'idea', label: 'Pautas', hint: 'ideias de artigos', title: 'Pautas' },
      { template: 'agenda', label: 'Calendário editorial', hint: 'prazos e publicações', title: 'Calendário editorial' },
    ],
    starter: [
      { template: 'article', title: 'Primeiro artigo' },
      { template: 'idea', title: 'Pautas' },
    ],
  },
  {
    id: 'estudos',
    label: 'Estudos',
    glyph: 'study',
    color: '#7c3aed',
    pitch: 'Matérias, cursos e pesquisas: anotações, metas e agenda.',
    suggestions: [
      { template: 'study', label: 'Anotação de estudo', hint: 'resumo e perguntas' },
      { template: 'mindmap', label: 'Mapa mental', hint: 'conceitos ligados' },
      { template: 'goals', label: 'Metas de estudo', hint: 'progresso por matéria' },
      { template: 'agenda', label: 'Cronograma', hint: 'aulas e provas' },
    ],
    starter: [{ template: 'study', title: 'Anotações' }],
  },
  {
    id: 'livre',
    label: 'Livre',
    glyph: 'compass',
    color: '#64748b',
    pitch: 'Um espaço sem regras: notas, diários, mapas e listas.',
    suggestions: [
      { template: 'markdown', label: 'Nota', hint: 'texto livre com [[ligações]]' },
      { template: 'journal', label: 'Diário', hint: 'registro do dia' },
      { template: 'mindmap', label: 'Mapa mental', hint: 'ideias conectadas' },
      { template: 'tasks', label: 'Tarefas', hint: 'o que falta fazer' },
    ],
    starter: [],
  },
];

export function projectType(id: string | null | undefined): ProjectTypeDef {
  return PROJECT_TYPES.find((t) => t.id === id) || PROJECT_TYPES[PROJECT_TYPES.length - 1];
}

/** É projeto: pasta no primeiro nível. Pastas dentro dele são seções. */
export function isProject(item: Pick<NotebookItem, 'kind' | 'parent_id' | 'template'>): boolean {
  return item.kind === 'folder' && item.template === 'folder' && !item.parent_id;
}

export function projectData(item: NotebookItem): ProjectData {
  const p = (item.data as Record<string, unknown> | null)?.project as ProjectData | undefined;
  return { type: p?.type && PROJECT_TYPES.some((t) => t.id === p.type) ? p.type : 'livre', description: p?.description || '' };
}
