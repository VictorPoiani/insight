'use client';

import { useEffect, useState } from 'react';
import { createClient } from '@/lib/supabase/client';

/**
 * A data de nascimento completa fica em "profile_birthdays" (só o dono e a
 * equipe leem). O perfil público guarda só dia/mês em "birthday_md".
 */

const cache = new Map<string, Promise<string | null>>();
const listeners = new Set<() => void>();

export function fetchMyBirthday(profileId: string): Promise<string | null> {
  let p = cache.get(profileId);
  if (!p) {
    p = Promise.resolve(
      createClient().from('profile_birthdays').select('birthday').eq('profile_id', profileId).maybeSingle()
    ).then(({ data }) => (data?.birthday as string | undefined) ?? null, () => null);
    cache.set(profileId, p);
  }
  return p;
}

/** Informa a data uma única vez (contas antigas). Depois, só o suporte altera. */
export async function setMyBirthday(profileId: string, birthday: string): Promise<{ ok: boolean; error?: string }> {
  const { error } = await createClient().rpc('set_my_birthday', { p_birthday: birthday });
  if (error) {
    const low = error.message.toLowerCase();
    if (low.includes('birthday_locked')) return { ok: false, error: 'A data já foi informada. Para corrigir, fale com o suporte.' };
    if (low.includes('birthday_invalid')) return { ok: false, error: 'Informe uma data válida.' };
    return { ok: false, error: 'Não foi possível salvar. Tente de novo.' };
  }
  cache.set(profileId, Promise.resolve(birthday));
  listeners.forEach((fn) => fn());
  return { ok: true };
}

/** Data completa do próprio usuário ('AAAA-MM-DD'); undefined enquanto carrega. */
export function useMyBirthday(profileId?: string | null): string | null | undefined {
  const [value, setValue] = useState<string | null | undefined>(profileId ? undefined : null);
  useEffect(() => {
    if (!profileId) {
      setValue(null);
      return;
    }
    let alive = true;
    const load = () => fetchMyBirthday(profileId).then((v) => alive && setValue(v));
    load();
    listeners.add(load);
    return () => {
      alive = false;
      listeners.delete(load);
    };
  }, [profileId]);
  return value;
}

/** Idade completa em anos a partir de 'AAAA-MM-DD' (null = não informada/inválida). */
export function ageFrom(birthday?: string | null): number | null {
  if (!birthday) return null;
  const b = new Date(`${birthday.slice(0, 10)}T12:00:00`);
  if (Number.isNaN(b.getTime())) return null;
  const now = new Date();
  let age = now.getFullYear() - b.getFullYear();
  if (now.getMonth() < b.getMonth() || (now.getMonth() === b.getMonth() && now.getDate() < b.getDate())) age--;
  return age;
}
