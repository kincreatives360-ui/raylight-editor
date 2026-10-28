import { IconButton } from './primitives';
import { ShortcutKey } from './ShortcutKey';
// src/ui/UndoToast.tsx
import React, { useEffect, useRef } from 'react';
import { Undo2, X } from 'lucide-react';
import { getModifierKey } from '../utils/shortcuts';

export interface UndoToastProps {
  message: string;
  isOpen: boolean;
  onUndo: () => void;
  onDismiss: () => void;
  durationMs?: number;
}

export const UndoToast: React.FC<UndoToastProps> = ({
  message,
  isOpen,
  onUndo,
  onDismiss,
  durationMs = 6000,
}) => {
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const onDismissRef = useRef(onDismiss);

  useEffect(() => {
    onDismissRef.current = onDismiss;
  }, [onDismiss]);

  useEffect(() => {
    if (!isOpen) return;
    timerRef.current = setTimeout(() => {
      onDismissRef.current();
    }, durationMs);

    return () => {
      if (timerRef.current) {
        clearTimeout(timerRef.current);
      }
    };
  }, [isOpen, durationMs]);

  if (!isOpen) return null;

  return (
    <div
      role="status"
      aria-live="polite"
      className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 flex items-center gap-3 px-4 py-2.5 rounded-xl bg-[#18181f] border border-white/10 text-white shadow-2xl backdrop-blur-md transition-all duration-200 select-none"
    >
      <span className="text-xs font-medium text-zinc-200">{message}</span>
      <div className="flex items-center gap-1.5 pl-2 border-l border-white/10">
        <button
          type="button"
          onClick={() => {
            onUndo();
            onDismiss();
          }}
          className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-[#0070e0] hover:bg-[#005bb5] text-white text-xs font-medium transition cursor-pointer active:scale-95"
        >
          <Undo2 className="w-3.5 h-3.5" />
          <span>Undo</span>
          <ShortcutKey className="text-[11px] font-mono text-white/90 bg-black/25 px-1 py-0.5 rounded">
            {getModifierKey()}Z
          </ShortcutKey>
        </button>
        <IconButton
            unstyled
            tooltip={false}
            label="Dismiss toast"
            icon={<>
              <X className="w-3.5 h-3.5" />
            </>}
            onClick={onDismiss}
            className="p-1 rounded-lg hover:bg-white/10 text-zinc-400 hover:text-white transition cursor-pointer"
        />
      </div>
    </div>
  );
};
