import { rateLimit } from '@/lib/net/rateLimit';
import { ImageResponse } from 'next/og';
import { createClient } from '@supabase/supabase-js';
import { getShareTheme, SHARE_SIZES } from '@/lib/share/themes';
import { siteUrl } from '@/lib/account/mailer';
import { Asterisk, VerifiedTick, clip, loadFonts, toDataUrl } from '@/lib/share/render';
import { getTierByLevel } from '@/lib/contributorLevels';

/**
 * Cartão "me siga no Insight*" de um perfil.
 *   ?format=story (1080×1920) | square (1080×1080) | og (1200×630) &theme=<id>
 */

export const revalidate = 300;

function compact(n: number) {
  const fmt = (v: number) => v.toFixed(1).replace(/\.0$/, '').replace('.', ',');
  if (n >= 1_000_000) return `${fmt(n / 1_000_000)} mi`;
  if (n >= 1000) return `${fmt(n / 1000)} mil`;
  return String(n);
}

export async function GET(req: Request, ctx: { params: Promise<{ username: string }> }) {
  const limited = await rateLimit(req, 'share-profile', 40, 60);
  if (limited) return limited;
  const { username } = await ctx.params;
  const url = new URL(req.url);
  const fmtParam = url.searchParams.get('format');
  const format = fmtParam === 'square' || fmtParam === 'og' ? fmtParam : 'story';
  const theme = getShareTheme(url.searchParams.get('theme'));
  const { width, height } = SHARE_SIZES[format];
  const handleParam = decodeURIComponent(username).slice(0, 60);

  const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, {
    auth: { persistSession: false },
  });
  const { data: p } = await supabase
    .from('profiles')
    .select('id, display_name, full_name, username, avatar_url, bio, followers_count, posts_count, email_verified_at, contributor_level, nickname')
    .eq('username', handleParam)
    .maybeSingle();
  if (!p) return new Response('Perfil não encontrado', { status: 404 });

  const [fonts, avatar] = await Promise.all([loadFonts(), toDataUrl(p.avatar_url)]);
  const name = p.display_name || p.full_name || p.username;
  const tier = getTierByLevel(p.contributor_level ?? 0);
  const bio = clip(String(p.bio || '').replace(/\s+/g, ' ').trim(), format === 'og' ? 90 : 150);
  const host = siteUrl().replace(/^https?:\/\//, '');
  const S = format === 'og' ? 0.6 : format === 'square' ? 0.85 : 1;
  const avatarSize = 260 * S;

  const stat = (value: string, label: string) => (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', padding: `0 ${34 * S}px` }}>
      <div style={{ display: 'flex', fontSize: 58 * S, fontWeight: 800, color: theme.text }}>{value}</div>
      <div style={{ display: 'flex', fontSize: 26 * S, fontWeight: 500, color: theme.sub }}>{label}</div>
    </div>
  );

  const card = (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        width: '100%',
        padding: `${70 * S}px ${56 * S}px ${60 * S}px`,
        borderRadius: 56 * S,
        background: theme.card,
        border: `2px solid ${theme.cardBorder}`,
        boxShadow: '0 40px 80px rgba(0,0,0,0.35)',
      }}
    >
      <div
        style={{
          display: 'flex',
          padding: 8 * S,
          borderRadius: 999,
          background: `linear-gradient(135deg, ${theme.accent}, ${theme.swatch[0]}, ${theme.swatch[1]})`,
        }}
      >
        {avatar ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={avatar} width={avatarSize} height={avatarSize} style={{ borderRadius: 999, objectFit: 'cover', border: `6px solid ${theme.card}` }} alt="" />
        ) : (
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              width: avatarSize,
              height: avatarSize,
              borderRadius: 999,
              background: theme.accent,
              color: '#fff',
              fontSize: 120 * S,
              fontWeight: 800,
              border: `6px solid ${theme.card}`,
            }}
          >
            {name.slice(0, 1).toUpperCase()}
          </div>
        )}
      </div>

      <div style={{ display: 'flex', alignItems: 'center', marginTop: 34 * S, fontSize: 66 * S, fontWeight: 800, color: theme.text, letterSpacing: -1 }}>
        {name}
        {p.email_verified_at ? (
          <div style={{ display: 'flex', marginLeft: 16 * S }}>
            <VerifiedTick size={52 * S} />
          </div>
        ) : null}
      </div>
      <div style={{ display: 'flex', fontSize: 34 * S, fontWeight: 500, color: theme.sub, marginTop: 6 }}>
        @{p.username}
        {p.nickname ? ` · ${p.nickname}` : ''}
      </div>

      {(p.contributor_level ?? 0) > 0 && (
        <div
          style={{
            display: 'flex',
            marginTop: 22 * S,
            padding: `${8 * S}px ${22 * S}px`,
            borderRadius: 999,
            border: `2px solid ${tier.color}`,
            color: theme.text,
            fontSize: 26 * S,
            fontWeight: 700,
          }}
        >
          Nível {tier.level} · {tier.name}
        </div>
      )}

      {bio && format !== 'og' && (
        <div style={{ display: 'flex', marginTop: 34 * S, fontSize: 34 * S, lineHeight: 1.35, color: theme.text, textAlign: 'center', maxWidth: 760 }}>
          {bio}
        </div>
      )}

      <div style={{ display: 'flex', marginTop: 44 * S }}>
        {stat(compact(p.followers_count ?? 0), 'seguidores')}
        {stat(compact(p.posts_count ?? 0), 'publicações')}
      </div>

      <div
        style={{
          display: 'flex',
          marginTop: 48 * S,
          padding: `${20 * S}px ${46 * S}px`,
          borderRadius: 999,
          background: theme.accent,
          color: theme.id === 'papel' || theme.id === 'minimal' ? '#ffffff' : '#0b1220',
          fontSize: 34 * S,
          fontWeight: 800,
        }}
      >
        Me siga no Insight*
      </div>
    </div>
  );

  return new ImageResponse(
    (
      <div
        style={{
          width,
          height,
          display: 'flex',
          flexDirection: 'column',
          justifyContent: format === 'story' ? 'space-between' : 'center',
          padding: format === 'story' ? 84 : 56,
          background: theme.bg,
          fontFamily: fonts.length ? 'Inter' : undefined,
          position: 'relative',
          overflow: 'hidden',
        }}
      >
        <div style={{ display: 'flex', position: 'absolute', right: -160, top: -100, transform: 'rotate(18deg)' }}>
          <Asterisk size={format === 'og' ? 420 : 640} color={theme.mark} />
        </div>
        <div style={{ display: 'flex', position: 'absolute', left: -120, bottom: -130, transform: 'rotate(-12deg)' }}>
          <Asterisk size={format === 'og' ? 280 : 400} color={theme.mark} />
        </div>
        {format === 'story' && (
          <div style={{ display: 'flex', justifyContent: 'center', marginTop: 70, fontSize: 52, fontWeight: 800, color: theme.text }}>
            Insight<span style={{ color: theme.accent }}>*</span>
          </div>
        )}
        <div style={{ display: 'flex' }}>{card}</div>
        {format === 'story' && (
          <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 140, fontSize: 30, fontWeight: 700, color: theme.sub }}>
            {host}/u/{p.username}
          </div>
        )}
      </div>
    ),
    {
      width,
      height,
      fonts: fonts.length ? fonts.map((f) => ({ name: f.name, data: f.data, weight: f.weight, style: 'normal' as const })) : undefined,
      ...(process.env.SHARE_NO_EMOJI === '1' ? {} : { emoji: 'twemoji' as const }),
      headers: { 'Cache-Control': 'public, max-age=300, s-maxage=3600, stale-while-revalidate=86400' },
    }
  );
}
