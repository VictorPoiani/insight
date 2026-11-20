'use client';

/** Força da senha (só orienta; o mínimo exigido é 8 caracteres). */
export function scorePassword(pw: string): number {
  let s = 0;
  if (pw.length >= 8) s++;
  if (pw.length >= 12) s++;
  if (/[a-z]/.test(pw) && /[A-Z]/.test(pw)) s++;
  if (/\d/.test(pw)) s++;
  if (/[^A-Za-z0-9]/.test(pw)) s++;
  return Math.min(4, s);
}

const LABELS = ['Muito fraca', 'Fraca', 'Razoável', 'Boa', 'Forte'];
const COLORS = ['bg-red-500', 'bg-orange-500', 'bg-amber-400', 'bg-emerald-500', 'bg-emerald-400'];

export function PasswordStrength({ value }: { value: string }) {
  if (!value) return null;
  const s = scorePassword(value);
  return (
    <div className="space-y-1" aria-live="polite">
      <div className="flex gap-1">
        {[0, 1, 2, 3].map((i) => (
          <span key={i} className={`h-1 flex-1 rounded-full ${i < s ? COLORS[s] : 'bg-border'}`} />
        ))}
      </div>
      <p className="text-[11px] text-muted">
        Força: <span className="font-semibold text-secondary">{LABELS[s]}</span>
        {value.length < 8 && ' · mínimo de 8 caracteres'}
      </p>
    </div>
  );
}

export function validateNewPassword(pw: string, confirm: string): string | null {
  if (pw.length < 8) return 'A senha precisa ter pelo menos 8 caracteres.';
  if (pw.length > 72) return 'A senha pode ter no máximo 72 caracteres.';
  if (scorePassword(pw) < 2) return 'Senha muito fraca: misture letras maiúsculas, minúsculas e números.';
  if (pw !== confirm) return 'A confirmação não coincide com a nova senha.';
  return null;
}
