'use client';

import { useEffect } from 'react';
import { createClient } from '@/lib/supabase/client';

const FLUSH_MS = 60_000;
const IDLE_MS = 2 * 60_000;

/**
 * Mede o uso do próprio usuário (tempo de tela ativo, posts vistos, vídeos
 * assistidos) e soma no banco a cada minuto. Só conta com a aba visível e
 * com interação nos últimos 2 minutos.
 */
export function ActivityTracker() {
  useEffect(() => {
    const supabase = createClient();
    let signedIn = false;
    void supabase.auth.getSession().then(({ data }) => {
      signedIn = Boolean(data.session);
    });
    const { data: authSub } = supabase.auth.onAuthStateChange((_e, session) => {
      signedIn = Boolean(session);
    });
    let seconds = 0;
    let views = 0;
    let videos = 0;
    let lastInput = Date.now();
    let lastTick = Date.now();
    const seen = new Set<string>();
    // ids vistos ainda não enviados (contador de visualizações de cada post)
    let viewedIds: string[] = [];

    const touch = () => {
      lastInput = Date.now();
    };
    const tick = () => {
      const now = Date.now();
      const active = document.visibilityState === 'visible' && now - lastInput < IDLE_MS;
      if (active) seconds += Math.min(5, Math.round((now - lastTick) / 1000));
      lastTick = now;
    };
    const flush = () => {
      tick();
      if (signedIn && viewedIds.length) {
        const ids = viewedIds.slice(0, 100);
        viewedIds = viewedIds.slice(100);
        void supabase.rpc('record_post_views', { p_ids: ids });
      }
      if (!signedIn || (seconds < 1 && !views && !videos)) return;
      const payload = { p_seconds: seconds, p_views: views, p_videos: videos };
      seconds = 0;
      views = 0;
      videos = 0;
      void supabase.rpc('track_activity', payload);
    };

    // post visto = pelo menos metade dele na tela por 1,5 s
    const timers = new Map<Element, number>();
    const io = new IntersectionObserver(
      (entries) => {
        for (const e of entries) {
          const id = (e.target as HTMLElement).dataset.postView;
          if (!id || seen.has(id)) continue;
          if (e.isIntersecting) {
            timers.set(
              e.target,
              window.setTimeout(() => {
                seen.add(id);
                views++;
                viewedIds.push(id);
              }, 1500)
            );
          } else {
            window.clearTimeout(timers.get(e.target));
          }
        }
      },
      { threshold: 0.5 }
    );
    const observeAll = (root: ParentNode) => root.querySelectorAll('[data-post-view]').forEach((el) => io.observe(el));
    observeAll(document);
    const mo = new MutationObserver((muts) => {
      for (const m of muts)
        m.addedNodes.forEach((n) => {
          if (n instanceof HTMLElement) {
            if (n.dataset.postView) io.observe(n);
            observeAll(n);
          }
        });
    });
    mo.observe(document.body, { childList: true, subtree: true });

    const onActivity = (e: Event) => {
      if ((e as CustomEvent<{ kind?: string }>).detail?.kind === 'video') videos++;
    };
    const onHide = () => document.visibilityState === 'hidden' && flush();

    const tickId = window.setInterval(tick, 5_000);
    const flushId = window.setInterval(flush, FLUSH_MS);
    const opts = { passive: true, capture: true } as const;
    ['pointerdown', 'keydown', 'wheel', 'touchstart', 'scroll'].forEach((ev) => window.addEventListener(ev, touch, opts));
    window.addEventListener('insight-activity', onActivity);
    document.addEventListener('visibilitychange', onHide);

    return () => {
      flush();
      authSub.subscription.unsubscribe();
      window.clearInterval(tickId);
      window.clearInterval(flushId);
      ['pointerdown', 'keydown', 'wheel', 'touchstart', 'scroll'].forEach((ev) => window.removeEventListener(ev, touch, opts));
      window.removeEventListener('insight-activity', onActivity);
      document.removeEventListener('visibilitychange', onHide);
      io.disconnect();
      mo.disconnect();
      timers.forEach((t) => window.clearTimeout(t));
    };
  }, []);

  return null;
}
