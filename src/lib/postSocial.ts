'use client';

import { createClient } from '@/lib/supabase/client';

/**
 * Contexto social de cada Insight no feed, buscado EM LOTE (como postFlags):
 * quem curtiu, a resposta em destaque e as reações. Os cartões que montam no
 * mesmo instante viram poucas consultas com `in(...)`.
 */

// reação = o próprio emoji (qualquer um). Estes cinco são os padrões do seletor.
export const DEFAULT_REACTIONS = [
  { emoji: '💡', label: 'Boa ideia' },
  { emoji: '🔥', label: 'Incrível' },
  { emoji: '😂', label: 'Engraçado' },
  { emoji: '🤔', label: 'Me fez pensar' },
  { emoji: '😮', label: 'Uau' },
] as const;
export type ReactionId = string;
export const REACTION_LABEL = new Map<string, string>(DEFAULT_REACTIONS.map((r) => [r.emoji, r.label]));

/** Emoji válido como reação (o banco confere de novo). */
export function isReactionEmoji(v: string) {
  return v.length > 0 && v.length <= 16 && !/[A-Za-z0-9<>&"'\s]/.test(v);
}

// últimos emojis usados neste aparelho (aparecem no seletor)
const RECENT_KEY = 'insight:recent-reactions';
export function recentReactions(): string[] {
  try {
    const v = JSON.parse(localStorage.getItem(RECENT_KEY) || '[]');
    return Array.isArray(v) ? v.filter((x) => typeof x === 'string' && isReactionEmoji(x)).slice(0, 16) : [];
  } catch {
    return [];
  }
}
export function rememberReaction(emoji: string) {
  try {
    const next = [emoji, ...recentReactions().filter((e) => e !== emoji)].slice(0, 16);
    localStorage.setItem(RECENT_KEY, JSON.stringify(next));
  } catch {
    /* modo privado */
  }
}

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
  /** emoji → quantidade */
  reactions: Record<string, number>;
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


async function flush() {
  const batch = pending;
  const viewer = pendingViewer;
  pending = new Map();
  pendingViewer = null;
  timer = null;
  const ids = [...batch.keys()];
  if (!ids.length) return;
  const supabase = createClient();

  // uma chamada já resumida no banco (post_social_batch): 3 curtidas, resposta
  // em destaque e contagem de reações por post
  type Row = {
    likers: MiniProfile[];
    topReply: (Omit<TopReply, 'text'> & { text: string; has_media?: boolean }) | null;
    reactions: Record<string, number>;
    myReaction: string | null;
  };
  const rows: Record<string, Row> = {};
  for (let i = 0; i < ids.length; i += 100) {
    const { data } = await supabase.rpc('post_social_batch', { p_ids: ids.slice(i, i + 100) });
    Object.assign(rows, (data as Record<string, Row> | null) || {});
  }

  for (const [postId, cbs] of batch) {
    const r = rows[postId];
    const top = r?.topReply;
    const text = top ? (top.text || (top.has_media ? 'enviou uma mídia' : '')).replace(/\s+/g, ' ').trim() : '';
    const reactions: Record<string, number> = {};
    for (const [emoji, n] of Object.entries(r?.reactions || {})) if (isReactionEmoji(emoji) && n > 0) reactions[emoji] = n;
    const social: PostSocial = {
      likers: r?.likers || [],
      topReply: top && text ? { id: top.id, author: top.author, text, likes: top.likes || 0, created_at: top.created_at } : null,
      reactions,
      myReaction: viewer && r?.myReaction && isReactionEmoji(r.myReaction) ? r.myReaction : null,
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
