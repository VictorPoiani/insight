import { ReplyBlock } from '@/types/database';
import { MentionText } from '@/components/mentions/MentionText';
import { CustomSpotifyPlayer } from '@/components/feed/CustomSpotifyPlayer';
import { VideoPlayer } from '@/components/media/VideoPlayer';

/** Renderiza o corpo em blocos de uma resposta (texto puro, sem HTML do usuário). */
export function ReplyBlocks({ blocks }: { blocks: ReplyBlock[] }) {
  return (
    <div className="mt-1 space-y-1.5 text-sm text-primary leading-relaxed break-words">
      {blocks.map((b, i) => {
        switch (b.type) {
          case 'quote':
            return (
              <blockquote key={b.id || i} className="pl-3 border-l-2 border-accent/60 text-secondary italic whitespace-pre-line">
                <MentionText text={b.text} />
              </blockquote>
            );
          case 'code':
            return (
              <pre key={b.id || i} className="px-3 py-2 rounded-lg bg-elevated border border-border text-[12px] font-mono text-sky-400 overflow-x-auto whitespace-pre">
                {b.text}
              </pre>
            );
          case 'bullet':
            return (
              <ul key={b.id || i} className="list-disc pl-5 space-y-0.5">
                {(b.text || '')
                  .split('\n')
                  .filter((l) => l.trim())
                  .map((l, k) => (
                    <li key={k}>
                      <MentionText text={l} />
                    </li>
                  ))}
              </ul>
            );
          case 'image':
            return b.url?.startsWith('https://') ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                key={b.id || i}
                src={b.url}
                alt=""
                loading="lazy"
                className="max-h-96 w-auto max-w-full rounded-xl border border-border object-contain bg-elevated"
              />
            ) : null;
          case 'gif':
            if (!b.url?.startsWith('https://')) return null;
            return /\.mp4(\?|$)/i.test(b.url) ? (
              <div key={b.id || i} className="max-w-xs rounded-xl overflow-hidden border border-border">
                <VideoPlayer src={b.url} gif maxHeight={320} label="GIF" />
              </div>
            ) : (
              // eslint-disable-next-line @next/next/no-img-element
              <img key={b.id || i} src={b.url} alt="GIF" loading="lazy" className="max-h-80 w-auto max-w-full rounded-xl border border-border" />
            );
          case 'video':
            return b.url?.startsWith('https://') ? (
              <div key={b.id || i} className="rounded-xl overflow-hidden border border-border">
                <VideoPlayer src={b.url} maxHeight={420} label="Vídeo da resposta" />
              </div>
            ) : null;
          case 'spotify':
            // faixa escolhida pela pesquisa (iTunes): player do Insight
            if (b.trackId && /^it\d{3,15}$/.test(b.trackId)) {
              return <CustomSpotifyPlayer key={b.id || i} trackId={b.trackId} />;
            }
            return b.trackId && /^[A-Za-z0-9]{10,40}$/.test(b.trackId) ? (
              <iframe
                key={b.id || i}
                src={`https://open.spotify.com/embed/track/${b.trackId}?utm_source=generator&theme=0`}
                width="100%"
                height="80"
                frameBorder="0"
                allow="autoplay; clipboard-write; encrypted-media; fullscreen; picture-in-picture"
                loading="lazy"
                className="rounded-lg"
                title="Faixa do Spotify"
              />
            ) : null;
          default:
            return (
              <p key={b.id || i} className="whitespace-pre-line">
                <MentionText text={b.text} />
              </p>
            );
        }
      })}
    </div>
  );
}

/** Texto corrido para notificações, prévias e busca. */
export function replyBlocksToText(blocks: ReplyBlock[]): string {
  return blocks
    .map((b) => {
      if (b.type === 'image') return '[imagem]';
      if (b.type === 'spotify') return '[música]';
      if (b.type === 'gif') return '[GIF]';
      if (b.type === 'video') return '[vídeo]';
      if (b.type === 'quote') return `“${(b.text || '').trim()}”`;
      return (b.text || '').trim();
    })
    .filter(Boolean)
    .join('\n')
    .slice(0, 4000);
}
