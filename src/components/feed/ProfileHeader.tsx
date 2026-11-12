'use client';

import { useState, useRef, useEffect } from 'react';
import Link from 'next/link';
import { Profile } from '@/types/database';
import { createClient } from '@/lib/supabase/client';
import {
  Bolt,
  BellPlus,
  Check,
  X,
  ImagePlus,
  SquarePen,
  MapPin,
  Calendar,
  Cake,
  Mail,
  Plus,
  Pencil,
  Settings,
} from 'lucide-react';

interface ProfileHeaderProps {
  profile: Profile;
  postsCount: number;
  isAdmin: boolean;
  onProfileUpdated?: () => void;
}

const TAG_CATALOG: Record<string, string[]> = {
  Personalidade: [
    'Lider',
    'Medroso',
    'Romantico',
    'Engraçado',
    'Piadista',
    'Triste',
    'Reflexivo',
    'Estudioso',
    'Sonhador',
    'Disciplinado',
  ],
  Hobbies: [
    'Instrumentista',
    'Polímata',
    'Programação',
    'Animes',
    'Python',
    'Literatura',
    'Música',
  ],
  Entretenimento: [
    'Marvel',
    'DC',
    'Fantasia',
    'Romances',
    'Dramas',
    'Jogos',
    'Futebol',
  ],
  Tecnologia: [
    'Javascript',
    'Design UX',
    'Game Developer',
    'C#/C++',
    'Data Science',
    'Empreendedor',
  ],
};

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

  // Imagens e Contador de Seguidores em tempo real
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

  // Estados de Edição do Perfil
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

  // Estados de Tags do Perfil e Spotify
  const [selectedTags, setSelectedTags] = useState<string[]>(
    Array.isArray(profile.tags) && profile.tags.length > 0
      ? profile.tags
      : ['Dev', 'Tecnologia', 'Musica', 'Rock', 'Marvel', 'Politica']
  );
  const [spotifyTrackId, setSpotifyTrackId] = useState(
    profile.spotify_track_id || '40riOy7x9W7GXjyGp4pjAv'
  );

  // Inscrição Rápida por E-mail
  const [subEmail, setSubEmail] = useState('');
  const [submittingSub, setSubmittingSub] = useState(false);
  const [subSuccess, setSubSuccess] = useState(false);

  const supabase = createClient();

  // Sincroniza todos os estados visuais assim que o perfil real chega do Supabase
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

    if (Array.isArray(profile.tags) && profile.tags.length > 0) {
      setSelectedTags(profile.tags);
    }
    if (profile.spotify_track_id) {
      setSpotifyTrackId(profile.spotify_track_id);
    }
  }, [profile]);

  // Busca sempre a contagem exata de inscritos no banco ao carregar a página
  useEffect(() => {
    async function fetchExactFollowers() {
      const { count } = await supabase
        .from('subscribers')
        .select('*', { count: 'exact', head: true });

      if (typeof count === 'number') {
        setFollowersCount(count);
      }
    }
    fetchExactFollowers();
  }, [supabase]);

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

  async function handleSaveTags() {
    const { error } = await supabase
      .from('profiles')
      .update({ tags: selectedTags })
      .eq('id', profile.id);

    if (!error) {
      setExpandTags(false);
      if (onProfileUpdated) onProfileUpdated();
    } else {
      alert('Erro ao salvar tags: ' + error.message);
    }
  }

  async function handleEditSpotify() {
    const input = prompt(
      'Cole o link da música do Spotify (ex: https://open.spotify.com/track/...):'
    );
    if (!input) return;

    let trackId = input.trim();
    if (trackId.includes('open.spotify.com/track/')) {
      trackId = trackId.split('track/')[1]?.split('?')[0] || trackId;
    } else if (trackId.includes('spotify:track:')) {
      trackId = trackId.split('spotify:track:')[1] || trackId;
    }

    if (trackId) {
      setSpotifyTrackId(trackId);
      await supabase
        .from('profiles')
        .update({ spotify_track_id: trackId })
        .eq('id', profile.id);
    }
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

    const { count } = await supabase
      .from('subscribers')
      .select('*', { count: 'exact', head: true });

    if (typeof count === 'number') {
      setFollowersCount(count);
      await supabase
        .from('profiles')
        .update({ followers_count: count })
        .eq('id', profile.id);
    }

    await fetch('/api/newsletter', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        action: 'welcome',
        email: cleanEmail,
        notifyMode: 'all',
        interestedTags: [],
      }),
    }).catch(() => {});

    setSubmittingSub(false);
    setSubSuccess(true);
    setSubEmail('');

    setTimeout(() => {
      setSubSuccess(false);
      setExpandSubscribe(false);
    }, 2500);
  }

  const formattedBirthday = birthday
    ? birthday.split('-').reverse().join('/')
    : null;

  return (
    <section className="border-b border-border bg-background pb-6">
      {/* 1. Banner / Capa do Perfil */}
      <div
        onClick={() => isAdmin && coverInputRef.current?.click()}
        className={`relative w-full h-52 bg-surface border-b border-border overflow-hidden group ${
          isAdmin ? 'cursor-pointer' : ''
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
        {/* 2. Foto de Perfil Sobreposta + Contadores + Botões */}
        <div className="flex flex-wrap items-center justify-between gap-4 pt-4">
          <div
            onClick={() => isAdmin && avatarInputRef.current?.click()}
            className={`w-36 h-36 sm:w-40 sm:h-40 rounded-full border-4 border-background bg-surface -mt-20 sm:-mt-24 relative overflow-hidden shadow-lg group shrink-0 ${
              isAdmin ? 'cursor-pointer' : ''
            }`}
          >
            <img
              src={avatarUrl}
              alt={displayName}
              className="w-full h-full object-cover block"
            />
            {isAdmin && (
              <>
                <div className="absolute bottom-2 right-2 w-8 h-8 rounded-full bg-background text-primary border border-border flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                  <SquarePen className="w-3.5 h-3.5" />
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

          <div className="flex items-center gap-4 ml-auto flex-wrap">
            <div className="flex items-center gap-4 text-xs sm:text-sm text-secondary mr-2">
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
                className="w-9 h-9 rounded-full bg-elevated border border-border text-primary flex items-center justify-center hover:border-accent transition-colors"
              >
                {expandEdit ? (
                  <X className="w-4 h-4 text-accent" />
                ) : (
                  <Bolt className="w-4 h-4 text-accent" />
                )}
              </button>
            )}

            <button
              type="button"
              onClick={() => setExpandSubscribe(!expandSubscribe)}
              className="px-5 py-2 rounded-full bg-accent text-white font-bold text-xs sm:text-sm hover:bg-accent-hover transition-colors flex items-center gap-1.5 shadow-md"
            >
              <BellPlus className="w-4 h-4" />
              <span>Acompanhar</span>
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

        {/* 4. Bio e Aviso de Sugestões */}
        {bio && (
          <p className="mt-4 text-sm text-primary/90 leading-relaxed max-w-xl whitespace-pre-line">
            {bio}
          </p>
        )}

        <div className="mt-2.5 flex items-center gap-1.5 text-xs font-bold text-[#1DB954]">
          <Mail className="w-3.5 h-3.5" />
          <span>Sugestões na DM</span>
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
                    className={`w-6 h-6 rounded-full border-2 transition-transform ${
                      nicknameColor.toLowerCase() === color.toLowerCase()
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

        {/* Barra Rápida e Minimalista: Acompanhar por E-mail */}
        {expandSubscribe && (
          <form
            onSubmit={handleQuickSubscribe}
            className="mt-4 p-3.5 rounded-2xl bg-surface border border-border space-y-2.5"
          >
            <div className="flex flex-col sm:flex-row items-center gap-2.5">
              <input
                type="email"
                required
                value={subEmail}
                onChange={(e) => setSubEmail(e.target.value)}
                placeholder="Digite seu e-mail para acompanhar novos insights..."
                className="flex-1 w-full bg-elevated border border-border rounded-xl px-3.5 py-2 text-xs text-primary placeholder:text-muted focus:outline-none focus:border-accent"
              />
              <button
                type="submit"
                disabled={submittingSub}
                className="w-full sm:w-auto px-4 py-2 rounded-xl bg-accent text-white text-xs font-bold hover:bg-accent-hover flex items-center justify-center gap-1.5 shrink-0 disabled:opacity-50"
              >
                {subSuccess ? (
                  <>
                    <Check className="w-4 h-4" />
                    <span>Inscrito!</span>
                  </>
                ) : (
                  <span>
                    {submittingSub ? 'Salvando...' : 'Receber novidades'}
                  </span>
                )}
              </button>
            </div>

            <div className="flex flex-wrap items-center justify-between gap-2 text-[11px] text-muted px-1">
              <span>Você receberá um e-mail de boas-vindas na hora.</span>
              <Link
                href="/config"
                className="inline-flex items-center gap-1 text-accent hover:underline font-medium"
              >
                <Settings className="w-3 h-3" />
                <span>Personalizar filtros nas Configurações</span>
              </Link>
            </div>
          </form>
        )}

        {/* 5. Seção de Tags */}
        <div className="flex items-center gap-3 mt-6 text-xs font-semibold text-secondary">
          <span>Tags</span>
          <div className="flex-1 h-px bg-border" />
        </div>

        <div className="flex flex-wrap items-center gap-2 mt-3">
          {selectedTags.map((tag) => (
            <span
              key={tag}
              className="px-3.5 py-1.5 rounded-full bg-elevated border border-border text-xs font-bold text-primary"
            >
              {tag}
            </span>
          ))}
          {isAdmin && (
            <button
              type="button"
              onClick={() => setExpandTags(!expandTags)}
              title="Escolher Tags"
              className="w-7 h-7 rounded-full bg-elevated border border-border flex items-center justify-center text-secondary hover:text-accent hover:border-accent transition-colors"
            >
              {expandTags ? (
                <X className="w-3.5 h-3.5" />
              ) : (
                <Plus className="w-3.5 h-3.5" />
              )}
            </button>
          )}
        </div>

        {isAdmin && expandTags && (
          <div className="mt-4 p-4 rounded-2xl bg-surface border border-border space-y-4">
            <p className="text-xs text-secondary">
              Selecione as tags que melhor representam seu perfil:
            </p>
            {Object.entries(TAG_CATALOG).map(([category, tags]) => (
              <div key={category} className="space-y-2">
                <p className="text-xs font-bold text-accent">{category}</p>
                <div className="flex flex-wrap gap-2">
                  {tags.map((tag) => {
                    const active = selectedTags.includes(tag);
                    return (
                      <button
                        key={tag}
                        type="button"
                        onClick={() => toggleTagOption(tag)}
                        className={`px-3 py-1 rounded-full text-xs font-semibold border flex items-center gap-1.5 transition-colors ${
                          active
                            ? 'bg-accent text-white border-accent'
                            : 'bg-elevated text-secondary border-border hover:text-primary'
                        }`}
                      >
                        <span>{tag}</span>
                        {active && <Check className="w-3 h-3" />}
                      </button>
                    );
                  })}
                </div>
              </div>
            ))}
            <div className="flex justify-end gap-2 pt-2 border-t border-border">
              <button
                type="button"
                onClick={() => setExpandTags(false)}
                className="px-3 py-1.5 rounded-full bg-elevated text-xs text-secondary"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={handleSaveTags}
                className="px-4 py-1.5 rounded-full bg-accent text-white text-xs font-bold"
              >
                Salvar Tags
              </button>
            </div>
          </div>
        )}

        {/* 6. Seção de Links */}
        <div className="flex items-center gap-3 mt-6 text-xs font-semibold text-secondary">
          <span>Links</span>
          <div className="flex-1 h-px bg-border" />
        </div>

        <div className="flex items-center gap-3 mt-3">
          <a
            href={
              profile.social_links?.instagram ||
              'https://www.instagram.com/victorpoiani/'
            }
            target="_blank"
            rel="noopener noreferrer"
            title="Instagram"
          >
            <img
              src="/assets/net/Instagram_icon.png"
              alt="Instagram"
              className="w-8 h-8 rounded-full hover:scale-105 transition-transform"
            />
          </a>
          <a
            href={profile.social_links?.tiktok || 'https://tiktok.com'}
            target="_blank"
            rel="noopener noreferrer"
            title="TikTok"
          >
            <img
              src="/assets/net/tiktok-icon.png"
              alt="TikTok"
              className="w-8 h-8 rounded-full hover:scale-105 transition-transform"
            />
          </a>
          <a
            href={profile.social_links?.spotify || 'https://open.spotify.com'}
            target="_blank"
            rel="noopener noreferrer"
            title="Spotify"
          >
            <img
              src="/assets/net/spotify-icon.png"
              alt="Spotify"
              className="w-8 h-8 rounded-full hover:scale-105 transition-transform"
            />
          </a>
          <a
            href={
              profile.social_links?.steam || 'https://store.steampowered.com'
            }
            target="_blank"
            rel="noopener noreferrer"
            title="Steam"
          >
            <img
              src="/assets/net/steam-icon.png"
              alt="Steam"
              className="w-8 h-8 rounded-full hover:scale-105 transition-transform"
            />
          </a>
        </div>

        {/* 7. Player Embed Oficial do Spotify */}
        <div className="mt-5 flex items-center gap-2 max-w-lg">
          <iframe
            style={{ borderRadius: '12px' }}
            src={`https://open.spotify.com/embed/track/${spotifyTrackId}?utm_source=generator&theme=0`}
            width="100%"
            height="80"
            frameBorder="0"
            allow="autoplay; clipboard-write; encrypted-media; fullscreen; picture-in-picture"
            loading="lazy"
          />
          {isAdmin && (
            <button
              type="button"
              onClick={handleEditSpotify}
              title="Alterar Música do Spotify"
              className="w-9 h-9 rounded-full bg-elevated border border-border text-secondary hover:text-accent flex items-center justify-center shrink-0 transition-colors"
            >
              <Pencil className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>
    </section>
  );
}