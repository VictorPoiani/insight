'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import type { Source, SourceQuote } from './sources';

const COLS =
  'id, profile_id, project_id, type, authors, title, subtitle, container, edition, place, publisher, year, month, volume, issue, pages, doi, isbn, url, accessed_on, extra, notes, created_at, updated_at';
const QCOLS = 'id, profile_id, source_id, text, page, comment, created_at';

export type SourceInput = Omit<Source, 'id' | 'profile_id' | 'created_at' | 'updated_at'>;

/** Biblioteca de fontes do usuário (com trechos salvos). */
export function useSources(profileId: string | null) {
  const supabase = useMemo(() => createClient(), []);
  const [sources, setSources] = useState<Record<string, Source>>({});
  const [quotes, setQuotes] = useState<SourceQuote[]>([]);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    if (!profileId) return;
    let alive = true;
    void Promise.all([
      supabase.from('notebook_sources').select(COLS).eq('profile_id', profileId).order('updated_at', { ascending: false }).limit(5000),
      supabase.from('notebook_source_quotes').select(QCOLS).eq('profile_id', profileId).order('created_at').limit(10000),
    ]).then(([{ data }, { data: q }]) => {
      if (!alive) return;
      const m: Record<string, Source> = {};
      for (const s of (data || []) as Source[]) m[s.id] = { ...s, authors: Array.isArray(s.authors) ? s.authors : [], extra: s.extra || {} };
      setSources(m);
      setQuotes((q || []) as SourceQuote[]);
      setLoaded(true);
    });
    return () => {
      alive = false;
    };
  }, [profileId, supabase]);

  const create = useCallback(
    async (input: SourceInput) => {
      if (!profileId) return null;
      const { data, error } = await supabase
        .from('notebook_sources')
        .insert({ ...input, profile_id: profileId, title: input.title.trim().slice(0, 500) || 'Sem título' })
        .select(COLS)
        .single();
      if (error || !data) {
        alert(error?.message?.includes('url') ? 'O endereço precisa começar com http:// ou https://.' : 'Não foi possível salvar a fonte.');
        return null;
      }
      const row = data as Source;
      setSources((p) => ({ ...p, [row.id]: row }));
      return row;
    },
    [profileId, supabase]
  );

  const update = useCallback(
    async (id: string, patch: Partial<SourceInput>) => {
      setSources((p) => (p[id] ? { ...p, [id]: { ...p[id], ...patch } } : p));
      const { error } = await supabase.from('notebook_sources').update(patch).eq('id', id);
      if (error) alert(error.message?.includes('url') ? 'O endereço precisa começar com http:// ou https://.' : 'Não foi possível salvar a fonte.');
    },
    [supabase]
  );

  const remove = useCallback(
    async (id: string) => {
      setSources((p) => {
        const n = { ...p };
        delete n[id];
        return n;
      });
      setQuotes((q) => q.filter((x) => x.source_id !== id));
      await supabase.from('notebook_sources').delete().eq('id', id);
    },
    [supabase]
  );

  const addQuote = useCallback(
    async (sourceId: string, text: string, page: string | null, comment = '') => {
      if (!profileId || !text.trim()) return null;
      const { data, error } = await supabase
        .from('notebook_source_quotes')
        .insert({ profile_id: profileId, source_id: sourceId, text: text.trim().slice(0, 10000), page: page?.trim() || null, comment })
        .select(QCOLS)
        .single();
      if (error || !data) return null;
      setQuotes((q) => [...q, data as SourceQuote]);
      return data as SourceQuote;
    },
    [profileId, supabase]
  );

  const removeQuote = useCallback(
    async (id: string) => {
      setQuotes((q) => q.filter((x) => x.id !== id));
      await supabase.from('notebook_source_quotes').delete().eq('id', id);
    },
    [supabase]
  );

  return useMemo(() => ({ sources, quotes, loaded, create, update, remove, addQuote, removeQuote }), [sources, quotes, loaded, create, update, remove, addQuote, removeQuote]);
}

export type SourcesApi = ReturnType<typeof useSources>;
