import {
  SpotifyTrack,
  SpotifySearchResponse,
  SpotifyArtistSearchResponse,
  SpotifyTopTracksResponse,
} from '@/types/spotify';
import { Song, SearchIntent } from '@/types';

const BASE = 'https://api.spotify.com/v1';
const TOKEN_URL = 'https://accounts.spotify.com/api/token';

// ── Token cache (module-level, reused across requests in the same process) ───
let cachedToken: string | null = null;
let tokenExpiry = 0;

async function getToken(): Promise<string> {
  if (cachedToken && Date.now() < tokenExpiry) return cachedToken;

  const creds = Buffer.from(
    `${process.env.SPOTIFY_CLIENT_ID}:${process.env.SPOTIFY_CLIENT_SECRET}`
  ).toString('base64');

  const res = await fetch(TOKEN_URL, {
    method: 'POST',
    headers: {
      Authorization: `Basic ${creds}`,
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: 'grant_type=client_credentials',
    cache: 'no-store',
  });
  if (!res.ok) throw new Error(`Spotify auth failed: ${res.status}`);

  const data = await res.json();
  cachedToken = data.access_token;
  tokenExpiry = Date.now() + (data.expires_in - 60) * 1000; // 60s safety buffer
  return cachedToken!;
}

// ── Junk track filter ─────────────────────────────────────────────────────────
const JUNK_PATTERNS = /\b(karaoke|tribute|cover|instrumental|backing track|made famous)\b/i;

function isJunkTrack(track: SpotifyTrack): boolean {
  if (JUNK_PATTERNS.test(track.name)) return true;
  if (JUNK_PATTERNS.test(track.artists[0]?.name ?? '')) return true;
  if (track.duration_ms < 45_000) return true;
  return false;
}

// ── Normalize a Spotify track into our internal Song format ──────────────────
export function normalizeTrack(track: SpotifyTrack, genre = ''): Song {
  return {
    id: track.id,
    title: track.name,
    artist: track.artists.map((a) => a.name).join(', '),
    genre,
    preview_url: track.preview_url,
    album_image: track.album.images[0]?.url ?? '',
    duration_ms: track.duration_ms,
    external_url: track.external_urls.spotify,
  };
}

// ── Dedup fingerprint ─────────────────────────────────────────────────────────
// Strips version/edition markers so "Holocene", "Holocene (Radio Edit)",
// "Holocene - Remastered 2023", and "Holocene [Live]" all hash the same.
export function trackFingerprint(song: Song): string {
  const normalizeTitle = (s: string) =>
    s.toLowerCase()
      .replace(/\[.*?\]/g, '')   // strip [Remastered 2011], [Live], [Explicit]
      .replace(/\(.*?\)/g, '')   // strip (feat. X), (Radio Edit), (Live Version)
      // strip " - <version word> ..." dash suffixes
      .replace(/\s*-\s*(feat|ft|featuring|radio|remaster|remastered|live|acoustic|remix|version|edit|single|bonus|extended|instrumental|reprise|demo|mix|interlude|intro|outro|original|deluxe|anniversary|mono|stereo|session|cut|take)\b.*/i, '')
      .replace(/\s+fe?a?t\.?\s.*/i, '')  // "Song feat. Artist" without parens
      .replace(/[^a-z0-9]/g, '')
      .trim();

  // Use only the primary artist (first listed) so "Artist, Feat. X" and "Artist" match
  const primaryArtist = song.artist.split(',')[0];
  const normalizeArtist = (s: string) =>
    s.toLowerCase().replace(/[^a-z0-9]/g, '').trim();

  return `${normalizeArtist(primaryArtist)}|${normalizeTitle(song.title)}`;
}

// ── Search tracks by query ────────────────────────────────────────────────────
export async function searchTracks(query: string, limit = 5): Promise<SpotifyTrack[]> {
  const token = await getToken();
  const url = new URL(`${BASE}/search`);
  url.searchParams.set('q', query);
  url.searchParams.set('type', 'track');
  url.searchParams.set('limit', String(limit));

  const res = await fetch(url.toString(), {
    headers: { Authorization: `Bearer ${token}` },
    cache: 'no-store',
  });
  if (!res.ok) throw new Error(`Spotify search failed: ${res.status}`);

  const data: SpotifySearchResponse = await res.json();
  return data.tracks?.items ?? [];
}

// ── Artist lookup helpers ─────────────────────────────────────────────────────
async function findArtistId(name: string): Promise<string | null> {
  try {
    const token = await getToken();
    const url = new URL(`${BASE}/search`);
    url.searchParams.set('q', name);
    url.searchParams.set('type', 'artist');
    url.searchParams.set('limit', '3');
    const res = await fetch(url.toString(), {
      headers: { Authorization: `Bearer ${token}` },
      cache: 'no-store',
    });
    if (!res.ok) return null;
    const data: SpotifyArtistSearchResponse = await res.json();
    return data.artists?.items?.[0]?.id ?? null;
  } catch { return null; }
}

async function getArtistTopTracks(artistId: string, limit: number): Promise<SpotifyTrack[]> {
  try {
    const token = await getToken();
    const url = new URL(`${BASE}/artists/${artistId}/top-tracks`);
    url.searchParams.set('market', 'US');
    const res = await fetch(url.toString(), {
      headers: { Authorization: `Bearer ${token}` },
      cache: 'no-store',
    });
    if (!res.ok) return [];
    const data: SpotifyTopTracksResponse = await res.json();
    return (data.tracks ?? []).slice(0, limit);
  } catch { return []; }
}

// ── Extract unique artist names from field-syntax queries ────────────────────
function extractArtistNames(queries: SearchIntent[]): string[] {
  const pattern = /artist:"([^"]+)"/i;
  const seen = new Set<string>();
  const names: string[] = [];
  for (const { query } of queries) {
    const match = pattern.exec(query);
    if (match) {
      const name = match[1].trim();
      if (name && !seen.has(name.toLowerCase())) {
        seen.add(name.toLowerCase());
        names.push(name);
      }
    }
  }
  return names;
}

// ── Detect if one artist dominates the query set ─────────────────────────────
function detectDominantArtist(queries: SearchIntent[]): string | null {
  const pattern = /artist:"([^"]+)"/i;
  const counts = new Map<string, number>();
  for (const { query } of queries) {
    const match = pattern.exec(query);
    if (match) {
      const key = match[1].trim().toLowerCase();
      counts.set(key, (counts.get(key) ?? 0) + 1);
    }
  }
  let dominant: string | null = null;
  let maxCount = 0;
  for (const [name, count] of counts) {
    if (count > maxCount) { maxCount = count; dominant = name; }
  }
  if (dominant && (maxCount >= 3 || maxCount / queries.length > 0.4)) return dominant;
  return null;
}

// ── Run multiple searches in parallel, deduplicate ───────────────────────────
export async function searchMany(queries: SearchIntent[], perQuery = 4): Promise<Song[]> {
  // Validate token up-front so auth errors surface immediately
  await getToken();
  const queryResultsPromise = Promise.allSettled(
    queries.map(({ query, genre }) =>
      searchTracks(query, perQuery).then((tracks) =>
        tracks.filter((t) => !isJunkTrack(t)).map((t) => normalizeTrack(t, genre))
      )
    )
  );

  const artistNames = extractArtistNames(queries);
  const artistResultsPromise = Promise.allSettled(
    artistNames.map((name) =>
      findArtistId(name).then((id) =>
        id !== null
          ? getArtistTopTracks(id, 10).then((tracks) =>
              tracks.filter((t) => !isJunkTrack(t)).map((t) => normalizeTrack(t, ''))
            )
          : []
      )
    )
  );

  const [queryResults, artistResults] = await Promise.all([
    queryResultsPromise,
    artistResultsPromise,
  ]);

  const seenIds = new Set<string>();
  const seenFingerprints = new Set<string>();
  const artistCount = new Map<string, number>();
  const MAX_PER_ARTIST = 2;
  const dominantArtist = detectDominantArtist(queries);

  const songs: Song[] = [];

  for (const result of [...queryResults, ...artistResults]) {
    if (result.status === 'fulfilled') {
      for (const song of result.value) {
        if (seenIds.has(song.id)) continue;
        const fp = trackFingerprint(song);
        if (seenFingerprints.has(fp)) continue;
        const artistKey = song.artist.toLowerCase();
        const cap = dominantArtist && artistKey === dominantArtist ? Infinity : MAX_PER_ARTIST;
        if ((artistCount.get(artistKey) ?? 0) >= cap) continue;

        seenIds.add(song.id);
        seenFingerprints.add(fp);
        artistCount.set(artistKey, (artistCount.get(artistKey) ?? 0) + 1);
        songs.push(song);
      }
    }
  }
  return songs;
}
