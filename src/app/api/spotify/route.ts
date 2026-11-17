import { NextRequest, NextResponse } from 'next/server';

export interface SpotifyTrackMetadata {
  trackId: string;
  title: string;
  artist: string;
  coverUrl: string;
  accentColor: string;
  previewUrl: string | null;
  spotifyUrl: string;
}

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const rawParam = searchParams.get('trackId')?.trim();

  if (!rawParam) {
    return NextResponse.json({ error: 'trackId obrigatório' }, { status: 400 });
  }

  const cleanQuery = rawParam.replace(/[\/\\#,+()$~%.'":*?<>{}]/g, ' ');

  try {
    const itunesRes = await fetch(
      `https://itunes.apple.com/search?term=${encodeURIComponent(
        cleanQuery
      )}&media=music&entity=song&limit=1`,
      { next: { revalidate: 86400 } }
    );

    if (itunesRes.ok) {
      const data = await itunesRes.json();
      const hit = data?.results?.[0];

      if (hit) {
        const title = hit.trackName || cleanQuery;
        const artist = hit.artistName || 'Artista';
        const coverUrl = hit.artworkUrl100
          ? hit.artworkUrl100.replace('100x100bb', '400x400bb')
          : '';
        const previewUrl = hit.previewUrl || null;
        const trackId = String(hit.trackId || rawParam);
        const spotifyUrl = `https://open.spotify.com/search/${encodeURIComponent(
          `${title} ${artist}`
        )}`;

        const payload: SpotifyTrackMetadata = {
          trackId,
          title,
          artist,
          coverUrl,
          accentColor: '#1DB954',
          previewUrl,
          spotifyUrl,
        };

        return NextResponse.json(payload);
      }
    }
  } catch {
    // Ignora erro e usa fallback
  }

  // Fallback seguro caso a busca externa falhe
  return NextResponse.json(
    {
      trackId: rawParam,
      title: rawParam,
      artist: 'Spotify',
      coverUrl: '',
      accentColor: '#1DB954',
      previewUrl: null,
      spotifyUrl: `https://open.spotify.com/search/${encodeURIComponent(rawParam)}`,
    },
    { status: 200 }
  );
}