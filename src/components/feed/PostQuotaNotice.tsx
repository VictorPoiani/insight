'use client';

import { brTime, timeLeft, type PostQuota } from '@/lib/postQuota';

/** Aviso do limite de publicação: sóbrio, borda fina, ícone de relógio em traço. */
export function PostQuotaNotice({ quota, block, now }: { quota: PostQuota; block: 'day' | 'hour'; now: number }) {
  return (
    <div role="status" className="flex items-start gap-3 rounded-xl border border-border bg-surface/60 px-4 py-3">
      <svg viewBox="0 0 24 24" className="w-4 h-4 mt-0.5 shrink-0 text-secondary" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <circle cx="12" cy="12" r="8.75" />
        <path d="M12 7.5V12l3 2" />
      </svg>
      <div className="min-w-0 text-xs leading-relaxed">
        {block === 'day' ? (
          <>
            <p className="font-semibold text-primary">Limite diário alcançado</p>
            <p className="text-secondary">
              Você publicou {quota.dayCount} de {quota.dayLimit} Insights hoje. Poderá voltar a publicar a partir das{' '}
              <span className="text-primary font-medium">03:00</span> (horário de Brasília), em {timeLeft(quota.dayResetAt, now)}.
            </p>
          </>
        ) : (
          <>
            <p className="font-semibold text-primary">Limite de {quota.hourLimit} posts por hora atingido</p>
            <p className="text-secondary">
              A próxima publicação libera às <span className="text-primary font-medium">{brTime(quota.hourFreeAt as Date)}</span>{' '}
              (horário de Brasília), daqui a {timeLeft(quota.hourFreeAt as Date, now)}.
            </p>
          </>
        )}
      </div>
    </div>
  );
}
