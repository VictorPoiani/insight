import { NextRequest, NextResponse } from 'next/server';
import { setVapidDetails, sendNotification } from 'web-push';
import { createClient } from '@supabase/supabase-js';

export const runtime = 'nodejs';

const VAPID_PUBLIC_KEY =
  process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY ||
  'BGilUzY0daz-dWuBYeF7daX9tjFve3exE_StHwqBWnYiK1QHeeTcrObIX0Kwdi5UY8MPbRKw0Aza3Ps-MuvVMJI';

const VAPID_PRIVATE_KEY =
  process.env.VAPID_PRIVATE_KEY ||
  'vbhLMvBahKwhghOIIzE7GlTXBi8X0kBmZJvVQsP2AMo';

const VAPID_SUBJECT =
  process.env.VAPID_SUBJECT || 'mailto:contato.insightproject@gmail.com';

setVapidDetails(VAPID_SUBJECT, VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY);

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

export async function GET() {
  return NextResponse.json({
    ok: true,
    supabaseUrlConfigured: Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL),
    publicKey: VAPID_PUBLIC_KEY,
  });
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { action } = body;

    if (!process.env.NEXT_PUBLIC_SUPABASE_URL) {
      return NextResponse.json(
        { error: 'NEXT_PUBLIC_SUPABASE_URL não configurada no .env.local.' },
        { status: 500 }
      );
    }

    const supabase = getSupabaseClient();

    // 1. INSCREVER DISPOSITIVO NO WEB PUSH
    if (action === 'subscribe') {
      const { subscription, notifyMode = 'all', interestedTags = [] } = body;
      const endpoint = subscription?.endpoint;
      const p256dh = subscription?.keys?.p256dh;
      const auth = subscription?.keys?.auth;

      if (!endpoint || !p256dh || !auth) {
        return NextResponse.json(
          { error: 'Dados de inscrição Push incompletos.' },
          { status: 400 }
        );
      }

      const { data: existing, error: selectError } = await supabase
        .from('push_subscriptions')
        .select('id')
        .eq('endpoint', endpoint)
        .maybeSingle();

      if (selectError) {
        return NextResponse.json(
          {
            error:
              selectError.code === '42P01'
                ? 'A tabela "push_subscriptions" ainda não existe no Supabase. Rode o SQL no SQL Editor.'
                : `Erro Supabase (${selectError.code}): ${selectError.message}`,
          },
          { status: 500 }
        );
      }

      const fullPayload = {
        endpoint,
        p256dh,
        auth,
        notify_mode: notifyMode,
        interested_tags: interestedTags,
        user_agent: req.headers.get('user-agent') || 'Browser',
      };

      if (existing?.id) {
        const { error: updateError } = await supabase
          .from('push_subscriptions')
          .update(fullPayload)
          .eq('id', existing.id);

        if (updateError) {
          return NextResponse.json(
            { error: `Erro ao atualizar inscrição: ${updateError.message}` },
            { status: 500 }
          );
        }
      } else {
        let { error: insertError } = await supabase
          .from('push_subscriptions')
          .insert(fullPayload);

        if (insertError) {
          const retry = await supabase.from('push_subscriptions').insert({
            endpoint,
            p256dh,
            auth,
          });
          insertError = retry.error;
        }

        if (insertError) {
          return NextResponse.json(
            { error: `Erro ao guardar no Supabase: ${insertError.message}` },
            { status: 500 }
          );
        }
      }

      // Envia notificação imediata de boas-vindas
      try {
        await sendNotification(
          subscription,
          JSON.stringify({
            title: 'Alertas ativados no Insight* ⚡',
            body: 'Você receberá notificações instantâneas sempre que uma nova publicação ou atualização sair.',
            url: '/',
            tag: 'insight-welcome',
          })
        );
      } catch {
        // Ignora falha silenciosa no envio de boas-vindas
      }

      return NextResponse.json({ ok: true });
    }

    // 2. CANCELAR INSCRIÇÃO DO DISPOSITIVO
    if (action === 'unsubscribe') {
      const { endpoint } = body;
      if (endpoint) {
        await supabase
          .from('push_subscriptions')
          .delete()
          .eq('endpoint', endpoint);
      }
      return NextResponse.json({ ok: true });
    }

    // 3. DISPARAR NOTIFICAÇÃO PARA TODOS OS SEGUIDORES INSCRITOS
    if (action === 'broadcast') {
      const {
        title = 'Novo Insight publicado — Victor Poiani',
        message = 'Confira a nova publicação no Insight*.',
        url = '/',
        tags = [],
        isOfficialUpdate = false,
      } = body;

      const { data: subs, error } = await supabase
        .from('push_subscriptions')
        .select('*');

      if (error) {
        return NextResponse.json(
          { error: `Erro ao ler inscritos: ${error.message}` },
          { status: 500 }
        );
      }

      if (!subs || subs.length === 0) {
        return NextResponse.json({ sent: 0 });
      }

      const normalizedPostTags = Array.isArray(tags)
        ? tags.map((t: string) => t.toLowerCase())
        : [];

      let sentCount = 0;
      const expiredEndpoints: string[] = [];

      await Promise.allSettled(
        subs.map(async (sub: any) => {
          if (
            !isOfficialUpdate &&
            sub.notify_mode === 'tags' &&
            Array.isArray(sub.interested_tags) &&
            sub.interested_tags.length > 0
          ) {
            const hasMatch = sub.interested_tags.some((t: string) =>
              normalizedPostTags.includes(t.toLowerCase())
            );
            if (!hasMatch) return;
          }

          try {
            await sendNotification(
              {
                endpoint: sub.endpoint,
                keys: {
                  p256dh: sub.p256dh,
                  auth: sub.auth,
                },
              },
              JSON.stringify({
                title,
                body: message.slice(0, 160),
                url,
                tag: isOfficialUpdate ? 'insight-official-update' : 'insight-post',
              })
            );
            sentCount++;
          } catch (err: any) {
            if (err?.statusCode === 404 || err?.statusCode === 410) {
              expiredEndpoints.push(sub.endpoint);
            }
          }
        })
      );

      if (expiredEndpoints.length > 0) {
        await supabase
          .from('push_subscriptions')
          .delete()
          .in('endpoint', expiredEndpoints);
      }

      return NextResponse.json({ sent: sentCount, cleaned: expiredEndpoints.length });
    }

    return NextResponse.json({ error: 'Ação inválida' }, { status: 400 });
  } catch (err: any) {
    return NextResponse.json(
      { error: err?.message || 'Erro interno no servidor Push' },
      { status: 500 }
    );
  }
}