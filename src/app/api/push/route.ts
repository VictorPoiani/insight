import { NextRequest, NextResponse } from 'next/server';
import { setVapidDetails, sendNotification } from 'web-push';
import { createClient } from '@supabase/supabase-js';
import { createServerSupabase } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import crypto from 'crypto';

export const runtime = 'nodejs';

const VAPID_PUBLIC_KEY = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY || '';

// A chave privada NUNCA fica no código (o repositório é público): só pela variável de ambiente.
const VAPID_PRIVATE_KEY = process.env.VAPID_PRIVATE_KEY || '';

const VAPID_SUBJECT =
  process.env.VAPID_SUBJECT || 'mailto:contato.insightproject@gmail.com';

// sem as chaves configuradas o push fica desligado (em vez de usar uma chave vazada)
const PUSH_READY = Boolean(VAPID_PUBLIC_KEY && VAPID_PRIVATE_KEY);
if (PUSH_READY) setVapidDetails(VAPID_SUBJECT, VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY);

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
    if (!PUSH_READY && action !== 'unsubscribe') {
      return NextResponse.json({ error: 'Notificações push indisponíveis no momento.' }, { status: 503 });
    }

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

      // vincula o aparelho ao perfil logado (posts notificam só seguidores)
      const authedSub = await createServerSupabase();
      const {
        data: { user: subUser },
      } = await authedSub.auth.getUser();
      const { data: subProfile } = subUser
        ? await authedSub.from('profiles').select('id').or(`user_id.eq.${subUser.id},id.eq.${subUser.id}`).maybeSingle()
        : { data: null };

      const fullPayload = {
        profile_id: subProfile?.id ?? null,
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

    // 3a. NOVO POST: só os aparelhos de quem SEGUE o autor
    if (action === 'new_post') {
      const postId = String(body.postId || '');
      const authed = await createServerSupabase();
      const {
        data: { user: caller },
      } = await authed.auth.getUser();
      if (!caller || !/^[0-9a-f-]{36}$/i.test(postId)) {
        return NextResponse.json({ error: 'Post inválido.' }, { status: 400 });
      }
      const admin = createAdminClient();
      const { data: post } = await admin
        .from('posts')
        .select('id, profile_id, author_id, content, visibility, is_draft, moderation_status, is_nsfw')
        .eq('id', postId)
        .maybeSingle();
      // só conteúdo aprovado pela moderação gera aviso; +18 vai sem o texto
      if (!post || post.visibility === 'private' || post.is_draft || post.moderation_status !== 'approved') return NextResponse.json({ sent: 0 });
      if (post.is_nsfw) post.content = '[Conteúdo +18]';
      const { data: author } = await admin
        .from('profiles')
        .select('id, user_id, display_name, full_name, username')
        .eq('id', post.profile_id || post.author_id)
        .maybeSingle();
      if (!author || (author.user_id !== caller.id && author.id !== caller.id)) {
        return NextResponse.json({ error: 'Não autorizado.' }, { status: 403 });
      }
      const marker = crypto.createHash('sha256').update(`push:${post.id}`).digest('hex');
      const { count: already } = await admin
        .from('account_email_log')
        .select('id', { count: 'exact', head: true })
        .eq('email_hash', marker)
        .eq('kind', 'push-post');
      if ((already ?? 0) > 0) return NextResponse.json({ sent: 0, duplicate: true });
      await admin.from('account_email_log').insert({ email_hash: marker, kind: 'push-post' });

      const { data: follows } = await admin.from('follows').select('follower_id').eq('following_id', author.id);
      const followerIds = (follows || []).map((f) => f.follower_id);
      if (followerIds.length === 0) return NextResponse.json({ sent: 0 });
      const { data: subs } = await admin
        .from('push_subscriptions')
        .select('endpoint, p256dh, auth, notify_mode')
        .in('profile_id', followerIds);

      const name = author.display_name || author.full_name || author.username;
      let sent = 0;
      await Promise.allSettled(
        (subs || [])
          .filter((sub) => sub.notify_mode !== 'official_only')
          .map(async (sub) => {
            try {
              await sendNotification(
                { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } },
                JSON.stringify({
                  title: `${name} publicou um novo insight`,
                  body: String(post.content || '').slice(0, 160),
                  url: `/post/${post.id}`,
                  tag: `insight-post-${post.id}`,
                })
              );
              sent++;
            } catch (err: any) {
              if (err?.statusCode === 404 || err?.statusCode === 410) {
                await admin.from('push_subscriptions').delete().eq('endpoint', sub.endpoint);
              }
            }
          })
      );
      return NextResponse.json({ sent });
    }

    // 3b. DISPARO GERAL (atualizações oficiais / avisos): só admin
    if (action === 'broadcast') {
      // Envio para todos os aparelhos: só admin
      const authed = await createServerSupabase();
      const {
        data: { user: caller },
      } = await authed.auth.getUser();
      const { data: me } = caller
        ? await authed.from('profiles').select('role').or(`user_id.eq.${caller.id},id.eq.${caller.id}`).maybeSingle()
        : { data: null };
      if (me?.role !== 'admin') {
        return NextResponse.json({ error: 'Não autorizado.' }, { status: 403 });
      }

      const {
        title = 'Novo Insight publicado — Victor Poiani',
        message = 'Confira o novo Insight publicado.',
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