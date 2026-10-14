// Decides WHEN a queued launcher-icon change may be applied: only after the person has really left the app (pure, no react-native).
import { shouldApplyIconNow } from './appIcon.ts';

export function createLeaveWatcher(d: {
  delayMs: number;
  getState: () => string;
  externalOpen: () => number;
  apply: () => void;
  noteBackground: () => void;
  noteActive: () => void;
  setTimer: (f: () => void, ms: number) => unknown;
  clearTimer: (handle: unknown) => void;
}) {
  let handle: unknown = null;
  const cancel = () => {
    if (handle !== null) d.clearTimer(handle);
    handle = null;
  };
  return {
    onChange(state: string) {
      cancel(); // coming back, or a second background event, replaces any waiting timer
      if (state === 'active') d.noteActive();
      if (state !== 'background') return;
      d.noteBackground();
      handle = d.setTimer(() => {
        handle = null;
        if (shouldApplyIconNow(d.getState(), d.externalOpen())) d.apply(); // still in the background, and no screen of ours is open on top
      }, d.delayMs);
    },
    dispose: cancel,
  };
}
