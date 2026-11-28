'use client';

import { createContext, useContext, useEffect, useMemo, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { useNitro } from '@/components/nitro/NitroProvider';

/**
 * Status online automático.
 *
 * - Sem canal de tempo real: com milhares de visitantes ele estourava as
 *   conexões e mensagens do Supabase Realtime. Online = visto nos últimos 3 min.
 * - "Visto por último": enquanto a aba está aberta e visível, o perfil grava
 *   last_seen_at a cada minuto (RPC touch_presence, com trava de 45 s no banco).
 * - Aba escondida não grava batimento, então em ~3 min a pessoa sai de "online".
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
  // sem canal de tempo real (não escala no plano do Supabase): online = visto nos últimos 3 min
  const [onlineIds] = useState<Set<string>>(() => new Set());
  const visible = viewer ? (viewer as { presence_visible?: boolean }).presence_visible !== false : false;
  const meId = viewer?.id ?? null;

  // batimento do "visto por último" + ausência quando a aba fica escondida
  useEffect(() => {
    if (!meId || !visible) return;
    const beat = () => {
      // .then() dispara a requisição (o construtor do supabase-js é preguiçoso)
      if (document.visibilityState === 'visible') void supabase.rpc('touch_presence').then(() => {});
    };
    beat();
    const interval = setInterval(beat, 60_000);
    const onVis = () => {
      if (document.visibilityState === 'visible') beat();
    };
    document.addEventListener('visibilitychange', onVis);
    return () => {
      clearInterval(interval);
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
