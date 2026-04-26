// Raw Spotify API response types (Client Credentials auth)

export interface SpotifyImage {
  url: string;
  height: number | null;
  width: number | null;
}

export interface SpotifyArtistRef {
  id: string;
  name: string;
  external_urls: { spotify: string };
}

export interface SpotifyAlbum {
  id: string;
  name: string;
  images: SpotifyImage[];
  external_urls: { spotify: string };
}

export interface SpotifyTrack {
  id: string;
  name: string;
  duration_ms: number;
  preview_url: string | null;
  explicit: boolean;
  external_urls: { spotify: string };
  artists: SpotifyArtistRef[];
  album: SpotifyAlbum;
}

export interface SpotifySearchResponse {
  tracks: {
    items: SpotifyTrack[];
    total: number;
    next: string | null;
  };
}

export interface SpotifyArtistFull {
  id: string;
  name: string;
  images: SpotifyImage[];
  popularity: number;
  external_urls: { spotify: string };
}

export interface SpotifyArtistSearchResponse {
  artists: {
    items: SpotifyArtistFull[];
    total: number;
  };
}

export interface SpotifyTopTracksResponse {
  tracks: SpotifyTrack[];
}
