/**
 * Captura de páginas e mídia externa para o Canvas do Notebook.
 *
 *   GET ?url=…              → { url, title, description, image, site }
 *   GET ?url=…&mode=image   → os bytes da imagem (para subir sem perda ao R2)
 *
 * Proteção contra SSRF: só http/https nas portas padrão; o nome é resolvido
 * aqui e TODOS os endereços precisam ser públicos; a conexão usa o endereço
 * já conferido (sem nova consulta de DNS, o que barra DNS rebinding); cada
 * redirecionamento passa pela mesma checagem; tempo e tamanho limitados.
 * Só para quem está logado e tem o Notebook.
 */
import { NextRequest, NextResponse } from 'next/server';
import dns from 'node:dns/promises';
import net from 'node:net';
import http from 'node:http';
import https from 'node:https';
import { createServerSupabase } from '@/lib/supabase/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const PAGE_MAX = 1_500_000;
const IMAGE_MAX = 25 * 1024 * 1024;
const TIMEOUT = 8000;
const MAX_REDIRECTS = 4;
const IMAGE_TYPES = /^image\/(png|jpe?g|webp|gif|avif)$/i;

class ClipError extends Error {
  constructor(
    message: string,
    public status = 400
  ) {
    super(message);
  }
}

function v4ToInt(ip: string) {
  return ip.split('.').reduce((a, b) => (a << 8) + Number(b), 0) >>> 0;
}
const V4_BLOCKED: [string, number][] = [
  ['0.0.0.0', 8],
  ['10.0.0.0', 8],
  ['100.64.0.0', 10],
  ['127.0.0.0', 8],
  ['169.254.0.0', 16],
  ['172.16.0.0', 12],
  ['192.0.0.0', 24],
  ['192.0.2.0', 24],
  ['192.88.99.0', 24],
  ['192.168.0.0', 16],
  ['198.18.0.0', 15],
  ['198.51.100.0', 24],
  ['203.0.113.0', 24],
  ['224.0.0.0', 4],
  ['240.0.0.0', 4],
];

/** Endereço que não pode ser alcançado a partir do servidor. */
function isBlockedIp(ip: string): boolean {
  if (net.isIPv4(ip)) {
    const n = v4ToInt(ip);
    return V4_BLOCKED.some(([base, bits]) => (n & (bits === 0 ? 0 : (~0 << (32 - bits)) >>> 0)) === (v4ToInt(base) & ((~0 << (32 - bits)) >>> 0)));
  }
  if (net.isIPv6(ip)) {
    const s = ip.toLowerCase();
    if (s === '::' || s === '::1') return true;
    const mapped = s.match(/^::ffff:(\d+\.\d+\.\d+\.\d+)$/);
    if (mapped) return isBlockedIp(mapped[1]);
    if (/^::ffff:/.test(s)) return true;
    const first = parseInt(s.split(':')[0] || '0', 16);
    if ((first & 0xfe00) === 0xfc00) return true; // fc00::/7 (ULA)
    if ((first & 0xffc0) === 0xfe80) return true; // fe80::/10 (link-local)
    if ((first & 0xff00) === 0xff00) return true; // multicast
    if (s.startsWith('64:ff9b:') || s.startsWith('2001:db8:') || s.startsWith('100::')) return true;
    return false;
  }
  return true;
}

async function checkUrl(raw: string): Promise<{ url: URL; address: string; family: number }> {
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    throw new ClipError('Endereço inválido.');
  }
  if (url.protocol !== 'http:' && url.protocol !== 'https:') throw new ClipError('Só endereços http ou https.');
  if (url.username || url.password) throw new ClipError('Endereço com usuário e senha não é aceito.');
  if (url.port && url.port !== '80' && url.port !== '443') throw new ClipError('Porta não permitida.');
  const host = url.hostname.replace(/^\[|\]$/g, '').toLowerCase();
  if (!host || host === 'localhost' || /\.(localhost|local|internal|lan|home|corp|intranet)$/.test(host) || !host.includes('.') && !net.isIP(host)) {
    throw new ClipError('Endereço interno não é aceito.');
  }
  const list = net.isIP(host) ? [{ address: host, family: net.isIPv6(host) ? 6 : 4 }] : await dns.lookup(host, { all: true, verbatim: true }).catch(() => []);
  if (!list.length) throw new ClipError('Não foi possível encontrar esse endereço.');
  if (list.some((a) => isBlockedIp(a.address))) throw new ClipError('Endereço interno não é aceito.');
  return { url, address: list[0].address, family: list[0].family };
}

interface Fetched {
  url: string;
  type: string;
  body: Buffer;
}

/** Busca com o IP já conferido, seguindo redirecionamentos conferidos. */
async function safeFetch(raw: string, max: number, accept: string, deadline: number): Promise<Fetched> {
  let current = raw;
  for (let hop = 0; hop <= MAX_REDIRECTS; hop++) {
    const { url, address, family } = await checkUrl(current);
    const left = deadline - Date.now();
    if (left <= 0) throw new ClipError('A página demorou demais para responder.', 504);
    const res = await new Promise<{ status: number; location?: string; type: string; body: Buffer }>((resolve, reject) => {
      const mod = url.protocol === 'https:' ? https : http;
      const req = mod.request(
        url,
        {
          method: 'GET',
          // conecta no endereço conferido (o SNI e o Host continuam com o nome)
          lookup: (_h: string, opts: unknown, cb: (err: Error | null, address: string | { address: string; family: number }[], family?: number) => void) => {
            if (opts && typeof opts === 'object' && (opts as { all?: boolean }).all) cb(null, [{ address, family }]);
            else cb(null, address, family);
          },
          headers: {
            'User-Agent': 'Mozilla/5.0 (compatible; InsightNotebookClipper/1.0)',
            Accept: accept,
            'Accept-Language': 'pt-BR,pt;q=0.9,en;q=0.7',
          },
          timeout: left,
        },
        (r) => {
          const status = r.statusCode || 0;
          if (status >= 300 && status < 400 && r.headers.location) {
            r.resume();
            return resolve({ status, location: r.headers.location, type: '', body: Buffer.alloc(0) });
          }
          const type = String(r.headers['content-type'] || '').split(';')[0].trim().toLowerCase();
          const len = Number(r.headers['content-length'] || 0);
          if (len > max) {
            r.destroy();
            return reject(new ClipError('O arquivo é grande demais.', 413));
          }
          const chunks: Buffer[] = [];
          let size = 0;
          r.on('data', (c: Buffer) => {
            size += c.length;
            if (size > max) {
              r.destroy();
              reject(new ClipError('O arquivo é grande demais.', 413));
            } else chunks.push(c);
          });
          r.on('end', () => resolve({ status, type, body: Buffer.concat(chunks) }));
          r.on('error', reject);
        }
      );
      req.on('timeout', () => req.destroy(new ClipError('A página demorou demais para responder.', 504)));
      req.on('error', reject);
      req.end();
    });
    if (res.location) {
      current = new URL(res.location, url).toString();
      continue;
    }
    if (res.status < 200 || res.status >= 300) throw new ClipError(`A página respondeu com erro (${res.status}).`, 502);
    return { url: url.toString(), type: res.type, body: res.body };
  }
  throw new ClipError('Redirecionamentos demais.', 502);
}

const decode = (s: string) =>
  s
    .replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(Number(n)))
    .replace(/&#x([0-9a-f]+);/gi, (_, n) => String.fromCodePoint(parseInt(n, 16)))
    .replace(/&quot;/g, '"')
    .replace(/&#39;|&apos;/g, "'")
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/\s+/g, ' ')
    .trim();

/** Lê título, descrição, imagem e nome do site das metatags. */
function readMeta(html: string, base: string) {
  const head = html.slice(0, 400_000);
  const metas = Array.from(head.matchAll(/<meta\b[^>]*>/gi)).map((m) => m[0]);
  const attr = (tag: string, name: string) => tag.match(new RegExp(`\\b${name}\\s*=\\s*("([^"]*)"|'([^']*)'|([^\\s>]+))`, 'i'));
  const meta = (...keys: string[]) => {
    for (const k of keys)
      for (const t of metas) {
        const key = attr(t, 'property') || attr(t, 'name');
        const v = key && (key[2] ?? key[3] ?? key[4] ?? '').toLowerCase();
        if (v === k) {
          const c = attr(t, 'content');
          const val = c && (c[2] ?? c[3] ?? c[4]);
          if (val) return decode(val);
        }
      }
    return '';
  };
  const titleTag = head.match(/<title[^>]*>([\s\S]{0,500}?)<\/title>/i)?.[1] || '';
  const abs = (u: string) => {
    try {
      const x = new URL(u, base);
      return x.protocol === 'http:' || x.protocol === 'https:' ? x.toString() : '';
    } catch {
      return '';
    }
  };
  return {
    url: base,
    title: (meta('og:title', 'twitter:title') || decode(titleTag)).slice(0, 300),
    description: meta('og:description', 'twitter:description', 'description').slice(0, 600),
    image: abs(meta('og:image', 'og:image:url', 'twitter:image', 'twitter:image:src')).slice(0, 2000),
    site: (meta('og:site_name') || new URL(base).hostname.replace(/^www\./, '')).slice(0, 120),
  };
}

export async function GET(req: NextRequest) {
  try {
    const supabase = await createServerSupabase();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: 'Entre na sua conta.' }, { status: 401 });
    const { data: allowed } = await supabase.rpc('notebook_has_access');
    if (!allowed) return NextResponse.json({ error: 'Sem acesso ao Notebook.' }, { status: 403 });

    const raw = req.nextUrl.searchParams.get('url') || '';
    if (raw.length > 2000) throw new ClipError('Endereço longo demais.');
    const mode = req.nextUrl.searchParams.get('mode') === 'image' ? 'image' : 'page';
    const deadline = Date.now() + TIMEOUT;

    if (mode === 'image') {
      const r = await safeFetch(raw, IMAGE_MAX, 'image/avif,image/webp,image/png,image/jpeg,image/gif;q=0.9', deadline);
      if (!IMAGE_TYPES.test(r.type)) throw new ClipError('Esse endereço não é uma imagem.', 415);
      return new NextResponse(new Uint8Array(r.body), {
        headers: { 'Content-Type': r.type, 'Cache-Control': 'private, max-age=300', 'X-Content-Type-Options': 'nosniff', 'Content-Disposition': 'attachment' },
      });
    }

    const r = await safeFetch(raw, PAGE_MAX, 'text/html,application/xhtml+xml;q=0.9,*/*;q=0.1', deadline);
    if (IMAGE_TYPES.test(r.type)) return NextResponse.json({ url: r.url, title: '', description: '', image: r.url, site: new URL(r.url).hostname, isImage: true });
    if (!/html|xml/.test(r.type)) return NextResponse.json({ url: r.url, title: '', description: '', image: '', site: new URL(r.url).hostname });
    const charset = /charset=["']?(iso-8859-1|latin1|windows-1252)/i.test(r.body.subarray(0, 4000).toString('latin1')) ? 'latin1' : 'utf8';
    return NextResponse.json(readMeta(r.body.toString(charset), r.url));
  } catch (err) {
    if (err instanceof ClipError) return NextResponse.json({ error: err.message }, { status: err.status });
    console.error('[notebook/clip]', err);
    return NextResponse.json({ error: 'Não foi possível capturar essa página.' }, { status: 502 });
  }
}
