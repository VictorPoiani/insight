'use client';

import { createContext, useCallback, useContext, useEffect, useState } from 'react';
import type { NotebookItem } from '@/lib/notebook/types';
import type { NotebookApi } from '@/lib/notebook/useNotebook';
import type { EntriesApi } from '@/lib/notebook/useEntries';
import type { CodexApi } from '@/lib/notebook/useCodex';
import type { NotebookEntry } from '@/lib/notebook/entries';

/** O que as telas do Mundo precisam do Notebook. */
export interface WorldTools {
  api: NotebookApi;
  entriesApi: EntriesApi;
  codex: CodexApi;
  open: (id: string) => void;
  openAside: (id: string) => void;
  readMore: (e: NotebookEntry) => void;
  openSummary: (projectId: string, focus?: string | null) => void;
  onNew: (o: { parentId: string | null; template?: string; title?: string }) => void;
  uploadImage: (f: File) => Promise<string | null>;
  /** cria o verbete (menção + nota) e devolve a nota */
  newVerbete: (projectId: string, categoryId: string | null, title?: string) => Promise<NotebookItem | null>;
  /** transforma uma menção solta em verbete do Codex */
  promoteEntry: (entry: NotebookEntry, categoryId: string | null) => Promise<NotebookItem | null>;
  /** renomeia uma nota (atualiza os [[links]] das outras) */
  rename: (id: string, title: string) => void;
  /** apaga o verbete (nota para a lixeira, menção removida) */
  removeVerbete: (entry: NotebookEntry) => Promise<void>;
}

export const WorldContext = createContext<WorldTools | null>(null);

export function useWorld() {
  const w = useContext(WorldContext);
  if (!w) throw new Error('WorldContext ausente');
  return w;
}

// ------------------------------------------------------------------ segredos

const SECRETS_KEY = 'insight-notebook-secrets';
const SECRETS_EVENT = 'insight-notebook-secrets';

/** Mostrar ou esconder os segredos do autor (vale para todo o Notebook). */
export function useSecrets(): [boolean, (v: boolean) => void] {
  const [shown, setShown] = useState(true);
  useEffect(() => {
    try {
      setShown(localStorage.getItem(SECRETS_KEY) !== 'hidden');
    } catch {
      /* ignora */
    }
    const on = (e: Event) => setShown((e as CustomEvent<boolean>).detail);
    window.addEventListener(SECRETS_EVENT, on);
    return () => window.removeEventListener(SECRETS_EVENT, on);
  }, []);
  const set = useCallback((v: boolean) => {
    try {
      localStorage.setItem(SECRETS_KEY, v ? 'shown' : 'hidden');
    } catch {
      /* ignora */
    }
    window.dispatchEvent(new CustomEvent(SECRETS_EVENT, { detail: v }));
  }, []);
  return [shown, set];
}
