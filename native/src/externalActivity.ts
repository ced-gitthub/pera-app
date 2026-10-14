// Screens the APP itself opens on top of Zovix (the share sheet). Android reports "background" while they are open, but the person has not left.
// Share.share resolves right after the sheet is launched (before "background"), so the mark is NOT lowered when the promise ends: it stays until the
// app is back in front (noteActive). If the app never goes to the background at all, the mark expires on its own so a later real leave still counts.
let depth = 0;
let marked = false;
let sawBackground = false;
let expiry: ReturnType<typeof setTimeout> | null = null;

export const externalOpen = () => depth + (marked ? 1 : 0);

export function markExternal(expiryMs = 5000) {
  marked = true;
  if (expiry) clearTimeout(expiry);
  expiry = setTimeout(() => {
    expiry = null;
    if (!sawBackground) marked = false;
  }, expiryMs);
}
/** The app went to the background (behind the external screen, or for real). */
export function noteBackground() {
  sawBackground = true;
}
/** The app is back in front: whatever was open is closed. */
export function noteActive() {
  marked = false;
  sawBackground = false;
  if (expiry) clearTimeout(expiry);
  expiry = null;
}

export async function withExternal<T>(fn: () => Promise<T>): Promise<T> {
  depth += 1;
  markExternal();
  try {
    return await fn();
  } finally {
    depth -= 1;
  }
}
