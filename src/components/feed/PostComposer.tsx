'use client';

import { useState, useRef, useEffect } from 'react';
import { createClient } from '@/lib/supabase/client';
import {
  PostBlock,
  PostBlockType,
  FontStyleType,
  ImageWidthType,
} from '@/types/database';
import {
  Bold,
  Italic,
  Underline,
  Strikethrough,
  Highlighter,
  Type,
  AlignLeft,
  AlignCenter,
  AlignRight,
  GripVertical,
  Plus,
  Trash2,
  Image as ImageIcon,
  Music,
  Heading1,
  Heading2,
  Quote,
  Sparkles,
  Code,
  List,
  Minus,
  Pin,
  Send,
  Hash,
  X,
  ArrowUp,
  ArrowDown,
} from 'lucide-react';

interface PostComposerProps {
  authorId: string;
  onPostCreated: () => void;
  defaultTag?: string | null;
}

const HIGHLIGHT_COLORS = [
  { name: 'Azul Metálico', color: 'rgba(37, 99, 235, 0.42)' },
  { name: 'Amarelo', color: 'rgba(250, 204, 21, 0.35)' },
  { name: 'Verde', color: 'rgba(29, 185, 84, 0.35)' },
  { name: 'Roxo', color: 'rgba(168, 85, 247, 0.40)' },
  { name: 'Vermelho', color: 'rgba(239, 68, 68, 0.38)' },
];

const BLOCK_MENU_ITEMS: {
  type: PostBlockType;
  label: string;
  desc: string;
  icon: React.ComponentType<{ className?: string }>;
}[] = [
  { type: 'paragraph', label: 'Texto', desc: 'Parágrafo livre', icon: AlignLeft },
  { type: 'h1', label: 'Título Grande', desc: 'Cabeçalho principal (H1)', icon: Heading1 },
  { type: 'h2', label: 'Subtítulo', desc: 'Cabeçalho de seção (H2)', icon: Heading2 },
  { type: 'quote', label: 'Citação', desc: 'Destaque com barra lateral', icon: Quote },
  { type: 'callout', label: 'Callout / Nota', desc: 'Caixa de destaque estilo Notion', icon: Sparkles },
  { type: 'bullet', label: 'Item de Lista', desc: 'Tópico com marcador', icon: List },
  { type: 'code', label: 'Bloco de Código', desc: 'Fonte monoespaçada técnica', icon: Code },
  { type: 'image', label: 'Imagem Responsiva', desc: 'Upload com controle de largura', icon: ImageIcon },
  { type: 'spotify', label: 'Música do Spotify', desc: 'Player incorporado no bloco', icon: Music },
  { type: 'divider', label: 'Divisória', desc: 'Linha horizontal separadora', icon: Minus },
];

export function extractSpotifyTrackId(urlOrId: string): string | null {
  if (!urlOrId) return null;
  const trimmed = urlOrId.trim();
  if (trimmed.includes('open.spotify.com/track/')) {
    return trimmed.split('track/')[1]?.split('?')[0] || null;
  }
  if (trimmed.includes('spotify:track:')) {
    return trimmed.split('spotify:track:')[1] || null;
  }
  return /^[A-Za-z0-9]{10,30}$/.test(trimmed) ? trimmed : null;
}

function createNewBlock(type: PostBlockType = 'paragraph'): PostBlock {
  return {
    id: `blk-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    type,
    html: '',
    fontStyle: type === 'code' ? 'mono' : 'sans',
    align: 'left',
    calloutIcon: '💡',
    imageUrl: null,
    imageCaption: '',
    imageWidth: '100%',
    spotifyTrackId: null,
  };
}

interface RichBlockEditableProps {
  block: PostBlock;
  placeholder: string;
  className: string;
  onFocus: () => void;
  onChangeHtml: (html: string) => void;
  onSlashTriggered: () => void;
  onEnterPressed: () => void;
  onBackspaceEmpty: () => void;
}

function RichBlockEditable({
  block,
  placeholder,
  className,
  onFocus,
  onChangeHtml,
  onSlashTriggered,
  onEnterPressed,
  onBackspaceEmpty,
}: RichBlockEditableProps) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!ref.current) return;
    if (document.activeElement !== ref.current && ref.current.innerHTML !== (block.html || '')) {
      ref.current.innerHTML = block.html || '';
    }
  }, [block.html, block.type]);

  function handleInput(e: React.FormEvent<HTMLDivElement>) {
    const html = e.currentTarget.innerHTML;
    const plain = e.currentTarget.innerText.trim();

    if (plain === '/') {
      e.currentTarget.innerHTML = '';
      onChangeHtml('');
      onSlashTriggered();
      return;
    }

    onChangeHtml(html === '<br>' ? '' : html);
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLDivElement>) {
    if (e.key === 'Enter' && !e.shiftKey && block.type !== 'code') {
      e.preventDefault();
      onEnterPressed();
    } else if (e.key === 'Backspace') {
      const plain = e.currentTarget.innerText.replace(/\n/g, '').trim();
      if (plain.length === 0) {
        e.preventDefault();
        onBackspaceEmpty();
      }
    }
  }

  return (
    <div
      ref={ref}
      contentEditable
      suppressContentEditableWarning
      data-placeholder={placeholder}
      onFocus={onFocus}
      onInput={handleInput}
      onKeyDown={handleKeyDown}
      style={{ textAlign: block.align || 'left' }}
      className={`notion-editable w-full focus:outline-none break-words ${className}`}
    />
  );
}

export function PostComposer({
  authorId,
  onPostCreated,
  defaultTag,
}: PostComposerProps) {
  const [blocks, setBlocks] = useState<PostBlock[]>(() => [createNewBlock('paragraph')]);
  const [activeBlockId, setActiveBlockId] = useState<string>('');
  const [menuOpenForBlockId, setMenuOpenForBlockId] = useState<string | null>(null);
  const [showHighlighterMenu, setShowHighlighterMenu] = useState(false);

  const [draggedBlockId, setDraggedBlockId] = useState<string | null>(null);
  const [dragOverBlockId, setDragOverBlockId] = useState<string | null>(null);

  const [tagsInput, setTagsInput] = useState(defaultTag || '');
  const [isPinned, setIsPinned] = useState(false);
  const [uploadingBlockId, setUploadingBlockId] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (defaultTag) {
      setTagsInput(defaultTag);
    } else {
      setTagsInput('');
    }
  }, [defaultTag]);

  const supabase = createClient();
  const activeBlock = blocks.find((b) => b.id === activeBlockId) || blocks[0];

  function applyInlineFormat(command: string, value?: string) {
    document.execCommand('styleWithCSS', false, 'true');
    document.execCommand(command, false, value);
  }

  function applyHighlightColor(color: string | null) {
    document.execCommand('styleWithCSS', false, 'true');
    if (!color) {
      document.execCommand('hiliteColor', false, 'transparent');
    } else {
      document.execCommand('hiliteColor', false, color);
    }
    setShowHighlighterMenu(false);
  }

  function updateBlock(id: string, patch: Partial<PostBlock>) {
    setBlocks((prev) => prev.map((b) => (b.id === id ? { ...b, ...patch } : b)));
  }

  function insertBlockAfter(targetId: string, type: PostBlockType = 'paragraph') {
    const newBlk = createNewBlock(type);
    setBlocks((prev) => {
      const idx = prev.findIndex((b) => b.id === targetId);
      if (idx === -1) return [...prev, newBlk];
      const copy = [...prev];
      copy.splice(idx + 1, 0, newBlk);
      return copy;
    });
    setActiveBlockId(newBlk.id);
    setMenuOpenForBlockId(null);
  }

  function removeBlock(id: string) {
    setBlocks((prev) => {
      if (prev.length <= 1) {
        return [createNewBlock('paragraph')];
      }
      return prev.filter((b) => b.id !== id);
    });
  }

  function moveBlockStep(id: string, direction: 'up' | 'down') {
    setBlocks((prev) => {
      const index = prev.findIndex((b) => b.id === id);
      if (index === -1) return prev;
      const targetIndex = direction === 'up' ? index - 1 : index + 1;
      if (targetIndex < 0 || targetIndex >= prev.length) return prev;
      const copy = [...prev];
      const [moved] = copy.splice(index, 1);
      copy.splice(targetIndex, 0, moved);
      return copy;
    });
  }

  function handleDragStart(e: React.DragEvent, id: string) {
    setDraggedBlockId(id);
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/plain', id);
  }

  function handleDragOver(e: React.DragEvent, targetId: string) {
    e.preventDefault();
    if (draggedBlockId && draggedBlockId !== targetId) {
      setDragOverBlockId(targetId);
    }
  }

  function handleDrop(e: React.DragEvent, targetId: string) {
    e.preventDefault();
    setDragOverBlockId(null);
    if (!draggedBlockId || draggedBlockId === targetId) return;

    setBlocks((prev) => {
      const fromIndex = prev.findIndex((b) => b.id === draggedBlockId);
      const toIndex = prev.findIndex((b) => b.id === targetId);
      if (fromIndex === -1 || toIndex === -1) return prev;
      const updated = [...prev];
      const [moved] = updated.splice(fromIndex, 1);
      updated.splice(toIndex, 0, moved);
      return updated;
    });
    setDraggedBlockId(null);
  }

  async function handleBlockImageUpload(
    e: React.ChangeEvent<HTMLInputElement>,
    blockId: string
  ) {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      alert('Selecione um arquivo de imagem válido.');
      return;
    }

    setUploadingBlockId(blockId);
    const ext = file.name.split('.').pop();
    const fileName = `${authorId}/${Date.now()}-${Math.random().toString(36).slice(2, 6)}.${ext}`;

    const { error } = await supabase.storage.from('posts').upload(fileName, file);
    setUploadingBlockId(null);

    if (error) {
      alert('Erro ao enviar imagem: ' + error.message);
      return;
    }

    const { data: pubData } = supabase.storage.from('posts').getPublicUrl(fileName);
    updateBlock(blockId, { imageUrl: pubData.publicUrl });
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (isSubmitting) return;

    const validBlocks = blocks.filter((b) => {
      if (b.type === 'divider') return true;
      if (b.type === 'image') return Boolean(b.imageUrl);
      if (b.type === 'spotify') return Boolean(b.spotifyTrackId);
      const plain = (b.html || '').replace(/<[^>]*>/g, '').trim();
      return plain.length > 0;
    });

    if (validBlocks.length === 0) return;

    setIsSubmitting(true);

    const plainTextSummary = validBlocks
      .map((b) =>
        (b.html || '')
          .replace(/<br\s*\/?>/gi, '\n')
          .replace(/<[^>]*>/g, '')
          .trim()
      )
      .filter(Boolean)
      .join('\n\n');

    const firstImageBlock = validBlocks.find((b) => b.type === 'image' && b.imageUrl);
    const firstSpotifyBlock = validBlocks.find(
      (b) => b.type === 'spotify' && b.spotifyTrackId
    );

    const formattedTags = tagsInput
      .split(',')
      .map((t) => t.trim().replace(/^#/, '').toLowerCase())
      .filter((t) => t.length > 0);

    if (defaultTag && !formattedTags.includes(defaultTag.toLowerCase())) {
      formattedTags.push(defaultTag.toLowerCase());
    }

    const { error } = await supabase.from('posts').insert({
      author_id: authorId,
      profile_id: authorId,
      content: plainTextSummary || 'Publicação multimídia',
      image_url: firstImageBlock?.imageUrl || null,
      spotify_track_id: firstSpotifyBlock?.spotifyTrackId || null,
      blocks: validBlocks,
      tags: formattedTags,
      is_pinned: isPinned,
    });

    setIsSubmitting(false);

    if (!error) {
      fetch('/api/newsletter', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'new_post',
          postContent: plainTextSummary || 'Nova publicação multimídia no Insight*',
          postBlocks: validBlocks,
          postTags: formattedTags,
          isPinned,
        }),
      }).catch(() => {});

      setBlocks([createNewBlock('paragraph')]);
      setTagsInput(defaultTag || '');
      setIsPinned(false);
      onPostCreated();
    } else {
      alert('Erro ao publicar insight: ' + error.message);
    }
  }

  function getFontClass(font?: FontStyleType) {
    if (font === 'serif') return 'font-serif tracking-normal';
    if (font === 'mono') return 'font-mono text-[0.92em]';
    return 'font-sans';
  }

  function getBlockTypographyClass(type: PostBlockType) {
    switch (type) {
      case 'h1':
        return 'text-2xl font-extrabold text-primary leading-tight';
      case 'h2':
        return 'text-lg font-bold text-primary leading-snug';
      case 'quote':
        return 'border-l-4 border-accent pl-4 italic text-secondary text-base';
      case 'code':
        return 'p-3.5 rounded-xl bg-elevated border border-border font-mono text-xs text-primary whitespace-pre-wrap';
      default:
        return 'text-sm sm:text-base text-primary leading-relaxed';
    }
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="border-b border-border bg-surface/40 p-5 sm:p-6 space-y-4"
    >
      {/* BARRA DE FERRAMENTAS ESTILO NOTION */}
      <div className="sticky top-2 z-20 flex flex-wrap items-center justify-between gap-2 p-2 rounded-xl bg-elevated/95 backdrop-blur border border-border shadow-lg">
        <div className="flex items-center gap-1 pr-2 border-r border-border">
          <Type className="w-3.5 h-3.5 text-accent ml-1 mr-0.5" />
          {(
            [
              { key: 'sans', label: 'Sans' },
              { key: 'serif', label: 'Serif' },
              { key: 'mono', label: 'Mono' },
            ] as { key: FontStyleType; label: string }[]
          ).map((f) => (
            <button
              key={f.key}
              type="button"
              onMouseDown={(e) => {
                e.preventDefault();
                if (activeBlock) updateBlock(activeBlock.id, { fontStyle: f.key });
              }}
              className={`px-2 py-1 rounded-md text-xs font-semibold transition-colors ${
                (activeBlock?.fontStyle || 'sans') === f.key
                  ? 'bg-accent text-white'
                  : 'text-secondary hover:text-primary hover:bg-surface'
              }`}
            >
              {f.label}
            </button>
          ))}
        </div>

        <div className="flex items-center gap-1 pr-2 border-r border-border relative">
          <button
            type="button"
            title="Negrito (Ctrl+B)"
            onMouseDown={(e) => {
              e.preventDefault();
              applyInlineFormat('bold');
            }}
            className="p-1.5 rounded-md text-secondary hover:text-primary hover:bg-surface"
          >
            <Bold className="w-4 h-4" />
          </button>

          <button
            type="button"
            title="Itálico (Ctrl+I)"
            onMouseDown={(e) => {
              e.preventDefault();
              applyInlineFormat('italic');
            }}
            className="p-1.5 rounded-md text-secondary hover:text-primary hover:bg-surface"
          >
            <Italic className="w-4 h-4" />
          </button>

          <button
            type="button"
            title="Sublinhar (Ctrl+U)"
            onMouseDown={(e) => {
              e.preventDefault();
              applyInlineFormat('underline');
            }}
            className="p-1.5 rounded-md text-secondary hover:text-primary hover:bg-surface"
          >
            <Underline className="w-4 h-4" />
          </button>

          <button
            type="button"
            title="Tachado"
            onMouseDown={(e) => {
              e.preventDefault();
              applyInlineFormat('strikeThrough');
            }}
            className="p-1.5 rounded-md text-secondary hover:text-primary hover:bg-surface"
          >
            <Strikethrough className="w-4 h-4" />
          </button>

          <div className="relative">
            <button
              type="button"
              title="Grifar texto selecionado"
              onMouseDown={(e) => {
                e.preventDefault();
                setShowHighlighterMenu((prev) => !prev);
              }}
              className={`p-1.5 rounded-md flex items-center gap-1 transition-colors ${
                showHighlighterMenu
                  ? 'bg-accent text-white'
                  : 'text-secondary hover:text-primary hover:bg-surface'
              }`}
            >
              <Highlighter className="w-4 h-4" />
            </button>

            {showHighlighterMenu && (
              <div className="absolute left-0 top-full mt-2 p-2 rounded-xl bg-surface border border-border shadow-xl flex items-center gap-1.5 z-30">
                {HIGHLIGHT_COLORS.map((item) => (
                  <button
                    key={item.name}
                    type="button"
                    title={`Grifar: ${item.name}`}
                    onMouseDown={(e) => {
                      e.preventDefault();
                      applyHighlightColor(item.color);
                    }}
                    style={{ backgroundColor: item.color }}
                    className="w-6 h-6 rounded-full border border-white/20 hover:scale-110 transition-transform"
                  />
                ))}
                <button
                  type="button"
                  title="Remover grifo"
                  onMouseDown={(e) => {
                    e.preventDefault();
                    applyHighlightColor(null);
                  }}
                  className="px-2 py-1 rounded bg-elevated text-[10px] text-secondary hover:text-primary"
                >
                  Limpar
                </button>
              </div>
            )}
          </div>
        </div>

        <div className="flex items-center gap-1">
          {(
            [
              { align: 'left', icon: AlignLeft, title: 'Alinhar à esquerda' },
              { align: 'center', icon: AlignCenter, title: 'Centralizar' },
              { align: 'right', icon: AlignRight, title: 'Alinhar à direita' },
            ] as const
          ).map((item) => {
            const Icon = item.icon;
            return (
              <button
                key={item.align}
                type="button"
                title={item.title}
                onMouseDown={(e) => {
                  e.preventDefault();
                  if (activeBlock) updateBlock(activeBlock.id, { align: item.align });
                }}
                className={`p-1.5 rounded-md transition-colors ${
                  (activeBlock?.align || 'left') === item.align
                    ? 'text-accent bg-surface'
                    : 'text-secondary hover:text-primary hover:bg-surface'
                }`}
              >
                <Icon className="w-3.5 h-3.5" />
              </button>
            );
          })}
        </div>
      </div>

      {/* ÁREA DE BLOCOS ARRASTÁVEIS ESTILO NOTION */}
      <div className="space-y-2.5 min-h-[120px]">
        {blocks.map((block, index) => {
          const isDragOver = dragOverBlockId === block.id;

          return (
            <div
              key={block.id}
              draggable
              onDragStart={(e) => handleDragStart(e, block.id)}
              onDragOver={(e) => handleDragOver(e, block.id)}
              onDragLeave={() => setDragOverBlockId(null)}
              onDrop={(e) => handleDrop(e, block.id)}
              className={`group relative flex items-start gap-2 rounded-xl p-1.5 transition-all ${
                isDragOver ? 'border-t-2 border-accent bg-accent/5' : 'hover:bg-elevated/40'
              }`}
            >
              <div className="flex items-center gap-0.5 pt-1 opacity-40 group-hover:opacity-100 transition-opacity select-none shrink-0">
                <button
                  type="button"
                  title="Adicionar ou trocar tipo de bloco"
                  onClick={() =>
                    setMenuOpenForBlockId(
                      menuOpenForBlockId === block.id ? null : block.id
                    )
                  }
                  className="p-1 rounded hover:bg-elevated text-secondary hover:text-accent"
                >
                  <Plus className="w-4 h-4" />
                </button>

                <div
                  title="Arraste para mover este bloco"
                  className="p-1 rounded cursor-grab active:cursor-grabbing hover:bg-elevated text-secondary hover:text-primary"
                >
                  <GripVertical className="w-4 h-4" />
                </div>
              </div>

              <div className="flex-1 min-w-0">
                {(block.type === 'paragraph' ||
                  block.type === 'h1' ||
                  block.type === 'h2' ||
                  block.type === 'quote' ||
                  block.type === 'code') && (
                  <RichBlockEditable
                    block={block}
                    placeholder={
                      index === 0 && block.type === 'paragraph'
                        ? "Apenas poste... (Digite '/' para comandos ou selecione o texto para grifar)"
                        : block.type === 'h1'
                        ? 'Título principal...'
                        : block.type === 'h2'
                        ? 'Subtítulo...'
                        : block.type === 'quote'
                        ? 'Escreva uma citação...'
                        : block.type === 'code'
                        ? '// Cole ou digite seu código aqui...'
                        : "Digite '/' para comandos ou continue escrevendo..."
                    }
                    className={`${getFontClass(block.fontStyle)} ${getBlockTypographyClass(
                      block.type
                    )}`}
                    onFocus={() => setActiveBlockId(block.id)}
                    onChangeHtml={(html) => updateBlock(block.id, { html })}
                    onSlashTriggered={() => setMenuOpenForBlockId(block.id)}
                    onEnterPressed={() => insertBlockAfter(block.id, 'paragraph')}
                    onBackspaceEmpty={() => removeBlock(block.id)}
                  />
                )}

                {block.type === 'bullet' && (
                  <div className="flex items-start gap-2.5">
                    <span className="text-accent font-bold mt-1">•</span>
                    <RichBlockEditable
                      block={block}
                      placeholder="Item da lista..."
                      className={`${getFontClass(
                        block.fontStyle
                      )} text-sm sm:text-base text-primary leading-relaxed`}
                      onFocus={() => setActiveBlockId(block.id)}
                      onChangeHtml={(html) => updateBlock(block.id, { html })}
                      onSlashTriggered={() => setMenuOpenForBlockId(block.id)}
                      onEnterPressed={() => insertBlockAfter(block.id, 'bullet')}
                      onBackspaceEmpty={() => removeBlock(block.id)}
                    />
                  </div>
                )}

                {block.type === 'callout' && (
                  <div className="p-3.5 rounded-xl bg-elevated border border-accent/40 flex items-start gap-3">
                    <input
                      type="text"
                      value={block.calloutIcon || '💡'}
                      onChange={(e) =>
                        updateBlock(block.id, { calloutIcon: e.target.value })
                      }
                      maxLength={2}
                      title="Trocar emoji do Callout"
                      className="w-7 text-center bg-transparent text-lg focus:outline-none shrink-0"
                    />
                    <RichBlockEditable
                      block={block}
                      placeholder="Escreva uma nota ou destaque importante..."
                      className={`${getFontClass(
                        block.fontStyle
                      )} text-sm text-primary leading-relaxed`}
                      onFocus={() => setActiveBlockId(block.id)}
                      onChangeHtml={(html) => updateBlock(block.id, { html })}
                      onSlashTriggered={() => setMenuOpenForBlockId(block.id)}
                      onEnterPressed={() => insertBlockAfter(block.id, 'paragraph')}
                      onBackspaceEmpty={() => removeBlock(block.id)}
                    />
                  </div>
                )}

                {block.type === 'divider' && (
                  <div className="py-3">
                    <hr className="border-border" />
                  </div>
                )}

                {block.type === 'image' && (
                  <div className="p-3 rounded-xl bg-elevated border border-border space-y-3">
                    {!block.imageUrl ? (
                      <label className="flex flex-col items-center justify-center py-6 border border-dashed border-border rounded-xl cursor-pointer hover:border-accent transition-colors">
                        <ImageIcon className="w-6 h-6 text-accent mb-1.5" />
                        <span className="text-xs font-semibold text-primary">
                          {uploadingBlockId === block.id
                            ? 'Enviando imagem...'
                            : 'Clique para selecionar uma imagem'}
                        </span>
                        <span className="text-[11px] text-muted mt-0.5">
                          Você poderá ajustar o tamanho (50%, 75% ou 100%) e arrastar a posição
                        </span>
                        <input
                          type="file"
                          accept="image/*"
                          onChange={(e) => handleBlockImageUpload(e, block.id)}
                          className="hidden"
                        />
                      </label>
                    ) : (
                      <div className="space-y-2.5">
                        <div className="flex items-center justify-between gap-2 text-xs">
                          <div className="flex items-center gap-1">
                            <span className="text-[11px] text-muted mr-1">Largura:</span>
                            {(['50%', '75%', '100%'] as ImageWidthType[]).map((w) => (
                              <button
                                key={w}
                                type="button"
                                onClick={() => updateBlock(block.id, { imageWidth: w })}
                                className={`px-2 py-0.5 rounded font-bold text-[11px] transition-colors ${
                                  (block.imageWidth || '100%') === w
                                    ? 'bg-accent text-white'
                                    : 'bg-surface text-secondary hover:text-primary'
                                }`}
                              >
                                {w}
                              </button>
                            ))}
                          </div>

                          <button
                            type="button"
                            onClick={() => updateBlock(block.id, { imageUrl: null })}
                            className="text-xs text-muted hover:text-danger flex items-center gap-1"
                          >
                            <X className="w-3.5 h-3.5" />
                            <span>Trocar foto</span>
                          </button>
                        </div>

                        <div
                          style={{ width: block.imageWidth || '100%' }}
                          className="mx-auto transition-all duration-200"
                        >
                          <img
                            src={block.imageUrl}
                            alt={block.imageCaption || 'Imagem do post'}
                            className="w-full h-auto rounded-xl border border-border object-cover"
                          />
                        </div>

                        <input
                          type="text"
                          value={block.imageCaption || ''}
                          onChange={(e) =>
                            updateBlock(block.id, { imageCaption: e.target.value })
                          }
                          placeholder="Adicionar legenda para a imagem (opcional)..."
                          className="w-full bg-transparent text-center text-xs text-secondary placeholder:text-muted focus:outline-none"
                        />
                      </div>
                    )}
                  </div>
                )}

                {block.type === 'spotify' && (
                  <div className="p-3 rounded-xl bg-elevated border border-border space-y-2">
                    {!block.spotifyTrackId ? (
                      <div className="flex items-center gap-2">
                        <Music className="w-4 h-4 text-[#1DB954] shrink-0" />
                        <input
                          type="text"
                          placeholder="Cole o link da música do Spotify (open.spotify.com/track/...) e aperte Enter"
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') {
                              e.preventDefault();
                              const id = extractSpotifyTrackId(e.currentTarget.value);
                              if (id) updateBlock(block.id, { spotifyTrackId: id });
                              else alert('Link do Spotify inválido.');
                            }
                          }}
                          onBlur={(e) => {
                            const id = extractSpotifyTrackId(e.currentTarget.value);
                            if (id) updateBlock(block.id, { spotifyTrackId: id });
                          }}
                          className="flex-1 bg-transparent text-xs text-primary placeholder:text-muted focus:outline-none"
                        />
                      </div>
                    ) : (
                      <div className="flex items-center gap-2">
                        <iframe
                          src={`https://open.spotify.com/embed/track/${block.spotifyTrackId}?utm_source=generator&theme=0`}
                          width="100%"
                          height="80"
                          frameBorder="0"
                          allow="autoplay; clipboard-write; encrypted-media; fullscreen; picture-in-picture"
                          loading="lazy"
                          className="rounded-lg"
                        />
                        <button
                          type="button"
                          onClick={() => updateBlock(block.id, { spotifyTrackId: null })}
                          className="p-1.5 text-muted hover:text-danger"
                        >
                          <X className="w-4 h-4" />
                        </button>
                      </div>
                    )}
                  </div>
                )}

                {menuOpenForBlockId === block.id && (
                  <div className="mt-2 p-2 rounded-2xl bg-surface border border-border shadow-2xl grid grid-cols-1 sm:grid-cols-2 gap-1.5 z-30">
                    {BLOCK_MENU_ITEMS.map((item) => {
                      const Icon = item.icon;
                      return (
                        <button
                          key={item.type}
                          type="button"
                          onClick={() => {
                            const isCurrentEmpty =
                              !(block.html || '').replace(/<[^>]*>/g, '').trim() &&
                              !block.imageUrl &&
                              !block.spotifyTrackId;

                            if (isCurrentEmpty) {
                              updateBlock(block.id, {
                                type: item.type,
                                fontStyle: item.type === 'code' ? 'mono' : block.fontStyle,
                              });
                              setMenuOpenForBlockId(null);
                            } else {
                              insertBlockAfter(block.id, item.type);
                            }
                          }}
                          className="flex items-center gap-2.5 p-2 rounded-xl hover:bg-elevated text-left transition-colors"
                        >
                          <div className="p-2 rounded-lg bg-elevated border border-border text-accent shrink-0">
                            <Icon className="w-4 h-4" />
                          </div>
                          <div>
                            <p className="text-xs font-bold text-primary">{item.label}</p>
                            <p className="text-[10px] text-muted">{item.desc}</p>
                          </div>
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>

              <div className="flex items-center gap-0.5 pt-1 opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
                <button
                  type="button"
                  onClick={() => moveBlockStep(block.id, 'up')}
                  disabled={index === 0}
                  title="Mover para cima"
                  className="p-1 rounded hover:bg-elevated text-muted hover:text-primary disabled:opacity-20"
                >
                  <ArrowUp className="w-3.5 h-3.5" />
                </button>
                <button
                  type="button"
                  onClick={() => moveBlockStep(block.id, 'down')}
                  disabled={index === blocks.length - 1}
                  title="Mover para baixo"
                  className="p-1 rounded hover:bg-elevated text-muted hover:text-primary disabled:opacity-20"
                >
                  <ArrowDown className="w-3.5 h-3.5" />
                </button>
                <button
                  type="button"
                  onClick={() => removeBlock(block.id)}
                  title="Remover bloco"
                  className="p-1 rounded hover:bg-elevated text-muted hover:text-danger"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          );
        })}
      </div>

      <div className="flex items-center gap-2 pt-1">
        <button
          type="button"
          onClick={() => insertBlockAfter(blocks[blocks.length - 1].id, 'paragraph')}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-elevated border border-border text-xs font-semibold text-secondary hover:text-primary hover:border-accent transition-colors"
        >
          <Plus className="w-3.5 h-3.5 text-accent" />
          <span>Novo bloco de texto</span>
        </button>

        <button
          type="button"
          onClick={() => insertBlockAfter(blocks[blocks.length - 1].id, 'image')}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-elevated border border-border text-xs font-semibold text-secondary hover:text-primary hover:border-accent transition-colors"
        >
          <ImageIcon className="w-3.5 h-3.5 text-accent" />
          <span>Inserir imagem</span>
        </button>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3 pt-3 border-t border-border">
        <div className="flex items-center gap-2 flex-1 min-w-[180px]">
          <Hash className="w-4 h-4 text-accent shrink-0" />
          <input
            type="text"
            value={tagsInput}
            onChange={(e) => setTagsInput(e.target.value)}
            placeholder="Tags (ex: artigue, dev, rock)"
            className="w-full bg-transparent text-xs text-secondary placeholder:text-muted focus:outline-none"
          />
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setIsPinned(!isPinned)}
            title="Fixar no topo"
            className={`p-2 rounded-lg border transition-colors ${
              isPinned
                ? 'border-accent text-accent bg-accent/10'
                : 'border-border text-secondary hover:text-primary bg-elevated'
            }`}
          >
            <Pin className="w-4 h-4" />
          </button>

          <button
            type="submit"
            disabled={isSubmitting}
            className="flex items-center gap-2 px-5 py-2 rounded-lg bg-accent text-white text-xs font-bold hover:bg-accent-hover disabled:opacity-50 transition-colors"
          >
            <Send className="w-3.5 h-3.5" />
            <span>{isSubmitting ? 'Publicando...' : 'Publicar Insight'}</span>
          </button>
        </div>
      </div>
    </form>
  );
}