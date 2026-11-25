'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import {
  Play,
  Pause,
  Volume2,
  Volume1,
  VolumeX,
  Maximize,
  Minimize,
  PictureInPicture2,
  RotateCcw,
  RotateCw,
  Loader2,
} from 'lucide-react';

/**
 * Player de vídeo do Insight.
 *
 * - Controles próprios (iguais em todos os navegadores), com auto-ocultar.
 * - Barra de progresso com trecho já carregado, prévia do tempo ao passar o mouse
 *   e arraste por toque.
 * - Velocidade (0,5×–2×), picture-in-picture, tela cheia, volume lembrado.
 * - Atalhos: espaço/K tocar, ←/→ 5 s, J/L 10 s, ↑/↓ volume, M mudo, F tela cheia.
 * - Toque duplo nas laterais avança/volta 10 s (celular).
 * - Só um vídeo toca por vez; pausa sozinho ao sair da tela.
 * - Modo GIF: mudo, em loop, toca apenas quando visível (economiza bateria).
 */

const SPEEDS = [0.5, 0.75, 1, 1.25, 1.5, 2];
const PLAY_EVENT = 'insight:video-play';

function fmt(t: number) {
  if (!Number.isFinite(t) || t < 0) t = 0;
  const h = Math.floor(t / 3600);
  const m = Math.floor((t % 3600) / 60);
  const s = Math.floor(t % 60);
  const ss = String(s).padStart(2, '0');
  return h > 0 ? `${h}:${String(m).padStart(2, '0')}:${ss}` : `${m}:${ss}`;
}

function readPref<T>(key: string, fallback: T): T {
  try {
    const v = localStorage.getItem(key);
    return v === null ? fallback : (JSON.parse(v) as T);
  } catch {
    return fallback;
  }
}
function writePref(key: string, value: unknown) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    /* modo privado */
  }
}

export function VideoPlayer({
  src,
  gif = false,
  className = '',
  maxHeight = 520,
  label = 'Vídeo',
}: {
  src: string;
  gif?: boolean;
  className?: string;
  maxHeight?: number;
  label?: string;
}) {
  const wrapRef = useRef<HTMLDivElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const barRef = useRef<HTMLDivElement>(null);
  const hideTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastTap = useRef<{ t: number; x: number } | null>(null);
  const id = useRef(Math.random().toString(36).slice(2));

  const [playing, setPlaying] = useState(false);
  const [started, setStarted] = useState(false);
  const [waiting, setWaiting] = useState(false);
  const [time, setTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [buffered, setBuffered] = useState(0);
  const [volume, setVolume] = useState(1);
  const [muted, setMuted] = useState(gif);
  const [rate, setRate] = useState(1);
  const [showUi, setShowUi] = useState(true);
  const [fullscreen, setFullscreen] = useState(false);
  const [speedOpen, setSpeedOpen] = useState(false);
  const [hover, setHover] = useState<{ x: number; t: number } | null>(null);
  const [scrubbing, setScrubbing] = useState(false);
  const [flash, setFlash] = useState<'fwd' | 'back' | null>(null);
  const [error, setError] = useState(false);
  const pipSupported = typeof document !== 'undefined' && 'pictureInPictureEnabled' in document && document.pictureInPictureEnabled;

  // preferências salvas
  useEffect(() => {
    if (gif) return;
    const v = videoRef.current;
    if (!v) return;
    const vol = readPref('insight:video-volume', 1);
    const mu = readPref('insight:video-muted', false);
    v.volume = vol;
    v.muted = mu;
    setVolume(vol);
    setMuted(mu);
  }, [gif]);

  // só um vídeo com som tocando por vez
  useEffect(() => {
    if (gif) return;
    const onOther = (e: Event) => {
      if ((e as CustomEvent<string>).detail !== id.current) videoRef.current?.pause();
    };
    window.addEventListener(PLAY_EVENT, onOther);
    return () => window.removeEventListener(PLAY_EVENT, onOther);
  }, [gif]);

  // fora da tela: pausa (vídeo) / toca só quando visível (GIF)
  useEffect(() => {
    const el = wrapRef.current;
    const v = videoRef.current;
    if (!el || !v || typeof IntersectionObserver === 'undefined') return;
    const io = new IntersectionObserver(
      ([entry]) => {
        if (gif) {
          if (entry.isIntersecting) void v.play().catch(() => {});
          else v.pause();
        } else if (!entry.isIntersecting && !v.paused && document.pictureInPictureElement !== v) {
          v.pause();
        }
      },
      { threshold: gif ? 0.25 : 0.15 }
    );
    io.observe(el);
    return () => io.disconnect();
  }, [gif]);

  useEffect(() => {
    const onFs = () => setFullscreen(document.fullscreenElement === wrapRef.current);
    document.addEventListener('fullscreenchange', onFs);
    return () => document.removeEventListener('fullscreenchange', onFs);
  }, []);

  const poke = useCallback(() => {
    setShowUi(true);
    if (hideTimer.current) clearTimeout(hideTimer.current);
    hideTimer.current = setTimeout(() => {
      if (videoRef.current && !videoRef.current.paused) {
        setShowUi(false);
        setSpeedOpen(false);
      }
    }, 2500);
  }, []);

  useEffect(() => () => {
    if (hideTimer.current) clearTimeout(hideTimer.current);
  }, []);

  const toggle = useCallback(() => {
    const v = videoRef.current;
    if (!v) return;
    if (v.paused || v.ended) void v.play().catch(() => {});
    else v.pause();
  }, []);

  const seekBy = useCallback((d: number) => {
    const v = videoRef.current;
    if (!v || !Number.isFinite(v.duration)) return;
    v.currentTime = Math.max(0, Math.min(v.duration, v.currentTime + d));
    setFlash(d > 0 ? 'fwd' : 'back');
    setTimeout(() => setFlash(null), 500);
  }, []);

  const setVol = useCallback((val: number) => {
    const v = videoRef.current;
    if (!v) return;
    const nv = Math.max(0, Math.min(1, val));
    v.volume = nv;
    v.muted = nv === 0;
    writePref('insight:video-volume', nv || 1);
    writePref('insight:video-muted', nv === 0);
  }, []);

  const toggleMute = useCallback(() => {
    const v = videoRef.current;
    if (!v) return;
    v.muted = !v.muted;
    if (!v.muted && v.volume === 0) v.volume = 1;
    writePref('insight:video-muted', v.muted);
  }, []);

  const toggleFs = useCallback(async () => {
    const el = wrapRef.current;
    const v = videoRef.current as (HTMLVideoElement & { webkitEnterFullscreen?: () => void }) | null;
    if (!el || !v) return;
    try {
      if (document.fullscreenElement) await document.exitFullscreen();
      else if (el.requestFullscreen) await el.requestFullscreen();
      else v.webkitEnterFullscreen?.(); // iPhone: só o player nativo entra em tela cheia
    } catch {
      v.webkitEnterFullscreen?.();
    }
  }, []);

  const togglePip = useCallback(async () => {
    const v = videoRef.current;
    if (!v) return;
    try {
      if (document.pictureInPictureElement) await document.exitPictureInPicture();
      else await v.requestPictureInPicture();
    } catch {
      /* não suportado neste vídeo */
    }
  }, []);

  const changeRate = (r: number) => {
    if (videoRef.current) videoRef.current.playbackRate = r;
    setRate(r);
    setSpeedOpen(false);
  };

  const timeAt = (clientX: number) => {
    const bar = barRef.current;
    if (!bar || !duration) return null;
    const r = bar.getBoundingClientRect();
    const x = Math.max(0, Math.min(r.width, clientX - r.left));
    return { x, t: (x / r.width) * duration };
  };

  const onBarPointerDown = (e: React.PointerEvent) => {
    e.stopPropagation();
    const p = timeAt(e.clientX);
    if (!p || !videoRef.current) return;
    (e.target as HTMLElement).setPointerCapture?.(e.pointerId);
    setScrubbing(true);
    videoRef.current.currentTime = p.t;
    setTime(p.t);
  };
  const onBarPointerMove = (e: React.PointerEvent) => {
    const p = timeAt(e.clientX);
    if (!p) return;
    setHover(p);
    if (scrubbing && videoRef.current) {
      videoRef.current.currentTime = p.t;
      setTime(p.t);
    }
  };
  const onBarPointerUp = () => setScrubbing(false);

  const onKey = (e: React.KeyboardEvent) => {
    if (gif) return;
    const k = e.key.toLowerCase();
    const map: Record<string, () => void> = {
      ' ': toggle,
      k: toggle,
      arrowleft: () => seekBy(-5),
      arrowright: () => seekBy(5),
      j: () => seekBy(-10),
      l: () => seekBy(10),
      arrowup: () => setVol(volume + 0.1),
      arrowdown: () => setVol(volume - 0.1),
      m: toggleMute,
      f: () => void toggleFs(),
    };
    if (map[k]) {
      e.preventDefault();
      map[k]();
      poke();
    }
  };

  // toque: um toque mostra/oculta os controles; toque duplo nas laterais pula 10 s
  const onSurfaceClick = (e: React.MouseEvent) => {
    if (gif) return;
    const isTouch = (e.nativeEvent as PointerEvent).pointerType === 'touch' || matchMedia('(hover: none)').matches;
    if (!isTouch) {
      toggle();
      return;
    }
    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
    const x = (e.clientX - rect.left) / rect.width;
    const now = Date.now();
    const prev = lastTap.current;
    if (prev && now - prev.t < 300 && Math.abs(prev.x - x) < 0.25 && (x < 0.35 || x > 0.65)) {
      seekBy(x < 0.5 ? -10 : 10);
      lastTap.current = null;
      return;
    }
    lastTap.current = { t: now, x };
    if (!started) toggle();
    else if (showUi) setShowUi(false);
    else poke();
  };

  const pct = duration ? (time / duration) * 100 : 0;
  const bufPct = duration ? (buffered / duration) * 100 : 0;
  const VolIcon = muted || volume === 0 ? VolumeX : volume < 0.5 ? Volume1 : Volume2;
  const uiVisible = !gif && (showUi || !playing || scrubbing || speedOpen);

  if (error) {
    return (
      <div className={`grid place-items-center aspect-video bg-black text-white/70 text-sm ${className}`}>
        Não foi possível carregar o vídeo.
      </div>
    );
  }

  return (
    <div
      ref={wrapRef}
      tabIndex={gif ? -1 : 0}
      role={gif ? undefined : 'region'}
      aria-label={gif ? undefined : label}
      onKeyDown={onKey}
      onMouseMove={gif ? undefined : poke}
      onMouseLeave={() => {
        setHover(null);
        if (playing) setShowUi(false);
      }}
      onClick={(e) => e.stopPropagation()}
      className={`group/vp relative bg-black select-none outline-none focus-visible:ring-2 focus-visible:ring-accent ${
        fullscreen ? 'w-full h-full flex items-center' : ''
      } ${!uiVisible && playing ? 'cursor-none' : ''} ${className}`}
    >
      <video
        ref={videoRef}
        src={`${src}#t=0.001`}
        playsInline
        preload="metadata"
        muted={gif ? true : undefined}
        loop={gif}
        autoPlay={gif}
        disablePictureInPicture={gif}
        onClick={onSurfaceClick}
        onPlay={() => {
          setPlaying(true);
          setStarted(true);
          if (!gif) window.dispatchEvent(new CustomEvent(PLAY_EVENT, { detail: id.current }));
          if (!gif && !started) window.dispatchEvent(new CustomEvent('insight-activity', { detail: { kind: 'video' } }));
          poke();
        }}
        onPause={() => {
          setPlaying(false);
          setShowUi(true);
        }}
        onEnded={() => setShowUi(true)}
        onWaiting={() => setWaiting(true)}
        onPlaying={() => setWaiting(false)}
        onCanPlay={() => setWaiting(false)}
        onError={() => setError(true)}
        onLoadedMetadata={(e) => setDuration(e.currentTarget.duration)}
        onDurationChange={(e) => setDuration(e.currentTarget.duration)}
        onTimeUpdate={(e) => {
          if (!scrubbing) setTime(e.currentTarget.currentTime);
        }}
        onProgress={(e) => {
          const v = e.currentTarget;
          if (v.buffered.length) setBuffered(v.buffered.end(v.buffered.length - 1));
        }}
        onVolumeChange={(e) => {
          setVolume(e.currentTarget.volume);
          setMuted(e.currentTarget.muted);
        }}
        className="w-full h-auto mx-auto object-contain block"
        style={{ maxHeight: fullscreen ? '100vh' : maxHeight }}
      />

      {gif && (
        <span className="absolute bottom-2.5 left-2.5 px-2 py-0.5 rounded bg-black/75 text-white font-mono text-[10px] font-bold uppercase tracking-wider backdrop-blur-sm pointer-events-none">
          GIF
        </span>
      )}

      {!gif && (
        <>
          {/* botão central */}
          {(!playing || !started) && !waiting && (
            <button
              type="button"
              aria-label="Reproduzir"
              onClick={toggle}
              className="absolute inset-0 m-auto w-16 h-16 rounded-full bg-black/55 backdrop-blur-md text-white grid place-items-center shadow-xl ring-1 ring-white/20 transition-transform hover:scale-105"
            >
              <Play className="w-7 h-7 translate-x-0.5 fill-white" />
            </button>
          )}
          {waiting && playing && (
            <Loader2 className="absolute inset-0 m-auto w-10 h-10 text-white/90 animate-spin pointer-events-none" />
          )}
          {flash && (
            <span
              className={`absolute top-1/2 -translate-y-1/2 ${flash === 'fwd' ? 'right-[12%]' : 'left-[12%]'} px-3 py-2 rounded-full bg-black/60 text-white text-xs font-bold flex items-center gap-1 pointer-events-none animate-in fade-in`}
            >
              {flash === 'fwd' ? <RotateCw className="w-4 h-4" /> : <RotateCcw className="w-4 h-4" />} 10 s
            </span>
          )}

          {/* barra inferior */}
          <div
            className={`absolute inset-x-0 bottom-0 px-3 pb-2 pt-10 bg-gradient-to-t from-black/85 via-black/40 to-transparent text-white transition-opacity duration-200 ${
              uiVisible ? 'opacity-100' : 'opacity-0 pointer-events-none'
            }`}
          >
            {/* progresso */}
            <div
              ref={barRef}
              role="slider"
              aria-label="Posição do vídeo"
              aria-valuemin={0}
              aria-valuemax={Math.round(duration)}
              aria-valuenow={Math.round(time)}
              aria-valuetext={`${fmt(time)} de ${fmt(duration)}`}
              onPointerDown={onBarPointerDown}
              onPointerMove={onBarPointerMove}
              onPointerUp={onBarPointerUp}
              onPointerCancel={onBarPointerUp}
              onPointerLeave={() => !scrubbing && setHover(null)}
              className="relative h-4 flex items-center cursor-pointer touch-none group/bar"
            >
              <div className="relative w-full h-1 group-hover/bar:h-1.5 transition-[height] rounded-full bg-white/25 overflow-hidden">
                <div className="absolute inset-y-0 left-0 bg-white/40" style={{ width: `${bufPct}%` }} />
                <div className="absolute inset-y-0 left-0 bg-accent" style={{ width: `${pct}%` }} />
              </div>
              <div
                className="absolute w-3 h-3 rounded-full bg-white shadow -translate-x-1/2 scale-0 group-hover/bar:scale-100 transition-transform"
                style={{ left: `${pct}%`, transform: scrubbing ? 'translateX(-50%) scale(1)' : undefined }}
              />
              {hover && duration > 0 && (
                <span
                  className="absolute bottom-5 -translate-x-1/2 px-1.5 py-0.5 rounded bg-black/85 text-[11px] font-mono pointer-events-none"
                  style={{ left: hover.x }}
                >
                  {fmt(hover.t)}
                </span>
              )}
            </div>

            <div className="flex items-center gap-1 sm:gap-2 mt-0.5">
              <button type="button" onClick={toggle} aria-label={playing ? 'Pausar' : 'Reproduzir'} className="p-1.5 rounded-md hover:bg-white/15">
                {playing ? <Pause className="w-5 h-5 fill-white" /> : <Play className="w-5 h-5 fill-white" />}
              </button>
              <button type="button" onClick={() => seekBy(-10)} aria-label="Voltar 10 segundos" className="hidden sm:block p-1.5 rounded-md hover:bg-white/15">
                <RotateCcw className="w-4 h-4" />
              </button>
              <button type="button" onClick={() => seekBy(10)} aria-label="Avançar 10 segundos" className="hidden sm:block p-1.5 rounded-md hover:bg-white/15">
                <RotateCw className="w-4 h-4" />
              </button>

              <div className="flex items-center group/vol">
                <button type="button" onClick={toggleMute} aria-label={muted ? 'Ativar som' : 'Silenciar'} className="p-1.5 rounded-md hover:bg-white/15">
                  <VolIcon className="w-5 h-5" />
                </button>
                <input
                  type="range"
                  min={0}
                  max={1}
                  step={0.05}
                  value={muted ? 0 : volume}
                  onChange={(e) => setVol(Number(e.target.value))}
                  aria-label="Volume"
                  className="hidden sm:block w-0 opacity-0 group-hover/vol:w-20 group-hover/vol:opacity-100 focus:w-20 focus:opacity-100 transition-[width,opacity] duration-200 accent-white h-1 cursor-pointer"
                />
              </div>

              <span className="text-xs font-mono tabular-nums text-white/90 ml-1 whitespace-nowrap">
                {fmt(time)} <span className="text-white/50">/ {fmt(duration)}</span>
              </span>

              <div className="ml-auto flex items-center gap-0.5 sm:gap-1">
                <div className="relative">
                  <button
                    type="button"
                    onClick={() => setSpeedOpen((o) => !o)}
                    aria-label="Velocidade de reprodução"
                    aria-expanded={speedOpen}
                    className="px-2 py-1 rounded-md hover:bg-white/15 text-xs font-bold tabular-nums"
                  >
                    {rate === 1 ? '1×' : `${String(rate).replace('.', ',')}×`}
                  </button>
                  {speedOpen && (
                    <div className="absolute bottom-full right-0 mb-2 py-1 min-w-[84px] rounded-lg bg-black/90 backdrop-blur ring-1 ring-white/15 shadow-xl">
                      {SPEEDS.map((s) => (
                        <button
                          key={s}
                          type="button"
                          onClick={() => changeRate(s)}
                          className={`block w-full text-left px-3 py-1.5 text-xs hover:bg-white/15 ${s === rate ? 'text-accent font-bold' : ''}`}
                        >
                          {s === 1 ? 'Normal' : `${String(s).replace('.', ',')}×`}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
                {pipSupported && (
                  <button type="button" onClick={togglePip} aria-label="Picture-in-picture" className="hidden sm:block p-1.5 rounded-md hover:bg-white/15">
                    <PictureInPicture2 className="w-4 h-4" />
                  </button>
                )}
                <button type="button" onClick={toggleFs} aria-label={fullscreen ? 'Sair da tela cheia' : 'Tela cheia'} className="p-1.5 rounded-md hover:bg-white/15">
                  {fullscreen ? <Minimize className="w-4 h-4" /> : <Maximize className="w-4 h-4" />}
                </button>
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
