import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

// GET /api/saved-playlists?userId=...
export async function GET(req: NextRequest) {
  const userId = req.nextUrl.searchParams.get('userId');
  if (!userId) {
    return NextResponse.json({ error: 'userId required' }, { status: 400 });
  }

  const { data, error } = await supabase
    .from('saved_playlists')
    .select('*, playlist_versions(playlist_json)')
    .eq('user_id', userId)
    .order('created_at', { ascending: false });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ saved: data });
}

// POST /api/saved-playlists
export async function POST(req: NextRequest) {
  const { userId, playlistVersionId, name } = await req.json();

  if (!userId || !playlistVersionId || !name?.trim()) {
    return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
  }

  const { data, error } = await supabase
    .from('saved_playlists')
    .insert({
      user_id: userId,
      playlist_version_id: playlistVersionId,
      name: name.trim(),
    })
    .select('*, playlist_versions(playlist_json)')
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ saved: data });
}
