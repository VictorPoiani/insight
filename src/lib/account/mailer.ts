import nodemailer from 'nodemailer';

/**
 * Envio de e-mails de CONTA (verificação, recuperação de senha).
 * Mesmos provedores da newsletter, na ordem: Brevo → Gmail → Resend.
 * (O SMTP padrão da Supabase só entrega para a equipe do projeto.)
 */
export async function sendAccountEmail(to: string, subject: string, html: string, text: string) {
  const errors: string[] = [];

  const brevoUser = process.env.BREVO_SMTP_USER?.trim();
  const brevoPass = process.env.BREVO_SMTP_KEY?.trim();
  if (brevoUser && brevoPass) {
    const sender = process.env.BREVO_SENDER_EMAIL?.trim() || process.env.GMAIL_USER?.trim();
    try {
      const t = nodemailer.createTransport({ host: 'smtp-relay.brevo.com', port: 587, secure: false, auth: { user: brevoUser, pass: brevoPass } });
      await t.sendMail({ from: `"Insight*" <${sender}>`, to, subject, html, text });
      t.close();
      return { ok: true as const, provider: 'brevo' };
    } catch (e) {
      errors.push(`brevo: ${e instanceof Error ? e.message : e}`);
    }
  }

  const gmailUser = process.env.GMAIL_USER?.trim();
  const gmailPass = process.env.GMAIL_APP_PASSWORD?.replace(/\s+/g, '');
  if (gmailUser && gmailPass) {
    try {
      const t = nodemailer.createTransport({ service: 'gmail', host: 'smtp.gmail.com', port: 465, secure: true, auth: { user: gmailUser, pass: gmailPass } });
      await t.sendMail({ from: `"Insight*" <${gmailUser}>`, to, subject, html, text });
      t.close();
      return { ok: true as const, provider: 'gmail' };
    } catch (e) {
      errors.push(`gmail: ${e instanceof Error ? e.message : e}`);
    }
  }

  const resendKey = process.env.RESEND_API_KEY?.trim();
  if (resendKey) {
    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { Authorization: `Bearer ${resendKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        from: process.env.RESEND_FROM_EMAIL?.trim() || 'Insight* <onboarding@resend.dev>',
        to: [to],
        subject,
        html,
        text,
      }),
    });
    if (res.ok) return { ok: true as const, provider: 'resend' };
    errors.push(`resend: ${res.status}`);
  }

  console.error('[account mailer] falha ao enviar:', errors.join(' | ') || 'nenhum provedor configurado');
  return { ok: false as const, provider: null };
}

/**
 * Endereço público do site para links de e-mail. Nunca vem de cabeçalhos da
 * requisição (evita links envenenados). Em produção ignora valores locais.
 */
export function siteUrl() {
  const onVercel = Boolean(process.env.VERCEL);
  const explicit = process.env.NEXT_PUBLIC_SITE_URL?.trim().replace(/\/$/, '');
  const explicitOk = explicit && /^https?:\/\//.test(explicit) && !(onVercel && /localhost|127\.0\.0\.1|^http:/.test(explicit));
  if (explicitOk) return explicit!;
  if (process.env.VERCEL_PROJECT_PRODUCTION_URL) return `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}`;
  if (process.env.VERCEL_URL) return `https://${process.env.VERCEL_URL}`;
  return explicit || 'http://localhost:3000';
}

/** Layout simples dos e-mails de conta (escapa só o que vem de fora: o link é nosso). */
export function accountEmailHtml(title: string, body: string, cta: string, link: string) {
  return `<!doctype html><html><body style="margin:0;background:#09090b;font-family:system-ui,-apple-system,Segoe UI,sans-serif">
<div style="max-width:480px;margin:0 auto;padding:32px 20px">
  <p style="margin:0 0 18px;font-size:22px;font-weight:800;color:#fff">Insight<span style="color:#3b82f6">*</span></p>
  <div style="background:#18181b;border:1px solid #27272a;border-radius:16px;padding:24px">
    <h1 style="margin:0 0 10px;font-size:18px;color:#fff">${title}</h1>
    <p style="margin:0 0 20px;font-size:14px;line-height:1.6;color:#a1a1aa">${body}</p>
    <a href="${link}" style="display:inline-block;padding:12px 20px;border-radius:999px;background:#2563eb;color:#fff;font-weight:700;font-size:14px;text-decoration:none">${cta}</a>
    <p style="margin:20px 0 0;font-size:11px;color:#71717a;word-break:break-all">Se o botão não funcionar, copie: ${link}</p>
  </div>
  <p style="margin:16px 0 0;font-size:11px;color:#52525b">Não foi você? Ignore este e-mail — nada muda na sua conta.</p>
</div></body></html>`;
}
