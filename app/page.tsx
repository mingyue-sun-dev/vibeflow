'use client';

import { useState, useEffect, useRef } from 'react';
import type { User } from '@supabase/supabase-js';
import { Song, PlaylistVersion, SavedPlaylist } from '@/types';
import { supabase } from '@/lib/supabase';
import { signOut } from '@/lib/auth';
import { AuthModal } from '@/components/AuthModal';
import { PlaylistPanel } from '@/components/PlaylistPanel';
import { ChatPanel, LocalMessage } from '@/components/ChatPanel';
import { ControlPanel } from '@/components/ControlPanel';
import { SavedPlaylists } from '@/components/SavedPlaylists';
import { ThemeToggle } from '@/components/ThemeToggle';

export default function Home() {
  const [mood, setMood] = useState('');

  // Playlist state
  const [playlistId, setPlaylistId] = useState<string | null>(null);
  const [currentVersionId, setCurrentVersionId] = useState<string | null>(null);
  const [songs, setSongs] = useState<Song[]>([]);
  const [currentMood, setCurrentMood] = useState('');
  const [currentVersion, setCurrentVersion] = useState(0);
  const [versions, setVersions] = useState<PlaylistVersion[]>([]);

  // Diff highlight
  const [newSongIds, setNewSongIds] = useState<Set<string>>(new Set());

  // Chat
  const [messages, setMessages] = useState<LocalMessage[]>([]);

  // Saved playlists (bookmarks)
  const [savedPlaylists, setSavedPlaylists] = useState<SavedPlaylist[]>([]);
  const [isSaving, setIsSaving] = useState(false);

  // Search history (UX preference — stays in localStorage)
  const [searchHistory, setSearchHistory] = useState<string[]>([]);
  const [showHistory, setShowHistory] = useState(false);

  // Mobile tab
  const [activeTab, setActiveTab] = useState<'playlist' | 'chat' | 'controls'>('chat');

  // Embed player — lifted here so it persists across mobile tab switches
  const [activeSongId, setActiveSongId] = useState<string | null>(null);
  function handleSongSelect(id: string) {
    setActiveSongId(prev => prev === id ? null : id);
  }

  // Loading
  const [isGenerating, setIsGenerating] = useState(false);
  const [isTransforming, setIsTransforming] = useState(false);
  const [isRestoring, setIsRestoring] = useState(true);
  const [error, setError] = useState('');

  // Auth
  const [user, setUser] = useState<User | null>(null);
  const [showAuthModal, setShowAuthModal] = useState(false);

  const inputRef = useRef<HTMLInputElement>(null);
  const diffTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const transformAbortRef = useRef<AbortController | null>(null);
  const restoredUserIdRef = useRef<string | null>(null);

  // Global Esc → cancel in-progress transform
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape' && isTransforming) handleCancelTransform();
    }
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isTransforming]);

  useEffect(() => {
    try {
      const saved = localStorage.getItem('vf_search_history');
      if (saved) setSearchHistory(JSON.parse(saved));
    } catch { /* ignore */ }

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      const u = session?.user ?? null;
      setUser(u);
      if (event === 'INITIAL_SESSION' || event === 'SIGNED_IN') {
        if (u) {
          if (restoredUserIdRef.current !== u.id) {
            restoredUserIdRef.current = u.id;
            restoreSession(u.id);
          }
        } else {
          setIsRestoring(false);
        }
      } else if (event === 'SIGNED_OUT') {
        restoredUserIdRef.current = null;
        clearPlaylistState();
        setIsRestoring(false);
      }
    });

    return () => {
      if (diffTimerRef.current) clearTimeout(diffTimerRef.current);
      subscription.unsubscribe();
    };
  }, []);

  // ── Clear playlist state ─────────────────────────────────────────────────
  function clearPlaylistState() {
    setSongs([]);
    setVersions([]);
    setMessages([]);
    setPlaylistId(null);
    setCurrentVersionId(null);
    setCurrentVersion(0);
    setCurrentMood('');
    setNewSongIds(new Set());
    setSavedPlaylists([]);
    setError('');
    setActiveSongId(null);
  }

  // ── Restore data for logged-in user ──────────────────────────────────────
  async function restoreSession(userId: string) {
    setIsRestoring(true);

    const [playlistRes, savedRes] = await Promise.all([
      supabase
        .from('playlists')
        .select('*')
        .eq('user_id', userId)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle(),
      fetch(`/api/saved-playlists?userId=${userId}`).then((r) => r.json()),
    ]);

    if (savedRes.saved) setSavedPlaylists(savedRes.saved);

    const playlist = playlistRes.data;
    if (!playlist) { setIsRestoring(false); return; }

    const { data: versionRows } = await supabase
      .from('playlist_versions')
      .select('*')
      .eq('playlist_id', playlist.id)
      .order('version_number', { ascending: true });

    if (!versionRows?.length) { setIsRestoring(false); return; }

    const active =
      versionRows.find((v) => v.version_number === playlist.current_version) ??
      versionRows[versionRows.length - 1];

    setPlaylistId(playlist.id);
    setCurrentVersionId(active.id);
    setCurrentVersion(active.version_number);
    setSongs(active.playlist_json.songs);
    setCurrentMood(active.playlist_json.mood);
    setVersions(versionRows as PlaylistVersion[]);

    const { data: chatRows } = await supabase
      .from('chat_messages')
      .select('role, content')
      .eq('playlist_id', playlist.id)
      .order('created_at', { ascending: true });

    if (chatRows?.length) setMessages(chatRows as LocalMessage[]);
    setIsRestoring(false);
  }

  // ── Diff highlight ───────────────────────────────────────────────────────
  function flashNewSongs(oldSongs: Song[], incomingSongs: Song[]) {
    const oldIds = new Set(oldSongs.map((s) => s.id));
    const ids = new Set(incomingSongs.filter((s) => !oldIds.has(s.id)).map((s) => s.id));
    if (ids.size === 0) return;
    setNewSongIds(ids);
    if (diffTimerRef.current) clearTimeout(diffTimerRef.current);
    diffTimerRef.current = setTimeout(() => setNewSongIds(new Set()), 1800);
  }

  // ── Search history ───────────────────────────────────────────────────────
  function addToHistory(query: string) {
    setSearchHistory((prev) => {
      const next = [query, ...prev.filter((q) => q.toLowerCase() !== query.toLowerCase())].slice(0, 8);
      localStorage.setItem('vf_search_history', JSON.stringify(next));
      return next;
    });
  }

  function removeFromHistory(query: string) {
    setSearchHistory((prev) => {
      const next = prev.filter((q) => q !== query);
      localStorage.setItem('vf_search_history', JSON.stringify(next));
      return next;
    });
  }

  // ── Generate playlist from mood ──────────────────────────────────────────
  async function handleGenerate() {
    if (!mood.trim() || !user || isGenerating) return;
    setError('');
    setIsGenerating(true);
    try {
      const res = await fetch('/api/generate-playlist', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ mood: mood.trim(), userId: user.id }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);

      const { playlist, version } = data as {
        playlist: { id: string };
        version: PlaylistVersion;
      };

      addToHistory(mood.trim());
      setActiveTab('playlist');
      setPlaylistId(playlist.id);
      setCurrentVersionId(version.id);
      setCurrentVersion(version.version_number);
      setSongs(version.playlist_json.songs);
      setCurrentMood(version.playlist_json.mood);
      setVersions([version]);
      setMessages([]);
      setMood('');
      setActiveSongId(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong');
    } finally {
      setIsGenerating(false);
    }
  }

  // ── Transform playlist via chat ──────────────────────────────────────────
  async function handleTransform(instruction: string) {
    if (!playlistId || !user || isTransforming) return;

    const abort = new AbortController();
    transformAbortRef.current = abort;

    setMessages((prev) => [...prev, { role: 'user', content: instruction }]);
    setIsTransforming(true);

    try {
      const res = await fetch('/api/transform-playlist', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          playlistId,
          userId: user.id,
          instruction,
          currentPlaylist: { mood: currentMood, songs },
        }),
        signal: abort.signal,
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);

      const { version, assistantContent } = data as {
        version: PlaylistVersion;
        assistantContent: string;
      };

      flashNewSongs(songs, version.playlist_json.songs);
      setCurrentVersionId(version.id);
      setCurrentVersion(version.version_number);
      setSongs(version.playlist_json.songs);
      setCurrentMood(version.playlist_json.mood);
      setVersions((prev) => [...prev, version]);
      setMessages((prev) => [...prev, { role: 'assistant', content: assistantContent }]);
    } catch (err) {
      if (err instanceof Error && err.name === 'AbortError') return;
      setMessages((prev) => [
        ...prev,
        { role: 'assistant', content: 'Sorry, something went wrong. Try again.' },
      ]);
    } finally {
      transformAbortRef.current = null;
      setIsTransforming(false);
    }
  }

  function handleCancelTransform() {
    transformAbortRef.current?.abort();
  }

  // ── Revert to a previous version ─────────────────────────────────────────
  function handleRevert(version: PlaylistVersion) {
    flashNewSongs(songs, version.playlist_json.songs);
    setCurrentVersionId(version.id);
    setCurrentVersion(version.version_number);
    setSongs(version.playlist_json.songs);
    setCurrentMood(version.playlist_json.mood);
    setMessages((prev) => [
      ...prev,
      {
        role: 'assistant',
        content: `Reverted to v${version.version_number} — ${version.playlist_json.songs.length} tracks.`,
      },
    ]);
  }

  // ── Save current version as bookmark ────────────────────────────────────
  async function handleSave() {
    if (!currentVersionId || !user || isSaving) return;
    setIsSaving(true);
    try {
      const name = currentMood || `Playlist v${currentVersion}`;
      const res = await fetch('/api/saved-playlists', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: user.id,
          playlistVersionId: currentVersionId,
          name,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setSavedPlaylists((prev) => [data.saved, ...prev]);
    } catch (err) {
      console.error('Save failed:', err);
    } finally {
      setIsSaving(false);
    }
  }

  // ── Restore a saved bookmark ─────────────────────────────────────────────
  function handleRestoreSaved(saved: SavedPlaylist) {
    const pj = saved.playlist_versions?.playlist_json;
    if (!pj) return;
    flashNewSongs(songs, pj.songs);
    setSongs(pj.songs);
    setCurrentMood(pj.mood);
    setCurrentVersionId(saved.playlist_version_id);
    setMessages((prev) => [
      ...prev,
      { role: 'assistant', content: `Loaded saved playlist: "${saved.name}"` },
    ]);
  }

  // ── Delete a saved bookmark ──────────────────────────────────────────────
  async function handleDeleteSaved(id: string) {
    setSavedPlaylists((prev) => prev.filter((s) => s.id !== id));
    await fetch(`/api/saved-playlists/${id}`, { method: 'DELETE' });
  }

  // ── Clear current playlist ────────────────────────────────────────────────
  function handleNewPlaylist() {
    setSongs([]);
    setVersions([]);
    setMessages([]);
    setPlaylistId(null);
    setCurrentVersionId(null);
    setCurrentVersion(0);
    setCurrentMood('');
    setNewSongIds(new Set());
    setError('');
    setActiveSongId(null);
  }

  const hasPlaylist = songs.length > 0;

  // ── Shared mood input UI ──────────────────────────────────────────────────
  function MoodInput() {
    return (
      <div className="flex-1 flex items-center justify-center px-6">
        <div className="w-full max-w-md space-y-5 text-center">
          <div className="space-y-2">
            <h1 className="text-2xl font-semibold">What&apos;s your vibe?</h1>
            <p className="text-zinc-500 text-sm leading-relaxed">
              Describe a mood or moment — AI builds a playlist,
              <br />you shape it through conversation.
            </p>
            <div className="flex items-center justify-center gap-2 pt-1">
              {['Mood', 'Playlist', 'Refine'].map((step, i, arr) => (
                <span key={step} className="flex items-center gap-2">
                  <span className="text-xs text-zinc-400 dark:text-zinc-700">{step}</span>
                  {i < arr.length - 1 && <span className="text-zinc-300 dark:text-zinc-800 text-xs">→</span>}
                </span>
              ))}
            </div>
          </div>

          <div className="flex flex-wrap gap-2 justify-center">
            {['late night drive', 'focused deep work', 'rainy day melancholy', 'morning workout'].map(
              (prompt) => (
                <button
                  key={prompt}
                  onClick={() => setMood(prompt)}
                  className="text-xs px-3 py-1.5 rounded-full bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400 hover:bg-zinc-200 dark:hover:bg-zinc-700 hover:text-zinc-800 dark:hover:text-zinc-200 transition-colors"
                >
                  {prompt}
                </button>
              )
            )}
          </div>

          <div className="relative">
            <div className="flex gap-2">
              <input
                ref={inputRef}
                type="text"
                value={mood}
                onChange={(e) => setMood(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleGenerate()}
                onFocus={() => setShowHistory(true)}
                onBlur={() => setShowHistory(false)}
                placeholder="e.g. relaxed Sunday morning..."
                disabled={isGenerating}
                className="flex-1 bg-zinc-100 dark:bg-zinc-800 border border-zinc-300 dark:border-zinc-700 rounded-lg px-4 py-2.5 text-sm placeholder:text-zinc-400 dark:placeholder:text-zinc-600 focus:outline-none focus:ring-1 focus:ring-zinc-400 dark:focus:ring-zinc-500 disabled:opacity-50 disabled:cursor-not-allowed"
              />
              <button
                onClick={handleGenerate}
                disabled={!mood.trim() || isGenerating}
                className="bg-zinc-900 dark:bg-white text-white dark:text-zinc-950 rounded-lg px-4 py-2.5 text-sm font-medium disabled:opacity-30 disabled:cursor-not-allowed hover:bg-zinc-700 dark:hover:bg-zinc-200 active:scale-95 transition-all shrink-0"
              >
                {isGenerating ? (
                  <span className="flex items-center gap-2">
                    <Spinner />
                    Curating…
                  </span>
                ) : (
                  'Generate'
                )}
              </button>
            </div>

            {showHistory && searchHistory.length > 0 && !mood.trim() && (
              <div className="absolute top-full left-0 right-12 mt-1.5 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-700 rounded-lg p-3 shadow-xl z-10 text-left animate-fade-in">
                <p className="text-xs text-zinc-400 dark:text-zinc-600 uppercase tracking-wider mb-2">Recent</p>
                <div className="flex flex-wrap gap-1.5">
                  {searchHistory.map((query) => (
                    <div
                      key={query}
                      className="flex items-center gap-1 bg-zinc-100 dark:bg-zinc-800 hover:bg-zinc-200 dark:hover:bg-zinc-700 rounded-full pl-3 pr-1.5 py-1 transition-colors"
                    >
                      <button
                        onMouseDown={(e) => { e.preventDefault(); setMood(query); }}
                        className="text-xs text-zinc-700 dark:text-zinc-300 whitespace-nowrap"
                      >
                        {query}
                      </button>
                      <button
                        onMouseDown={(e) => { e.preventDefault(); removeFromHistory(query); }}
                        aria-label={`Remove "${query}" from recent searches`}
                        className="text-zinc-400 dark:text-zinc-600 hover:text-zinc-700 dark:hover:text-zinc-300 transition-colors p-0.5"
                      >
                        <svg className="w-2.5 h-2.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                          <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                        </svg>
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          {error && <p className="text-red-400 text-xs">{error}</p>}
        </div>
      </div>
    );
  }

  // ── Login prompt (shown when not authenticated) ───────────────────────────
  function LoginPrompt() {
    return (
      <div className="flex-1 flex items-center justify-center px-6">
        <div className="text-center space-y-4">
          <h1 className="text-2xl font-semibold">What&apos;s your vibe?</h1>
          <p className="text-zinc-500 text-sm">Log in to generate and save playlists.</p>
          <button
            onClick={() => setShowAuthModal(true)}
            className="bg-zinc-900 dark:bg-white text-white dark:text-zinc-950 rounded-lg px-5 py-2.5 text-sm font-medium hover:bg-zinc-700 dark:hover:bg-zinc-200 active:scale-95 transition-all"
          >
            Log in
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <header className="flex items-center justify-between px-6 py-4 border-b border-zinc-200 dark:border-zinc-800 shrink-0">
        <div className="flex items-center gap-3">
          <span className="text-lg font-semibold tracking-tight">VibeFlow</span>
          <span className="text-xs text-zinc-500 font-mono hidden sm:block">
            AI Playlist Generator
          </span>
        </div>
        <div className="flex items-center gap-3">
          <ThemeToggle />
          {hasPlaylist && (
            <button
              onClick={handleNewPlaylist}
              className="text-xs text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-300 transition-colors"
            >
              New playlist
            </button>
          )}
          {user ? (
            <div className="flex items-center gap-2">
              <span className="text-xs text-zinc-500 hidden sm:block truncate max-w-[140px]">
                {user.email}
              </span>
              <button
                onClick={() => signOut()}
                className="text-xs text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-300 transition-colors"
              >
                Log out
              </button>
            </div>
          ) : (
            <button
              onClick={() => setShowAuthModal(true)}
              className="text-xs bg-zinc-100 dark:bg-zinc-800 hover:bg-zinc-200 dark:hover:bg-zinc-700 text-zinc-700 dark:text-zinc-300 px-3 py-1.5 rounded-lg transition-colors"
            >
              Log in
            </button>
          )}
        </div>
      </header>

      {/* ── Desktop: 3-panel layout ── */}
      <div className="hidden md:flex flex-1 overflow-hidden">

        {/* Left — Playlist */}
        <aside className="w-72 shrink-0 border-r border-zinc-200 dark:border-zinc-800 flex flex-col overflow-hidden">
          <div className="px-4 py-3 border-b border-zinc-200 dark:border-zinc-800 shrink-0">
            <h2 className="text-xs font-medium text-zinc-500 dark:text-zinc-400 uppercase tracking-wider">
              Playlist
              {hasPlaylist && (
                <span className="ml-2 text-zinc-400 dark:text-zinc-600 normal-case font-normal">
                  {songs.length} tracks
                </span>
              )}
            </h2>
          </div>
          {isRestoring ? (
            <PlaylistSkeleton />
          ) : (
            <div className="animate-fade-in flex flex-col h-full overflow-hidden">
              <PlaylistPanel
                songs={songs}
                mood={currentMood}
                currentVersion={currentVersion}
                versions={versions}
                newSongIds={newSongIds}
                isTransforming={isTransforming}
                onRevert={handleRevert}
                activeSongId={activeSongId}
                onSongSelect={handleSongSelect}
                versionId={currentVersionId}
              />
            </div>
          )}
          {activeSongId && (
            <div className="shrink-0 border-t border-zinc-200 dark:border-zinc-800">
              <iframe
                key={activeSongId}
                src={`https://open.spotify.com/embed/track/${activeSongId}?utm_source=generator&theme=0`}
                width="100%"
                height="152"
                frameBorder="0"
                allow="autoplay; clipboard-write; encrypted-media; fullscreen; picture-in-picture"
                loading="eager"
                className="block"
              />
            </div>
          )}
        </aside>

        {/* Center — Login prompt, Mood input, or Chat */}
        <main className="flex-1 flex flex-col overflow-hidden">
          <div className="px-4 py-3 border-b border-zinc-200 dark:border-zinc-800 shrink-0">
            <h2 className="text-xs font-medium text-zinc-500 dark:text-zinc-400 uppercase tracking-wider">
              {hasPlaylist ? 'Refine' : 'Generate'}
            </h2>
          </div>

          {isRestoring ? null : !user ? (
            <LoginPrompt />
          ) : !hasPlaylist ? (
            <MoodInput />
          ) : (
            <ChatPanel
              messages={messages}
              onSend={handleTransform}
              onCancel={handleCancelTransform}
              isTransforming={isTransforming}
            />
          )}
        </main>

        {/* Right — Controls + Saved */}
        <aside className="w-56 shrink-0 border-l border-zinc-200 dark:border-zinc-800 flex flex-col overflow-hidden">
          <div className="px-4 py-3 border-b border-zinc-200 dark:border-zinc-800 shrink-0">
            <h2 className="text-xs font-medium text-zinc-500 dark:text-zinc-400 uppercase tracking-wider">Controls</h2>
          </div>
          <div className="flex-1 overflow-y-auto flex flex-col">
            <ControlPanel
              onQuickAction={handleTransform}
              disabled={!hasPlaylist || isTransforming}
            />
            <SavedPlaylists
              saved={savedPlaylists}
              onRestore={handleRestoreSaved}
              onDelete={handleDeleteSaved}
              onSave={handleSave}
              canSave={hasPlaylist}
              isSaving={isSaving}
            />
          </div>
        </aside>
      </div>

      {/* ── Mobile: single panel + bottom tab bar ── */}
      <div className="flex md:hidden flex-col flex-1 overflow-hidden">

        <div className="flex-1 overflow-hidden flex flex-col">

          {activeTab === 'playlist' && (
            <>
              <div className="px-4 py-3 border-b border-zinc-200 dark:border-zinc-800 shrink-0">
                <h2 className="text-xs font-medium text-zinc-500 dark:text-zinc-400 uppercase tracking-wider">
                  Playlist
                  {hasPlaylist && (
                    <span className="ml-2 text-zinc-400 dark:text-zinc-600 normal-case font-normal">{songs.length} tracks</span>
                  )}
                </h2>
              </div>
              {isRestoring ? <PlaylistSkeleton /> : (
                <div className="animate-fade-in flex flex-col flex-1 overflow-hidden">
                  <PlaylistPanel
                    songs={songs}
                    mood={currentMood}
                    currentVersion={currentVersion}
                    versions={versions}
                    newSongIds={newSongIds}
                    isTransforming={isTransforming}
                    onRevert={handleRevert}
                    activeSongId={activeSongId}
                    onSongSelect={handleSongSelect}
                    versionId={currentVersionId}
                  />
                </div>
              )}
            </>
          )}

          {activeTab === 'chat' && (
            <>
              <div className="px-4 py-3 border-b border-zinc-200 dark:border-zinc-800 shrink-0">
                <h2 className="text-xs font-medium text-zinc-500 dark:text-zinc-400 uppercase tracking-wider">
                  {hasPlaylist ? 'Refine' : 'Generate'}
                </h2>
              </div>
              {isRestoring ? null : !user ? (
                <LoginPrompt />
              ) : !hasPlaylist ? (
                <div className="overflow-y-auto">
                  <MoodInput />
                </div>
              ) : (
                <ChatPanel
                  messages={messages}
                  onSend={handleTransform}
                  onCancel={handleCancelTransform}
                  isTransforming={isTransforming}
                />
              )}
            </>
          )}

          {activeTab === 'controls' && (
            <>
              <div className="px-4 py-3 border-b border-zinc-200 dark:border-zinc-800 shrink-0">
                <h2 className="text-xs font-medium text-zinc-500 dark:text-zinc-400 uppercase tracking-wider">Controls</h2>
              </div>
              <div className="flex-1 overflow-y-auto flex flex-col">
                <ControlPanel
                  onQuickAction={(instruction) => { setActiveTab('chat'); handleTransform(instruction); }}
                  disabled={!hasPlaylist || isTransforming}
                />
                <SavedPlaylists
                  saved={savedPlaylists}
                  onRestore={handleRestoreSaved}
                  onDelete={handleDeleteSaved}
                  onSave={handleSave}
                  canSave={hasPlaylist}
                  isSaving={isSaving}
                />
              </div>
            </>
          )}
        </div>

        {/* Persistent embed player — survives tab switches */}
        {activeSongId && (
          <div className="shrink-0 border-t border-zinc-200 dark:border-zinc-800">
            <iframe
              key={activeSongId}
              src={`https://open.spotify.com/embed/track/${activeSongId}?utm_source=generator&theme=0`}
              width="100%"
              height="152"
              frameBorder="0"
              allow="autoplay; clipboard-write; encrypted-media; fullscreen; picture-in-picture"
              loading="eager"
              className="block"
            />
          </div>
        )}

        {/* Bottom tab bar */}
        <nav className="border-t border-zinc-200 dark:border-zinc-800 shrink-0 flex bg-white dark:bg-zinc-950">
          {([
            { tab: 'playlist', label: 'Playlist', icon: (
              <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 19V6l12-3v13M9 19c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zm12-3c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2z" />
              </svg>
            )},
            { tab: 'chat', label: hasPlaylist ? 'Refine' : 'Generate', icon: (
              <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                <path strokeLinecap="round" strokeLinejoin="round" d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
              </svg>
            )},
            { tab: 'controls', label: 'Controls', icon: (
              <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 6V4m0 2a2 2 0 100 4m0-4a2 2 0 110 4m-6 8a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4m6 6v10m6-2a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4" />
              </svg>
            )},
          ] as const).map(({ tab, label, icon }) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              aria-current={activeTab === tab ? 'true' : undefined}
              className={`flex-1 flex flex-col items-center gap-1 py-3 text-[10px] font-medium transition-colors ${
                activeTab === tab ? 'text-zinc-900 dark:text-white' : 'text-zinc-400 dark:text-zinc-600 hover:text-zinc-600 dark:hover:text-zinc-400'
              }`}
            >
              {icon}
              {label}
            </button>
          ))}
        </nav>
      </div>

      {showAuthModal && (
        <AuthModal onClose={() => setShowAuthModal(false)} />
      )}
    </div>
  );
}

function PlaylistSkeleton() {
  return (
    <div className="flex-1 px-4 py-3 space-y-3">
      {Array.from({ length: 7 }).map((_, i) => (
        <div key={i} className="flex items-center gap-3 animate-pulse">
          <div className="w-4 h-3 bg-zinc-200 dark:bg-zinc-800 rounded shrink-0" />
          <div className="w-8 h-8 bg-zinc-200 dark:bg-zinc-800 rounded shrink-0" />
          <div className="flex-1 space-y-1.5">
            <div className="h-3 bg-zinc-200 dark:bg-zinc-800 rounded w-3/4" />
            <div className="h-2.5 bg-zinc-200/60 dark:bg-zinc-800/60 rounded w-1/2" />
          </div>
          <div className="w-8 h-2.5 bg-zinc-200 dark:bg-zinc-800 rounded shrink-0" />
        </div>
      ))}
    </div>
  );
}

function Spinner() {
  return (
    <svg className="animate-spin h-3.5 w-3.5" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
    </svg>
  );
}
