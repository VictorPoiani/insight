'use client';

import { createClient } from '@/lib/supabase/client';

/** Situação dos limites de publicação (3 por hora, 10 por dia; o dia vira às 03:00 de Brasília). */
export interface PostQuota {
  exempt: boolean;
  hourCount: number;
  hourLimit: number;
  dayCount: number;
  dayLimit: number;
  /** quando a vaga mais antiga da última hora libera */
  hourFreeAt: Date | null;
  /** próxima virada do dia (03:00 de Brasília) */
  dayResetAt: Date;
}

type Raw = {
  exempt: boolean;
  hour_count: number;
  hour_limit: number;
  day_count: number;
  day_limit: number;
  hour_free_at: string | null;
  day_reset_at: string;
};

export async function fetchPostQuota(): Promise<PostQuota | null> {
  const { data, error } = await createClient().rpc('post_quota_status');
  if (error || !data) return null;
  const r = data as Raw;
  return {
    exempt: Boolean(r.exempt),
    hourCount: Number(r.hour_count) || 0,
    hourLimit: Number(r.hour_limit) || 3,
    dayCount: Number(r.day_count) || 0,
    dayLimit: Number(r.day_limit) || 10,
    hourFreeAt: r.hour_free_at ? new Date(r.hour_free_at) : null,
    dayResetAt: new Date(r.day_reset_at),
  };
}

/** 'day' | 'hour' quando está travado agora; null quando pode publicar. */
export function quotaBlock(q: PostQuota | null, now = Date.now()): 'day' | 'hour' | null {
  if (!q || q.exempt) return null;
  if (q.dayCount >= q.dayLimit && q.dayResetAt.getTime() > now) return 'day';
  if (q.hourCount >= q.hourLimit && q.hourFreeAt && q.hourFreeAt.getTime() > now) return 'hour';
  return null;
}

/** Horário no fuso de Brasília (o mesmo do reset), ex.: "14:37". */
export function brTime(d: Date) {
  return d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit', timeZone: 'America/Sao_Paulo' });
}

/** "47 min" / "1 h 05 min" até a data. */
export function timeLeft(d: Date, now = Date.now()) {
  const mins = Math.max(1, Math.ceil((d.getTime() - now) / 60_000));
  if (mins < 60) return `${mins} min`;
  return `${Math.floor(mins / 60)} h ${String(mins % 60).padStart(2, '0')} min`;
}
