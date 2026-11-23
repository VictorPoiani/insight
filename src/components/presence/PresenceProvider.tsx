'use client';

import { createContext, useContext, useEffect, useMemo, useRef, useState } from 'react';
import type { RealtimeChannel } from '@supabase/supabase-js';
import { createClient } from '@/lib/supabase/client';
import { useNitro } from '@/components/nitro/NitroProvider';

/**
 * Status online automático.
 *
 * - Tempo real: todo mundo com o site aberto entra no canal de presença do
 *   Supabase Realtime; quem está logado (e visível) se anuncia nele. A bolinha
 *   verde aparece/some na hora, sem recarregar.
 * - "Visto por último": enquanto a aba está aberta e visível, o perfil grava
 *   last_seen_at a cada minuto (RPC touch_presence, com trava de 45 s no banco).
 * - Aba escondida por mais de 3 min conta como ausente (sai do canal).
 */

/** Sem sinal em tempo real, considera online quem foi visto nos últimos 3 min. */
export const ONLINE_WINDOW_MS = 3 * 60_000;

interface PresenceValue {
  onlineIds: Set<string>;
  /** online agora (tempo real) ou visto há pouco */
  isOnline: (profileId: string | null | undefined, lastSeenAt?: string | null) => boolean;
}

const PresenceContext = createContext<PresenceValue>({
  onlineIds: new Set(),
  isOnline: () => false,
});

export function usePresence() {
  return useContext(PresenceContext);
}

export function PresenceProvider({ children }: { children: React.ReactNode }) {
  const supabase = useMemo(() => createClient(), []);
  const { viewer } = useNitro();
  const [onlineIds, setOnlineIds] = useState<Set<string>>(new Set());
  const channelRef = useRef<RealtimeChannel | null>(null);
  const trackedRef = useRef(false);
  const visible = viewer ? (viewer as { presence_visible?: boolean }).presence_visible !== false : false;
  const meId = viewer?.id ?? null;

  // canal de presença (todos assistem; logados visíveis se anunciam)
  useEffect(() => {
    const channel = supabase.channel('insight-online', { config: { presence: { key: meId || `anon-${Math.random().toString(36).slice(2)}` } } });
    channelRef.current = channel;
    const sync = () => {
      const state = channel.presenceState<{ profile_id?: string }>();
      const ids = new Set<string>();
      for (const metas of Object.values(state)) for (const m of metas) if (m.profile_id) ids.add(m.profile_id);
      setOnlineIds(ids);
    };
    channel.on('presence', { event: 'sync' }, sync).subscribe(async (status) => {
      if (status === 'SUBSCRIBED' && meId && visible && document.visibilityState === 'visible') {
        await channel.track({ profile_id: meId, at: Date.now() });
        trackedRef.current = true;
      }
    });
    return () => {
      trackedRef.current = false;
      void supabase.removeChannel(channel);
      channelRef.current = null;
    };
  }, [supabase, meId, visible]);

  // batimento do "visto por último" + ausência quando a aba fica escondida
  useEffect(() => {
    if (!meId || !visible) return;
    let hiddenTimer: ReturnType<typeof setTimeout> | null = null;
    const beat = () => {
      if (document.visibilityState === 'visible') void supabase.rpc('touch_presence');
    };
    beat();
    const interval = setInterval(beat, 60_000);
    const onVis = () => {
      const ch = channelRef.current;
      if (document.visibilityState === 'visible') {
        if (hiddenTimer) clearTimeout(hiddenTimer);
        beat();
        if (ch && !trackedRef.current) {
          void ch.track({ profile_id: meId, at: Date.now() });
          trackedRef.current = true;
        }
      } else {
        hiddenTimer = setTimeout(() => {
          if (ch && trackedRef.current) {
            void ch.untrack();
            trackedRef.current = false;
          }
        }, 3 * 60_000);
      }
    };
    document.addEventListener('visibilitychange', onVis);
    return () => {
      clearInterval(interval);
      if (hiddenTimer) clearTimeout(hiddenTimer);
      document.removeEventListener('visibilitychange', onVis);
    };
  }, [supabase, meId, visible]);

  const value = useMemo<PresenceValue>(
    () => ({
      onlineIds,
      isOnline: (id, lastSeenAt) => {
        if (!id) return false;
        if (onlineIds.has(id)) return true;
        if (id === meId && visible) return true;
        return Boolean(lastSeenAt && Date.now() - new Date(lastSeenAt).getTime() < ONLINE_WINDOW_MS);
      },
    }),
    [onlineIds, meId, visible]
  );

  return <PresenceContext.Provider value={value}>{children}</PresenceContext.Provider>;
}

/** Bolinha verde sobre o avatar (posicione o pai com `relative`). */
export function OnlineDot({
  profileId,
  lastSeenAt,
  size = 10,
  className = '',
}: {
  profileId: string | null | undefined;
  lastSeenAt?: string | null;
  size?: number;
  className?: string;
}) {
  const { isOnline } = usePresence();
  if (!isOnline(profileId, lastSeenAt)) return null;
  return (
    <span
      role="img"
      aria-label="Online agora"
      title="Online agora"
      style={{ width: size, height: size }}
      className={`absolute bottom-0 right-0 rounded-full bg-emerald-500 ring-2 ring-[var(--background)] ${className}`}
    />
  );
}

/** "visto há 5 min", "visto ontem às 21:04"... */
export function lastSeenLabel(iso: string | null | undefined): string {
  if (!iso) return 'Offline';
  const t = new Date(iso).getTime();
  const diff = Math.max(0, Date.now() - t);
  const min = Math.floor(diff / 60_000);
  if (min < 60) return `Visto há ${Math.max(1, min)} min`;
  const h = Math.floor(min / 60);
  if (h < 24) return `Visto há ${h} h`;
  const d = new Date(iso);
  const days = Math.floor(h / 24);
  if (days === 1) return `Visto ontem às ${d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}`;
  if (days < 7) return `Visto há ${days} dias`;
  return `Visto em ${d.toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' })}`;
}
