'use client';

import { useEffect, useRef } from 'react';

/**
 * Roda `fn` de tempos em tempos só com a aba visível, e de novo quando a pessoa
 * volta para a aba. Reserva para o tempo real (que pode não estar ligado na
 * tabela) sem pesar: aba em segundo plano não faz consulta.
 */
export function useVisiblePolling(fn: () => void, ms: number, enabled = true) {
  const cb = useRef(fn);
  cb.current = fn;
  useEffect(() => {
    if (!enabled) return;
    const tick = () => {
      if (document.visibilityState === 'visible') cb.current();
    };
    const t = setInterval(tick, ms);
    document.addEventListener('visibilitychange', tick);
    window.addEventListener('focus', tick);
    return () => {
      clearInterval(t);
      document.removeEventListener('visibilitychange', tick);
      window.removeEventListener('focus', tick);
    };
  }, [ms, enabled]);
}
