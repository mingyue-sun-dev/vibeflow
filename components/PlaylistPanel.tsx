'use client';

import { useState, useRef, useEffect } from 'react';
import { AnimatePresence } from 'framer-motion';
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
  versionId?: string | null;
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
  versionId,
}: PlaylistPanelProps) {
  const [copied, setCopied] = useState(false);
  const [focusedIndex, setFocusedIndex] = useState(0);
  const [listHasFocus, setListHasFocus] = useState(false);
  const listRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (activeSongId) {
      const i = songs.findIndex(s => s.id === activeSongId);
      if (i >= 0) { setFocusedIndex(i); return; }
    }
    setFocusedIndex(0);
  }, [activeSongId, songs]);

  useEffect(() => {
    if (!listRef.current || songs.length === 0) return;
    const options = listRef.current.querySelectorAll<HTMLElement>('[role="option"]');
    options[focusedIndex]?.scrollIntoView({ block: 'nearest' });
  }, [focusedIndex, songs.length]);

  function handleListKeyDown(e: React.KeyboardEvent) {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setFocusedIndex(i => Math.min(i + 1, songs.length - 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setFocusedIndex(i => Math.max(i - 1, 0));
    } else if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      const song = songs[focusedIndex];
      if (song) onSongSelect(song.id);
    }
  }

  function copyShareLink() {
    if (!versionId) return;
    navigator.clipboard.writeText(`${window.location.origin}/playlist/${versionId}`);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  if (songs.length === 0) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center gap-2 text-center px-6">
        <p className="text-zinc-400 dark:text-zinc-600 text-sm">No playlist yet</p>
        <p className="text-zinc-400 dark:text-zinc-700 text-xs">Generate a playlist to get started.</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full overflow-hidden">
      {/* Mood + version label */}
      <div className="px-4 py-2.5 border-b border-zinc-200 dark:border-zinc-800 shrink-0 flex items-center justify-between gap-2">
        <p className="text-xs text-zinc-500 truncate">
          <span className="text-zinc-600 dark:text-zinc-400 font-medium">v{currentVersion}</span>
          {' · '}
          <span className="italic">{mood}</span>
        </p>
        {versionId && (
          <button
            onClick={copyShareLink}
            aria-label={copied ? 'Share link copied' : 'Copy share link'}
            className="shrink-0 text-xs text-zinc-400 dark:text-zinc-600 hover:text-zinc-700 dark:hover:text-zinc-300 transition-colors"
          >
            {copied ? 'Copied!' : 'Share'}
          </button>
        )}
      </div>

      {/* Song list — dims while AI is transforming */}
      <div
        ref={listRef}
        role="listbox"
        aria-label="Playlist tracks"
        tabIndex={0}
        onFocus={() => setListHasFocus(true)}
        onBlur={() => setListHasFocus(false)}
        onKeyDown={handleListKeyDown}
        className={`flex-1 overflow-y-auto transition-opacity duration-300 focus:outline-none focus-visible:ring-1 focus-visible:ring-inset focus-visible:ring-zinc-300 dark:focus-visible:ring-zinc-700 ${
          isTransforming ? 'opacity-40 pointer-events-none' : 'opacity-100'
        }`}
      >
        <AnimatePresence mode="popLayout">
          {songs.map((song, i) => (
            <PlaylistItem
              key={song.id}
              song={song}
              index={i}
              isNew={newSongIds.has(song.id)}
              isActive={activeSongId === song.id}
              isFocused={listHasFocus && focusedIndex === i}
              onSelect={onSongSelect}
            />
          ))}
        </AnimatePresence>
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
