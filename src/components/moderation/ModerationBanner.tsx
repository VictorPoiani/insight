'use client';

import { useState } from 'react';
import { Clock3, ShieldAlert, Send, Loader2, MessageSquareWarning } from 'lucide-react';

const LABEL: Record<string, string> = {
  'sexual/minors': 'Exploração de menores',
  'self-harm': 'Automutilação',
  'violence/threat': 'Ameaça ou incitação à violência',
  'violence/graphic': 'Violência gráfica',
  hate: 'Discurso de ódio',
  harassment: 'Assédio',
  terrorism: 'Terrorismo',
  illicit: 'Atividade ilegal',
  sexual: 'Conteúdo sexual',
  media_unverified: 'Mídia não verificada automaticamente',
};

/**
 * Aviso que SÓ o autor vê no próprio conteúdo retido (os outros nem recebem o
 * item, por causa da RLS): em análise, bloqueado ou com recurso enviado.
 */
export function ModerationBanner({
  kind,
  id,
  status,
  reason,
  onAppealed,
}: {
  kind: 'post' | 'reply' | 'topic';
  id: string;
  status?: string | null;
  reason?: string | null;
  onAppealed?: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [msg, setMsg] = useState('');
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!status || status === 'approved') return null;
  const what = kind === 'reply' ? 'resposta' : kind === 'topic' ? 'tópico' : 'Insight';

  if (status === 'pending') {
    return (
      <p className="mt-2 inline-flex items-center gap-1.5 rounded-full border border-border bg-elevated/60 px-2.5 py-1 text-[11px] font-semibold text-secondary">
        <Clock3 className="w-3.5 h-3.5 animate-pulse" /> Verificando antes de publicar…
      </p>
    );
  }

  const appealed = status === 'appealed' || sent;
  const blocked = status === 'blocked';

  async function send() {
    setSending(true);
    setError(null);
    try {
      const res = await fetch('/api/moderation/appeal', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ kind, id, message: msg }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.error || 'Não foi possível enviar.');
      setSent(true);
      setOpen(false);
      onAppealed?.();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Não foi possível enviar.');
    } finally {
      setSending(false);
    }
  }

  return (
    <div
      onClick={(e) => e.stopPropagation()}
      className={`mt-3 rounded-xl border px-3.5 py-3 text-xs ${blocked && !appealed ? 'border-danger/40 bg-danger/5' : 'border-amber-500/40 bg-amber-500/5'}`}
    >
      <p className="flex items-start gap-2 text-primary">
        {appealed ? (
          <MessageSquareWarning className="w-4 h-4 text-amber-500 shrink-0" />
        ) : blocked ? (
          <ShieldAlert className="w-4 h-4 text-danger shrink-0" />
        ) : (
          <Clock3 className="w-4 h-4 text-amber-500 shrink-0" />
        )}
        <span className="leading-relaxed">
          {appealed ? (
            <>Pedido de revisão enviado. A equipe vai analisar este {what}; ele continua oculto até lá.</>
          ) : blocked ? (
            <>
              <strong>Bloqueado pela moderação</strong>
              {reason && LABEL[reason] ? ` · ${LABEL[reason]}` : ''}. Só você vê este {what}.
            </>
          ) : (
            <>
              <strong>Em análise pela moderação</strong>
              {reason && LABEL[reason] ? ` · ${LABEL[reason]}` : ''}. Ele aparece no feed depois da revisão.
            </>
          )}
        </span>
      </p>

      {!appealed && (
        <div className="mt-2.5 pl-6">
          {!open ? (
            <button type="button" onClick={() => setOpen(true)} className="font-bold text-accent hover:underline">
              Acha que foi um engano? Pedir revisão
            </button>
          ) : (
            <div className="space-y-2">
              <textarea
                value={msg}
                onChange={(e) => setMsg(e.target.value.slice(0, 1000))}
                rows={3}
                placeholder="Conte o contexto para a equipe (opcional)…"
                className="w-full rounded-lg border border-border bg-background p-2 text-xs text-primary placeholder:text-muted focus:outline-none focus:border-accent"
              />
              {error && <p className="text-danger">{error}</p>}
              <div className="flex gap-2">
                <button type="button" onClick={() => setOpen(false)} className="px-3 py-1.5 rounded-full border border-border font-bold text-secondary">
                  Cancelar
                </button>
                <button
                  type="button"
                  disabled={sending}
                  onClick={send}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-accent text-white font-bold disabled:opacity-50"
                >
                  {sending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Send className="w-3.5 h-3.5" />} Enviar pedido
                </button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
