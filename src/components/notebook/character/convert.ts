import type { NotebookApi } from '@/lib/notebook/useNotebook';
import { characterToMarkdown, isCharacterData, markdownToCharacter } from '@/lib/notebook/character';

/**
 * Converte uma ficha antiga (texto) para a ficha interativa.
 * Guarda antes uma versão no histórico, para dar para voltar ao texto original.
 */
export async function convertCharacterItem(api: NotebookApi, id: string): Promise<boolean> {
  const full = await api.loadFull(id);
  if (!full || full.template !== 'character' || isCharacterData(full.data?.character)) return false;
  await api.saveRevisionNow(id);
  const character = markdownToCharacter(full.content || '');
  api.update(id, { data: { ...(full.data || {}), character }, content: characterToMarkdown(character) });
  return true;
}
