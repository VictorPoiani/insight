'use client';

import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Check, Info, X, AlertCircle, Flag } from 'lucide-react';
import { FEEDBACK_EVENT, REPORT_REASONS, markFeedbackHost, type FeedbackRequest, type ToastTone } from '@/lib/ui/feedback';

type Toast = { id: number; message: string; tone: ToastTone };
type Dialog = Exclude<FeedbackRequest, { kind: 'toast' }>;

const TONE: Record<ToastTone, { icon: typeof Info; cls: string }> = {
  info: { icon: Info, cls: 'text-accent' },
  success: { icon: Check, cls: 'text-emerald-500' },
  error: { icon: AlertCircle, cls: 'text-danger' },
};

/** Desenha os avisos (canto inferior) e os diálogos pedidos por lib/ui/feedback. */
export function FeedbackHost() {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const [queue, setQueue] = useState<Dialog[]>([]);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    markFeedbackHost(true);
    const on = (e: Event) => {
      const req = (e as CustomEvent<FeedbackRequest>).detail;
      if (req.kind === 'toast') {
        setToasts((t) => [...t.slice(-3), { id: req.id, message: req.message, tone: req.tone }]);
        const ms = Math.min(9000, 3200 + req.message.length * 35);
        setTimeout(() => setToasts((t) => t.filter((x) => x.id !== req.id)), ms);
      } else {
        setQueue((q) => [...q, req]);
      }
    };
    window.addEventListener(FEEDBACK_EVENT, on);
    return () => {
      window.removeEventListener(FEEDBACK_EVENT, on);
      markFeedbackHost(false);
    };
  }, []);

  if (!mounted) return null;
  const current = queue[0];
  const done = () => setQueue((q) => q.slice(1));

  return createPortal(
    <>
      <div
        aria-live="polite"
        className="fixed z-[200] left-1/2 -translate-x-1/2 bottom-[calc(5rem+env(safe-area-inset-bottom))] md:bottom-6 flex flex-col items-center gap-2 w-[min(92vw,420px)] pointer-events-none"
      >
        {toasts.map((t) => {
          const { icon: Icon, cls } = TONE[t.tone];
          return (
            <div
              key={t.id}
              role={t.tone === 'error' ? 'alert' : 'status'}
              className="pointer-events-auto w-full flex items-start gap-2.5 px-4 py-3 rounded-2xl bg-elevated border border-border shadow-2xl text-sm text-primary insight-toast-in"
            >
              <Icon className={`w-4 h-4 mt-0.5 shrink-0 ${cls}`} />
              <span className="flex-1 min-w-0 leading-snug break-words">{t.message}</span>
              <button
                type="button"
                aria-label="Fechar aviso"
                onClick={() => setToasts((all) => all.filter((x) => x.id !== t.id))}
                className="p-0.5 -mr-1 rounded text-muted hover:text-primary"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          );
        })}
      </div>
      {current && <DialogView key={current.id} req={current} onDone={done} />}
    </>,
    document.body
  );
}

function DialogView({ req, onDone }: { req: Dialog; onDone: () => void }) {
  const isText = req.kind === 'text';
  const isReport = req.kind === 'report';
  const opts = req.kind === 'ask' || req.kind === 'text' ? req.opts : null;
  const [value, setValue] = useState(isText ? req.opts.defaultValue || '' : '');
  const [reason, setReason] = useState<string | null>(null);
  const [details, setDetails] = useState('');
  const inputRef = useRef<HTMLInputElement & HTMLTextAreaElement>(null);
  const okRef = useRef<HTMLButtonElement>(null);

  const finish = (ok: boolean) => {
    if (req.kind === 'ask') req.resolve(ok);
    else if (req.kind === 'text') req.resolve(ok ? (req.opts.readOnly ? req.opts.defaultValue ?? '' : value) : null);
    else req.resolve(ok && reason ? (details.trim() ? `${reason}: ${details.trim()}` : reason) : null);
    onDone();
  };

  useEffect(() => {
    const t = setTimeout(() => {
      if (isText) {
        inputRef.current?.focus();
        if (req.opts.readOnly) inputRef.current?.select();
      } else okRef.current?.focus();
    }, 30);
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') finish(false);
    };
    window.addEventListener('keydown', onKey);
    return () => {
      clearTimeout(t);
      window.removeEventListener('keydown', onKey);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const title = isReport ? 'Denunciar à moderação' : opts?.title;
  const canConfirm = isReport ? Boolean(reason) : true;

  return (
    <div
      className="fixed inset-0 z-[210] flex items-end sm:items-center justify-center bg-black/60 backdrop-blur-[2px] p-0 sm:p-4"
      onClick={() => finish(false)}
      role="dialog"
      aria-modal="true"
      aria-label={title || opts?.message}
    >
      <form
        onClick={(e) => e.stopPropagation()}
        onSubmit={(e) => {
          e.preventDefault();
          if (canConfirm) finish(true);
        }}
        className="w-full sm:max-w-sm rounded-t-3xl sm:rounded-3xl bg-surface border border-border shadow-2xl p-5 space-y-4 insight-dialog-in"
      >
        {title && (
          <h2 className="text-base font-bold text-primary flex items-center gap-2">
            {isReport && <Flag className="w-4 h-4 text-danger" />}
            {title}
          </h2>
        )}
        {opts?.message && <p className="text-sm text-secondary leading-relaxed whitespace-pre-line">{opts.message}</p>}

        {isText &&
          (req.opts.multiline ? (
            <textarea
              ref={inputRef}
              value={value}
              onChange={(e) => setValue(e.target.value)}
              placeholder={req.opts.placeholder}
              rows={4}
              className="w-full rounded-xl bg-background border border-border px-3 py-2 text-sm text-primary focus:outline-none focus:border-accent resize-none"
            />
          ) : (
            <input
              ref={inputRef}
              type={req.opts.password ? 'password' : 'text'}
              value={value}
              readOnly={req.opts.readOnly}
              onChange={(e) => setValue(e.target.value)}
              placeholder={req.opts.placeholder}
              autoComplete={req.opts.password ? 'current-password' : 'off'}
              className={`w-full rounded-xl bg-background border border-border px-3 py-2.5 text-sm text-primary focus:outline-none focus:border-accent ${req.opts.readOnly ? 'font-mono text-xs' : ''}`}
            />
          ))}

        {isReport && (
          <div className="space-y-1.5">
            <p className="text-sm text-secondary">Qual é o problema com esta publicação?</p>
            {REPORT_REASONS.map((r) => (
              <button
                key={r}
                type="button"
                onClick={() => setReason(r)}
                aria-pressed={reason === r}
                className={`w-full text-left px-3 py-2.5 rounded-xl border text-sm transition-colors ${
                  reason === r ? 'border-accent bg-accent/10 text-primary' : 'border-border text-secondary hover:text-primary hover:border-secondary/50'
                }`}
              >
                {r}
              </button>
            ))}
            <textarea
              value={details}
              onChange={(e) => setDetails(e.target.value)}
              placeholder="Detalhes (opcional)"
              rows={2}
              className="w-full mt-1 rounded-xl bg-background border border-border px-3 py-2 text-sm text-primary focus:outline-none focus:border-accent resize-none"
            />
          </div>
        )}

        <div className="flex justify-end gap-2 pt-1">
          {!(isText && req.opts.readOnly) && (
            <button type="button" onClick={() => finish(false)} className="px-4 py-2 rounded-full text-sm font-semibold text-secondary hover:text-primary hover:bg-elevated">
              {opts?.cancelLabel || 'Cancelar'}
            </button>
          )}
          <button
            ref={okRef}
            type="submit"
            disabled={!canConfirm}
            className={`px-4 py-2 rounded-full text-sm font-bold text-white disabled:opacity-50 ${
              opts?.danger || isReport ? 'bg-danger hover:opacity-90' : 'bg-accent hover:bg-accent-hover'
            }`}
          >
            {isReport ? 'Enviar denúncia' : opts?.confirmLabel || 'Confirmar'}
          </button>
        </div>
      </form>
    </div>
  );
}
