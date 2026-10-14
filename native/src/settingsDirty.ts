// Keeps what was typed in Settings "Your name" alive when the person switches tabs (Settings unmounts) and says so (pure, no react-native).
export const UNSAVED_NAME_LINE = 'You have an unsaved name';

export type DraftStore = {
  get: (key: string) => string | undefined;
  set: (key: string, value: string) => void;
  clear: (key: string) => void;
  clearAll: () => void;
};

/** A draft is remembered per saved value (the key), so a name saved elsewhere never gets an old draft pushed over it. */
export function createDraftStore(): DraftStore {
  const m = new Map<string, string>();
  return {
    get: (key) => m.get(key),
    set: (key, value) => {
      if (value === key) m.delete(key); // back to the saved value: nothing to keep
      else m.set(key, value);
    },
    clear: (key) => void m.delete(key),
    clearAll: () => m.clear(),
  };
}

export const nameDrafts: DraftStore = createDraftStore();

/** True while the typed name differs from the saved one (spaces at the ends do not count). */
export function nameIsDirty(typed: string, saved: string): boolean {
  return typed.trim() !== saved.trim();
}
