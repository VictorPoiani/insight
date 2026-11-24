'use client';

import { useState, useEffect } from 'react';
import { Search, Music, X, Loader2 } from '@/components/icons';

interface SpotifySearchModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSelectTrack: (trackQuery: string) => void;
}

interface TrackSearchResult {
  id: string;
  title: string;
  artist: string;
  cover: string;
}

export function SpotifySearchModal({
  isOpen,
  onClose,
  onSelectTrack,
}: SpotifySearchModalProps) {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<TrackSearchResult[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const trimmed = query.trim();
    if (!trimmed || trimmed.length < 2) {
      setResults([]);
      return;
    }

    const timer = setTimeout(async () => {
      setLoading(true);
      try {
        const res = await fetch(
          `https://itunes.apple.com/search?term=${encodeURIComponent(
            trimmed
          )}&media=music&entity=song&limit=8`
        );
        if (res.ok) {
          const data = await res.json();
          const items: TrackSearchResult[] = (data.results || []).map(
            (song: any) => ({
              id: String(song.trackId),
              title: song.trackName,
              artist: song.artistName,
              cover: song.artworkUrl100
                ? song.artworkUrl100.replace('100x100bb', '300x300bb')
                : '',
            })
          );
          setResults(items);
        }
      } catch {
        // Ignora erro
      } finally {
        setLoading(false);
      }
    }, 400);

    return () => clearTimeout(timer);
  }, [query]);

  if (!isOpen) return null;

  return (
    <div
      onClick={onClose}
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4"
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-lg rounded-2xl bg-surface border border-border text-primary shadow-2xl overflow-hidden flex flex-col max-h-[80vh]"
      >
        <div className="flex items-center justify-between px-4 py-3 border-b border-border">
          <div className="flex items-center gap-2">
            <Music className="w-4 h-4 text-[#1DB954]" />
            <h3 className="text-xs font-bold uppercase tracking-wider">
              Pesquisar Música
            </h3>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1 rounded-lg text-secondary hover:text-primary hover:bg-elevated"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="p-4 border-b border-border bg-elevated/40">
          <div className="relative">
            <Search className="w-4 h-4 text-muted absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
            <input
              type="text"
              autoFocus
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Digite o nome (ex: Thunderstruck AC/DC, Led Zeppelin)..."
              className="w-full bg-surface border border-border rounded-xl pl-10 pr-4 py-2.5 text-xs text-primary placeholder:text-muted focus:outline-none focus:border-[#1DB954]"
            />
          </div>
        </div>

        <div className="p-4 overflow-y-auto space-y-2 flex-1">
          {loading ? (
            <div className="flex flex-col items-center justify-center py-12 text-muted gap-2">
              <Loader2 className="w-5 h-5 animate-spin text-[#1DB954]" />
              <span className="text-xs">Pesquisando faixas...</span>
            </div>
          ) : results.length === 0 ? (
            <div className="text-center py-12 text-muted space-y-1">
              <p className="text-xs">Nenhuma música encontrada.</p>
              <p className="text-[10px]">Digite ao menos 2 caracteres.</p>
            </div>
          ) : (
            <div className="space-y-1.5">
              {results.map((song) => (
                <button
                  key={song.id}
                  type="button"
                  onClick={() => {
                    onSelectTrack(`${song.title} ${song.artist}`);
                    onClose();
                  }}
                  className="w-full flex items-center justify-between gap-3 p-2.5 rounded-xl bg-elevated/50 hover:bg-elevated border border-border hover:border-[#1DB954]/60 text-left transition-all group"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <img
                      src={song.cover || '/assets/net/logo.png'}
                      alt={song.title}
                      className="w-10 h-10 rounded-lg object-cover border border-border shrink-0"
                    />
                    <div className="min-w-0">
                      <p className="text-xs font-bold text-primary truncate group-hover:text-[#1DB954] transition-colors">
                        {song.title}
                      </p>
                      <p className="text-[11px] text-secondary truncate">{song.artist}</p>
                    </div>
                  </div>

                  <span className="px-2.5 py-1 rounded-lg bg-surface border border-border text-[10px] font-bold text-secondary group-hover:bg-[#1DB954] group-hover:text-white group-hover:border-[#1DB954] transition-colors shrink-0">
                    Selecionar
                  </span>
                </button>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}