'use client';

import { useEffect, useState } from 'react';

/** A assinatura (Mercado Pago) está aberta? Lido do servidor uma vez por carga. */
let cache: Promise<boolean> | null = null;

export function useNitroBilling() {
  const [enabled, setEnabled] = useState(false);
  const [ready, setReady] = useState(false);
  useEffect(() => {
    let alive = true;
    cache ??= fetch('/api/nitro/checkout', { method: 'GET', cache: 'no-store' })
      .then((r) => (r.ok ? r.json() : { enabled: false }))
      .then((d) => Boolean(d?.enabled))
      .catch(() => false);
    cache.then((v) => {
      if (!alive) return;
      setEnabled(v);
      setReady(true);
    });
    return () => {
      alive = false;
    };
  }, []);
  return { enabled, ready };
}
