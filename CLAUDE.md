# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
npm run dev      # start dev server on localhost:3000
npm run build    # production build
npm run lint     # ESLint check
```

No test suite is configured.

## Environment variables

Copy `.env.example` to `.env.local` and fill in:

```
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
OPENAI_API_KEY=
SPOTIFY_CLIENT_ID=
SPOTIFY_CLIENT_SECRET=
```

Spotify credentials use the **Client Credentials** flow (server-to-server, no user OAuth). The account that owns the Spotify app needs **Spotify Premium** for Web API search to work.

## Architecture

VibeFlow is a mood-driven AI playlist generator. The user describes a vibe in plain text; OpenAI translates that into Spotify search intents; Spotify returns real tracks; the result is saved as a versioned snapshot in Supabase.

**Request flow for playlist generation:**
1. `POST /api/generate-playlist` — receives `{ mood, userId }`
2. Calls `gpt-4o-mini` with structured JSON output to get 10–12 `SearchIntent[]` objects (a mix of specific `artist:"X" track:"Y"` queries and free-text style queries)
3. Calls `lib/spotify.ts → searchMany()` which fans out to Spotify in parallel, deduplicates by ID and by a normalized fingerprint (strips remaster/live/radio-edit suffixes), and caps at 14 tracks with a 2-per-artist limit
4. Inserts a `playlists` row and a `playlist_versions` row (storing the full `{ mood, songs[] }` snapshot as JSONB) in Supabase
5. Returns `{ playlist, version }` to the client

**Transform flow** (`POST /api/transform-playlist`) is similar: OpenAI receives the current song list and the user instruction and returns `{ keep_ids, new_searches, mood, note }`. Kept songs are merged with fresh Spotify results, deduplicated, capped at 14, and saved as a new version. The client never mutates versions — every change creates a new row.

**Revert** is purely client-side: `handleRevert` in `app/page.tsx` just swaps the active version's `playlist_json` into state; no API call needed.

**Shareable URLs** — `/playlist/[versionId]` is a public server-rendered page. It requires a Supabase RLS policy allowing public `SELECT` on `playlist_versions`:
```sql
CREATE POLICY "public_read_playlist_versions" ON playlist_versions FOR SELECT USING (true);
```

## State management

All state lives in `app/page.tsx` via `useState`. Supabase is the source of truth; the client re-fetches on auth state change and passes data down as props. There is no global state store (no Zustand, no Context). The Spotify embed player `activeSongId` is lifted to `page.tsx` so it persists across mobile tab switches.

Search history is the only piece of state stored in `localStorage` (key: `vf_search_history`).

## Key data types (`types/index.ts`)

- `Song` — Spotify track ID + title/artist/genre/album_image/duration_ms/external_url
- `PlaylistVersion` — wraps `playlist_json: { mood: string; songs: Song[] }` with version_number
- `SearchIntent` — `{ query, genre }` — the AI's output before hitting Spotify
- `SavedPlaylist` — bookmark joining a user to a specific `playlist_versions` row

## Supabase schema

```sql
playlists           — user_id, current_version (int)
playlist_versions   — playlist_id, version_number, playlist_json (jsonb), user_id
chat_messages       — playlist_id, user_id, role, content
saved_playlists     — user_id, playlist_version_id, name
```

Auth uses Supabase Email/Password. API routes create their own `createClient()` directly with env vars; the browser client is the singleton from `lib/supabase.ts`.

## Next.js version note

This repo runs **Next.js 16** (App Router). APIs and conventions may differ from your training data — read `node_modules/next/dist/docs/` before writing any Next.js-specific code and heed deprecation notices.
