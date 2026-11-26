'use client';

import { extractEntryRefs } from './entries';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import type { PostBlock } from '@/types/database';
import { countWords, extractLinks, extractTags, htmlToText } from './markdown';
import { getTemplate } from './templates';
import {
  NOTEBOOK_FULL_COLUMNS,
  NOTEBOOK_META_COLUMNS,
  type NotebookItem,
  type NotebookItemData,
  type NotebookTemplate,
} from './types';

type Patch = Partial<Pick<NotebookItem, 'title' | 'icon' | 'color' | 'content' | 'blocks' | 'data' | 'parent_id' | 'position' | 'pinned' | 'is_template' | 'archived_at' | 'published_post_id' | 'template'>>;

export type SaveState = 'idle' | 'saving' | 'saved' | 'error' | 'offline';

const LOCAL_KEY = (profileId: string) => `insight-notebook-pending:${profileId}`;
const REVISION_EVERY_MS = 10 * 60 * 1000;

function blocksText(blocks: PostBlock[] | null | undefined): string {
  if (!blocks) return '';
  return blocks
    .map((b) =>
      [b.html, b.imageCaption, b.videoCaption, b.chartTitle, b.pollQuestion, ...(b.tableData || []).flat()]
        .filter(Boolean)
        .join(' ')
    )
    .join('\n');
}

/** Campos derivados (links, tags, contagem de palavras) a partir do conteúdo. */
export function deriveFields(item: Pick<NotebookItem, 'template' | 'content' | 'blocks' | 'data'>) {
  const base = deriveBase(item);
  const data = item.data ? JSON.stringify(item.data) : '';
  return { ...base, entry_refs: extractEntryRefs(item.content, data) };
}

function deriveBase(item: Pick<NotebookItem, 'template' | 'content' | 'blocks' | 'data'>) {
  if (item.template === 'blocks') {
    const text = htmlToText(blocksText(item.blocks));
    return { links: extractLinks(text), tags: extractTags(text), word_count: countWords(text) };
  }
  if (item.template === 'chapter') {
    const text = htmlToText(String(item.data?.html || ''));
    return { links: extractLinks(text), tags: [] as string[], word_count: countWords(text) };
  }
  if (item.template === 'book') {
    const syn = String(item.data?.synopsis || '');
    return { links: extractLinks(syn), tags: extractTags(syn), word_count: 0 };
  }
  return { links: extractLinks(item.content), tags: extractTags(item.content), word_count: countWords(item.content) };
}

export function useNotebook(profileId: string | null) {
  const supabase = useMemo(() => createClient(), []);
  const [items, setItems] = useState<Record<string, NotebookItem>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [saveState, setSaveState] = useState<SaveState>('idle');

  const itemsRef = useRef(items);
  itemsRef.current = items;
  const pending = useRef<Map<string, Patch>>(new Map());
  const timers = useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map());
  const lastRevision = useRef<Map<string, number>>(new Map());

  // ------------------------------------------------------------ carga inicial
  const reload = useCallback(async () => {
    if (!profileId) return;
    setLoading(true);
    const { data, error: err } = await supabase
      .from('notebook_items')
      .select(NOTEBOOK_META_COLUMNS)
      .eq('profile_id', profileId)
      .order('position', { ascending: true })
      .limit(5000);
    if (err) {
      setError(err.message);
      setLoading(false);
      return;
    }
    const next: Record<string, NotebookItem> = {};
    for (const row of (data || []) as unknown as NotebookItem[]) {
      next[row.id] = { ...row, content: '', blocks: null, data: {} as NotebookItemData, _full: false };
    }
    // mantém o que já estava aberto/carregado
    for (const [id, cur] of Object.entries(itemsRef.current)) {
      if (cur._full && next[id]) next[id] = { ...next[id], content: cur.content, blocks: cur.blocks, data: cur.data, _full: true };
    }
    setItems(next);
    setError(null);
    setLoading(false);
  }, [profileId, supabase]);

  useEffect(() => {
    void reload();
  }, [reload]);

  // reenvia alterações que ficaram só no aparelho (aba fechada / sem rede)
  useEffect(() => {
    if (!profileId) return;
    try {
      const raw = localStorage.getItem(LOCAL_KEY(profileId));
      if (!raw) return;
      const saved = JSON.parse(raw) as Record<string, Patch>;
      for (const [id, patch] of Object.entries(saved)) {
        pending.current.set(id, { ...(pending.current.get(id) || {}), ...patch });
        scheduleFlush(id, 200);
      }
    } catch {
      /* ignora */
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [profileId]);

  const persistLocal = useCallback(() => {
    if (!profileId) return;
    try {
      const obj = Object.fromEntries(pending.current.entries());
      if (Object.keys(obj).length) localStorage.setItem(LOCAL_KEY(profileId), JSON.stringify(obj));
      else localStorage.removeItem(LOCAL_KEY(profileId));
    } catch {
      /* cota do navegador */
    }
  }, [profileId]);

  // ------------------------------------------------------------ salvamento
  const flush = useCallback(
    async (id: string) => {
      const patch = pending.current.get(id);
      if (!patch) return;
      pending.current.delete(id);
      timers.current.delete(id);
      const cur = itemsRef.current[id];
      const row: Record<string, unknown> = { ...patch };
      if (cur && ('content' in patch || 'blocks' in patch || 'data' in patch || 'template' in patch)) {
        Object.assign(row, deriveFields({ ...cur, ...patch } as NotebookItem));
      }
      setSaveState('saving');
      const { data, error: err } = await supabase
        .from('notebook_items')
        .update(row)
        .eq('id', id)
        .select('updated_at')
        .maybeSingle();
      if (err) {
        // devolve para a fila e guarda no aparelho
        pending.current.set(id, { ...patch, ...(pending.current.get(id) || {}) });
        persistLocal();
        setSaveState(typeof navigator !== 'undefined' && !navigator.onLine ? 'offline' : 'error');
        setError(err.message);
        timers.current.set(id, setTimeout(() => void flush(id), 8000));
        return;
      }
      persistLocal();
      if (data?.updated_at) {
        setItems((prev) => (prev[id] ? { ...prev, [id]: { ...prev[id], updated_at: data.updated_at } } : prev));
      }
      setSaveState(pending.current.size ? 'saving' : 'saved');

      // revisão automática a cada 10 min de edição
      if (cur && profileId && ('content' in patch || 'blocks' in patch || 'data' in patch)) {
        const last = lastRevision.current.get(id) || 0;
        if (Date.now() - last > REVISION_EVERY_MS) {
          lastRevision.current.set(id, Date.now());
          const full = { ...cur, ...patch };
          void supabase.from('notebook_revisions').insert({
            item_id: id,
            profile_id: profileId,
            title: full.title,
            content: full.content || '',
            blocks: full.blocks ?? null,
            data: full.data ?? null,
            word_count: deriveFields(full as NotebookItem).word_count,
          });
        }
      }
    },
    [persistLocal, profileId, supabase]
  );

  function scheduleFlush(id: string, delay: number) {
    const t = timers.current.get(id);
    if (t) clearTimeout(t);
    timers.current.set(id, setTimeout(() => void flush(id), delay));
  }

  /** Atualiza na tela na hora e salva com debounce (texto) ou logo (metadados). */
  const update = useCallback(
    (id: string, patch: Patch, opts: { debounce?: number } = {}) => {
      setItems((prev) => {
        const cur = prev[id];
        if (!cur) return prev;
        const next = { ...cur, ...patch } as NotebookItem;
        if ('content' in patch || 'blocks' in patch || 'data' in patch) Object.assign(next, deriveFields(next));
        return { ...prev, [id]: next };
      });
      pending.current.set(id, { ...(pending.current.get(id) || {}), ...patch });
      persistLocal();
      setSaveState('saving');
      scheduleFlush(id, opts.debounce ?? 0);
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [persistLocal]
  );

  const flushAll = useCallback(async () => {
    await Promise.all(Array.from(pending.current.keys()).map((id) => flush(id)));
  }, [flush]);

  // salva antes de sair
  useEffect(() => {
    const onHide = () => {
      if (document.visibilityState === 'hidden') void flushAll();
    };
    const onUnload = (e: BeforeUnloadEvent) => {
      if (pending.current.size) {
        persistLocal();
        void flushAll();
        e.preventDefault();
      }
    };
    document.addEventListener('visibilitychange', onHide);
    window.addEventListener('beforeunload', onUnload);
    return () => {
      document.removeEventListener('visibilitychange', onHide);
      window.removeEventListener('beforeunload', onUnload);
      void flushAll();
    };
  }, [flushAll, persistLocal]);

  // ------------------------------------------------------------ leitura completa
  const loadFull = useCallback(
    async (id: string) => {
      const cur = itemsRef.current[id];
      if (cur?._full) return cur;
      const { data, error: err } = await supabase.from('notebook_items').select(NOTEBOOK_FULL_COLUMNS).eq('id', id).maybeSingle();
      if (err || !data) return null;
      const full = { ...(data as unknown as NotebookItem), data: ((data as any).data || {}) as NotebookItemData, _full: true };
      // se há edição pendente local, ela vence
      const p = pending.current.get(id);
      const merged = p ? ({ ...full, ...p } as NotebookItem) : full;
      setItems((prev) => ({ ...prev, [id]: merged }));
      return merged;
    },
    [supabase]
  );

  // ------------------------------------------------------------ criar
  const create = useCallback(
    async (opts: {
      template: NotebookTemplate;
      parentId?: string | null;
      title?: string;
      from?: NotebookItem | null; // modelo do próprio usuário
      content?: string;
    }) => {
      if (!profileId) return null;
      const def = getTemplate(opts.template);
      const now = new Date();
      const siblings = Object.values(itemsRef.current).filter(
        (i) => i.parent_id === (opts.parentId ?? null) && !i.archived_at
      );
      const position = siblings.length ? Math.max(...siblings.map((s) => s.position)) + 1 : 1;

      let src: NotebookItem | null = null;
      if (opts.from) src = (await loadFull(opts.from.id)) || opts.from;

      // título único entre irmãos
      let title = (opts.title || (src ? src.title.replace(/^modelo[:\s-]*/i, '') : def.title(now))).slice(0, 200) || 'Sem título';
      if (!opts.title && !src && def.id === 'chapter') {
        title = `Capítulo ${siblings.filter((x) => x.template === 'chapter').length + 1}`;
      }
      const taken = new Set(siblings.map((s) => s.title.toLowerCase()));
      if (taken.has(title.toLowerCase())) {
        let n = 2;
        while (taken.has(`${title} ${n}`.toLowerCase())) n++;
        title = `${title} ${n}`;
      }

      const row = {
        profile_id: profileId,
        parent_id: opts.parentId ?? null,
        kind: src?.kind || def.kind,
        template: src?.template || def.id,
        title,
        icon: src?.icon ?? def.icon,
        color: src?.color ?? null,
        content: opts.content ?? src?.content ?? def.content?.(now) ?? '',
        blocks: src?.blocks ?? null,
        data: (src?.data ?? def.data?.() ?? {}) as NotebookItemData,
        position,
      };
      const derived = deriveFields(row as unknown as NotebookItem);
      const { data, error: err } = await supabase
        .from('notebook_items')
        .insert({ ...row, ...derived })
        .select(NOTEBOOK_FULL_COLUMNS)
        .single();
      if (err || !data) {
        setError(err?.message || 'Não foi possível criar.');
        return null;
      }
      const item = { ...(data as unknown as NotebookItem), _full: true };
      setItems((prev) => ({ ...prev, [item.id]: item }));
      return item;
    },
    [loadFull, profileId, supabase]
  );

  const duplicate = useCallback(
    async (id: string) => {
      const src = await loadFull(id);
      if (!src) return null;
      return create({ template: src.template, parentId: src.parent_id, title: `${src.title} (cópia)`, from: src });
    },
    [create, loadFull]
  );

  // ------------------------------------------------------------ lixeira
  const descendants = useCallback((id: string) => {
    const all = Object.values(itemsRef.current);
    const out: string[] = [];
    const walk = (pid: string) => {
      for (const c of all) if (c.parent_id === pid) {
        out.push(c.id);
        walk(c.id);
      }
    };
    walk(id);
    return out;
  }, []);

  const trash = useCallback(
    (id: string) => {
      const at = new Date().toISOString();
      for (const k of [id, ...descendants(id)]) update(k, { archived_at: at });
    },
    [descendants, update]
  );

  const restore = useCallback(
    (id: string) => {
      const cur = itemsRef.current[id];
      // se a pasta-mãe está na lixeira, restaura na raiz
      const parent = cur?.parent_id ? itemsRef.current[cur.parent_id] : null;
      const patch: Patch = { archived_at: null };
      if (parent?.archived_at) patch.parent_id = null;
      update(id, patch);
      for (const k of descendants(id)) update(k, { archived_at: null });
    },
    [descendants, update]
  );

  const destroy = useCallback(
    async (id: string) => {
      const ids = [id, ...descendants(id)];
      ids.forEach((k) => pending.current.delete(k));
      const { error: err } = await supabase.from('notebook_items').delete().eq('id', id);
      if (err) {
        setError(err.message);
        return false;
      }
      setItems((prev) => {
        const next = { ...prev };
        ids.forEach((k) => delete next[k]);
        return next;
      });
      return true;
    },
    [descendants, supabase]
  );

  const move = useCallback(
    (id: string, parentId: string | null, position?: number) => {
      if (id === parentId) return;
      if (parentId && descendants(id).includes(parentId)) return; // não entra em si mesma
      const siblings = Object.values(itemsRef.current).filter((i) => i.parent_id === parentId && i.id !== id);
      const pos = position ?? (siblings.length ? Math.max(...siblings.map((s) => s.position)) + 1 : 1);
      update(id, { parent_id: parentId, position: pos });
    },
    [descendants, update]
  );

  // ------------------------------------------------------------ revisões
  const listRevisions = useCallback(
    async (id: string) => {
      const { data } = await supabase
        .from('notebook_revisions')
        .select('id, title, content, blocks, data, word_count, created_at')
        .eq('item_id', id)
        .order('created_at', { ascending: false })
        .limit(40);
      return (data || []) as { id: string; title: string; content: string; blocks: PostBlock[] | null; data: NotebookItemData | null; word_count: number; created_at: string }[];
    },
    [supabase]
  );

  const saveRevisionNow = useCallback(
    async (id: string) => {
      const cur = itemsRef.current[id];
      if (!cur || !profileId) return;
      lastRevision.current.set(id, Date.now());
      await supabase.from('notebook_revisions').insert({
        item_id: id,
        profile_id: profileId,
        title: cur.title,
        content: cur.content || '',
        blocks: cur.blocks ?? null,
        data: cur.data ?? null,
        word_count: cur.word_count,
      });
    },
    [profileId, supabase]
  );

  // ------------------------------------------------------------ busca no texto
  const searchContent = useCallback(
    async (q: string) => {
      const term = q.trim().replace(/[%_,()]/g, ' ').slice(0, 80);
      if (term.length < 2 || !profileId) return [] as { id: string; snippet: string }[];
      const { data } = await supabase
        .from('notebook_items')
        .select('id, title, content, data')
        .eq('profile_id', profileId)
        .is('archived_at', null)
        .or(`title.ilike.%${term}%,content.ilike.%${term}%,data->>html.ilike.%${term}%,data->>synopsis.ilike.%${term}%`)
        .limit(60);
      const lower = term.toLowerCase();
      return (data || []).map((r: any) => {
        const text: string = r.content || htmlToText(String(r.data?.html || r.data?.synopsis || ''));
        const at = text.toLowerCase().indexOf(lower);
        const snippet = at >= 0 ? text.slice(Math.max(0, at - 50), at + 90).replace(/\s+/g, ' ') : '';
        return { id: r.id as string, snippet };
      });
    },
    [profileId, supabase]
  );

  // ------------------------------------------------------------ anexos
  const registerAsset = useCallback(
    async (itemId: string | null, r2Key: string | null, url: string) => {
      if (!profileId || !r2Key) return;
      await supabase.from('notebook_assets').insert({ profile_id: profileId, item_id: itemId, r2_key: r2Key, url });
    },
    [profileId, supabase]
  );

  return useMemo(
    () => ({
      items,
      loading,
      error,
      setError,
      saveState,
      reload,
      loadFull,
      update,
      flushAll,
      create,
      duplicate,
      trash,
      restore,
      destroy,
      move,
      listRevisions,
      saveRevisionNow,
      searchContent,
      registerAsset,
    }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [items, loading, error, setError, saveState, reload, loadFull, update, flushAll, create, duplicate, trash, restore, destroy, move, listRevisions, saveRevisionNow, searchContent, registerAsset]
  );
}

export type NotebookApi = ReturnType<typeof useNotebook>;
