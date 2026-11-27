/**
 * Menções + Sumário.
 * Uma menção é um conceito definido pelo escritor (personagem, lugar,
 * organização…). Trechos do texto apontam para ela; passar o mouse mostra a
 * prévia e "Ler mais" abre a ficha/nota. Notas do autor e avisos usam o mesmo
 * mecanismo. Relações entre menções alimentam o grafo e a genealogia.
 *   markdown:  [Filho de Maicon](ref:<uuid> "elemento")
 *   HTML:      <span data-ref="<uuid>" data-kind="elemento">Filho de Maicon</span>
 */
import type { GlyphName } from './glyphs';

export type EntryKind = 'elemento' | 'nota_autor' | 'aviso';

export interface NotebookEntry {
  id: string;
  profile_id: string;
  project_id: string | null;
  kind: EntryKind;
  title: string;
  summary: string;
  target_id: string | null;
  aliases: string[];
  category: EntryCategory | null;
  image_url: string | null;
  /** categoria do Codex (Worldbuilding) */
  codex_category_id?: string | null;
  /** segredo do autor: o verbete inteiro fica fora de publicações */
  is_secret?: boolean;
  /** aparece nos balões e no "Ler mais" de textos publicados */
  is_public?: boolean;
  created_at: string;
  updated_at: string;
}

export const ENTRY_KINDS: { id: EntryKind; label: string; short: string; glyph: GlyphName; color: string; hint: string }[] = [
  {
    id: 'elemento',
    label: 'Menção',
    short: 'Menção',
    glyph: 'sparkle',
    color: '#60a5fa',
    hint: 'Um conceito da sua obra (personagem, lugar, organização…), com prévia ao passar o mouse.',
  },
  {
    id: 'nota_autor',
    label: 'Nota do autor',
    short: 'Nota do autor',
    glyph: 'pen',
    color: '#a78bfa',
    hint: 'Comentário de bastidores ou explicação extra sobre o trecho.',
  },
  {
    id: 'aviso',
    label: 'Aviso / checagem',
    short: 'Aviso',
    glyph: 'alert',
    color: '#f59e0b',
    hint: 'Sinaliza que o trecho é interpretativo, ficcional ou pode conter erros.',
  },
];

export const entryKind = (k: string | null | undefined) => ENTRY_KINDS.find((x) => x.id === k) || ENTRY_KINDS[0];
export const isEntryKind = (k: unknown): k is EntryKind => k === 'elemento' || k === 'nota_autor' || k === 'aviso';

const UUID = '[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}';
const REF_RE = new RegExp(`(?:\\]\\(ref:|data-ref=\\\\?"|"entryId":")(${UUID})`, 'gi');

/** Ids de entradas citadas num texto (markdown, HTML ou JSON). */
export function extractEntryRefs(...texts: (string | null | undefined)[]): string[] {
  const out = new Set<string>();
  for (const t of texts) {
    if (!t) continue;
    REF_RE.lastIndex = 0;
    let m: RegExpExecArray | null;
    while ((m = REF_RE.exec(t))) out.add(m[1].toLowerCase());
  }
  return Array.from(out).slice(0, 500);
}

export type EntryCategory = 'personagem' | 'lugar' | 'organizacao' | 'objeto' | 'evento' | 'conceito';

export const ENTRY_CATEGORIES: { id: EntryCategory; label: string; glyph: GlyphName; color: string }[] = [
  { id: 'personagem', label: 'Personagem', glyph: 'character', color: '#a78bfa' },
  { id: 'lugar', label: 'Lugar', glyph: 'world', color: '#34d399' },
  { id: 'organizacao', label: 'Organização', glyph: 'crown', color: '#f59e0b' },
  { id: 'objeto', label: 'Objeto', glyph: 'gem', color: '#38bdf8' },
  { id: 'evento', label: 'Evento', glyph: 'agenda', color: '#f472b6' },
  { id: 'conceito', label: 'Conceito', glyph: 'sparkle', color: '#94a3b8' },
];
export const entryCategory = (c: string | null | undefined) => ENTRY_CATEGORIES.find((x) => x.id === c) || null;

/** Cor/ícone de uma menção: pela categoria; notas do autor e avisos pelo tipo. */
export function entryLook(e: Pick<NotebookEntry, 'kind' | 'category'> | null | undefined) {
  if (e && e.kind === 'elemento') {
    const c = entryCategory(e.category);
    if (c) return { color: c.color, glyph: c.glyph, label: c.label };
  }
  const k = entryKind(e?.kind);
  return { color: k.color, glyph: k.glyph, label: k.short };
}

// ------------------------------------------------------------------ relações
export type EntryRel = 'pai' | 'conjuge' | 'irmao' | 'aliado' | 'inimigo' | 'conhece' | 'mentor' | 'membro' | 'mora' | 'governa' | 'vassalo' | 'parte' | 'fundou' | 'venera' | 'criou' | 'rival' | 'outro';

export interface EntryLink {
  id: string;
  profile_id: string;
  from_id: string;
  to_id: string;
  rel: EntryRel;
  label: string;
  created_at: string;
}

/** Como ler a relação: "<de> é <frase> <para>". */
export const ENTRY_RELS: { id: EntryRel; label: string; phrase: string; family?: boolean; hierarchy?: boolean; color: string }[] = [
  { id: 'pai', label: 'Pai/mãe de', phrase: 'pai ou mãe de', family: true, color: '#a78bfa' },
  { id: 'conjuge', label: 'Cônjuge de', phrase: 'cônjuge de', family: true, color: '#f472b6' },
  { id: 'irmao', label: 'Irmão/irmã de', phrase: 'irmão ou irmã de', family: true, color: '#c4b5fd' },
  { id: 'aliado', label: 'Aliado de', phrase: 'aliado de', color: '#34d399' },
  { id: 'inimigo', label: 'Inimigo de', phrase: 'inimigo de', color: '#f87171' },
  { id: 'conhece', label: 'Conhece', phrase: 'conhece', color: '#94a3b8' },
  { id: 'mentor', label: 'Mentor de', phrase: 'mentor de', color: '#38bdf8' },
  { id: 'membro', label: 'Membro de', phrase: 'membro de', color: '#f59e0b' },
  { id: 'mora', label: 'Vive em', phrase: 'vive em', color: '#2dd4bf' },
  { id: 'governa', label: 'Governa', phrase: 'governa', color: '#eab308', hierarchy: true },
  { id: 'vassalo', label: 'Vassalo de', phrase: 'vassalo de', color: '#ca8a04', hierarchy: true },
  { id: 'parte', label: 'Parte de', phrase: 'parte de', color: '#0ea5e9', hierarchy: true },
  { id: 'fundou', label: 'Fundou', phrase: 'fundou', color: '#a3e635' },
  { id: 'venera', label: 'Venera', phrase: 'venera', color: '#e879f9' },
  { id: 'criou', label: 'Criou', phrase: 'criou', color: '#fb923c' },
  { id: 'rival', label: 'Rival de', phrase: 'rival de', color: '#fb7185' },
  { id: 'outro', label: 'Outra relação', phrase: '', color: '#64748b' },
];
/**
 * Hierarquia: quem está acima de quem.
 * "A governa B", "A mentor de B" → A acima de B; "B vassalo de A", "B parte de A", "B membro de A" → A acima de B.
 */
export function hierarchyEdge(l: { from_id: string; to_id: string; rel: string }): { parent: string; child: string } | null {
  if (l.rel === 'governa' || l.rel === 'mentor' || l.rel === 'fundou') return { parent: l.from_id, child: l.to_id };
  if (l.rel === 'vassalo' || l.rel === 'parte' || l.rel === 'membro') return { parent: l.to_id, child: l.from_id };
  return null;
}

export const entryRel = (r: string) => ENTRY_RELS.find((x) => x.id === r) || ENTRY_RELS[ENTRY_RELS.length - 1];

export const ENTRY_UUID_RE = new RegExp(`^${UUID}$`, 'i');
