// Screens the APP itself opens on top of Zovix (the share sheet). Android reports "background" while they are open, but the person has not left.
let depth = 0;
export const externalOpen = () => depth;
export async function withExternal<T>(fn: () => Promise<T>): Promise<T> {
  depth += 1;
  try {
    return await fn();
  } finally {
    depth -= 1;
  }
}
