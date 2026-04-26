# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

@AGENTS.md

## Commands

```bash
npm run dev      # start dev server at localhost:3000
npm run build    # production build (also type-checks)
npm run lint     # ESLint
```

No test suite exists.

## Environment Variables

Copy `.env.example` → `.env.local` and fill in:

- `NEXT_PUBLIC_SUPABASE_URL` / `NEXT_PUBLIC_SUPABASE_ANON_KEY` — Supabase project
- `OPENAI_API_KEY` — used server-side only in API routes
- `SPOTIFY_CLIENT_ID` / `SPOTIFY_CLIENT_SECRET` — Client Credentials flow (no user login)

## Architecture

**Stack:** Next.js 16 (App Router), React 19, TypeScript, Tailwind CSS v4, Supabase (Postgres + Auth), OpenAI `gpt-4o-mini`, Spotify Web API.

**Auth model:** Supabase email/password auth. Users must be logged in to use the app. All data is scoped to `user_id` (the Supabase `auth.users.id`). Auth state is tracked via `supabase.auth.onAuthStateChange` in the root `useEffect` — it fires `INITIAL_SESSION` on load, `SIGNED_IN` on login, and `SIGNED_OUT` on logout. No localStorage session identity.

### Data flow

```
User logs in → onAuthStateChange(SIGNED_IN) → restoreSession(user.id)
  → fetch most recent playlist + versions + chat history + saved bookmarks
  → hydrate all page state

User types mood
  → POST /api/generate-playlist  { mood, userId }
      → OpenAI: mood → 10–12 Spotify search intents (JSON); mood field is a 3-5 word vibe label
      → lib/spotify.ts searchMany(): parallel Spotify searches (6 results/query) + artist top-track lookups
      → dedup by ID and normalized fingerprint (strips remasters/live/radio edits)
      → if result < 10 tracks: fallback OpenAI call for broader style queries, results merged + deduped
      → cap at 14 tracks, save to Supabase (playlists + playlist_versions)
  → UI: songs + version appear in PlaylistPanel

User sends chat instruction
  → POST /api/transform-playlist  { playlistId, userId, instruction, currentPlaylist }
      → OpenAI: keep_ids + new_searches (JSON)
      → searchMany() for new tracks, dedup against kept songs
      → save new playlist_version + chat_messages rows
  → UI: diff-highlighted new songs flash for 1.8s, new version appended
```

### Supabase schema (4 tables)

All tables have `user_id uuid references auth.users(id) on delete cascade`.

- `playlists` — one row per user's active playlist; tracks `current_version`
- `playlist_versions` — immutable snapshots; `playlist_json: {mood, songs[]}` (JSONB)
- `chat_messages` — full conversation history per playlist
- `saved_playlists` — bookmarks linking `user_id` → `playlist_version_id`

Manage users via Supabase dashboard → Authentication → Users, or `select id, email, created_at from auth.users` in the SQL editor.

### State management

All state lives in `app/page.tsx` via `useState`. No global store. On `SIGNED_OUT`, `clearPlaylistState()` resets all playlist/chat/version state. On `SIGNED_IN`/`INITIAL_SESSION`, `restoreSession(userId)` rehydrates from Supabase.

`activeSongId: string | null` tracks the currently open Spotify embed player. It lives in `page.tsx` (not `PlaylistPanel`) so the iframe persists when the user switches mobile tabs — the embed is rendered outside the tab-conditional blocks, above the tab bar on mobile and at the bottom of the left aside on desktop. Reset explicitly in `handleGenerate`, `handleNewPlaylist`, and `clearPlaylistState`; intentionally NOT reset on chat transforms or version reverts so playback continues while the user refines. Do not use a `useEffect([songs])` to reset it — Supabase re-fires auth events on tab focus which calls `restoreSession` → `setSongs`, and that would kill the player.

### Key files

- `app/page.tsx` — all page state and event handlers; renders 3-panel desktop / tab-based mobile layout; gates UI on auth state
- `app/api/generate-playlist/route.ts` — mood → OpenAI → Spotify → Supabase (creates playlist + v1)
- `app/api/transform-playlist/route.ts` — chat instruction → OpenAI → Spotify → Supabase (new version)
- `app/api/saved-playlists/route.ts` — GET/POST bookmarks
- `app/api/saved-playlists/[id]/route.ts` — DELETE bookmark
- `lib/auth.ts` — thin wrappers: `signUp`, `signIn`, `signOut`, `getCurrentUser`
- `lib/supabase.ts` — single browser Supabase client (shared by page + auth helpers)
- `lib/spotify.ts` — Spotify Client Credentials token cache, `searchTracks`, `searchMany`, `trackFingerprint`
- `components/AuthModal.tsx` — email/password modal with login/signup tabs
- `types/index.ts` — `Song`, `Playlist`, `PlaylistVersion`, `ChatMessage`, `SearchIntent`, `SavedPlaylist`

### API route conventions

API routes instantiate their own `supabase` and `openai` clients at module level (not shared with `lib/supabase.ts`). They receive `userId` in the request body and store it in the `user_id` column. Dynamic route params are `Promise`-typed in Next.js 16 — always `await params` before destructuring.

### Spotify dedup logic

`trackFingerprint` in `lib/spotify.ts` normalizes title + primary artist to catch radio edits, remasters, and live versions. `searchMany` enforces a `MAX_PER_ARTIST = 2` cap (lifted to ∞ for a dominant artist) — the cap key uses the primary artist only (first comma-split), consistent with `trackFingerprint`. A dominant artist is one appearing in ≥3 queries or >40% of the query set.
