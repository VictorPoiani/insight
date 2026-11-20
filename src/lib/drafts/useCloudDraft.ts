'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { createClient } from '@/lib/supabase/client';

/**
 * Rascunho com salvamento automático: espelho local imediato (sobrevive a
 * aba fechada/offline) + nuvem (tabela `drafts`, RLS só do dono) com debounce.
 * Ao abrir, carrega o mais recente dos dois.
 *
 * scope: "post:new", "post:edit:<id>", "update:new", "reply:<postId>:<parentId|root>"
 */

export type DraftStatus = 'idle' | 'saving' | 'saved' | 'local' | 'error';

interface Stored<T> {
  v: T;
  at: number;
}

const DEBOUNCE_MS = 1400;

function cleanScope(scope: string) {
  return scope
    .split(':')
    .map((p, i) => (i === 0 ? p.toLowerCase().replace(/[^a-z]/g, '') : p.replace(/[^A-Za-z0-9_-]/g, '').slice(0, 64)))
    .filter(Boolean)
    .slice(0, 4)
    .join(':');
}

export function useCloudDraft<T>(
  rawScope: string | null,
  profileId: string | null | undefined,
  isEmpty: (value: T) => boolean
) {
  const supabase = useMemo(() => createClient(), []);
  const scope = rawScope ? cleanScope(rawScope) : null;
  const localKey = scope && profileId ? `insight-draft:${profileId}:${scope}` : null;

  const [ready, setReady] = useState(false);
  const [loaded, setLoaded] = useState<Stored<T> | null>(null);
  const [status, setStatus] = useState<DraftStatus>('idle');
  const [savedAt, setSavedAt] = useState<number | null>(null);

  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pending = useRef<Stored<T> | null>(null);
  const isEmptyRef = useRef(isEmpty);
  isEmptyRef.current = isEmpty;

  // carrega (local e nuvem; vence o mais novo)
  useEffect(() => {
    setReady(false);
    setLoaded(null);
    if (!scope || !profileId || !localKey) {
      setReady(true);
      return;
    }
    let active = true;
    let local: Stored<T> | null = null;
    try {
      const raw = localStorage.getItem(localKey);
      if (raw) local = JSON.parse(raw);
    } catch {
      local = null;
    }
    supabase
      .from('drafts')
      .select('payload, updated_at')
      .eq('profile_id', profileId)
      .eq('scope', scope)
      .maybeSingle()
      .then(({ data }) => {
        if (!active) return;
        const cloud = data?.payload as Stored<T> | undefined;
        const best = [local, cloud].filter(Boolean).sort((a, b) => (b!.at || 0) - (a!.at || 0))[0] || null;
        setLoaded(best && !isEmptyRef.current(best.v) ? best : null);
        if (best) setSavedAt(best.at);
        setReady(true);
      });
    return () => {
      active = false;
    };
  }, [scope, profileId, localKey, supabase]);

  const pushCloud = useCallback(async () => {
    const item = pending.current;
    if (!item || !scope || !profileId) return;
    pending.current = null;
    setStatus('saving');
    const { error } = await supabase
      .from('drafts')
      .upsert({ profile_id: profileId, scope, payload: item }, { onConflict: 'profile_id,scope' });
    if (error) {
      setStatus(navigator.onLine ? 'error' : 'local');
      pending.current = pending.current || item; // tenta de novo na próxima mudança/volta da rede
    } else {
      setStatus('saved');
      setSavedAt(item.at);
    }
  }, [profileId, scope, supabase]);

  const removeEverywhere = useCallback(async () => {
    if (timer.current) clearTimeout(timer.current);
    pending.current = null;
    if (localKey) {
      try {
        localStorage.removeItem(localKey);
      } catch {
        // ignora
      }
    }
    if (scope && profileId) {
      await supabase.from('drafts').delete().eq('profile_id', profileId).eq('scope', scope);
    }
    setStatus('idle');
    setSavedAt(null);
  }, [localKey, profileId, scope, supabase]);

  /** Chame a cada mudança do conteúdo (depois de `ready`). */
  const save = useCallback(
    (value: T) => {
      if (!ready || !localKey) return;
      if (isEmptyRef.current(value)) {
        if (savedAt) void removeEverywhere();
        return;
      }
      const item: Stored<T> = { v: value, at: Date.now() };
      try {
        localStorage.setItem(localKey, JSON.stringify(item));
      } catch {
        // cota cheia: segue só com a nuvem
      }
      setStatus('local');
      pending.current = item;
      if (timer.current) clearTimeout(timer.current);
      timer.current = setTimeout(() => void pushCloud(), DEBOUNCE_MS);
    },
    [localKey, pushCloud, ready, removeEverywhere, savedAt]
  );

  // envia o pendente ao sair da aba / voltar a rede
  useEffect(() => {
    const flush = () => {
      if (pending.current) void pushCloud();
    };
    const onVis = () => document.visibilityState === 'hidden' && flush();
    document.addEventListener('visibilitychange', onVis);
    window.addEventListener('online', flush);
    return () => {
      document.removeEventListener('visibilitychange', onVis);
      window.removeEventListener('online', flush);
      flush();
    };
  }, [pushCloud]);

  return { ready, loaded, status, savedAt, save, clear: removeEverywhere };
}

export function draftStatusLabel(status: DraftStatus, savedAt: number | null): string | null {
  const time = savedAt ? new Date(savedAt).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }) : '';
  switch (status) {
    case 'saving':
      return 'Salvando rascunho…';
    case 'saved':
      return `Rascunho salvo na nuvem${time ? ` · ${time}` : ''}`;
    case 'local':
      return 'Rascunho salvo neste aparelho';
    case 'error':
      return 'Rascunho salvo só neste aparelho (sem conexão com a nuvem)';
    default:
      return null;
  }
}
