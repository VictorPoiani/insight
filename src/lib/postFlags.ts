'use client';

import { createClient } from '@/lib/supabase/client';

/**
 * Curtidas/reposts de quem está logado, buscados EM LOTE.
 *
 * Antes cada cartão de Insight fazia as próprias consultas ao montar (sessão,
 * perfil, curtida, repost) — dezenas de requisições num feed ou perfil. Aqui os
 * pedidos do mesmo instante viram 2 consultas com `in(...)`.
 */
type Flags = { liked: boolean; reposted: boolean };

let pending = new Map<string, ((f: Flags) => void)[]>();
let pendingProfile: string | null = null;
let timer: ReturnType<typeof setTimeout> | null = null;
const cache = new Map<string, Flags>(); // chave: profile:post

async function flush() {
  const batch = pending;
  const profileId = pendingProfile;
  pending = new Map();
  pendingProfile = null;
  timer = null;
  if (!profileId) return;
  const ids = [...batch.keys()];
  const supabase = createClient();
  const liked = new Set<string>();
  const reposted = new Set<string>();
  for (let i = 0; i < ids.length; i += 150) {
    const chunk = ids.slice(i, i + 150);
    const [likes, reposts] = await Promise.all([
      supabase.from('post_likes').select('post_id').eq('profile_id', profileId).in('post_id', chunk),
      supabase.from('post_reposts').select('post_id').eq('profile_id', profileId).in('post_id', chunk),
    ]);
    for (const r of likes.data || []) liked.add((r as { post_id: string }).post_id);
    for (const r of reposts.data || []) reposted.add((r as { post_id: string }).post_id);
  }
  for (const [id, cbs] of batch) {
    const f = { liked: liked.has(id), reposted: reposted.has(id) };
    cache.set(`${profileId}:${id}`, f);
    for (const cb of cbs) cb(f);
  }
}

export function getPostFlags(postId: string, profileId: string): Promise<Flags> {
  const hit = cache.get(`${profileId}:${postId}`);
  if (hit) return Promise.resolve(hit);
  return new Promise((resolve) => {
    if (pendingProfile && pendingProfile !== profileId) void flush();
    pendingProfile = profileId;
    const list = pending.get(postId) || [];
    list.push(resolve);
    pending.set(postId, list);
    if (!timer) timer = setTimeout(() => void flush(), 30);
  });
}

/** Atualiza o cache depois de curtir/repostar (evita mostrar estado antigo ao remontar). */
export function setPostFlag(postId: string, profileId: string, patch: Partial<Flags>) {
  const key = `${profileId}:${postId}`;
  const cur = cache.get(key) || { liked: false, reposted: false };
  cache.set(key, { ...cur, ...patch });
}
