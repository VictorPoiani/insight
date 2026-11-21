/** Peças comuns das imagens de compartilhamento (posts e perfis). */

type Weight = 500 | 700 | 800;
let fontCache: { name: string; data: ArrayBuffer; weight: Weight }[] | null = null;

export async function loadFonts() {
  if (fontCache) return fontCache;
  try {
    const css = await fetch('https://fonts.googleapis.com/css2?family=Inter:wght@500;700;800&display=swap', {
      // user-agent antigo => o Google entrega TTF (o gerador não lê WOFF2)
      headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 6.1) AppleWebKit/534.30 (KHTML, like Gecko) Safari/534.30' },
    }).then((r) => r.text());
    // só o subconjunto "latin" de cada peso (inclui acentos do português)
    const blocks = [...css.matchAll(/\/\* latin \*\/\s*@font-face\s*{[^}]*?font-weight:\s*(\d+);[^}]*?src:\s*url\(([^)]+)\)/g)];
    const fonts = await Promise.all(
      blocks.map(async ([, w, url]) => ({
        name: 'Inter',
        weight: Number(w) as Weight,
        data: await fetch(url).then((r) => r.arrayBuffer()),
      }))
    );
    fontCache = fonts.length ? fonts : [];
  } catch {
    fontCache = [];
  }
  return fontCache;
}

/** Busca uma imagem e devolve data URL só se for PNG/JPEG (o gerador não lê WebP). */
export async function toDataUrl(url: string | null | undefined): Promise<string | null> {
  const testHttp = process.env.SHARE_TEST_HTTP === '1' && /^http:\/\/localhost:/.test(url || '');
  if (!url || (!/^https:\/\//.test(url) && !testHttp)) return null;
  try {
    const ctrl = new AbortController();
    const t = setTimeout(() => ctrl.abort(), 3500);
    const res = await fetch(url, { signal: ctrl.signal });
    clearTimeout(t);
    if (!res.ok) return null;
    const type = (res.headers.get('content-type') || '').split(';')[0].trim();
    if (!/^image\/(png|jpe?g)$/.test(type)) return null;
    const buf = Buffer.from(await res.arrayBuffer());
    if (buf.length > 4 * 1024 * 1024) return null;
    return `data:${type};base64,${buf.toString('base64')}`;
  } catch {
    return null;
  }
}

export function plain(html?: string | null) {
  return (html || '')
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/(p|div|li|h\d)>/gi, '\n')
    .replace(/<[^>]+>/g, '')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

export function clip(text: string, max: number) {
  if (text.length <= max) return text;
  const cut = text.slice(0, max);
  return cut.slice(0, Math.max(cut.lastIndexOf(' '), max - 20)).trimEnd() + '…';
}

export function Asterisk({ size, color }: { size: number; color: string }) {
  return (
    <div style={{ display: 'flex', width: size, height: size, position: 'relative' }}>
      {[0, 45, 90, 135].map((a) => (
        <div
          key={a}
          style={{
            position: 'absolute',
            left: size / 2 - size * 0.08,
            top: 0,
            width: size * 0.16,
            height: size,
            borderRadius: size * 0.08,
            background: color,
            transform: `rotate(${a}deg)`,
          }}
        />
      ))}
    </div>
  );
}

export function VerifiedTick({ size }: { size: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24">
      <circle cx="12" cy="12" r="11" fill="#1d9bf0" />
      <path d="M7.4 12.3l3 3 6.2-6.4" fill="none" stroke="#fff" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

