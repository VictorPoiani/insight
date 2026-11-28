'use client';

import { useEffect, useRef } from 'react';

/** Ponto no fim de uma lista: quando chega perto da tela, pede a próxima página. */
export function LoadMoreSentinel({ onVisible, loading, children }: { onVisible: () => void; loading?: boolean; children?: React.ReactNode }) {
  const ref = useRef<HTMLDivElement>(null);
  const cb = useRef(onVisible);
  cb.current = onVisible;
  useEffect(() => {
    const el = ref.current;
    if (!el || typeof IntersectionObserver === 'undefined') return;
    const io = new IntersectionObserver((e) => e.some((x) => x.isIntersecting) && cb.current(), { rootMargin: '800px 0px' });
    io.observe(el);
    return () => io.disconnect();
  }, []);
  return (
    <div ref={ref} className="py-8 flex justify-center" aria-live="polite">
      {loading && children}
    </div>
  );
}
