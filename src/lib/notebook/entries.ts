/**
 * Linkagem de informação crucial + Sumário.
 * Um trecho do texto aponta para uma entrada (elemento da história, nota do
 * autor ou aviso). Passar o mouse mostra o resumo; "Ler mais" abre a ficha/nota.
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
  created_at: string;
  updated_at: string;
}

export const ENTRY_KINDS: { id: EntryKind; label: string; short: string; glyph: GlyphName; color: string; hint: string }[] = [
  {
    id: 'elemento',
    label: 'Elemento da história',
    short: 'Elemento',
    glyph: 'sparkle',
    color: '#60a5fa',
    hint: 'Personagem, lugar, objeto ou termo: um resumo para refrescar a memória.',
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
const REF_RE = new RegExp(`(?:\\]\\(ref:|data-ref=\\\\?")(${UUID})`, 'gi');

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

export const ENTRY_UUID_RE = new RegExp(`^${UUID}$`, 'i');
