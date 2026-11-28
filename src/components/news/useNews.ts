'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import type { NewsTopicId } from '@/lib/news/topics';

export interface NewsItem {
  id: string;
  url: string;
  title: string;
  summary: string;
  image_url: string | null;
  source_id: string;
  source_name: string;
  source_home: string | null;
  topics: NewsTopicId[];
  lang: string;
  published_at: string;
  open_count: number;
  like_count: number;
  liked: boolean;
  seen: boolean;
  followed_hits: number;
}

let refreshOnce: Promise<boolean> | null = null;
/** Pede ao servidor para coletar notícias novas (no máximo 1x a cada 20 min, lá). */
function requestRefresh(): Promise<boolean> {
  refreshOnce ??= fetch('/api/news/refresh', { method: 'POST' })
    .then((r) => (r.ok ? r.json() : null))
    .then((d) => Boolean(d?.refreshed && d?.inserted > 0))
    .catch(() => false);
  return refreshOnce;
}

/** Feed de notícias ranqueado no banco (get_news_feed). */
export function useNewsFeed(
  mode: 'for_you' | 'all',
  opts: { topic?: string | null; enabled?: boolean; pageSize?: number; version?: string } = {}
) {
  const supabase = useMemo(() => createClient(), []);
  const { topic = null, enabled = true, pageSize = 20, version = '' } = opts;
  const [items, setItems] = useState<NewsItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const reqId = useRef(0);

  const load = useCallback(
    async (offset: number) => {
      const id = ++reqId.current;
      setLoading(true);
      const { data } = await supabase.rpc('get_news_feed', { p_mode: mode, p_limit: pageSize, p_offset: offset, p_topic: topic });
      if (id !== reqId.current) return;
      const list = ((data as NewsItem[]) || []).filter(Boolean);
      setItems((prev) => (offset === 0 ? list : [...prev, ...list.filter((n) => !prev.some((p) => p.id === n.id))]));
      setHasMore(list.length === pageSize);
      setLoading(false);
    },
    [mode, pageSize, supabase, topic]
  );

  useEffect(() => {
    if (!enabled) return;
    void load(0);
    // coleta em segundo plano; se chegou coisa nova, recarrega
    requestRefresh().then((fresh) => {
      if (fresh) void load(0);
    });
  }, [enabled, load, version]);

  const patch = useCallback((id: string, p: Partial<NewsItem> | null) => {
    setItems((prev) => (p === null ? prev.filter((n) => n.id !== id) : prev.map((n) => (n.id === id ? { ...n, ...p } : n))));
  }, []);

  return { items, loading, hasMore, loadMore: () => load(items.length), reload: () => load(0), patch };
}

/** Sinais para o algoritmo: abrir, curtir, ocultar. */
export function trackNews(id: string, kind: 'open' | 'like' | 'hide', on = true) {
  // aguardar é o que envia: o construtor do supabase-js só dispara no .then()
  return createClient().rpc('news_track', { p_news_id: id, p_kind: kind, p_on: on }).then(() => {});
}

/** Temas que a pessoa segue. */
export function useNewsFollows(profileId: string | null) {
  const supabase = useMemo(() => createClient(), []);
  const [follows, setFollows] = useState<Set<string>>(new Set());
  const [ready, setReady] = useState(false);

  useEffect(() => {
    if (!profileId) {
      setFollows(new Set());
      setReady(true);
      return;
    }
    let alive = true;
    supabase
      .from('news_topic_follows')
      .select('topic')
      .eq('profile_id', profileId)
      .then(({ data }) => {
        if (!alive) return;
        setFollows(new Set((data || []).map((r: { topic: string }) => r.topic)));
        setReady(true);
      });
    return () => {
      alive = false;
    };
  }, [profileId, supabase]);

  const toggle = useCallback(
    async (topic: string) => {
      if (!profileId) {
        window.location.href = '/login';
        return;
      }
      const on = !follows.has(topic);
      setFollows((prev) => {
        const n = new Set(prev);
        if (on) n.add(topic);
        else n.delete(topic);
        return n;
      });
      const { error } = on
        ? await supabase.from('news_topic_follows').insert({ profile_id: profileId, topic })
        : await supabase.from('news_topic_follows').delete().eq('profile_id', profileId).eq('topic', topic);
      if (error) {
        setFollows((prev) => {
          const n = new Set(prev);
          if (on) n.delete(topic);
          else n.add(topic);
          return n;
        });
      }
    },
    [follows, profileId, supabase]
  );

  return { follows, ready, toggle };
}

/** Notícias relacionadas a um termo de busca (com espera de 350 ms ao digitar). */
export function useNewsSearch(query: string, limit = 8) {
  const supabase = useMemo(() => createClient(), []);
  const [items, setItems] = useState<NewsItem[]>([]);
  const [loading, setLoading] = useState(false);
  const reqId = useRef(0);

  useEffect(() => {
    const q = query.trim();
    if (q.length < 2) {
      setItems([]);
      setLoading(false);
      return;
    }
    const id = ++reqId.current;
    setLoading(true);
    const t = setTimeout(async () => {
      const { data } = await supabase.rpc('search_news', { p_q: q.replace(/^#/, ''), p_limit: limit });
      if (id !== reqId.current) return;
      setItems(Array.isArray(data) ? (data as NewsItem[]) : []);
      setLoading(false);
    }, 350);
    return () => clearTimeout(t);
  }, [query, limit, supabase]);

  const patch = useCallback((id: string, p: Partial<NewsItem> | null) => {
    setItems((prev) => (p === null ? prev.filter((x) => x.id !== id) : prev.map((x) => (x.id === id ? { ...x, ...p } : x))));
  }, []);

  return { items, loading, patch };
}
