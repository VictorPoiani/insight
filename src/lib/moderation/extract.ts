/**
 * Extrai o que precisa ser moderado de cada entidade: textos, imagens e vídeos.
 * Varre o JSON dos blocos de forma genérica (qualquer bloco novo já entra).
 */
import { htmlToText } from './normalize';

export type EntityType = 'post' | 'reply' | 'topic' | 'profile';

export interface ModerationInput {
  text: string;
  images: string[];
  /** vídeos SEM quadros extraídos (não dá para analisar → revisão humana) */
  unverifiedVideos: string[];
}

// chaves que nunca são texto do usuário
const IGNORE_KEYS = new Set([
  'id', 'type', 'fontStyle', 'align', 'imageWidth', 'videoWidth', 'imageAlign', 'videoAlign', 'r2Key', 'postVisibility',
  'color', 'chartType', 'calloutIcon', 'gridSpan', 'gridStart', 'status', 'priority', 'category', 'date', 'time',
  'trackId', 'spotifyTrackId', 'mime', 'mimeType', 'size', 'icon', 'template_type', 'visibility', 'profile_id',
  'ownerProfileId', 'notebookId', 'updatedAt', 'createdAt', 'kind', 'previewUrl', 'fileR2Key', 'videoR2Key',
  'imageR2Key', 'banner_r2_key', 'quoteId', 'nodeId', 'parentId', 'from', 'to', 'source', 'target',
]);
const TRUSTED_MEDIA = /^https:\/\/(media\d*\.giphy\.com|i\.giphy\.com|giphy\.com)\//i; // GIPHY já filtrado (rating G)
const IMAGE_EXT = /\.(png|jpe?g|webp|gif|avif|bmp)(\?|$)/i;
const VIDEO_EXT = /\.(mp4|webm|mov|m4v)(\?|$)/i;

function walk(node: unknown, out: { texts: string[]; images: Set<string>; videos: Map<string, boolean> }, parent?: Record<string, unknown>, key?: string) {
  if (node == null) return;
  if (typeof node === 'string') {
    const v = node.trim();
    if (!v || (key && IGNORE_KEYS.has(key))) return;
    if (/^https?:\/\//i.test(v)) {
      if (TRUSTED_MEDIA.test(v)) return;
      const isVideoKey = key === 'videoUrl' || (key === 'url' && parent?.type === 'video') || (key === 'mediaUrl' && VIDEO_EXT.test(v));
      if (isVideoKey || VIDEO_EXT.test(v)) {
        const frames = (parent?.videoFrames ?? parent?.frames ?? parent?.mediaFrames) as unknown;
        out.videos.set(v, Array.isArray(frames) && frames.length > 0);
        return;
      }
      if (IMAGE_EXT.test(v) || /image|avatar|cover|banner|thumb|frame/i.test(key || '') || parent?.type === 'image' || parent?.type === 'gif') {
        out.images.add(v);
      }
      return; // outros links: só o texto ao redor importa
    }
    out.texts.push(key && /html/i.test(key) ? htmlToText(v) : v);
    return;
  }
  if (Array.isArray(node)) {
    for (const item of node) walk(item, out, parent, key);
    return;
  }
  if (typeof node === 'object') {
    for (const [k, v] of Object.entries(node as Record<string, unknown>)) walk(v, out, node as Record<string, unknown>, k);
  }
}

export function collect(...parts: unknown[]): ModerationInput {
  const out = { texts: [] as string[], images: new Set<string>(), videos: new Map<string, boolean>() };
  for (const p of parts) walk(p, out);
  return {
    text: out.texts.join('\n').slice(0, 60000),
    images: Array.from(out.images),
    unverifiedVideos: Array.from(out.videos.entries()).filter(([, hasFrames]) => !hasFrames).map(([u]) => u),
  };
}

/** Colunas lidas de cada tabela. */
export const ENTITY_SELECT: Record<EntityType, { table: string; columns: string }> = {
  post: { table: 'posts', columns: 'id, profile_id, author_id, content, blocks, tags, image_url, moderation_status, is_nsfw, moderation_hash, created_at' },
  reply: { table: 'replies', columns: 'id, post_id, profile_id, content, blocks, image_url, moderation_status, is_nsfw, moderation_hash, created_at' },
  topic: { table: 'custom_topics', columns: 'id, profile_id, name, tag, banner_url, description_blocks, workspace_data, moderation_status, is_nsfw, moderation_hash' },
  profile: { table: 'profiles', columns: 'id, username, display_name, full_name, nickname, bio, avatar_url, cover_url, banner_url' },
};

export function ownerOf(type: EntityType, row: Record<string, unknown>): string | null {
  if (type === 'profile') return String(row.id);
  if (type === 'post') return (row.author_id as string) || (row.profile_id as string) || null;
  return (row.profile_id as string) || null;
}

export function inputFor(type: EntityType, row: Record<string, unknown>): ModerationInput {
  switch (type) {
    case 'post':
      return collect({ content: row.content, tags: row.tags, imageUrl: row.image_url }, row.blocks);
    case 'reply':
      return collect({ content: row.content, imageUrl: row.image_url }, row.blocks);
    case 'topic':
      return collect({ name: row.name, tag: row.tag, banner_url: row.banner_url }, row.description_blocks, row.workspace_data);
    case 'profile':
      return collect({
        display_name: row.display_name,
        full_name: row.full_name,
        nickname: row.nickname,
        bio: row.bio,
        avatar_url: row.avatar_url,
        cover_url: row.cover_url,
        banner_url: row.banner_url,
      });
  }
}
