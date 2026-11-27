'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { writeOrQueue } from './localStore';
import { DEFAULT_CATEGORIES, type CodexCategory, type CodexField } from './codex';

const COLS = 'id, profile_id, project_id, parent_id, name, glyph, kind, fields, position, created_at, updated_at';

/** Categorias do Codex de todos os mundos do usuário (são poucas). */
export function useCodex(profileId: string | null) {
  const supabase = useMemo(() => createClient(), []);
  const [cats, setCats] = useState<Record<string, CodexCategory>>({});
  const catsRef = useRef(cats);
  const [nonce, setNonce] = useState(0);
  const reload = useCallback(() => setNonce((n) => n + 1), []);
  catsRef.current = cats;
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    if (!profileId) return;
    let alive = true;
    void supabase
      .from('notebook_codex_categories')
      .select(COLS)
      .eq('profile_id', profileId)
      .is('deleted_at', null)
      .order('position')
      .limit(2000)
      .then(({ data }) => {
        if (!alive) return;
        const m: Record<string, CodexCategory> = {};
        for (const c of (data || []) as CodexCategory[]) m[c.id] = { ...c, fields: Array.isArray(c.fields) ? c.fields : [] };
        setCats(m);
        setLoaded(true);
      });
    return () => {
      alive = false;
    };
  }, [profileId, supabase, nonce]);

  const ofProject = useCallback(
    (projectId: string) =>
      Object.values(cats)
        .filter((c) => c.project_id === projectId)
        .sort((a, b) => a.position - b.position || a.name.localeCompare(b.name, 'pt-BR')),
    [cats]
  );

  const create = useCallback(
    async (c: { project_id: string; parent_id?: string | null; name: string; glyph?: string; kind?: CodexCategory['kind']; fields?: CodexField[]; position?: number }) => {
      if (!profileId) return null;
      const { data, error } = await supabase
        .from('notebook_codex_categories')
        .insert({ profile_id: profileId, parent_id: null, glyph: 'book', kind: 'conceito', fields: [], position: Date.now() % 1_000_000, ...c, name: c.name.trim().slice(0, 60) || 'Categoria' })
        .select(COLS)
        .single();
      if (error || !data) {
        alert('Não foi possível criar a categoria.');
        return null;
      }
      const row = data as CodexCategory;
      setCats((p) => ({ ...p, [row.id]: row }));
      return row;
    },
    [profileId, supabase]
  );

  /** Cria as categorias iniciais de um mundo (só se ainda não houver nenhuma). */
  const seed = useCallback(
    async (projectId: string) => {
      if (!profileId || Object.values(cats).some((c) => c.project_id === projectId)) return;
      const rows = DEFAULT_CATEGORIES.map((d, i) => ({ profile_id: profileId, project_id: projectId, name: d.name, glyph: d.glyph, kind: d.kind, fields: d.fields, position: (i + 1) * 10 }));
      const { data, error } = await supabase.from('notebook_codex_categories').insert(rows).select(COLS);
      if (error || !data) return;
      const made = data as CodexCategory[];
      const kids: Record<string, unknown>[] = [];
      for (const d of DEFAULT_CATEGORIES) {
        const parent = made.find((m) => m.name === d.name);
        if (!parent || !d.children) continue;
        d.children.forEach((name, j) =>
          kids.push({ profile_id: profileId, project_id: projectId, parent_id: parent.id, name, glyph: d.glyph, kind: d.kind, fields: d.fields, position: (j + 1) * 10 })
        );
      }
      let sub: CodexCategory[] = [];
      if (kids.length) {
        const { data: k } = await supabase.from('notebook_codex_categories').insert(kids).select(COLS);
        sub = (k || []) as CodexCategory[];
      }
      setCats((p) => {
        const n = { ...p };
        [...made, ...sub].forEach((c) => (n[c.id] = c));
        return n;
      });
    },
    [cats, profileId, supabase]
  );

  const update = useCallback(
    async (id: string, patch: Partial<Pick<CodexCategory, 'name' | 'glyph' | 'kind' | 'fields' | 'position' | 'parent_id'>>) => {
      setCats((p) => (p[id] ? { ...p, [id]: { ...p[id], ...patch } } : p));
      const { error } = await writeOrQueue(supabase, profileId, { table: 'notebook_codex_categories', op: 'update', id, row: patch as Record<string, unknown> });
      if (error) alert('Não foi possível salvar a categoria.');
    },
    [supabase, profileId]
  );

  const remove = useCallback(
    async (id: string) => {
      // a categoria e as subcategorias vão para a lixeira (30 dias)
      const ids = [id, ...Object.values(catsRef.current).filter((c) => c.parent_id === id).map((c) => c.id)];
      setCats((p) => {
        const n = { ...p };
        ids.forEach((k) => delete n[k]);
        return n;
      });
      const at = new Date().toISOString();
      for (const k of ids) await writeOrQueue(supabase, profileId, { table: 'notebook_codex_categories', op: 'update', id: k, row: { deleted_at: at } });
    },
    [supabase, profileId]
  );

  return useMemo(() => ({ cats, loaded, ofProject, create, seed, update, remove, reload }), [cats, loaded, ofProject, create, seed, update, remove, reload]);
}

export type CodexApi = ReturnType<typeof useCodex>;
