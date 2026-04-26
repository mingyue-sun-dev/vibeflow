import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import OpenAI from 'openai';
import { searchMany, trackFingerprint } from '@/lib/spotify';
import { Song, SearchIntent } from '@/types';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

export async function POST(req: NextRequest) {
  const { playlistId, userId, instruction, currentPlaylist } = await req.json();

  if (!playlistId || !userId || !instruction?.trim() || !currentPlaylist) {
    return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
  }

  // 1. Save user message
  await supabase.from('chat_messages').insert({
    playlist_id: playlistId,
    user_id: userId,
    role: 'user',
    content: instruction,
  });

  const currentSongs: Song[] = currentPlaylist.songs ?? [];

  // 2. Ask OpenAI which songs to keep and what new searches to run
  const songSummary = currentSongs.map((s) => ({
    id: s.id,
    title: s.title,
    artist: s.artist,
    genre: s.genre,
  }));

  const completion = await openai.chat.completions.create({
    model: 'gpt-4o-mini',
    temperature: 0.7,
    response_format: { type: 'json_object' },
    messages: [
      {
        role: 'system',
        content: `You are a music curator. Given the current playlist and a user instruction, decide which songs to keep and what new Spotify searches to run.

RULES:
- Return ONLY valid JSON:
  {
    "mood": "updated 3-5 word vibe label",
    "note": "one sentence describing what changed",
    "keep_ids": ["track_id1", "track_id2"],
    "new_searches": [{"query": "specific spotify search", "genre": "genre label"}]
  }
- "keep_ids": track IDs from the current playlist to preserve (preserve the good fits)
- "new_searches": 0–8 Spotify search queries for new/replacement tracks
    TYPE A — artist:"Name" track:"Title"   for specific known songs
    TYPE B — descriptive keywords only     for style/mood searches
- CRITICAL: keep_ids.length + expected new results must stay within 8–14 tracks total
  - If adding new songs, DROP enough existing keep_ids to leave room (aim for keep_ids ≤ 8 when doing large adds)
  - If user says "add X songs", remove 4–6 existing tracks from keep_ids to make space for the additions
- If user wants more of a specific artist, generate 6–8 TYPE A queries for that artist using different songs/albums AND drop 5–6 existing tracks from keep_ids
- Apply instruction thoughtfully:
  - "add [artist] songs" → drop 5-6 existing tracks from keep_ids, generate 6-8 TYPE A queries for that artist
  - "more calm" → keep calm/acoustic tracks, drop high-energy, search for ambient/acoustic/soft
  - "more energy" → keep upbeat tracks, drop slow ones, search for energetic/upbeat/danceable
  - "remove sad songs" → drop sad tracks from keep_ids, no new searches needed
  - "only upbeat" → only keep happy/fun tracks, search for upbeat/fun music
  - "more variety" → keep a spread, search for underrepresented genres
- Make new_searches specific and real (artist names, song styles, descriptors)
- No commentary outside JSON`,
      },
      {
        role: 'user',
        content: `Current playlist (mood: "${currentPlaylist.mood}"):\n${JSON.stringify(songSummary, null, 2)}\n\nInstruction: "${instruction}"`,
      },
    ],
  });

  let aiOutput: {
    mood: string;
    note: string;
    keep_ids: string[];
    new_searches: SearchIntent[];
  };
  try {
    aiOutput = JSON.parse(completion.choices[0].message.content!);
  } catch {
    return NextResponse.json({ error: 'Failed to parse AI response' }, { status: 500 });
  }

  // 3. Keep songs the AI selected + search Spotify for new ones in parallel
  const keepSet = new Set(aiOutput.keep_ids ?? []);
  const keptSongs = currentSongs.filter((s) => keepSet.has(s.id));

  const newSongs =
    aiOutput.new_searches?.length > 0
      ? await searchMany(aiOutput.new_searches, 6)
      : [];

  // Deduplicate new songs against kept songs (by ID and by normalized title+artist)
  const keptIds = new Set(keptSongs.map((s) => s.id));
  const keptFingerprints = new Set(keptSongs.map(trackFingerprint));
  const dedupedNew = newSongs.filter(
    (s) => !keptIds.has(s.id) && !keptFingerprints.has(trackFingerprint(s))
  );

  // Safety net: if the AI over-kept and new songs would be sliced off, trim kept songs to make room
  const slotsForNew = Math.min(dedupedNew.length, 6);
  const cappedKept =
    dedupedNew.length > 0 && keptSongs.length >= 14
      ? keptSongs.slice(0, Math.max(8, 14 - slotsForNew))
      : keptSongs;
  const finalSongs = [...cappedKept, ...dedupedNew].slice(0, 14);
  const assistantContent =
    aiOutput.note || `Updated playlist: ${finalSongs.length} tracks for "${aiOutput.mood}"`;

  const playlistJson = { mood: aiOutput.mood, songs: finalSongs };

  // 4. Increment version
  const { data: lastVersion } = await supabase
    .from('playlist_versions')
    .select('version_number')
    .eq('playlist_id', playlistId)
    .order('version_number', { ascending: false })
    .limit(1)
    .single();

  const nextVersionNumber = (lastVersion?.version_number ?? 0) + 1;

  // 5. Save new version snapshot
  const { data: version, error: versionError } = await supabase
    .from('playlist_versions')
    .insert({
      playlist_id: playlistId,
      user_id: userId,
      version_number: nextVersionNumber,
      playlist_json: playlistJson,
    })
    .select()
    .single();

  if (versionError) {
    return NextResponse.json({ error: versionError.message }, { status: 500 });
  }

  // 6. Update playlist current_version + save assistant message
  await Promise.all([
    supabase
      .from('playlists')
      .update({ current_version: nextVersionNumber })
      .eq('id', playlistId),
    supabase.from('chat_messages').insert({
      playlist_id: playlistId,
      user_id: userId,
      role: 'assistant',
      content: assistantContent,
    }),
  ]);

  return NextResponse.json({ version, assistantContent });
}
