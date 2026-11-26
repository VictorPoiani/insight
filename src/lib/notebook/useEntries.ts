'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import type { EntryKind, NotebookEntry } from './entries';

const COLS = 'id, profile_id, project_id, kind, title, summary, target_id, aliases, created_at, updated_at';

/** Entradas do Sumário do usuário (todas: são poucas e leves). */
export function useEntries(profileId: string | null) {
  const supabase = useMemo(() => createClient(), []);
  const [entries, setEntries] = useState<Record<string, NotebookEntry>>({});
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    if (!profileId) return;
    let alive = true;
    void (async () => {
      const { data } = await supabase.from('notebook_entries').select(COLS).eq('profile_id', profileId).order('title').limit(5000);
      if (!alive) return;
      const map: Record<string, NotebookEntry> = {};
      for (const e of (data || []) as NotebookEntry[]) map[e.id] = e;
      setEntries(map);
      setLoaded(true);
    })();
    return () => {
      alive = false;
    };
  }, [profileId, supabase]);

  const create = useCallback(
    async (e: { kind: EntryKind; title: string; summary: string; target_id: string | null; project_id: string | null; aliases?: string[] }) => {
      if (!profileId) return null;
      const { data, error } = await supabase
        .from('notebook_entries')
        .insert({ profile_id: profileId, ...e, title: e.title.trim().slice(0, 160) || 'Sem título', summary: e.summary.slice(0, 1200), aliases: e.aliases || [] })
        .select(COLS)
        .single();
      if (error || !data) {
        alert('Não foi possível criar a entrada do Sumário.');
        return null;
      }
      const row = data as NotebookEntry;
      setEntries((prev) => ({ ...prev, [row.id]: row }));
      return row;
    },
    [profileId, supabase]
  );

  const update = useCallback(
    async (id: string, patch: Partial<Pick<NotebookEntry, 'kind' | 'title' | 'summary' | 'target_id' | 'project_id' | 'aliases'>>) => {
      setEntries((prev) => (prev[id] ? { ...prev, [id]: { ...prev[id], ...patch } } : prev));
      const { error } = await supabase.from('notebook_entries').update(patch).eq('id', id);
      if (error) alert('Não foi possível salvar a entrada do Sumário.');
    },
    [supabase]
  );

  const remove = useCallback(
    async (id: string) => {
      setEntries((prev) => {
        const next = { ...prev };
        delete next[id];
        return next;
      });
      await supabase.from('notebook_entries').delete().eq('id', id);
    },
    [supabase]
  );

  return useMemo(() => ({ entries, loaded, create, update, remove }), [entries, loaded, create, update, remove]);
}

export type EntriesApi = ReturnType<typeof useEntries>;
