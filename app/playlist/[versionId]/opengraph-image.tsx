import { ImageResponse } from 'next/og';
import { createClient } from '@supabase/supabase-js';
import { Song } from '@/types';

export const size = { width: 1200, height: 630 };
export const contentType = 'image/png';

export default async function Image({ params }: { params: Promise<{ versionId: string }> }) {
  const { versionId } = await params;

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );
  const { data } = await supabase
    .from('playlist_versions')
    .select('playlist_json')
    .eq('id', versionId)
    .single();

  const mood =
    (data?.playlist_json as { mood?: string } | null)?.mood ?? 'A VibeFlow Playlist';
  const songs: Song[] =
    (data?.playlist_json as { songs?: Song[] } | null)?.songs ?? [];
  const artists = [...new Set(songs.slice(0, 3).map((s) => s.artist))].join('  ·  ');
  const covers = songs.slice(0, 4).filter((s) => s.album_image);

  return new ImageResponse(
    (
      <div
        style={{
          width: '100%',
          height: '100%',
          background: '#09090b',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'space-between',
          padding: '64px 72px',
          fontFamily: 'sans-serif',
        }}
      >
        {covers.length > 0 && (
          <div style={{ display: 'flex', gap: '14px' }}>
            {covers.map((song, i) => (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                key={i}
                src={song.album_image!}
                width={104}
                height={104}
                style={{ borderRadius: 10, objectFit: 'cover' }}
              />
            ))}
          </div>
        )}

        <div style={{ display: 'flex', flexDirection: 'column' }}>
          <div
            style={{
              fontSize: 13,
              fontWeight: 500,
              color: '#52525b',
              letterSpacing: '0.15em',
              textTransform: 'uppercase',
              marginBottom: 20,
            }}
          >
            VIBEFLOW
          </div>
          <div
            style={{
              fontSize: covers.length > 0 ? 60 : 76,
              fontWeight: 700,
              color: '#f4f4f5',
              lineHeight: 1.05,
              marginBottom: 22,
            }}
          >
            {mood}
          </div>
          {artists && (
            <div style={{ fontSize: 22, color: '#71717a', marginBottom: 10 }}>{artists}</div>
          )}
          <div style={{ fontSize: 16, color: '#3f3f46' }}>{songs.length} tracks</div>
        </div>
      </div>
    ),
    { ...size }
  );
}
