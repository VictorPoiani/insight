'use client';

import { loginHref } from '@/lib/account/loginRedirect';
import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { Code2, ImagePlus, List, LogIn, Music, Quote, Send, Type, X } from 'lucide-react';
import { Profile, ReplyBlock, ReplyBlockType } from '@/types/database';
import { extractSpotifyTrackId } from '@/lib/spotify';
import { CosmeticAvatar } from '@/components/nitro/Cosmetics';
import { draftStatusLabel, useCloudDraft } from '@/lib/drafts/useCloudDraft';
import { uploadMediaToInsight } from '@/lib/mediaCompressor';
import { getUserUploadLimitBytes } from '@/lib/contributorLevels';
import { replyBlocksToText } from './ReplyBlocks';

/** Limite de texto somando todos os blocos (o banco aceita até 4000). */
const MAX_LEN = 2000;
const MAX_BLOCKS = 12;

const TEXT_TYPES: { type: ReplyBlockType; label: string; Icon: typeof Type }[] = [
  { type: 'paragraph', label: 'Texto', Icon: Type },
  { type: 'quote', label: 'Citação', Icon: Quote },
  { type: 'code', label: 'Código', Icon: Code2 },
  { type: 'bullet', label: 'Lista', Icon: List },
];

const uid = () => `rb-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`;
const emptyBlocks = (): ReplyBlock[] => [{ id: uid(), type: 'paragraph', text: '' }];
const isTextBlock = (b: ReplyBlock) => b.type !== 'image' && b.type !== 'spotify';
const isBlank = (bs: ReplyBlock[]) => !bs.some((b) => (isTextBlock(b) ? (b.text || '').trim() : b.url || b.trackId));

export interface ReplySubmitPayload {
  blocks: ReplyBlock[];
  content: string;
}

interface ReplyComposerProps {
  loggedUser: Profile | null;
  /** Handle de quem está sendo respondido (mostra "Respondendo a @x"). */
  replyingTo?: string | null;
  placeholder?: string;
  autoFocus?: boolean;
  compact?: boolean;
  submitLabel?: string;
  /** Chave do rascunho automático (ex.: reply:<postId>:root). */
  draftScope?: string;
  onSubmit: (payload: ReplySubmitPayload) => Promise<boolean>;
  onCancel?: () => void;
  textareaRef?: React.RefObject<HTMLTextAreaElement | null>;
}

function AutoTextarea({
  block,
  placeholder,
  onChange,
  onKeyDown,
  inputRef,
  compact,
}: {
  block: ReplyBlock;
  placeholder: string;
  onChange: (text: string) => void;
  onKeyDown: (e: React.KeyboardEvent<HTMLTextAreaElement>) => void;
  inputRef: (el: HTMLTextAreaElement | null) => void;
  compact?: boolean;
}) {
  const ref = useRef<HTMLTextAreaElement | null>(null);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    el.style.height = 'auto';
    el.style.height = `${el.scrollHeight}px`;
  }, [block.text]);

  const style =
    block.type === 'quote'
      ? 'pl-3 border-l-2 border-accent/60 italic text-secondary'
      : block.type === 'code'
        ? 'px-3 py-2 rounded-lg bg-elevated border border-border font-mono text-[12px] text-sky-400'
        : block.type === 'bullet'
          ? 'pl-5'
          : '';

  return (
    <div className="relative">
      {block.type === 'bullet' && <span aria-hidden className="absolute left-1.5 top-0 text-muted select-none">•</span>}
      <textarea
        ref={(el) => {
          ref.current = el;
          inputRef(el);
        }}
        value={block.text || ''}
        onChange={(e) => onChange(e.target.value)}
        onKeyDown={onKeyDown}
        placeholder={placeholder}
        rows={1}
        spellCheck={block.type !== 'code'}
        className={`w-full bg-transparent text-sm text-primary placeholder:text-muted resize-none focus:outline-none leading-relaxed overflow-hidden ${
          compact ? 'min-h-[22px]' : 'min-h-[26px]'
        } ${style}`}
      />
    </div>
  );
}

export function ReplyComposer({
  loggedUser,
  replyingTo,
  placeholder,
  autoFocus,
  compact,
  submitLabel = 'Responder',
  draftScope,
  onSubmit,
  onCancel,
  textareaRef,
}: ReplyComposerProps) {
  const [blocks, setBlocks] = useState<ReplyBlock[]>(emptyBlocks);
  const [focusedId, setFocusedId] = useState<string | null>(null);
  const [spotifyOpen, setSpotifyOpen] = useState(false);
  const [spotifyInput, setSpotifyInput] = useState('');
  const [uploading, setUploading] = useState<string | null>(null);
  const [sending, setSending] = useState(false);
  const [restored, setRestored] = useState(false);
  const inputs = useRef<Record<string, HTMLTextAreaElement | null>>({});
  const [pendingFocus, setPendingFocus] = useState<string | null>(null);

  // foca um bloco recém-criado só depois que ele existe no DOM
  useEffect(() => {
    if (!pendingFocus) return;
    const el = inputs.current[pendingFocus];
    if (el) {
      el.focus();
      el.setSelectionRange(el.value.length, el.value.length);
      setFocusedId(pendingFocus);
      setPendingFocus(null);
    }
  }, [pendingFocus, blocks]);
  const fileRef = useRef<HTMLInputElement>(null);

  const draft = useCloudDraft<ReplyBlock[]>(loggedUser ? draftScope || null : null, loggedUser?.id, isBlank);
  const restoredOnce = useRef(false);

  useEffect(() => {
    if (!draft.ready || restoredOnce.current) return;
    restoredOnce.current = true;
    if (draft.loaded) {
      setBlocks(draft.loaded.v);
      setRestored(true);
    }
  }, [draft.ready, draft.loaded]);

  useEffect(() => {
    if (restoredOnce.current) draft.save(blocks);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [blocks]);

  useEffect(() => {
    if (autoFocus) inputs.current[blocks[0]?.id]?.focus();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [autoFocus]);

  if (!loggedUser) {
    return (
      <div className="flex flex-wrap items-center justify-between gap-2 p-3 rounded-xl bg-surface border border-border text-xs">
        <span className="text-secondary">Entre ou crie uma conta para participar da discussão.</span>
        <Link
          href="/login"
          onClick={(e) => {
            e.preventDefault();
            window.location.href = loginHref();
          }}
          className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-accent hover:bg-accent-hover text-white font-bold text-[11px] shrink-0 transition-colors"
        >
          <LogIn className="w-3 h-3" />
          <span>Entrar / Criar Conta</span>
        </Link>
      </div>
    );
  }

  const textLen = blocks.reduce((n, b) => n + (isTextBlock(b) ? (b.text || '').length : 0), 0);
  const canSend = !isBlank(blocks) && textLen <= MAX_LEN && !sending && !uploading;
  const focused = blocks.find((b) => b.id === focusedId) || blocks[blocks.length - 1];

  function update(id: string, patch: Partial<ReplyBlock>) {
    setBlocks((prev) => prev.map((b) => (b.id === id ? { ...b, ...patch } : b)));
  }

  function insertAfter(afterId: string, block: ReplyBlock, focus = true) {
    setBlocks((prev) => {
      if (prev.length >= MAX_BLOCKS) return prev;
      const i = prev.findIndex((b) => b.id === afterId);
      const next = [...prev];
      next.splice(i + 1, 0, block);
      return next;
    });
    if (focus && isTextBlock(block)) setPendingFocus(block.id);
  }

  function removeBlock(id: string, focusPrev = true) {
    setBlocks((prev) => {
      if (prev.length === 1) return emptyBlocks();
      const i = prev.findIndex((b) => b.id === id);
      const next = prev.filter((b) => b.id !== id);
      if (focusPrev) setPendingFocus(next[Math.max(0, i - 1)].id);
      return next;
    });
  }

  /**
   * Bloco vazio: troca o tipo. Bloco com texto: cria um bloco novo do tipo
   * escolhido logo abaixo (assim citação/código/lista não engolem o texto).
   */
  function setType(type: ReplyBlockType) {
    if (!focused || !isTextBlock(focused)) {
      insertAfter(blocks[blocks.length - 1].id, { id: uid(), type, text: '' });
      return;
    }
    const text = (focused.text || '').replace(/\n+$/, '');
    if (!text) {
      update(focused.id, { type: focused.type === type ? 'paragraph' : type });
      setPendingFocus(focused.id);
      return;
    }
    if (focused.type === type) return;
    if (text !== focused.text) update(focused.id, { text });
    insertAfter(focused.id, { id: uid(), type, text: '' });
  }

  /** Atalhos estilo markdown no início do bloco: "> ", "- ", "``` ". */
  function handleTextChange(block: ReplyBlock, text: string) {
    if (block.type === 'paragraph') {
      if (text === '> ') return update(block.id, { type: 'quote', text: '' });
      if (text === '- ' || text === '* ') return update(block.id, { type: 'bullet', text: '' });
      if (text === '```') return update(block.id, { type: 'code', text: '' });
    }
    update(block.id, { text });
  }

  function handleKeyDown(block: ReplyBlock, e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
      e.preventDefault();
      void submit();
      return;
    }
    if (e.key === 'Escape' && onCancel) {
      onCancel();
      return;
    }
    // Enter em linha vazia no fim de uma lista/citação/código: sai para um bloco de texto
    if (e.key === 'Enter' && !e.shiftKey && block.type !== 'paragraph') {
      const el = e.currentTarget;
      const atEnd = el.selectionStart === el.value.length;
      if (atEnd && /\n$/.test(el.value)) {
        e.preventDefault();
        update(block.id, { text: el.value.replace(/\n$/, '') });
        insertAfter(block.id, { id: uid(), type: 'paragraph', text: '' });
      }
      return;
    }
    if (e.key === 'Backspace' && !(block.text || '') && blocks.length > 1) {
      e.preventDefault();
      if (block.type !== 'paragraph') update(block.id, { type: 'paragraph' });
      else removeBlock(block.id);
    }
  }

  async function handleImage(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file || !loggedUser) return;
    if (!file.type.startsWith('image/')) {
      alert('Escolha uma imagem.');
      return;
    }
    const id = uid();
    setUploading(id);
    try {
      const res = await uploadMediaToInsight(file, {
        budgetBytes: getUserUploadLimitBytes(loggedUser.contributor_level ?? 0, loggedUser.role),
        asImage: file.type !== 'image/gif',
        asFile: file.type === 'image/gif',
      });
      insertAfter(focused?.id || blocks[blocks.length - 1].id, { id, type: 'image', url: res.publicUrl, bytes: res.compressedSize }, false);
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Não foi possível enviar a imagem.');
    } finally {
      setUploading(null);
    }
  }

  function addSpotify() {
    const trackId = extractSpotifyTrackId(spotifyInput);
    if (!trackId) {
      alert('Cole um link de faixa do Spotify.');
      return;
    }
    insertAfter(focused?.id || blocks[blocks.length - 1].id, { id: uid(), type: 'spotify', trackId }, false);
    setSpotifyInput('');
    setSpotifyOpen(false);
  }

  async function submit(e?: React.FormEvent) {
    e?.preventDefault();
    if (!canSend) return;
    const clean = blocks
      .map((b) => (isTextBlock(b) ? { ...b, text: (b.text || '').replace(/\s+$/, '') } : b))
      .filter((b) => (isTextBlock(b) ? b.text : b.url || b.trackId))
      .map(({ id, type, text, url, trackId }) => ({ id, type, text, url, trackId }) as ReplyBlock);
    setSending(true);
    const ok = await onSubmit({ blocks: clean, content: replyBlocksToText(clean) });
    setSending(false);
    if (ok) {
      void draft.clear();
      setRestored(false);
      setBlocks(emptyBlocks());
      setSpotifyOpen(false);
    }
  }

  const status = draftStatusLabel(draft.status, draft.savedAt);

  return (
    <form onSubmit={submit} className={`flex gap-3 ${compact ? '' : 'p-3.5 rounded-xl bg-surface border border-border'}`}>
      <CosmeticAvatar profile={loggedUser} size={compact ? 28 : 36} className="self-start">
        {/* eslint-disable-next-line @next/next/no-img-element */}
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

        {restored && (
          <p className="flex items-center justify-between gap-2 text-[11px] px-2 py-1 rounded-lg bg-accent/10 border border-accent/30 text-primary">
            <span>Rascunho restaurado</span>
            <button
              type="button"
              onClick={() => {
                void draft.clear();
                setRestored(false);
                setBlocks(emptyBlocks());
              }}
              className="font-semibold text-secondary hover:text-danger"
            >
              Descartar
            </button>
          </p>
        )}

        <div className="space-y-1.5">
          {blocks.map((b, i) =>
            isTextBlock(b) ? (
              <div key={b.id} onFocusCapture={() => setFocusedId(b.id)}>
                <AutoTextarea
                  block={b}
                  compact={compact}
                  placeholder={
                    i === 0 && blocks.length === 1
                      ? placeholder || `Responder como @${loggedUser.username}...`
                      : b.type === 'code'
                        ? 'Código...'
                        : b.type === 'quote'
                          ? 'Citação...'
                          : b.type === 'bullet'
                            ? 'Item da lista (Enter = novo item)'
                            : 'Continue escrevendo...'
                  }
                  onChange={(t) => handleTextChange(b, t)}
                  onKeyDown={(e) => handleKeyDown(b, e)}
                  inputRef={(el) => {
                    inputs.current[b.id] = el;
                    if (i === 0 && textareaRef) (textareaRef as React.MutableRefObject<HTMLTextAreaElement | null>).current = el;
                  }}
                />
              </div>
            ) : (
              <div key={b.id} className="relative group/blk">
                {b.type === 'image' ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={b.url} alt="" className="max-h-56 w-auto max-w-full rounded-xl border border-border object-contain bg-elevated" />
                ) : (
                  <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-elevated border border-border text-xs text-secondary">
                    <Music className="w-3.5 h-3.5 text-[#1DB954]" /> Faixa do Spotify anexada
                  </div>
                )}
                <button
                  type="button"
                  onClick={() => removeBlock(b.id, false)}
                  aria-label="Remover anexo"
                  className="absolute top-1.5 right-1.5 w-6 h-6 rounded-full bg-black/60 text-white flex items-center justify-center"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>
            )
          )}
          {uploading && <p className="text-[11px] text-muted">Otimizando e enviando imagem…</p>}
        </div>

        {spotifyOpen && (
          <div className="flex items-center gap-2 p-2 rounded-lg bg-elevated border border-border">
            <Music className="w-3.5 h-3.5 text-[#1DB954] shrink-0" />
            <input
              type="text"
              value={spotifyInput}
              onChange={(e) => setSpotifyInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  addSpotify();
                }
              }}
              placeholder="Link da faixa no Spotify..."
              className="flex-1 min-w-0 bg-transparent text-xs text-primary focus:outline-none"
              autoFocus
            />
            <button type="button" onClick={addSpotify} className="text-[11px] font-bold text-accent">
              Anexar
            </button>
          </div>
        )}

        <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-border">
          <div className="flex items-center gap-1" role="toolbar" aria-label="Formatação da resposta">
            {TEXT_TYPES.map(({ type, label, Icon }) => {
              const active = focused && focused.type === type && isTextBlock(focused);
              return (
                <button
                  key={type}
                  type="button"
                  title={label}
                  aria-label={label}
                  aria-pressed={Boolean(active)}
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={() => setType(type)}
                  className={`p-1.5 rounded-lg transition-colors ${active ? 'bg-accent/15 text-accent' : 'text-secondary hover:text-primary hover:bg-elevated'}`}
                >
                  <Icon className="w-3.5 h-3.5" />
                </button>
              );
            })}
            <span className="w-px h-4 bg-border mx-0.5" />
            <button
              type="button"
              title="Imagem"
              aria-label="Anexar imagem"
              disabled={Boolean(uploading) || blocks.length >= MAX_BLOCKS}
              onClick={() => fileRef.current?.click()}
              className="p-1.5 rounded-lg text-secondary hover:text-primary hover:bg-elevated disabled:opacity-40"
            >
              <ImagePlus className="w-3.5 h-3.5" />
            </button>
            <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={handleImage} />
            <button
              type="button"
              title="Spotify"
              aria-label="Anexar faixa do Spotify"
              onClick={() => setSpotifyOpen((v) => !v)}
              className={`p-1.5 rounded-lg transition-colors ${spotifyOpen ? 'text-[#1DB954]' : 'text-secondary hover:text-primary hover:bg-elevated'}`}
            >
              <Music className="w-3.5 h-3.5" />
            </button>
            <span className={`ml-1 text-[11px] font-mono ${textLen > MAX_LEN - 100 ? 'text-danger' : 'text-muted'}`}>
              {textLen}/{MAX_LEN}
            </span>
          </div>

          <div className="flex items-center gap-2 ml-auto">
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
        {status && <p className="text-[10px] text-muted font-mono">{status}</p>}
        {!compact && (
          <p className="text-[10px] text-muted">
            Dica: comece com <kbd className="font-mono">&gt; </kbd> para citar, <kbd className="font-mono">- </kbd> para lista,{' '}
            <kbd className="font-mono">```</kbd> para código · Ctrl/⌘ + Enter envia
          </p>
        )}
      </div>
    </form>
  );
}
