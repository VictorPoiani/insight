export interface SocialLinks {
  instagram?: string;
  spotify?: string;
  steam?: string;
  tiktok?: string;
  github?: string;
}

export interface Profile {
  id: string;
  username: string;
  full_name: string;
  display_name?: string | null;
  nickname?: string | null;
  nickname_color?: string | null;
  location?: string | null;
  birthday?: string | null;
  bio: string | null;
  avatar_url: string | null;
  banner_url: string | null;
  cover_url?: string | null;
  spotify_track_id?: string | null;
  tags?: string[] | null;
  followers_count?: number | null;
  social_links: SocialLinks;
  created_at: string;
}

export type PostBlockType =
  | 'paragraph'
  | 'h1'
  | 'h2'
  | 'quote'
  | 'callout'
  | 'code'
  | 'bullet'
  | 'divider'
  | 'image'
  | 'spotify';

export type FontStyleType = 'sans' | 'serif' | 'mono';
export type ImageWidthType = '50%' | '75%' | '100%';

export interface PostBlock {
  id: string;
  type: PostBlockType;
  html?: string;               // Texto rico com grifos, sublinhados, negrito, etc.
  fontStyle?: FontStyleType;   // Estilo da fonte do bloco (Sans, Serif ou Mono)
  align?: 'left' | 'center' | 'right';
  calloutIcon?: string;        // Emoji do bloco de destaque (Callout)
  imageUrl?: string | null;    // URL da imagem no Supabase Storage
  imageCaption?: string;       // Legenda da imagem
  imageWidth?: ImageWidthType; // Tamanho responsivo da imagem (50%, 75%, 100%)
  spotifyTrackId?: string | null;
}

export interface Post {
  id: string;
  author_id: string;
  profile_id?: string;
  parent_id: string | null;
  content: string;
  image_url: string | null;
  spotify_track_id?: string | null;
  blocks?: PostBlock[] | null;
  tags: string[];
  is_pinned: boolean;
  likes_count: number;
  reposts_count?: number;
  views_count: number;
  created_at: string;
  profiles?: Profile;
  replies_count?: number;
}

export interface Reply {
  id: string;
  post_id: string;
  profile_id: string | null;
  author_name: string | null;
  author_handle: string | null;
  avatar_url: string | null;
  content: string;
  image_url: string | null;
  spotify_track_id: string | null;
  created_at: string;
}

export interface NotificationItem {
  id: string;
  user_id: string;
  type: 'like' | 'reply' | 'subscribe' | 'system';
  message: string;
  post_id: string | null;
  is_read: boolean;
  created_at: string;
}
export interface CustomTopic {
  id: string;
  name: string;
  tag: string;
  color: string;
  banner_url: string | null;
  description_blocks?: PostBlock[] | null;
  created_at: string;
}