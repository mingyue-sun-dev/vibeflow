'use client';

import { SavedPlaylist } from '@/types';

interface SavedPlaylistsProps {
  saved: SavedPlaylist[];
  onRestore: (saved: SavedPlaylist) => void;
  onDelete: (id: string) => void;
  onSave: () => void;
  canSave: boolean;
  isSaving: boolean;
}

export function SavedPlaylists({
  saved,
  onRestore,
  onDelete,
  onSave,
  canSave,
  isSaving,
}: SavedPlaylistsProps) {
  return (
    <div className="border-t border-zinc-800 flex flex-col shrink-0">
      {/* Header + save button */}
      <div className="flex items-center justify-between px-4 py-3">
        <h3 className="text-xs font-medium text-zinc-400 uppercase tracking-wider">Saved</h3>
        {canSave && (
          <button
            onClick={onSave}
            disabled={isSaving}
            className="text-xs text-zinc-500 hover:text-zinc-200 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
          >
            {isSaving ? 'Saving…' : '+ Save current'}
          </button>
        )}
      </div>

      {/* Saved list */}
      <div className="px-2 pb-3 space-y-0.5 max-h-40 overflow-y-auto">
        {saved.length === 0 ? (
          <p className="text-xs text-zinc-700 px-2 pb-1">
            {canSave ? 'Save a playlist version to recall it later.' : 'No saved playlists yet.'}
          </p>
        ) : (
          saved.map((item) => {
            const trackCount = item.playlist_versions?.playlist_json.songs.length ?? 0;
            return (
              <div
                key={item.id}
                className="group flex items-center justify-between gap-1 px-2 py-1.5 rounded-lg hover:bg-zinc-800/60 transition-colors"
              >
                <button
                  onClick={() => onRestore(item)}
                  className="flex-1 text-left min-w-0"
                >
                  <p className="text-xs text-zinc-300 truncate">{item.name}</p>
                  <p className="text-[10px] text-zinc-600">{trackCount} tracks</p>
                </button>
                <button
                  onClick={() => onDelete(item.id)}
                  className="shrink-0 text-zinc-700 hover:text-red-500 transition-colors opacity-0 group-hover:opacity-100 text-xs leading-none px-1"
                  title="Remove bookmark"
                >
                  ✕
                </button>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
