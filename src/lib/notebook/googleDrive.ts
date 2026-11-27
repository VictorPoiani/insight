'use client';

/**
 * Google Drive no Canvas: a pessoa escolhe arquivos no seletor oficial do
 * Google (Picker) e o Insight baixa só esses arquivos, com o escopo
 * `drive.file` (nada além do que foi escolhido fica acessível).
 *
 * Documentos do Google são exportados: Docs → Markdown (vira cartão de texto);
 * Planilhas, Apresentações e Desenhos → PDF.
 */

const CLIENT_ID = process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID || '';
const API_KEY = process.env.NEXT_PUBLIC_GOOGLE_API_KEY || '';
/** O Picker quer o NÚMERO do projeto; se vier o ID, o número está no começo do Client ID. */
const APP_ID = /^\d+$/.test(process.env.NEXT_PUBLIC_GOOGLE_APP_ID || '') ? process.env.NEXT_PUBLIC_GOOGLE_APP_ID! : CLIENT_ID.split('-')[0] || '';
const SCOPE = 'https://www.googleapis.com/auth/drive.file';
const MIMES = [
  'image/png',
  'image/jpeg',
  'image/webp',
  'image/gif',
  'image/avif',
  'image/heic',
  'application/pdf',
  'audio/mpeg',
  'audio/mp4',
  'audio/ogg',
  'audio/wav',
  'audio/x-wav',
  'audio/webm',
  'video/mp4',
  'video/webm',
  'video/quicktime',
  'text/plain',
  'text/markdown',
  'application/vnd.google-apps.document',
  'application/vnd.google-apps.presentation',
  'application/vnd.google-apps.spreadsheet',
  'application/vnd.google-apps.drawing',
];

export const googleDriveReady = () => !!(CLIENT_ID && API_KEY && APP_ID);

/* eslint-disable @typescript-eslint/no-explicit-any */
type G = any;
declare global {
  interface Window {
    gapi?: G;
    google?: G;
  }
}

const loaded = new Map<string, Promise<void>>();
function script(src: string) {
  if (!loaded.has(src))
    loaded.set(
      src,
      new Promise((res, rej) => {
        const s = document.createElement('script');
        s.src = src;
        s.async = true;
        s.onload = () => res();
        s.onerror = () => (loaded.delete(src), rej(new Error('Não foi possível carregar o Google.')));
        document.head.appendChild(s);
      })
    );
  return loaded.get(src)!;
}

let token: { value: string; until: number } | null = null;

/** Pede (ou reaproveita) o acesso; precisa vir de um clique (pop-up). */
async function getToken(): Promise<string> {
  if (token && Date.now() < token.until) return token.value;
  await script('https://accounts.google.com/gsi/client');
  return new Promise((resolve, reject) => {
    const client = window.google!.accounts.oauth2.initTokenClient({
      client_id: CLIENT_ID,
      scope: SCOPE,
      callback: (r: { access_token?: string; expires_in?: number; error?: string }) => {
        if (r.error || !r.access_token) return reject(new Error(r.error === 'access_denied' ? 'Acesso ao Drive não autorizado.' : 'Não foi possível entrar no Google.'));
        token = { value: r.access_token, until: Date.now() + ((r.expires_in || 3600) - 120) * 1000 };
        resolve(r.access_token);
      },
      error_callback: (e: { type?: string }) => reject(new Error(e?.type === 'popup_closed' ? 'Janela do Google fechada.' : 'O navegador bloqueou a janela do Google.')),
    });
    client.requestAccessToken({ prompt: token ? '' : 'consent' });
  });
}

async function loadPicker() {
  await script('https://apis.google.com/js/api.js');
  await new Promise<void>((res, rej) => window.gapi!.load('picker', { callback: () => res(), onerror: () => rej(new Error('Seletor do Google indisponível.')) }));
}

interface PickedDoc {
  id: string;
  name: string;
  mimeType: string;
  sizeBytes?: number;
}

/** Abre o seletor do Google e devolve os arquivos escolhidos. */
export async function pickFromDrive(): Promise<PickedDoc[]> {
  const access = await getToken();
  await loadPicker();
  const g = window.google!;
  return new Promise((resolve) => {
    const view = new g.picker.DocsView(g.picker.ViewId.DOCS).setMimeTypes(MIMES.join(',')).setIncludeFolders(true).setSelectFolderEnabled(false);
    const picker = new g.picker.PickerBuilder()
      .addView(view)
      .addView(new g.picker.DocsUploadView())
      .enableFeature(g.picker.Feature.MULTISELECT_ENABLED)
      .setOAuthToken(access)
      .setDeveloperKey(API_KEY)
      .setAppId(APP_ID)
      .setLocale('pt-BR')
      .setTitle('Escolha arquivos para o canvas')
      .setCallback((d: { action: string; docs?: { id: string; name: string; mimeType: string; sizeBytes?: number }[] }) => {
        if (d.action === g.picker.Action.PICKED) resolve((d.docs || []).map((x) => ({ id: x.id, name: x.name, mimeType: x.mimeType, sizeBytes: Number(x.sizeBytes) || undefined })));
        else if (d.action === g.picker.Action.CANCEL) resolve([]);
      })
      .build();
    picker.setVisible(true);
  });
}

const EXPORT: Record<string, [string, string]> = {
  'application/vnd.google-apps.document': ['text/markdown', 'md'],
  'application/vnd.google-apps.presentation': ['application/pdf', 'pdf'],
  'application/vnd.google-apps.spreadsheet': ['application/pdf', 'pdf'],
  'application/vnd.google-apps.drawing': ['application/pdf', 'pdf'],
};

/** Baixa um arquivo escolhido (o original, sem conversão; Google Docs são exportados). */
export async function downloadDriveFile(doc: PickedDoc, maxBytes: number): Promise<File> {
  if (doc.sizeBytes && doc.sizeBytes > maxBytes) throw new Error(`${doc.name}: grande demais para o limite por arquivo do seu nível.`);
  const access = await getToken();
  const exp = EXPORT[doc.mimeType];
  const url = exp
    ? `https://www.googleapis.com/drive/v3/files/${encodeURIComponent(doc.id)}/export?mimeType=${encodeURIComponent(exp[0])}`
    : `https://www.googleapis.com/drive/v3/files/${encodeURIComponent(doc.id)}?alt=media&supportsAllDrives=true`;
  const r = await fetch(url, { headers: { Authorization: `Bearer ${access}` } });
  if (!r.ok) throw new Error(`${doc.name}: o Drive não liberou o arquivo (${r.status}).`);
  const blob = await r.blob();
  const type = exp ? exp[0] : doc.mimeType || blob.type;
  const name = exp && !doc.name.toLowerCase().endsWith(`.${exp[1]}`) ? `${doc.name}.${exp[1]}` : doc.name;
  return new File([blob], name, { type });
}
