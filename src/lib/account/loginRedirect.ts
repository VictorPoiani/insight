/** Link para o login que volta para a página atual depois de entrar. */
export function loginHref(): string {
  if (typeof window === 'undefined') return '/login';
  const here = window.location.pathname + window.location.search;
  return here.startsWith('/login') ? '/login' : `/login?next=${encodeURIComponent(here)}`;
}

/** Destino seguro pós-login: só caminhos internos (bloqueia //host e esquemas). */
export function safeNext(raw: string | null | undefined): string | null {
  if (!raw) return null;
  if (!raw.startsWith('/') || raw.startsWith('//') || raw.startsWith('/\\')) return null;
  if (/[\r\n]/.test(raw)) return null;
  return raw;
}
