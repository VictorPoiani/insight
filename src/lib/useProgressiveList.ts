'use client';

import { useEffect, useRef, useState } from 'react';

/**
 * Renderiza listas longas aos poucos: começa com `initial` itens e adiciona
 * `step` quando o sentinela chega perto da tela. Reduz muito o trabalho do
 * celular ao abrir feeds e perfis com dezenas de Insights.
 */
export function useProgressiveList<T>(items: T[], initial = 8, step = 8, resetKey?: unknown) {
  const [count, setCount] = useState(initial);
  const sentinelRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => setCount(initial), [resetKey, initial]);

  useEffect(() => {
    const el = sentinelRef.current;
    if (!el || count >= items.length || typeof IntersectionObserver === 'undefined') return;
    const io = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting)) setCount((c) => Math.min(items.length, c + step));
      },
      { rootMargin: '1200px 0px' }
    );
    io.observe(el);
    return () => io.disconnect();
  }, [count, items.length, step]);

  return { visible: items.slice(0, count), hasMore: count < items.length, sentinelRef };
}
