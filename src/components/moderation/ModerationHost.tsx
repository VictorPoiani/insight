'use client';

import { useEffect, useRef, useState } from 'react';
import { ShieldAlert, ShieldCheck, Clock3, EyeOff, X } from 'lucide-react';

export type ModerationKind = 'post' | 'reply' | 'topic' | 'profile';
export interface ModerationOutcome {
  entityType: ModerationKind;
  entityId: string;
  verdict: 'ALLOW' | 'NSFW' | 'REVIEW' | 'BLOCK';
  status: string;
  isNsfw: boolean;
  reason: string;
  message: string;
}

const RESULT_EVENT = 'insight-moderation-result';
const KICK_EVENT = 'insight-moderation-kick';

/**
 * Pede a moderação imediata de algo que a pessoa acabou de publicar e mostra o
 * resultado. Mesmo que falhe, o item continua oculto até a fila processar.
 */
export async function moderateNow(kind: ModerationKind, id: string): Promise<ModerationOutcome | null> {
  try {
    const res = await fetch('/api/moderation/check', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ kind, id }),
    });
    if (!res.ok) {
      kickModeration();
      return null;
    }
    const outcome = (await res.json()) as ModerationOutcome;
    window.dispatchEvent(new CustomEvent(RESULT_EVENT, { detail: outcome }));
    window.dispatchEvent(new CustomEvent('insight-moderation-updated', { detail: outcome }));
    return outcome;
  } catch {
    kickModeration();
    return null;
  }
}

/** Pede para processar a fila do usuário (perfil e tópicos usam isso). */
export function kickModeration() {
  window.dispatchEvent(new Event(KICK_EVENT));
}

/** Mensagens de erro do banco (limites) em português claro. */
export function moderationErrorMessage(err: { message?: string; hint?: string } | null | undefined): string | null {
  const m = `${err?.message || ''}`;
  if (/moderation_cooldown/.test(m)) return err?.hint || 'Muitos conteúdos bloqueados em sequência. Tente de novo em 1 hora.';
  if (/post_rate_day/.test(m)) return 'Limite de 10 posts por dia alcançado. Você poderá publicar de novo a partir das 03:00 (horário de Brasília).';
  if (/post_rate_hour/.test(m)) return 'Limite de 3 posts por hora atingido. Tente de novo em alguns minutos.';
  if (/rate_limited/.test(m)) return err?.hint || 'Você publicou muito em pouco tempo. Aguarde alguns minutos.';
  return null;
}

/**
 * Montado no AppShell:
 *  - mostra o veredito (bloqueado / em análise / +18) de quem acabou de publicar;
 *  - processa a fila de moderação do próprio usuário (ao abrir, ao pedir e a cada 45 s
 *    enquanto houver itens), cobrindo edições de perfil e tópicos.
 */
export function ModerationHost() {
  const [notice, setNotice] = useState<ModerationOutcome | null>(null);
  const busy = useRef(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    const onResult = (e: Event) => {
      const o = (e as CustomEvent<ModerationOutcome>).detail;
      if (o && o.verdict !== 'ALLOW') setNotice(o);
    };
    const pump = async () => {
      if (busy.current || document.visibilityState !== 'visible') return;
      busy.current = true;
      try {
        const res = await fetch('/api/moderation/pump', { method: 'POST' });
        const data = res.ok ? await res.json() : null;
        for (const o of data?.outcomes || []) {
          window.dispatchEvent(new CustomEvent('insight-moderation-updated', { detail: o }));
          if (o.verdict === 'BLOCK' && o.message) setNotice({ entityType: o.kind, entityId: o.id, verdict: o.verdict, status: '', isNsfw: false, reason: '', message: o.message });
        }
        if (timer.current) clearTimeout(timer.current);
        if (data?.remaining > 0) timer.current = setTimeout(pump, 45_000);
      } catch {
        /* tenta de novo no próximo gatilho */
      } finally {
        busy.current = false;
      }
    };
    const onKick = () => {
      if (timer.current) clearTimeout(timer.current);
      timer.current = setTimeout(pump, 1500);
    };
    window.addEventListener(RESULT_EVENT, onResult);
    window.addEventListener(KICK_EVENT, onKick);
    const first = setTimeout(pump, 4000);
    return () => {
      window.removeEventListener(RESULT_EVENT, onResult);
      window.removeEventListener(KICK_EVENT, onKick);
      clearTimeout(first);
      if (timer.current) clearTimeout(timer.current);
    };
  }, []);

  useEffect(() => {
    if (!notice || notice.verdict !== 'NSFW') return;
    const t = setTimeout(() => setNotice(null), 6000);
    return () => clearTimeout(t);
  }, [notice]);

  if (!notice) return null;

  if (notice.verdict === 'NSFW') {
    return (
      <div role="status" className="fixed bottom-20 md:bottom-6 left-1/2 -translate-x-1/2 z-[9995] max-w-sm w-[calc(100%-2rem)] flex items-start gap-3 rounded-2xl border border-amber-500/40 bg-surface shadow-2xl px-4 py-3">
        <EyeOff className="w-4 h-4 text-amber-500 shrink-0 mt-0.5" />
        <p className="text-xs text-primary leading-relaxed flex-1">{notice.message}</p>
        <button type="button" aria-label="Fechar" onClick={() => setNotice(null)} className="text-muted hover:text-primary">
          <X className="w-4 h-4" />
        </button>
      </div>
    );
  }

  const blocked = notice.verdict === 'BLOCK';
  const Icon = blocked ? ShieldAlert : Clock3;
  return (
    <div className="fixed inset-0 z-[9995] bg-black/60 backdrop-blur-sm flex items-center justify-center p-4" onClick={() => setNotice(null)}>
      <div
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="mod-title"
        onClick={(e) => e.stopPropagation()}
        className={`w-full max-w-md rounded-2xl border bg-surface shadow-2xl p-6 ${blocked ? 'border-danger/40' : 'border-amber-500/40'}`}
      >
        <div className={`w-11 h-11 rounded-full grid place-items-center ${blocked ? 'bg-danger/15 text-danger' : 'bg-amber-500/15 text-amber-500'}`}>
          <Icon className="w-5 h-5" />
        </div>
        <h2 id="mod-title" className="mt-4 text-base font-extrabold text-primary">
          {blocked ? 'Publicação bloqueada pela moderação' : 'Publicação em análise'}
        </h2>
        <p className="mt-2 text-sm text-secondary leading-relaxed">{notice.message}</p>
        {notice.reason === 'self-harm' && (
          <a
            href="https://cvv.org.br"
            target="_blank"
            rel="noopener noreferrer"
            className="mt-4 flex items-center gap-2 rounded-xl border border-border bg-elevated/60 px-3 py-2.5 text-xs text-primary hover:border-accent"
          >
            <ShieldCheck className="w-4 h-4 text-emerald-400" /> CVV — Centro de Valorização da Vida · ligue 188 (24h, gratuito)
          </a>
        )}
        <div className="mt-5 flex justify-end">
          <button type="button" onClick={() => setNotice(null)} className="px-4 py-2 rounded-full bg-accent text-white text-xs font-bold">
            Entendi
          </button>
        </div>
      </div>
    </div>
  );
}
