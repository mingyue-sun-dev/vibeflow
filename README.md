# VibeFlow

Tell it how you feel. Get a playlist. Make it yours.

---

VibeFlow is a mood-driven playlist generator. Type something like *"3am can't sleep, thoughts too loud"* or *"Sunday morning, slow coffee, no plans"* — and it builds a real playlist from Spotify around that exact feeling. Then you shape it through conversation.

---

## how it works

You describe a vibe. OpenAI reads the room and generates a mix of specific song picks and mood-based search queries. Those hit the Spotify API in parallel — real tracks, no hallucinated playlists. The results get deduplicated, filtered for quality, and capped at 14 tracks.

From there it's yours. Chat with it directly:

> *"make it more melancholy"*
> *"drop the upbeat ones"*
> *"add more Radiohead"*

Every change creates a new version. Don't like where it went? Revert. Save the ones you love. Everything persists across devices — log in from anywhere and your playlists are there.

---

## stack

- **Next.js 16** (App Router) — pages, API routes, all of it
- **OpenAI** — mood → search intent translation
- **Spotify Web API** — track search, artist top tracks
- **Supabase** — auth (email/password), playlist versions, chat history, saved bookmarks
- **Tailwind CSS** — dark zinc theme, fully responsive

---

## getting started

**1. clone and install**

```bash
git clone https://github.com/yourname/vibeflow
cd vibeflow
npm install
```

**2. set up environment variables**

```bash
cp .env.example .env.local
```

fill in `.env.local`:

```
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
OPENAI_API_KEY=
SPOTIFY_CLIENT_ID=
SPOTIFY_CLIENT_SECRET=
```

**3. spotify setup**

- create an app at [developer.spotify.com](https://developer.spotify.com/dashboard)
- the account that owns the app needs **Spotify Premium** (required for Web API search)
- copy the client ID and secret into `.env.local`

**4. supabase setup**

create a project at [supabase.com](https://supabase.com), enable **Email/Password** auth under Authentication → Providers, then run this in the SQL editor:

```sql
create table playlists (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  current_version int not null default 1,
  created_at timestamptz default now()
);

create table playlist_versions (
  id uuid primary key default gen_random_uuid(),
  playlist_id uuid references playlists(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  version_number int not null,
  playlist_json jsonb not null,
  created_at timestamptz default now()
);

create table chat_messages (
  id uuid primary key default gen_random_uuid(),
  playlist_id uuid references playlists(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  role text not null,
  content text not null,
  created_at timestamptz default now()
);

create table saved_playlists (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  playlist_version_id uuid references playlist_versions(id) on delete cascade,
  name text not null,
  created_at timestamptz default now()
);
```

**5. run it**

```bash
npm run dev
```

open [localhost:3000](http://localhost:3000).

---

## features

- **mood-to-playlist** — describe anything, get a curated tracklist
- **chat refinement** — conversational edits that actually understand intent
- **version history** — every change is saved, revert anytime
- **saved bookmarks** — pin the versions worth keeping
- **in-app player** — click any track to open the Spotify embed player inline; persists while you chat or switch tabs
- **open in Spotify** — one click from any track to open it in Spotify
- **cross-device persistence** — log in from anywhere, your playlists follow
- **search history** — recent moods in a dropdown, one click to reuse
- **responsive** — full three-panel desktop layout, tab-based mobile layout
- **duplicate filtering** — fingerprint dedup catches radio edits, remasters, live versions

---

## project structure

```
/app
  /api
    /generate-playlist   — mood → OpenAI → Spotify → save to Supabase
    /transform-playlist  — chat instruction → OpenAI → Spotify → new version
    /saved-playlists     — bookmark CRUD
/components
  PlaylistPanel          — song list + version history
  ChatPanel              — message thread + input
  ControlPanel           — quick action buttons
  PlaylistItem           — single track row with preview + Spotify link
  SavedPlaylists         — bookmark list + save button
  VersionHistory         — version timeline
  AuthModal              — email/password login + signup modal
/lib
  auth.ts                — signUp, signIn, signOut, getCurrentUser helpers
  spotify.ts             — token auth, search, artist lookup, dedup logic
  supabase.ts            — Supabase browser client
/types
  index.ts               — Song, Playlist, PlaylistVersion, ChatMessage, etc.
  spotify.ts             — raw Spotify API response shapes
```

---

*built for the vibe. not for scale.*
