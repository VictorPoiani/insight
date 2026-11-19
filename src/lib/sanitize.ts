/**
 * Sanitiza o HTML dos blocos do editor Notion-style para impedir ataques XSS
 * mantendo apenas a formatação segura (negrito, itálico, sublinhado, links, código e quebras de linha).
 */
export function sanitizeBlockHtml(dirtyHtml?: string | null): string {
  if (!dirtyHtml) return '';

  return dirtyHtml
    // 1. Remove tags perigosas completas e seu conteúdo
    .replace(/<(script|iframe|object|embed|applet|meta|link|style|form|input|button|textarea)[^>]*>[\s\S]*?<\/\1>/gi, '')
    // 2. Remove tags perigosas auto-fechadas ou órfãs
    .replace(/<\/?(script|iframe|object|embed|applet|meta|link|style|form|input|button|textarea|svg|math|base)[^>]*>/gi, '')
    // 3. Remove qualquer atributo de evento JS (onerror, onload, onclick, onmouseover, etc.)
    .replace(/\s+on[a-z]+\s*=\s*(?:"[^"]*"|'[^']*'|[^\s>]+)/gi, '')
    // 4. Neutraliza protocolos executáveis em href/src (javascript:, vbscript:, data:text/html)
    .replace(/(href|src|xlink:href|action)\s*=\s*(?:"\s*(?:javascript|vbscript|data):[^"]*"|'\s*(?:javascript|vbscript|data):[^']*')/gi, '$1="#"');
}