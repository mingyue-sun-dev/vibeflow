'use client';

interface ControlPanelProps {
  onQuickAction: (instruction: string) => void;
  disabled?: boolean;
}

const QUICK_ACTIONS = [
  { label: 'More calm',        hint: 'Lower energy, peaceful'   },
  { label: 'More energy',      hint: 'Higher tempo, upbeat'     },
  { label: 'Remove sad songs', hint: 'Filter out melancholy'    },
  { label: 'Only upbeat',      hint: 'Happy and fun only'       },
  { label: 'More variety',     hint: 'Mix genres and energy'    },
];

export function ControlPanel({ onQuickAction, disabled = false }: ControlPanelProps) {
  return (
    <div className="flex flex-col h-full">
      <div className="p-4 space-y-2 flex-1">
        {QUICK_ACTIONS.map(({ label, hint }) => (
          <button
            key={label}
            onClick={() => onQuickAction(label)}
            disabled={disabled}
            title={hint}
            className="w-full text-left text-sm px-3 py-2.5 rounded-lg border border-transparent bg-zinc-100 dark:bg-zinc-800/60 text-zinc-600 dark:text-zinc-400 disabled:opacity-25 disabled:cursor-not-allowed hover:bg-zinc-200 dark:hover:bg-zinc-800 hover:border-zinc-300 dark:hover:border-zinc-700 hover:text-zinc-800 dark:hover:text-zinc-200 active:scale-[0.98] transition-all"
          >
            {label}
          </button>
        ))}
      </div>

      {!disabled && (
        <div className="px-4 pb-4">
          <p className="text-xs text-zinc-400 dark:text-zinc-700 leading-relaxed">
            Or type any instruction in the chat.
          </p>
        </div>
      )}
    </div>
  );
}
