'use client';

import { Song, PlaylistVersion } from '@/types';
import { PlaylistItem } from './PlaylistItem';
import { VersionHistory } from './VersionHistory';

interface PlaylistPanelProps {
  songs: Song[];
  mood: string;
  currentVersion: number;
  versions: PlaylistVersion[];
  newSongIds: Set<string>;
  isTransforming: boolean;
  onRevert: (version: PlaylistVersion) => void;
  activeSongId: string | null;
  onSongSelect: (id: string) => void;
}

export function PlaylistPanel({
  songs,
  mood,
  currentVersion,
  versions,
  newSongIds,
  isTransforming,
  onRevert,
  activeSongId,
  onSongSelect,
}: PlaylistPanelProps) {
  if (songs.length === 0) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center gap-2 text-center px-6">
        <p className="text-zinc-600 text-sm">No playlist yet</p>
        <p className="text-zinc-700 text-xs">Generate a playlist to get started.</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full overflow-hidden">
      {/* Mood + version label */}
      <div className="px-4 py-2.5 border-b border-zinc-800 shrink-0">
        <p className="text-xs text-zinc-500 truncate">
          <span className="text-zinc-400 font-medium">v{currentVersion}</span>
          {' · '}
          <span className="italic">{mood}</span>
        </p>
      </div>

      {/* Song list — dims while AI is transforming */}
      <div
        className={`flex-1 overflow-y-auto transition-opacity duration-300 ${
          isTransforming ? 'opacity-40 pointer-events-none' : 'opacity-100'
        }`}
      >
        {songs.map((song, i) => (
          <PlaylistItem
            key={song.id}
            song={song}
            index={i}
            isNew={newSongIds.has(song.id)}
            isActive={activeSongId === song.id}
            onSelect={onSongSelect}
          />
        ))}
      </div>

      {/* Version history */}
      <VersionHistory
        versions={versions}
        currentVersion={currentVersion}
        onRevert={onRevert}
      />
    </div>
  );
}
