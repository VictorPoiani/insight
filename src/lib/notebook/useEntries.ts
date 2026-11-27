'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { writeOrQueue } from './localStore';
import type { EntryCategory, EntryKind, EntryLink, EntryRel, NotebookEntry } from './entries';

const COLS = 'id, profile_id, project_id, kind, title, summary, target_id, aliases, category, image_url, codex_category_id, is_secret, is_public, created_at, updated_at';
const LINK_COLS = 'id, profile_id, from_id, to_id, rel, label, created_at';

/** Entradas do Sumário do usuário (todas: são poucas e leves). */
export function useEntries(profileId: string | null) {
  const supabase = useMemo(() => createClient(), []);
  const [entries, setEntries] = useState<Record<string, NotebookEntry>>({});
  const [loaded, setLoaded] = useState(false);
  const [links, setLinks] = useState<EntryLink[]>([]);
  /** recarrega (ex.: depois de restaurar da lixeira) */
  const [nonce, setNonce] = useState(0);
  const reload = useCallback(() => setNonce((n) => n + 1), []);

  useEffect(() => {
    if (!profileId) return;
    let alive = true;
    void (async () => {
      const [{ data }, { data: rel }] = await Promise.all([
        supabase.from('notebook_entries').select(COLS).eq('profile_id', profileId).is('deleted_at', null).order('title').limit(5000),
        supabase.from('notebook_entry_links').select(LINK_COLS).eq('profile_id', profileId).limit(10000),
      ]);
      if (!alive) return;
      const map: Record<string, NotebookEntry> = {};
      for (const e of (data || []) as NotebookEntry[]) map[e.id] = e;
      // relações com verbetes na lixeira ficam escondidas (voltam ao restaurar)
      setLinks(((rel || []) as EntryLink[]).filter((l) => map[l.from_id] && map[l.to_id]));
      setEntries(map);
      setLoaded(true);
    })();
    return () => {
      alive = false;
    };
  }, [profileId, supabase, nonce]);

  const create = useCallback(
    async (e: {
      kind: EntryKind;
      title: string;
      summary: string;
      target_id: string | null;
      project_id: string | null;
      aliases?: string[];
      category?: EntryCategory | null;
      image_url?: string | null;
      codex_category_id?: string | null;
    }) => {
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
    async (id: string, patch: Partial<Pick<NotebookEntry, 'kind' | 'title' | 'summary' | 'target_id' | 'project_id' | 'aliases' | 'category' | 'image_url' | 'codex_category_id' | 'is_secret' | 'is_public'>>) => {
      setEntries((prev) => (prev[id] ? { ...prev, [id]: { ...prev[id], ...patch } } : prev));
      const { error } = await writeOrQueue(supabase, profileId, { table: 'notebook_entries', op: 'update', id, row: patch });
      if (error) alert('Não foi possível salvar a entrada do Sumário.');
    },
    [supabase, profileId]
  );

  const remove = useCallback(
    async (id: string) => {
      setEntries((prev) => {
        const next = { ...prev };
        delete next[id];
        return next;
      });
      setLinks((prev) => prev.filter((l) => l.from_id !== id && l.to_id !== id));
      // vai para a lixeira (30 dias), não some
      await writeOrQueue(supabase, profileId, { table: 'notebook_entries', op: 'update', id, row: { deleted_at: new Date().toISOString() } });
    },
    [supabase, profileId]
  );

  const addLink = useCallback(
    async (from_id: string, to_id: string, rel: EntryRel, label = '') => {
      if (!profileId || from_id === to_id) return null;
      const { data, error } = await supabase
        .from('notebook_entry_links')
        .insert({ profile_id: profileId, from_id, to_id, rel, label: label.slice(0, 80) })
        .select(LINK_COLS)
        .single();
      if (error || !data) {
        if (!String(error?.message || '').includes('duplicate')) alert('Não foi possível criar a relação.');
        return null;
      }
      setLinks((prev) => [...prev, data as EntryLink]);
      return data as EntryLink;
    },
    [profileId, supabase]
  );

  const removeLink = useCallback(
    async (id: string) => {
      setLinks((prev) => prev.filter((l) => l.id !== id));
      await supabase.from('notebook_entry_links').delete().eq('id', id);
    },
    [supabase]
  );

  return useMemo(
    () => ({ entries, loaded, create, update, remove, links, addLink, removeLink, reload }),
    [entries, loaded, create, update, remove, links, addLink, removeLink, reload]
  );
}

export type EntriesApi = ReturnType<typeof useEntries>;
