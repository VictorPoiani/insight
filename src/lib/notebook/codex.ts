/**
 * Worldbuilding · Codex.
 * Um mundo (projeto) tem categorias do Codex, com subcategorias e um modelo
 * de Infobox. Cada verbete é uma menção do Sumário (prévia, "Ler mais",
 * aparições) ligada a uma nota `codex` com o texto e os valores da Infobox.
 *
 *   notebook_entries.codex_category_id → categoria
 *   notebook_entries.target_id         → nota do verbete
 *   nota.data.codex = { entry, infobox: { [campo]: CodexValue }, caption }
 *
 * Campos que apontam para outros verbetes guardam {"entryId": "<uuid>"}: o
 * índice de menções (entry_refs) já reconhece esse formato, então essas
 * ligações aparecem sozinhas nas aparições e no grafo.
 */
import type { EntryCategory } from './entries';
import type { GlyphName } from './glyphs';

export type CodexFieldType = 'text' | 'long' | 'number' | 'date' | 'entry' | 'entries' | 'select' | 'status';

export interface CodexField {
  key: string;
  label: string;
  type: CodexFieldType;
  options?: string[];
}

export interface CodexCategory {
  id: string;
  profile_id: string;
  project_id: string;
  parent_id: string | null;
  name: string;
  glyph: GlyphName;
  kind: EntryCategory;
  fields: CodexField[];
  position: number;
  created_at: string;
  updated_at: string;
}

export interface CodexValue {
  text?: string;
  refs?: { entryId: string }[];
  /** segredo do autor: não sai em publicações */
  secret?: boolean;
}

export interface CodexData {
  /** menção (verbete) desta nota */
  entry: string;
  infobox: Record<string, CodexValue>;
  /** legenda da imagem da Infobox */
  caption?: string;
}

export const FIELD_TYPES: { id: CodexFieldType; label: string; hint: string }[] = [
  { id: 'text', label: 'Texto curto', hint: 'uma linha' },
  { id: 'long', label: 'Texto longo', hint: 'algumas linhas' },
  { id: 'number', label: 'Número', hint: 'população, altura…' },
  { id: 'date', label: 'Data do mundo', hint: 'ex.: 312 D.Q.' },
  { id: 'entry', label: 'Verbete', hint: 'liga a um verbete ou menção' },
  { id: 'entries', label: 'Vários verbetes', hint: 'alianças, membros…' },
  { id: 'select', label: 'Lista de opções', hint: 'tipo, raridade…' },
  { id: 'status', label: 'Situação', hint: 'opções com estado' },
];

export const fieldType = (t: string) => FIELD_TYPES.find((f) => f.id === t) || FIELD_TYPES[0];

const f = (label: string, type: CodexFieldType, options?: string[]): CodexField => ({ key: slugKey(label), label, type, ...(options ? { options } : {}) });

export function slugKey(label: string) {
  return (
    label
      .toLowerCase()
      .normalize('NFD')
      .replace(/[̀-ͯ]/g, '')
      .replace(/[^a-z0-9]+/g, '_')
      .replace(/^_|_$/g, '')
      .slice(0, 40) || 'campo'
  );
}

export interface CategorySeed {
  name: string;
  glyph: GlyphName;
  kind: EntryCategory;
  fields: CodexField[];
  children?: string[];
}

/** Categorias criadas com o mundo (todas editáveis). */
export const DEFAULT_CATEGORIES: CategorySeed[] = [
  {
    name: 'Locais e Geografia',
    glyph: 'world',
    kind: 'lugar',
    children: ['Reinos', 'Cidades', 'Regiões'],
    fields: [
      f('Tipo', 'select', ['Reino', 'Cidade', 'Vila', 'Região', 'Montanha', 'Rio', 'Floresta', 'Ruína']),
      f('Região', 'entry'),
      f('Capital', 'entry'),
      f('Governante', 'entry'),
      f('População', 'text'),
      f('Clima', 'text'),
      f('Situação', 'status', ['Próspero', 'Em guerra', 'Em declínio', 'Abandonado', 'Destruído']),
    ],
  },
  {
    name: 'Facções e Governos',
    glyph: 'crown',
    kind: 'organizacao',
    fields: [
      f('Tipo', 'select', ['Reino', 'Império', 'República', 'Guilda', 'Ordem', 'Culto', 'Clã', 'Companhia']),
      f('Líder', 'entry'),
      f('Sede', 'entry'),
      f('Fundação', 'date'),
      f('Alianças', 'entries'),
      f('Inimigos', 'entries'),
      f('Situação', 'status', ['Ativa', 'Em ascensão', 'Em declínio', 'Clandestina', 'Extinta']),
    ],
  },
  {
    name: 'Magia e Tecnologia',
    glyph: 'sparkle',
    kind: 'conceito',
    fields: [f('Fonte', 'text'), f('Custo', 'long'), f('Limites', 'long'), f('Quem pode usar', 'text'), f('Origem', 'entry')],
  },
  {
    name: 'Espécies e Culturas',
    glyph: 'feather',
    kind: 'conceito',
    fields: [f('Origem', 'entry'), f('Território', 'entries'), f('Idioma', 'text'), f('Expectativa de vida', 'text'), f('Traços', 'long')],
  },
  {
    name: 'Religiões e Mitologia',
    glyph: 'moon',
    kind: 'conceito',
    fields: [f('Divindades', 'entries'), f('Templo principal', 'entry'), f('Seguidores', 'text'), f('Dogma', 'long'), f('Ritos', 'text')],
  },
  {
    name: 'Itens e Artefatos',
    glyph: 'gem',
    kind: 'objeto',
    fields: [
      f('Tipo', 'select', ['Arma', 'Relíquia', 'Livro', 'Joia', 'Ferramenta', 'Veículo']),
      f('Criador', 'entry'),
      f('Dono atual', 'entry'),
      f('Paradeiro', 'entry'),
      f('Poder', 'long'),
      f('Situação', 'status', ['Intacto', 'Perdido', 'Selado', 'Destruído']),
    ],
  },
  {
    name: 'Flora e Fauna',
    glyph: 'tree',
    kind: 'conceito',
    fields: [
      f('Tipo', 'select', ['Planta', 'Animal', 'Fungo', 'Criatura']),
      f('Habitat', 'entries'),
      f('Raridade', 'select', ['Comum', 'Incomum', 'Rara', 'Lendária']),
      f('Usos', 'long'),
      f('Perigo', 'status', ['Inofensivo', 'Cautela', 'Perigoso', 'Mortal']),
    ],
  },
  {
    name: 'Economia e Leis',
    glyph: 'briefcase',
    kind: 'conceito',
    fields: [
      f('Tipo', 'select', ['Moeda', 'Lei', 'Tributo', 'Rota comercial', 'Mercado', 'Tratado']),
      f('Autoridade', 'entry'),
      f('Abrangência', 'entries'),
      f('Penalidades', 'long'),
    ],
  },
];

export function codexData(data: unknown): CodexData | null {
  const c = (data as { codex?: CodexData } | null)?.codex;
  return c && typeof c.entry === 'string' ? { ...c, infobox: c.infobox || {} } : null;
}

/** Valor da Infobox em texto (para lista, exportação e publicação). */
export function valueText(v: CodexValue | undefined, titleOf: (id: string) => string | null): string {
  if (!v) return '';
  if (v.refs?.length)
    return v.refs
      .map((r) => titleOf(r.entryId))
      .filter(Boolean)
      .join(', ');
  return (v.text || '').trim();
}

export const isEmptyValue = (v: CodexValue | undefined) => !v || (!(v.text || '').trim() && !(v.refs || []).length);

/** Segredo do autor em markdown. */
export const SECRET_CALLOUT = 'segredo';
