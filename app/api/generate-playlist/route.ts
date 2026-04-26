import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import OpenAI from 'openai';
import { searchMany } from '@/lib/spotify';
import { SearchIntent } from '@/types';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

export async function POST(req: NextRequest) {
  const { mood, sessionId } = await req.json();

  if (!mood?.trim() || !sessionId) {
    return NextResponse.json({ error: 'mood and sessionId are required' }, { status: 400 });
  }

  // 1. Ask OpenAI for specific Spotify search intents based on the mood
  const completion = await openai.chat.completions.create({
    model: 'gpt-4o-mini',
    temperature: 0.5,
    response_format: { type: 'json_object' },
    messages: [
      {
        role: 'system',
        content: `You are a music curator. Given a user mood, generate 10–12 Deezer search queries to find real songs matching that mood.

RULES:
- Return ONLY valid JSON: {"mood": "string", "searches": [{"query": "string", "genre": "string"}]}
- Mix two query types:
    TYPE A — Specific song: use Deezer field syntax → artist:"Bon Iver" track:"Holocene"
    TYPE B — Style/mood search: descriptive keywords only → rainy lo-fi piano beats study
- Use ~6 Type A queries (known songs that fit) and ~4–6 Type B queries (style/mood/genre descriptors)
- "genre" is a short UI label (e.g. "Indie Folk", "Lo-Fi", "Alt Pop")
- Do NOT mix artist names into style queries (keep them separate)
- Match the emotional tone, energy level, and aesthetic of the mood precisely
- No commentary outside the JSON`,
      },
      {
        role: 'user',
        content: `Mood: "${mood}"`,
      },
    ],
  });

  let aiOutput: { mood: string; searches: SearchIntent[] };
  try {
    aiOutput = JSON.parse(completion.choices[0].message.content!);
  } catch {
    return NextResponse.json({ error: 'Failed to parse AI response' }, { status: 500 });
  }

  // 2. Search Spotify for each intent in parallel
  let songs;
  try {
    songs = await searchMany(aiOutput.searches, 5);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: `Spotify error: ${msg}` }, { status: 500 });
  }

  if (songs.length === 0) {
    return NextResponse.json({ error: 'No tracks found for this mood. Try rephrasing.' }, { status: 404 });
  }

  const playlistData = {
    mood: aiOutput.mood,
    songs: songs.slice(0, 14), // cap at 14 tracks
  };

  // 3. Create playlist record in Supabase
  const { data: playlist, error: playlistError } = await supabase
    .from('playlists')
    .insert({ session_id: sessionId, current_version: 1 })
    .select()
    .single();

  if (playlistError) {
    return NextResponse.json({ error: playlistError.message }, { status: 500 });
  }

  // 4. Save version 1 snapshot
  const { data: version, error: versionError } = await supabase
    .from('playlist_versions')
    .insert({
      playlist_id: playlist.id,
      version_number: 1,
      playlist_json: playlistData,
      session_id: sessionId,
    })
    .select()
    .single();

  if (versionError) {
    return NextResponse.json({ error: versionError.message }, { status: 500 });
  }

  return NextResponse.json({ playlist, version });
}
