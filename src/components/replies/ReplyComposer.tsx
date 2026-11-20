'use client';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { LogIn, Music, Send, X } from 'lucide-react';
import { Profile } from '@/types/database';
import { extractSpotifyTrackId } from '@/lib/spotify';
import { CosmeticAvatar } from '@/components/nitro/Cosmetics';

const MAX_LEN = 280;

interface ReplyComposerProps {
  loggedUser: Profile | null;
  /** Handle de quem está sendo respondido (mostra "Respondendo a @x"). */
  replyingTo?: string | null;
  placeholder?: string;
  autoFocus?: boolean;
  compact?: boolean;
  submitLabel?: string;
  onSubmit: (text: string, spotifyTrackId: string | null) => Promise<boolean>;
  onCancel?: () => void;
  textareaRef?: React.RefObject<HTMLTextAreaElement | null>;
}

export function ReplyComposer({
  loggedUser,
  replyingTo,
  placeholder,
  autoFocus,
  compact,
  submitLabel = 'Responder',
  onSubmit,
  onCancel,
  textareaRef,
}: ReplyComposerProps) {
  const [text, setText] = useState('');
  const [spotifyInput, setSpotifyInput] = useState('');
  const [showSpotify, setShowSpotify] = useState(false);
  const [sending, setSending] = useState(false);
  const localRef = useRef<HTMLTextAreaElement>(null);
  const ref = textareaRef || localRef;

  useEffect(() => {
    if (autoFocus) ref.current?.focus();
  }, [autoFocus, ref]);

  if (!loggedUser) {
    return (
      <div className="flex flex-wrap items-center justify-between gap-2 p-3 rounded-xl bg-surface border border-border text-xs">
        <span className="text-secondary">Entre ou crie uma conta para participar da discussão.</span>
        <Link
          href="/login"
          className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-accent hover:bg-accent-hover text-white font-bold text-[11px] shrink-0 transition-colors"
        >
          <LogIn className="w-3 h-3" />
          <span>Entrar / Criar Conta</span>
        </Link>
      </div>
    );
  }

  const trackId = showSpotify ? extractSpotifyTrackId(spotifyInput) : null;
  const canSend = (text.trim().length > 0 || Boolean(trackId)) && !sending;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!canSend) return;
    setSending(true);
    const ok = await onSubmit(text.trim(), trackId);
    setSending(false);
    if (ok) {
      setText('');
      setSpotifyInput('');
      setShowSpotify(false);
    }
  }

  return (
    <form
      onSubmit={handleSubmit}
      className={`flex gap-3 ${compact ? '' : 'p-3.5 rounded-xl bg-surface border border-border'}`}
    >
      <CosmeticAvatar profile={loggedUser} size={compact ? 28 : 36} className="self-start">
        <img
          src={loggedUser.avatar_url || '/assets/net/default-perfil'}
          alt={loggedUser.full_name}
          className={`${compact ? 'w-7 h-7' : 'w-9 h-9'} rounded-full object-cover border border-border shrink-0`}
        />
      </CosmeticAvatar>

      <div className="flex-1 min-w-0 space-y-2">
        {replyingTo && (
          <p className="text-[11px] text-muted">
            Respondendo a <span className="text-accent font-semibold">@{replyingTo}</span>
          </p>
        )}

        <textarea
          ref={ref}
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) handleSubmit(e);
            if (e.key === 'Escape' && onCancel) onCancel();
          }}
          placeholder={placeholder || `Responder como @${loggedUser.username}...`}
          maxLength={MAX_LEN}
          rows={compact ? 2 : 3}
          className="w-full bg-transparent text-sm text-primary placeholder:text-muted resize-none focus:outline-none"
        />

        {showSpotify && (
          <div className="flex items-center gap-2 p-2 rounded-lg bg-elevated border border-border">
            <Music className="w-3.5 h-3.5 text-[#1DB954] shrink-0" />
            <input
              type="text"
              value={spotifyInput}
              onChange={(e) => setSpotifyInput(e.target.value)}
              placeholder="Link da faixa no Spotify..."
              className="flex-1 min-w-0 bg-transparent text-xs text-primary focus:outline-none"
            />
            <button
              type="button"
              onClick={() => {
                setShowSpotify(false);
                setSpotifyInput('');
              }}
              aria-label="Remover faixa"
              className="text-muted hover:text-primary"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        )}

        <div className="flex items-center justify-between gap-2 pt-2 border-t border-border">
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setShowSpotify(!showSpotify)}
              title="Anexar faixa do Spotify"
              className={`p-1.5 rounded-lg border text-xs transition-colors ${
                showSpotify
                  ? 'border-[#1DB954] text-[#1DB954]'
                  : 'border-border text-secondary hover:text-primary'
              }`}
            >
              <Music className="w-3.5 h-3.5" />
            </button>
            <span
              className={`text-[11px] font-mono ${
                text.length > MAX_LEN - 20 ? 'text-danger' : 'text-muted'
              }`}
            >
              {text.length}/{MAX_LEN}
            </span>
          </div>

          <div className="flex items-center gap-2">
            {onCancel && (
              <button
                type="button"
                onClick={onCancel}
                className="px-3 py-1.5 rounded-lg text-xs font-semibold text-secondary hover:text-primary hover:bg-elevated transition-colors"
              >
                Cancelar
              </button>
            )}
            <button
              type="submit"
              disabled={!canSend}
              className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-full bg-accent hover:bg-accent-hover text-white text-xs font-bold disabled:opacity-50 transition-colors"
            >
              <Send className="w-3 h-3" />
              <span>{sending ? 'Enviando...' : submitLabel}</span>
            </button>
          </div>
        </div>
      </div>
    </form>
  );
}
