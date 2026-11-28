'use client';

import { useEffect, useRef } from 'react';

type TurnstileApi = {
  render: (el: HTMLElement, opts: Record<string, unknown>) => string;
  remove: (id: string) => void;
};
declare global {
  interface Window {
    turnstile?: TurnstileApi;
  }
}

/** Chave pública do Turnstile; sem ela, o CAPTCHA fica desligado. */
export const TURNSTILE_SITE_KEY = process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY || '';

let scriptLoading: Promise<void> | null = null;
function loadScript() {
  if (window.turnstile) return Promise.resolve();
  scriptLoading ??= new Promise<void>((resolve, reject) => {
    const s = document.createElement('script');
    s.src = 'https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit';
    s.async = true;
    s.onload = () => resolve();
    s.onerror = () => {
      scriptLoading = null;
      reject(new Error('turnstile'));
    };
    document.head.appendChild(s);
  });
  return scriptLoading;
}

/**
 * Verificação anti-robô (Cloudflare Turnstile). Quase sempre passa sozinha, sem
 * desafio. O token vai junto do login/cadastro e o Supabase Auth confere.
 * Cada token vale uma vez: troque a `key` do componente para pedir outro.
 */
export function Turnstile({ onToken, theme = 'auto' }: { onToken: (token: string | null) => void; theme?: 'light' | 'dark' | 'auto' }) {
  const ref = useRef<HTMLDivElement>(null);
  const cb = useRef(onToken);
  cb.current = onToken;

  useEffect(() => {
    if (!TURNSTILE_SITE_KEY) return;
    let id: string | null = null;
    let alive = true;
    loadScript()
      .then(() => {
        if (!alive || !ref.current || !window.turnstile) return;
        id = window.turnstile.render(ref.current, {
          sitekey: TURNSTILE_SITE_KEY,
          theme,
          language: 'pt-br',
          callback: (t: string) => cb.current(t),
          'expired-callback': () => cb.current(null),
          'error-callback': () => cb.current(null),
        });
      })
      .catch(() => cb.current(null));
    return () => {
      alive = false;
      if (id && window.turnstile) window.turnstile.remove(id);
    };
  }, [theme]);

  if (!TURNSTILE_SITE_KEY) return null;
  return <div ref={ref} className="flex justify-center min-h-[65px]" />;
}
