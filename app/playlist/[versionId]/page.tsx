import { cache } from 'react';
import { notFound } from 'next/navigation';
import { createClient } from '@supabase/supabase-js';
import type { Metadata } from 'next';
import { Song } from '@/types';

// Requires a Supabase RLS policy allowing public SELECT on playlist_versions:
//   CREATE POLICY "public_read_playlist_versions" ON playlist_versions FOR SELECT USING (true);
function serverSupabase() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );
}

// cache() deduplicates the fetch between generateMetadata and the page component
const getVersion = cache(async (versionId: string) => {
  const { data } = await serverSupabase()
    .from('playlist_versions')
    .select('id, version_number, playlist_json, created_at')
    .eq('id', versionId)
    .single();
  return data ?? null;
});

type Props = { params: Promise<{ versionId: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { versionId } = await params;
  const version = await getVersion(versionId);
  if (!version) return { title: 'Playlist not found — VibeFlow' };

  const { mood, songs } = version.playlist_json as { mood: string; songs: Song[] };
  const uniqueArtists = [...new Set(songs.slice(0, 4).map((s) => s.artist))];
  const description = `${songs.length} tracks · ${uniqueArtists.join(', ')}`;

  return {
    title: `${mood} — VibeFlow`,
    description,
    openGraph: {
      title: `${mood} — VibeFlow`,
      description,
      type: 'website',
    },
    twitter: {
      card: 'summary_large_image',
      title: `${mood} — VibeFlow`,
      description,
    },
  };
}

export default async function SharedPlaylistPage({ params }: Props) {
  const { versionId } = await params;
  const version = await getVersion(versionId);
  if (!version) notFound();

  const { mood, songs } = version.playlist_json as { mood: string; songs: Song[] };

  return (
    <main className="min-h-screen bg-zinc-950 text-zinc-100">
      <header className="border-b border-zinc-800 px-6 py-4 flex items-center justify-between">
        <a
          href="/"
          className="text-sm font-semibold tracking-tight hover:text-zinc-300 transition-colors"
        >
          VibeFlow
        </a>
        <span className="text-xs text-zinc-600">shared playlist</span>
      </header>

      <div className="max-w-xl mx-auto px-4 py-10">
        <h1 className="text-2xl font-semibold text-zinc-100 mb-1">{mood}</h1>
        <p className="text-sm text-zinc-500 mb-8">{songs.length} tracks</p>

        <div className="space-y-0.5">
          {songs.map((song, i) => (
            <a
              key={song.id}
              href={song.external_url}
              target="_blank"
              rel="noopener noreferrer"
              className="group flex items-center gap-3 px-3 py-2.5 rounded-lg hover:bg-zinc-800/60 transition-colors"
            >
              <span className="w-5 text-right text-xs text-zinc-700 tabular-nums shrink-0">
                {i + 1}
              </span>
              <div className="w-9 h-9 rounded bg-zinc-800 shrink-0 overflow-hidden">
                {song.album_image && (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={song.album_image} alt="" className="w-full h-full object-cover" />
                )}
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium truncate">{song.title}</p>
                <p className="text-xs text-zinc-500 truncate">{song.artist}</p>
              </div>
              <span className="text-xs text-zinc-700 tabular-nums font-mono shrink-0">
                {formatDuration(song.duration_ms)}
              </span>
            </a>
          ))}
        </div>

        <div className="mt-10 pt-8 border-t border-zinc-800 text-center">
          <p className="text-sm text-zinc-500 mb-3">Like this vibe?</p>
          <a
            href="/"
            className="inline-block bg-zinc-100 text-zinc-900 text-sm font-medium px-5 py-2.5 rounded-lg hover:bg-white transition-colors"
          >
            Create your own playlist
          </a>
        </div>
      </div>
    </main>
  );
}

function formatDuration(ms: number): string {
  const total = Math.floor(ms / 1000);
  return `${Math.floor(total / 60)}:${(total % 60).toString().padStart(2, '0')}`;
}
