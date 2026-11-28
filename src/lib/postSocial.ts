'use client';

import { createClient } from '@/lib/supabase/client';

/**
 * Contexto social de cada Insight no feed, buscado EM LOTE (como postFlags):
 * quem curtiu, a resposta em destaque e as reações. Os cartões que montam no
 * mesmo instante viram poucas consultas com `in(...)`.
 */

// reações com os emojis comuns (no seletor e nos chips de contagem)
export const REACTIONS = [
  { id: 'idea', emoji: '💡', label: 'Boa ideia' },
  { id: 'fire', emoji: '🔥', label: 'Incrível' },
  { id: 'laugh', emoji: '😂', label: 'Engraçado' },
  { id: 'think', emoji: '🤔', label: 'Me fez pensar' },
  { id: 'wow', emoji: '😮', label: 'Uau' },
] as const;
export type ReactionId = (typeof REACTIONS)[number]['id'];
export const REACTION_BY_ID = new Map<string, (typeof REACTIONS)[number]>(REACTIONS.map((r) => [r.id, r]));

export interface MiniProfile {
  id: string;
  username: string;
  name: string;
  avatar_url: string | null;
}

export interface TopReply {
  id: string;
  author: MiniProfile;
  text: string;
  likes: number;
  created_at: string;
}

export interface PostSocial {
  /** quem curtiu por último (até 3) */
  likers: MiniProfile[];
  topReply: TopReply | null;
  reactions: Partial<Record<ReactionId, number>>;
  myReaction: ReactionId | null;
}

const EMPTY: PostSocial = { likers: [], topReply: null, reactions: {}, myReaction: null };

let pending = new Map<string, ((s: PostSocial) => void)[]>();
let pendingViewer: string | null = null;
let timer: ReturnType<typeof setTimeout> | null = null;
const cache = new Map<string, PostSocial>(); // chave: viewer:post
const listeners = new Map<string, Set<(s: PostSocial) => void>>(); // chave: post

function key(viewer: string | null, postId: string) {
  return `${viewer || 'anon'}:${postId}`;
}

function replyText(r: { content?: string | null; blocks?: unknown }): string {
  let t = '';
  if (Array.isArray(r.blocks)) {
    for (const b of r.blocks as { html?: string; type?: string }[]) {
      const s = (b?.html || '').replace(/<br\s*\/?>/gi, ' ').replace(/<[^>]+>/g, ' ').replace(/&nbsp;/g, ' ').trim();
      if (s) t += (t ? ' ' : '') + s;
      if (t.length > 200) break;
    }
    if (!t && (r.blocks as { type?: string }[]).some((b) => b?.type === 'image' || b?.type === 'gif' || b?.type === 'video')) t = 'enviou uma mídia';
  }
  if (!t) t = (r.content || '').trim();
  return t.replace(/\s+/g, ' ').slice(0, 200);
}

async function flush() {
  const batch = pending;
  const viewer = pendingViewer;
  pending = new Map();
  pendingViewer = null;
  timer = null;
  const ids = [...batch.keys()];
  if (!ids.length) return;
  const supabase = createClient();

  type LikeRow = { post_id: string; profile_id: string; created_at: string };
  type ReplyRow = {
    id: string;
    post_id: string;
    profile_id: string;
    content: string | null;
    blocks: unknown;
    likes_count: number | null;
    created_at: string;
    author_name: string | null;
    author_handle: string | null;
    avatar_url: string | null;
  };
  type ReactionRow = { post_id: string; profile_id: string; reaction: string };

  const likes: LikeRow[] = [];
  const replies: ReplyRow[] = [];
  const reactions: ReactionRow[] = [];

  for (let i = 0; i < ids.length; i += 100) {
    const chunk = ids.slice(i, i + 100);
    const [l, r, re] = await Promise.all([
      supabase.from('post_likes').select('post_id, profile_id, created_at').in('post_id', chunk).order('created_at', { ascending: false }).limit(800),
      supabase
        .from('replies')
        .select('id, post_id, profile_id, content, blocks, likes_count, created_at, author_name, author_handle, avatar_url')
        .in('post_id', chunk)
        .is('parent_reply_id', null)
        .order('created_at', { ascending: false })
        .limit(500),
      supabase.from('post_reactions').select('post_id, profile_id, reaction').in('post_id', chunk).limit(2000),
    ]);
    likes.push(...((l.data as LikeRow[]) || []));
    replies.push(...((r.data as ReplyRow[]) || []));
    reactions.push(...((re.data as ReactionRow[]) || [])); // sem a tabela: só não mostra reações
  }

  // até 3 curtidas por post (as mais recentes) e a melhor resposta (mais curtida; empate → mais recente)
  const likersByPost = new Map<string, string[]>();
  for (const row of likes) {
    const list = likersByPost.get(row.post_id) || [];
    if (list.length < 3 && !list.includes(row.profile_id)) list.push(row.profile_id);
    likersByPost.set(row.post_id, list);
  }
  const topByPost = new Map<string, ReplyRow>();
  for (const row of replies) {
    const cur = topByPost.get(row.post_id);
    if (!cur || (row.likes_count || 0) > (cur.likes_count || 0)) topByPost.set(row.post_id, row);
  }

  const profileIds = new Set<string>();
  likersByPost.forEach((l) => l.forEach((id) => profileIds.add(id)));
  topByPost.forEach((r) => profileIds.add(r.profile_id));
  const profiles = new Map<string, MiniProfile>();
  const pidList = [...profileIds];
  for (let i = 0; i < pidList.length; i += 150) {
    const { data } = await supabase
      .from('profiles')
      .select('id, username, display_name, full_name, avatar_url')
      .in('id', pidList.slice(i, i + 150));
    for (const p of (data as { id: string; username: string; display_name: string | null; full_name: string | null; avatar_url: string | null }[]) || []) {
      profiles.set(p.id, { id: p.id, username: p.username, name: p.display_name || p.full_name || p.username, avatar_url: p.avatar_url });
    }
  }

  for (const [postId, cbs] of batch) {
    const likers = (likersByPost.get(postId) || []).map((id) => profiles.get(id)).filter(Boolean) as MiniProfile[];
    const top = topByPost.get(postId);
    const text = top ? replyText(top) : '';
    const author =
      top &&
      (profiles.get(top.profile_id) || {
        id: top.profile_id,
        username: top.author_handle || 'membro',
        name: top.author_name || top.author_handle || 'Membro do Insight',
        avatar_url: top.avatar_url,
      });
    const counts: Partial<Record<ReactionId, number>> = {};
    let mine: ReactionId | null = null;
    for (const r of reactions) {
      if (r.post_id !== postId || !REACTION_BY_ID.has(r.reaction)) continue;
      const id = r.reaction as ReactionId;
      counts[id] = (counts[id] || 0) + 1;
      if (viewer && r.profile_id === viewer) mine = id;
    }
    const social: PostSocial = {
      likers,
      topReply: top && author && text ? { id: top.id, author, text, likes: top.likes_count || 0, created_at: top.created_at } : null,
      reactions: counts,
      myReaction: mine,
    };
    cache.set(key(viewer, postId), social);
    for (const cb of cbs) cb(social);
  }
}

export function getPostSocial(postId: string, viewerId: string | null): Promise<PostSocial> {
  const hit = cache.get(key(viewerId, postId));
  if (hit) return Promise.resolve(hit);
  return new Promise((resolve) => {
    if (pending.size && pendingViewer !== viewerId) void flush();
    pendingViewer = viewerId;
    const list = pending.get(postId) || [];
    list.push(resolve);
    pending.set(postId, list);
    if (!timer) timer = setTimeout(() => void flush(), 40);
  });
}

/** Atualiza o cache (curtir/reagir) e avisa os cartões do mesmo post. */
export function patchPostSocial(postId: string, viewerId: string | null, fn: (s: PostSocial) => PostSocial) {
  const k = key(viewerId, postId);
  const next = fn(cache.get(k) || EMPTY);
  cache.set(k, next);
  listeners.get(postId)?.forEach((cb) => cb(next));
}

export function subscribePostSocial(postId: string, cb: (s: PostSocial) => void) {
  const set = listeners.get(postId) || new Set();
  set.add(cb);
  listeners.set(postId, set);
  return () => {
    set.delete(cb);
  };
}

/** Grava a reação de quem está logado (null remove). */
export async function setMyReaction(postId: string, profileId: string, reaction: ReactionId | null) {
  const supabase = createClient();
  if (!reaction) {
    return supabase.from('post_reactions').delete().eq('post_id', postId).eq('profile_id', profileId);
  }
  return supabase
    .from('post_reactions')
    .upsert({ post_id: postId, profile_id: profileId, reaction, created_at: new Date().toISOString() }, { onConflict: 'post_id,profile_id' });
}
