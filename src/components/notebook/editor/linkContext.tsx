'use client';

import { createContext, useContext } from 'react';
import type { EntryKind, NotebookEntry } from '@/lib/notebook/entries';

/** Ligações entre notas e menções, disponíveis para qualquer campo do Notebook. */
export interface NotebookLinks {
  titles: string[];
  exists: (title: string) => boolean;
  open: (title: string) => void;
  entries: Record<string, NotebookEntry>;
  /** abre o diálogo "Mencionar" e devolve a entrada escolhida/criada */
  requestEntry: (text: string) => Promise<{ id: string; kind: EntryKind } | null>;
  /** abre a ficha/nota da menção (o mesmo que "Ler mais") */
  readMore?: (entryId: string) => void;
}

export const NotebookLinksContext = createContext<NotebookLinks>({
  titles: [],
  exists: () => true,
  open: () => {},
  entries: {},
  requestEntry: async () => null,
});

export const useNotebookLinks = () => useContext(NotebookLinksContext);
