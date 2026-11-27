'use client';

import { extractEntryRefs } from './entries';
import { extractSourceRefs } from './sources';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { drainQueue, idbAll, idbDel, idbGet, idbPut, isNetworkError, onPendingChange, pendingCount } from './localStore';
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

export interface NotebookRevision {
  id: string;
  title: string;
  content: string;
  blocks: PostBlock[] | null;
  data: NotebookItemData | null;
  word_count: number;
  created_at: string;
  /** nome do instantâneo (null = versão automática) */
  label: string | null;
}

export type SaveState = 'idle' | 'saving' | 'saved' | 'error' | 'offline';

const LOCAL_KEY = (profileId: string) => `insight-notebook-pending:${profileId}`;
const OUT_KEY = (profileId: string, id: string) => `${profileId}:item:${id}`;
const DOC_KEY = (profileId: string, id: string) => `${profileId}:doc:${id}`;
const META_KEY = (profileId: string) => `${profileId}:meta`;
/** campos que mudam o conteúdo (conferem a versão antes de gravar) */
const CONTENT_FIELDS = ['content', 'blocks', 'data', 'title'] as const;
const META_SYNC = ['title', 'icon', 'color', 'parent_id', 'position', 'pinned', 'archived_at', 'template', 'published_post_id', 'is_template'] as const;
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
  const html = item.template === 'chapter' ? String(item.data?.html || '') : '';
  return { ...base, entry_refs: extractEntryRefs(item.content, data), source_refs: extractSourceRefs(item.content, html), media_refs: extractMediaRefs(`${item.content || ''}\n${data}`), todos: extractTodos(item.content, html) };
}

export interface TodoRef {
  /** tipo: revisar, checar, lore, geral */
  k: string;
  /** o trecho marcado */
  t: string;
  /** posição (n-ésima pendência da nota), para levar até ela */
  i: number;
}
/** Pendências marcadas no texto: [trecho](todo:tipo) ou <span data-todo>. */
export function extractTodos(md: string, html = ''): TodoRef[] {
  const out: TodoRef[] = [];
  for (const m of (md || '').matchAll(/\[([^\]\n]+)\]\(todo:(revisar|checar|lore|geral)\)/gi)) out.push({ k: m[2].toLowerCase(), t: m[1].slice(0, 200), i: out.length });
  for (const m of (html || '').matchAll(/<span[^>]*data-todo="(revisar|checar|lore|geral)"[^>]*>([\s\S]*?)<\/span>/gi)) out.push({ k: m[1].toLowerCase(), t: m[2].replace(/<[^>]+>/g, '').slice(0, 200), i: out.length });
  return out.slice(0, 300);
}

const MEDIA_BASE = (process.env.NEXT_PUBLIC_R2_PUBLIC_URL || '').trim().replace(/\/$/, '');
/** Endereços de mídia do R2 citados no conteúdo (para a Biblioteca saber onde cada uma é usada). */
export function extractMediaRefs(text: string): string[] {
  if (!MEDIA_BASE || !text) return [];
  const esc = MEDIA_BASE.replace(/[.*+?^${}()|[\]\\/]/g, '\\$&');
  const out = new Set<string>();
  for (const m of text.matchAll(new RegExp(`${esc}/[^\\s"'<>)\\]]+`, 'g'))) out.add(m[0].replace(/[\\.,;]+$/, ''));
  return Array.from(out).slice(0, 500);
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
  /** alterações guardadas no aparelho esperando a rede */
  const [pendingSync, setPendingSync] = useState(0);

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
    let rows = (data || []) as unknown as NotebookItem[];
    if (err) {
      // sem rede: abre com a última lista guardada no aparelho
      const cached = isNetworkError(err) ? await idbGet<NotebookItem[]>('docs', META_KEY(profileId)) : undefined;
      if (!cached) {
        setError(err.message);
        setLoading(false);
        return;
      }
      rows = cached;
      setSaveState('offline');
    } else void idbPut('docs', META_KEY(profileId), rows);
    const next: Record<string, NotebookItem> = {};
    for (const row of rows) {
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
    void (async () => {
      // formato antigo (localStorage) passa para o IndexedDB
      try {
        const raw = localStorage.getItem(LOCAL_KEY(profileId));
        if (raw) {
          for (const [id, patch] of Object.entries(JSON.parse(raw) as Record<string, Patch>)) await idbPut('outbox', OUT_KEY(profileId, id), { patch, base: null, ts: Date.now() });
          localStorage.removeItem(LOCAL_KEY(profileId));
        }
      } catch {
        /* ignora */
      }
      const saved = await idbAll<{ patch: Patch; base: number | null }>('outbox', `${profileId}:item:`);
      for (const [key, v] of saved) {
        const id = key.slice(`${profileId}:item:`.length);
        pending.current.set(id, { ...v.patch, ...(pending.current.get(id) || {}) });
        if (v.base != null && !baseVersion.current.has(id)) baseVersion.current.set(id, v.base);
        scheduleFlush(id, 300);
      }
      void refreshPending();
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [profileId]);

  /** versão do servidor sobre a qual a edição pendente foi feita */
  const baseVersion = useRef<Map<string, number>>(new Map());

  const refreshPending = useCallback(async () => {
    if (!profileId) return;
    setPendingSync(await pendingCount(profileId));
  }, [profileId]);
  useEffect(() => onPendingChange(() => void refreshPending()), [refreshPending]);

  /** Guarda a edição pendente no aparelho (IndexedDB) antes de tentar a rede. */
  const persistLocal = useCallback(
    (id?: string) => {
      if (!profileId) return;
      const ids = id ? [id] : Array.from(pending.current.keys());
      for (const k of ids) {
        const patch = pending.current.get(k);
        if (patch) void idbPut('outbox', OUT_KEY(profileId, k), { patch, base: baseVersion.current.get(k) ?? null, ts: Date.now() });
        else void idbDel('outbox', OUT_KEY(profileId, k));
      }
    },
    [profileId]
  );

  // cópia local da nota aberta (para abrir sem conexão)
  const cacheDoc = useCallback(
    (it: NotebookItem | undefined) => {
      if (!profileId || !it?._full) return;
      void idbPut('docs', DOC_KEY(profileId, it.id), it);
    },
    [profileId]
  );

  // várias abas: avisa as outras dos metadados (título, pasta, ordem); o conteúdo não, a versão cuida disso
  const channel = useRef<BroadcastChannel | null>(null);
  useEffect(() => {
    if (!profileId || typeof BroadcastChannel === 'undefined') return;
    const ch = new BroadcastChannel(`insight-notebook:${profileId}`);
    channel.current = ch;
    ch.onmessage = (ev: MessageEvent<{ id: string; meta: Partial<NotebookItem> }>) => {
      const { id, meta } = ev.data || ({} as { id: string; meta: Partial<NotebookItem> });
      if (!id || pending.current.has(id)) return;
      setItems((prev) => (prev[id] ? { ...prev, [id]: { ...prev[id], ...meta } } : prev));
    };
    return () => {
      ch.close();
      channel.current = null;
    };
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
      const touchesContent = CONTENT_FIELDS.some((f) => f in patch);
      const base = baseVersion.current.get(id) ?? cur?.version;
      let q = supabase.from('notebook_items').update(row).eq('id', id);
      if (touchesContent && base != null) q = q.eq('version', base);
      let { data, error: err } = await q.select('updated_at, version').maybeSingle();
      if (!err && !data && touchesContent && base != null) {
        // outro aparelho ou aba gravou antes: a versão de lá vira um instantâneo
        // no histórico (nada se perde) e a edição daqui segue como atual
        const { data: other } = await supabase.from('notebook_items').select('title, content, blocks, data, word_count, version').eq('id', id).maybeSingle();
        const same = other && (!('content' in row) || other.content === row.content) && (!('data' in row) || JSON.stringify(other.data) === JSON.stringify(row.data)) && (!('title' in row) || other.title === row.title);
        if (other && profileId && !same) {
          await supabase.from('notebook_revisions').insert({
            item_id: id,
            profile_id: profileId,
            title: other.title,
            content: other.content || '',
            blocks: other.blocks ?? null,
            data: other.data ?? null,
            word_count: other.word_count || 0,
            label: 'Conflito — versão de outro aparelho',
          });
        }
        ({ data, error: err } = await supabase.from('notebook_items').update(row).eq('id', id).select('updated_at, version').maybeSingle());
      }
      if (err) {
        // devolve para a fila e guarda no aparelho
        pending.current.set(id, { ...patch, ...(pending.current.get(id) || {}) });
        persistLocal(id);
        const offline = isNetworkError(err);
        setSaveState(offline ? 'offline' : 'error');
        if (!offline) setError(err.message);
        const tries = (retries.current.get(id) || 0) + 1;
        retries.current.set(id, tries);
        timers.current.set(id, setTimeout(() => void flush(id), Math.min(60000, 4000 * 2 ** Math.min(tries, 4))));
        void refreshPending();
        return;
      }
      retries.current.delete(id);
      if (!pending.current.has(id)) {
        baseVersion.current.delete(id);
        persistLocal(id);
      } else if (data?.version != null) baseVersion.current.set(id, data.version);
      if (data) {
        setItems((prev) => {
          if (!prev[id]) return prev;
          const next = { ...prev[id], updated_at: data!.updated_at, version: data!.version };
          cacheDoc(next);
          return { ...prev, [id]: next };
        });
      }
      const meta = Object.fromEntries(META_SYNC.filter((f) => f in patch).map((f) => [f, patch[f as keyof Patch]]));
      if (Object.keys(meta).length) channel.current?.postMessage({ id, meta });
      setSaveState(pending.current.size ? 'saving' : 'saved');
      void refreshPending();

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
    [persistLocal, profileId, supabase, cacheDoc, refreshPending]
  );
  const retries = useRef<Map<string, number>>(new Map());

  function scheduleFlush(id: string, delay: number) {
    const t = timers.current.get(id);
    if (t) clearTimeout(t);
    timers.current.set(id, setTimeout(() => void flush(id), delay));
  }

  /** Atualiza na tela na hora e salva com debounce (texto) ou logo (metadados). */
  const update = useCallback(
    (id: string, patch: Patch, opts: { debounce?: number } = {}) => {
      const before = itemsRef.current[id];
      if (!pending.current.has(id) && before?.version != null) baseVersion.current.set(id, before.version);
      setItems((prev) => {
        const cur = prev[id];
        if (!cur) return prev;
        const next = { ...cur, ...patch } as NotebookItem;
        if ('content' in patch || 'blocks' in patch || 'data' in patch) Object.assign(next, deriveFields(next));
        cacheDoc(next);
        return { ...prev, [id]: next };
      });
      pending.current.set(id, { ...(pending.current.get(id) || {}), ...patch });
      persistLocal(id);
      setSaveState('saving');
      scheduleFlush(id, opts.debounce ?? 0);
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [persistLocal, cacheDoc]
  );

  const flushAll = useCallback(async () => {
    await Promise.all(Array.from(pending.current.keys()).map((id) => flush(id)));
    // fila de fora das notas (Quick Capture, verbetes, fontes): se algo subiu, recarrega a lista
    if (profileId && (await drainQueue(profileId, supabase)) > 0) void reload();
  }, [flush, profileId, supabase, reload]);

  // a conexão voltou: manda tudo o que ficou guardado
  useEffect(() => {
    const on = () => {
      setSaveState((s) => (s === 'offline' ? 'saving' : s));
      void flushAll();
    };
    const off = () => setSaveState('offline');
    window.addEventListener('online', on);
    window.addEventListener('offline', off);
    const t = setInterval(() => {
      if (navigator.onLine && (pending.current.size || pendingSync)) void flushAll();
    }, 30000);
    return () => {
      window.removeEventListener('online', on);
      window.removeEventListener('offline', off);
      clearInterval(t);
    };
  }, [flushAll, pendingSync]);

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
      let fromServer = data as unknown as NotebookItem | null;
      if (err || !data) {
        // sem rede: abre a cópia guardada no aparelho
        const cached = profileId && err && isNetworkError(err) ? await idbGet<NotebookItem>('docs', DOC_KEY(profileId, id)) : undefined;
        if (!cached) return null;
        fromServer = cached;
      }
      const full = { ...(fromServer as NotebookItem), data: ((fromServer as any).data || {}) as NotebookItemData, _full: true };
      cacheDoc(full);
      // se há edição pendente local, ela vence
      const p = pending.current.get(id);
      const merged = p ? ({ ...full, ...p } as NotebookItem) : full;
      setItems((prev) => ({ ...prev, [id]: merged }));
      return merged;
    },
    [supabase, profileId, cacheDoc]
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
      ids.forEach((k) => {
        pending.current.delete(k);
        if (profileId) {
          void idbDel('outbox', OUT_KEY(profileId, k));
          void idbDel('docs', DOC_KEY(profileId, k));
        }
      });
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
    [descendants, supabase, profileId]
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
        .select('id, title, content, blocks, data, word_count, created_at, label')
        .eq('item_id', id)
        .order('created_at', { ascending: false })
        .limit(100);
      return (data || []) as NotebookRevision[];
    },
    [supabase]
  );

  const saveRevisionNow = useCallback(
    async (id: string, label?: string | null) => {
      const cur = itemsRef.current[id];
      if (!cur || !profileId) return;
      const name = (label || '').trim().slice(0, 80) || null;
      lastRevision.current.set(id, Date.now());
      await supabase.from('notebook_revisions').insert({
        item_id: id,
        profile_id: profileId,
        title: cur.title,
        content: cur.content || '',
        blocks: cur.blocks ?? null,
        data: cur.data ?? null,
        word_count: cur.word_count,
        ...(name ? { label: name } : {}),
      });
    },
    [profileId, supabase]
  );

  const renameRevision = useCallback(
    async (revId: string, label: string | null) => {
      await supabase.rpc('notebook_revision_rename', { p_id: revId, p_label: label || '' });
    },
    [supabase]
  );

  const deleteRevision = useCallback(
    async (revId: string) => {
      await supabase.from('notebook_revisions').delete().eq('id', revId);
    },
    [supabase]
  );

  // ------------------------------------------------------------ busca no texto
  const searchContent = useCallback(
    async (q: string) => {
      const term = q.trim().replace(/[%_,()]/g, ' ').slice(0, 80);
      if (term.length < 2 || !profileId) return [] as { id: string; snippet: string }[];
      // busca em português (radicais: "castelos" acha "castelo"), com trecho destacado
      const { data: ranked, error: rpcErr } = await supabase.rpc('notebook_search', { p_q: term, p_limit: 60 });
      if (!rpcErr && Array.isArray(ranked) && ranked.length) {
        return (ranked as { kind: string; id: string; snippet: string }[])
          .filter((r) => r.kind === 'item' && itemsRef.current[r.id])
          .map((r) => ({ id: r.id, snippet: (r.snippet || '').replace(/\s+/g, ' ').slice(0, 220) }));
      }
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
      pendingSync,
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
      renameRevision,
      deleteRevision,
      searchContent,
      registerAsset,
    }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [items, loading, error, setError, saveState, pendingSync, reload, loadFull, update, flushAll, create, duplicate, trash, restore, destroy, move, listRevisions, saveRevisionNow, renameRevision, deleteRevision, searchContent, registerAsset]
  );
}

export type NotebookApi = ReturnType<typeof useNotebook>;
