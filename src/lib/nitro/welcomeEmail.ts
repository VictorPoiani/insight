/**
 * E-mail de boas-vindas do Insight Nitro (só no servidor).
 * Enviado uma única vez por perfil: a linha em nitro_welcome_emails é a trava.
 */
import type { SupabaseClient } from '@supabase/supabase-js';
import { sendAccountEmail, siteUrl } from '@/lib/account/mailer';

const esc = (s: string) => s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!);

export function nitroWelcomeHtml(name: string, link: string) {
  const perks = [
    ['🖼️', 'Molduras e aberturas animadas no perfil'],
    ['🎨', 'Temas, fundos e estilos de nome exclusivos'],
    ['🏷️', 'Tags e títulos para mostrar quem você é'],
    ['⚡', 'Selo Nitro ao lado do seu nome'],
  ]
    .map(
      ([icon, text]) =>
        `<tr><td style="padding:6px 10px 6px 0;font-size:18px;vertical-align:top">${icon}</td><td style="padding:6px 0;font-size:14px;color:#d4d4d8">${text}</td></tr>`
    )
    .join('');
  return `<!doctype html><html><body style="margin:0;background:#09090b;font-family:system-ui,-apple-system,Segoe UI,sans-serif">
<div style="max-width:520px;margin:0 auto;padding:32px 20px">
  <p style="margin:0 0 18px;font-size:22px;font-weight:800;color:#fff">Insight<span style="color:#3b82f6">*</span> <span style="color:#e879f9">Nitro</span></p>
  <div style="border-radius:18px;padding:2px;background:linear-gradient(90deg,#38bdf8,#e879f9,#fcd34d)">
    <div style="background:#18181b;border-radius:16px;padding:26px">
      <h1 style="margin:0 0 10px;font-size:20px;color:#fff">Bem-vindo ao Nitro, ${esc(name)}! ⚡</h1>
      <p style="margin:0 0 16px;font-size:14px;line-height:1.6;color:#a1a1aa">Sua assinatura está ativa. Obrigado por apoiar o Insight — você ajuda a manter a comunidade sem anúncios e sem algoritmo pago. Agora é com você:</p>
      <table role="presentation" style="border-collapse:collapse;margin:0 0 20px">${perks}</table>
      <a href="${link}" style="display:inline-block;padding:12px 22px;border-radius:999px;background:linear-gradient(90deg,#2563eb,#c026d3);color:#fff;font-weight:700;font-size:14px;text-decoration:none">Personalizar meu perfil</a>
      <p style="margin:20px 0 0;font-size:12px;line-height:1.6;color:#71717a">Dica: abra o provador no Insight Nitro para testar molduras e temas antes de aplicar. Você pode gerenciar ou cancelar a assinatura a qualquer momento no próprio Nitro.</p>
    </div>
  </div>
  <p style="margin:16px 0 0;font-size:11px;color:#52525b">Você recebeu este e-mail porque assinou o Insight Nitro.</p>
</div></body></html>`;
}

/** Envia o e-mail se ainda não foi enviado para este perfil. Nunca lança erro. */
export async function sendNitroWelcomeOnce(admin: SupabaseClient, profileId: string) {
  try {
    // trava: só quem conseguir inserir a linha envia
    const { data: claimed, error } = await admin
      .from('nitro_welcome_emails')
      .insert({ profile_id: profileId })
      .select('profile_id')
      .maybeSingle();
    if (error || !claimed) return { sent: false, reason: 'already_sent' };

    const { data: prof } = await admin
      .from('profiles')
      .select('user_id, display_name, full_name, username')
      .eq('id', profileId)
      .maybeSingle();
    const userId = prof?.user_id || profileId;
    const { data: u } = await admin.auth.admin.getUserById(userId);
    const to = u?.user?.email;
    if (!to) {
      await admin.from('nitro_welcome_emails').delete().eq('profile_id', profileId);
      return { sent: false, reason: 'no_email' };
    }

    const name = (prof?.display_name || prof?.full_name || prof?.username || 'membro').split(/\s+/)[0];
    const link = `${siteUrl()}/nitro`;
    const text = `Bem-vindo ao Insight Nitro, ${name}! Sua assinatura está ativa. Personalize seu perfil com molduras, aberturas, temas, estilos de nome, tags e títulos: ${link}`;
    const res = await sendAccountEmail(to, 'Bem-vindo ao Insight Nitro ⚡', nitroWelcomeHtml(name, link), text);
    if (!res.ok) {
      // libera a trava para tentar de novo na próxima sincronização
      await admin.from('nitro_welcome_emails').delete().eq('profile_id', profileId);
      return { sent: false, reason: 'send_failed' };
    }
    await admin.from('nitro_welcome_emails').update({ provider: res.provider }).eq('profile_id', profileId);
    return { sent: true };
  } catch (e) {
    console.error('[nitro welcome]', e instanceof Error ? e.message : e);
    return { sent: false, reason: 'error' };
  }
}
