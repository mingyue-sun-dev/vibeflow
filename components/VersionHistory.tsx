'use client';

import { PlaylistVersion } from '@/types';

interface VersionHistoryProps {
  versions: PlaylistVersion[];
  currentVersion: number;
  onRevert: (version: PlaylistVersion) => void;
}

export function VersionHistory({ versions, currentVersion, onRevert }: VersionHistoryProps) {
  if (versions.length < 2) return null;

  // Diff: how many tracks changed vs previous version
  function getDiff(v: PlaylistVersion): { added: number; removed: number } | null {
    const idx = versions.findIndex((x) => x.version_number === v.version_number);
    if (idx <= 0) return null;
    const prev = versions[idx - 1];
    const prevIds = new Set(prev.playlist_json.songs.map((s) => s.id));
    const currIds = new Set(v.playlist_json.songs.map((s) => s.id));
    const added = v.playlist_json.songs.filter((s) => !prevIds.has(s.id)).length;
    const removed = prev.playlist_json.songs.filter((s) => !currIds.has(s.id)).length;
    return { added, removed };
  }

  return (
    <div className="border-t border-zinc-800 shrink-0">
      <div className="px-4 pt-3 pb-1">
        <h3 className="text-xs text-zinc-500 uppercase tracking-wider">History</h3>
      </div>
      <div className="px-2 pb-3 space-y-0.5 max-h-44 overflow-y-auto">
        {[...versions].reverse().map((v) => {
          const isCurrent = v.version_number === currentVersion;
          const diff = getDiff(v);

          return (
            <button
              key={v.id}
              onClick={() => !isCurrent && onRevert(v)}
              disabled={isCurrent}
              className={`w-full text-left px-3 py-2 rounded-lg transition-colors flex items-center justify-between gap-2 ${
                isCurrent
                  ? 'bg-zinc-800 cursor-default'
                  : 'hover:bg-zinc-800/60 cursor-pointer'
              }`}
            >
              {/* Left: version + mood */}
              <div className="min-w-0 flex items-center gap-2">
                <span
                  className={`font-mono text-xs shrink-0 ${
                    isCurrent ? 'text-white' : 'text-zinc-500'
                  }`}
                >
                  v{v.version_number}
                </span>
                <span className="text-xs text-zinc-600 truncate italic">
                  {v.playlist_json.mood}
                </span>
              </div>

              {/* Right: diff or track count */}
              <div className="flex items-center gap-1 shrink-0 text-xs">
                {diff ? (
                  <>
                    {diff.added > 0 && (
                      <span className="text-emerald-600">+{diff.added}</span>
                    )}
                    {diff.removed > 0 && (
                      <span className="text-red-700">-{diff.removed}</span>
                    )}
                  </>
                ) : (
                  <span className="text-zinc-700">{v.playlist_json.songs.length}</span>
                )}
                {isCurrent && (
                  <span className="ml-1 text-zinc-600">·</span>
                )}
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}
