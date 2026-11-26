'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { EyeOff, Eye, Lock } from 'lucide-react';
import { useNitro } from '@/components/nitro/NitroProvider';
import { ageFrom, setMyBirthday, useMyBirthday } from '@/lib/account/birthday';


/**
 * Conteúdo +18: aparece borrado até a pessoa tocar em "Mostrar".
 * A idade vem da data de nascimento da conta (obrigatória no cadastro), não de
 * uma autodeclaração: visitante sem conta precisa entrar; menor de 18 nunca vê;
 * conta antiga sem data informa uma vez (depois só o suporte altera).
 */
export function NsfwGate({ active, children, compact = false }: { active: boolean; children: React.ReactNode; compact?: boolean }) {
  const { viewer, ready } = useNitro();
  const birthday = useMyBirthday(viewer?.id);
  const age = ageFrom(birthday);
  const [revealed, setRevealed] = useState(false);
  const [asking, setAsking] = useState(false);
  const [draft, setDraft] = useState('');
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState<string | null>(null);

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

  async function saveBirthday() {
    if (!viewer) return;
    const a = ageFrom(draft);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(draft) || a === null || a < 0 || a > 120) {
      setErr('Informe uma data válida.');
      return;
    }
    setSaving(true);
    setErr(null);
    const res = await setMyBirthday(viewer.id, draft);
    setSaving(false);
    if (!res.ok) {
      setErr(res.error || 'Não foi possível salvar.');
      return;
    }
    setAsking(false);
    if (a >= 18) setRevealed(true);
  }

  let panel: React.ReactNode;
  if (!ready || (viewer && birthday === undefined)) {
    panel = null;
  } else if (!viewer) {
    panel = (
      <div className="space-y-2.5">
        <span className="inline-flex items-center justify-center w-11 h-11 rounded-full border-2 border-amber-500 text-amber-500 text-sm font-black">+18</span>
        <p className="text-sm font-bold text-primary">Conteúdo sensível</p>
        <p className="text-xs text-secondary max-w-xs">Entre na sua conta para ver conteúdo para maiores de 18 anos.</p>
        <Link href="/login" className="inline-flex items-center gap-1.5 px-4 py-2 rounded-full bg-amber-500 text-black text-xs font-extrabold hover:bg-amber-400">
          Entrar
        </Link>
      </div>
    );
  } else if (age !== null && age < 18) {
    panel = (
      <div className="space-y-2.5">
        <Lock className="w-6 h-6 mx-auto text-muted" />
        <p className="text-sm font-bold text-primary">Conteúdo para maiores de 18 anos</p>
        <p className="text-xs text-secondary max-w-xs">Pela data de nascimento da sua conta, este conteúdo não está disponível para você.</p>
      </div>
    );
  } else if (asking) {
    panel = (
      <div role="dialog" aria-label="Data de nascimento" className="space-y-3 max-w-xs">
        <p className="text-sm font-bold text-primary">Qual é a sua data de nascimento?</p>
        <p className="text-xs text-secondary">Fica salva na sua conta e só o suporte pode alterar depois.</p>
        <input
          type="date"
          value={draft}
          max={new Date().toISOString().slice(0, 10)}
          onChange={(e) => setDraft(e.target.value)}
          className="w-full bg-elevated border border-border rounded-lg px-3 py-2 text-xs text-primary focus:outline-none focus:border-accent"
        />
        {err && <p className="text-[11px] font-semibold text-danger">{err}</p>}
        <div className="flex justify-center gap-2">
          <button type="button" onClick={() => setAsking(false)} className="px-3 py-1.5 rounded-full border border-border text-xs font-bold text-secondary">
            Cancelar
          </button>
          <button
            type="button"
            disabled={saving || !draft}
            onClick={saveBirthday}
            className="px-3 py-1.5 rounded-full bg-amber-500 text-black text-xs font-extrabold disabled:opacity-50"
          >
            {saving ? 'Salvando…' : 'Confirmar'}
          </button>
        </div>
      </div>
    );
  } else {
    panel = (
      <div className="space-y-2.5">
        <span className="inline-flex items-center justify-center w-11 h-11 rounded-full border-2 border-amber-500 text-amber-500 text-sm font-black">+18</span>
        <p className="text-sm font-bold text-primary">Conteúdo sensível</p>
        <p className="text-xs text-secondary max-w-xs">Este Insight pode conter nudez ou conteúdo sexual.</p>
        <button
          type="button"
          onClick={() => (age === null ? setAsking(true) : setRevealed(true))}
          className="inline-flex items-center gap-1.5 px-4 py-2 rounded-full bg-amber-500 text-black text-xs font-extrabold hover:bg-amber-400"
        >
          <Eye className="w-3.5 h-3.5" /> Mostrar conteúdo +18
        </button>
      </div>
    );
  }

  return (
    <div className="relative mt-3 rounded-xl overflow-hidden border border-border" onClick={(e) => e.stopPropagation()}>
      {/* conteúdo borrado por baixo: sem foco, sem clique, sem leitor de tela */}
      <div aria-hidden inert className={`pointer-events-none select-none blur-2xl saturate-50 ${compact ? 'max-h-40' : 'max-h-[420px]'} overflow-hidden`}>
        {children}
      </div>
      <div className="absolute inset-0 grid place-items-center bg-background/60 backdrop-blur-sm p-4 text-center">{panel}</div>
    </div>
  );
}
