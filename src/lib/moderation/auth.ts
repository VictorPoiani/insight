import { createServerSupabase } from '@/lib/supabase/server';

export interface Caller {
  profileId: string;
  isStaff: boolean;
}

/** Perfil de quem chama a rota (null = não logado). */
export async function getCaller(): Promise<Caller | null> {
  const supabase = await createServerSupabase();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;
  const { data: prof } = await supabase
    .from('profiles')
    .select('id, role')
    .or(`user_id.eq.${user.id},id.eq.${user.id}`)
    .maybeSingle();
  if (!prof) return null;
  return { profileId: prof.id as string, isStaff: prof.role === 'admin' || prof.role === 'moderator' };
}

// limite simples por instância (o banco tem os limites de verdade)
const hits = new Map<string, number[]>();
export function tooMany(key: string, max: number, windowMs: number): boolean {
  const now = Date.now();
  const list = (hits.get(key) || []).filter((t) => now - t < windowMs);
  list.push(now);
  hits.set(key, list);
  if (hits.size > 5000) hits.clear();
  return list.length > max;
}

export const ENTITY_TYPES = ['post', 'reply', 'topic', 'profile'] as const;
export function isEntityType(v: unknown): v is (typeof ENTITY_TYPES)[number] {
  return typeof v === 'string' && (ENTITY_TYPES as readonly string[]).includes(v);
}
export const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
