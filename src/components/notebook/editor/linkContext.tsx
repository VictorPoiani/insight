'use client';

import { createContext, useContext } from 'react';

/** Ligações entre notas disponíveis para qualquer campo de texto do Notebook. */
export interface NotebookLinks {
  titles: string[];
  exists: (title: string) => boolean;
  open: (title: string) => void;
}

export const NotebookLinksContext = createContext<NotebookLinks>({
  titles: [],
  exists: () => true,
  open: () => {},
});

export const useNotebookLinks = () => useContext(NotebookLinksContext);
