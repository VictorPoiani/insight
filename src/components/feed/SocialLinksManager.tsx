'use client';

import { notify } from '@/lib/ui/feedback';
import { useState, useMemo } from 'react';
import { createClient } from '@/lib/supabase/client';
import { CustomSocialLink, SocialLinks } from '@/types/database';
import {
  Plus,
  X,
  Globe,
  Trash2,
  Check,
  Link2,
  ExternalLink,
  ArrowUp,
  ArrowDown,
} from 'lucide-react';

interface SocialLinksManagerProps {
  profileId: string;
  socialLinks: SocialLinks;
  isAdmin: boolean;
  onUpdated?: () => void;
}

interface DetectedPlatform {
  name: string;
  slug: string | null; // Slug do SimpleIcons (SVG vetorial limpo)
  domain: string;
}

// Mapa de domínios para ícones vetoriais minimalistas (SimpleIcons CDN)
const KNOWN_PLATFORMS: {
  match: string[];
  name: string;
  slug: string;
}[] = [
  { match: ['instagram.com'], name: 'Instagram', slug: 'instagram' },
  { match: ['tiktok.com'], name: 'TikTok', slug: 'tiktok' },
  { match: ['spotify.com'], name: 'Spotify', slug: 'spotify' },
  { match: ['steamcommunity.com', 'store.steampowered.com', 's.team'], name: 'Steam', slug: 'steam' },
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

export function normalizeUrl(raw: string): string {
  const trimmed = raw.trim();
  if (!trimmed) return '';
  if (/^https?:\/\//i.test(trimmed)) return trimmed;
  return `https://${trimmed}`;
}

export function detectPlatformFromUrl(rawUrl: string): DetectedPlatform {
  try {
    const normalized = normalizeUrl(rawUrl);
    if (!normalized) return { name: 'Link', slug: null, domain: '' };
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

    const baseName = host.split('.')[0] || 'Site';
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

/**
 * Converte tanto os links antigos (instagram, tiktok, spotify, steam, github)
 * quanto a nova lista `custom_links` numa lista única sem duplicações.
 */
export function buildUnifiedLinksList(socialLinks?: SocialLinks | null): CustomSocialLink[] {
  if (!socialLinks) return [];

  if (Array.isArray(socialLinks.custom_links) && socialLinks.custom_links.length > 0) {
    return socialLinks.custom_links.filter((item) => Boolean(item?.url?.trim()));
  }

  const legacyEntries: { key: keyof SocialLinks; label: string }[] = [
    { key: 'instagram', label: 'Instagram' },
    { key: 'tiktok', label: 'TikTok' },
    { key: 'spotify', label: 'Spotify' },
    { key: 'steam', label: 'Steam' },
    { key: 'github', label: 'GitHub' },
  ];

  const migrated: CustomSocialLink[] = [];
  for (const entry of legacyEntries) {
    const val = socialLinks[entry.key];
    if (typeof val === 'string' && val.trim()) {
      migrated.push({
        id: `legacy-${entry.key}`,
        url: normalizeUrl(val),
        label: entry.label,
      });
    }
  }

  return migrated;
}

function SmartLinkIcon({
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

  // Se for uma rede conhecida, usa o SVG vetorial limpo (SimpleIcons)
  // Caso contrário, busca o Favicon oficial em alta resolução do domínio
  const iconSrc = meta.slug
    ? `https://cdn.simpleicons.org/${meta.slug}/a1a1aa`
    : `https://www.google.com/s2/favicons?domain=${encodeURIComponent(meta.domain)}&sz=128`;

  return (
    <img
      src={iconSrc}
      alt={meta.name}
      onError={() => setImgError(true)}
      className={`${className} object-contain transition-all duration-200 ${
        meta.slug
          ? 'opacity-80 group-hover/link:opacity-100 group-hover/link:brightness-125'
          : 'rounded-sm grayscale opacity-80 group-hover/link:grayscale-0 group-hover/link:opacity-100'
      }`}
    />
  );
}

export function SocialLinksManager({
  profileId,
  socialLinks,
  isAdmin,
  onUpdated,
}: SocialLinksManagerProps) {
  const [links, setLinks] = useState<CustomSocialLink[]>(() =>
    buildUnifiedLinksList(socialLinks)
  );
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [newUrlInput, setNewUrlInput] = useState('');
  const [newLabelInput, setNewLabelInput] = useState('');
  const [saving, setSaving] = useState(false);

  const supabase = createClient();
  const previewMeta = useMemo(
    () => detectPlatformFromUrl(newUrlInput),
    [newUrlInput]
  );

  async function persistLinks(nextLinks: CustomSocialLink[]) {
    setLinks(nextLinks);
    if (!isAdmin) return;

    setSaving(true);

    // Mantém também as chaves antigas sincronizadas por retrocompatibilidade
    const findByDomain = (domainPart: string) =>
      nextLinks.find((l) => l.url.toLowerCase().includes(domainPart))?.url || '';

    const updatedSocialLinks: SocialLinks = {
      ...socialLinks,
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
      .eq('id', profileId);

    setSaving(false);

    if (error) {
      notify('Erro ao guardar links: ' + error.message);
      return;
    }

    onUpdated?.();
  }

  function handleAddLink(e: React.FormEvent) {
    e.preventDefault();
    const cleanUrl = normalizeUrl(newUrlInput);
    if (!cleanUrl) return;

    const detected = detectPlatformFromUrl(cleanUrl);
    const nextItem: CustomSocialLink = {
      id: `lnk-${Date.now()}-${Math.random().toString(36).slice(2, 5)}`,
      url: cleanUrl,
      label: newLabelInput.trim() || detected.name,
    };

    const nextList = [...links, nextItem];
    setNewUrlInput('');
    setNewLabelInput('');
    persistLinks(nextList);
  }

  function handleRemoveLink(id: string) {
    const nextList = links.filter((item) => item.id !== id);
    persistLinks(nextList);
  }

  function handleMoveLink(index: number, direction: 'up' | 'down') {
    const targetIndex = direction === 'up' ? index - 1 : index + 1;
    if (targetIndex < 0 || targetIndex >= links.length) return;
    const copy = [...links];
    const [moved] = copy.splice(index, 1);
    copy.splice(targetIndex, 0, moved);
    persistLinks(copy);
  }

  if (links.length === 0 && !isAdmin) return null;

  return (
    <div className="space-y-2.5">
      {/* Cabeçalho divisório "Links" */}
      <div className="flex items-center gap-3">
        <span className="text-xs font-semibold text-secondary">Links</span>
        <div className="h-px flex-1 bg-border" />
      </div>

      {/* Barra Minimalista de Ícones + Botão '+' */}
      <div className="flex flex-wrap items-center gap-2">
        {links.map((item) => {
          const meta = detectPlatformFromUrl(item.url);
          const displayTitle = item.label || meta.name;

          return (
            <a
              key={item.id}
              href={normalizeUrl(item.url)}
              target="_blank"
              rel="noopener noreferrer"
              title={displayTitle}
              className="group/link h-8 px-2.5 rounded-lg bg-elevated/70 hover:bg-elevated border border-border hover:border-accent/60 flex items-center gap-2 transition-all shadow-sm"
            >
              <SmartLinkIcon url={item.url} className="w-3.5 h-3.5 shrink-0" />
              <span className="text-[11px] font-medium text-secondary group-hover/link:text-primary transition-colors">
                {displayTitle}
              </span>
            </a>
          );
        })}

        {isAdmin && (
          <button
            type="button"
            onClick={() => setIsModalOpen(true)}
            title="Adicionar ou gerir links do perfil"
            className="h-8 px-2.5 rounded-lg bg-surface hover:bg-elevated border border-dashed border-border hover:border-accent text-secondary hover:text-accent flex items-center gap-1.5 text-[11px] font-semibold transition-colors"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Adicionar link</span>
          </button>
        )}
      </div>

      {/* MODAL MINIMALISTA DE ADIÇÃO E GESTÃO DE LINKS */}
      {isAdmin && isModalOpen && (
        <div
          onClick={() => setIsModalOpen(false)}
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/65 backdrop-blur-sm p-4"
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-md rounded-2xl bg-surface border border-border text-primary shadow-2xl overflow-hidden flex flex-col max-h-[85vh]"
          >
            {/* Topo do Modal */}
            <div className="flex items-center justify-between px-4 py-3 border-b border-border">
              <div className="flex items-center gap-2">
                <Link2 className="w-4 h-4 text-accent" />
                <h3 className="text-xs font-bold uppercase tracking-wider text-primary">
                  Gerir Links & Redes
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setIsModalOpen(false)}
                className="p-1 rounded-lg text-secondary hover:text-primary hover:bg-elevated"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-4 space-y-4 overflow-y-auto">
              {/* Formulário de novo Link com Deteção*/}
              <form
                onSubmit={handleAddLink}
                className="p-3.5 rounded-xl bg-elevated/60 border border-border space-y-3"
              >
                <div className="flex items-center justify-between">
                  <span className="text-[11px] font-semibold text-primary">
                    Adicionar novo link por URL
                  </span>
                  {newUrlInput.trim() && (
                    <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md bg-surface border border-border text-[10px] font-mono text-secondary">
                      <SmartLinkIcon url={newUrlInput} className="w-3 h-3" />
                      <span>{previewMeta.name} detetado</span>
                    </span>
                  )}
                </div>

                <div className="space-y-2">
                  <input
                    type="text"
                    required
                    value={newUrlInput}
                    onChange={(e) => setNewUrlInput(e.target.value)}
                    placeholder="Cole a URL (ex: https://linkedin.com/in/...)"
                    className="w-full bg-surface border border-border rounded-lg px-3 py-2 text-xs text-primary placeholder:text-muted focus:outline-none focus:border-accent"
                  />

                  <div className="flex items-center gap-2">
                    <input
                      type="text"
                      maxLength={24}
                      value={newLabelInput}
                      onChange={(e) => setNewLabelInput(e.target.value)}
                      placeholder={`Nome opcional (padrão: ${previewMeta.name})`}
                      className="flex-1 bg-surface border border-border rounded-lg px-3 py-1.5 text-xs text-primary placeholder:text-muted focus:outline-none focus:border-accent"
                    />

                    <button
                      type="submit"
                      disabled={saving || !newUrlInput.trim()}
                      className="px-3.5 py-1.5 rounded-lg bg-accent text-white text-xs font-semibold flex items-center gap-1 hover:bg-accent-hover disabled:opacity-50 shrink-0"
                    >
                      <Plus className="w-3.5 h-3.5" />
                      <span>Adicionar</span>
                    </button>
                  </div>
                </div>
              </form>

              {/* Lista de Links Atuais com Reordenação e Exclusão */}
              <div className="space-y-1.5">
                <div className="flex items-center justify-between text-[11px] text-muted px-1">
                  <span>Links ativos no perfil ({links.length})</span>
                  {saving && <span className="font-mono text-accent">A sincronizar...</span>}
                </div>

                {links.length === 0 ? (
                  <p className="text-xs text-muted text-center py-6 border border-dashed border-border rounded-xl">
                    Nenhum link adicionado ainda.
                  </p>
                ) : (
                  <div className="space-y-1.5">
                    {links.map((item, idx) => {
                      const meta = detectPlatformFromUrl(item.url);
                      return (
                        <div
                          key={item.id}
                          className="flex items-center justify-between gap-2 p-2.5 rounded-xl bg-elevated/40 border border-border group/row"
                        >
                          <div className="flex items-center gap-2.5 min-w-0 flex-1">
                            <div className="w-7 h-7 rounded-lg bg-surface border border-border flex items-center justify-center shrink-0">
                              <SmartLinkIcon url={item.url} className="w-3.5 h-3.5" />
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
                              title="Mover para a esquerda"
                              className="p-1 rounded text-muted hover:text-primary disabled:opacity-20"
                            >
                              <ArrowUp className="w-3.5 h-3.5" />
                            </button>
                            <button
                              type="button"
                              disabled={idx === links.length - 1}
                              onClick={() => handleMoveLink(idx, 'down')}
                              title="Mover para a direita"
                              className="p-1 rounded text-muted hover:text-primary disabled:opacity-20"
                            >
                              <ArrowDown className="w-3.5 h-3.5" />
                            </button>
                            <a
                              href={normalizeUrl(item.url)}
                              target="_blank"
                              rel="noopener noreferrer"
                              title="Testar link"
                              className="p-1 rounded text-muted hover:text-accent"
                            >
                              <ExternalLink className="w-3.5 h-3.5" />
                            </a>
                            <button
                              type="button"
                              onClick={() => handleRemoveLink(item.id)}
                              title="Remover link"
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
                onClick={() => setIsModalOpen(false)}
                className="px-4 py-1.5 rounded-lg bg-accent text-white text-xs font-semibold flex items-center gap-1.5"
              >
                <Check className="w-3.5 h-3.5" />
                <span>Concluir</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}