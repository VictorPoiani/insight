'use client';

import { useEffect, useState } from 'react';
import { EyeOff, Eye, Lock } from 'lucide-react';
import { useNitro } from '@/components/nitro/NitroProvider';

const AGE_KEY = 'insight-age-confirmed';

function ageConfirmed() {
  try {
    return localStorage.getItem(AGE_KEY) === '1';
  } catch {
    return false;
  }
}

/**
 * Conteúdo +18: aparece borrado, com aviso, até a pessoa confirmar.
 * A 1ª vez pede a confirmação de idade (lembrada neste aparelho); depois,
 * cada post +18 ainda exige um toque em "Mostrar".
 */
/** Idade pela data de nascimento do perfil (null = não informada). */
function ageFrom(birthday?: string | null): number | null {
  if (!birthday) return null;
  const b = new Date(`${birthday.slice(0, 10)}T12:00:00`);
  if (Number.isNaN(b.getTime())) return null;
  const now = new Date();
  let age = now.getFullYear() - b.getFullYear();
  if (now.getMonth() < b.getMonth() || (now.getMonth() === b.getMonth() && now.getDate() < b.getDate())) age--;
  return age;
}

export function NsfwGate({ active, children, compact = false }: { active: boolean; children: React.ReactNode; compact?: boolean }) {
  const { viewer } = useNitro();
  // conta com data de nascimento de menor de 18: nunca libera (ECA / ECA Digital)
  const age = ageFrom(viewer?.birthday);
  const minor = age !== null && age < 18;
  const [revealed, setRevealed] = useState(false);
  const [asking, setAsking] = useState(false);

  useEffect(() => {
    if (!active) setRevealed(false);
  }, [active]);

  if (!active || revealed) {
    return (
      <>
        {active && revealed && (
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              setRevealed(false);
            }}
            className="mb-2 inline-flex items-center gap-1.5 text-[11px] font-bold text-amber-500 hover:underline"
          >
            <EyeOff className="w-3.5 h-3.5" /> Ocultar conteúdo +18
          </button>
        )}
        {children}
      </>
    );
  }

  return (
    <div className="relative mt-3 rounded-xl overflow-hidden border border-border" onClick={(e) => e.stopPropagation()}>
      {/* conteúdo borrado por baixo: sem foco, sem clique, sem leitor de tela */}
      <div aria-hidden inert className={`pointer-events-none select-none blur-2xl saturate-50 ${compact ? 'max-h-40' : 'max-h-[420px]'} overflow-hidden`}>
        {children}
      </div>
      <div className="absolute inset-0 grid place-items-center bg-background/60 backdrop-blur-sm p-4 text-center">
        {minor ? (
          <div className="space-y-2.5">
            <Lock className="w-6 h-6 mx-auto text-muted" />
            <p className="text-sm font-bold text-primary">Conteúdo para maiores de 18 anos</p>
            <p className="text-xs text-secondary max-w-xs">Pela data de nascimento do seu perfil, este conteúdo não está disponível para você.</p>
          </div>
        ) : !asking ? (
          <div className="space-y-2.5">
            <span className="inline-flex items-center justify-center w-11 h-11 rounded-full border-2 border-amber-500 text-amber-500 text-sm font-black">+18</span>
            <p className="text-sm font-bold text-primary">Conteúdo sensível</p>
            <p className="text-xs text-secondary max-w-xs">Este Insight pode conter nudez ou conteúdo sexual.</p>
            <button
              type="button"
              onClick={() => (ageConfirmed() ? setRevealed(true) : setAsking(true))}
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-full bg-amber-500 text-black text-xs font-extrabold hover:bg-amber-400"
            >
              <Eye className="w-3.5 h-3.5" /> Mostrar conteúdo +18
            </button>
          </div>
        ) : (
          <div role="dialog" aria-label="Confirmação de idade" className="space-y-3 max-w-xs">
            <p className="text-sm font-bold text-primary">Você tem 18 anos ou mais?</p>
            <p className="text-xs text-secondary">Conteúdo adulto só pode ser visto por maiores de idade.</p>
            <div className="flex justify-center gap-2">
              <button type="button" onClick={() => setAsking(false)} className="px-3 py-1.5 rounded-full border border-border text-xs font-bold text-secondary">
                Não
              </button>
              <button
                type="button"
                onClick={() => {
                  try {
                    localStorage.setItem(AGE_KEY, '1');
                  } catch {
                    /* modo privado: pergunta de novo da próxima vez */
                  }
                  setAsking(false);
                  setRevealed(true);
                }}
                className="px-3 py-1.5 rounded-full bg-amber-500 text-black text-xs font-extrabold"
              >
                Sim, tenho 18+
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
