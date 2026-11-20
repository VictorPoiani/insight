'use client';

import { createContext, useContext, useState } from 'react';
import Link from 'next/link';
import { Heart, MessageCircle, Trash2, ChevronDown, Link2 } from 'lucide-react';
import { Profile } from '@/types/database';
import { ReplyComposer } from './ReplyComposer';
import { CosmeticAvatar, CosmeticName, CosmeticTag } from '@/components/nitro/Cosmetics';
import { ReplyNode, formatRelativeTime, getReplyAuthorHref } from './utils';

/** A partir desta profundidade não indentamos mais (evita "escadinha" no mobile). */
const MAX_INDENT_DEPTH = 4;
/** A partir desta profundidade, sub-respostas começam recolhidas. */
const AUTO_COLLAPSE_DEPTH = 3;

export type AuthorProfiles = Record<string, Pick<Profile, 'id' | 'cosmetics'>>;

interface ThreadContextValue {
  loggedUser: Profile | null;
  /** Perfis atuais dos autores (para molduras/títulos do Insight Nitro). */
  authorProfiles: AuthorProfiles;
  likedIds: Set<string>;
  highlightedId: string | null;
  activeComposerId: string | null;
  setActiveComposerId: (id: string | null) => void;
  canDelete: (node: ReplyNode) => boolean;
  onToggleLike: (replyId: string) => void;
  onSubmitReply: (parent: ReplyNode, text: string, trackId: string | null) => Promise<boolean>;
  onDelete: (node: ReplyNode) => void;
  onCopyLink: (replyId: string) => void;
}

const ThreadContext = createContext<ThreadContextValue | null>(null);

function useThread() {
  const ctx = useContext(ThreadContext);
  if (!ctx) throw new Error('ReplyThread context ausente');
  return ctx;
}

interface ReplyThreadProps extends ThreadContextValue {
  nodes: ReplyNode[];
}

export function ReplyThread({ nodes, ...ctx }: ReplyThreadProps) {
  return (
    <ThreadContext.Provider value={ctx}>
      <div className="divide-y divide-border">
        {nodes.map((node) => (
          <div key={node.id} className="px-4 sm:px-6 py-4">
            <ReplyItem node={node} depth={0} parentHandle={null} />
          </div>
        ))}
      </div>
    </ThreadContext.Provider>
  );
}

function ReplyItem({
  node,
  depth,
  parentHandle,
}: {
  node: ReplyNode;
  depth: number;
  parentHandle: string | null;
}) {
  const {
    loggedUser,
    likedIds,
    highlightedId,
    activeComposerId,
    setActiveComposerId,
    canDelete,
    onToggleLike,
    onSubmitReply,
    onDelete,
    onCopyLink,
    authorProfiles,
  } = useThread();
  const authorProfile = node.profile_id ? authorProfiles[node.profile_id] : null;

  const [collapsed, setCollapsed] = useState(depth >= AUTO_COLLAPSE_DEPTH);
  const liked = likedIds.has(node.id);
  const isHighlighted = highlightedId === node.id;
  const composerOpen = activeComposerId === node.id;
  const hasChildren = node.children.length > 0;
  const authorHref = getReplyAuthorHref(node.author_handle);
  // Quando já não indentamos mais, deixamos explícito a quem se responde.
  const showReplyingTo = depth > MAX_INDENT_DEPTH && parentHandle;
  const indentChildren = depth < MAX_INDENT_DEPTH;

  return (
    <div id={`reply-${node.id}`} className="scroll-mt-24">
      <div
        className={`flex gap-3 rounded-xl transition-colors duration-700 ${
          isHighlighted ? 'bg-accent/[0.08] ring-1 ring-accent/40 -m-2 p-2' : ''
        }`}
      >
        {/* Coluna do avatar + linha da thread (clicável para recolher) */}
        <div className="flex flex-col items-center shrink-0">
          <Link href={authorHref}>
            <CosmeticAvatar profile={authorProfile} size={depth === 0 ? 36 : 28}>
              <img
                src={node.avatar_url || '/assets/net/default-perfil'}
                alt={node.author_name || 'Autor'}
                className={`${depth === 0 ? 'w-9 h-9' : 'w-7 h-7'} rounded-full object-cover border border-border bg-elevated hover:border-accent transition-colors`}
              />
            </CosmeticAvatar>
          </Link>
          {hasChildren && !collapsed && (
            <button
              type="button"
              onClick={() => setCollapsed(true)}
              aria-label="Recolher respostas"
              title="Recolher respostas"
              className="group flex-1 w-4 mt-1.5 flex justify-center"
            >
              <span className="w-0.5 h-full rounded-full bg-border group-hover:bg-accent transition-colors" />
            </button>
          )}
        </div>

        <div className="flex-1 min-w-0">
          {/* Cabeçalho */}
          <div className="flex items-center gap-1.5 min-w-0 text-xs">
            <Link
              href={authorHref}
              className="font-bold text-primary hover:text-accent truncate transition-colors"
            >
              <CosmeticName profile={authorProfile}>{node.author_name || 'Membro'}</CosmeticName>
            </Link>
            <span className="text-muted truncate">@{node.author_handle || 'membro'}</span>
            <CosmeticTag profile={authorProfile} className="shrink-0" />
            <span className="text-muted">·</span>
            <time
              dateTime={node.created_at}
              title={new Date(node.created_at).toLocaleString('pt-BR')}
              className="text-muted shrink-0"
            >
              {formatRelativeTime(node.created_at)}
            </time>
          </div>

          {showReplyingTo && (
            <p className="text-[11px] text-muted mt-0.5">
              Respondendo a <span className="text-accent">@{parentHandle}</span>
            </p>
          )}

          {/* Conteúdo */}
          {node.content && (
            <p className="mt-1 text-sm text-primary whitespace-pre-line leading-relaxed break-words">
              {node.content}
            </p>
          )}

          {node.spotify_track_id && (
            <iframe
              src={`https://open.spotify.com/embed/track/${node.spotify_track_id}?utm_source=generator&theme=0`}
              width="100%"
              height="80"
              frameBorder="0"
              allow="autoplay; clipboard-write; encrypted-media; fullscreen; picture-in-picture"
              loading="lazy"
              className="mt-2 rounded-lg"
            />
          )}

          {/* Ações */}
          <div className="mt-2 -ml-1.5 flex items-center gap-1 text-xs text-secondary">
            <button
              type="button"
              onClick={() => setActiveComposerId(composerOpen ? null : node.id)}
              aria-label="Responder"
              className={`flex items-center gap-1.5 px-1.5 py-1 rounded-full transition-colors ${
                composerOpen ? 'text-accent' : 'hover:text-accent hover:bg-accent/10'
              }`}
            >
              <MessageCircle className="w-3.5 h-3.5" />
              <span>{node.descendantsCount > 0 ? node.descendantsCount : 'Responder'}</span>
            </button>

            <button
              type="button"
              onClick={() => onToggleLike(node.id)}
              aria-label={liked ? 'Descurtir' : 'Curtir'}
              aria-pressed={liked}
              className={`flex items-center gap-1.5 px-1.5 py-1 rounded-full transition-colors ${
                liked ? 'text-rose-500' : 'hover:text-rose-500 hover:bg-rose-500/10'
              }`}
            >
              <Heart
                className={`w-3.5 h-3.5 transition-transform ${liked ? 'fill-rose-500 scale-110' : ''}`}
              />
              <span>{node.likes_count || 0}</span>
            </button>

            <button
              type="button"
              onClick={() => onCopyLink(node.id)}
              aria-label="Copiar link da resposta"
              title="Copiar link da resposta"
              className="p-1 rounded-full text-muted hover:text-primary hover:bg-elevated transition-colors"
            >
              <Link2 className="w-3.5 h-3.5" />
            </button>

            {canDelete(node) && (
              <button
                type="button"
                onClick={() => onDelete(node)}
                aria-label="Excluir resposta"
                title="Excluir resposta"
                className="ml-auto p-1 rounded-full text-muted hover:text-danger hover:bg-elevated transition-colors"
              >
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          {/* Composer inline para responder a esta resposta específica */}
          {composerOpen && (
            <div className="mt-2">
              <ReplyComposer
                compact
                autoFocus
                loggedUser={loggedUser}
                replyingTo={node.author_handle}
                placeholder="Escreva sua resposta..."
                onCancel={() => setActiveComposerId(null)}
                onSubmit={async (text, trackId) => {
                  const ok = await onSubmitReply(node, text, trackId);
                  if (ok) {
                    setActiveComposerId(null);
                    setCollapsed(false);
                  }
                  return ok;
                }}
              />
            </div>
          )}

          {/* Sub-respostas */}
          {hasChildren && collapsed && (
            <button
              type="button"
              onClick={() => setCollapsed(false)}
              className="mt-2 inline-flex items-center gap-1 text-xs font-semibold text-accent hover:underline"
            >
              <ChevronDown className="w-3.5 h-3.5" />
              <span>
                Mostrar {node.descendantsCount}{' '}
                {node.descendantsCount === 1 ? 'resposta' : 'respostas'}
              </span>
            </button>
          )}

          {hasChildren && !collapsed && indentChildren && (
            <div className="mt-3 space-y-4">
              {node.children.map((child) => (
                <ReplyItem
                  key={child.id}
                  node={child}
                  depth={depth + 1}
                  parentHandle={node.author_handle}
                />
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Profundidade máxima: filhos seguem sem indentação extra */}
      {hasChildren && !collapsed && !indentChildren && (
        <div className="mt-4 space-y-4">
          {node.children.map((child) => (
            <ReplyItem
              key={child.id}
              node={child}
              depth={depth + 1}
              parentHandle={node.author_handle}
            />
          ))}
        </div>
      )}
    </div>
  );
}
