/**
 * Insight Nitro — assinatura (R$ 3,99/mês) ou vitalício no Nível 5.
 *
 * Só cosméticos, identidade visual e comunidade VIP. NÃO altera limites de
 * upload, comunidades nem tópicos: isso é dos Níveis de Contribuinte
 * (src/lib/contributorLevels.ts).
 *
 * O banco tem as mesmas regras em public.has_nitro_access() — mantenha em sincronia.
 */

export const NITRO_PRICE_BRL = 3.99;

/** Nível que dá Nitro vitalício e gratuito. */
export const NITRO_LIFETIME_LEVEL = 5;

/**
 * Lançado: o Nitro vale para quem tem direito (assinatura ou Nível 5).
 * NEXT_PUBLIC_INSIGHT_NITRO=beta volta à beta fechada (só admin) e =off desliga
 * tudo. O banco tem o mesmo portão em public.nitro_is_public() (nitro_settings).
 */
const NITRO_MODE = process.env.NEXT_PUBLIC_INSIGHT_NITRO;
export const NITRO_PUBLIC = NITRO_MODE !== 'beta' && NITRO_MODE !== 'off';
export const NITRO_KILL_SWITCH = process.env.NEXT_PUBLIC_INSIGHT_NITRO === 'off';

export type NitroStatus = 'none' | 'active' | 'past_due' | 'canceled' | 'expired';

export type NitroSource =
  | 'lifetime-level' // Nível 5 (direito dinâmico)
  | 'lifetime-flag' // has_lifetime_nitro gravado (fica mesmo se o nível cair)
  | 'subscription' // R$ 3,99/mês em dia
  | 'staff-beta' // admin durante a beta fechada
  | 'none';

export interface NitroEntitlementInput {
  role?: string | null;
  contributor_level?: number | null;
  nitro_status?: NitroStatus | string | null;
  nitro_expires_at?: string | null;
  has_lifetime_nitro?: boolean | null;
}

export interface NitroEntitlement {
  /** Pode usar os benefícios agora (já considera o portão de lançamento). */
  active: boolean;
  /** Teria direito com o Nitro lançado (para textos e prévias). */
  entitled: boolean;
  source: NitroSource;
  lifetime: boolean;
  /** Fim do período pago; null para vitalício ou sem assinatura. */
  expiresAt: Date | null;
}

export function resolveNitroEntitlement(
  p: NitroEntitlementInput | null | undefined,
  now: Date = new Date()
): NitroEntitlement {
  const none: NitroEntitlement = { active: false, entitled: false, source: 'none', lifetime: false, expiresAt: null };
  if (!p || NITRO_KILL_SWITCH) return none;

  let source: NitroSource = 'none';
  let expiresAt: Date | null = null;

  if ((p.contributor_level ?? 0) >= NITRO_LIFETIME_LEVEL) source = 'lifetime-level';
  else if (p.has_lifetime_nitro) source = 'lifetime-flag';
  else if (p.nitro_status === 'active' || p.nitro_status === 'past_due' || p.nitro_status === 'canceled') {
    // cancelada continua valendo até o fim do período já pago
    const exp = p.nitro_expires_at ? new Date(p.nitro_expires_at) : null;
    if (exp && exp.getTime() > now.getTime()) {
      source = 'subscription';
      expiresAt = exp;
    }
  }

  const entitled = source !== 'none';
  const isAdmin = p.role === 'admin';

  if (!NITRO_PUBLIC) {
    // beta fechada: só admin usa, qualquer que seja o direito
    if (!isAdmin) return { ...none, entitled, source, lifetime: source.startsWith('lifetime'), expiresAt };
    return { active: true, entitled: true, source: entitled ? source : 'staff-beta', lifetime: source.startsWith('lifetime'), expiresAt };
  }

  return { active: entitled, entitled, source, lifetime: source.startsWith('lifetime'), expiresAt };
}

export function describeNitroSource(e: NitroEntitlement): string {
  switch (e.source) {
    case 'lifetime-level':
    case 'lifetime-flag':
      return 'Vitalício · Nível 5 Grão-Mestre';
    case 'subscription':
      return e.expiresAt
        ? `Assinatura ativa até ${e.expiresAt.toLocaleDateString('pt-BR')}`
        : 'Assinatura ativa';
    case 'staff-beta':
      return 'Beta fechada · admin';
    default:
      return `R$ ${NITRO_PRICE_BRL.toFixed(2).replace('.', ',')}/mês`;
  }
}

/**
 * O selo/cosméticos de um perfil QUALQUER devem aparecer para quem o vê?
 * Beta fechada: só admin exibe. Lançado: quem tem direito.
 * `null` = o objeto não trouxe as colunas necessárias (confie nos cosméticos salvos,
 * que só são gravados pela RPC com checagem de acesso).
 */
export function displaysNitro(p: NitroEntitlementInput | null | undefined): boolean | null {
  if (!p || NITRO_KILL_SWITCH) return false;
  if (!hasEntitlementColumns(p) && p.role !== 'admin') return null;
  if (p.role === 'admin') return true;
  if (!NITRO_PUBLIC) return false;
  return resolveNitroEntitlement(p).entitled;
}

/** O objeto trouxe as colunas necessárias para calcular o direito ao Nitro? */
export function hasEntitlementColumns(p: NitroEntitlementInput | null | undefined): boolean {
  return !!p && p.contributor_level !== undefined && p.nitro_status !== undefined;
}
