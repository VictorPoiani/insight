/**
 * Quem pode usar cada item do catálogo.
 *
 *  - Itens de Patente (requirement 'level'): EXCLUSIVOS do nível. Quem tem o
 *    nível (ou acima) usa; o Nitro NÃO libera esses itens.
 *  - Itens Nitro: só com Nitro ativo (assinatura em dia ou Nível 5 vitalício).
 *  - Itens de evento: só admin.
 *  - Admin usa tudo.
 *
 * O banco tem a mesma regra em public.nitro_can_use_item() — mantenha em sincronia.
 */
import { getNitroItem, type NitroCosmetics, type NitroItem, type NitroKind } from './catalog';
import { hasEntitlementColumns, resolveNitroEntitlement, type NitroEntitlementInput } from './entitlement';

export type LockReason = 'nitro' | 'level' | 'event' | null;

export function itemLockReason(item: NitroItem, p: NitroEntitlementInput | null | undefined): LockReason {
  if (p?.role === 'admin') return null;
  const req = item.requirement;
  if (req.type === 'level') return (p?.contributor_level ?? 0) >= req.min && p ? null : 'level';
  if (req.type === 'event') return 'event';
  return resolveNitroEntitlement(p).active ? null : 'nitro';
}

export function canUseItem(item: NitroItem | null | undefined, p: NitroEntitlementInput | null | undefined): boolean {
  return !!item && itemLockReason(item, p) === null;
}

const SLOTS: NitroKind[] = ['frame', 'title', 'tag', 'intro', 'font', 'theme'];

/**
 * Remove dos cosméticos de um perfil os itens que ele não pode mais usar
 * (ex.: assinatura vencida, nível que caiu). Preferências (liga/desliga) ficam.
 */
export function filterCosmetics(c: NitroCosmetics | null | undefined, p: NitroEntitlementInput | null | undefined): NitroCosmetics | null {
  if (!c) return null;
  // sem as colunas de nível/assinatura no objeto: confia no snapshot (gravado só pela RPC que valida)
  if (!hasEntitlementColumns(p) && p?.role !== 'admin') return c;
  const out: NitroCosmetics = { ...c };
  for (const slot of SLOTS) {
    const id = c[slot] as string | null | undefined;
    if (!id) continue;
    const item = getNitroItem(id, slot);
    if (!canUseItem(item, p)) (out as Record<string, unknown>)[slot] = null;
  }
  // arco-íris do logo é benefício do Nitro
  if (!resolveNitroEntitlement(p).active && p?.role !== 'admin') out.rainbow = false;
  return out;
}
