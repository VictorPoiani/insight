'use client';

import { useEffect, useState } from 'react';
import { createClient } from '@/lib/supabase/client';

/**
 * Quem eu silenciei ou bloqueei (uma consulta por sessão, compartilhada por
 * todos os cartões). Silenciar só esconde; bloquear também impede a pessoa de
 * seguir, responder e reagir (regras no banco, ver migração profile_blocks).
 */
export type BlockKind = 'mute' | 'block';

let state: { viewer: string | null; map: Map<string, BlockKind>; loaded: Promise<void> | null } = {
  viewer: null,
  map: new Map(),
  loaded: null,
};
const listeners = new Set<() => void>();
const emit = () => listeners.forEach((l) => l());

function ensure(viewerId: string | null) {
  if (state.viewer === viewerId && state.loaded) return state.loaded;
  state = { viewer: viewerId, map: new Map(), loaded: null };
  if (!viewerId) {
    state.loaded = Promise.resolve();
    return state.loaded;
  }
  state.loaded = (async () => {
    const { data } = await createClient().from('profile_blocks').select('blocked_id, kind').eq('blocker_id', viewerId);
    for (const r of (data as { blocked_id: string; kind: BlockKind }[] | null) || []) state.map.set(r.blocked_id, r.kind);
    emit();
  })();
  return state.loaded;
}

/** Mapa (id do perfil → mute/block) de quem está logado; atualiza sozinho. */
export function useMyBlocks(viewerId: string | null) {
  const [, force] = useState(0);
  useEffect(() => {
    const l = () => force((n) => n + 1);
    listeners.add(l);
    void ensure(viewerId);
    return () => {
      listeners.delete(l);
    };
  }, [viewerId]);
  return state.viewer === viewerId ? state.map : new Map<string, BlockKind>();
}

/** Silenciar, bloquear ou desfazer (kind = null). */
export async function setProfileBlock(viewerId: string, targetId: string, kind: BlockKind | null) {
  const prev = state.map.get(targetId) ?? null;
  if (kind) state.map.set(targetId, kind);
  else state.map.delete(targetId);
  emit();
  const { error } = await createClient().rpc('set_profile_block', { p_target: targetId, p_kind: kind });
  if (error) {
    if (prev) state.map.set(targetId, prev);
    else state.map.delete(targetId);
    emit();
    return false;
  }
  if (kind === 'block') window.dispatchEvent(new CustomEvent('insight:follows-changed'));
  return true;
}
