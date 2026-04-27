'use client';

import { useState, useRef, useEffect } from 'react';
import { signIn, signUp } from '@/lib/auth';

interface AuthModalProps {
  onClose: () => void;
  initialView?: 'login' | 'signup';
}

export function AuthModal({ onClose, initialView = 'login' }: AuthModalProps) {
  const [view, setView] = useState<'login' | 'signup'>(initialView);
  const [email, setEmail] = useState('test@test.com');
  const [password, setPassword] = useState('123456');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const dialogRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const FOCUSABLE = 'button:not([disabled]), input:not([disabled])';

    function handleKeyDown(e: KeyboardEvent) {
      const dialog = dialogRef.current;
      if (!dialog) return;
      if (e.key === 'Escape') { onClose(); return; }
      if (e.key !== 'Tab') return;

      const els = Array.from(dialog.querySelectorAll<HTMLElement>(FOCUSABLE));
      const first = els[0];
      const last = els[els.length - 1];

      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    }

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [onClose]);

  function switchView(v: 'login' | 'signup') {
    setView(v);
    setError('');
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      if (view === 'login') {
        const { error } = await signIn(email, password);
        if (error) throw error;
        onClose();
      } else {
        const { error } = await signUp(email, password);
        if (error) throw error;
        onClose();
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div
      className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4"
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-label={view === 'login' ? 'Log in' : 'Sign up'}
        className="bg-zinc-900 border border-zinc-800 rounded-xl w-full max-w-sm p-6 relative animate-fade-in"
      >
        <button
          onClick={onClose}
          className="absolute top-4 right-4 text-zinc-600 hover:text-zinc-400 transition-colors"
          aria-label="Close"
        >
          <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>

        <div className="flex gap-1 mb-6 bg-zinc-800 p-1 rounded-lg" role="tablist">
          {(['login', 'signup'] as const).map((v) => (
            <button
              key={v}
              type="button"
              role="tab"
              aria-selected={view === v}
              onClick={() => switchView(v)}
              className={`flex-1 py-1.5 text-sm font-medium rounded-md transition-colors ${
                view === v
                  ? 'bg-zinc-700 text-zinc-100'
                  : 'text-zinc-500 hover:text-zinc-300'
              }`}
            >
              {v === 'login' ? 'Log in' : 'Sign up'}
            </button>
          ))}
        </div>

        <form onSubmit={handleSubmit} className="space-y-3">
          <input
            type="email"
            placeholder="Email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            autoFocus
            className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-4 py-2.5 text-sm placeholder:text-zinc-600 focus:outline-none focus:ring-1 focus:ring-zinc-500"
          />
          <input
            type="password"
            placeholder="Password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            minLength={6}
            className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-4 py-2.5 text-sm placeholder:text-zinc-600 focus:outline-none focus:ring-1 focus:ring-zinc-500"
          />

          {error && <p className="text-red-400 text-xs">{error}</p>}

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-white text-zinc-950 rounded-lg py-2.5 text-sm font-medium disabled:opacity-40 hover:bg-zinc-200 active:scale-95 transition-all"
          >
            {loading
              ? view === 'login' ? 'Logging in…' : 'Signing up…'
              : view === 'login' ? 'Log in' : 'Sign up'}
          </button>
        </form>
      </div>
    </div>
  );
}
