'use client';

/**
 * Armazenamento local do Notebook (IndexedDB), a base do modo local-first.
 *
 *   outbox  → mudanças que ainda não chegaram ao Supabase (nunca se perdem)
 *   docs    → cópia das notas, canvases e listas para abrir sem conexão
 *   blobs   → arquivos esperando subir ao R2 (enviados quando a rede voltar)
 *
 * Tudo é por perfil (a chave começa com o id do perfil). Sem IndexedDB
 * (modo privado antigo, cota cheia), as funções falham em silêncio e o app
 * segue como antes: salva direto no servidor.
 */

const DB_NAME = 'insight-notebook';
const DB_VERSION = 1;
export type Store = 'outbox' | 'docs' | 'blobs';

let dbPromise: Promise<IDBDatabase | null> | null = null;

function open(): Promise<IDBDatabase | null> {
  if (dbPromise) return dbPromise;
  dbPromise = new Promise((resolve) => {
    try {
      if (typeof indexedDB === 'undefined') return resolve(null);
      const req = indexedDB.open(DB_NAME, DB_VERSION);
      req.onupgradeneeded = () => {
        const db = req.result;
        for (const s of ['outbox', 'docs', 'blobs'] as Store[]) if (!db.objectStoreNames.contains(s)) db.createObjectStore(s);
      };
      req.onsuccess = () => {
        const db = req.result;
        db.onversionchange = () => db.close();
        resolve(db);
      };
      req.onerror = () => resolve(null);
      req.onblocked = () => resolve(null);
    } catch {
      resolve(null);
    }
  });
  return dbPromise;
}

function tx<T>(store: Store, mode: IDBTransactionMode, fn: (s: IDBObjectStore) => IDBRequest<T> | void): Promise<T | undefined> {
  return open().then(
    (db) =>
      new Promise<T | undefined>((resolve) => {
        if (!db) return resolve(undefined);
        try {
          const t = db.transaction(store, mode);
          const req = fn(t.objectStore(store));
          t.oncomplete = () => resolve(req ? (req.result as T) : undefined);
          t.onerror = () => resolve(undefined);
          t.onabort = () => resolve(undefined);
        } catch {
          resolve(undefined);
        }
      })
  );
}

export const idbGet = <T>(store: Store, key: string) => tx<T>(store, 'readonly', (s) => s.get(key) as IDBRequest<T>);
export const idbPut = (store: Store, key: string, value: unknown) => tx(store, 'readwrite', (s) => void s.put(value, key));
export const idbDel = (store: Store, key: string) => tx(store, 'readwrite', (s) => void s.delete(key));

/** Todas as entradas cujo nome começa com `prefix`. */
export async function idbAll<T>(store: Store, prefix: string): Promise<[string, T][]> {
  const db = await open();
  if (!db) return [];
  return new Promise((resolve) => {
    try {
      const out: [string, T][] = [];
      const t = db.transaction(store, 'readonly');
      const range = IDBKeyRange.bound(prefix, `${prefix}￿`);
      const req = t.objectStore(store).openCursor(range);
      req.onsuccess = () => {
        const c = req.result;
        if (!c) return;
        out.push([String(c.key), c.value as T]);
        c.continue();
      };
      t.oncomplete = () => resolve(out);
      t.onerror = () => resolve(out);
    } catch {
      resolve([]);
    }
  });
}

/** Erro de rede (sem conexão, DNS, queda) em vez de recusa do servidor. */
export function isNetworkError(err: unknown): boolean {
  if (typeof navigator !== 'undefined' && navigator.onLine === false) return true;
  const msg = String((err as { message?: string })?.message || err || '').toLowerCase();
  return /failed to fetch|networkerror|network request failed|load failed|fetch failed|timeout|aborted/.test(msg);
}

// ------------------------------------------------------------ fila genérica (verbetes, fontes, Codex)
/**
 * Escrita que precisa chegar ao servidor mesmo sem rede no momento.
 * Guardada no outbox e reenviada na ordem quando a conexão voltar.
 */
export interface QueuedWrite {
  table: string;
  op: 'insert' | 'update' | 'upsert' | 'delete';
  id: string;
  row: Record<string, unknown>;
  ts: number;
}

const qKey = (profileId: string, w: Pick<QueuedWrite, 'table' | 'id' | 'ts'>) => `${profileId}:q:${String(w.ts).padStart(15, '0')}:${w.table}:${w.id}`;

export async function enqueueWrite(profileId: string, w: Omit<QueuedWrite, 'ts'>) {
  const item: QueuedWrite = { ...w, ts: Date.now() + Math.random() };
  await idbPut('outbox', qKey(profileId, item), item);
  notifyPending();
}

type Client = { from: (t: string) => any }; // eslint-disable-line @typescript-eslint/no-explicit-any

let draining = false;
/** Reenvia a fila na ordem; para no primeiro erro de rede. */
export async function drainQueue(profileId: string, supabase: Client): Promise<number> {
  if (draining) return 0;
  draining = true;
  let sent = 0;
  try {
    const list = await idbAll<QueuedWrite>('outbox', `${profileId}:q:`);
    for (const [key, w] of list) {
      const q = supabase.from(w.table);
      const res =
        w.op === 'insert'
          ? await q.insert(w.row)
          : w.op === 'upsert'
            ? await q.upsert(w.row)
            : w.op === 'update'
              ? await q.update(w.row).eq('id', w.id)
              : await q.delete().eq('id', w.id);
      if (res?.error) {
        if (isNetworkError(res.error)) break;
        // recusa definitiva (ex.: já existe, sem permissão): descarta para não travar a fila
        console.warn('[notebook] escrita descartada', w.table, res.error.message);
      }
      await idbDel('outbox', key);
      sent++;
    }
  } finally {
    draining = false;
    notifyPending();
  }
  return sent;
}

/** Quantas escritas esperam a rede (para o indicador). */
export async function pendingCount(profileId: string): Promise<number> {
  return (await idbAll('outbox', `${profileId}:`)).length;
}

const listeners = new Set<() => void>();
export function onPendingChange(fn: () => void) {
  listeners.add(fn);
  return () => void listeners.delete(fn);
}
export function notifyPending() {
  listeners.forEach((fn) => fn());
}

/**
 * Grava no servidor; sem rede, guarda na fila e devolve sucesso (a tela já
 * mostra a mudança). Só recusas reais do servidor voltam como erro.
 */
export async function writeOrQueue(supabase: Client, profileId: string | null, w: Omit<QueuedWrite, 'ts'>): Promise<{ error: { message: string } | null; queued: boolean }> {
  const q = supabase.from(w.table);
  let res: { error: { message: string } | null } | null = null;
  try {
    res =
      w.op === 'insert' ? await q.insert(w.row) : w.op === 'upsert' ? await q.upsert(w.row) : w.op === 'update' ? await q.update(w.row).eq('id', w.id) : await q.delete().eq('id', w.id);
  } catch (err) {
    res = { error: { message: String((err as Error)?.message || err) } };
  }
  if (res?.error && isNetworkError(res.error) && profileId) {
    await enqueueWrite(profileId, w);
    return { error: null, queued: true };
  }
  return { error: res?.error || null, queued: false };
}
