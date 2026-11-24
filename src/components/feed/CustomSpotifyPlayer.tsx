'use client';

import { useState, useEffect, useRef } from 'react';
import { Play, Pause, ExternalLink, Music, Pencil, Volume2 } from '@/components/icons';
import type { SpotifyTrackMetadata } from '@/app/api/spotify/route';

interface CustomSpotifyPlayerProps {
  trackId: string;
  onEdit?: () => void;
  compact?: boolean;
}

function formatSeconds(sec: number): string {
  if (!Number.isFinite(sec) || sec < 0) return '0:00';
  const m = Math.floor(sec / 60);
  const s = Math.floor(sec % 60);
  return `${m}:${String(s).padStart(2, '0')}`;
}

export function CustomSpotifyPlayer({
  trackId,
  onEdit,
  compact = false,
}: CustomSpotifyPlayerProps) {
  const [meta, setMeta] = useState<SpotifyTrackMetadata | null>(null);
  const [loading, setLoading] = useState(true);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(30);

  const audioRef = useRef<HTMLAudioElement | null>(null);
  const instanceIdRef = useRef(`sp-${trackId}-${Math.random().toString(36).slice(2, 6)}`);

  useEffect(() => {
    let active = true;
    setLoading(true);
    setIsPlaying(false);
    setCurrentTime(0);

    fetch(`/api/spotify?trackId=${encodeURIComponent(trackId)}`)
      .then((r) => r.json())
      .then((data: SpotifyTrackMetadata) => {
        if (active) {
          setMeta(data);
          setLoading(false);
        }
      })
      .catch(() => {
        if (active) setLoading(false);
      });

    return () => {
      active = false;
    };
  }, [trackId]);

  useEffect(() => {
    function handleOtherAudioStart(e: Event) {
      const custom = e as CustomEvent<{ instanceId: string }>;
      if (custom.detail?.instanceId !== instanceIdRef.current && audioRef.current) {
        audioRef.current.pause();
        setIsPlaying(false);
      }
    }

    window.addEventListener('insight-audio-play', handleOtherAudioStart);
    return () => {
      window.removeEventListener('insight-audio-play', handleOtherAudioStart);
      if (audioRef.current) {
        audioRef.current.pause();
      }
    };
  }, []);

  function togglePlay() {
    if (!meta?.previewUrl) {
      window.open(meta?.spotifyUrl || `https://open.spotify.com`, '_blank', 'noopener,noreferrer');
      return;
    }

    if (!audioRef.current) {
      const audio = new Audio(meta.previewUrl);
      audio.volume = 0.75;
      audio.ontimeupdate = () => setCurrentTime(audio.currentTime);
      audio.onloadedmetadata = () => {
        if (audio.duration && Number.isFinite(audio.duration)) {
          setDuration(audio.duration);
        }
      };
      audio.onended = () => {
        setIsPlaying(false);
        setCurrentTime(0);
      };
      audioRef.current = audio;
    }

    if (isPlaying) {
      audioRef.current.pause();
      setIsPlaying(false);
    } else {
      window.dispatchEvent(
        new CustomEvent('insight-audio-play', {
          detail: { instanceId: instanceIdRef.current },
        })
      );
      audioRef.current
        .play()
        .then(() => setIsPlaying(true))
        .catch(() => setIsPlaying(false));
    }
  }

  function handleSeek(e: React.MouseEvent<HTMLDivElement>) {
    if (!audioRef.current || !meta?.previewUrl) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const ratio = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
    audioRef.current.currentTime = ratio * duration;
    setCurrentTime(ratio * duration);
  }

  if (loading) {
    return (
      <div className="h-16 w-full max-w-lg rounded-xl bg-surface border border-border p-2.5 flex items-center gap-3 animate-pulse">
        <div className="w-11 h-11 rounded-lg bg-elevated shrink-0" />
        <div className="flex-1 space-y-2">
          <div className="h-3 w-36 rounded bg-elevated" />
          <div className="h-2 w-24 rounded bg-elevated" />
        </div>
      </div>
    );
  }

  const progressPct = duration > 0 ? Math.min(100, (currentTime / duration) * 100) : 0;

  return (
    <div className="flex items-center gap-2 w-full max-w-lg">
      <div className="group/player relative flex-1 min-w-0 rounded-xl bg-surface hover:bg-elevated/50 border border-border transition-all p-2.5 flex items-center gap-3 overflow-hidden">
        <button
          type="button"
          onClick={togglePlay}
          title={
            meta?.previewUrl
              ? isPlaying
                ? 'Pausar prévia'
                : 'Ouvir prévia (30s)'
              : 'Ouvir no Spotify'
          }
          className="relative w-12 h-12 rounded-lg overflow-hidden bg-elevated border border-border shrink-0 flex items-center justify-center group/cover"
        >
          {meta?.coverUrl ? (
            <img
              src={meta.coverUrl}
              alt={meta.title}
              className={`w-full h-full object-cover transition-transform duration-300 ${
                isPlaying ? 'scale-105 brightness-75' : 'group-hover/cover:scale-105 group-hover/cover:brightness-75'
              }`}
            />
          ) : (
            <Music className="w-5 h-5 text-muted" />
          )}

          <div
            className={`absolute inset-0 flex items-center justify-center transition-opacity ${
              isPlaying ? 'opacity-100' : 'opacity-90 sm:opacity-0 sm:group-hover/cover:opacity-100'
            }`}
          >
            <span className="w-7 h-7 rounded-full bg-background/90 text-primary border border-border shadow flex items-center justify-center">
              {isPlaying ? (
                <Pause className="w-3.5 h-3.5 fill-current" />
              ) : (
                <Play className="w-3.5 h-3.5 fill-current ml-0.5" />
              )}
            </span>
          </div>
        </button>

        <div className="relative z-10 flex-1 min-w-0 space-y-1.5">
          <div className="flex items-center justify-between gap-2">
            <div className="min-w-0">
              <div className="flex items-center gap-1.5">
                <p className="text-xs font-bold text-primary truncate">
                  {meta?.title || trackId}
                </p>
                {isPlaying && (
                  <Volume2 className="w-3 h-3 text-[#1DB954] animate-pulse shrink-0" />
                )}
              </div>
              <p className="text-[11px] text-secondary truncate">
                {meta?.artist || 'Spotify'}
              </p>
            </div>

            <a
              href={meta?.spotifyUrl || `https://open.spotify.com/search/${encodeURIComponent(trackId)}`}
              target="_blank"
              rel="noopener noreferrer"
              title="Abrir no Spotify"
              className="p-1.5 rounded-lg text-muted hover:text-[#1DB954] hover:bg-elevated transition-colors shrink-0"
            >
              <ExternalLink className="w-3.5 h-3.5" />
            </a>
          </div>

          {!compact && (
            <div className="flex items-center gap-2">
              <div
                onClick={handleSeek}
                className="flex-1 h-1 rounded-full bg-elevated overflow-hidden cursor-pointer group/bar"
              >
                <div
                  style={{ width: `${progressPct}%` }}
                  className="h-full bg-[#1DB954] group-hover/bar:bg-accent transition-all duration-150"
                />
              </div>
              <span className="text-[9px] font-mono text-muted shrink-0">
                {meta?.previewUrl
                  ? `${formatSeconds(currentTime)} / ${formatSeconds(duration)}`
                  : 'Spotify'}
              </span>
            </div>
          )}
        </div>
      </div>

      {onEdit && (
        <button
          type="button"
          onClick={onEdit}
          title="Alterar música"
          className="w-8 h-8 rounded-lg bg-elevated border border-border text-secondary hover:text-accent flex items-center justify-center shrink-0 transition-colors"
        >
          <Pencil className="w-3.5 h-3.5" />
        </button>
      )}
    </div>
  );
}