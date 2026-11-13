import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import nodemailer from 'nodemailer';
import { PostBlock } from '@/types/database';

interface NewsletterPayload {
  action: 'welcome' | 'new_post' | 'official_update';
  email?: string;
  notifyMode?: 'all' | 'tags' | 'pinned' | 'official_only';
  interestedTags?: string[];
  postTitle?: string;
  postContent?: string;
  postTags?: string[];
  postBlocks?: PostBlock[];
  isPinned?: boolean;
}

function getSupabaseClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';
  return createClient(url, key);
}

function resolveSiteUrl() {
  if (process.env.NEXT_PUBLIC_SITE_URL) {
    return process.env.NEXT_PUBLIC_SITE_URL.replace(/\/$/, '');
  }
  if (process.env.VERCEL_PROJECT_PRODUCTION_URL) {
    return `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}`;
  }
  if (process.env.VERCEL_URL) {
    return `https://${process.env.VERCEL_URL}`;
  }
  return 'http://localhost:3000';
}

// Rota GET de diagnóstico: basta abrir /api/newsletter no navegador para verificar a configuração
export async function GET() {
  const apiKey = process.env.RESEND_API_KEY;
  const gmailUser = process.env.GMAIL_USER;
  const gmailPass = process.env.GMAIL_APP_PASSWORD;

  return NextResponse.json({
    status: 'API Newsletter Online',
    provider: gmailUser && gmailPass ? 'Gmail SMTP (Liberado para qualquer e-mail)' : 'Resend API',
    gmailConfigured: Boolean(gmailUser && gmailPass),
    resendKeyConfigured: Boolean(apiKey),
    resendFrom: process.env.RESEND_FROM_EMAIL || 'onboarding@resend.dev',
  });
}

function renderBlocksForEmail(blocks?: PostBlock[], fallbackText?: string): string {
  if (!Array.isArray(blocks) || blocks.length === 0) {
    return `<p style="margin: 0; font-size: 15px; line-height: 1.7; color: #e4e4e7; white-space: pre-line;">${
      fallbackText || ''
    }</p>`;
  }

  return blocks
    .map((b) => {
      if (b.type === 'divider') {
        return `<hr style="border: 0; border-top: 1px solid #27272a; margin: 20px 0;" />`;
      }
      if (b.type === 'h1') {
        return `<h2 style="margin: 18px 0 8px 0; font-size: 22px; font-weight: 800; color: #ffffff;">${
          b.html || ''
        }</h2>`;
      }
      if (b.type === 'h2') {
        return `<h3 style="margin: 16px 0 6px 0; font-size: 18px; font-weight: 700; color: #f4f4f5;">${
          b.html || ''
        }</h3>`;
      }
      if (b.type === 'quote') {
        return `<blockquote style="margin: 14px 0; padding: 8px 16px; border-left: 4px solid #2563eb; color: #a1a1aa; font-style: italic; font-size: 15px;">${
          b.html || ''
        }</blockquote>`;
      }
      if (b.type === 'callout') {
        return `
          <div style="margin: 14px 0; padding: 14px 16px; background-color: #18181b; border: 1px solid rgba(37, 99, 235, 0.4); border-radius: 12px; color: #f4f4f5; font-size: 14px;">
            <span style="font-size: 18px; margin-right: 8px;">${b.calloutIcon || '💡'}</span>
            <span>${b.html || ''}</span>
          </div>
        `;
      }
      if (b.type === 'code') {
        return `<pre style="margin: 14px 0; padding: 14px; background-color: #18181b; border: 1px solid #27272a; border-radius: 10px; font-family: monospace; font-size: 12px; color: #38bdf8; overflow-x: auto; white-space: pre-wrap;">${
          b.html || ''
        }</pre>`;
      }
      if (b.type === 'bullet') {
        return `<p style="margin: 6px 0; font-size: 15px; color: #e4e4e7;"><span style="color: #2563eb; font-weight: bold; margin-right: 8px;">•</span>${
          b.html || ''
        }</p>`;
      }
      if (b.type === 'image' && b.imageUrl) {
        return `
          <div style="margin: 18px 0; text-align: center;">
            <img src="${b.imageUrl}" alt="${
          b.imageCaption || 'Imagem do post'
        }" style="max-width: 100%; border-radius: 12px; border: 1px solid #27272a; display: block; margin: 0 auto;" />
            ${
              b.imageCaption
                ? `<p style="margin: 6px 0 0 0; font-size: 12px; color: #71717a;">${b.imageCaption}</p>`
                : ''
            }
          </div>
        `;
      }
      return `<p style="margin: 0 0 12px 0; font-size: 15px; line-height: 1.7; color: #e4e4e7;">${
        b.html || ''
      }</p>`;
    })
    .join('');
}

function buildMasterEmailTemplate({
  badgeText,
  headline,
  authorName,
  authorNickname,
  authorHandle,
  authorAvatar,
  mainHtmlContent,
  ctaLabel,
  ctaUrl,
  siteUrl,
  recipientEmail,
}: {
  badgeText: string;
  headline: string;
  authorName: string;
  authorNickname: string;
  authorHandle: string;
  authorAvatar: string;
  mainHtmlContent: string;
  ctaLabel: string;
  ctaUrl: string;
  siteUrl: string;
  recipientEmail?: string;
}) {
  const todayStr = new Date().toLocaleDateString('pt-BR', {
    day: '2-digit',
    month: 'long',
    year: 'numeric',
  });

  return `
  <!DOCTYPE html>
  <html lang="pt-BR">
  <body style="margin: 0; padding: 0; background-color: #050507; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; color: #f4f4f5;">
    <table width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color: #050507; padding: 32px 12px;">
      <tr>
        <td align="center">
          <table width="100%" cellpadding="0" cellspacing="0" border="0" style="max-width: 600px; background-color: #09090b; border: 1px solid #27272a; border-radius: 20px; overflow: hidden;">
            <tr>
              <td style="height: 5px; background: linear-gradient(90deg, #1d4ed8 0%, #2563eb 50%, #38bdf8 100%);"></td>
            </tr>
            <tr>
              <td style="padding: 28px 32px 20px 32px; border-bottom: 1px solid #18181b;">
                <table width="100%" cellpadding="0" cellspacing="0" border="0">
                  <tr>
                    <td>
                      <span style="font-size: 26px; font-weight: 900; letter-spacing: -0.5px; color: #ffffff;">
                        Insight<span style="color: #2563eb;">*</span>
                      </span>
                    </td>
                    <td align="right">
                      <span style="display: inline-block; background-color: rgba(37, 99, 235, 0.15); border: 1px solid rgba(37, 99, 235, 0.35); color: #60a5fa; font-size: 11px; font-weight: 800; padding: 5px 12px; border-radius: 999px; text-transform: uppercase; letter-spacing: 0.5px;">
                        ${badgeText}
                      </span>
                    </td>
                  </tr>
                </table>
              </td>
            </tr>
            <tr>
              <td style="padding: 24px 32px 8px 32px;">
                <table cellpadding="0" cellspacing="0" border="0">
                  <tr>
                    <td style="padding-right: 12px;">
                      <img src="${authorAvatar}" alt="${authorName}" width="44" height="44" style="width: 44px; height: 44px; border-radius: 50%; object-fit: cover; border: 2px solid #2563eb; display: block;" />
                    </td>
                    <td>
                      <div style="font-size: 15px; font-weight: 800; color: #ffffff;">
                        ${authorName} <span style="color: #E63946; font-weight: 700;">· ${authorNickname}</span>
                      </div>
                      <div style="font-size: 12px; color: #71717a; margin-top: 2px;">
                        @${authorHandle} · ${todayStr}
                      </div>
                    </td>
                  </tr>
                </table>
              </td>
            </tr>
            <tr>
              <td style="padding: 16px 32px 8px 32px;">
                <h1 style="margin: 0; font-size: 22px; font-weight: 800; color: #ffffff; line-height: 1.35;">
                  ${headline}
                </h1>
              </td>
            </tr>
            <tr>
              <td style="padding: 12px 32px 24px 32px;">
                ${mainHtmlContent}
              </td>
            </tr>
            <tr>
              <td align="center" style="padding: 4px 32px 32px 32px;">
                <a href="${ctaUrl}" style="display: inline-block; background-color: #2563eb; color: #ffffff; text-decoration: none; font-weight: 800; font-size: 14px; padding: 14px 28px; border-radius: 999px;">
                  ${ctaLabel} →
                </a>
              </td>
            </tr>
            <tr>
              <td style="background-color: #121215; border-top: 1px solid #27272a; padding: 24px 32px; text-align: center;">
                <p style="margin: 0 0 10px 0; font-size: 12px; font-weight: 700; color: #a1a1aa;">
                  Filosofia: &ldquo;Apenas poste.&rdquo;
                </p>
                <p style="margin: 0 0 14px 0; font-size: 12px;">
                  <a href="${siteUrl}" style="color: #60a5fa; text-decoration: none; margin: 0 8px;">Feed Principal</a> ·
                  <a href="${siteUrl}/config" style="color: #60a5fa; text-decoration: none; margin: 0 8px;">Personalizar Filtros</a> ·
                  <a href="${siteUrl}/notificacoes" style="color: #60a5fa; text-decoration: none; margin: 0 8px;">Mural Oficial</a> ·
                  <a href="${siteUrl}/apoie" style="color: #60a5fa; text-decoration: none; margin: 0 8px;">Apoiar Projeto</a>
                </p>
                <p style="margin: 0; font-size: 11px; color: #52525b;">
                  Enviado para ${recipientEmail || 'assinante do Insight*'} · Rio Paranaíba, MG
                </p>
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  </body>
  </html>
  `;
}

async function sendEmailDispatcher(to: string[], subject: string, html: string) {
  const gmailUser = process.env.GMAIL_USER;
  const gmailPass = process.env.GMAIL_APP_PASSWORD;

  // 1. MODO GMAIL SMTP: Envia para qualquer e-mail gratuitamente sem precisar de domínio próprio
  if (gmailUser && gmailPass) {
    const transporter = nodemailer.createTransport({
      service: 'gmail',
      auth: {
        user: gmailUser.trim(),
        pass: gmailPass.trim(),
      },
    });

    const errors: string[] = [];

    for (const recipient of to) {
      try {
        await transporter.sendMail({
          from: `"Insight*" <${gmailUser.trim()}>`,
          to: recipient.trim(),
          subject,
          html,
        });
        console.log('✅ [E-mail enviado via Gmail SMTP]:', recipient);
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : String(err);
        console.error('❌ [Erro Gmail SMTP]:', msg);
        errors.push(msg);
      }
    }

    return { ok: errors.length === 0, errors };
  }

  // 2. MODO RESEND API: Usa RESEND_FROM_EMAIL (se tiver domínio verificado) ou onboarding@resend.dev
  const apiKey = process.env.RESEND_API_KEY;
  const fromEmail = process.env.RESEND_FROM_EMAIL || 'Insight* <onboarding@resend.dev>';

  if (!apiKey) {
    return {
      ok: false,
      errors: [
        'Configure GMAIL_USER + GMAIL_APP_PASSWORD ou RESEND_API_KEY nas variáveis de ambiente.',
      ],
    };
  }

  const errors: string[] = [];

  for (const recipient of to) {
    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey.trim()}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: fromEmail,
        to: [recipient.trim()],
        subject,
        html,
      }),
    });

    const data = await res.json();

    if (!res.ok) {
      console.error('❌ [Erro Resend]:', data);
      errors.push(data?.message || JSON.stringify(data));
    } else {
      console.log('✅ [E-mail enviado no Resend]:', data.id);
    }
  }

  return { ok: errors.length === 0, errors };
}

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as NewsletterPayload;
    const supabase = getSupabaseClient();
    const siteUrl = resolveSiteUrl();

    const { data: profile } = await supabase
      .from('profiles')
      .select('display_name, full_name, nickname, username, avatar_url')
      .limit(1)
      .maybeSingle();

    const authorName = profile?.display_name || profile?.full_name || 'Victor Poiani';
    const authorNickname = profile?.nickname || 'o criador';
    const authorHandle = profile?.username || 'poiani';
    const authorAvatar =
      profile?.avatar_url && profile.avatar_url.startsWith('http')
        ? profile.avatar_url
        : 'https://ui-avatars.com/api/?name=Victor+Poiani&background=2563eb&color=fff&bold=true';

    if (body.action === 'welcome' && body.email) {
      const { data: latestPost } = await supabase
        .from('posts')
        .select('content, tags, created_at')
        .order('is_pinned', { ascending: false })
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      const modeLabels: Record<string, string> = {
        all: '✨ Todas as novas publicações do feed + Atualizações Oficiais',
        pinned: '📌 Apenas publicações Fixadas (Destaques) + Atualizações Oficiais',
        tags: `🏷️ Temas selecionados (${(body.interestedTags || [])
          .map((t) => `#${t}`)
          .join(', ')}) + Atualizações Oficiais`,
        official_only: '🔒 Somente Atualizações Oficiais da plataforma',
      };

      const chosenModeText = modeLabels[body.notifyMode || 'all'] || modeLabels.all;

      const latestPostHtml = latestPost
        ? `
          <div style="margin-top: 22px; background-color: #121215; border: 1px solid #27272a; border-radius: 16px; padding: 18px;">
            <div style="font-size: 11px; font-weight: 800; color: #60a5fa; text-transform: uppercase; letter-spacing: 0.5px; margin-bottom: 8px;">
              🔥 Último Insight em Destaque no Blog
            </div>
            <p style="margin: 0; font-size: 14px; line-height: 1.6; color: #e4e4e7; white-space: pre-line;">
              &ldquo;${latestPost.content.slice(0, 260)}${
            latestPost.content.length > 260 ? '...' : ''
          }&rdquo;
            </p>
          </div>
        `
        : '';

      const welcomeContent = `
        <p style="margin: 0 0 16px 0; font-size: 15px; line-height: 1.65; color: #d4d4d8;">
          Agora você faz parte da comunidade do <strong>Insight*</strong>. Sempre que uma ideia, projeto ou reflexão importante for publicada, ela chegará direto aqui para você.
        </p>

        <div style="background-color: #121215; border-left: 4px solid #2563eb; padding: 16px; border-radius: 10px; margin: 18px 0;">
          <div style="font-size: 11px; font-weight: 800; color: #71717a; text-transform: uppercase; letter-spacing: 0.5px;">
            Seu filtro atual de notificações:
          </div>
          <div style="font-size: 14px; font-weight: 700; color: #ffffff; margin-top: 6px;">
            ${chosenModeText}
          </div>
          <div style="margin-top: 10px;">
            <a href="${siteUrl}/config" style="font-size: 12px; color: #60a5fa; text-decoration: none; font-weight: 600;">
              ⚙️ Personalizar minhas hashtags ou filtros nas Configurações →
            </a>
          </div>
        </div>

        ${latestPostHtml}
      `;

      const html = buildMasterEmailTemplate({
        badgeText: 'Inscrição Ativa',
        headline: 'Bem-vindo(a) ao Insight*!',
        authorName,
        authorNickname,
        authorHandle,
        authorAvatar,
        mainHtmlContent: welcomeContent,
        ctaLabel: 'Explorar o Insight*',
        ctaUrl: siteUrl,
        siteUrl,
        recipientEmail: body.email,
      });

      const sendResult = await sendEmailDispatcher(
        [body.email],
        'Bem-vindo(a) ao Insight* — Sua inscrição está ativa!',
        html
      );

      if (!sendResult.ok) {
        return NextResponse.json(
          { ok: false, error: sendResult.errors.join(' | ') },
          { status: 400 }
        );
      }

      return NextResponse.json({ ok: true });
    }

    if (body.action === 'official_update') {
      const { data: subs } = await supabase.from('subscribers').select('email');
      const recipients = (subs || []).map((s) => s.email);
      if (recipients.length === 0) return NextResponse.json({ ok: true, sent: 0 });

      const richBody = renderBlocksForEmail(body.postBlocks, body.postContent);

      const html = buildMasterEmailTemplate({
        badgeText: 'Mural Oficial',
        headline: body.postTitle || 'Nova Atualização Oficial no Insight*',
        authorName,
        authorNickname,
        authorHandle,
        authorAvatar,
        mainHtmlContent: `
          <div style="background-color: #121215; border: 1px solid #27272a; border-radius: 16px; padding: 20px;">
            ${richBody}
          </div>
        `,
        ctaLabel: 'Ver Linha do Tempo Completa',
        ctaUrl: `${siteUrl}/notificacoes`,
        siteUrl,
      });

      const sendResult = await sendEmailDispatcher(
        recipients,
        `[Atualização Oficial] ${body.postTitle || 'Novidades no Insight*'}`,
        html
      );

      return NextResponse.json({ ok: sendResult.ok, errors: sendResult.errors });
    }

    if (body.action === 'new_post') {
      const { data: subs } = await supabase
        .from('subscribers')
        .select('email, notify_mode, interested_tags');

      if (!subs || subs.length === 0) return NextResponse.json({ ok: true, sent: 0 });

      const postTagsLower = (body.postTags || []).map((t) => t.toLowerCase());
      const isPinned = Boolean(body.isPinned);

      const matchedRecipients = subs
        .filter((sub) => {
          if (sub.notify_mode === 'all') return true;
          if (sub.notify_mode === 'pinned') return isPinned;
          if (sub.notify_mode === 'tags') {
            const userTags = Array.isArray(sub.interested_tags)
              ? sub.interested_tags.map((t: string) => t.toLowerCase())
              : [];
            return userTags.some((t: string) => postTagsLower.includes(t));
          }
          return false;
        })
        .map((sub) => sub.email);

      if (matchedRecipients.length === 0) return NextResponse.json({ ok: true, sent: 0 });

      const richPostHtml = renderBlocksForEmail(body.postBlocks, body.postContent);

      const tagsPillsHtml =
        postTagsLower.length > 0
          ? `<div style="margin-top: 16px;">${postTagsLower
              .map(
                (t) =>
                  `<span style="display: inline-block; background-color: #18181b; border: 1px solid #27272a; color: #60a5fa; font-size: 12px; font-weight: 700; padding: 4px 10px; border-radius: 999px; margin-right: 6px; margin-bottom: 6px;">#${t}</span>`
              )
              .join('')}</div>`
          : '';

      const html = buildMasterEmailTemplate({
        badgeText: isPinned ? 'Insight Fixado' : 'Novo Insight',
        headline: isPinned
          ? 'Nova publicação em destaque no Insight*'
          : 'Victor Poiani acabou de publicar um novo insight',
        authorName,
        authorNickname,
        authorHandle,
        authorAvatar,
        mainHtmlContent: `
          <div style="background-color: #121215; border: 1px solid #27272a; border-radius: 16px; padding: 22px;">
            ${richPostHtml}
            ${tagsPillsHtml}
          </div>
        `,
        ctaLabel: 'Ler e Responder na Thread',
        ctaUrl: siteUrl,
        siteUrl,
      });

      const sendResult = await sendEmailDispatcher(
        matchedRecipients,
        `${isPinned ? '[Destaque] ' : ''}Novo Insight de Victor Poiani`,
        html
      );

      return NextResponse.json({ ok: sendResult.ok, errors: sendResult.errors });
    }

    return NextResponse.json({ ok: false, error: 'Ação inválida' }, { status: 400 });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Erro desconhecido na rota';
    console.error('[Newsletter API Error]:', msg);
    return NextResponse.json({ ok: false, error: msg }, { status: 500 });
  }
}