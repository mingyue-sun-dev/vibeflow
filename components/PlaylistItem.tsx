'use client';

import { motion } from 'framer-motion';
import { Song } from '@/types';

interface PlaylistItemProps {
  song: Song;
  index: number;
  isNew?: boolean;
  isActive?: boolean;
  isFocused?: boolean;
  onSelect?: (id: string) => void;
}

function formatDuration(ms: number): string {
  const total = Math.floor(ms / 1000);
  const m = Math.floor(total / 60);
  const s = total % 60;
  return `${m}:${s.toString().padStart(2, '0')}`;
}

function SpotifyIcon() {
  return (
    <svg className="w-3 h-3" viewBox="0 0 24 24" fill="currentColor">
      <path d="M12 0C5.4 0 0 5.4 0 12s5.4 12 12 12 12-5.4 12-12S18.66 0 12 0zm5.521 17.34c-.24.359-.66.48-1.021.24-2.82-1.74-6.36-2.101-10.561-1.141-.418.122-.779-.179-.899-.539-.12-.421.18-.78.54-.9 4.56-1.021 8.52-.6 11.64 1.32.42.18.479.659.301 1.02zm1.44-3.3c-.301.42-.841.6-1.262.3-3.239-1.98-8.159-2.58-11.939-1.38-.479.12-1.02-.12-1.14-.6-.12-.48.12-1.021.6-1.141C9.6 9.9 15 10.561 18.72 12.84c.361.181.54.78.241 1.2zm.12-3.36C15.24 8.4 8.82 8.16 5.16 9.301c-.6.179-1.2-.181-1.38-.721-.18-.601.18-1.2.72-1.381 4.26-1.26 11.28-1.02 15.721 1.621.539.3.719 1.02.419 1.56-.299.421-1.02.599-1.559.3z"/>
    </svg>
  );
}

export function PlaylistItem({ song, index, isNew = false, isActive = false, isFocused = false, onSelect }: PlaylistItemProps) {
  return (
    <motion.div
      role="option"
      aria-selected={isActive}
      aria-label={`${song.title} by ${song.artist}${isActive ? ', playing' : ''}`}
      layout
      initial={isNew ? { opacity: 0, x: -12, y: 0 } : { opacity: 0, x: 0, y: 10 }}
      animate={{ opacity: 1, x: 0, y: 0 }}
      exit={{ opacity: 0, x: -16, transition: { duration: 0.15 } }}
      transition={{ duration: 0.25, delay: isNew ? 0 : index * 0.035, ease: 'easeOut' }}
      onClick={() => onSelect?.(song.id)}
      className={`group flex items-center gap-3 px-4 py-2 transition-colors cursor-pointer ${
        isActive ? 'bg-zinc-800' : 'hover:bg-zinc-800/50'
      } ${isFocused && !isActive ? 'ring-1 ring-inset ring-zinc-600' : ''} ${isNew ? 'song-new' : ''}`}
    >
      {/* Index / playing indicator */}
      <div className="w-4 shrink-0 flex items-center justify-center" aria-hidden="true">
        {isActive ? (
          <span className="flex items-end gap-px h-3">
            <span className="w-px bg-zinc-400 animate-bounce" style={{ height: '60%', animationDelay: '0ms', animationDuration: '0.8s' }} />
            <span className="w-px bg-zinc-400 animate-bounce" style={{ height: '100%', animationDelay: '150ms', animationDuration: '0.8s' }} />
            <span className="w-px bg-zinc-400 animate-bounce" style={{ height: '40%', animationDelay: '300ms', animationDuration: '0.8s' }} />
          </span>
        ) : (
          <span className="text-xs text-zinc-700 tabular-nums">{index + 1}</span>
        )}
      </div>

      {/* Album image */}
      <div className="w-8 h-8 rounded bg-zinc-800 shrink-0 overflow-hidden">
        {song.album_image ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={song.album_image} alt="" className="w-full h-full object-cover" />
        ) : (
          <div className="w-full h-full bg-zinc-800" />
        )}
      </div>

      {/* Title + artist */}
      <div className="min-w-0 flex-1" aria-hidden="true">
        <p className="text-sm font-medium truncate leading-snug">{song.title}</p>
        <p className="text-xs text-zinc-500 truncate">{song.artist}</p>
      </div>

      {/* Duration + Spotify link */}
      <div className="shrink-0 flex items-center gap-1.5">
        <span className="text-xs text-zinc-700 tabular-nums font-mono" aria-hidden="true">
          {song.duration_ms ? formatDuration(song.duration_ms) : '—'}
        </span>
        {song.external_url && (
          <a
            href={song.external_url}
            target="_blank"
            rel="noopener noreferrer"
            aria-label={`Open "${song.title}" in Spotify`}
            onClick={e => e.stopPropagation()}
            className={`transition-opacity text-zinc-600 hover:text-zinc-300 ${
              isFocused ? 'opacity-100' : 'opacity-0 group-hover:opacity-100 focus-visible:opacity-100'
            }`}
          >
            <SpotifyIcon />
          </a>
        )}
      </div>
    </motion.div>
  );
}
