/**
 * Motor de moderação (só no servidor, com service role).
 *
 *   classify()       — regras locais + OpenAI (texto, texto desofuscado, imagens)
 *   moderateEntity() — lê a entidade, classifica, grava o veredito, audita e avisa
 *
 * Falhas: texto sem classificador → passa pelas regras locais e é aprovado, mas
 * fica na fila para nova checagem; mídia sem classificador → REVIEW (oculta).
 */
import type { SupabaseClient } from '@supabase/supabase-js';
import { normalizeText } from './normalize';
import { runLocalRules } from './rules';
import { mergeResults, moderateImageOpenAI, moderateTextOpenAI, openAiConfigured, type CategoryScores, type ProviderResult } from './openai';
import { decideFromRule, decideFromScores, userMessage, worst, type Decision, type Verdict } from './policy';
import { ENTITY_SELECT, inputFor, ownerOf, type EntityType, type ModerationInput } from './extract';

const MAX_IMAGES = 12;

export interface Classification {
  decision: Decision;
  scores: CategoryScores;
  provider: 'openai' | 'local' | 'openai+local';
  /** a análise ficou incompleta (erro/sem chave): manter na fila para tentar de novo */
  retry: boolean;
  errors: string[];
}

async function mapLimit<T, R>(items: T[], limit: number, fn: (t: T) => Promise<R>): Promise<R[]> {
  const out: R[] = new Array(items.length);
  let i = 0;
  await Promise.all(
    Array.from({ length: Math.min(limit, items.length) }, async () => {
      while (i < items.length) {
        const idx = i++;
        out[idx] = await fn(items[idx]);
      }
    })
  );
  return out;
}

export async function classify(input: ModerationInput): Promise<Classification> {
  const errors: string[] = [];
  const norm = normalizeText(input.text);

  // 1) regras locais (sempre)
  const hit = runLocalRules(norm.folded) || runLocalRules(norm.squeezed);
  if (hit) {
    return { decision: decideFromRule(hit.category), scores: {}, provider: 'local', retry: false, errors };
  }

  const decisions: Decision[] = [];
  let scores: CategoryScores = {};
  let retry = false;
  let usedOpenAI = false;

  // vídeos sem quadros não podem ser verificados
  if (input.unverifiedVideos.length) {
    decisions.push({ verdict: 'REVIEW', reason: 'media_unverified', categories: ['video:no_frames'] });
  }
  const images = input.images.slice(0, MAX_IMAGES);
  if (input.images.length > MAX_IMAGES) {
    decisions.push({ verdict: 'REVIEW', reason: 'media_unverified', categories: ['images:too_many'] });
  }

  if (!openAiConfigured()) {
    // sem classificador: texto segue (regras locais já passaram); mídia fica para a equipe
    if (images.length) decisions.push({ verdict: 'REVIEW', reason: 'media_unverified', categories: ['provider:missing'] });
    return { decision: worst(...decisions), scores, provider: 'local', retry: true, errors: ['OPENAI_API_KEY ausente'] };
  }

  // 2) texto: original + desofuscado (vale o pior)
  if (norm.clean) {
    try {
      const parts: ProviderResult[] = [await moderateTextOpenAI(norm.clean)];
      if (norm.folded && norm.folded !== norm.clean.toLowerCase()) parts.push(await moderateTextOpenAI(norm.folded));
      const merged = mergeResults(parts);
      scores = { ...merged.scores };
      decisions.push(decideFromScores(merged.scores, norm.obfuscated));
      usedOpenAI = true;
    } catch (e) {
      errors.push(`text: ${e instanceof Error ? e.message : e}`);
      retry = true; // aprovado pelas regras locais, mas checa de novo depois
    }
  }

  // 3) imagens (e quadros de vídeo)
  if (images.length) {
    const results = await mapLimit(images, 4, async (url) => {
      try {
        return { url, r: await moderateImageOpenAI(url) };
      } catch (e) {
        return { url, err: e instanceof Error ? e.message : String(e) };
      }
    });
    for (const res of results) {
      if ('r' in res && res.r) {
        usedOpenAI = true;
        for (const [k, v] of Object.entries(res.r.scores)) scores[`img:${k}`] = Math.max(scores[`img:${k}`] ?? 0, v);
        decisions.push(decideFromScores(res.r.scores));
      } else {
        errors.push(`image ${res.url.slice(-40)}: ${'err' in res ? res.err : 'falhou'}`);
        decisions.push({ verdict: 'REVIEW', reason: 'media_unverified', categories: ['image:error'] });
        retry = true;
      }
    }
  }

  return { decision: worst(...decisions), scores, provider: usedOpenAI ? 'openai+local' : 'local', retry, errors };
}

/* -------------------------------------------------------------------------- */

const STATUS: Record<Verdict, { status: string; nsfw: boolean }> = {
  ALLOW: { status: 'approved', nsfw: false },
  NSFW: { status: 'approved', nsfw: true },
  REVIEW: { status: 'review', nsfw: false },
  BLOCK: { status: 'blocked', nsfw: false },
};

export interface ModerationOutcome {
  entityType: EntityType;
  entityId: string;
  verdict: Verdict;
  status: string;
  isNsfw: boolean;
  reason: string;
  message: string;
  skipped?: 'missing' | 'unchanged';
}

async function notifyUser(admin: SupabaseClient, profileId: string | null, text: string, postId?: string | null) {
  if (!profileId) return;
  await admin
    .from('notifications')
    .insert({ recipient_id: profileId, actor_id: profileId, type: 'system', post_id: postId ?? null, content_preview: text.slice(0, 300), message: text })
    .then(() => undefined, () => undefined);
}

/**
 * Modera uma entidade e grava o resultado. Idempotente: se o conteúdo não mudou
 * desde o último veredito, só devolve o estado atual (a menos que force=true).
 */
export async function moderateEntity(
  admin: SupabaseClient,
  type: EntityType,
  id: string,
  opts: { force?: boolean; notify?: boolean } = {}
): Promise<ModerationOutcome> {
  const { table, columns } = ENTITY_SELECT[type];
  const { data: row } = await admin.from(table).select(columns).eq('id', id).maybeSingle();
  const { data: queued } = await admin
    .from('moderation_queue')
    .select('content_hash, previous, attempts')
    .eq('entity_type', type)
    .eq('entity_id', id)
    .maybeSingle();

  if (!row) {
    await admin.from('moderation_queue').delete().eq('entity_type', type).eq('entity_id', id);
    return { entityType: type, entityId: id, verdict: 'ALLOW', status: 'missing', isNsfw: false, reason: 'none', message: '', skipped: 'missing' };
  }
  const r = row as unknown as Record<string, unknown>;
  const owner = ownerOf(type, r);

  // nada na fila e já decidido: devolve o estado atual
  if (!queued && !opts.force && type !== 'profile' && r.moderation_status !== 'pending') {
    const verdict: Verdict = r.moderation_status === 'blocked' ? 'BLOCK' : r.moderation_status === 'approved' ? (r.is_nsfw ? 'NSFW' : 'ALLOW') : 'REVIEW';
    return {
      entityType: type,
      entityId: id,
      verdict,
      status: String(r.moderation_status),
      isNsfw: Boolean(r.is_nsfw),
      reason: '',
      message: userMessage({ verdict, reason: 'none', categories: [] }, type),
      skipped: 'unchanged',
    };
  }

  const input = inputFor(type, r);
  const result = await classify(input);
  let decision = result.decision;

  // perfil é vitrine pública: nada de +18 em nome/foto/capa
  if (type === 'profile' && decision.verdict === 'NSFW') decision = { ...decision, verdict: 'BLOCK' };
  // perfil em dúvida: continua no ar (pós-moderação), mas a equipe vê no log
  const profileReview = type === 'profile' && decision.verdict === 'REVIEW';

  const now = new Date().toISOString();
  const s = STATUS[decision.verdict];

  if (type === 'profile') {
    if (decision.verdict === 'BLOCK') {
      // reverte só o que violou: cada imagem é checada sozinha; textos voltam ao
      // valor anterior (se o anterior também passar) ou ficam neutros
      const prev = (queued?.previous || {}) as Record<string, string | null>;
      const patch: Record<string, unknown> = {};
      const textKeys = ['display_name', 'full_name', 'nickname', 'bio'] as const;
      const textNow = textKeys.map((k) => String(r[k] ?? '')).join('\n');
      const textBad = textNow.trim() ? (await classify({ text: textNow, images: [], unverifiedVideos: [] })).decision.verdict !== 'ALLOW' : false;
      if (textBad) {
        const prevText = textKeys.map((k) => prev[k] || '').join('\n');
        const prevOk = prevText.trim() ? (await classify({ text: prevText, images: [], unverifiedVideos: [] })).decision.verdict === 'ALLOW' : true;
        for (const k of textKeys) patch[k] = prevOk ? prev[k] ?? null : k === 'bio' ? null : (r.username as string) ?? null;
      }
      for (const k of ['avatar_url', 'cover_url', 'banner_url'] as const) {
        const url = r[k] as string | null;
        if (!url || !/^https?:\/\//.test(url)) continue;
        const v = (await classify({ text: '', images: [url], unverifiedVideos: [] })).decision.verdict;
        if (v === 'BLOCK' || v === 'NSFW') patch[k] = null;
      }
      if (!Object.keys(patch).length) {
        // não deu para apontar o campo: volta tudo ao anterior
        for (const k of [...textKeys, 'avatar_url', 'cover_url', 'banner_url']) patch[k] = prev[k] ?? null;
      }
      await admin.from('profiles').update(patch).eq('id', id);
    }
  } else {
    await admin
      .from(table)
      .update({
        moderation_status: s.status,
        is_nsfw: s.nsfw,
        moderation_reason: decision.verdict === 'ALLOW' ? null : decision.reason,
        moderation_categories: { decided: decision.categories, scores: result.scores },
        flagged_at: decision.verdict === 'ALLOW' ? null : now,
        moderated_at: now,
      })
      .eq('id', id);

    // resposta retida: apaga os avisos que já tinham saído com o texto dela
    if (type === 'reply' && (decision.verdict === 'BLOCK' || decision.verdict === 'REVIEW')) {
      const since = new Date(new Date(String(r.created_at)).getTime() - 5000).toISOString();
      await admin
        .from('notifications')
        .delete()
        .eq('post_id', r.post_id as string)
        .eq('actor_id', owner as string)
        .in('type', ['reply', 'mention'])
        .gte('created_at', since);
    }
  }

  // auditoria
  await admin.from('moderation_logs').insert({
    entity_type: type,
    entity_id: id,
    profile_id: owner,
    verdict: decision.verdict,
    action: result.provider === 'local' && result.retry ? 'fallback' : 'auto',
    reason: decision.reason,
    categories: decision.categories,
    scores: result.scores,
    provider: result.provider,
    content_hash: (queued?.content_hash as string) || (r.moderation_hash as string) || null,
    excerpt: input.text.slice(0, 500),
    media_urls: [...input.images, ...input.unverifiedVideos].slice(0, 20),
  });

  // fila: sai quando a análise foi completa; senão, conta a tentativa
  if (result.retry && (queued?.attempts ?? 0) < 5) {
    await admin
      .from('moderation_queue')
      .update({ attempts: (queued?.attempts ?? 0) + 1, last_error: result.errors.join(' | ').slice(0, 500) })
      .eq('entity_type', type)
      .eq('entity_id', id);
  } else {
    await admin.from('moderation_queue').delete().eq('entity_type', type).eq('entity_id', id);
  }

  const message = profileReview ? 'Alteração do perfil registrada.' : userMessage(decision, type);
  if (opts.notify !== false && (decision.verdict === 'BLOCK' || (decision.verdict === 'REVIEW' && !profileReview))) {
    const postId = type === 'post' ? id : type === 'reply' ? (r.post_id as string) : null;
    await notifyUser(admin, owner, message, postId);
  }

  return {
    entityType: type,
    entityId: id,
    verdict: decision.verdict,
    status: type === 'profile' ? (decision.verdict === 'BLOCK' ? 'reverted' : 'approved') : s.status,
    isNsfw: s.nsfw,
    reason: decision.reason,
    message,
  };
}

/** Processa itens da fila (por perfil ou geral). */
export async function processQueue(admin: SupabaseClient, opts: { profileId?: string; limit?: number } = {}) {
  let q = admin
    .from('moderation_queue')
    .select('entity_type, entity_id, attempts, enqueued_at')
    .lt('attempts', 6)
    .order('enqueued_at', { ascending: true })
    .limit(opts.limit ?? 10);
  if (opts.profileId) q = q.eq('profile_id', opts.profileId);
  const { data } = await q;
  const done: ModerationOutcome[] = [];
  for (const item of data || []) {
    try {
      done.push(await moderateEntity(admin, item.entity_type as EntityType, item.entity_id as string));
    } catch (e) {
      await admin
        .from('moderation_queue')
        .update({ attempts: (item.attempts as number) + 1, last_error: (e instanceof Error ? e.message : String(e)).slice(0, 500) })
        .eq('entity_type', item.entity_type)
        .eq('entity_id', item.entity_id);
    }
  }
  return done;
}
