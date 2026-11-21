import { ImageResponse } from 'next/og';
import { createClient } from '@supabase/supabase-js';
import { getShareTheme, SHARE_SIZES, ShareFormat } from '@/lib/share/themes';
import { siteUrl } from '@/lib/account/mailer';

/**
 * Imagem de compartilhamento de um post (gerada no servidor, sem depender de
 * CORS do navegador):
 *   ?format=story  1080×1920  (Stories do Instagram/WhatsApp/Facebook)
 *   ?format=square 1080×1080  (feed, Threads, X)
 *   ?format=og     1200×630   (prévia de link)
 * &theme=<id de SHARE_THEMES>
 *
 * Usa a chave pública: posts privados/rascunhos não são lidos (RLS).
 */

export const revalidate = 300;

type Weight = 500 | 700 | 800;
let fontCache: { name: string; data: ArrayBuffer; weight: Weight }[] | null = null;

async function loadFonts() {
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
async function toDataUrl(url: string | null | undefined): Promise<string | null> {
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

function plain(html?: string | null) {
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

function clip(text: string, max: number) {
  if (text.length <= max) return text;
  const cut = text.slice(0, max);
  return cut.slice(0, Math.max(cut.lastIndexOf(' '), max - 20)).trimEnd() + '…';
}

function Asterisk({ size, color }: { size: number; color: string }) {
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

function VerifiedTick({ size }: { size: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24">
      <circle cx="12" cy="12" r="11" fill="#1d9bf0" />
      <path d="M7.4 12.3l3 3 6.2-6.4" fill="none" stroke="#fff" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export async function GET(req: Request, ctx: { params: Promise<{ postId: string }> }) {
  const { postId } = await ctx.params;
  const url = new URL(req.url);
  const format = (['story', 'square', 'og'].includes(url.searchParams.get('format') || '')
    ? url.searchParams.get('format')
    : 'story') as ShareFormat;
  const theme = getShareTheme(url.searchParams.get('theme'));
  const { width, height } = SHARE_SIZES[format];

  if (!/^[0-9a-f-]{36}$/i.test(postId)) return new Response('Post inválido', { status: 400 });

  const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, {
    auth: { persistSession: false },
  });
  const { data: post } = await supabase
    .from('posts')
    .select('id, content, blocks, tags, created_at, profile_id, author_id, visibility, is_draft')
    .eq('id', postId)
    .maybeSingle();
  if (!post || post.visibility === 'private' || post.is_draft) {
    return new Response('Post não encontrado', { status: 404 });
  }
  const { data: author } = await supabase
    .from('profiles')
    .select('display_name, full_name, username, avatar_url, email_verified_at')
    .eq('id', post.profile_id || post.author_id)
    .maybeSingle();

  const blocks: { type?: string; html?: string; imageUrl?: string }[] = Array.isArray(post.blocks) ? post.blocks : [];
  const fromBlocks = blocks
    .filter((b) => ['paragraph', 'h1', 'h2', 'quote', 'callout', 'bullet', 'code'].includes(b.type || ''))
    .map((b) => (b.type === 'bullet' ? `• ${plain(b.html)}` : plain(b.html)))
    .filter(Boolean)
    .join('\n');
  // SHARE_NO_EMOJI=1: sem emojis (plano B se o CDN do Twemoji estiver fora)
  const noEmoji = process.env.SHARE_NO_EMOJI === '1';
  const stripEmoji = (t: string) => (noEmoji ? t.replace(/\p{Extended_Pictographic}\uFE0F?/gu, '').replace(/ {2,}/g, ' ') : t);
  const fullText = stripEmoji((fromBlocks || plain(post.content) || '').trim());

  const [fonts, avatar, image] = await Promise.all([
    loadFonts(),
    toDataUrl(author?.avatar_url),
    format === 'og' ? Promise.resolve(null) : toDataUrl(blocks.find((b) => b.type === 'image' && b.imageUrl)?.imageUrl),
  ]);

  const name = author?.display_name || author?.full_name || author?.username || 'Membro do Insight';
  const handle = author?.username ? `@${author.username}` : '';
  const host = siteUrl().replace(/^https?:\/\//, '');
  const date = new Date(post.created_at).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short', year: 'numeric' });
  const tags: string[] = (post.tags || []).slice(0, 3);

  // tamanho do texto conforme o espaço e o tamanho do post
  const limits = { story: image ? 260 : 460, square: image ? 150 : 300, og: 170 }[format];
  const text = clip(fullText || 'Confira esta publicação no Insight*', limits);
  const len = text.length;
  const fontSize =
    format === 'story'
      ? len < 90 ? 66 : len < 180 ? 54 : len < 300 ? 46 : 40
      : format === 'square'
        ? len < 80 ? 54 : len < 160 ? 44 : 36
        : len < 80 ? 44 : len < 130 ? 36 : 31;

  const S = format === 'og' ? 0.62 : 1; // escala dos elementos fixos
  const pad = format === 'story' ? 84 : format === 'square' ? 72 : 56;

  const card = (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        width: '100%',
        padding: format === 'og' ? '40px 46px' : '56px 60px',
        borderRadius: format === 'og' ? 32 : 48,
        background: theme.card,
        border: `2px solid ${theme.cardBorder}`,
        boxShadow: '0 40px 80px rgba(0,0,0,0.35)',
      }}
    >
      {/* autor */}
      <div style={{ display: 'flex', alignItems: 'center' }}>
        {avatar ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={avatar} width={104 * S} height={104 * S} style={{ borderRadius: 999, objectFit: 'cover', border: `3px solid ${theme.accent}` }} alt="" />
        ) : (
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              width: 104 * S,
              height: 104 * S,
              borderRadius: 999,
              background: theme.accent,
              color: '#ffffff',
              fontSize: 48 * S,
              fontWeight: 800,
            }}
          >
            {name.slice(0, 1).toUpperCase()}
          </div>
        )}
        <div style={{ display: 'flex', flexDirection: 'column', marginLeft: 26 * S }}>
          <div style={{ display: 'flex', alignItems: 'center', fontSize: 40 * S, fontWeight: 800, color: theme.text }}>
            {name}
            {author?.email_verified_at ? (
              <div style={{ display: 'flex', marginLeft: 12 * S }}>
                <VerifiedTick size={34 * S} />
              </div>
            ) : null}
          </div>
          <div style={{ display: 'flex', fontSize: 28 * S, fontWeight: 500, color: theme.sub, marginTop: 4 }}>
            {handle} · {date}
          </div>
        </div>
      </div>

      {/* texto */}
      <div
        style={{
          display: 'flex',
          marginTop: 38 * S,
          fontSize,
          lineHeight: 1.32,
          fontWeight: len < 120 ? 700 : 500,
          color: theme.text,
          whiteSpace: 'pre-wrap',
          letterSpacing: len < 120 ? -0.5 : 0,
        }}
      >
        {text}
      </div>

      {image && (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={image}
          alt=""
          width={width - pad * 2 - 124}
          height={format === 'story' ? 560 : 250}
          style={{ marginTop: 36, borderRadius: 28, objectFit: 'cover' }}
        />
      )}

      {tags.length > 0 && (
        <div style={{ display: 'flex', flexWrap: 'wrap', marginTop: 34 * S }}>
          {tags.map((t) => (
            <div
              key={t}
              style={{
                display: 'flex',
                padding: `${8 * S}px ${20 * S}px`,
                marginRight: 12 * S,
                borderRadius: 999,
                border: `2px solid ${theme.cardBorder}`,
                color: theme.accent,
                fontSize: 26 * S,
                fontWeight: 700,
              }}
            >
              #{t}
            </div>
          ))}
        </div>
      )}
    </div>
  );

  const logo = (scale: number) => (
    <div style={{ display: 'flex', alignItems: 'flex-start', fontSize: 52 * scale, fontWeight: 800, color: theme.text, letterSpacing: -1.5 }}>
      Insight
      <span style={{ color: theme.accent, marginLeft: 2 }}>*</span>
    </div>
  );

  const footer = (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: `${16 * S}px ${30 * S}px`,
        borderRadius: 999,
        background: theme.card,
        border: `2px solid ${theme.cardBorder}`,
        color: theme.text,
        fontSize: 28 * S,
        fontWeight: 700,
      }}
    >
      Leia no {host}
    </div>
  );

  const element = (
    <div
      style={{
        width,
        height,
        display: 'flex',
        flexDirection: 'column',
        justifyContent: format === 'og' ? 'center' : 'space-between',
        alignItems: 'stretch',
        padding: pad,
        background: theme.bg,
        fontFamily: fonts.length ? 'Inter' : undefined,
        position: 'relative',
        overflow: 'hidden',
      }}
    >
      {/* asteriscos decorativos */}
      <div style={{ display: 'flex', position: 'absolute', right: -140, top: format === 'og' ? -120 : -80, transform: 'rotate(18deg)' }}>
        <Asterisk size={format === 'og' ? 420 : 620} color={theme.mark} />
      </div>
      <div style={{ display: 'flex', position: 'absolute', left: -110, bottom: -120, transform: 'rotate(-12deg)' }}>
        <Asterisk size={format === 'og' ? 260 : 380} color={theme.mark} />
      </div>

      {format !== 'og' && (
        <div style={{ display: 'flex', justifyContent: 'center', marginTop: format === 'story' ? 60 : 0 }}>{logo(1)}</div>
      )}

      {format === 'og' ? (
        <div style={{ display: 'flex', alignItems: 'center', width: '100%' }}>
          <div style={{ display: 'flex', flex: 1 }}>{card}</div>
        </div>
      ) : (
        <div style={{ display: 'flex' }}>{card}</div>
      )}

      {format === 'og' ? (
        <div style={{ display: 'flex', position: 'absolute', right: 56, bottom: 26 }}>{logo(0.6)}</div>
      ) : (
        <div style={{ display: 'flex', justifyContent: 'center', marginBottom: format === 'story' ? 140 : 0 }}>{footer}</div>
      )}
    </div>
  );

  return new ImageResponse(element, {
    width,
    height,
    fonts: fonts.length ? fonts.map((f) => ({ name: f.name, data: f.data, weight: f.weight, style: 'normal' as const })) : undefined,
    ...(noEmoji ? {} : { emoji: 'twemoji' as const }),
    headers: { 'Cache-Control': 'public, max-age=300, s-maxage=3600, stale-while-revalidate=86400' },
  });
}
