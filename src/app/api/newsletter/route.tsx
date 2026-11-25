import { NextResponse } from 'next/server';
import { siteUrl } from '@/lib/account/mailer';
import { createAdminClient } from '@/lib/supabase/admin';
import crypto from 'crypto';
import { createServerSupabase } from '@/lib/supabase/server';
import { createClient } from '@supabase/supabase-js';
import nodemailer from 'nodemailer';
import { setVapidDetails, sendNotification } from 'web-push';
import { PostBlock } from '@/types/database';

export const runtime = 'nodejs';
export const maxDuration = 60;

const VAPID_PUBLIC_KEY = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY || '';

// A chave privada NUNCA fica no código (o repositório é público): só pela variável de ambiente.
const VAPID_PRIVATE_KEY = process.env.VAPID_PRIVATE_KEY || '';

const VAPID_SUBJECT =
  process.env.VAPID_SUBJECT || 'mailto:contato.insightproject@gmail.com';

if (VAPID_PUBLIC_KEY && VAPID_PRIVATE_KEY) {
  // sem as chaves configuradas o push fica desligado (em vez de usar uma chave vazada)
const PUSH_READY = Boolean(VAPID_PUBLIC_KEY && VAPID_PRIVATE_KEY);
if (PUSH_READY) setVapidDetails(VAPID_SUBJECT, VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY);
}

interface NewsletterPayload {
  action: 'welcome' | 'new_post' | 'official_update';
  email?: string;
  notifyMode?: 'all' | 'tags' | 'pinned' | 'official_only';
  interestedTags?: string[];
  postTitle?: string;
  postContent?: string;
  postTags?: string[];
  postId?: string;
  postBlocks?: PostBlock[];
  isPinned?: boolean;
}

function getSupabaseClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
  const key =
    process.env.SUPABASE_SERVICE_ROLE_KEY ||
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
    '';
  return createClient(url, key, {
    auth: { persistSession: false },
  });
}

function resolveSiteUrl() {
  return siteUrl();
}


function createBrevoTransporter() {
  const user = process.env.BREVO_SMTP_USER?.trim();
  const pass = process.env.BREVO_SMTP_KEY?.trim();
  if (!user || !pass) return null;

  return nodemailer.createTransport({
    host: 'smtp-relay.brevo.com',
    port: 587,
    secure: false,
    auth: { user, pass },
    tls: { rejectUnauthorized: false },
  });
}

function createGmailTransporter() {
  const gmailUser = process.env.GMAIL_USER?.trim();
  const gmailPass = process.env.GMAIL_APP_PASSWORD?.replace(/\s+/g, '');
  if (!gmailUser || !gmailPass) return null;

  return nodemailer.createTransport({
    service: 'gmail',
    host: 'smtp.gmail.com',
    port: 465,
    secure: true,
    auth: { user: gmailUser, pass: gmailPass },
    tls: { rejectUnauthorized: false },
  });
}

function sanitizeEmailList(emails: string[]): string[] {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  const unique = new Set<string>();

  for (const raw of emails) {
    if (!raw || typeof raw !== 'string') continue;
    const clean = raw.trim().toLowerCase();
    if (emailRegex.test(clean)) {
      unique.add(clean);
    }
  }
  return Array.from(unique);
}

function chunkArray<T>(list: T[], size: number): T[][] {
  const chunks: T[][] = [];
  for (let i = 0; i < list.length; i += size) {
    chunks.push(list.slice(i, i + size));
  }
  return chunks;
}

// Diagnóstico ao vivo: abra http://localhost:3000/api/newsletter no navegador
export async function GET() {
  // Diagnóstico só para admin (expunha provedores e erros de SMTP a qualquer um)
  const supa = await createServerSupabase();
  const {
    data: { user },
  } = await supa.auth.getUser();
  const { data: me } = user
    ? await supa.from('profiles').select('role').or(`user_id.eq.${user.id},id.eq.${user.id}`).maybeSingle()
    : { data: null };
  if (me?.role !== 'admin') {
    return NextResponse.json({ error: 'Não autorizado.' }, { status: 403 });
  }

  const brevoTransporter = createBrevoTransporter();
  const gmailTransporter = createGmailTransporter();
  const resendKey = process.env.RESEND_API_KEY?.trim();

  let brevoVerified = false;
  let brevoError: string | null = null;
  if (brevoTransporter) {
    try {
      await brevoTransporter.verify();
      brevoVerified = true;
    } catch (err: any) {
      brevoError = err?.message || String(err);
    } finally {
      brevoTransporter.close();
    }
  }

  let gmailVerified = false;
  let gmailError: string | null = null;
  if (gmailTransporter) {
    try {
      await gmailTransporter.verify();
      gmailVerified = true;
    } catch (err: any) {
      gmailError = err?.message || String(err);
    } finally {
      gmailTransporter.close();
    }
  }

  return NextResponse.json({
    status: brevoVerified || gmailVerified ? '100% Operacional' : 'Aguardando configuração SMTP',
    activeProvider: brevoVerified
      ? 'Brevo SMTP Relay (300 e-mails/dia grátis)'
      : gmailVerified
      ? 'Gmail SMTP'
      : 'Resend Sandbox',
    brevoConfigured: Boolean(brevoTransporter),
    brevoVerified,
    brevoError,
    gmailConfigured: Boolean(gmailTransporter),
    gmailVerified,
    gmailError,
    resendConfigured: Boolean(resendKey),
  });
}

/** Escapa texto vindo de usuários antes de entrar no HTML do e-mail. */
function esc(v?: string | null): string {
  return String(v ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

/** HTML rico dos blocos: só formatação básica, sem atributos (sem links/scripts/estilos). */
function safeHtml(v?: string | null): string {
  const text = String(v ?? '').replace(/&nbsp;/g, ' ');
  const allowed = /^(b|strong|i|em|u|s|strike|br|code|mark)$/i;
  return esc(text.replace(/<\/?([a-z0-9]+)[^>]*>/gi, (tag, name: string) =>
    allowed.test(name) ? `\u0000${tag.startsWith('</') ? '/' : ''}${name.toLowerCase()}\u0001` : ''
  ))
    .replace(/\u0000(\/?)([a-z]+)\u0001/g, (_m, slash: string, name: string) => (name === 'br' ? '<br/>' : `<${slash}${name}>`));
}

function renderBlocksForEmail(blocks?: PostBlock[], fallbackText?: string): string {
  if (!Array.isArray(blocks) || blocks.length === 0) {
    return `<p style="margin: 0; font-size: 15px; line-height: 1.7; color: #e4e4e7; white-space: pre-line;">${
      esc(fallbackText)
    }</p>`;
  }

  return blocks
    .map((b) => {
      if (b.type === 'divider') {
        return `<hr style="border: 0; border-top: 1px solid #27272a; margin: 20px 0;" />`;
      }
      if (b.type === 'h1') {
        return `<h2 style="margin: 18px 0 8px 0; font-size: 22px; font-weight: 800; color: #ffffff;">${
          safeHtml(b.html)
        }</h2>`;
      }
      if (b.type === 'h2') {
        return `<h3 style="margin: 16px 0 6px 0; font-size: 18px; font-weight: 700; color: #f4f4f5;">${
          safeHtml(b.html)
        }</h3>`;
      }
      if (b.type === 'quote') {
        return `<blockquote style="margin: 14px 0; padding: 8px 16px; border-left: 4px solid #2563eb; color: #a1a1aa; font-style: italic; font-size: 15px;">${
          safeHtml(b.html)
        }</blockquote>`;
      }
      if (b.type === 'callout') {
        return `
          <div style="margin: 14px 0; padding: 14px 16px; background-color: #18181b; border: 1px solid rgba(37, 99, 235, 0.4); border-radius: 12px; color: #f4f4f5; font-size: 14px;">
            <span>${safeHtml(b.html)}</span>
          </div>
        `;
      }
      if (b.type === 'code') {
        return `<pre style="margin: 14px 0; padding: 14px; background-color: #18181b; border: 1px solid #27272a; border-radius: 10px; font-family: monospace; font-size: 12px; color: #38bdf8; overflow-x: auto; white-space: pre-wrap;">${
          safeHtml(b.html)
        }</pre>`;
      }
      if (b.type === 'bullet') {
        return `<p style="margin: 6px 0; font-size: 15px; color: #e4e4e7;"><span style="color: #2563eb; font-weight: bold; margin-right: 8px;">•</span>${
          safeHtml(b.html)
        }</p>`;
      }
      if (b.type === 'image' && b.imageUrl && /^https:\/\//.test(b.imageUrl)) {
        return `
          <div style="margin: 18px 0; text-align: center;">
            <img src="${esc(b.imageUrl)}" alt="${esc(b.imageCaption || 'Imagem do post')}" style="max-width: 100%; border-radius: 12px; border: 1px solid #27272a; display: block; margin: 0 auto;" />
            ${
              b.imageCaption
                ? `<p style="margin: 6px 0 0 0; font-size: 12px; color: #71717a;">${esc(b.imageCaption)}</p>`
                : ''
            }
          </div>
        `;
      }
      if (b.type === 'table' && Array.isArray(b.tableData)) {
        const rowsHtml = b.tableData
          .map(
            (row, rIdx) => `
            <tr>
              ${(Array.isArray(row) ? row : [])
                .map(
                  (cell) => `
                  <td style="padding: 8px 12px; border: 1px solid #27272a; font-size: 13px; color: ${
                    rIdx === 0 ? '#ffffff' : '#d4d4d8'
                  }; font-weight: ${rIdx === 0 ? '700' : '400'}; background-color: ${
                    rIdx === 0 ? '#18181b' : '#09090b'
                  };">
                    ${esc(cell)}
                  </td>`
                )
                .join('')}
            </tr>`
          )
          .join('');
        return `<table width="100%" cellpadding="0" cellspacing="0" style="border-collapse: collapse; margin: 16px 0; border-radius: 10px; overflow: hidden;">${rowsHtml}</table>`;
      }
      if (b.type === 'roadmap' && Array.isArray(b.roadmapSteps)) {
        const stepsHtml = b.roadmapSteps
          .map(
            (s: any) => `
            <div style="margin-bottom: 10px; padding: 12px; background-color: #18181b; border: 1px solid #27272a; border-radius: 10px;">
              <div style="font-family: monospace; font-size: 11px; font-weight: 700; color: #38bdf8; text-transform: uppercase;">${esc(s.phase)}</div>
              <div style="font-size: 14px; font-weight: 700; color: #ffffff; margin-top: 2px;">${esc(s.title)}</div>
              <div style="font-size: 13px; color: #a1a1aa; margin-top: 4px;">${esc(s.description)}</div>
            </div>`
          )
          .join('');
        return `<div style="margin: 16px 0;">${stepsHtml}</div>`;
      }
      if (b.type === 'poll' && b.pollQuestion) {
        const optsHtml = (b.pollOptions || [])
          .map(
            (o) =>
              `<div style="padding: 8px 12px; margin-top: 6px; background-color: #09090b; border: 1px solid #27272a; border-radius: 8px; font-size: 13px; color: #e4e4e7;">• ${esc(o.text)}</div>`
          )
          .join('');
        return `
          <div style="margin: 16px 0; padding: 14px; background-color: #18181b; border: 1px solid #27272a; border-radius: 12px;">
            <div style="font-size: 14px; font-weight: 700; color: #ffffff; margin-bottom: 6px;">📊 Enquete: ${esc(b.pollQuestion)}</div>
            ${optsHtml}
          </div>
        `;
      }
      return `<p style="margin: 0 0 12px 0; font-size: 15px; line-height: 1.7; color: #e4e4e7;">${
        safeHtml(b.html)
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
                  <a href="${siteUrl}/atualizacoes" style="color: #60a5fa; text-decoration: none; margin: 0 8px;">Mural Oficial</a> ·
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

async function sendEmailDispatcher(
  rawRecipients: string[],
  subject: string,
  html: string,
  fromName = 'Insight*'
) {
  // nome de exibição sem aspas/quebras (o endereço é sempre o do Insight)
  const safeFrom = fromName.replace(/["\r\n<>]/g, '').slice(0, 70) || 'Insight*';
  const recipients = sanitizeEmailList(rawRecipients);
  if (recipients.length === 0) {
    return { ok: true, sent: 0, errors: [] };
  }

  const errors: string[] = [];

  // CAMADA 1: BREVO SMTP RELAY
  const brevoTransporter = createBrevoTransporter();
  const brevoSender =
    process.env.BREVO_SENDER_EMAIL?.trim() ||
    process.env.GMAIL_USER?.trim() ||
    'contato.insightproject@gmail.com';

  if (brevoTransporter) {
    try {
      if (recipients.length === 1) {
        await brevoTransporter.sendMail({
          from: `"${safeFrom}" <${brevoSender}>`,
          to: recipients[0],
          subject,
          html,
        });
      } else {
        const batches = chunkArray(recipients, 45);
        for (const batch of batches) {
          await brevoTransporter.sendMail({
            from: `"${safeFrom}" <${brevoSender}>`,
            to: brevoSender,
            bcc: batch,
            subject,
            html,
          });
        }
      }
      brevoTransporter.close();
      return { ok: true, sent: recipients.length, errors: [] };
    } catch (brevoErr: any) {
      const msg = brevoErr?.message || String(brevoErr);
      errors.push(`Brevo: ${msg}`);
      brevoTransporter.close();
    }
  }

  // CAMADA 2: GMAIL SMTP
  const gmailTransporter = createGmailTransporter();
  const gmailUser = process.env.GMAIL_USER?.trim();

  if (gmailTransporter && gmailUser) {
    try {
      if (recipients.length === 1) {
        await gmailTransporter.sendMail({
          from: `"${safeFrom}" <${gmailUser}>`,
          to: recipients[0],
          subject,
          html,
        });
      } else {
        const batches = chunkArray(recipients, 45);
        for (const batch of batches) {
          await gmailTransporter.sendMail({
            from: `"${safeFrom}" <${gmailUser}>`,
            to: gmailUser,
            bcc: batch,
            subject,
            html,
          });
        }
      }
      gmailTransporter.close();
      return { ok: true, sent: recipients.length, errors: [] };
    } catch (smtpErr: any) {
      const msg = smtpErr?.message || String(smtpErr);
      errors.push(`Gmail SMTP: ${msg}`);
      gmailTransporter.close();
    }
  }

  // CAMADA 3: RESEND API
  const apiKey = process.env.RESEND_API_KEY?.trim();
  const fromEmail =
    process.env.RESEND_FROM_EMAIL?.trim() || 'Insight* <onboarding@resend.dev>';

  if (!apiKey) {
    return { ok: false, sent: 0, errors };
  }

  let sentViaResend = 0;

  for (const recipient of recipients) {
    try {
      const res = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          from: `${safeFrom} <${(fromEmail.match(/<([^>]+)>/)?.[1] || fromEmail).trim()}>`,
          to: [recipient],
          subject,
          html,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        errors.push(`Resend (${recipient}): ${data?.message || JSON.stringify(data)}`);
      } else {
        sentViaResend++;
      }
    } catch (err: any) {
      errors.push(err?.message || String(err));
    }
  }

  return {
    ok: sentViaResend > 0,
    sent: sentViaResend,
    errors,
  };
}

async function triggerWebPushForOfficialUpdate(
  supabase: ReturnType<typeof getSupabaseClient>,
  title: string,
  message: string
) {
  try {
    const { data: pushSubs } = await supabase
      .from('push_subscriptions')
      .select('*');

    if (!pushSubs || pushSubs.length === 0) return;

    await Promise.allSettled(
      pushSubs.map(async (sub: any) => {
        try {
          await sendNotification(
            {
              endpoint: sub.endpoint,
              keys: { p256dh: sub.p256dh, auth: sub.auth },
            },
            JSON.stringify({
              title,
              body: message.slice(0, 160),
              url: '/atualizacoes',
              tag: 'insight-official-update',
            })
          );
        } catch (err: any) {
          if (err?.statusCode === 404 || err?.statusCode === 410) {
            await supabase
              .from('push_subscriptions')
              .delete()
              .eq('endpoint', sub.endpoint);
          }
        }
      })
    );
  } catch {
    // Ignora falha silenciosa
  }
}

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as NewsletterPayload;
    const supabase = getSupabaseClient();
    const siteUrl = resolveSiteUrl();

    // Disparos em massa: só admin. Boas-vindas: só para quem está inscrito, 1x por dia.
    const authed = await createServerSupabase();
    const {
      data: { user: caller },
    } = await authed.auth.getUser();
    const { data: callerProfile } = caller
      ? await authed.from('profiles').select('role').or(`user_id.eq.${caller.id},id.eq.${caller.id}`).maybeSingle()
      : { data: null };
    const callerIsAdmin = callerProfile?.role === 'admin';

    if (body.action === 'official_update' && !callerIsAdmin) {
      return NextResponse.json({ error: 'Não autorizado.' }, { status: 403 });
    }

    if (body.action === 'welcome') {
      const email = String(body.email || '').trim().toLowerCase();
      const { data: sub } = await supabase.from('subscribers').select('email').eq('email', email).maybeSingle();
      if (!sub) return NextResponse.json({ ok: true, skipped: true });
      const emailHash = crypto.createHash('sha256').update(email).digest('hex');
      const { count } = await supabase
        .from('account_email_log')
        .select('id', { count: 'exact', head: true })
        .eq('email_hash', emailHash)
        .eq('kind', 'welcome')
        .gte('sent_at', new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString());
      if ((count ?? 0) > 0) return NextResponse.json({ ok: true, skipped: true });
      await supabase.from('account_email_log').insert({ email_hash: emailHash, kind: 'welcome' });
      body.email = email;
    }

    const { data: profile } = await supabase
      .from('profiles')
      .select('display_name, full_name, nickname, username, avatar_url')
      .eq('role', 'admin')
      .order('created_at', { ascending: true })
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
        .eq('moderation_status', 'approved')
        .eq('is_nsfw', false)
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

      return NextResponse.json(
        {
          ok: sendResult.ok,
          sent: sendResult.sent,
          error: sendResult.errors.join(' | '),
          errors: sendResult.errors,
        },
        { status: sendResult.ok ? 200 : 400 }
      );
    }

    if (body.action === 'official_update') {
      const { data: subs } = await supabase.from('subscribers').select('email');
      const recipients = (subs || []).map((s) => s.email);

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
        ctaUrl: `${siteUrl}/atualizacoes`,
        siteUrl,
      });

      const [, sendResult] = await Promise.all([
        triggerWebPushForOfficialUpdate(
          supabase,
          body.postTitle || '📣 Nova Atualização Oficial — Insight*',
          body.postContent || 'Confira as novidades publicadas no Mural Oficial.'
        ),
        recipients.length > 0
          ? sendEmailDispatcher(
              recipients,
              `[Atualização Oficial] ${body.postTitle || 'Novidades no Insight*'}`,
              html
            )
          : Promise.resolve({ ok: true, sent: 0, errors: [] }),
      ]);

      return NextResponse.json({
        ok: sendResult.ok,
        sent: sendResult.sent,
        errors: sendResult.errors,
      });
    }

    if (body.action === 'new_post') {
      // O conteúdo vem do BANCO (não do navegador) e o remetente é o autor real.
      const postId = String(body.postId || '');
      if (!/^[0-9a-f-]{36}$/i.test(postId) || !caller) {
        return NextResponse.json({ ok: false, error: 'Post inválido.' }, { status: 400 });
      }
      const admin = createAdminClient();
      const { data: post } = await admin
        .from('posts')
        .select('id, profile_id, author_id, content, blocks, tags, is_pinned, visibility, is_draft, moderation_status, is_nsfw')
        .eq('id', postId)
        .maybeSingle();
      // e-mail só com conteúdo aprovado e sem +18
      if (!post || post.visibility === 'private' || post.is_draft || post.moderation_status !== 'approved' || post.is_nsfw) {
        return NextResponse.json({ ok: true, sent: 0 });
      }
      const ownerId = post.profile_id || post.author_id;
      const { data: author } = await admin
        .from('profiles')
        .select('id, user_id, display_name, full_name, nickname, username, avatar_url')
        .eq('id', ownerId)
        .maybeSingle();
      const callerOwnsPost = author && (author.user_id === caller.id || author.id === caller.id);
      if (!author || (!callerOwnsPost && !callerIsAdmin)) {
        return NextResponse.json({ error: 'Não autorizado.' }, { status: 403 });
      }

      // um disparo por post
      const marker = crypto.createHash('sha256').update(`post:${post.id}`).digest('hex');
      const { count: already } = await admin
        .from('account_email_log')
        .select('id', { count: 'exact', head: true })
        .eq('email_hash', marker)
        .eq('kind', 'post');
      if ((already ?? 0) > 0) return NextResponse.json({ ok: true, sent: 0, duplicate: true });
      await admin.from('account_email_log').insert({ email_hash: marker, kind: 'post' });

      // seguidores do autor -> e-mails das contas
      const { data: follows } = await admin.from('follows').select('follower_id').eq('following_id', author.id);
      const followerIds = (follows || []).map((f) => f.follower_id);
      if (followerIds.length === 0) return NextResponse.json({ ok: true, sent: 0 });
      const { data: followerProfiles } = await admin
        .from('profiles')
        .select('id, user_id')
        .in('id', followerIds);
      const emails: string[] = [];
      for (const fp of followerProfiles || []) {
        const { data: u } = await admin.auth.admin.getUserById(fp.user_id || fp.id);
        if (u?.user?.email) emails.push(u.user.email.toLowerCase());
      }
      if (emails.length === 0) return NextResponse.json({ ok: true, sent: 0 });

      // consentimento: o seguidor precisa estar inscrito (e não em "só oficiais")
      const postTagsLower = (post.tags || []).map((t: string) => t.toLowerCase());
      const isPinned = Boolean(post.is_pinned);
      const { data: subs } = await admin
        .from('subscribers')
        .select('email, notify_mode, interested_tags')
        .in('email', emails);
      const matchedRecipients = (subs || [])
        .filter((sub) => {
          if (!sub.notify_mode || sub.notify_mode === 'all') return true;
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

      const postAuthorName = author.display_name || author.full_name || author.username;
      const richPostHtml = renderBlocksForEmail(post.blocks as PostBlock[], post.content);
      const tagsPillsHtml =
        postTagsLower.length > 0
          ? `<div style="margin-top: 16px;">${postTagsLower
              .map(
                (t: string) =>
                  `<span style="display: inline-block; background-color: #18181b; border: 1px solid #27272a; color: #60a5fa; font-size: 12px; font-weight: 700; padding: 4px 10px; border-radius: 999px; margin-right: 6px; margin-bottom: 6px;">#${esc(t)}</span>`
              )
              .join('')}</div>`
          : '';

      const html = buildMasterEmailTemplate({
        badgeText: isPinned ? 'Insight Fixado' : 'Novo Insight',
        headline: `${esc(postAuthorName)} publicou um novo insight`,
        authorName: esc(postAuthorName),
        authorNickname: esc(author.nickname || ''),
        authorHandle: esc(author.username),
        authorAvatar:
          author.avatar_url && /^https:\/\//.test(author.avatar_url)
            ? esc(author.avatar_url)
            : `https://ui-avatars.com/api/?name=${encodeURIComponent(postAuthorName)}&background=2563eb&color=fff&bold=true`,
        mainHtmlContent: `
          <div style="background-color: #121215; border: 1px solid #27272a; border-radius: 16px; padding: 22px;">
            ${richPostHtml}
            ${tagsPillsHtml}
          </div>
        `,
        ctaLabel: 'Ler e Responder na Thread',
        ctaUrl: `${siteUrl}/post/${post.id}`,
        siteUrl,
      });

      const sendResult = await sendEmailDispatcher(
        matchedRecipients,
        `${isPinned ? '[Destaque] ' : ''}Novo insight de ${postAuthorName}`.replace(/[\r\n]/g, ' '),
        html,
        `${postAuthorName} via Insight*`
      );

      return NextResponse.json({ ok: sendResult.ok, sent: sendResult.sent, errors: sendResult.errors });
    }

    return NextResponse.json({ ok: false, error: 'Ação inválida' }, { status: 400 });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Erro desconhecido na rota';
    return NextResponse.json({ ok: false, error: msg }, { status: 500 });
  }
}