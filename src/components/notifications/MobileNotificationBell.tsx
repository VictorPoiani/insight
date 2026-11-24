'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Bell } from '@/components/icons';
import { createClient } from '@/lib/supabase/client';
import { useNitro } from '@/components/nitro/NitroProvider';

/** Sino de notificações no topo do celular, com contador em tempo real. */
export function MobileNotificationBell() {
  const supabase = useMemo(() => createClient(), []);
  const { viewer } = useNitro();
  const pathname = usePathname();
  const [count, setCount] = useState(0);
  const meId = viewer?.id ?? null;

  const refresh = useCallback(async () => {
    if (!meId) {
      setCount(0);
      return;
    }
    const { count: c } = await supabase
      .from('notifications')
      .select('id', { count: 'exact', head: true })
      .eq('recipient_id', meId)
      .eq('is_read', false);
    setCount(c || 0);
  }, [meId, supabase]);

  useEffect(() => {
    void refresh();
  }, [refresh, pathname]);

  useEffect(() => {
    window.addEventListener('insight-notifications-updated', refresh);
    if (!meId) return () => window.removeEventListener('insight-notifications-updated', refresh);
    const channel = supabase
      .channel(`mobile-bell-${meId}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'notifications', filter: `recipient_id=eq.${meId}` }, () => void refresh())
      .subscribe();
    return () => {
      window.removeEventListener('insight-notifications-updated', refresh);
      void supabase.removeChannel(channel);
    };
  }, [meId, refresh, supabase]);

  if (!meId) return null;
  const active = pathname.startsWith('/notificacoes');
  return (
    <Link
      href="/notificacoes"
      aria-label={count > 0 ? `Notificações (${count} novas)` : 'Notificações'}
      className={`relative p-2 rounded-full transition-colors ${active ? 'text-accent' : 'text-secondary hover:text-primary hover:bg-surface'}`}
    >
      <Bell className="w-5 h-5" />
      {count > 0 && (
        <span className="absolute top-0.5 right-0.5 min-w-[17px] h-[17px] px-1 rounded-full bg-accent text-white text-[10px] font-black leading-[17px] text-center ring-2 ring-background">
          {count > 99 ? '99+' : count}
        </span>
      )}
    </Link>
  );
}
