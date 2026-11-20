'use client';

import { useEffect, useMemo, useState, type CSSProperties } from 'react';
import { IntroItem, NitroCosmetics, getNitroItem } from '@/lib/nitro/catalog';
import { prefersReducedMotion, useNitro, useProfileCosmetics } from './NitroProvider';
import { IntroScene } from './intro/scenes';

type CSSVars = CSSProperties & Record<`--${string}`, string | number>;

function rand(seed: number) {
  const x = Math.sin(seed * 12.9898 + 78.233) * 43758.5453;
  return x - Math.floor(x);
}

/**
 * Camada de tela cheia que toca uma animação de abertura uma vez.
 * Clique ou qualquer tecla pula. Não bloqueia a leitura do perfil por baixo.
 */
export function IntroOverlay({ intro, onDone }: { intro: IntroItem; onDone: () => void }) {
  useEffect(() => {
    const timer = setTimeout(onDone, intro.durationMs + 150);
    const onKey = () => onDone();
    window.addEventListener('keydown', onKey);
    return () => {
      clearTimeout(timer);
      window.removeEventListener('keydown', onKey);
    };
  }, [intro, onDone]);

  const particles = useMemo(() => {
    const p = intro.particles;
    if (!p) return [];
    return Array.from({ length: p.count }, (_, i) => {
      const colors = p.colors?.length ? p.colors : ['#ffffff'];
      const angle = rand(i + 1) * Math.PI * 2;
      const dist = 25 + rand(i + 5) * 45;
      const style: CSSVars = {
        '--x': `${Math.round(rand(i + 2) * 100)}%`,
        '--y': `${Math.round(rand(i + 9) * 60)}%`,
        '--dx': `${Math.round((rand(i + 4) - 0.5) * 30)}vw`,
        '--tx': `${Math.round(Math.cos(angle) * dist)}vmax`,
        '--ty': `${Math.round(Math.sin(angle) * dist)}vmax`,
        '--a': `${Math.round(rand(i + 3) * 360)}deg`,
        // 3 planos de profundidade: perto (grande, rápido), meio, longe (pequeno, lento, apagado)
        '--s': `${Math.round((12 + rand(i + 6) * 18) * [1.35, 1, 0.6][i % 3])}px`,
        '--zo': [1, 0.85, 0.5][i % 3],
        '--zf': [0.8, 1, 1.25][i % 3],
        '--d': `${(rand(i + 8) * intro.durationMs * 0.35) / 1000}s`,
        '--c': colors[i % colors.length],
      };
      return { key: i, style };
    });
  }, [intro]);

  const rootStyle: CSSVars = {
    '--nx-dur': `${intro.durationMs}ms`,
    '--nx-rbg': intro.reveal
      ? intro.reveal.colors.length > 1
        ? `linear-gradient(160deg, ${intro.reveal.colors.join(', ')})`
        : intro.reveal.colors[0]
      : 'transparent',
  };

  return (
    <div
      className="nx-intro"
      style={rootStyle}
      onClick={onDone}
      role="presentation"
      aria-hidden
      data-intro={intro.id}
    >
      {intro.scene ? (
        <IntroScene id={intro.scene} />
      ) : intro.reveal?.kind === 'split' ? (
        <>
          <div className="nx-rv nx-rv-half nx-rv-half--l" />
          <div className="nx-rv nx-rv-half nx-rv-half--r" />
          <div className="nx-rv-ribbon" />
        </>
      ) : intro.reveal ? (
        <div className={`nx-rv nx-rv--${intro.reveal.kind}`} />
      ) : null}

      {!intro.scene && <div className="nx-vignette" />}
      {!intro.scene && <div className="nx-sweep" />}
      {!intro.scene && intro.fx === 'speedlines' && <div className="nx-fx nx-fx--speedlines" />}
      {!intro.scene && intro.fx === 'glitch' && <div className="nx-fx nx-fx--glitch" />}
      {!intro.scene && intro.fx === 'flash' && <div className="nx-fx nx-fx--flash" />}

      {!intro.scene && intro.particles &&
        particles.map((p) => (
          <span key={p.key} className={`nx-ip nx-ip--${intro.particles!.mode}`} style={p.style}>
            {intro.particles!.mode === 'streak' ? null : intro.particles!.glyph}
          </span>
        ))}

      <span className="nx-intro-skip">Toque para pular</span>
    </div>
  );
}

/** Escolhe qual abertura tocar para um perfil (patente 4/5 tem prioridade). */
export function resolveIntro(
  cosmetics: NitroCosmetics | null,
  level: number
): IntroItem | null {
  if (!cosmetics) return null;
  if (level >= 4 && cosmetics.levelAnimation !== false) {
    const tier = getNitroItem(level >= 5 ? 'intro-tier-5' : 'intro-tier-4', 'intro');
    if (tier) return tier;
  }
  if (cosmetics.introEnabled === false) return null;
  return getNitroItem(cosmetics.intro, 'intro');
}

/**
 * Toca a abertura do perfil uma vez por sessão, respeitando:
 * toggle do dono, preferência do visitante e "reduzir movimento".
 */
export function ProfileIntro({
  profile,
}: {
  profile: { id: string; cosmetics?: NitroCosmetics | null; contributor_level?: number | null };
}) {
  const cosmetics = useProfileCosmetics(profile);
  const { prefs } = useNitro();
  const [intro, setIntro] = useState<IntroItem | null>(null);

  useEffect(() => {
    const chosen = resolveIntro(cosmetics, profile.contributor_level ?? 0);
    if (!chosen || !prefs.playIntros || prefersReducedMotion()) return;
    const key = `nitro-intro-${profile.id}`;
    try {
      if (sessionStorage.getItem(key)) return;
      sessionStorage.setItem(key, '1');
    } catch {
      // sem sessionStorage: toca mesmo assim
    }
    setIntro(chosen);
    // Só na montagem / troca de perfil
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [profile.id, cosmetics?.intro, cosmetics?.introEnabled]);

  if (!intro) return null;
  return <IntroOverlay intro={intro} onDone={() => setIntro(null)} />;
}
