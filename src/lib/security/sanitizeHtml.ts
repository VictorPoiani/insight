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
