/**
 * Endereço público do site, sempre com https:// e sem barra no fim.
 * Aceita NEXT_PUBLIC_SITE_URL em qualquer formato ("www.insight.app.br",
 * com aspas, com barra...) e cai no domínio oficial se vier inválido.
 */
const FALLBACK = 'https://www.insight.app.br';

export function publicSiteUrl(): string {
  let raw = (process.env.NEXT_PUBLIC_SITE_URL || '').trim().replace(/^["']|["']$/g, '').replace(/\/+$/, '');
  if (!raw) return FALLBACK;
  if (!/^https?:\/\//i.test(raw)) raw = `https://${raw}`;
  try {
    const u = new URL(raw);
    // localhost não serve como endereço público (metadados, sitemap)
    if (/^(localhost|127\.0\.0\.1)$/.test(u.hostname)) return FALLBACK;
    return u.origin;
  } catch {
    return FALLBACK;
  }
}
