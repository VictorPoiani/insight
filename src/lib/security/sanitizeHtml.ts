import DOMPurify from 'isomorphic-dompurify';

/**
 * Sanitizador único para HTML vindo de usuários (blocos de Insights, tópicos,
 * atualizações). Antes havia um filtro por regex que deixava passar, por
 * exemplo, `<img src="x"/onerror="...">` e `href="jav&#x61;script:..."`.
 *
 * DOMPurify interpreta o HTML como o navegador faz e mantém só o que está na
 * lista branca abaixo (o que o editor de blocos produz).
 */
const ALLOWED_TAGS = [
  'p', 'br', 'div', 'span', 'b', 'strong', 'i', 'em', 'u', 's', 'strike', 'del', 'mark',
  'sub', 'sup', 'small', 'code', 'pre', 'kbd', 'blockquote', 'ul', 'ol', 'li',
  'h1', 'h2', 'h3', 'h4', 'a', 'font', 'hr',
];
const ALLOWED_ATTR = ['href', 'title', 'style', 'class', 'color', 'target', 'rel', 'data-mention'];
const SAFE_URL = /^(?:https?:|mailto:|\/(?!\/)|#)/i;

let hooked = false;
function ensureHooks() {
  if (hooked) return;
  hooked = true;
  DOMPurify.addHook('afterSanitizeAttributes', (node) => {
    if (node.nodeName === 'A') {
      const href = node.getAttribute('href') || '';
      if (!SAFE_URL.test(href.trim())) node.removeAttribute('href');
      if (node.getAttribute('target') === '_blank' || /^https?:/i.test(href)) {
        node.setAttribute('target', '_blank');
        node.setAttribute('rel', 'noopener noreferrer nofollow');
      }
    }
    // CSS inline: só cores/estilo de texto do editor; nada de url(), posição ou expressões
    const style = node.getAttribute?.('style');
    if (style && /url\s*\(|expression\s*\(|position\s*:|@import|behavior\s*:/i.test(style)) {
      node.removeAttribute('style');
    }
  });
}

export function sanitizeUserHtml(dirty?: string | null): string {
  if (!dirty) return '';
  ensureHooks();
  return DOMPurify.sanitize(dirty, {
    ALLOWED_TAGS,
    ALLOWED_ATTR,
    ALLOW_DATA_ATTR: false,
    ALLOWED_URI_REGEXP: SAFE_URL,
  });
}

/**
 * Transforma "@usuario" em link para o perfil nos trechos de texto de um HTML já
 * sanitizado (ignora o que já está dentro de <a>, <code> e <pre>).
 */
export function linkifyMentionsHtml(html: string): string {
  if (!html || !html.includes('@')) return html;
  let skip = 0;
  return html
    .split(/(<[^>]+>)/g)
    .map((part) => {
      if (part.startsWith('<')) {
        const m = /^<(\/?)(a|code|pre)\b/i.exec(part);
        if (m) skip = Math.max(0, skip + (m[1] ? -1 : 1));
        return part;
      }
      if (skip > 0 || !part.includes('@')) return part;
      return part.replace(
        /(^|[^\w@/.&])@([A-Za-z0-9_](?:[A-Za-z0-9_.]{0,28}[A-Za-z0-9_])?)/g,
        (_all, pre: string, handle: string) =>
          `${pre}<a href="/u/${handle}" data-mention="${handle}" class="mention-link">@${handle}</a>`
      );
    })
    .join('');
}
