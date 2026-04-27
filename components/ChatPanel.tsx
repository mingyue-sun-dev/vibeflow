'use client';

import { useEffect, useRef, useState } from 'react';

export interface LocalMessage {
  role: 'user' | 'assistant';
  content: string;
}

interface ChatPanelProps {
  messages: LocalMessage[];
  onSend: (instruction: string) => void;
  onCancel: () => void;
  isTransforming: boolean;
}

export function ChatPanel({ messages, onSend, onCancel, isTransforming }: ChatPanelProps) {
  const [input, setInput] = useState('');
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isTransforming]);

  function handleSend() {
    const text = input.trim();
    if (!text || isTransforming) return;
    setInput('');
    onSend(text);
  }

  return (
    <div className="flex flex-col h-full overflow-hidden">
      {/* Message history */}
      <div className="flex-1 overflow-y-auto px-4 py-4 space-y-3">
        {messages.length === 0 && (
          <div className="flex flex-col items-center justify-center h-full gap-3 text-center pb-8">
            <div className="w-9 h-9 rounded-full bg-zinc-100 dark:bg-zinc-800 flex items-center justify-center">
              <svg className="w-4 h-4 text-zinc-400 dark:text-zinc-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
                  d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z"
                />
              </svg>
            </div>
            <div className="space-y-1">
              <p className="text-zinc-600 dark:text-zinc-400 text-sm font-medium">Shape your playlist</p>
              <p className="text-zinc-400 dark:text-zinc-600 text-xs">
                Try &ldquo;make it more calm&rdquo;, &ldquo;only upbeat tracks&rdquo;,
              </p>
              <p className="text-zinc-400 dark:text-zinc-600 text-xs">or use the quick controls →</p>
            </div>
          </div>
        )}

        {messages.map((msg, i) => (
          <div
            key={i}
            className={`flex animate-fade-in ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
          >
            <div
              className={`max-w-[75%] px-4 py-2.5 rounded-2xl text-sm leading-relaxed ${
                msg.role === 'user'
                  ? 'bg-zinc-900 dark:bg-white text-white dark:text-zinc-950 rounded-br-sm'
                  : 'bg-zinc-100 dark:bg-zinc-800 text-zinc-800 dark:text-zinc-200 rounded-bl-sm'
              }`}
            >
              {msg.content}
            </div>
          </div>
        ))}

        {/* AI thinking indicator with contextual label */}
        {isTransforming && (
          <div className="flex flex-col gap-1.5 items-start animate-fade-in">
            <span className="text-xs text-zinc-400 dark:text-zinc-600 pl-1">Refining your playlist…</span>
            <div className="bg-zinc-100 dark:bg-zinc-800 px-4 py-3 rounded-2xl rounded-bl-sm">
              <TypingDots />
            </div>
          </div>
        )}

        <div ref={bottomRef} />
      </div>

      {/* Input */}
      <div className="px-4 py-4 border-t border-zinc-200 dark:border-zinc-800 shrink-0">
        <div className="flex gap-2">
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleSend()}
            placeholder="Tell me how to change the playlist…"
            disabled={isTransforming}
            className="flex-1 bg-zinc-100 dark:bg-zinc-800 border border-zinc-300 dark:border-zinc-700 rounded-lg px-4 py-2.5 text-sm placeholder:text-zinc-400 dark:placeholder:text-zinc-600 focus:outline-none focus:ring-1 focus:ring-zinc-400 dark:focus:ring-zinc-500 disabled:opacity-50 disabled:cursor-not-allowed"
          />
          {isTransforming ? (
            <button
              onClick={onCancel}
              className="bg-zinc-200 dark:bg-zinc-700 text-zinc-700 dark:text-zinc-300 rounded-lg px-4 py-2.5 text-sm font-medium hover:bg-zinc-300 dark:hover:bg-zinc-600 hover:text-zinc-900 dark:hover:text-white active:scale-95 transition-all shrink-0"
            >
              Cancel
            </button>
          ) : (
            <button
              onClick={handleSend}
              disabled={!input.trim()}
              className="bg-zinc-900 dark:bg-white text-white dark:text-zinc-950 rounded-lg px-4 py-2.5 text-sm font-medium disabled:opacity-30 disabled:cursor-not-allowed hover:bg-zinc-700 dark:hover:bg-zinc-200 active:scale-95 transition-all shrink-0"
            >
              Send
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

function TypingDots() {
  return (
    <div className="flex gap-1 items-center h-4">
      {[0, 1, 2].map((i) => (
        <span
          key={i}
          className="w-1.5 h-1.5 bg-zinc-400 dark:bg-zinc-500 rounded-full animate-bounce"
          style={{ animationDelay: `${i * 0.15}s` }}
        />
      ))}
    </div>
  );
}
