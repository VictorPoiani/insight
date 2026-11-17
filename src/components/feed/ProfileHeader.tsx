'use client';

import { useState, useRef, useEffect, useMemo } from 'react';
import Link from 'next/link';
import { Profile } from '@/types/database';
import { createClient } from '@/lib/supabase/client';
import { CustomSpotifyPlayer } from './CustomSpotifyPlayer';
import { SpotifySearchModal } from './SpotifySearchModal';
import {
  Bolt,
  BellPlus,
  BellRing,
  Check,
  X,
  ImagePlus,
  SquarePen,
  MapPin,
  Calendar,
  Cake,
  ShieldCheck,
  Plus,
  Settings,
  Search,
  Sparkles,
  Code2,
  Terminal,
  Database,
  Cpu,
  Gamepad2,
  Palette,
  Layers,
  Globe,
  Crown,
  Brain,
  Target,
  Lightbulb,
  Compass,
  Smile,
  Heart,
  BookOpen,
  Eye,
  Music,
  Guitar,
  Headphones,
  Feather,
  Clapperboard,
  Flame,
  Swords,
  Rocket,
  Wand2,
  Trophy,
  GraduationCap,
  Binary,
  Atom,
  Users,
  Briefcase,
  Coffee,
  Boxes,
  Tag,
  Moon,
  Clock,
  ShieldAlert,
  Wifi,
  ChevronDown,
  Link2,
  Trash2,
  ExternalLink,
  ArrowUp,
  ArrowDown,
  Mail,
  Send,
} from 'lucide-react';

interface ProfileHeaderProps {
  profile: Profile;
  postsCount: number;
  isAdmin: boolean;
  onProfileUpdated?: () => void;
}

export interface CustomSocialLinkItem {
  id: string;
  url: string;
  label?: string;
}

interface DetectedPlatform {
  name: string;
  slug: string | null;
  domain: string;
}

const DEFAULT_VAPID_PUBLIC_KEY =
  process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY ||
  'BGilUzY0daz-dWuBYeF7daX9tjFve3exE_StHwqBWnYiK1QHeeTcrObIX0Kwdi5UY8MPbRKw0Aza3Ps-MuvVMJI';

function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const rawData = window.atob(base64);
  const outputArray = new Uint8Array(rawData.length);
  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray;
}

const KNOWN_PLATFORMS: {
  match: string[];
  name: string;
  slug: string;
}[] = [
    { match: ['instagram.com'], name: 'Instagram', slug: 'instagram' },
    { match: ['tiktok.com'], name: 'TikTok', slug: 'tiktok' },
    { match: ['spotify.com'], name: 'Spotify', slug: 'spotify' },
    {
      match: ['steamcommunity.com', 'store.steampowered.com', 's.team'],
      name: 'Steam',
      slug: 'steam',
    },
    { match: ['github.com'], name: 'GitHub', slug: 'github' },
    { match: ['linkedin.com'], name: 'LinkedIn', slug: 'linkedin' },
    { match: ['x.com', 'twitter.com'], name: 'X', slug: 'x' },
    { match: ['youtube.com', 'youtu.be'], name: 'YouTube', slug: 'youtube' },
    { match: ['discord.gg', 'discord.com'], name: 'Discord', slug: 'discord' },
    { match: ['twitch.tv'], name: 'Twitch', slug: 'twitch' },
    { match: ['threads.net'], name: 'Threads', slug: 'threads' },
    { match: ['bsky.app'], name: 'Bluesky', slug: 'bluesky' },
    { match: ['behance.net'], name: 'Behance', slug: 'behance' },
    { match: ['dribbble.com'], name: 'Dribbble', slug: 'dribbble' },
    { match: ['figma.com'], name: 'Figma', slug: 'figma' },
    { match: ['notion.so', 'notion.site'], name: 'Notion', slug: 'notion' },
    { match: ['medium.com'], name: 'Medium', slug: 'medium' },
    { match: ['dev.to'], name: 'DEV', slug: 'devdotto' },
    { match: ['reddit.com'], name: 'Reddit', slug: 'reddit' },
    { match: ['pinterest.com'], name: 'Pinterest', slug: 'pinterest' },
    { match: ['wa.me', 'whatsapp.com'], name: 'WhatsApp', slug: 'whatsapp' },
    { match: ['t.me', 'telegram.org'], name: 'Telegram', slug: 'telegram' },
    { match: ['letterboxd.com'], name: 'Letterboxd', slug: 'letterboxd' },
    { match: ['last.fm'], name: 'Last.fm', slug: 'lastdotfm' },
    { match: ['soundcloud.com'], name: 'SoundCloud', slug: 'soundcloud' },
    { match: ['vercel.app', 'vercel.com'], name: 'Vercel', slug: 'vercel' },
  ];

function normalizeUrl(raw: string): string {
  const trimmed = raw.trim();
  if (!trimmed) return '';
  if (/^https?:\/\//i.test(trimmed)) return trimmed;
  return `https://${trimmed}`;
}

function detectPlatformFromUrl(rawUrl: string): DetectedPlatform {
  try {
    const normalized = normalizeUrl(rawUrl);
    if (!normalized) return { name: 'Website', slug: null, domain: '' };
    const parsed = new URL(normalized);
    const host = parsed.hostname.replace(/^www\./i, '').toLowerCase();

    for (const platform of KNOWN_PLATFORMS) {
      if (platform.match.some((m) => host === m || host.endsWith(`.${m}`))) {
        return {
          name: platform.name,
          slug: platform.slug,
          domain: host,
        };
      }
    }

    const baseName = host.split('.')[0] || 'Website';
    const capitalized = baseName.charAt(0).toUpperCase() + baseName.slice(1);
    return {
      name: capitalized,
      slug: null,
      domain: host,
    };
  } catch {
    return { name: 'Website', slug: null, domain: '' };
  }
}

function buildInitialProfileLinks(socialLinks?: any): CustomSocialLinkItem[] {
  if (
    socialLinks &&
    Array.isArray(socialLinks.custom_links) &&
    socialLinks.custom_links.length > 0
  ) {
    return socialLinks.custom_links.filter((item: any) =>
      Boolean(item?.url?.trim())
    );
  }

  const defaults: CustomSocialLinkItem[] = [
    {
      id: 'lnk-instagram',
      url:
        socialLinks?.instagram || 'https://www.instagram.com/victorpoiani/',
      label: 'Instagram',
    },
    {
      id: 'lnk-tiktok',
      url: socialLinks?.tiktok || 'https://tiktok.com',
      label: 'TikTok',
    },
    {
      id: 'lnk-spotify',
      url: socialLinks?.spotify || 'https://open.spotify.com',
      label: 'Spotify',
    },
    {
      id: 'lnk-steam',
      url: socialLinks?.steam || 'https://store.steampowered.com',
      label: 'Steam',
    },
  ];

  if (socialLinks?.github) {
    defaults.push({
      id: 'lnk-github',
      url: socialLinks.github,
      label: 'GitHub',
    });
  }

  return defaults;
}

function SmartPlatformIcon({
  url,
  className = 'w-4 h-4',
}: {
  url: string;
  className?: string;
}) {
  const [imgError, setImgError] = useState(false);
  const meta = useMemo(() => detectPlatformFromUrl(url), [url]);

  if (!meta.domain || imgError) {
    return <Globe className={`${className} text-secondary`} />;
  }

  const iconSrc = meta.slug
    ? `https://cdn.simpleicons.org/${meta.slug}/8e8e93`
    : `https://www.google.com/s2/favicons?domain=${encodeURIComponent(
      meta.domain
    )}&sz=128`;

  return (
    <img
      src={iconSrc}
      alt={meta.name}
      onError={() => setImgError(true)}
      className={`${className} object-contain transition-all duration-200 ${meta.slug
          ? 'opacity-80 group-hover/slink:opacity-100 group-hover/slink:scale-105'
          : 'rounded-sm grayscale opacity-75 group-hover/slink:grayscale-0 group-hover/slink:opacity-100'
        }`}
    />
  );
}

interface StatusOptionConfig {
  id: string;
  label: string;
  color: string;
  pulse: boolean;
  icon: React.ComponentType<{ className?: string; style?: React.CSSProperties }>;
}

const USER_STATUS_OPTIONS: StatusOptionConfig[] = [
  { id: 'online', label: 'Online', color: '#10b981', pulse: true, icon: Wifi },
  { id: 'coding', label: 'Desenvolvendo', color: '#38bdf8', pulse: true, icon: Code2 },
  { id: 'gaming', label: 'Jogando', color: '#a855f7', pulse: true, icon: Gamepad2 },
  { id: 'studying', label: 'Estudando', color: '#f59e0b', pulse: false, icon: BookOpen },
  { id: 'guitar', label: 'Tocando', color: '#f43f5e', pulse: true, icon: Guitar },
  { id: 'music', label: 'Ouvindo música', color: '#1DB954', pulse: true, icon: Headphones },
  { id: 'creating', label: 'Criando', color: '#ec4899', pulse: true, icon: Sparkles },
  { id: 'busy', label: 'Ocupado', color: '#ef4444', pulse: false, icon: ShieldAlert },
  { id: 'away', label: 'Ausente', color: '#eab308', pulse: false, icon: Clock },
  { id: 'sleeping', label: 'Dormindo', color: '#6366f1', pulse: false, icon: Moon },
];

interface TagItemConfig {
  label: string;
  icon: React.ComponentType<{ className?: string; style?: React.CSSProperties }>;
}

interface TagCategoryConfig {
  id: string;
  name: string;
  color: string;
  icon: React.ComponentType<{ className?: string; style?: React.CSSProperties }>;
  tags: TagItemConfig[];
}

const TAG_CATEGORIES: TagCategoryConfig[] = [
  {
    id: 'tech',
    name: 'Tecnologia & Dev',
    color: '#38bdf8',
    icon: Code2,
    tags: [
      { label: 'Full-Stack', icon: Layers },
      { label: 'Next.js', icon: Globe },
      { label: 'TypeScript', icon: Code2 },
      { label: 'Javascript', icon: Terminal },
      { label: 'Python', icon: Terminal },
      { label: 'C#/C++', icon: Cpu },
      { label: 'SQL & Dados', icon: Database },
      { label: 'Design UX', icon: Palette },
      { label: 'Game Developer', icon: Gamepad2 },
      { label: 'IA & Visão', icon: Eye },
      { label: 'Programação', icon: Code2 },
      { label: 'Open Source', icon: Globe },
    ],
  },
  {
    id: 'personalidade',
    name: 'Personalidade',
    color: '#a855f7',
    icon: Sparkles,
    tags: [
      { label: 'Lider', icon: Crown },
      { label: 'Reflexivo', icon: Brain },
      { label: 'Disciplinado', icon: Target },
      { label: 'Polímata', icon: Lightbulb },
      { label: 'Estudioso', icon: BookOpen },
      { label: 'Sonhador', icon: Compass },
      { label: 'Criativo', icon: Sparkles },
      { label: 'Engraçado', icon: Smile },
      { label: 'Romantico', icon: Heart },
      { label: 'Analítico', icon: Eye },
    ],
  },
  {
    id: 'musica_arte',
    name: 'Música & Arte',
    color: '#10b981',
    icon: Music,
    tags: [
      { label: 'Guitarrista', icon: Guitar },
      { label: 'Rock', icon: Flame },
      { label: 'Instrumentista', icon: Music },
      { label: 'Música', icon: Headphones },
      { label: 'Escrita & Paródia', icon: Feather },
      { label: 'Pixel Art', icon: Palette },
      { label: 'Roteirista', icon: Clapperboard },
      { label: 'Literatura', icon: BookOpen },
    ],
  },
  {
    id: 'geek',
    name: 'Geek & Entretenimento',
    color: '#f43f5e',
    icon: Flame,
    tags: [
      { label: 'Marvel', icon: Flame },
      { label: 'DC', icon: ZapIcon },
      { label: 'Fantasia', icon: Wand2 },
      { label: 'Animes', icon: Sparkles },
      { label: 'HQs & Mangás', icon: BookOpen },
      { label: 'Sci-Fi', icon: Rocket },
      { label: 'RPG & Estratégia', icon: Swords },
      { label: 'Jogos', icon: Gamepad2 },
      { label: 'Cinema & Séries', icon: Clapperboard },
    ],
  },
  {
    id: 'academia',
    name: 'Ciência & Academia',
    color: '#f59e0b',
    icon: GraduationCap,
    tags: [
      { label: 'Sistemas de Informação', icon: GraduationCap },
      { label: 'Data Science', icon: Database },
      { label: 'Matemática & Lógica', icon: Binary },
      { label: 'Física & Cosmos', icon: Atom },
      { label: 'Filosofia', icon: Brain },
      { label: 'Pesquisa', icon: Lightbulb },
    ],
  },
  {
    id: 'comunidade',
    name: 'Comunidade & Vida',
    color: '#f97316',
    icon: Users,
    tags: [
      { label: 'Futebol', icon: Trophy },
      { label: 'Empreendedor', icon: Briefcase },
      { label: 'Filantropia & Mentoria', icon: Users },
      { label: 'Cubo Mágico', icon: Boxes },
      { label: 'Política & Sociedade', icon: Globe },
      { label: 'Café & Código', icon: Coffee },
    ],
  },
];

function ZapIcon({
  className,
  style,
}: {
  className?: string;
  style?: React.CSSProperties;
}) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      style={style}
    >
      <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2" />
    </svg>
  );
}

function resolveTagMeta(tagLabel: string) {
  const normalized = tagLabel.trim().toLowerCase();

  for (const cat of TAG_CATEGORIES) {
    const found = cat.tags.find((t) => t.label.toLowerCase() === normalized);
    if (found) {
      return {
        label: tagLabel,
        color: cat.color,
        categoryName: cat.name,
        Icon: found.icon,
      };
    }
  }

  if (/(dev|code|js|react|sql|tech|tecnologia|dados)/.test(normalized)) {
    return {
      label: tagLabel,
      color: '#38bdf8',
      categoryName: 'Tecnologia & Dev',
      Icon: Code2,
    };
  }
  if (/(music|musica|rock|guitar|som|arte)/.test(normalized)) {
    return {
      label: tagLabel,
      color: '#10b981',
      categoryName: 'Música & Arte',
      Icon: Music,
    };
  }
  if (/(marvel|dc|game|jogo|anime|hq|geek)/.test(normalized)) {
    return {
      label: tagLabel,
      color: '#f43f5e',
      categoryName: 'Geek & Entretenimento',
      Icon: Flame,
    };
  }

  return {
    label: tagLabel,
    color: '#2563eb',
    categoryName: 'Personalizada',
    Icon: Tag,
  };
}

const SLEEK_SCROLLBAR_CLASS =
  '[scrollbar-width:thin] [scrollbar-color:rgba(113,113,122,0.2)_transparent] [&::-webkit-scrollbar]:w-1 [&::-webkit-scrollbar]:h-1 [&::-webkit-scrollbar-track]:bg-transparent [&::-webkit-scrollbar-thumb]:rounded-full [&::-webkit-scrollbar-thumb]:bg-border/40 hover:[&::-webkit-scrollbar-thumb]:bg-accent/60';

const NICKNAME_COLORS = [
  '#E63946',
  '#38b6ff',
  '#1DB954',
  '#facc15',
  '#a855f7',
  '#fb923c',
];

export function ProfileHeader({
  profile,
  postsCount,
  isAdmin,
  onProfileUpdated,
}: ProfileHeaderProps) {
  const [expandEdit, setExpandEdit] = useState(false);
  const [expandSubscribe, setExpandSubscribe] = useState(false);
  const [expandTags, setExpandTags] = useState(false);
  const [expandStatusMenu, setExpandStatusMenu] = useState(false);
  const [showAllProfileTags, setShowAllProfileTags] = useState(false);
  const [showSpotifySearchModal, setShowSpotifySearchModal] = useState(false);

  const [activeCategoryTab, setActiveCategoryTab] = useState<string>('all');
  const [tagSearch, setTagSearch] = useState('');

  // Estados de Status do Usuário
  const [statusId, setStatusId] = useState<string>(
    profile.social_links?.status_id || 'coding'
  );
  const [statusDetail, setStatusDetail] = useState<string>(
    profile.social_links?.status_detail || ''
  );
  const [savingStatus, setSavingStatus] = useState(false);

  // Estados do Gerenciador Minimalista de Links
  const [profileLinks, setProfileLinks] = useState<CustomSocialLinkItem[]>(() =>
    buildInitialProfileLinks(profile.social_links)
  );
  const [expandLinksModal, setExpandLinksModal] = useState(false);
  const [newLinkUrl, setNewLinkUrl] = useState('');
  const [newLinkLabel, setNewLinkLabel] = useState('');
  const [savingLinks, setSavingLinks] = useState(false);

  const [coverUrl, setCoverUrl] = useState(
    profile.cover_url || profile.banner_url || ''
  );
  const [avatarUrl, setAvatarUrl] = useState(
    profile.avatar_url || '/assets/net/logo.png'
  );
  const [followersCount, setFollowersCount] = useState(
    profile.followers_count || 0
  );
  const coverInputRef = useRef<HTMLInputElement>(null);
  const avatarInputRef = useRef<HTMLInputElement>(null);

  const [displayName, setDisplayName] = useState(
    profile.display_name || profile.full_name || 'Victor Poiani'
  );
  const [nickname, setNickname] = useState(profile.nickname || 'o criador');
  const [nicknameColor, setNicknameColor] = useState(
    profile.nickname_color || '#E63946'
  );
  const [location, setLocation] = useState(
    profile.location || 'Rio Paranaíba, MG'
  );
  const [birthday, setBirthday] = useState(profile.birthday || '');
  const [bio, setBio] = useState(profile.bio || '');
  const [savingProfile, setSavingProfile] = useState(false);

  const [selectedTags, setSelectedTags] = useState<string[]>(
    Array.isArray(profile.tags) && profile.tags.length > 0
      ? profile.tags
      : [
        'Full-Stack',
        'Guitarrista',
        'Rock',
        'Marvel',
        'Lider',
        'Sistemas de Informação',
      ]
  );
  const [savingTags, setSavingTags] = useState(false);
  const [spotifyTrackId, setSpotifyTrackId] = useState(
    profile.spotify_track_id || 'Hotel California Eagles'
  );

  // Estados de Notificações (Web Push + E-mail)
  const [pushSupported, setPushSupported] = useState(false);
  const [pushSubscribed, setPushSubscribed] = useState(false);
  const [loadingPush, setLoadingPush] = useState(false);
  const [testingPush, setTestingPush] = useState(false);

  const [subEmail, setSubEmail] = useState('');
  const [submittingSub, setSubmittingSub] = useState(false);
  const [subSuccess, setSubSuccess] = useState(false);

  const supabase = createClient();

  const currentStatus =
    USER_STATUS_OPTIONS.find((s) => s.id === statusId) || USER_STATUS_OPTIONS[0];
  const StatusIcon = currentStatus.icon;

  const detectedPreviewPlatform = useMemo(
    () => detectPlatformFromUrl(newLinkUrl),
    [newLinkUrl]
  );

  useEffect(() => {
    setCoverUrl(profile.cover_url || profile.banner_url || '');
    setAvatarUrl(profile.avatar_url || '/assets/net/logo.png');
    setDisplayName(
      profile.display_name || profile.full_name || 'Victor Poiani'
    );
    setNickname(profile.nickname || 'o criador');
    setNicknameColor(profile.nickname_color || '#E63946');
    setLocation(profile.location || 'Rio Paranaíba, MG');
    setBirthday(profile.birthday || '');
    setBio(profile.bio || '');

    if (profile.social_links?.status_id) {
      setStatusId(profile.social_links.status_id);
    }
    if (typeof profile.social_links?.status_detail === 'string') {
      setStatusDetail(profile.social_links.status_detail);
    }

    setProfileLinks(buildInitialProfileLinks(profile.social_links));

    if (Array.isArray(profile.tags) && profile.tags.length > 0) {
      setSelectedTags(profile.tags);
    }
    if (profile.spotify_track_id) {
      setSpotifyTrackId(profile.spotify_track_id);
    }
  }, [profile]);

  // Verifica se o navegador suporta Web Push e se já está inscrito
  useEffect(() => {
    if (
      typeof window !== 'undefined' &&
      'serviceWorker' in navigator &&
      'PushManager' in window
    ) {
      setPushSupported(true);
      navigator.serviceWorker
        .register('/sw.js')
        .then((reg) => reg.pushManager.getSubscription())
        .then((sub) => {
          setPushSubscribed(Boolean(sub));
        })
        .catch(() => { });
    }
  }, []);

  async function refreshTotalFollowersCount() {
    const [{ count: emailCount }, { count: pushCount }] = await Promise.all([
      supabase.from('subscribers').select('*', { count: 'exact', head: true }),
      supabase
        .from('push_subscriptions')
        .select('*', { count: 'exact', head: true }),
    ]);

    const total = (emailCount || 0) + (pushCount || 0);
    setFollowersCount(total);
    return total;
  }

  useEffect(() => {
    refreshTotalFollowersCount();
  }, [supabase]);

  const filteredCategories = useMemo(() => {
    const query = tagSearch.trim().toLowerCase();
    return TAG_CATEGORIES.filter(
      (cat) => activeCategoryTab === 'all' || cat.id === activeCategoryTab
    )
      .map((cat) => ({
        ...cat,
        tags: query
          ? cat.tags.filter((t) => t.label.toLowerCase().includes(query))
          : cat.tags,
      }))
      .filter((cat) => cat.tags.length > 0);
  }, [activeCategoryTab, tagSearch]);

  async function handleToggleWebPush() {
    if (!pushSupported || loadingPush) return;
    setLoadingPush(true);

    try {
      const reg = await navigator.serviceWorker.register('/sw.js');
      await navigator.serviceWorker.ready;

      const existingSub = await reg.pushManager.getSubscription();

      if (existingSub) {
        await fetch('/api/push', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            action: 'unsubscribe',
            endpoint: existingSub.endpoint,
          }),
        });
        await existingSub.unsubscribe();
        setPushSubscribed(false);
        await refreshTotalFollowersCount();
      } else {
        const permission = await Notification.requestPermission();
        if (permission !== 'granted') {
          alert(
            'Permissão negada no navegador. Para receber alertas instantâneos, permita as notificações no cadeado da barra de endereços.'
          );
          setLoadingPush(false);
          return;
        }

        const newSub = await reg.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: urlBase64ToUint8Array(DEFAULT_VAPID_PUBLIC_KEY) as unknown as BufferSource,
        });
        const res = await fetch('/api/push', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            action: 'subscribe',
            subscription: newSub.toJSON(),
            notifyMode: 'all',
            interestedTags: [],
          }),
        });

        if (!res.ok) {
          const errData = await res.json().catch(() => ({}));
          throw new Error(
            errData.error || 'Erro ao guardar inscrição no Supabase.'
          );
        }

        setPushSubscribed(true);
        const total = await refreshTotalFollowersCount();
        await supabase
          .from('profiles')
          .update({ followers_count: total })
          .eq('id', profile.id);
      }
    } catch (err: any) {
      alert(err?.message || 'Não foi possível configurar o Web Push.');
    } finally {
      setLoadingPush(false);
    }
  }

  async function handleSendTestPush() {
    if (!isAdmin || testingPush) return;
    setTestingPush(true);
    try {
      const res = await fetch('/api/push', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'broadcast',
          title: 'Insight* — Alerta em Tempo Real ⚡',
          message:
            'O sistema de Web Push Nativo está 100% operacional para os seus seguidores!',
          url: '/',
          isOfficialUpdate: true,
        }),
      });
      const data = await res.json();
      if (data.sent === 0) {
        alert(
          'Nenhum dispositivo inscrito ainda. Clique em "Ativar Alertas no Navegador" ao lado para inscrever o seu dispositivo e testar!'
        );
      }
    } catch {
      alert('Erro ao disparar notificação de teste.');
    } finally {
      setTestingPush(false);
    }
  }

  async function handleSaveStatus(nextId: string, nextDetail: string) {
    if (!isAdmin) return;
    setSavingStatus(true);
    setStatusId(nextId);

    const updatedSocialLinks = {
      ...(profile.social_links || {}),
      custom_links: profileLinks,
      status_id: nextId,
      status_detail: nextDetail.trim(),
    };

    const { error } = await supabase
      .from('profiles')
      .update({ social_links: updatedSocialLinks })
      .eq('id', profile.id);

    setSavingStatus(false);

    if (!error) {
      setExpandStatusMenu(false);
      if (onProfileUpdated) onProfileUpdated();
    } else {
      alert('Erro ao salvar status: ' + error.message);
    }
  }

  async function persistProfileLinks(nextLinks: CustomSocialLinkItem[]) {
    setProfileLinks(nextLinks);
    if (!isAdmin) return;

    setSavingLinks(true);

    const findByDomain = (domainPart: string) =>
      nextLinks.find((l) => l.url.toLowerCase().includes(domainPart))?.url || '';

    const updatedSocialLinks = {
      ...(profile.social_links || {}),
      status_id: statusId,
      status_detail: statusDetail,
      instagram: findByDomain('instagram.com'),
      tiktok: findByDomain('tiktok.com'),
      spotify: findByDomain('spotify.com'),
      steam:
        findByDomain('steampowered.com') ||
        findByDomain('steamcommunity.com') ||
        findByDomain('s.team'),
      github: findByDomain('github.com'),
      custom_links: nextLinks,
    };

    const { error } = await supabase
      .from('profiles')
      .update({ social_links: updatedSocialLinks })
      .eq('id', profile.id);

    setSavingLinks(false);

    if (error) {
      alert('Erro ao guardar links: ' + error.message);
      return;
    }

    onProfileUpdated?.();
  }

  function handleAddNewLink(e: React.FormEvent) {
    e.preventDefault();
    const cleanUrl = normalizeUrl(newLinkUrl);
    if (!cleanUrl) return;

    const detected = detectPlatformFromUrl(cleanUrl);
    const nextItem: CustomSocialLinkItem = {
      id: `lnk-${Date.now()}-${Math.random().toString(36).slice(2, 5)}`,
      url: cleanUrl,
      label: newLinkLabel.trim() || detected.name,
    };

    const nextList = [...profileLinks, nextItem];
    setNewLinkUrl('');
    setNewLinkLabel('');
    persistProfileLinks(nextList);
  }

  function handleRemoveLink(id: string) {
    const nextList = profileLinks.filter((item) => item.id !== id);
    persistProfileLinks(nextList);
  }

  function handleMoveLink(index: number, direction: 'up' | 'down') {
    const targetIndex = direction === 'up' ? index - 1 : index + 1;
    if (targetIndex < 0 || targetIndex >= profileLinks.length) return;
    const copy = [...profileLinks];
    const [moved] = copy.splice(index, 1);
    copy.splice(targetIndex, 0, moved);
    persistProfileLinks(copy);
  }

  async function handleImageUpload(
    e: React.ChangeEvent<HTMLInputElement>,
    bucket: 'cover' | 'avatar',
    column: 'cover_url' | 'avatar_url'
  ) {
    const file = e.target.files?.[0];
    if (!file) return;

    const preview = URL.createObjectURL(file);
    if (bucket === 'cover') setCoverUrl(preview);
    else setAvatarUrl(preview);

    const fileExt = file.name.split('.').pop();
    const fileName = `${Date.now()}.${fileExt}`;

    const { error: uploadError } = await supabase.storage
      .from(bucket)
      .upload(fileName, file);
    if (uploadError) {
      alert(`Erro no upload para o bucket "${bucket}": ${uploadError.message}`);
      return;
    }

    const { data: publicUrlData } = supabase.storage
      .from(bucket)
      .getPublicUrl(fileName);
    const publicUrl = publicUrlData.publicUrl;

    const updatePayload =
      column === 'cover_url'
        ? { cover_url: publicUrl, banner_url: publicUrl }
        : { avatar_url: publicUrl };

    await supabase.from('profiles').update(updatePayload).eq('id', profile.id);
    if (onProfileUpdated) onProfileUpdated();
  }

  async function handleSaveProfile(e: React.FormEvent) {
    e.preventDefault();
    setSavingProfile(true);

    const { error } = await supabase
      .from('profiles')
      .update({
        full_name: displayName.trim(),
        display_name: displayName.trim(),
        nickname: nickname.trim(),
        nickname_color: nicknameColor,
        location: location.trim(),
        birthday: birthday || null,
        bio: bio.trim(),
      })
      .eq('id', profile.id);

    setSavingProfile(false);

    if (!error) {
      setExpandEdit(false);
      if (onProfileUpdated) onProfileUpdated();
    } else {
      alert('Erro ao atualizar perfil: ' + error.message);
    }
  }

  function toggleTagOption(tag: string) {
    setSelectedTags((prev) =>
      prev.includes(tag) ? prev.filter((t) => t !== tag) : [...prev, tag]
    );
  }

  function handleAddCustomTag(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key !== 'Enter') return;
    e.preventDefault();
    const clean = tagSearch.trim();
    if (!clean) return;
    if (!selectedTags.some((t) => t.toLowerCase() === clean.toLowerCase())) {
      setSelectedTags((prev) => [...prev, clean]);
    }
    setTagSearch('');
  }

  async function handleSaveTags() {
    setSavingTags(true);
    const { error } = await supabase
      .from('profiles')
      .update({ tags: selectedTags })
      .eq('id', profile.id);
    setSavingTags(false);

    if (!error) {
      setExpandTags(false);
      if (onProfileUpdated) onProfileUpdated();
    } else {
      alert('Erro ao salvar tags: ' + error.message);
    }
  }

  function handleEditSpotify() {
    setShowSpotifySearchModal(true);
  }

  async function handleQuickSubscribe(e: React.FormEvent) {
    e.preventDefault();
    const cleanEmail = subEmail.trim().toLowerCase();
    if (!cleanEmail || submittingSub) return;

    setSubmittingSub(true);

    const { error } = await supabase.from('subscribers').upsert(
      {
        email: cleanEmail,
        notify_official_updates: true,
        notify_mode: 'all',
        interested_tags: [],
      },
      { onConflict: 'email' }
    );

    if (error) {
      setSubmittingSub(false);
      alert('Erro ao realizar inscrição: ' + error.message);
      return;
    }

    localStorage.setItem('insight-subscriber-email', cleanEmail);

    const total = await refreshTotalFollowersCount();
    await supabase
      .from('profiles')
      .update({ followers_count: total })
      .eq('id', profile.id);

    await fetch('/api/newsletter', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        action: 'welcome',
        email: cleanEmail,
        notifyMode: 'all',
        interestedTags: [],
      }),
    }).catch(() => { });

    setSubmittingSub(false);
    setSubSuccess(true);
    setSubEmail('');

    setTimeout(() => {
      setSubSuccess(false);
    }, 2500);
  }

  const formattedBirthday = birthday
    ? birthday.split('-').reverse().join('/')
    : null;

  const visibleProfileTags = showAllProfileTags
    ? selectedTags
    : selectedTags.slice(0, 8);
  const hiddenTagsCount = Math.max(0, selectedTags.length - 8);

  return (
    <section className="border-b border-border bg-background pb-6">
      {/* 1. Banner / Capa do Perfil */}
      <div
        onClick={() => isAdmin && coverInputRef.current?.click()}
        className={`relative w-full h-52 bg-surface border-b border-border overflow-hidden group ${isAdmin ? 'cursor-pointer' : ''
          }`}
      >
        {coverUrl ? (
          <img
            src={coverUrl}
            alt="Capa do perfil"
            className="w-full h-full object-cover block"
          />
        ) : (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 text-muted bg-elevated/40">
            <ImagePlus className="w-7 h-7" />
            <span className="text-xs font-semibold">
              {isAdmin
                ? 'Clique para adicionar uma capa'
                : 'Insight — Victor Poiani'}
            </span>
          </div>
        )}

        {isAdmin && (
          <>
            <div className="absolute top-3.5 right-3.5 bg-black/60 text-white rounded-full px-3.5 py-1.5 text-xs font-semibold flex items-center gap-1.5 opacity-0 group-hover:opacity-100 transition-opacity">
              <SquarePen className="w-3.5 h-3.5" />
              <span>Editar capa</span>
            </div>
            <input
              ref={coverInputRef}
              type="file"
              accept="image/*"
              onChange={(e) => handleImageUpload(e, 'cover', 'cover_url')}
              className="hidden"
            />
          </>
        )}
      </div>

      {/* Corpo do Perfil */}
      <div className="px-6 relative">
        {/* 2. Linha Única: Foto de Perfil + Status Compacto + Contadores + Botões */}
        <div className="flex flex-wrap sm:flex-nowrap items-center justify-between gap-2 pt-3">
          <div className="flex items-center gap-2.5 sm:gap-3 min-w-0">
            <div
              onClick={() => isAdmin && avatarInputRef.current?.click()}
              className={`w-28 h-28 sm:w-32 sm:h-32 rounded-full border-4 border-background bg-surface -mt-14 sm:-mt-16 relative overflow-hidden shadow-lg group shrink-0 ${isAdmin ? 'cursor-pointer' : ''
                }`}
            >
              <img
                src={avatarUrl}
                alt={displayName}
                className="w-full h-full object-cover block"
              />
              {isAdmin && (
                <>
                  <div className="absolute bottom-2 right-2 w-7 h-7 rounded-full bg-background text-primary border border-border flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                    <SquarePen className="w-3 h-3" />
                  </div>
                  <input
                    ref={avatarInputRef}
                    type="file"
                    accept="image/*"
                    onChange={(e) => handleImageUpload(e, 'avatar', 'avatar_url')}
                    className="hidden"
                  />
                </>
              )}
            </div>

            {/* Pílula de Status Compacta */}
            <div className="relative shrink-0">
              <button
                type="button"
                onClick={() => isAdmin && setExpandStatusMenu(!expandStatusMenu)}
                style={{
                  backgroundColor: `${currentStatus.color}14`,
                  borderColor: `${currentStatus.color}40`,
                }}
                title={
                  isAdmin
                    ? 'Clique para alterar seu status atual'
                    : `Status: ${currentStatus.label}`
                }
                className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full border text-[11px] font-semibold text-primary transition-all ${isAdmin
                    ? 'cursor-pointer hover:scale-[1.02] active:scale-95'
                    : 'cursor-default'
                  }`}
              >
                <span className="relative flex h-1.5 w-1.5 shrink-0">
                  {currentStatus.pulse && (
                    <span
                      style={{ backgroundColor: currentStatus.color }}
                      className="animate-ping absolute inline-flex h-full w-full rounded-full opacity-75"
                    />
                  )}
                  <span
                    style={{ backgroundColor: currentStatus.color }}
                    className="relative inline-flex rounded-full h-1.5 w-1.5"
                  />
                </span>

                <StatusIcon
                  className="w-3 h-3 shrink-0"
                  style={{ color: currentStatus.color }}
                />

                <span className="truncate max-w-[110px] sm:max-w-[135px]">
                  {currentStatus.label}
                  {statusDetail ? (
                    <span className="font-normal text-secondary">
                      {' '}
                      · {statusDetail}
                    </span>
                  ) : null}
                </span>

                {isAdmin && (
                  <ChevronDown className="w-2.5 h-2.5 text-muted shrink-0" />
                )}
              </button>

              {isAdmin && expandStatusMenu && (
                <div className="absolute left-0 top-full mt-2 z-30 w-64 sm:w-72 p-3 rounded-2xl bg-surface border border-border shadow-2xl space-y-2.5">
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] font-extrabold text-primary uppercase tracking-wider">
                      Definir Status
                    </span>
                    <button
                      type="button"
                      onClick={() => setExpandStatusMenu(false)}
                      className="text-muted hover:text-primary"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  </div>

                  <div className="grid grid-cols-2 gap-1">
                    {USER_STATUS_OPTIONS.map((opt) => {
                      const OptIcon = opt.icon;
                      const isSelected = statusId === opt.id;
                      return (
                        <button
                          key={opt.id}
                          type="button"
                          onClick={() => handleSaveStatus(opt.id, statusDetail)}
                          style={
                            isSelected
                              ? {
                                backgroundColor: `${opt.color}22`,
                                borderColor: opt.color,
                              }
                              : undefined
                          }
                          className={`flex items-center gap-1.5 px-2 py-1.5 rounded-xl border text-left text-[11px] font-semibold transition-all ${isSelected
                              ? 'text-primary'
                              : 'bg-elevated/80 border-border text-secondary hover:text-primary'
                            }`}
                        >
                          <span
                            style={{ backgroundColor: opt.color }}
                            className="w-1.5 h-1.5 rounded-full shrink-0"
                          />
                          <OptIcon
                            className="w-3 h-3 shrink-0"
                            style={{ color: opt.color }}
                          />
                          <span className="truncate">{opt.label}</span>
                        </button>
                      );
                    })}
                  </div>

                  <div className="pt-2 border-t border-border space-y-2">
                    <input
                      type="text"
                      value={statusDetail}
                      onChange={(e) => setStatusDetail(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          e.preventDefault();
                          handleSaveStatus(statusId, statusDetail);
                        }
                      }}
                      maxLength={20}
                      placeholder="Detalhe curto (ex: VS Code)..."
                      className="w-full bg-elevated border border-border rounded-xl px-2.5 py-1 text-[11px] text-primary placeholder:text-muted focus:outline-none focus:border-accent"
                    />
                    <div className="flex items-center justify-between gap-2">
                      {statusDetail && (
                        <button
                          type="button"
                          onClick={() => {
                            setStatusDetail('');
                            handleSaveStatus(statusId, '');
                          }}
                          className="text-[10px] text-muted hover:text-danger"
                        >
                          Limpar
                        </button>
                      )}
                      <button
                        type="button"
                        disabled={savingStatus}
                        onClick={() => handleSaveStatus(statusId, statusDetail)}
                        className="ml-auto px-2.5 py-1 rounded-lg bg-accent text-white text-[10px] font-bold hover:bg-accent-hover disabled:opacity-50"
                      >
                        {savingStatus ? 'Salvando...' : 'Salvar'}
                      </button>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>

          <div className="flex items-center gap-2.5 sm:gap-3 ml-auto shrink-0">
            <div className="flex items-center gap-2.5 sm:gap-3 text-xs text-secondary whitespace-nowrap">
              <span>
                <b className="text-primary font-bold">0</b> Seguindo
              </span>
              <span>
                <b className="text-primary font-bold">{followersCount}</b>{' '}
                Seguidores
              </span>
              <span>
                <b className="text-primary font-bold">{postsCount}</b> Posts
              </span>
            </div>

            {isAdmin && (
              <button
                type="button"
                onClick={() => setExpandEdit(!expandEdit)}
                title="Editar perfil"
                className="w-8 h-8 rounded-full bg-elevated border border-border text-primary flex items-center justify-center hover:border-accent transition-colors shrink-0"
              >
                {expandEdit ? (
                  <X className="w-3.5 h-3.5 text-accent" />
                ) : (
                  <Bolt className="w-3.5 h-3.5 text-accent" />
                )}
              </button>
            )}

            <button
              type="button"
              onClick={() => setExpandSubscribe(!expandSubscribe)}
              className={`px-4 py-1.5 rounded-full font-bold text-xs transition-colors flex items-center gap-1.5 shadow-md whitespace-nowrap shrink-0 ${pushSubscribed
                  ? 'bg-emerald-500/15 border border-emerald-500/40 text-emerald-400 hover:bg-emerald-500/25'
                  : 'bg-accent text-white hover:bg-accent-hover'
                }`}
            >
              {pushSubscribed ? (
                <>
                  <BellRing className="w-3.5 h-3.5" />
                  <span>Acompanhando</span>
                </>
              ) : (
                <>
                  <BellPlus className="w-3.5 h-3.5" />
                  <span>Acompanhar</span>
                </>
              )}
            </button>
          </div>
        </div>

        {/* 3. Nome, Alcunha Colorida e Metadados */}
        <div className="mt-4">
          <h1 className="text-xl sm:text-2xl font-extrabold text-primary">
            <span>{displayName}</span>
            {nickname && (
              <>
                , <span style={{ color: nicknameColor }}>{nickname}</span>
              </>
            )}
          </h1>

          <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-secondary mt-1.5">
            <span>@{profile.username || 'Victor Poiani'}</span>
            {location && (
              <span className="flex items-center gap-1">
                <MapPin className="w-3.5 h-3.5 text-muted" />
                {location}
              </span>
            )}
            <span className="flex items-center gap-1">
              <Calendar className="w-3.5 h-3.5 text-muted" />
              Desde julho de 2026
            </span>
            {formattedBirthday && (
              <span className="flex items-center gap-1">
                <Cake className="w-3.5 h-3.5 text-muted" />
                {formattedBirthday}
              </span>
            )}
          </div>
        </div>

        {/* 4. Bio */}
        {bio && (
          <p className="mt-4 text-sm text-primary/90 leading-relaxed max-w-xl whitespace-pre-line">
            {bio}
          </p>
        )}

        <div className="mt-2.5 flex items-center gap-1.5 text-xs font-bold text-[#00ccff]">
          <ShieldCheck className="w-3.5 h-3.5" />
          <span>Conta Verificada</span>
        </div>

        {/* Card Expansível: Edição de Perfil */}
        {isAdmin && expandEdit && (
          <form
            onSubmit={handleSaveProfile}
            className="mt-5 p-4 rounded-2xl bg-surface border border-border space-y-3"
          >
            <p className="text-xs font-bold text-accent">Editar Perfil</p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="text-[11px] text-muted block mb-1">
                  Nome de exibição
                </label>
                <input
                  type="text"
                  value={displayName}
                  onChange={(e) => setDisplayName(e.target.value)}
                  className="w-full bg-elevated border border-border rounded-lg px-3 py-2 text-xs text-primary focus:outline-none focus:border-accent"
                />
              </div>
              <div>
                <label className="text-[11px] text-muted block mb-1">
                  Alcunha (ex: Desenvolvedor Médio)
                </label>
                <input
                  type="text"
                  value={nickname}
                  onChange={(e) => setNickname(e.target.value)}
                  className="w-full bg-elevated border border-border rounded-lg px-3 py-2 text-xs text-primary focus:outline-none focus:border-accent"
                />
              </div>
            </div>

            <div>
              <label className="text-[11px] text-muted block mb-1.5">
                Cor da alcunha
              </label>
              <div className="flex items-center gap-2">
                {NICKNAME_COLORS.map((color) => (
                  <button
                    key={color}
                    type="button"
                    onClick={() => setNicknameColor(color)}
                    style={{ backgroundColor: color }}
                    className={`w-6 h-6 rounded-full border-2 transition-transform ${nicknameColor.toLowerCase() === color.toLowerCase()
                        ? 'border-white scale-110'
                        : 'border-transparent opacity-75'
                      }`}
                  />
                ))}
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="text-[11px] text-muted block mb-1">
                  Localização
                </label>
                <input
                  type="text"
                  value={location}
                  onChange={(e) => setLocation(e.target.value)}
                  className="w-full bg-elevated border border-border rounded-lg px-3 py-2 text-xs text-primary focus:outline-none focus:border-accent"
                />
              </div>
              <div>
                <label className="text-[11px] text-muted block mb-1">
                  Aniversário
                </label>
                <input
                  type="date"
                  value={birthday}
                  onChange={(e) => setBirthday(e.target.value)}
                  className="w-full bg-elevated border border-border rounded-lg px-3 py-2 text-xs text-primary focus:outline-none focus:border-accent"
                />
              </div>
            </div>

            <div>
              <label className="text-[11px] text-muted block mb-1">Bio</label>
              <textarea
                value={bio}
                onChange={(e) => setBio(e.target.value)}
                rows={3}
                className="w-full bg-elevated border border-border rounded-lg px-3 py-2 text-xs text-primary resize-none focus:outline-none focus:border-accent"
              />
            </div>

            <div className="flex justify-end gap-2 pt-1">
              <button
                type="button"
                onClick={() => setExpandEdit(false)}
                className="px-3 py-1.5 rounded-lg bg-elevated text-xs text-secondary hover:text-primary"
              >
                Cancelar
              </button>
              <button
                type="submit"
                disabled={savingProfile}
                className="px-4 py-1.5 rounded-lg bg-accent text-white text-xs font-bold hover:bg-accent-hover"
              >
                {savingProfile ? 'Salvando...' : 'Salvar alterações'}
              </button>
            </div>
          </form>
        )}

        {/* PAINEL HÍBRIDO DE NOTIFICAÇÕES: WEB PUSH NATIVO (1 CLIQUE) + E-MAIL */}
        {expandSubscribe && (
          <div className="mt-4 p-4 rounded-2xl bg-surface border border-border space-y-4 shadow-lg">
            {/* Opção 1: Web Push Instantâneo no Navegador / Sistema Operativo */}
            <div className="p-3.5 rounded-xl bg-elevated/70 border border-border flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div className="space-y-0.5">
                <div className="flex items-center gap-2">
                  <BellRing className="w-4 h-4 text-accent shrink-0" />
                  <span className="text-xs font-bold text-primary">
                    Alertas Instantâneos no Navegador (Web Push)
                  </span>
                  <span className="px-2 py-0.2 rounded bg-accent/15 text-accent font-mono text-[9px] font-bold uppercase">
                    Recomendado
                  </span>
                </div>
                <p className="text-[11px] text-secondary">
                  Receba notificações nativas no seu ecrã assim que um novo post ou atualização sair, sem precisar de e-mail.
                </p>
              </div>

              <div className="flex items-center gap-2 shrink-0">
                {isAdmin && (
                  <button
                    type="button"
                    disabled={testingPush}
                    onClick={handleSendTestPush}
                    title="Disparar uma notificação de teste para todos os dispositivos inscritos"
                    className="px-3 py-2 rounded-xl bg-surface border border-border hover:border-accent text-[11px] font-semibold text-secondary hover:text-primary flex items-center gap-1.5 transition-colors"
                  >
                    <Send className="w-3 h-3 text-accent" />
                    <span>{testingPush ? 'Enviando...' : 'Testar Push'}</span>
                  </button>
                )}

                {pushSupported ? (
                  <button
                    type="button"
                    disabled={loadingPush}
                    onClick={handleToggleWebPush}
                    className={`px-4 py-2 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-all ${pushSubscribed
                        ? 'bg-emerald-500/15 border border-emerald-500/40 text-emerald-400 hover:bg-danger/15 hover:border-danger/40 hover:text-danger'
                        : 'bg-accent text-white hover:bg-accent-hover shadow-sm'
                      }`}
                  >
                    {loadingPush ? (
                      <span>Configurando...</span>
                    ) : pushSubscribed ? (
                      <>
                        <Check className="w-3.5 h-3.5" />
                        <span>Alertas Ativos (Desativar)</span>
                      </>
                    ) : (
                      <>
                        <BellPlus className="w-3.5 h-3.5" />
                        <span>Ativar com 1 Clique</span>
                      </>
                    )}
                  </button>
                ) : (
                  <span className="text-[11px] font-mono text-muted">
                    Navegador sem suporte Push
                  </span>
                )}
              </div>
            </div>

            {/* Opção 2: Newsletter & Changelogs por E-mail */}
            <form onSubmit={handleQuickSubscribe} className="space-y-2">
              <div className="flex items-center gap-1.5 text-[11px] font-semibold text-secondary px-1">
                <Mail className="w-3.5 h-3.5 text-muted" />
                <span>Ou acompanhe as notas oficiais por e-mail:</span>
              </div>

              <div className="flex flex-col sm:flex-row items-center gap-2.5">
                <input
                  type="email"
                  required
                  value={subEmail}
                  onChange={(e) => setSubEmail(e.target.value)}
                  placeholder="Digite seu e-mail para receber changelogs e resumos..."
                  className="flex-1 w-full bg-elevated border border-border rounded-xl px-3.5 py-2 text-xs text-primary placeholder:text-muted focus:outline-none focus:border-accent"
                />
                <button
                  type="submit"
                  disabled={submittingSub}
                  className="w-full sm:w-auto px-4 py-2 rounded-xl bg-elevated border border-border hover:border-accent text-primary text-xs font-bold flex items-center justify-center gap-1.5 shrink-0 disabled:opacity-50 transition-colors"
                >
                  {subSuccess ? (
                    <>
                      <Check className="w-4 h-4 text-emerald-400" />
                      <span>E-mail cadastrado!</span>
                    </>
                  ) : (
                    <span>
                      {submittingSub ? 'Salvando...' : 'Cadastrar E-mail'}
                    </span>
                  )}
                </button>
              </div>
            </form>

            <div className="flex flex-wrap items-center justify-between gap-2 text-[11px] text-muted px-1 pt-1 border-t border-border/60">
              <span>Zero spam. Cancele com 1 clique quando quiser.</span>
              <Link
                href="/config"
                className="inline-flex items-center gap-1 text-accent hover:underline font-medium"
              >
                <Settings className="w-3 h-3" />
                <span>Personalizar filtros nas Configurações</span>
              </Link>
            </div>
          </div>
        )}

        {/* 5. Seção de Tags Dinâmicas */}
        <div className="flex items-center gap-3 mt-6 text-xs font-semibold text-secondary">
          <span>Tags</span>
          <div className="flex-1 h-px bg-border" />
          {selectedTags.length > 0 && (
            <span className="text-[10px] text-muted font-normal">
              {selectedTags.length} {selectedTags.length === 1 ? 'ativa' : 'ativas'}
            </span>
          )}
        </div>

        <div className="flex flex-wrap items-center gap-1.5 mt-3">
          {visibleProfileTags.map((tag) => {
            const meta = resolveTagMeta(tag);
            const Icon = meta.Icon;
            return (
              <span
                key={tag}
                title={meta.categoryName}
                style={{
                  backgroundColor: `${meta.color}14`,
                  borderColor: `${meta.color}40`,
                }}
                className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full border text-xs font-semibold text-primary transition-transform hover:scale-[1.02]"
              >
                <Icon
                  className="w-3.5 h-3.5 shrink-0"
                  style={{ color: meta.color }}
                />
                <span>{tag}</span>
              </span>
            );
          })}

          {hiddenTagsCount > 0 && !showAllProfileTags && (
            <button
              type="button"
              onClick={() => setShowAllProfileTags(true)}
              className="px-2.5 py-1 rounded-full bg-elevated border border-border text-[11px] font-semibold text-secondary hover:text-primary transition-colors"
            >
              +{hiddenTagsCount}
            </button>
          )}

          {showAllProfileTags && selectedTags.length > 8 && (
            <button
              type="button"
              onClick={() => setShowAllProfileTags(false)}
              className="px-2.5 py-1 rounded-full bg-elevated border border-border text-[11px] font-semibold text-muted hover:text-primary transition-colors"
            >
              Recolher
            </button>
          )}

          {isAdmin && (
            <button
              type="button"
              onClick={() => setExpandTags(!expandTags)}
              title="Configurar Tags do Perfil"
              className={`w-7 h-7 rounded-full border flex items-center justify-center transition-colors ${expandTags
                  ? 'bg-accent text-white border-accent'
                  : 'bg-elevated border-border text-secondary hover:text-accent hover:border-accent'
                }`}
            >
              {expandTags ? (
                <X className="w-3.5 h-3.5" />
              ) : (
                <Plus className="w-3.5 h-3.5" />
              )}
            </button>
          )}
        </div>

        {/* Painel de Seleção de Tags */}
        {isAdmin && expandTags && (
          <div className="mt-3.5 p-4 rounded-2xl bg-surface border border-border space-y-3.5 shadow-xl">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
              <div className="relative flex-1">
                <Search className="w-3.5 h-3.5 text-muted absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  value={tagSearch}
                  onChange={(e) => setTagSearch(e.target.value)}
                  onKeyDown={handleAddCustomTag}
                  placeholder="Filtrar ou digitar nova tag + Enter..."
                  className="w-full bg-elevated border border-border rounded-xl pl-8 pr-3 py-1.5 text-xs text-primary placeholder:text-muted focus:outline-none focus:border-accent"
                />
              </div>

              {tagSearch.trim().length > 0 && (
                <button
                  type="button"
                  onClick={() => {
                    const clean = tagSearch.trim();
                    if (
                      clean &&
                      !selectedTags.some(
                        (t) => t.toLowerCase() === clean.toLowerCase()
                      )
                    ) {
                      setSelectedTags((prev) => [...prev, clean]);
                    }
                    setTagSearch('');
                  }}
                  className="px-3 py-1.5 rounded-xl bg-elevated border border-accent/40 text-accent text-xs font-bold hover:bg-accent hover:text-white transition-colors shrink-0"
                >
                  + Criar &ldquo;{tagSearch.trim()}&rdquo;
                </button>
              )}
            </div>

            <div className="flex flex-wrap items-center gap-1.5">
              <button
                type="button"
                onClick={() => setActiveCategoryTab('all')}
                className={`px-2.5 py-1 rounded-full text-[11px] font-bold border transition-colors ${activeCategoryTab === 'all'
                    ? 'bg-primary text-background border-primary'
                    : 'bg-elevated text-secondary border-border hover:text-primary'
                  }`}
              >
                Todas ({TAG_CATEGORIES.reduce((acc, c) => acc + c.tags.length, 0)})
              </button>

              {TAG_CATEGORIES.map((cat) => {
                const CatIcon = cat.icon;
                const isTabActive = activeCategoryTab === cat.id;
                return (
                  <button
                    key={cat.id}
                    type="button"
                    onClick={() => setActiveCategoryTab(cat.id)}
                    style={
                      isTabActive
                        ? {
                          backgroundColor: `${cat.color}22`,
                          borderColor: cat.color,
                          color: cat.color,
                        }
                        : undefined
                    }
                    className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-bold border transition-colors ${isTabActive
                        ? ''
                        : 'bg-elevated text-secondary border-border hover:text-primary'
                      }`}
                  >
                    <CatIcon
                      className="w-3 h-3 shrink-0"
                      style={{ color: cat.color }}
                    />
                    <span>{cat.name}</span>
                  </button>
                );
              })}
            </div>

            <div
              className={`max-h-60 overflow-y-auto pr-1.5 space-y-3 ${SLEEK_SCROLLBAR_CLASS}`}
            >
              {filteredCategories.map((cat) => (
                <div key={cat.id} className="space-y-1.5">
                  {activeCategoryTab === 'all' && (
                    <div className="flex items-center gap-1.5">
                      <span
                        style={{ backgroundColor: cat.color }}
                        className="w-2 h-2 rounded-full"
                      />
                      <span
                        style={{ color: cat.color }}
                        className="text-[11px] font-extrabold uppercase tracking-wider"
                      >
                        {cat.name}
                      </span>
                    </div>
                  )}

                  <div className="flex flex-wrap gap-1.5">
                    {cat.tags.map((item) => {
                      const active = selectedTags.includes(item.label);
                      const ItemIcon = item.icon;
                      return (
                        <button
                          key={item.label}
                          type="button"
                          onClick={() => toggleTagOption(item.label)}
                          style={
                            active
                              ? {
                                backgroundColor: `${cat.color}24`,
                                borderColor: cat.color,
                              }
                              : undefined
                          }
                          className={`px-2.5 py-1 rounded-full text-xs font-semibold border flex items-center gap-1.5 transition-all ${active
                              ? 'text-primary shadow-sm scale-[1.02]'
                              : 'bg-elevated/80 text-secondary border-border hover:text-primary hover:border-muted'
                            }`}
                        >
                          <ItemIcon
                            className="w-3.5 h-3.5 shrink-0"
                            style={{ color: cat.color }}
                          />
                          <span>{item.label}</span>
                          {active && (
                            <Check
                              className="w-3 h-3 shrink-0"
                              style={{ color: cat.color }}
                            />
                          )}
                        </button>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>

            {selectedTags.length > 0 && (
              <div className="pt-2.5 border-t border-border flex flex-wrap items-center gap-1.5">
                <span className="text-[10px] text-muted mr-1">Selecionadas:</span>
                {selectedTags.map((tag) => {
                  const meta = resolveTagMeta(tag);
                  return (
                    <button
                      key={tag}
                      type="button"
                      onClick={() => toggleTagOption(tag)}
                      title="Clique para remover"
                      style={{
                        borderColor: `${meta.color}55`,
                        backgroundColor: `${meta.color}15`,
                      }}
                      className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full border text-[10px] font-bold text-primary hover:opacity-75 transition-opacity"
                    >
                      <span
                        style={{ backgroundColor: meta.color }}
                        className="w-1.5 h-1.5 rounded-full"
                      />
                      <span>{tag}</span>
                      <X className="w-2.5 h-2.5 text-muted" />
                    </button>
                  );
                })}
              </div>
            )}

            <div className="flex items-center justify-between pt-2 border-t border-border">
              <button
                type="button"
                onClick={() => setSelectedTags([])}
                className="text-[11px] text-muted hover:text-danger transition-colors"
              >
                Limpar todas
              </button>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setExpandTags(false)}
                  className="px-3 py-1.5 rounded-full bg-elevated text-xs text-secondary hover:text-primary"
                >
                  Cancelar
                </button>
                <button
                  type="button"
                  disabled={savingTags}
                  onClick={handleSaveTags}
                  className="px-4 py-1.5 rounded-full bg-accent text-white text-xs font-bold hover:bg-accent-hover disabled:opacity-50"
                >
                  {savingTags ? 'Salvando...' : 'Salvar Tags'}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* 6. Seção Minimalista de Links com Captura Automática de Logo */}
        {(profileLinks.length > 0 || isAdmin) && (
          <>
            <div className="flex items-center gap-3 mt-6 text-xs font-semibold text-secondary">
              <span>Links</span>
              <div className="flex-1 h-px bg-border" />
            </div>

            <div className="flex flex-wrap items-center gap-2 mt-3">
              {profileLinks.map((item) => {
                const meta = detectPlatformFromUrl(item.url);
                const tooltip = item.label || meta.name;

                return (
                  <a
                    key={item.id}
                    href={normalizeUrl(item.url)}
                    target="_blank"
                    rel="noopener noreferrer"
                    title={tooltip}
                    className="group/slink w-8 h-8 rounded-lg bg-elevated/70 hover:bg-elevated border border-border hover:border-accent/60 flex items-center justify-center transition-all shadow-sm"
                  >
                    <SmartPlatformIcon url={item.url} className="w-4 h-4" />
                  </a>
                );
              })}

              {isAdmin && (
                <button
                  type="button"
                  onClick={() => setExpandLinksModal(true)}
                  title="Adicionar ou gerir links do perfil"
                  className="w-8 h-8 rounded-lg bg-surface hover:bg-elevated border border-dashed border-border hover:border-accent text-secondary hover:text-accent flex items-center justify-center transition-colors"
                >
                  <Plus className="w-3.5 h-3.5" />
                </button>
              )}
            </div>
          </>
        )}

        {/* MODAL DE ADIÇÃO E GESTÃO DE LINKS POR URL */}
        {isAdmin && expandLinksModal && (
          <div
            onClick={() => setExpandLinksModal(false)}
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/65 backdrop-blur-sm p-4"
          >
            <div
              onClick={(e) => e.stopPropagation()}
              className="w-full max-w-md rounded-2xl bg-surface border border-border text-primary shadow-2xl overflow-hidden flex flex-col max-h-[85vh]"
            >
              <div className="flex items-center justify-between px-4 py-3 border-b border-border">
                <div className="flex items-center gap-2">
                  <Link2 className="w-4 h-4 text-accent" />
                  <h3 className="text-xs font-bold uppercase tracking-wider text-primary">
                    Links & Redes do Perfil
                  </h3>
                </div>
                <button
                  type="button"
                  onClick={() => setExpandLinksModal(false)}
                  className="p-1 rounded-lg text-secondary hover:text-primary hover:bg-elevated"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              <div className="p-4 space-y-4 overflow-y-auto">
                <form
                  onSubmit={handleAddNewLink}
                  className="p-3.5 rounded-xl bg-elevated/60 border border-border space-y-3"
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-[11px] font-semibold text-primary">
                      Adicionar link por URL
                    </span>
                    {newLinkUrl.trim() && (
                      <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md bg-surface border border-border text-[10px] font-mono text-secondary">
                        <SmartPlatformIcon
                          url={newLinkUrl}
                          className="w-3 h-3"
                        />
                        <span>{detectedPreviewPlatform.name}</span>
                      </span>
                    )}
                  </div>

                  <div className="space-y-2">
                    <input
                      type="text"
                      required
                      value={newLinkUrl}
                      onChange={(e) => setNewLinkUrl(e.target.value)}
                      placeholder="Cole o link (ex: https://github.com/VictorPoiani)"
                      className="w-full bg-surface border border-border rounded-lg px-3 py-2 text-xs text-primary placeholder:text-muted focus:outline-none focus:border-accent"
                    />

                    <div className="flex items-center gap-2">
                      <input
                        type="text"
                        maxLength={24}
                        value={newLinkLabel}
                        onChange={(e) => setNewLinkLabel(e.target.value)}
                        placeholder={`Título opcional (padrão: ${detectedPreviewPlatform.name})`}
                        className="flex-1 bg-surface border border-border rounded-lg px-3 py-1.5 text-xs text-primary placeholder:text-muted focus:outline-none focus:border-accent"
                      />

                      <button
                        type="submit"
                        disabled={savingLinks || !newLinkUrl.trim()}
                        className="px-3.5 py-1.5 rounded-lg bg-accent text-white text-xs font-semibold flex items-center gap-1 hover:bg-accent-hover disabled:opacity-50 shrink-0"
                      >
                        <Plus className="w-3.5 h-3.5" />
                        <span>Adicionar</span>
                      </button>
                    </div>
                  </div>
                </form>

                <div className="space-y-1.5">
                  <div className="flex items-center justify-between text-[11px] text-muted px-1">
                    <span>Ícones ativos ({profileLinks.length})</span>
                    {savingLinks && (
                      <span className="font-mono text-accent">
                        Sincronizando...
                      </span>
                    )}
                  </div>

                  {profileLinks.length === 0 ? (
                    <p className="text-xs text-muted text-center py-6 border border-dashed border-border rounded-xl">
                      Nenhum link configurado.
                    </p>
                  ) : (
                    <div className="space-y-1.5">
                      {profileLinks.map((item, idx) => {
                        const meta = detectPlatformFromUrl(item.url);
                        return (
                          <div
                            key={item.id}
                            className="flex items-center justify-between gap-2 p-2.5 rounded-xl bg-elevated/40 border border-border"
                          >
                            <div className="flex items-center gap-2.5 min-w-0 flex-1">
                              <div className="w-7 h-7 rounded-lg bg-surface border border-border flex items-center justify-center shrink-0">
                                <SmartPlatformIcon
                                  url={item.url}
                                  className="w-3.5 h-3.5"
                                />
                              </div>
                              <div className="min-w-0 flex-1">
                                <p className="text-xs font-semibold text-primary truncate">
                                  {item.label || meta.name}
                                </p>
                                <p className="text-[10px] font-mono text-muted truncate">
                                  {item.url}
                                </p>
                              </div>
                            </div>

                            <div className="flex items-center gap-0.5 shrink-0">
                              <button
                                type="button"
                                disabled={idx === 0}
                                onClick={() => handleMoveLink(idx, 'up')}
                                title="Mover para trás"
                                className="p-1 rounded text-muted hover:text-primary disabled:opacity-20"
                              >
                                <ArrowUp className="w-3.5 h-3.5" />
                              </button>
                              <button
                                type="button"
                                disabled={idx === profileLinks.length - 1}
                                onClick={() => handleMoveLink(idx, 'down')}
                                title="Mover para a frente"
                                className="p-1 rounded text-muted hover:text-primary disabled:opacity-20"
                              >
                                <ArrowDown className="w-3.5 h-3.5" />
                              </button>
                              <a
                                href={normalizeUrl(item.url)}
                                target="_blank"
                                rel="noopener noreferrer"
                                title="Abrir link"
                                className="p-1 rounded text-muted hover:text-accent"
                              >
                                <ExternalLink className="w-3.5 h-3.5" />
                              </a>
                              <button
                                type="button"
                                onClick={() => handleRemoveLink(item.id)}
                                title="Remover"
                                className="p-1 rounded text-muted hover:text-danger"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              </div>

              <div className="px-4 py-3 border-t border-border bg-elevated/30 flex items-center justify-end">
                <button
                  type="button"
                  onClick={() => setExpandLinksModal(false)}
                  className="px-4 py-1.5 rounded-lg bg-accent text-white text-xs font-semibold flex items-center gap-1.5"
                >
                  <Check className="w-3.5 h-3.5" />
                  <span>Concluir</span>
                </button>
              </div>
            </div>
          </div>
        )}

        {/* 7. Player Minimalista Customizado do Spotify */}
        <div className="mt-5">
          <CustomSpotifyPlayer
            trackId={spotifyTrackId}
            onEdit={isAdmin ? handleEditSpotify : undefined}
          />
        </div>

        {/* Modal de Pesquisa Direta de Músicas */}
        <SpotifySearchModal
          isOpen={showSpotifySearchModal}
          onClose={() => setShowSpotifySearchModal(false)}
          onSelectTrack={async (trackQuery) => {
            setSpotifyTrackId(trackQuery);
            await supabase
              .from('profiles')
              .update({ spotify_track_id: trackQuery })
              .eq('id', profile.id);
          }}
        />
      </div>
    </section>
  );
}