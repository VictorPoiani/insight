'use client';

/**
 * Avisos e diálogos do Insight (no lugar de alert/confirm/prompt do navegador).
 * Funções chamáveis de qualquer lugar; quem desenha é o <FeedbackHost/> que
 * fica no AppShell. Sem o host montado, caem no diálogo nativo (nunca travam).
 */

export type ToastTone = 'info' | 'success' | 'error';

export interface AskOptions {
  title?: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  /** botão principal vermelho (excluir, apagar...) */
  danger?: boolean;
}

export interface AskTextOptions extends AskOptions {
  defaultValue?: string;
  placeholder?: string;
  /** campo de senha */
  password?: boolean;
  /** só mostra o texto para copiar (ex.: link) */
  readOnly?: boolean;
  multiline?: boolean;
}

export type FeedbackRequest =
  | { kind: 'toast'; id: number; message: string; tone: ToastTone }
  | { kind: 'ask'; id: number; opts: AskOptions; resolve: (v: boolean) => void }
  | { kind: 'text'; id: number; opts: AskTextOptions; resolve: (v: string | null) => void }
  | { kind: 'report'; id: number; resolve: (v: string | null) => void };

export const FEEDBACK_EVENT = 'insight:feedback';
let seq = 0;
let hostReady = false;
export function markFeedbackHost(ready: boolean) {
  hostReady = ready;
}

function emit(req: FeedbackRequest) {
  window.dispatchEvent(new CustomEvent<FeedbackRequest>(FEEDBACK_EVENT, { detail: req }));
}

/** tom automático: mensagens de erro ficam vermelhas */
function guessTone(message: string): ToastTone {
  return /^(erro|não foi|nao foi|falha)|\berro\b/i.test(message.trim()) ? 'error' : 'info';
}

/** Aviso discreto que some sozinho. */
export function notify(message: string, tone?: ToastTone) {
  if (typeof window === 'undefined') return;
  if (!hostReady) {
    window.alert(message);
    return;
  }
  emit({ kind: 'toast', id: ++seq, message, tone: tone || guessTone(message) });
}

/** Confirmação ("Excluir este Insight?"). */
export function ask(opts: AskOptions | string): Promise<boolean> {
  const o = typeof opts === 'string' ? { message: opts } : opts;
  if (typeof window === 'undefined') return Promise.resolve(false);
  if (!hostReady) return Promise.resolve(window.confirm(o.message));
  return new Promise((resolve) => emit({ kind: 'ask', id: ++seq, opts: o, resolve }));
}

/** Campo de texto (motivo, senha, link para copiar). Cancelar devolve null. */
export function askText(opts: AskTextOptions): Promise<string | null> {
  if (typeof window === 'undefined') return Promise.resolve(null);
  if (!hostReady) return Promise.resolve(window.prompt(opts.message, opts.defaultValue));
  return new Promise((resolve) => emit({ kind: 'text', id: ++seq, opts, resolve }));
}

/** Mostra um link para copiar (quando a área de transferência falha). */
export function showCopyLink(url: string, title = 'Copie o link') {
  return askText({ title, message: 'Selecione e copie:', defaultValue: url, readOnly: true, confirmLabel: 'Fechar' });
}

export const REPORT_REASONS = [
  'Spam ou propaganda',
  'Ofensa, assédio ou discurso de ódio',
  'Conteúdo adulto (+18) sem aviso',
  'Violência ou conteúdo perigoso',
  'Informação falsa',
  'Golpe ou fraude',
] as const;

/** Escolha do motivo da denúncia. Devolve o texto do motivo, ou null. */
export function askReport(): Promise<string | null> {
  if (typeof window === 'undefined') return Promise.resolve(null);
  if (!hostReady) return Promise.resolve(window.prompt('Motivo da denúncia (ex.: spam, ofensa, conteúdo impróprio):'));
  return new Promise((resolve) => emit({ kind: 'report', id: ++seq, resolve }));
}
