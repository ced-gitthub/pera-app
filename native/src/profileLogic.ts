// Pure profile rules (no react-native): the allowed avatars, colours and frames, the default avatar for everybody, and validation of what gets saved.
// Stored in the person's own Supabase user_metadata (owner-only, no table): { avatar, avatarColor, frame, status }.
export const AVATARS = [
  '🦊',
  '🐼',
  '🐯',
  '🦁',
  '🐸',
  '🐙',
  '🦄',
  '🐧',
  '🐨',
  '🐰',
  '🐻',
  '🦉',
  '🐢',
  '🦋',
  '🐬',
  '🦖',
  '🌵',
  '🍀',
  '🌈',
  '🔥',
  '⭐',
  '🚀',
  '🎧',
  '💎',
] as const;
export const AVATAR_COLOR_IDS = ['violet', 'lime', 'coral', 'amber', 'teal', 'sky', 'pink', 'slate'] as const;
export const FRAMES = ['none', 'ring', 'glow'] as const;
export const STATUS_MAX = 60;
export const makeItYoursKey = (uid: string) => `zv_make_it_yours:${uid}`;

export type Avatar = (typeof AVATARS)[number];
export type AvatarColor = (typeof AVATAR_COLOR_IDS)[number];
export type Frame = (typeof FRAMES)[number];
export const FRAME_LABEL: Record<Frame, string> = { none: 'Plain', ring: 'Ring', glow: 'Glow' };
export type Profile = { avatar: Avatar; avatarColor: AvatarColor; frame: Frame; status: string };
export type ProfileMeta = { avatar?: unknown; avatarColor?: unknown; frame?: unknown; status?: unknown } | null | undefined;

const oneOf = <T extends string>(list: readonly T[], x: unknown): x is T =>
  typeof x === 'string' && (list as readonly string[]).includes(x);
export const isAvatar = (x: unknown): x is Avatar => oneOf(AVATARS, x);
export const isAvatarColor = (x: unknown): x is AvatarColor => oneOf(AVATAR_COLOR_IDS, x);
export const isFrame = (x: unknown): x is Frame => oneOf(FRAMES, x);

// A small stable hash so the same name always gets the same default avatar (nothing random).
function hash(seed: string): number {
  let h = 5381;
  for (let i = 0; i < seed.length; i++) h = (h * 33 + seed.charCodeAt(i)) >>> 0;
  return h;
}
export function defaultAvatar(name: string, email = ''): { avatar: Avatar; avatarColor: AvatarColor } {
  const seed = (name.trim() || email.trim()).toLowerCase() || 'zovix';
  const h = hash(seed);
  return { avatar: AVATARS[h % AVATARS.length], avatarColor: AVATAR_COLOR_IDS[Math.floor(h / AVATARS.length) % AVATAR_COLOR_IDS.length] };
}

// Control characters out, spaces collapsed, trimmed, limited. Links are not allowed in a status.
// control characters, zero-width and bidi marks, line/paragraph separators
const BAD_CODES = (c: number) =>
  c <= 0x1f || (c >= 0x7f && c <= 0x9f) || (c >= 0x200b && c <= 0x200f) || (c >= 0x2028 && c <= 0x202e) || (c >= 0x2066 && c <= 0x2069);
const stripBad = (x: string) => Array.from(x, (ch) => (BAD_CODES(ch.charCodeAt(0)) ? ' ' : ch)).join('');
const LINK = /(https?:|www\.|[a-z0-9-]+\.(com|net|org|io|ph|me|ly|gg|co|app|dev|xyz)\b|:\/\/)/i;
export function cleanStatus(raw: unknown): { ok: true; status: string } | { ok: false; message: string } {
  const status = stripBad(typeof raw === 'string' ? raw : '')
    .replace(/\s+/g, ' ')
    .trim();
  if (status.length > STATUS_MAX) return { ok: false, message: `Keep your status to ${STATUS_MAX} characters or fewer.` };
  if (LINK.test(status)) return { ok: false, message: 'Links are not allowed in a status. Use words only.' };
  return { ok: true, status };
}

// What a saved profile looks like for this person: anything missing or not on the allowed lists falls back to their default.
export function profileFromMeta(meta: ProfileMeta, name: string, email = ''): Profile {
  const d = defaultAvatar(name, email);
  const st = cleanStatus(meta?.status);
  return {
    avatar: isAvatar(meta?.avatar) ? meta.avatar : d.avatar,
    avatarColor: isAvatarColor(meta?.avatarColor) ? meta.avatarColor : d.avatarColor,
    frame: isFrame(meta?.frame) ? meta.frame : 'none',
    status: st.ok ? st.status : '',
  };
}

export function validateProfile(p: {
  avatar: unknown;
  avatarColor: unknown;
  frame: unknown;
  status: unknown;
}): { ok: true; profile: Profile } | { ok: false; message: string } {
  if (!isAvatar(p.avatar)) return { ok: false, message: 'Pick one of the avatars in the list.' };
  if (!isAvatarColor(p.avatarColor)) return { ok: false, message: 'Pick one of the avatar colours in the list.' };
  if (!isFrame(p.frame)) return { ok: false, message: 'Pick one of the frames in the list.' };
  const st = cleanStatus(p.status);
  if (!st.ok) return st;
  return { ok: true, profile: { avatar: p.avatar, avatarColor: p.avatarColor, frame: p.frame, status: st.status } };
}

export const avatarLabel = (name: string) => (name.trim() ? `${name.trim()}'s avatar` : 'Your avatar');

// ---- unsaved changes
export const UNSAVED_TITLE = 'Save your changes?';
export const UNSAVED_TEXT = 'You changed your profile but have not saved it yet.';
export const UNSAVED_KEEP = 'Keep editing';
export const UNSAVED_DISCARD = 'Discard';
export const UNSAVED_SAVE = 'Save';
export const PROFILE_SAVED_TOAST = 'Profile saved';

const tidy = (x: string) => x.replace(/\s+/g, ' ').trim();
/** True when the draft differs from what is saved (spaces alone do not count). */
export function isProfileDirty(
  saved: { name: string; profile: Profile },
  draft: { name: string; status: string; profile: Profile },
): boolean {
  return (
    tidy(saved.name) !== tidy(draft.name) ||
    tidy(saved.profile.status) !== tidy(draft.status) ||
    saved.profile.avatar !== draft.profile.avatar ||
    saved.profile.avatarColor !== draft.profile.avatarColor ||
    saved.profile.frame !== draft.profile.frame
  );
}

// ---- the last profile seen on this phone, so the app never shows a placeholder and then swaps it
export const profileCacheKey = (uid: string) => `zv_profile:${uid}`;
export type CachedProfile = { name: string; email: string; profile: Profile };
export function parseCachedProfile(raw: string | null | undefined): CachedProfile | null {
  try {
    const o = JSON.parse(raw ?? '') as { name?: unknown; email?: unknown; profile?: ProfileMeta };
    if (!o || typeof o.name !== 'string' || typeof o.email !== 'string') return null;
    return { name: o.name, email: o.email, profile: profileFromMeta(o.profile, o.name, o.email) };
  } catch {
    return null;
  }
}
