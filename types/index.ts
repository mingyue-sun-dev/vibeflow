export interface Song {
  id: string;                  // Spotify track ID
  title: string;
  artist: string;
  genre: string;               // derived from AI search intent
  preview_url: string | null;  // 30s preview clip (null for some tracks)
  album_image: string;
  duration_ms: number;
  external_url: string;        // open.spotify.com link
}

export interface PlaylistVersion {
  id: string;
  playlist_id: string;
  version_number: number;
  playlist_json: {
    mood: string;
    songs: Song[];
  };
  created_at: string;
}

export interface Playlist {
  id: string;
  created_at: string;
  current_version: number;
  session_id: string;
}

export interface ChatMessage {
  id: string;
  playlist_id: string;
  role: 'user' | 'assistant';
  content: string;
  created_at?: string;
  session_id: string;
}

// AI output format — search intents that map to Spotify queries
export interface SearchIntent {
  query: string;   // e.g. "calm piano indie"
  genre: string;   // e.g. "Indie Folk"
}

export interface SavedPlaylist {
  id: string;
  session_id: string;
  playlist_version_id: string;
  name: string;
  created_at: string;
  // joined from playlist_versions
  playlist_versions: {
    playlist_json: {
      mood: string;
      songs: Song[];
    };
  } | null;
}
