import type { NotebookItem } from '@/lib/notebook/types';
import type { WorldTools } from './WorldContext';

/** Seção da nota antiga → categoria do Codex (pelo nome). */
const MAP: [RegExp, string][] = [
  [/lugar|local|geogra|cidade|reino|regi/i, 'Locais e Geografia'],
  [/fac[cç]|govern|organiza|ordem|guild|cl[aã]/i, 'Facções e Governos'],
  [/magia|regra|tecnolog|poder/i, 'Magia e Tecnologia'],
  [/esp[eé]cie|ra[cç]a|cultura|povo/i, 'Espécies e Culturas'],
  [/relig|mito|deus|cren/i, 'Religiões e Mitologia'],
  [/item|itens|artefato|objeto|arma/i, 'Itens e Artefatos'],
  [/flora|fauna|criatura|planta|animal|bestas?/i, 'Flora e Fauna'],
  [/econom|lei|moeda|com[eé]rcio/i, 'Economia e Leis'],
];

const strip = (s: string) =>
  s
    .replace(/\[\[([^\]|#]+)(?:[#|][^\]]*)?\]\]/g, '$1')
    .replace(/\[([^\]]+)\]\([^)]*\)/g, '$1')
    .replace(/(\*\*|__|\*|_|`)/g, '')
    .trim();

/**
 * Lê uma nota antiga de worldbuilding e cria um verbete para cada item de
 * lista no formato "- **Nome** — descrição". A nota original não muda.
 * Devolve quantos verbetes foram criados.
 */
export async function convertWorldNote(w: WorldTools, project: NotebookItem, note: NotebookItem): Promise<number> {
  const full = note._full ? note : await w.api.loadFull(note.id);
  if (!full) return 0;
  const cats = w.codex.ofProject(project.id);
  const existing = new Set(
    Object.values(w.entriesApi.entries)
      .filter((e) => e.project_id === project.id)
      .map((e) => e.title.toLowerCase())
  );
  let section = '';
  let made = 0;
  let glossary: string | null = null;

  for (const line of (full.content || '').split('\n')) {
    const h = /^#{2,3}\s+(.+)$/.exec(line);
    if (h) {
      section = strip(h[1]);
      continue;
    }
    const m = /^\s*[-*+]\s+\*\*([^*]+)\*\*\s*(?:[—–:-]\s*)?(.*)$/.exec(line);
    if (!m) continue;
    const name = strip(m[1]).slice(0, 160);
    if (!name || existing.has(name.toLowerCase())) continue;
    const desc = strip(m[2] || '').slice(0, 300);

    const target = MAP.find(([re]) => re.test(section))?.[1];
    let catId = target ? cats.find((c) => !c.parent_id && c.name === target)?.id ?? null : null;
    if (!catId) {
      // o resto (glossário, notas soltas…) vai para uma categoria "Glossário"
      if (!glossary) {
        glossary = cats.find((c) => c.name === 'Glossário')?.id ?? (await w.codex.create({ project_id: project.id, name: 'Glossário', glyph: 'book', kind: 'conceito', fields: [] }))?.id ?? null;
      }
      catId = glossary;
    }
    const item = await w.newVerbete(project.id, catId, name);
    if (!item) continue;
    const entryId = (item.data as { codex?: { entry: string } })?.codex?.entry;
    if (entryId && desc) await w.entriesApi.update(entryId, { summary: desc });
    existing.add(name.toLowerCase());
    made++;
  }
  return made;
}
