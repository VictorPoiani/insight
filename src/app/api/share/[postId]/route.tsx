import { rateLimit } from '@/lib/net/rateLimit';
import { ImageResponse } from 'next/og';
import { firstPostImage } from '@/lib/postMedia';
import { createClient } from '@supabase/supabase-js';
import { getShareTheme, SHARE_SIZES, ShareFormat } from '@/lib/share/themes';
import { siteUrl } from '@/lib/account/mailer';
import { Asterisk, VerifiedTick, clip, loadFonts, plain, toDataUrl } from '@/lib/share/render';

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

export async function GET(req: Request, ctx: { params: Promise<{ postId: string }> }) {
  const limited = await rateLimit(req, 'share-post', 40, 60);
  if (limited) return limited;
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
    .select('id, content, blocks, tags, created_at, profile_id, author_id, visibility, is_draft, moderation_status, is_nsfw')
    .eq('id', postId)
    .maybeSingle();
  // retido pela moderação ou +18: sem imagem de prévia
  if (!post || post.visibility === 'private' || post.is_draft || post.moderation_status !== 'approved' || post.is_nsfw) {
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
    format === 'og' ? Promise.resolve(null) : toDataUrl(firstPostImage(blocks as Parameters<typeof firstPostImage>[0])),
  ]);

  const name = author?.display_name || author?.full_name || author?.username || 'Membro do Insight';
  const handle = author?.username ? `@${author.username}` : '';
  const host = siteUrl().replace(/^https?:\/\//, '');
  const date = new Date(post.created_at).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short', year: 'numeric' });
  const tags: string[] = (post.tags || []).slice(0, 3);

  // tamanho do texto conforme o espaço e o tamanho do post
  const limits = { story: image ? 260 : 460, square: image ? 150 : 300, og: 170 }[format];
  const text = clip(fullText || 'Confira este Insight', limits);
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
      {format === 'og' ? `Leia no ${host}` : (
        <span style={{ display: 'flex', alignItems: 'center' }}>
          {/* elo de corrente desenhado: o link curto leva direto ao post */}
          <svg width={30 * S} height={30 * S} viewBox="0 0 24 24" fill="none" stroke={theme.accent} strokeWidth={2.4} strokeLinecap="round" strokeLinejoin="round" style={{ marginRight: 12 * S }}>
            <path d="M10 13.5a4 4 0 005.66 0l3-3a4 4 0 00-5.66-5.66l-1.2 1.2" />
            <path d="M14 10.5a4 4 0 00-5.66 0l-3 3a4 4 0 005.66 5.66l1.2-1.2" />
          </svg>
          {host}/s/{String(post.id).slice(0, 8)}
        </span>
      )}
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
