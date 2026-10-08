// Quick Add commands. Shared by the browser (to route input) and the server action (to execute) so both always agree.
export type Cmd = 'undo' | 'delete' | 'change';
export function commandOf(text: string): Cmd | null {
  const t = text.trim().toLowerCase();
  if (/^undo\b/.test(t) && !/\d/.test(t)) return 'undo'; // "undo", "undo last", "undo the last transaction", "undo delete"
  if (/^(delete|remove)\b.*\b(last|latest|previous)\b/.test(t)) return 'delete';
  if (/\b(change|set|make|move)\b.*\b(last|latest)\b.*\bto\b/.test(t)) return 'change';
  return null;
}
export const NOTHING_TO_UNDO = 'Nothing to undo. Undo brings back something you deleted in the last 30 days. To remove your latest entry, type "delete last".';
