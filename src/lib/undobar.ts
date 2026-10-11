// Tiny in-memory store for the "Deleted. Undo" notice. It lives outside any list row so the notice survives the list refreshing after a delete.
export type DeletedRow = Record<string, unknown>;
let current: DeletedRow | null = null;
const subs = new Set<() => void>();
const emit = () => subs.forEach((f) => f());
export const showUndo = (row: DeletedRow) => {
  current = row;
  emit();
};
export const clearUndo = () => {
  current = null;
  emit();
};
export const subscribeUndo = (f: () => void) => {
  subs.add(f);
  return () => {
    subs.delete(f);
  };
};
export const undoSnapshot = () => current;
